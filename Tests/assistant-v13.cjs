const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'../GaGionEcommerce/wwwroot'),checks=[];
const server=http.createServer((req,res)=>{try{const f=path.join(root,req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end('Missing');}});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'});
 const errors=[];ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const p=await ctx.newPage();let calls=0,failure='ai_quota';
 await p.route('**/api/chat/status',r=>r.fulfill({json:{available:true}}));
 await p.route('**/api/chat',r=>{calls++;return r.fulfill(failure?{status:502,json:{error:failure,message:'PRIVATE-UPSTREAM-DETAIL'}}:{json:{reply:'ChickyJoy là Trạm phát niềm vui. Tôi đã nhận câu hỏi qua AI.',intent:'general',preferences:null,plans:[],products:[],actions:[],suggestions:[],sources:[]}});});
 const ask=async q=>{await p.evaluate(q=>askAssistant(q),q);return p.locator('.chat-message.bot').last().textContent();};
 try{
  await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.__ChickyJoy&&document.querySelectorAll('.product-card').length===72);await p.waitForSelector('#assistantStatus.ai-ready',{state:'attached'});
  await p.evaluate(()=>{closeModal('welcomeModal');toggleChat(true);});
  assert.match(await ask('Quán tên gì, địa chỉ quận 5 và best seller?'),/hết số dư|hết hạn mức/);assert.equal(calls,1);assert.match(await p.locator('#assistantStatus').textContent(),/hết hạn mức/);
  assert.match(await p.locator('.chat-message.bot').last().textContent(),/273 An Dương Vương/);assert(!await p.locator('#chatBody').textContent().then(s=>s.includes('PRIVATE-UPSTREAM-DETAIL')));checks.push('Exhausted credit has a specific safe notice while answering store facts');
  assert.match(await ask('Món thứ hai có cay không?'),/Burger Gà Xốt Phô Mai/);assert.equal(calls,1);checks.push('Follow-up consultation continues without repeating requests against exhausted credit');
  failure='';await p.evaluate(()=>retryAssistant());assert.equal(calls,2);assert.match(await p.locator('#assistantStatus').textContent(),/đang hoạt động/);assert.match(await p.locator('.chat-message.bot').last().textContent(),/nhận câu hỏi qua AI/);checks.push('Explicit retry reconnects and returns to AI after the owner restores service');
  failure='ai_auth';await ask('Quán tên gì?');assert.match(await p.locator('#assistantStatus').textContent(),/cần cập nhật/);await ask('Địa chỉ quận 1');assert.equal(calls,3);checks.push('Invalid server credentials suspend repeated AI calls and keep the catalog usable');
  await p.evaluate(()=>refreshAssistantConnection());failure='ai_provider_rate_limit';assert.match(await ask('Quán tên gì?'),/đợi một phút/);assert.equal(calls,4);failure='';await ask('Tên quán là gì?');assert.equal(calls,5);assert.match(await p.locator('#assistantStatus').textContent(),/đang hoạt động/);checks.push('Temporary provider throttling can recover without treating credit exhaustion as a one-minute delay');
  assert.deepEqual(errors,[]);checks.push('No JavaScript errors');const result={passed:true,provider:'Scripted fixtures; not a live model evaluation',checks};fs.writeFileSync(path.join(__dirname,'assistant-v13-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await ctx.close();await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
