using GaGionEcommerce.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
// The owner's local credential lives outside wwwroot and never enters frontend assets.
// Insert it before the standard providers so environment variables, User Secrets and
// command-line settings can still override it (including an explicit empty key).
var privateSettingsPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "Secrets", "openai.local.json"));
var privateSettings = new ConfigurationBuilder().AddJsonFile(privateSettingsPath, optional: true, reloadOnChange: false).Build();
builder.Configuration.Sources.Insert(0, new Microsoft.Extensions.Configuration.ChainedConfigurationSource { Configuration = privateSettings });
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 65536);
builder.Services.AddHttpClient<AiChatService>();
builder.Services.AddSingleton<TableOrderService>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("chat", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 12, Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0, AutoReplenishment = true
        }));
    options.AddPolicy("tables", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.OnRejected = async (context, cancellationToken) =>
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "rate_limit", message = "Bạn đang gửi nhiều yêu cầu. Vui lòng thử lại sau một phút." }, cancellationToken);
});

var app = builder.Build();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/table-orders")) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();

app.MapGet("/api/chat/status", (AiChatService service) => Results.Ok(new { available = service.IsConfigured }));
app.MapPost("/api/chat", async (ChatRequest request, AiChatService service, HttpContext context) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    if (!string.IsNullOrEmpty(origin) && (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri) ||
        !string.Equals(originUri.Authority, context.Request.Host.Value, StringComparison.OrdinalIgnoreCase)))
        return Results.Json(new { error = "invalid_origin" }, statusCode: 403);

    if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 1600 ||
        request.History?.Count > 20 || request.History?.Any(turn => turn is null || turn.Role is not ("user" or "assistant") ||
        string.IsNullOrEmpty(turn.Content) || turn.Content.Length > 4000) == true || request.Context?.SoldOut?.Length > 72 || request.Context?.Cart?.Length > 72 ||
        request.Context?.LastPlans?.Length > 3 || request.Context?.LastPlans?.Any(p => p == null || p.Lines?.Length > 8) == true ||
        request.Context?.OrderSummaries?.Length > 3 || request.Context?.Preferences?.Excludes?.Length > 7)
        return Results.BadRequest(new { error = "invalid_question", message = "Câu hỏi hoặc lịch sử trò chuyện không hợp lệ." });

    if (!service.IsConfigured)
        return Results.Json(new { error = "ai_unavailable", message = "Hỏi đáp mở hiện chưa sẵn sàng." }, statusCode: 503);
    try
    {
        var answer = await service.AskAsync(request, context.RequestAborted);
        return Results.Ok(new { reply = answer.Reply, sources = answer.Sources, intent = answer.Intent,
            preferences = answer.Preferences, plans = answer.Plans, products = answer.Products,
            actions = answer.Actions, suggestions = answer.Suggestions });
    }
    catch (ChatUnavailableException error)
    {
        return Results.Json(new { error = error.Code, message = error.UserMessage }, statusCode: 502);
    }
}).RequireRateLimiting("chat");

TableEndpoints.Map(app);
app.Map("/api/{**path}", () => Results.NotFound(new { error = "not_found" }));
// /staff displays the staff workspace; it is not a server-side authorization boundary.
app.MapFallbackToFile("index.html");
app.Run();
