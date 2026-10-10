using GaGionEcommerce.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
using System.Text.Json;

var project = Path.GetFullPath(args.FirstOrDefault() ?? "GaGionEcommerce");
var environment = new TestEnvironment { WebRootPath = Path.Combine(project, "wwwroot"), ContentRootPath = project };
var settings = new Dictionary<string, string?> { ["OpenAI:ApiKey"] = "test-key-not-a-credential", ["OpenAI:Model"] = "gpt-4.1" };
using var handler = new FakeProvider();using var client = new HttpClient(handler);
var service = new AiChatService(client, new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), environment, NullLogger<AiChatService>.Instance);
var checks = new List<string>();
var pref = new MealPreferences(2,150000,false,null,[],"delivery");
var context = new ChatContext("q5","delivery",[2],pref,[new(6,1)],
    [new("Phương án trước","Burger đôi","delivery",[new(6,1)])], [new("GG-OWNED","cooking","BANK","delivery","pending")]);
var question = new ChatRequest("12 nhân 8 là bao nhiêu?", [new("user","Hãy giúp tôi tính toán"),new("assistant","Bạn cần tính gì?")],context);
handler.Payload = Respond(new ChatAnswer("12 × 8 = 96.",[], "general",null,[],[],[],["Giải thích phép nhân"]), true);
var answer = await service.AskAsync(question,CancellationToken.None);
Check(answer.Reply=="12 × 8 = 96."&&answer.Sources.Count==1&&answer.Intent=="general","General reply and HTTP(S) sources parsed");
using(var body=JsonDocument.Parse(handler.RequestBody!)){
 var root=body.RootElement;
 Check(!root.GetProperty("store").GetBoolean(),"Response storage disabled");
 Check(root.GetProperty("input").GetArrayLength()==3,"History and current question preserved");
 var instruction=root.GetProperty("instructions").GetString()!;
 Check(instruction.Contains("ChickyJoy")&&instruction.Contains("Combo Một Mình Vẫn Vui"),"Brand and shared menu grounded");
 Check(instruction.Contains("GG-OWNED")&&instruction.Contains("lastPlans")&&instruction.Contains("cart"),"Scoped order, cart and prior plans in context");
 Check(root.GetProperty("text").GetProperty("format").GetProperty("strict").GetBoolean(),"Strict output schema requested");
 Check(root.GetProperty("text").GetProperty("format").GetProperty("schema").GetProperty("additionalProperties").GetBoolean()==false,"Closed schema");
 Check(root.GetProperty("model").GetString()=="gpt-4.1","Configured model used");
 Check(handler.Authorization=="Bearer test-key-not-a-credential","Key only in provider authorization");
 Check(!root.TryGetProperty("tools",out _),"Web search off by default");
}
checks.Add("AI request includes brand, shared catalog, conversation, scoped context and strict schema; server credential/store=false preserved");
handler.Payload=Respond(new ChatAnswer("Tôi gợi ý phần này.",[],"menu",pref,
 [new("Burger đôi","Hai phần burger và nước","delivery",[new(6,1)]),new("Món hết","","delivery",[new(2,1)]),new("Món giả","","delivery",[new(999,1)]),new("Quá nhiều","","delivery",[new(6,30)])],
 [6,2,999],["menu","currentOrder","autoCancel"],["Thêm nước","Thêm nước"]));
answer=await service.AskAsync(question,CancellationToken.None);
Check(answer.Plans?.Length==1&&answer.Plans[0].Lines[0].Id==6,"Invalid/sold-out plans dropped");
Check(answer.Products?.SequenceEqual([6])==true&&answer.Actions?.SequenceEqual(["menu","currentOrder"])==true,"Products/actions allowlisted");
Check(answer.Suggestions?.Length==1&&answer.Preferences?.Budget==150000,"Preferences and distinct follow-ups returned");
checks.Add("Structured menu plans reject nonexistent/sold-out products, excessive quantity and unknown actions");
handler.Status=HttpStatusCode.Unauthorized;handler.Payload="sensitive-upstream-detail";
await MustFail(()=>service.AskAsync(question,CancellationToken.None));checks.Add("Provider failure becomes a safe error without exposing secrets");
foreach(var failure in new[]{
 (HttpStatusCode.TooManyRequests,"{\"error\":{\"type\":\"insufficient_quota\",\"code\":\"credit_balance_exhausted\",\"message\":\"PRIVATE-UPSTREAM-DETAIL\"}}","ai_quota"),
 (HttpStatusCode.TooManyRequests,"{\"error\":{\"type\":\"rate_limit_error\",\"code\":\"rate_limit_exceeded\"}}","ai_provider_rate_limit"),
 (HttpStatusCode.TooManyRequests,"not-json","ai_provider_rate_limit"),
 (HttpStatusCode.Unauthorized,"private-key-detail","ai_auth"),
 (HttpStatusCode.NotFound,"private-model-detail","ai_model")}){
 handler.Status=failure.Item1;handler.Payload=failure.Item2;
 try{await service.AskAsync(question,CancellationToken.None);throw new Exception("Expected provider failure");}
 catch(ChatUnavailableException error){Check(error.Code==failure.Item3&&!error.UserMessage.Contains("PRIVATE")&&!error.UserMessage.Contains("private"),"Safe specific failure classification");}
}
checks.Add("Exhausted credits, request throttling, invalid credentials and model access remain distinct without exposing provider bodies");
handler.Status=HttpStatusCode.OK;
foreach(var payload in new[]{"{bad-json","{\"output\":[]}",RespondText("ordinary text instead of structured output"),RespondText("{\"reply\":\"thiếu schema\"}"),"{\"status\":\"incomplete\",\"output\":[]}"}){
 handler.Payload=payload;await MustFail(()=>service.AskAsync(question,CancellationToken.None));
}
checks.Add("Malformed, empty, truncated or unstructured answers fail safely");
handler.Payload="{\"output\":[{\"content\":[{\"type\":\"refusal\",\"refusal\":\"Tôi không thể hỗ trợ yêu cầu đó.\"}]}]}";
Check((await service.AskAsync(question,CancellationToken.None)).Reply.Contains("không thể"),"Refusal returned as text");checks.Add("Refusal is readable without unsafe actions");
settings["OpenAI:EnableWebSearch"]="true";
using var searchHandler=new FakeProvider{Payload=handler.Payload};using var searchClient=new HttpClient(searchHandler);
var searchService=new AiChatService(searchClient,new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),environment,NullLogger<AiChatService>.Instance);
await searchService.AskAsync(question,CancellationToken.None);
using(var body=JsonDocument.Parse(searchHandler.RequestBody!))Check(body.RootElement.GetProperty("tools")[0].GetProperty("type").GetString()=="web_search","Configured search tool sent");
checks.Add("Optional web search follows server configuration");
using(var cancel=new CancellationTokenSource()){cancel.Cancel();try{await service.AskAsync(question,cancel.Token);throw new Exception("Cancellation ignored");}catch(OperationCanceledException){}}
checks.Add("User cancellation reaches provider operation");
Console.WriteLine(JsonSerializer.Serialize(new{passed=true,provider="mocked; no external API call",checks},new JsonSerializerOptions{WriteIndented=true}));
static string Respond(ChatAnswer a,bool sources=false)=>RespondText(JsonSerializer.Serialize(new{reply=a.Reply,intent=a.Intent,preferences=a.Preferences,plans=a.Plans,products=a.Products,actions=a.Actions,suggestions=a.Suggestions},new JsonSerializerOptions(JsonSerializerDefaults.Web)),sources);
static string RespondText(string text,bool sources=false)=>JsonSerializer.Serialize(new{status="completed",output=new[]{new{type="message",content=new[]{new{type="output_text",text,annotations=sources?new[]{new{url="https://example.org/source",title="Nguồn"},new{url="javascript:bad",title="Không hợp lệ"}}:[]}}}}});
static void Check(bool passed,string message){if(!passed)throw new Exception(message);}
static async Task MustFail(Func<Task<ChatAnswer>> action){try{await action();}catch(ChatUnavailableException){return;}throw new Exception("Expected safe provider error");}
sealed class FakeProvider:HttpMessageHandler{
 public HttpStatusCode Status{get;set;}=HttpStatusCode.OK;public string Payload{get;set;}="{}";
 public string? RequestBody{get;private set;}public string? Authorization{get;private set;}
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellationToken){
  cancellationToken.ThrowIfCancellationRequested();if(request.RequestUri?.AbsoluteUri!="https://api.openai.com/v1/responses")throw new Exception("Unexpected endpoint");
  RequestBody=await request.Content!.ReadAsStringAsync(cancellationToken);Authorization=request.Headers.Authorization?.ToString();
  return new HttpResponseMessage(Status){Content=new StringContent(Payload,Encoding.UTF8,"application/json")};
 }
}
sealed class TestEnvironment:IWebHostEnvironment{
 public string EnvironmentName{get;set;}="Testing";public string ApplicationName{get;set;}="GaGionEcommerce";
 public string WebRootPath{get;set;}="";public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();
 public string ContentRootPath{get;set;}="";public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();
}
