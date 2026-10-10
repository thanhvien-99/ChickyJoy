import { menu, vouchers, branches, SHIPPING_FEE } from '../data/catalog.js';
import { contact } from '../data/siteConfig.js';
import { adviseMenu, isAdviceQuestion, quoteMeal } from '../services/menuAdvisor.js';
import { normalizeAiAnswer, buildChatContext } from '../services/assistantBridge.js';
import { consultStore, rememberStoreFocus } from '../services/sellerKnowledge.js';
import { customerOrders } from '../services/orderAccess.js';
import { paymentConfig } from '../services/payment.js';
import { state, getBranch, persistCustomerState } from '../state.js';
import { esc, money, searchText, uid } from '../utils.js';
import { toast } from './ui.js';

const storageKey='gagion_chat_session_v9';
let history=[],ready=Promise.resolve(),aiAvailable=false,busy=false,controller,conversationVersion=0,lastPreferences={},lastPlans=[],sellerMemory={},chatLockedPage=false,aiVerified=false,aiBlockedReason='';
const greeting='Chào bạn, đây là ChickyJoy — Trạm phát niềm vui. Bạn có thể hỏi món nào nổi bật, món gồm những gì, giá, địa chỉ hoặc nhờ tôi chọn bữa phù hợp. Bạn muốn biết điều gì?';
const actions={menu:'Xem thực đơn',deals:'Xem ưu đãi',history:'Đơn của bạn',currentOrder:'Mở đơn gần nhất',branch:'Chọn nhà hàng',party:'Đặt tiệc',receiving:'Nhận món & thanh toán',cancellation:'Hướng dẫn hủy đơn',contact:'Nhà hàng & liên hệ'};
window.addEventListener('chickyjoy:ai-blocked',e=>{if(['ai_quota','ai_auth','ai_model'].includes(e.detail?.code)){aiBlockedReason=e.detail.code;aiAvailable=false;aiVerified=false;updateAssistantStatus();}});
function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify(history.slice(-40)));}catch{}}
function formatText(text){
 const inline=value=>esc(value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
 const parts=String(text).split(/```[\w+-]*\n?([\s\S]*?)```/g);
 return parts.map((value,index)=>index%2?'<pre><code>'+esc(value)+'</code></pre>':inline(value)).join('');
}
function safeSources(sources){return(Array.isArray(sources)?sources:[]).filter(source=>{try{return typeof source.url==='string'&&['http:','https:'].includes(new URL(source.url).protocol);}catch{return false;}}).slice(0,6);}
function addMessage(role,text,extra={}){history.push({...extra,role,text});history=history.slice(-40);persist();renderConversation();}
function renderConversation(){
  const root=document.getElementById('chatBody');if(!root)return;
  root.innerHTML=history.map((message,index)=>{
    if(message.role==='user')return `<div class="chat-message user">${esc(message.text)}</div>`;
    const products=(message.products||[]).map(id=>menu.find(p=>p.id===id)).filter(p=>p&&!state.soldOut.includes(p.id));
    return `<div class="chat-message bot"><div class="reply-text">${formatText(message.text)}</div>${products.length?`<div class="chat-products">${products.map(p=>`<button type="button" class="chat-product" onclick="assistantChooseProduct(${p.id})" aria-label="Chọn ${esc(p.name)}, ${money(p.price)}"><img src="${esc(p.img)}" alt=""><span><b>${esc(p.name)}</b><strong>${money(p.price)}</strong></span><em aria-hidden="true">+</em></button>`).join('')}</div>`:''}${message.validationNote?`<p class="chat-validation-note">${esc(message.validationNote)}</p>`:''}${message.plans?.length?renderMealPlans(message.plans,index):''}${message.actions?.length?`<div class="chat-actions">${message.actions.filter(id=>actions[id]).map(id=>`<button type="button" onclick="assistantAction('${id}')">${actions[id]} →</button>`).join('')}</div>`:''}${safeSources(message.sources).length?`<div class="chat-sources">${safeSources(message.sources).map((source,i)=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">[${i+1}] ${esc(source.title||new URL(source.url).hostname)} ↗</a>`).join('')}</div>`:''}${message.origin?`<span class="reply-origin">${message.origin==='ai'?'ChickyJoy AI':'Dữ liệu ChickyJoy'}</span>`:''}${message.retry?`<button class="reply-copy" type="button" onclick="retryAssistant(${index})">Thử lại câu hỏi</button>`:''}${index?`<button class="reply-copy" type="button" onclick="copyAssistantReply(${index})" aria-label="Sao chép câu trả lời">Sao chép</button>`:''}</div>`;
  }).join('');
  root.scrollTop=root.scrollHeight;
}
function setBusy(value){
  busy=value;document.getElementById('chatSend').disabled=value;document.getElementById('chatStop').hidden=!value;document.getElementById('chatRefresh').disabled=value;
  document.querySelectorAll('.chat-quick button').forEach(button=>button.disabled=value);
  document.getElementById('chatThinking')?.remove();
  if(value){const root=document.getElementById('chatBody');root.insertAdjacentHTML('beforeend','<div class="chat-message bot chat-thinking" id="chatThinking" role="status"><span class="sr-only">Trợ lý đang trả lời</span><i></i><i></i><i></i></div>');root.scrollTop=root.scrollHeight;}
}
export function toggleChat(force){
  const root=document.getElementById('chatWindow');if(!root)return;
  const open=typeof force==='boolean'?force:!root.classList.contains('open');root.classList.toggle('open',open);
  document.getElementById('chatLauncher')?.setAttribute('aria-expanded',String(open));
  if(open&&matchMedia('(max-width:600px)').matches){document.body.style.overflow='hidden';chatLockedPage=true;}
  else if(!open&&chatLockedPage){document.body.style.overflow=document.querySelector('.overlay.open')?'hidden':'';chatLockedPage=false;}
  if(open){renderConversation();document.getElementById('chatInput')?.focus({preventScroll:true});}
  else document.getElementById('chatLauncher')?.focus({preventScroll:true});
}
function localReply(prompt){
  const q=searchText(prompt),branch=getBranch();
  const fact=consultStore(prompt,{branchId:state.branch,soldOut:state.soldOut,memory:sellerMemory});
  if(fact){if(fact.sellerMemory)sellerMemory=fact.sellerMemory;return fact;}
  if(/thuong hieu|gioi thieu|ve chickyjoy|ve ga gion/.test(q))return{text:'ChickyJoy có gà giòn, burger, cơm, mì Ý, món kèm và thức uống. Bạn có thể chọn suất cá nhân hoặc so sánh combo theo số người, ngân sách. Phần Menu & thông tin có nhà hàng, giờ phục vụ, cách đặt/nhận/hủy đơn và thanh toán. Bạn muốn tìm món hay xem thông tin nhà hàng?',actions:['menu','branch']};
  if(isAdviceQuestion(prompt,lastPreferences)&&!/di ung|theo doi|tra cuu|huy don|ma don|thanh toan|chuyen khoan/.test(q)){
    const advice=adviseMenu(prompt,lastPreferences,{mode:state.mode,soldOut:state.soldOut});lastPreferences=advice.preferences||lastPreferences;return advice;
  }
  if(/theo doi|tra cuu|ma don|don hang|don cua|huy don/.test(q))return{text:(customerOrders().length?'Đơn của bạn đã lưu trên trình duyệt này có thể mở ngay bằng nút bên dưới. ':'')+'Đơn chưa vào bếp có thể hủy trong chi tiết đơn. Khi đã bắt đầu xử lý, bạn gửi yêu cầu và chờ nhà hàng phản hồi. Nếu tra cứu đơn cũ, nhập cả mã đơn và số điện thoại đã đặt.',actions:customerOrders().length?['currentOrder','history']:['history']};
  if(/voucher|uu dai|khuyen mai|ma giam|freeship|welcome10|gion20|combo30/.test(q))return{text:vouchers.map(v=>`${v.code}: ${v.desc}${v.code==='WELCOME10'?' (đơn đầu theo số điện thoại)':''}.`).join('\n')+'\nMã được kiểm tra theo giỏ hàng và thông tin đơn khi đặt.',actions:['deals','menu']};
  if(/phi giao|phi ship|^ship$|bao lau|giao hang/.test(q)&&!isAdviceQuestion(prompt,lastPreferences))return{text:`Phí giao hàng hiện là ${money(SHIPPING_FEE)}. FREESHIP áp dụng cho đơn món từ 149.000đ. ${branch.name} có thời gian dự kiến ${branch.eta}; thời gian nhận thực tế tùy địa chỉ và tình trạng xử lý đơn. Đến lấy tại quầy không tính phí giao.`,actions:['branch','menu']};
  if(/chi nhanh|cua hang|nha hang|dia chi|mo cua|dong cua|gio hoat dong/.test(q)&&!isAdviceQuestion(prompt,lastPreferences))return{text:branches.map(b=>`${b.name}\n${b.address}\nGiờ hoạt động: ${b.hours}`).join('\n\n'),actions:['branch']};
  if(/thanh toan|chuyen khoan|momo|vnpay|tien mat|quet qr/.test(q))return{text:`Bạn có thể trả tiền mặt khi nhận món hoặc chuyển khoản ${paymentConfig.bankName} đến ${paymentConfig.accountName}, tài khoản ${paymentConfig.accountNumber}. QR nhận tiền của cửa hàng là mã cố định: nhập đúng số tiền và nội dung THANHTOAN kèm mã đơn trong app ngân hàng. Sau khi chuyển, bấm báo để nhà hàng đối soát. MoMo/VNPay hiện chưa kết nối.`,actions:['menu']};
  if(/dat tiec|sinh nhat|lien hoan/.test(q))return{text:'Bạn có thể gửi yêu cầu đặt tiệc với số khách, ngày giờ, ngân sách và nhà hàng mong muốn. Nhà hàng cần xác nhận lại yêu cầu trước khi buổi tiệc được chốt.',actions:['party']};
  if(/di ung|thanh phan|an chay/.test(q))return{text:'Mô tả trên thẻ món giúp bạn xem thành phần chính. Nếu có dị ứng hoặc yêu cầu ăn uống đặc biệt, hãy hỏi trực tiếp nhà hàng qua Zalo trước khi đặt để xác nhận thành phần và cách chế biến.',actions:['menu']};
  if(/diem|thanh vien|dang nhap|tai khoan/.test(q))return{text:'Bạn có thể tạo tài khoản ở nút tài khoản trên đầu trang. Điểm thưởng được cộng khi đơn gắn với tài khoản hoàn tất; xem điểm và hồ sơ tại mục Thành viên.',actions:['menu']};
  if(/zalo|nhan vien|nguoi that|lien he|ho tro truc tiep/.test(q))return{text:`Bạn có thể chat trực tiếp với nhà hàng qua nút Zalo ngay bên dưới. Số liên hệ: ${contact.zaloPhone}. Tôi không gửi tin nhắn thay bạn.`,actions:[]};
  if(/xin chao|chao ban|hello|^hi$/.test(q))return{text:greeting,actions:['menu','deals']};
  if(isAdviceQuestion(prompt,lastPreferences)){
    const advice=adviseMenu(prompt,lastPreferences,{mode:state.mode,soldOut:state.soldOut});lastPreferences=advice.preferences||lastPreferences;return advice;
  }
  return{text:'Tôi chưa hiểu rõ ý bạn trong câu này. Bạn có thể nói thêm món hoặc thông tin đang muốn biết? Tôi đang tra cứu dữ liệu của ChickyJoy; hội thoại AI tự do chưa kết nối. Nếu cần nhân viên hỗ trợ ngay, bạn có thể dùng Zalo bên dưới.',actions:['contact'],unhandled:true};
}
export async function askAssistant(text){
 const input=document.getElementById('chatInput'),prompt=String(text??input?.value??'').trim();if(!prompt||busy)return;
 if(prompt.length>1600){toast('Câu hỏi tối đa 1.600 ký tự.','error');return;}
 const version=conversationVersion;await ready;if(busy||version!==conversationVersion)return;
 const previous=history.filter(m=>['user','assistant'].includes(m.role)).slice(-20).map(m=>({role:m.role,content:m.text.slice(0,4000)}));
 addMessage('user',prompt);input.value='';input.style.height='';setBusy(true);
 let timer;
 try{
  let result;
  if(aiAvailable){
   const requestController=new AbortController();controller=requestController;timer=setTimeout(()=>requestController.abort(),65000);
   const context=buildChatContext({...state,orders:customerOrders()},lastPreferences,lastPlans);
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt,history:previous,context}),signal:requestController.signal});
   const payload=await response.json();
   if(!response.ok){const error=Error('assistant_unavailable');error.status=response.status;error.code=payload?.error;throw error;}
   result=normalizeAiAnswer(payload,{mode:state.mode,soldOut:state.soldOut,preferences:lastPreferences});
   sellerMemory=rememberStoreFocus(prompt,result.products,sellerMemory);result.sellerMemory=sellerMemory;
   aiVerified=true;aiBlockedReason='';updateAssistantStatus();
   if(result.preferences){lastPreferences={...result.preferences,awaiting:!result.preferences.people?'people':!result.preferences.budget?'budget':null,lowestTotal:result.plans[0]?.total,suggestedIds:result.plans.flatMap(p=>p.lines.map(i=>i.id))};}
  }else result={...localReply(prompt),origin:'local'};
  if(version===conversationVersion){if(result.plans?.length)lastPlans=result.plans;addMessage('assistant',result.text,result);renderQuickPrompts(result.chips);}
 }catch(error){
  if(version===conversationVersion){
   if(['ai_quota','ai_auth','ai_model'].includes(error.code)){aiBlockedReason=error.code;aiAvailable=false;window.dispatchEvent(new CustomEvent('chickyjoy:ai-blocked',{detail:{code:error.code}}));}
   aiVerified=false;updateAssistantStatus(true);const result={...localReply(prompt),origin:'local'};
   if(result.plans?.length)lastPlans=result.plans;
   const notice=error.code==='ai_quota'?'Hội thoại AI tạm dừng vì tài khoản API của cửa hàng đã hết số dư hoặc hạn mức. Chủ cửa hàng cần kiểm tra Billing/Usage. Khi đã khắc phục, bấm làm mới kết nối hoặc thử lại. Tôi vẫn tra cứu được món, giá và địa chỉ cho bạn.':error.code==='ai_auth'?'Khóa AI của cửa hàng không còn hợp lệ. Chủ cửa hàng cần cập nhật khóa ở máy chủ, rồi làm mới kết nối. Phần tư vấn thực đơn vẫn hoạt động.':error.code==='ai_model'?'Tài khoản AI chưa truy cập được model đã cấu hình. Chủ cửa hàng cần kiểm tra model/quyền truy cập. Phần tư vấn thực đơn vẫn hoạt động.':error.status===429||error.code==='ai_provider_rate_limit'?'Dịch vụ đang giới hạn lượt hỏi. Hãy đợi một phút rồi thử lại; phần tư vấn thực đơn vẫn hoạt động.':'Kết nối AI đang gián đoạn. Bạn có thể thử lại; phần tư vấn thực đơn vẫn hoạt động.';
   addMessage('assistant',notice+'\n\n'+result.text,{...result,retry:true});renderQuickPrompts(result.chips);
  }
 }finally{clearTimeout(timer);if(version===conversationVersion){controller=null;setBusy(false);}}
}
export function stopAssistant(){
 if(!busy)return;conversationVersion++;controller?.abort();controller=null;setBusy(false);addMessage('assistant','Đã dừng câu trả lời. Bạn có thể chỉnh câu hỏi hoặc tiếp tục trò chuyện.');
}
export async function retryAssistant(index){if(busy)return;const messages=Number.isInteger(index)?history.slice(0,index):history;const message=messages.findLast(m=>m.role==='user');if(message){if(aiBlockedReason)await refreshAssistantConnection();return askAssistant(message.text);}}
function updateAssistantStatus(failed=false){
 const label=document.getElementById('assistantStatus');
 label.textContent=aiBlockedReason==='ai_quota'?'AI hết hạn mức · tra cứu quán vẫn hoạt động':aiBlockedReason==='ai_auth'?'Khóa AI cần cập nhật · tra cứu vẫn hoạt động':aiBlockedReason==='ai_model'?'AI chưa truy cập được model':failed?'AI tạm gián đoạn · tư vấn thực đơn vẫn hoạt động':aiAvailable?(aiVerified?'ChickyJoy AI · đang hoạt động':'ChickyJoy AI · sẵn sàng kết nối'):'Tư vấn ChickyJoy · hội thoại AI chưa kết nối';
 label.classList.toggle('ai-ready',aiAvailable);label.classList.toggle('ai-offline',!aiAvailable||failed);
}
export async function refreshAssistantConnection(){
 if(busy)return;window.dispatchEvent(new Event('chickyjoy:ai-reset'));
 try{const response=await fetch('/api/chat/status',{signal:AbortSignal.timeout(5000)});const status=response.ok?await response.json():null;aiAvailable=Boolean(status?.available);aiVerified=false;aiBlockedReason='';updateAssistantStatus();}
 catch{aiAvailable=false;aiVerified=false;updateAssistantStatus();}
}
export function clearAssistantChat(){
 conversationVersion++;controller?.abort();controller=null;history=[];lastPreferences={};lastPlans=[];sellerMemory={};pendingMeal=null;document.getElementById('chatInput').value='';
 renderQuickPrompts([{label:'Món nổi bật',prompt:'Món best seller của quán là gì?'},{label:'Địa chỉ quán',prompt:'Địa chỉ quán ở đâu?'},{label:'2 người · 150k',prompt:'2 người 150k không cay cả ship'},{label:'Đơn của tôi',prompt:'Mở đơn hàng của tôi'}]);
 setBusy(false);addMessage('assistant',aiAvailable?'Chào bạn! Tôi là trợ lý ChickyJoy. Bạn có thể hỏi về món ăn, đơn hàng hoặc trao đổi một chủ đề khác. Bạn đang cần gì?':greeting);document.getElementById('chatInput').focus();
}
export function assistantChooseProduct(id){toggleChat(false);window.openCustomize(id);}
export function assistantAction(id){toggleChat(false);if(id==='menu')window.scrollToSection('menuSection');else if(id==='deals')window.scrollToSection('dealsSection');else if(id==='history')window.openOrderHistory();else if(id==='currentOrder')window.openCurrentOrder();else if(id==='branch')window.openModal('branchModal');else if(id==='party')window.openPartyBooking();else if(['receiving','cancellation'].includes(id))window.openInfoPage(id);else if(id==='contact')window.openInfoPage('stores');}
export async function copyAssistantReply(index){const text=history[index]?.text;if(!text)return;try{await navigator.clipboard.writeText(text);toast('Đã sao chép câu trả lời.');}catch{toast('Bạn có thể chọn nội dung trong câu trả lời để sao chép.');}}
export function initAssistant(){
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))history=saved.filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string').slice(-40).map(m=>({...m,text:m.text.replace(/(trợ lý|nhà hàng|thương hiệu) Gà Giòn/gi,'$1 ChickyJoy')}));}catch{}
 const remembered=history.findLast(m=>m.role==='assistant'&&m.preferences);lastPreferences=remembered?.preferences||{};
 lastPlans=history.findLast(m=>m.role==='assistant'&&m.plans?.length)?.plans||[];
 sellerMemory=history.findLast(m=>m.role==='assistant'&&m.sellerMemory)?.sellerMemory||{};
 if(!history.length)history=[{role:'assistant',text:greeting}];renderConversation();
 const input=document.getElementById('chatInput');input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();askAssistant(input.value);}});
 input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(120,input.scrollHeight)+'px';});
 const updateViewport=()=>{document.getElementById('chatWindow').style.setProperty('--chat-viewport-height',`${window.visualViewport?.height||innerHeight}px`);if(chatLockedPage&&!matchMedia('(max-width:600px)').matches){document.body.style.overflow=document.querySelector('.overlay.open')?'hidden':'';chatLockedPage=false;}};window.visualViewport?.addEventListener('resize',updateViewport);updateViewport();
 ready=refreshAssistantConnection().then(()=>{if(aiAvailable&&history.length===1){history[0].text='Chào bạn! Tôi là trợ lý ChickyJoy. Tôi có thể giúp chọn món, hướng dẫn đặt hàng và giải đáp các câu hỏi khác. Bạn muốn bắt đầu từ đâu?';renderConversation();}});
}

function renderMealPlans(plans,messageIndex){
 return '<div class="chat-meal-plans">'+plans.map((plan,i)=>{const rows=(plan.lines||[]).map(line=>({p:menu.find(p=>p.id===line.id),qty:line.qty})).filter(x=>x.p);return `<article class="chat-meal-card"><span class="meal-badge">${esc(plan.badge||'Gợi ý')}</span><div class="chat-meal-title"><img src="${esc(rows[0]?.p.img||'assets/images/combo.webp')}" alt=""><b>${esc(plan.title)}</b></div><p>${esc(plan.description)}</p><div class="chat-meal-lines">${rows.map(x=>`<span>${x.qty} × ${esc(x.p.name)}</span>`).join('')}</div><div class="chat-meal-price"><strong>${money(plan.total)}</strong><small>${plan.mode==='dinein'?'Tại bàn':plan.mode==='pickup'?'Đến lấy':'Đã gồm giao hàng'}${plan.voucherCode?' · '+esc(plan.voucherCode):''}</small></div><button type="button" onclick="assistantChooseMeal(${messageIndex},${i})">Xem & chọn phương án →</button></article>`;}).join('')+'</div>';
}
function renderQuickPrompts(chips){
 if(!chips?.length)return;const root=document.querySelector('.chat-quick');
 root.innerHTML=chips.map(c=>`<button type="button" data-prompt="${esc(c.prompt)}">${esc(c.label)}</button>`).join('');
 root.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>askAssistant(b.dataset.prompt)));
}
let pendingMeal=null;
export function assistantChooseMeal(messageIndex,planIndex){
 const plan=history[messageIndex]?.plans?.[planIndex];if(!plan||!Array.isArray(plan.lines))return;
 if(plan.mode==='dinein'&&!state.table){toast('Quét mã tại bàn để xác nhận nhà hàng và số bàn trước khi chọn phương án này.','error');return;}
 const lines=plan.lines.filter(i=>Number.isInteger(i.qty)&&i.qty>0&&i.qty<=20&&menu.some(p=>p.id===i.id));
 if(lines.length!==plan.lines.length||lines.some(i=>state.soldOut.includes(i.id))){toast('Một món trong gợi ý không còn bán. Vui lòng hỏi lại để tôi tính phương án mới.','error');return;}
 pendingMeal={...plan,lines};const oldLines=state.cart.map(i=>({id:i.productId,qty:i.qty,unitPrice:i.unitPrice})),quote=quoteMeal([...oldLines,...lines],{mode:plan.mode});
 document.getElementById('assistantMealTitle').textContent=plan.title;
 document.getElementById('assistantMealBody').innerHTML=`<p class="meal-review-intro">Kiểm tra các món trước khi thêm. Hương vị combo theo món đã chọn; bạn có thể mở từng món trong thực đơn để tùy chỉnh riêng.</p><div class="meal-review-lines">${lines.map(i=>{const p=menu.find(p=>p.id===i.id);return `<div><img src="${esc(p.img)}" alt=""><span><b>${i.qty} × ${esc(p.name)}</b><small>${esc(p.desc)}</small></span><strong>${money(p.price*i.qty)}</strong></div>`;}).join('')}</div><p class="meal-review-intro">${plan.mode==='dinein'?'Phục vụ tại '+esc(state.table?.label||'bàn')+', không tính phí giao.':plan.mode==='pickup'?'Nhận tại quầy, không tính phí giao.':'Giao tận nơi theo nhà hàng đang chọn.'}${state.cart.length?' Giỏ hiện có '+state.cart.reduce((s,i)=>s+i.qty,0)+' món; các món này được giữ lại.':''}</p><div class="detail-box"><div class="detail-line"><span>Tiền món của giỏ sau khi thêm</span><b>${money(quote.subtotal)}</b></div><div class="detail-line"><span>Phí giao</span><b>${money(quote.shipping)}</b></div><div class="detail-line"><span>Mã đề xuất${quote.voucherCode?' · '+esc(quote.voucherCode):''}</span><b>−${money(quote.discount)}</b></div><div class="detail-line"><span>Tổng dự kiến</span><b>${money(quote.total)}</b></div></div>${quote.voucherCode?`<label class="history-remember"><input id="assistantUseVoucher" type="checkbox" checked><span>Áp dụng ${esc(quote.voucherCode)} cho giỏ sau khi thêm</span></label>`:''}`;
 toggleChat(false);window.openModal('assistantMealModal');
}
export function confirmAssistantMeal(){
 if(!pendingMeal)return;
 const lines=pendingMeal.lines;if(lines.some(i=>state.soldOut.includes(i.id)||!menu.some(p=>p.id===i.id))){toast('Có món vừa hết hàng. Vui lòng chọn gợi ý khác.','error');return;}
 const additions=lines.map(i=>{const p=menu.find(p=>p.id===i.id),flavor=p.cat==='combo'?(p.spicy?'Giòn cay':'Truyền thống'):'';const signature=JSON.stringify({productId:p.id,flavor,extras:[],note:''});return{lineId:uid('LINE'),signature,productId:p.id,name:p.name,cat:p.cat,img:p.img,unitPrice:p.price,qty:i.qty,flavor,extras:[],note:''};});
 if(additions.some(i=>(state.cart.find(x=>x.signature===i.signature)?.qty||0)+i.qty>20)){toast('Tối đa 20 phần cho mỗi lựa chọn. Vui lòng kiểm tra giỏ hiện tại.','error');return;}
 const useVoucher=document.getElementById('assistantUseVoucher')?.checked;
 for(const item of additions){const existing=state.cart.find(x=>x.signature===item.signature);if(existing)existing.qty+=item.qty;else state.cart.push(item);}
 const mode=pendingMeal.mode;window.setDeliveryMode(mode);
 if(useVoucher){const quote=quoteMeal(state.cart.map(i=>({id:i.productId,qty:i.qty,unitPrice:i.unitPrice})),{mode});state.voucherAuto=true;state.appliedVoucher=quote.goods?.code||null;state.shippingVoucher=quote.freight?.code||null;}
 persistCustomerState();window.updateCartBadges();pendingMeal=null;window.openCart();toast('Đã thêm các món đã xác nhận. Bạn có thể chỉnh giỏ trước khi đặt.');
}
