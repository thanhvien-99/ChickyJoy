using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace GaGionEcommerce.Services;

public sealed record TableLineRequest(int ProductId, int Qty, string? Flavor, string[]? ExtraIds, string? Note);
public sealed record TableOrderRequest(string BranchId, string TableId, TableLineRequest[] Items,
    string? Name, string? Phone, string? Note, string Payment, bool AutoVoucher, string? GoodsVoucher,
    bool FirstOrderCandidate, int ExpectedTotal, string ClientRequestId);
public sealed record TableMutation(int Revision, string Action, string? Status, string? Reason);
public sealed class TableOrderException(int status, string code, string message, object? detail = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public object? Detail { get; } = detail;
}

// Table orders share one durable store; customer receipt tokens are never in staff responses.
public sealed class TableOrderService
{
    private readonly string _path, _publicBase;
    private readonly JsonObject _catalog;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public TableOrderService(IWebHostEnvironment environment, IConfiguration configuration)
    {
        _catalog = JsonNode.Parse(File.ReadAllText(Path.Combine(environment.WebRootPath, "assets", "catalog", "store-data.json")))!.AsObject();
        _path = Path.GetFullPath(configuration["Store:DataPath"] ?? Path.Combine(environment.ContentRootPath, "App_Data", "table-orders.json"));
        _publicBase = configuration["Store:PublicBaseUrl"] ?? "";
    }
    public object MenuContext(string? branchId, string? tableId, HttpRequest request)
    {
        var branch = Branch(branchId);
        var table = Table(tableId);
        return new { branch, table, tables = _catalog["tableOrdering"]!["tables"]!.DeepClone(), publicBaseUrl = PublicBase(request) };
    }
    private JsonNode Branch(string? id) => _catalog["branches"]!.AsArray().FirstOrDefault(x => x?["id"]?.GetValue<string>() == id)?.DeepClone()
        ?? throw new TableOrderException(400, "invalid_branch", "Chi nhánh trong mã bàn không hợp lệ.");
    private JsonNode Table(string? id) => _catalog["tableOrdering"]!["tables"]!.AsArray().FirstOrDefault(x => x?["id"]?.GetValue<string>() == id)?.DeepClone()
        ?? throw new TableOrderException(400, "invalid_table", "Số bàn không hợp lệ. Quét lại mã tại bàn hoặc hỏi nhân viên.");
    private string PublicBase(HttpRequest request)
    {
        if (Uri.TryCreate(_publicBase, UriKind.Absolute, out var configured) && configured.Scheme is "http" or "https")
            return configured.GetLeftPart(UriPartial.Authority);
        if (request.Host.Host is not ("localhost" or "127.0.0.1" or "::1")) return $"{request.Scheme}://{request.Host}";
        IPAddress? address = null;
        try
        {
            address = NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .SelectMany(n => n.GetIPProperties().UnicastAddresses).Select(a => a.Address)
                .Where(a => a.AddressFamily == AddressFamily.InterNetwork && IsPrivateAddress(a))
                .OrderBy(a => a.GetAddressBytes()[0] == 192 ? 0 : 1).FirstOrDefault();
        }
        catch (NetworkInformationException) { }
        catch (PlatformNotSupportedException) { }
        return address == null ? $"{request.Scheme}://{request.Host}" : $"{request.Scheme}://{address}{(request.Host.Port is int p ? ":" + p : "")}";
    }
    private static bool IsPrivateAddress(IPAddress address)
    { var b = address.GetAddressBytes(); return b[0] == 10 || b[0] == 192 && b[1] == 168 || b[0] == 172 && b[1] is >= 16 and <= 31; }
    private async Task<T> WithStore<T>(Func<JsonArray, (T Result, bool Write)> action, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            FileStream? lease = null;
            for (var attempt = 0; lease == null && attempt < 30; attempt++)
            {
                try { lease = new FileStream(_path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
                catch (IOException) { await Task.Delay(50, ct); }
            }
            if (lease == null) throw new TableOrderException(503, "store_busy", "Danh sách đơn đang được cập nhật. Vui lòng thử lại.");
            using (lease)
            {
                var rows = File.Exists(_path) ? JsonNode.Parse(await File.ReadAllTextAsync(_path, ct))!.AsArray() : new JsonArray();
                var result = action(rows);
                if (result.Write)
                {
                    var temp = _path + "." + Guid.NewGuid().ToString("N") + ".tmp";
                    try
                    {
                        await File.WriteAllTextAsync(temp, rows.ToJsonString(JsonOptions), ct);
                        using (var flush = new FileStream(temp, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) flush.Flush(true);
                        File.Move(temp, _path, overwrite: true);
                    }
                    finally { if (File.Exists(temp)) File.Delete(temp); }
                }
                return result.Result;
            }
        }
        catch (TableOrderException) { throw; }
        catch (OperationCanceledException) { throw; }
        catch (JsonException) { throw new TableOrderException(503, "storage_unavailable", "Dữ liệu đơn cần được kiểm tra. Vui lòng liên hệ cửa hàng."); }
        catch (IOException) { throw new TableOrderException(503, "storage_unavailable", "Chưa lưu được đơn trên máy chủ. Giữ giỏ và thử lại."); }
        catch (UnauthorizedAccessException) { throw new TableOrderException(503, "storage_unavailable", "Máy chủ chưa có quyền lưu đơn. Vui lòng liên hệ cửa hàng."); }
        finally { _gate.Release(); }
    }
    private static HashSet<int> Unavailable(JsonArray rows) => rows.OfType<JsonObject>().FirstOrDefault(o => o["_metadata"]?.GetValue<string>() == "menu")?["soldOut"]?.AsArray().Select(x => x!.GetValue<int>()).ToHashSet() ?? [];
    public Task<int[]> AvailabilityAsync(CancellationToken ct) => WithStore(rows => (Unavailable(rows).Order().ToArray(), false), ct);
    public Task<int[]> SetAvailabilityAsync(int id, bool available, CancellationToken ct) => WithStore(rows =>
    {
        if (!_catalog["menu"]!.AsArray().Any(p => p?["id"]?.GetValue<int>() == id)) throw new TableOrderException(400, "invalid_item", "Món không có trong thực đơn.");
        var metadata = rows.OfType<JsonObject>().FirstOrDefault(o => o["_metadata"]?.GetValue<string>() == "menu");
        if (metadata == null) { metadata = new JsonObject { ["_metadata"] = "menu", ["soldOut"] = new JsonArray() }; rows.Add(metadata); }
        var ids = Unavailable(rows); if (available) ids.Remove(id); else ids.Add(id);
        metadata["soldOut"] = new JsonArray(ids.Order().Select(i => (JsonNode?)JsonValue.Create(i)).ToArray());
        return (ids.Order().ToArray(), true);
    }, ct);
    public Task<JsonObject> CreateAsync(TableOrderRequest request, CancellationToken ct)
    {
        if (request.Items == null || request.Items.Length is < 1 or > 72 || !Guid.TryParse(request.ClientRequestId, out _) || request.Payment is not ("COD" or "BANK"))
            throw new TableOrderException(400, "invalid_order", "Món hoặc phương thức thanh toán không hợp lệ.");
        var branch = Branch(request.BranchId); var table = Table(request.TableId);
        var name = Text(request.Name, 80); var phone = Phone(request.Phone); var note = Text(request.Note, 180);
        if (!string.IsNullOrEmpty(phone) && !Regex.IsMatch(phone, @"^0[35789]\d{8}$")) throw new TableOrderException(400, "invalid_phone", "Số điện thoại chưa đúng định dạng Việt Nam.");
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request, JsonOptions))));
        return WithStore(rows =>
        {
            var prior = rows.OfType<JsonObject>().FirstOrDefault(o => o["_requestId"]?.GetValue<string>() == request.ClientRequestId);
            if (prior != null)
            {
                if (prior["_fingerprint"]?.GetValue<string>() != fingerprint) throw new TableOrderException(409, "request_conflict", "Lần gửi này có nội dung khác. Vui lòng kiểm tra lại giỏ.");
                return (Receipt(prior), false);
            }
            if (rows.Count >= 10000) throw new TableOrderException(503, "store_full", "Cửa hàng cần lưu trữ lịch sử trước khi nhận thêm đơn.");
            var items = new JsonArray(); var subtotal = 0; var quantities = new Dictionary<string, int>();
            var unavailable = Unavailable(rows);
            foreach (var line in request.Items)
            {
                if (line == null || line.Qty is < 1 or > 20 || (line.ExtraIds?.Length ?? 0) > 12) throw new TableOrderException(400, "invalid_item", "Số lượng món hoặc tùy chọn không hợp lệ.");
                if (unavailable.Contains(line.ProductId)) throw new TableOrderException(409, "item_sold_out", "Một món vừa tạm hết hàng. Vui lòng đổi món trong giỏ.");
                var product = _catalog["menu"]!.AsArray().FirstOrDefault(p => p?["id"]?.GetValue<int>() == line.ProductId)
                    ?? throw new TableOrderException(400, "invalid_item", "Món không còn trong thực đơn.");
                var category = product["cat"]!.GetValue<string>(); var unitPrice = product["price"]!.GetValue<int>();
                var availableExtras = (_catalog["addons"]?[category]?.AsArray() ?? []).Where(x => x != null).ToList();
                if (category is "combo" or "chicken" or "burger" or "rice" or "sides") availableExtras.AddRange(_catalog["sauces"]!.AsArray());
                var extras = new JsonArray();
                foreach (var id in (line.ExtraIds ?? []).Distinct())
                {
                    var extra = availableExtras.FirstOrDefault(e => e?["id"]?.GetValue<string>() == id)
                        ?? throw new TableOrderException(400, "invalid_extra", "Xốt hoặc món thêm không áp dụng cho món này.");
                    unitPrice += extra!["price"]!.GetValue<int>();
                    extras.Add(new JsonObject { ["id"] = id, ["name"] = extra["name"]!.GetValue<string>(), ["price"] = extra["price"]!.GetValue<int>() });
                }
                var flavor = category == "combo" ? Text(line.Flavor, 30) : "";
                if (category == "combo" && flavor is not ("Truyền thống" or "Giòn cay" or "BBQ")) throw new TableOrderException(400, "invalid_flavor", "Chọn hương vị combo trước khi đặt.");
                var lineNote = Text(line.Note, 180);
                var signature = JsonSerializer.Serialize(new { line.ProductId, flavor, extras = (line.ExtraIds ?? []).Distinct().Order().ToArray(), lineNote });
                quantities[signature] = quantities.GetValueOrDefault(signature) + line.Qty;
                if (quantities[signature] > 20) throw new TableOrderException(400, "invalid_quantity", "Tối đa 20 phần cho mỗi lựa chọn món.");
                subtotal = checked(subtotal + unitPrice * line.Qty);
                items.Add(new JsonObject { ["lineId"] = Guid.NewGuid().ToString("N"), ["productId"] = line.ProductId, ["name"] = product["name"]!.GetValue<string>(),
                    ["cat"] = category, ["img"] = product["img"]!.GetValue<string>(), ["unitPrice"] = unitPrice, ["qty"] = line.Qty,
                    ["flavor"] = flavor, ["extras"] = extras, ["note"] = lineNote });
            }
            var firstOrder = request.FirstOrderCandidate && !string.IsNullOrEmpty(phone) && !rows.OfType<JsonObject>().Any(o => o["status"]?.GetValue<string>() != "cancelled" && o["customer"]?["phone"]?.GetValue<string>() == phone);
            var discounts = _catalog["vouchers"]!.AsArray().Where(v => v != null && v["type"]!.GetValue<string>() != "shipping" && subtotal >= v["min"]!.GetValue<int>() &&
                (v["type"]!.GetValue<string>() != "combo" || items.Any(i => i?["cat"]?.GetValue<string>() == "combo")) &&
                (v["code"]!.GetValue<string>() != "WELCOME10" || firstOrder)).Select(v => new { Code = v!["code"]!.GetValue<string>(),
                Saving = v["type"]!.GetValue<string>() == "percent" ? Math.Min((int)Math.Floor(subtotal * v["value"]!.GetValue<int>() / 100d + .5), v["cap"]!.GetValue<int>()) : Math.Min(subtotal, v["value"]!.GetValue<int>()) }).ToArray();
            var voucher = request.AutoVoucher ? discounts.OrderByDescending(v => v.Saving).ThenBy(v => v.Code, StringComparer.Ordinal).FirstOrDefault() : discounts.FirstOrDefault(v => v.Code == request.GoodsVoucher);
            var discount = voucher?.Saving ?? 0; var total = subtotal - discount;
            if (request.ExpectedTotal != total) throw new TableOrderException(409, "price_changed", "Giá hoặc điều kiện ưu đãi vừa thay đổi. Giỏ được giữ lại; kiểm tra tổng mới rồi xác nhận lại.", new { total, subtotal, discount, voucher = voucher?.Code, welcomeEligible = firstOrder });
            var at = DateTimeOffset.UtcNow.ToString("O");
            var order = new JsonObject { ["id"] = "CJ" + DateTime.UtcNow.ToString("yyMMdd") + "-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                ["createdAt"] = at, ["dateKey"] = DateTime.UtcNow.ToString("yyyy-MM-dd"), ["serverManaged"] = true, ["revision"] = 1,
                ["mode"] = "dinein", ["table"] = table.DeepClone(), ["branch"] = branch.DeepClone(), ["customer"] = new JsonObject {
                    ["name"] = name.Length > 0 ? name : "Khách tại " + table["label"]!.GetValue<string>(), ["phone"] = phone,
                    ["address"] = "Phục vụ tại " + table["label"]!.GetValue<string>(), ["area"] = "", ["note"] = note },
                ["items"] = items, ["subtotal"] = subtotal, ["goodsDiscount"] = discount, ["shippingDiscount"] = 0, ["discount"] = discount,
                ["shipping"] = 0, ["total"] = total, ["voucher"] = voucher?.Code, ["voucherCodes"] = voucher == null ? new JsonArray() : new JsonArray(voucher.Code),
                ["payment"] = request.Payment, ["paymentStatus"] = request.Payment == "COD" ? "Thanh toán tại cửa hàng" : "Chờ thanh toán",
                ["paymentVerified"] = false, ["paymentReported"] = false, ["status"] = "new", ["scheduled"] = "soon", ["scheduledAt"] = null,
                ["timeline"] = new JsonArray(new JsonObject { ["status"] = "new", ["at"] = at }),
                ["_receiptToken"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(), ["_requestId"] = request.ClientRequestId, ["_fingerprint"] = fingerprint };
            rows.Insert(0, order); return (Receipt(order), true);
        }, ct);
    }
    private static string Text(string? value, int limit)
    { value = (value ?? "").Trim(); if (value.Length > limit) throw new TableOrderException(400, "invalid_text", "Nội dung nhập quá dài."); return value; }
    private static string Phone(string? phone) { var s = Regex.Replace(phone ?? "", @"[\s().-]", ""); return s.StartsWith("+84") ? "0" + s[3..] : s; }
    private static JsonObject PublicOrder(JsonObject order)
    { var clone = (JsonObject)order.DeepClone(); foreach (var key in clone.Select(p => p.Key).Where(k => k.StartsWith('_')).ToArray()) clone.Remove(key); return clone; }
    private static JsonObject Receipt(JsonObject order) => new() { ["order"] = PublicOrder(order), ["receiptToken"] = order["_receiptToken"]!.DeepClone() };
    public Task<JsonArray> StaffListAsync(CancellationToken ct) => WithStore(rows => (new JsonArray(rows.OfType<JsonObject>().Where(o => o["serverManaged"]?.GetValue<bool>() == true).Select(o => (JsonNode)PublicOrder(o)).ToArray()), false), ct);
    public Task<JsonObject> ReadAsync(string id, string token, CancellationToken ct) => WithStore(rows => (PublicOrder(Find(rows, id, token)), false), ct);
    private static JsonObject Find(JsonArray rows, string id, string? token, bool staff = false)
    {
        var order = rows.OfType<JsonObject>().FirstOrDefault(o => o["serverManaged"]?.GetValue<bool>() == true && o["id"]?.GetValue<string>() == id);
        if (order == null || !staff && (token?.Length != 64 || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(token), Encoding.UTF8.GetBytes(order["_receiptToken"]!.GetValue<string>()))))
            throw new TableOrderException(404, "order_not_found", "Không tìm thấy đơn hoặc biên nhận không hợp lệ.");
        return order;
    }
    public Task<JsonObject> MutateAsync(string id, string? token, TableMutation mutation, bool staff, CancellationToken ct) => WithStore(rows =>
    {
        var o = Find(rows, id, token, staff); var status = o["status"]!.GetValue<string>();
        if (o["revision"]!.GetValue<int>() != mutation.Revision) throw new TableOrderException(409, "order_changed", "Nhà hàng vừa cập nhật đơn. Xem trạng thái mới rồi thử lại.");
        if (status is "done" or "cancelled") throw new TableOrderException(409, "order_ended", "Đơn đã kết thúc.");
        var at = DateTimeOffset.UtcNow.ToString("O"); var timeline = o["timeline"]!.AsArray();
        var pending = o["cancellation"]?["status"]?.GetValue<string>() == "pending";
        if (!staff && mutation.Action == "cancel")
        {
            if (pending) throw new TableOrderException(409, "cancel_pending", "Yêu cầu hủy đang chờ nhà hàng phản hồi.");
            var direct = status == "new"; var reason = Text(mutation.Reason, 300);
            o["cancellation"] = new JsonObject { ["status"] = direct ? "accepted" : "pending", ["reason"] = reason.Length > 0 ? reason : "Thay đổi nhu cầu", ["requestedAt"] = at };
            if (direct) { Cancel(o, at, "customer"); } else timeline.Add(new JsonObject { ["status"] = "cancel_requested", ["at"] = at, ["actor"] = "customer" });
        }
        else if (!staff && mutation.Action == "payment_report")
        {
            if (o["payment"]!.GetValue<string>() != "BANK") throw new TableOrderException(400, "invalid_payment", "Đơn này thanh toán tại cửa hàng.");
            if (o["paymentReported"]?.GetValue<bool>() == true || o["paymentVerified"]?.GetValue<bool>() == true) return (PublicOrder(o), false);
            o["paymentReported"] = true; o["paymentConfirmed"] = true; o["paymentReportedAt"] = at; o["paymentStatus"] = "Đã báo thanh toán — chờ nhà hàng kiểm tra";
        }
        else if (staff && mutation.Action == "payment_verify")
        { o["paymentVerified"] = true; o["paymentConfirmed"] = true; o["paymentVerifiedAt"] = at; o["paymentStatus"] = "Nhà hàng đã xác nhận nhận tiền"; }
        else if (staff && mutation.Action == "cancel_reject")
        {
            if (!pending) throw new TableOrderException(409, "no_cancel_request", "Không có yêu cầu hủy đang chờ.");
            o["cancellation"]!["status"] = "rejected"; o["cancellation"]!["resolvedAt"] = at; o["cancellation"]!["resolvedBy"] = "staff";
            timeline.Add(new JsonObject { ["status"] = "cancel_rejected", ["at"] = at, ["actor"] = "staff" });
        }
        else if (staff && mutation.Action == "status")
        {
            var next = status switch { "new" => "cooking", "cooking" => "ready", "ready" => "done", _ => "" };
            if (mutation.Status == "cancelled") Cancel(o, at, "staff");
            else
            {
                if (pending || mutation.Status != next) throw new TableOrderException(409, "invalid_transition", "Xử lý yêu cầu hủy và chuyển trạng thái theo đúng tiến trình.");
                if (next == "done" && o["payment"]!.GetValue<string>() == "BANK" && o["paymentVerified"]?.GetValue<bool>() != true)
                    throw new TableOrderException(409, "payment_unverified", "Kiểm tra khoản nhận trước khi hoàn tất đơn.");
                if (next == "done" && o["payment"]!.GetValue<string>() == "COD") { o["paymentVerified"] = true; o["paymentStatus"] = "Đã thu tiền tại cửa hàng"; }
                o["status"] = next; timeline.Add(new JsonObject { ["status"] = next, ["at"] = at, ["actor"] = "staff" });
            }
        }
        else throw new TableOrderException(403, "action_denied", "Thao tác không được phép.");
        o["revision"] = o["revision"]!.GetValue<int>() + 1; return (PublicOrder(o), true);
    }, ct);
    private static void Cancel(JsonObject o, string at, string actor)
    {
        o["status"] = "cancelled";
        if (o["cancellation"] != null) { o["cancellation"]!["status"] = "accepted"; o["cancellation"]!["resolvedAt"] = at; o["cancellation"]!["resolvedBy"] = actor; }
        if (o["paymentReported"]?.GetValue<bool>() == true || o["paymentVerified"]?.GetValue<bool>() == true) o["refundStatus"] = "review";
        o["timeline"]!.AsArray().Add(new JsonObject { ["status"] = "cancelled", ["at"] = at, ["actor"] = actor });
    }
}

public static class TableEndpoints
{
    private static bool SameOrigin(HttpContext c)
    {
        var origin = c.Request.Headers.Origin.ToString();
        return string.IsNullOrEmpty(origin) || Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
            uri.Scheme == c.Request.Scheme && string.Equals(uri.Authority, c.Request.Host.Value, StringComparison.OrdinalIgnoreCase);
    }
    private static bool StaffAccess(HttpContext c) => c.Connection.RemoteIpAddress is IPAddress address &&
        IPAddress.IsLoopback(address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address) &&
        (c.Request.Host.Host == "localhost" || IPAddress.TryParse(c.Request.Host.Host.Trim('[', ']'), out var host) && IPAddress.IsLoopback(host));
    private static string ReceiptToken(HttpContext c)
    { var header = c.Request.Headers.Authorization.ToString(); return header.StartsWith("Bearer ", StringComparison.Ordinal) ? header[7..] : ""; }
    private static IResult Denied() => Results.Json(new { error = "staff_local_only", message = "Mở màn hình nhân viên bằng localhost trên máy chạy cửa hàng." }, statusCode: 403);
    private static async Task<IResult> Execute<T>(Func<Task<T>> operation)
    {
        try { return Results.Ok(await operation()); }
        catch (TableOrderException e) { return Results.Json(new { error = e.Code, message = e.Message, detail = e.Detail }, statusCode: e.Status); }
    }
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/table-availability", (TableOrderService service, HttpContext context) => Execute(() => service.AvailabilityAsync(context.RequestAborted)));
        app.MapPost("/api/table-availability/{id:int}", (int id, TableAvailabilityRequest request, TableOrderService service, HttpContext context) =>
            !StaffAccess(context) || !SameOrigin(context) ? Task.FromResult(Denied()) : Execute(() => service.SetAvailabilityAsync(id, request.Available, context.RequestAborted)));
        app.MapGet("/api/tables", (string? branch, string? table, TableOrderService service, HttpContext context) =>
            Execute(() => Task.FromResult(service.MenuContext(branch ?? "q5", table ?? "T01", context.Request))));
        app.MapPost("/api/table-orders", (TableOrderRequest request, TableOrderService service, HttpContext context) =>
            !SameOrigin(context) ? Task.FromResult<IResult>(Results.StatusCode(403)) : Execute(() => service.CreateAsync(request, context.RequestAborted)))
            .RequireRateLimiting("tables");
        app.MapGet("/api/table-orders/staff", (TableOrderService service, HttpContext context) =>
            !StaffAccess(context) ? Task.FromResult(Denied()) : Execute(() => service.StaffListAsync(context.RequestAborted)));
        app.MapPost("/api/table-orders/{id}/staff", (string id, TableMutation mutation, TableOrderService service, HttpContext context) =>
            !StaffAccess(context) || !SameOrigin(context) ? Task.FromResult(Denied()) : Execute(() => service.MutateAsync(id, null, mutation, true, context.RequestAborted)));
        app.MapGet("/api/table-orders/{id}", (string id, TableOrderService service, HttpContext context) =>
            Execute(() => service.ReadAsync(id, ReceiptToken(context), context.RequestAborted)));
        app.MapPost("/api/table-orders/{id}/actions", (string id, TableMutation mutation, TableOrderService service, HttpContext context) =>
            !SameOrigin(context) ? Task.FromResult<IResult>(Results.StatusCode(403)) : Execute(() => service.MutateAsync(id, ReceiptToken(context), mutation, false, context.RequestAborted)));
    }
}
public sealed record TableAvailabilityRequest(bool Available);
