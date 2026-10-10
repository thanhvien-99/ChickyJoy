using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GaGionEcommerce.Services;

public sealed record ChatTurn(string Role, string Content);
public sealed record MealLine(int Id, int Qty);
public sealed record MealPreferences(int? People, int? Budget, bool? Spicy, string? Category,
    string[]? Excludes, string? Mode, bool WithDrink = false, bool IncludeShipping = true);
public sealed record MealPlan(string Title, string Description, string Mode, MealLine[] Lines);
public sealed record OrderSummary(string Id, string Status, string Payment, string Mode, string? Cancellation);
public sealed record ChatContext(string? BranchId, string? Mode, int[]? SoldOut,
    MealPreferences? Preferences = null, MealLine[]? Cart = null,
    MealPlan[]? LastPlans = null, OrderSummary[]? OrderSummaries = null);
public sealed record ChatRequest(string Message, List<ChatTurn>? History, ChatContext? Context);
public sealed record ChatSource(string Title, string Url);
public sealed record ChatAnswer(string Reply, List<ChatSource> Sources, string Intent = "general",
    MealPreferences? Preferences = null, MealPlan[]? Plans = null, int[]? Products = null,
    string[]? Actions = null, string[]? Suggestions = null);
public sealed class ChatUnavailableException(string code = "ai_unavailable") : Exception
{
    public string Code { get; } = code;
    public string UserMessage => Code switch
    {
        "ai_quota" => "Hội thoại AI tạm dừng vì tài khoản API của cửa hàng đã hết số dư hoặc hạn mức. Chủ cửa hàng cần kiểm tra Billing/Usage. Bạn vẫn có thể hỏi về món, giá, địa chỉ hoặc liên hệ Zalo.",
        "ai_auth" => "Khóa AI của cửa hàng không còn hợp lệ. Chủ cửa hàng cần cập nhật cấu hình máy chủ. Bạn vẫn có thể hỏi về thực đơn hoặc liên hệ Zalo.",
        "ai_model" => "Tài khoản AI của cửa hàng chưa truy cập được model đã cấu hình. Bạn vẫn có thể hỏi về thực đơn hoặc liên hệ Zalo.",
        "ai_provider_rate_limit" => "Dịch vụ AI đang giới hạn lượt hỏi. Vui lòng thử lại sau một phút; phần tra cứu thực đơn vẫn hoạt động.",
        _ => "Kết nối hỏi đáp đang gián đoạn. Bạn có thể thử lại hoặc liên hệ Zalo."
    };
}
internal sealed record AnswerEnvelope(string Reply, string Intent, MealPreferences? Preferences,
    MealPlan[]? Plans, int[]? Products, string[]? Actions, string[]? Suggestions);

public sealed class AiChatService
{
    private readonly HttpClient _client;
    private readonly string _apiKey, _model, _catalogPath, _instructionsPath;
    private readonly bool _useGemini;
    private readonly int _maxOutputTokens;
    private readonly bool _webSearch;
    private readonly ILogger<AiChatService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] Categories = ["combo", "chicken", "burger", "rice", "sides", "drinks", "dessert"];
    private static readonly string[] ActionNames = ["menu", "deals", "history", "currentOrder", "branch", "party", "receiving", "cancellation", "contact"];
    private static readonly string[] Statuses = ["new", "cooking", "ready", "shipping", "done", "cancelled"];
    private static readonly JsonElement AnswerSchema = BuildSchema();

    public AiChatService(HttpClient client, IConfiguration configuration, IWebHostEnvironment environment, ILogger<AiChatService> logger)
    {
        _client = client; _logger = logger;
        var geminiKey = configuration["Gemini:ApiKey"] ?? configuration["GEMINI_API_KEY"] ?? "";
        _useGemini = !string.IsNullOrWhiteSpace(geminiKey);
        _apiKey = _useGemini ? geminiKey : (configuration["OpenAI:ApiKey"] ?? configuration["OPENAI_API_KEY"] ?? "");
        _model = _useGemini ? (configuration["Gemini:Model"] ?? "gemini-2.5-flash") : (configuration["OpenAI:Model"] ?? "gpt-4.1");
        _maxOutputTokens = Math.Clamp(configuration.GetValue("OpenAI:MaxOutputTokens", 2400), 512, 4096);
        _webSearch = configuration.GetValue("OpenAI:EnableWebSearch", false);
        _client.Timeout = TimeSpan.FromSeconds(Math.Clamp(configuration.GetValue("OpenAI:TimeoutSeconds", 45), 10, 60));
        _catalogPath = Path.Combine(environment.WebRootPath, "assets", "catalog", "store-data.json");
        _instructionsPath = Path.Combine(environment.ContentRootPath, "Services", "AssistantInstructions.md");
    }
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<ChatAnswer> AskAsync(ChatRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var catalogText = await File.ReadAllTextAsync(_catalogPath, cancellationToken);
            using var catalog = JsonDocument.Parse(catalogText);
            var ids = catalog.RootElement.GetProperty("menu").EnumerateArray().Select(p => p.GetProperty("id").GetInt32()).ToHashSet();
            var soldOut = (request.Context?.SoldOut ?? []).Where(ids.Contains).Distinct().ToArray();
            var allowed = ids.Except(soldOut).ToHashSet();
            var branchIds = catalog.RootElement.GetProperty("branches").EnumerateArray().Select(b => b.GetProperty("id").GetString()).ToArray();
            var currentContext = new
            {
                branchId = branchIds.Contains(request.Context?.BranchId) ? request.Context?.BranchId : branchIds.FirstOrDefault(),
                mode = request.Context?.Mode is "pickup" or "dinein" ? request.Context.Mode : "delivery", soldOut,
                preferences = NormalizePreferences(request.Context?.Preferences),
                cart = (request.Context?.Cart ?? []).Where(i => ids.Contains(i.Id) && i.Qty is >= 1 and <= 20).Take(72).ToArray(),
                lastPlans = (request.Context?.LastPlans ?? []).Select(p => NormalizePlan(p, ids)).Where(p => p != null).Take(3).ToArray(),
                orderSummaries = (request.Context?.OrderSummaries ?? []).Where(o =>
                    o != null && !string.IsNullOrWhiteSpace(o.Id) && o.Id.Length <= 60 && Statuses.Contains(o.Status) &&
                    o.Mode is "pickup" or "delivery" or "dinein" && o.Payment is "COD" or "BANK" or "MOMO" or "VNPAY")
                    .Take(3).Select(o => new { o.Id, o.Status, o.Payment, o.Mode,
                        cancellation = o.Cancellation is "pending" or "accepted" or "rejected" ? o.Cancellation : null }).ToArray()
            };
            // Keep the stable catalog before per-request context so the prompt remains reusable.
            var instructions = await File.ReadAllTextAsync(_instructionsPath, cancellationToken) +
                "\nDỮ LIỆU CỬA HÀNG:\n" + catalogText +
                "\nNGỮ CẢNH GIAO DIỆN (chỉ để tư vấn, không phải bằng chứng giao dịch):\n" + JsonSerializer.Serialize(currentContext, JsonOptions);
            var input = (request.History ?? []).Select(turn => new { role = turn.Role, content = turn.Content }).ToList();
            input.Add(new { role = "user", content = request.Message.Trim() });
            if (_useGemini)
                return await AskGeminiAsync(instructions, request, allowed, cancellationToken);
            var payload = new Dictionary<string, object>
            {
                ["model"] = _model, ["instructions"] = instructions, ["input"] = input,
                ["store"] = false, ["max_output_tokens"] = _maxOutputTokens,
                ["text"] = new { format = new { type = "json_schema", name = "chickyjoy_answer", strict = true, schema = AnswerSchema } }
            };
            if (_webSearch) payload["tools"] = new[] { new { type = "web_search" } };
            using var outbound = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
            outbound.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            outbound.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _client.SendAsync(outbound, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var failure = await ClassifyProviderFailure(response, cancellationToken);
                // Do not log the provider body: authentication errors can contain credentials.
                _logger.LogWarning("Chat provider returned HTTP {StatusCode}; category {Category}", (int)response.StatusCode, failure);
                throw new ChatUnavailableException(failure);
            }
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (document.RootElement.TryGetProperty("status", out var responseStatus) && responseStatus.GetString() is "incomplete" or "failed")
                throw new ChatUnavailableException();
            var fragments = new List<string>(); var sources = new List<ChatSource>(); var refusals = new List<string>();
            if (document.RootElement.TryGetProperty("output", out var output))
                foreach (var item in output.EnumerateArray())
                {
                    if (!item.TryGetProperty("content", out var content)) continue;
                    foreach (var part in content.EnumerateArray())
                    {
                        if (!part.TryGetProperty("type", out var type)) continue;
                        if (type.GetString() == "output_text" && part.TryGetProperty("text", out var text)) fragments.Add(text.GetString() ?? "");
                        if (type.GetString() == "refusal" && part.TryGetProperty("refusal", out var refusal)) refusals.Add(refusal.GetString() ?? "");
                        if (!part.TryGetProperty("annotations", out var annotations)) continue;
                        foreach (var annotation in annotations.EnumerateArray())
                        {
                            if (!annotation.TryGetProperty("url", out var url)) continue;
                            var value = url.GetString();
                            if (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
                                sources.Add(new ChatSource(annotation.TryGetProperty("title", out var title) ? title.GetString() ?? uri.Host : uri.Host, value!));
                        }
                    }
                }
            if (refusals.Any(s => !string.IsNullOrWhiteSpace(s))) return new ChatAnswer(Limit(string.Join("\n", refusals), 6000), []);
            var envelope = JsonSerializer.Deserialize<AnswerEnvelope>(string.Join("", fragments), JsonOptions);
            if (envelope == null || string.IsNullOrWhiteSpace(envelope.Reply) || envelope.Reply.Length > 6000 ||
                envelope.Intent is not ("menu" or "order" or "policy" or "general" or "clarify") ||
                envelope.Plans == null || envelope.Products == null || envelope.Actions == null || envelope.Suggestions == null)
                throw new ChatUnavailableException();
            var plans = envelope.Plans.Take(3).Select(p => NormalizePlan(p, allowed)).Where(p => p != null).Cast<MealPlan>().ToArray();
            var reply = envelope.Reply.Trim();
            if (envelope.Plans.Length > 0 && plans.Length == 0)
                reply += "\n\nPhương án chưa khớp thực đơn đang bán nên chưa hiển thị để đặt. Bạn có thể hỏi lại hoặc mở thực đơn.";
            return new ChatAnswer(reply, sources.DistinctBy(source => source.Url).Take(6).ToList(), envelope.Intent,
                NormalizePreferences(envelope.Preferences), plans, envelope.Products.Where(allowed.Contains).Distinct().Take(6).ToArray(),
                envelope.Actions.Where(ActionNames.Contains).Distinct().Take(4).ToArray(),
                envelope.Suggestions.Where(s => !string.IsNullOrWhiteSpace(s) && s.Length <= 120).Distinct().Take(3).ToArray());
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { throw new ChatUnavailableException(); }
        catch (HttpRequestException) { throw new ChatUnavailableException(); }
        catch (JsonException) { throw new ChatUnavailableException(); }
        catch (InvalidOperationException) { throw new ChatUnavailableException(); }
        catch (IOException) { throw new ChatUnavailableException(); }
        catch (KeyNotFoundException) { throw new ChatUnavailableException(); }
        catch (NullReferenceException) { throw new ChatUnavailableException(); }
    }
    private async Task<ChatAnswer> AskGeminiAsync(string instructions, ChatRequest request, HashSet<int> allowed, CancellationToken cancellationToken)
    {
        // Gemini uses a different endpoint, authentication header and response format from OpenAI.
        var turns = (request.History ?? []).Select(h => new
        {
            role = h.Role == "assistant" ? "model" : "user",
            parts = new[] { new { text = h.Content } }
        }).ToList();
        turns.Add(new { role = "user", parts = new[] { new { text = request.Message.Trim() } } });
        var schemaInstructions = "\nCHỈ TRẢ VỀ JSON hợp lệ, không Markdown. Cấu trúc JSON BẮT BUỘC: " +
            "{\"reply\":\"nội dung tư vấn\",\"intent\":\"general\",\"preferences\":null,\"plans\":[],\"products\":[],\"actions\":[],\"suggestions\":[]}. " +
            "intent chỉ dùng menu/order/policy/general/clarify. Giữ mọi mảng không sử dụng là []. " +
            "Nếu preferences khác null phải đủ people,budget,spicy,category,excludes,mode,withDrink,includeShipping. " +
            "Nếu có plans thì mỗi phần tử đủ title,description,mode,lines; mỗi line đủ id,qty. " +
            "Chỉ dùng ID sản phẩm trong dữ liệu cửa hàng. Tư vấn tự nhiên theo câu hỏi, không dùng câu trả lời mẫu.";
        var payload = new
        {
            systemInstruction = new { parts = new[] { new { text = instructions + schemaInstructions } } },
            contents = turns,
            generationConfig = new { responseMimeType = "application/json", maxOutputTokens = 1024, temperature = 0.65 }
        };
        var modelName = Uri.EscapeDataString(_model);
        using var outbound = new HttpRequestMessage(HttpMethod.Post,
            $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent");
        outbound.Headers.TryAddWithoutValidation("x-goog-api-key", _apiKey);
        outbound.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
        using var response = await _client.SendAsync(outbound, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var failure = (int)response.StatusCode switch
            {
                400 or 401 => "ai_auth",
                403 or 404 => "ai_model",
                429 => "ai_provider_rate_limit",
                _ => "ai_unavailable"
            };
            _logger.LogWarning("Gemini returned HTTP {StatusCode}; category {Category}", (int)response.StatusCode, failure);
            throw new ChatUnavailableException(failure);
        }
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;
        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            throw new ChatUnavailableException();
        var candidate = candidates[0];
        if (!candidate.TryGetProperty("content", out var content) || !content.TryGetProperty("parts", out var parts))
            throw new ChatUnavailableException();
        var answerJson = string.Join("", parts.EnumerateArray().Where(part => part.TryGetProperty("text", out _))
            .Select(part => part.GetProperty("text").GetString()));
        var envelope = JsonSerializer.Deserialize<AnswerEnvelope>(answerJson, JsonOptions);
        if (envelope == null || string.IsNullOrWhiteSpace(envelope.Reply) || envelope.Reply.Length > 6000 ||
            envelope.Intent is not ("menu" or "order" or "policy" or "general" or "clarify") ||
            envelope.Plans == null || envelope.Products == null || envelope.Actions == null || envelope.Suggestions == null)
            throw new ChatUnavailableException();
        var plans = envelope.Plans.Take(3).Select(p => NormalizePlan(p, allowed)).Where(p => p != null).Cast<MealPlan>().ToArray();
        var reply = envelope.Reply.Trim();
        if (envelope.Plans.Length > 0 && plans.Length == 0)
            reply += "\n\nPhương án chưa khớp thực đơn đang bán nên chưa hiển thị để đặt. Bạn có thể hỏi lại hoặc mở thực đơn.";
        return new ChatAnswer(reply, [], envelope.Intent, NormalizePreferences(envelope.Preferences), plans,
            envelope.Products.Where(allowed.Contains).Distinct().Take(6).ToArray(),
            envelope.Actions.Where(ActionNames.Contains).Distinct().Take(4).ToArray(),
            envelope.Suggestions.Where(s => !string.IsNullOrWhiteSpace(s) && s.Length <= 120).Distinct().Take(3).ToArray());
    }

    private static async Task<string> ClassifyProviderFailure(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var status = (int)response.StatusCode;
        if (status == 401) return "ai_auth";
        if (status is 403 or 404) return "ai_model";
        if (status != 429) return "ai_unavailable";
        try
        {
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (body.RootElement.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object)
            {
                var code = error.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : "";
                var type = error.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : "";
                if (type == "insufficient_quota" || code is "insufficient_quota" or "credit_balance_exhausted" or
                    "organization_spend_limit_exceeded" or "project_spend_limit_exceeded" or "organization_usage_limit_exceeded")
                    return "ai_quota";
            }
        }
        catch (JsonException) { }
        return "ai_provider_rate_limit";
    }
    private static string Limit(string? text, int max) => (text ?? "")[..Math.Min(text?.Length ?? 0, max)].Trim();
    private static MealPreferences? NormalizePreferences(MealPreferences? p) => p == null ? null : new(
        p.People is >= 1 and <= 1000 ? p.People : null, p.Budget is >= 1 and <= 100000000 ? p.Budget : null,
        p.Spicy, Categories.Contains(p.Category) ? p.Category : null,
        (p.Excludes ?? []).Where(Categories.Contains).Distinct().ToArray(),
        p.Mode is "delivery" or "pickup" or "dinein" ? p.Mode : null, p.WithDrink, p.IncludeShipping);
    private static MealPlan? NormalizePlan(MealPlan? p, HashSet<int> ids)
    {
        if (p == null || string.IsNullOrWhiteSpace(p.Title) || p.Lines == null || p.Lines.Length is < 1 or > 8 ||
            p.Mode is not ("delivery" or "pickup" or "dinein") || p.Lines.Any(i => i == null || !ids.Contains(i.Id) || i.Qty is < 1 or > 20)) return null;
        var lines = p.Lines.GroupBy(i => i.Id).Select(g => new MealLine(g.Key, g.Sum(i => i.Qty))).ToArray();
        if (lines.Any(i => i.Qty > 20)) return null;
        return new MealPlan(Limit(p.Title, 100), Limit(p.Description, 400), p.Mode, lines);
    }
    private static JsonElement BuildSchema()
    {
        using var document = JsonDocument.Parse("""
        {"type":"object","additionalProperties":false,"required":["reply","intent","preferences","plans","products","actions","suggestions"],"properties":{
          "reply":{"type":"string"},"intent":{"type":"string","enum":["menu","order","policy","general","clarify"]},
          "preferences":{"anyOf":[{"type":"null"},{"type":"object","additionalProperties":false,"required":["people","budget","spicy","category","excludes","mode","withDrink","includeShipping"],"properties":{
            "people":{"type":["integer","null"]},"budget":{"type":["integer","null"]},"spicy":{"type":["boolean","null"]},
            "category":{"anyOf":[{"type":"null"},{"type":"string","enum":["combo","chicken","burger","rice","sides","drinks","dessert"]}]},
            "excludes":{"type":"array","items":{"type":"string","enum":["combo","chicken","burger","rice","sides","drinks","dessert"]}},
            "mode":{"anyOf":[{"type":"null"},{"type":"string","enum":["delivery","pickup","dinein"]}]},"withDrink":{"type":"boolean"},"includeShipping":{"type":"boolean"}}}]},
          "plans":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["title","description","mode","lines"],"properties":{
            "title":{"type":"string"},"description":{"type":"string"},"mode":{"type":"string","enum":["delivery","pickup","dinein"]},
            "lines":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","qty"],"properties":{"id":{"type":"integer"},"qty":{"type":"integer"}}}}}}},
          "products":{"type":"array","items":{"type":"integer"}},
          "actions":{"type":"array","items":{"type":"string","enum":["menu","deals","history","currentOrder","branch","party","receiving","cancellation","contact"]}},
          "suggestions":{"type":"array","items":{"type":"string"}}
        }}
        """);
        return document.RootElement.Clone();
    }
}
