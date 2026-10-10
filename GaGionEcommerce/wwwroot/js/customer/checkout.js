import { createTableOrder, tableOrderAction, syncTableAvailability } from '../services/tableOrders.js';
import { state, setOrders, getOrders, getBranch, persistCustomerState, MEMBER_KEY } from '../state.js';
import { money, esc, uid, isValidVietnamPhone, formatDateTime, normalizePhone } from '../utils.js';
import { toast, closeModal, openModal, renderMemberCard } from '../components/ui.js';
import { getPricing, cartCount, renderCart } from './cart.js';
import { canAccessOrder, rememberPlacedOrder } from '../services/orderAccess.js';
import { renderOrderProgress } from './orderTracking.js';
import { createPaymentQr } from '../services/payment.js';
import { paymentMethods } from '../data/paymentMethods.js';
import { branches, menu } from '../data/catalog.js';
import { orderStatuses } from '../data/catalog.js';
import { scheduleCheckoutPromotions } from '../components/checkoutAdvisor.js';

export function captureCheckoutDraft(){
 const form=document.getElementById('checkoutForm');if(!form||!document.getElementById('cartModal')?.classList.contains('open'))return;
 const draft=state.checkoutDraft||{};
 ['Name','Phone','Address','Area','Time','Schedule','Note'].forEach(key=>{const el=document.getElementById('checkout'+key);if(el)draft[key]=el.value;});
 draft.payment=form.querySelector('[name="paymentMethod"]:checked')?.value||'COD';
 draft.terms=Boolean(document.getElementById('checkoutTerms')?.checked);state.checkoutDraft=draft;
 scheduleCheckoutPromotions();
}
export function toggleSchedule(){captureCheckoutDraft();document.getElementById('scheduleField')?.classList.toggle('hidden',document.getElementById('checkoutTime')?.value!=='schedule');}
export function setCheckoutBranch(id){captureCheckoutDraft();if(!branches.some(b=>b.id===id))return;if(state.mode==='dinein'&&id!==state.table?.branchId){toast('Bàn này thuộc nhà hàng trong mã QR.','error');return;}state.branch=id;persistCustomerState();window.dispatchEvent(new Event('gagion-branch-changed'));renderCart();}
export function renderCheckoutFields(){
 const d=state.checkoutDraft||{},member=state.member||{},dining=state.mode==='dinein';
 const field=(key,fallback='')=>esc(d[key]??fallback);
 const picked=paymentMethods.some(m=>m.id===d.payment&&m.enabled)?d.payment:'COD';
 return `<form id="checkoutForm" oninput="captureCheckoutDraft()" onchange="captureCheckoutDraft()" onsubmit="event.preventDefault();checkout()">${dining?`<div class="table-checkout-card"><b>${esc(state.table?.label||'Bàn chưa xác nhận')} · ${esc(getBranch().name)}</b><small>Món được mang đến bàn này. Không tính phí giao; bạn có thể thanh toán tại cửa hàng hoặc chuyển khoản.</small></div>`:''}<div class="checkout-mode"><button type="button" class="${state.mode==='delivery'?'active':''}" onclick="setDeliveryMode('delivery')">Giao tận nơi</button><button type="button" class="${state.mode==='pickup'?'active':''}" onclick="setDeliveryMode('pickup')">Đến lấy tại quầy</button>${state.table?`<button type="button" class="table-mode-button ${dining?'active':''}" onclick="setDeliveryMode('dinein')">Tại ${esc(state.table.label)}</button>`:''}</div><div class="form-grid">
 <label class="field full"><span>Nhà hàng nhận đơn</span><select id="checkoutBranch" ${dining?'disabled':''} onchange="setCheckoutBranch(this.value)">${branches.map(b=>`<option value="${esc(b.id)}" ${b.id===state.branch?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
 <label class="field"><span>${dining?'Tên gọi (không bắt buộc)':'Họ tên người nhận *'}</span><input id="checkoutName" autocomplete="name" maxlength="80" ${dining?'':'required'} value="${field('Name',member.name||'')}" placeholder="Họ và tên"></label>
 <label class="field"><span>${dining?'Số điện thoại (không bắt buộc)':'Số điện thoại *'}</span><input id="checkoutPhone" autocomplete="tel" maxlength="15" ${dining?'':'required'} inputmode="tel" value="${field('Phone',member.phone||'')}" placeholder="09xxxxxxxx"></label>
 <label class="field full ${state.mode!=='delivery'?'hidden':''}"><span>Địa chỉ giao hàng *</span><input id="checkoutAddress" autocomplete="street-address" maxlength="180" value="${field('Address')}" placeholder="Số nhà, đường, phường/xã" ${state.mode==='delivery'?'required':'disabled'}></label>
 <label class="field ${state.mode!=='delivery'?'hidden':''}"><span>Ghi chú địa chỉ</span><input id="checkoutArea" maxlength="100" value="${field('Area')}" placeholder="Tầng, cổng vào, mốc gần nhà..." ${state.mode!=='delivery'?'disabled':''}></label>
 <label class="field ${dining?'hidden':''}"><span>Thời gian nhận</span><select id="checkoutTime" onchange="toggleSchedule()"><option value="soon" ${d.Time!=='schedule'?'selected':''}>Sớm nhất có thể</option><option value="schedule" ${d.Time==='schedule'?'selected':''}>Hẹn giờ nhận</option></select></label>
 <label class="field full ${d.Time==='schedule'&&!dining?'':'hidden'}" id="scheduleField"><span>Ngày và giờ nhận *</span><input type="datetime-local" id="checkoutSchedule" value="${field('Schedule')}"></label>
 <div class="field full"><span>Phương thức thanh toán *</span><div class="payment-choices">${paymentMethods.map(method=>`<label class="payment-option payment-choice ${method.enabled?'':'method-unavailable'}"><input type="radio" name="paymentMethod" value="${method.id}" ${picked===method.id?'checked':''} ${method.enabled?'':'disabled'}><img src="${method.icon}" alt=""><span class="payment-copy"><b>${method.name}</b><small>${method.description}</small></span></label>`).join('')}</div></div>
 <label class="field full"><span>Ghi chú đơn hàng</span><input id="checkoutNote" maxlength="180" value="${field('Note')}" placeholder="Gọi trước khi giao..."></label></div>
 <label class="payment-option payment-terms" style="margin-top:12px"><input id="checkoutTerms" type="checkbox" ${d.terms?'checked':''} required> Tôi xác nhận thông tin nhận hàng là chính xác.</label></form>`;
}
let currentBankPaymentOrderId = null;

function renderBankPayment(order){
 currentBankPaymentOrderId=order.id;
 const memo=`THANHTOAN ${order.id}`;
 const amount=Number(order.total)||0;
 const methodLabels={BANK:'Chuyển khoản ngân hàng',MOMO:'Ví MoMo',VNPAY:'VNPay'};
 const method=methodLabels[order.payment]||'Thanh toán điện tử';
 const identity=paymentMethods.find(m=>m.id===order.payment);if(identity){document.getElementById('bankMethodIcon').src=identity.icon;document.getElementById('bankMethodBadge').textContent=identity.name;}
 const methodEl=document.getElementById('bankPaymentMethod');if(methodEl)methodEl.textContent=method;
 const title=document.getElementById('bankPaymentTitle');if(title)title.textContent=`Thanh toán qua ${method}`;
 document.getElementById('bankQrDescription').textContent=order.payment==='BANK'?'Mã nhận tiền cố định. Nhập đúng số tiền và nội dung đơn trong app ngân hàng.':'QR thông tin đơn; phương thức này chưa kết nối thanh toán.';document.getElementById('bankOriginalQrLink').hidden=order.payment!=='BANK';document.getElementById('bankPaymentReportedNote').hidden=!order.paymentConfirmed&&!order.paymentReported;document.getElementById('bankReportPaymentButton').disabled=Boolean(order.paymentConfirmed||order.paymentReported||order.payment!=='BANK');
 const qr=document.getElementById('bankQrImage');const fallback=document.getElementById('bankQrFallback');if(fallback)fallback.hidden=true;
 try{const details=createPaymentQr(order);if(qr){qr.hidden=false;qr.alt=`Mã QR đơn ${order.id}, ${money(amount)}`;qr.src=details.src;}
 document.getElementById('bankBeneficiary').textContent=details.accountName||'CHICKYJOY';
 document.getElementById('bankAccountDetails').innerHTML=details.accountNumber?`<div class="bank-info-row"><span>Ngân hàng</span><b>${esc(details.bankName)}</b></div><div class="bank-info-row"><span>Số tài khoản</span><b>${esc(details.accountNumber)}</b></div>`:'';
 }catch{if(qr)qr.hidden=true;if(fallback)fallback.hidden=false;}
 const code=document.getElementById('bankOrderCode');if(code)code.textContent=order.id;
 const total=document.getElementById('bankOrderAmount');if(total)total.textContent=money(order.total);
 const note=document.getElementById('bankTransferMemo');if(note)note.textContent=memo;
}

export async function copyBankTransferMemo(){
 const memo=document.getElementById('bankTransferMemo')?.textContent||'';
 if(!memo)return;
 try{
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(memo);}
  else{const field=document.createElement('textarea');field.value=memo;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Clipboard is not available');}
  toast('Đã sao chép nội dung thanh toán.','success');
 }catch{toast(`Nội dung chuyển khoản: ${memo}`,'error');}
}

export async function confirmPaymentQr(){
 const id=currentBankPaymentOrderId;
 if(!id){toast('Không tìm thấy đơn cần xác nhận.','error');return;}
 const orders=structuredClone(getOrders());const order=orders.find(item=>item.id===id);
 if(!canAccessOrder(order)){toast('Không tìm thấy đơn hàng của bạn.','error');return;}
 if(order.paymentVerified){toast('Nhà hàng đã xác nhận nhận tiền.','success');closeModal('bankPaymentModal');renderOrderProgress(order.id);return;}
 if(order.paymentConfirmed||order.paymentReported){toast('Bạn đã báo chuyển tiền; vui lòng chờ đối soát.');renderOrderProgress(id);return;}
 if(order.status==='cancelled'||order.status==='done'){toast('Đơn đã hủy, không thể thanh toán.','error');return;}
 if(order.serverManaged){try{await tableOrderAction(order,'payment_report');closeModal('bankPaymentModal');renderOrderProgress(order.id);toast('Đã báo chuyển tiền. Chờ nhà hàng kiểm tra.','success');}catch(e){toast(e.message,'error');}return;}
 order.paymentStatus='Đã báo thanh toán — chờ nhà hàng kiểm tra';
 order.paymentReported=true;order.paymentConfirmed=true;
 order.paymentReportedAt=new Date().toISOString();order.paymentConfirmedAt=order.paymentReportedAt;
 if(!setOrders(orders)){toast('Không lưu được thông báo. Vui lòng thử lại.','error');return;}
 closeModal('bankPaymentModal');
 renderOrderProgress(order.id);
 window.dispatchEvent(new Event('gagion-admin-refresh'));
 toast('Đã báo chuyển tiền. Nhà hàng cần kiểm tra trước khi xác nhận.','success');
}

let checkoutBusy=false;
export async function checkout(){
 if(checkoutBusy)return;
 if(state.tableLoading||state.tableInvalid){toast('Chưa xác nhận được bàn. Quét lại mã hoặc hỏi nhân viên.','error');return;}
 if(!state.cart.length){toast('Giỏ hàng đang trống.','error');return;}
 const form=document.getElementById('checkoutForm');if(!form){toast('Mở lại giỏ để kiểm tra thông tin.','error');return;}
 captureCheckoutDraft();const dining=state.mode==='dinein';
 const value=id=>(document.getElementById(id)?.value||'').trim();
 const name=value('checkoutName'),phone=value('checkoutPhone'),address=value('checkoutAddress'),area=value('checkoutArea'),note=value('checkoutNote');
 const payment=form.querySelector('[name="paymentMethod"]:checked')?.value||'COD',terms=document.getElementById('checkoutTerms').checked;
 if((!dining||name)&&name.length<2){toast('Vui lòng nhập họ tên hợp lệ.','error');document.getElementById('checkoutName').focus();return;}
 if((!dining||phone)&&!isValidVietnamPhone(phone)){toast('Số điện thoại chưa đúng định dạng Việt Nam.','error');document.getElementById('checkoutPhone').focus();return;}
 if(state.mode==='delivery'&&address.length<5){toast('Vui lòng nhập địa chỉ giao hàng cụ thể.','error');document.getElementById('checkoutAddress').focus();return;}
 if(!terms){toast('Vui lòng xác nhận thông tin nhận hàng.','error');return;}
 if(dining&&(!state.table||state.branch!==state.table.branchId)){toast('Bàn và nhà hàng chưa khớp. Quét lại mã tại bàn.','error');return;}
 if(state.cart.some(i=>state.soldOut.includes(i.productId)||!menu.some(p=>p.id===i.productId))){toast('Có món đã hết hàng hoặc ngừng bán. Xóa món đó khỏi giỏ.','error');return;}
 const time=dining?'soon':value('checkoutTime'),scheduledAt=dining?'':value('checkoutSchedule');
 if(time==='schedule'){const dt=new Date(scheduledAt),mins=dt.getHours()*60+dt.getMinutes();const [start,end]=getBranch().hours.split('–').map(t=>{const[h,m]=t.split(':').map(Number);return h*60+m;});if(!scheduledAt||!Number.isFinite(dt.getTime())||dt.getTime()<Date.now()+30*60*1000||mins<start||mins>end-30){toast('Chọn giờ nhận sau ít nhất 30 phút, trong giờ mở cửa và trước giờ đóng cửa 30 phút.','error');return;}}
 if(!paymentMethods.some(m=>m.id===payment&&m.enabled)){toast('Phương thức thanh toán không hợp lệ.','error');return;}
 const pricing=getPricing();if(pricing.subtotal<=0){toast('Tổng tiền không hợp lệ.','error');return;}
 const orderedCount=cartCount(),button=document.querySelector('#cartFooter .primary-btn');checkoutBusy=true;if(button){button.disabled=true;button.textContent='Đang gửi đơn…';}
 try{
  let order;
  if(dining){order=await createTableOrder({branchId:state.branch,tableId:state.table.id,items:state.cart.map(i=>({productId:i.productId,qty:i.qty,flavor:i.flavor,extraIds:(i.extras||[]).map(e=>e.id),note:i.note||''})),name,phone:normalizePhone(phone),note,payment,autoVoucher:state.voucherAuto,goodsVoucher:state.appliedVoucher,firstOrderCandidate:isValidVietnamPhone(phone)&&!getOrders().some(o=>o.status!=='cancelled'&&normalizePhone(o.customer?.phone)===normalizePhone(phone)),expectedTotal:pricing.final});}
  else{
   const createdAt=new Date().toISOString();order={id:uid('CJ'),createdAt,dateKey:new Date().toLocaleDateString('en-CA'),memberPhone:state.member?.phone||'',memberEmail:state.member?.email||'',memberId:state.member?.id||'',pointsAwarded:false,customer:{name,phone:normalizePhone(phone),address:state.mode==='delivery'?address:'Nhận tại cửa hàng',area:state.mode==='delivery'?area:'',note},mode:state.mode,branch:getBranch(),payment,paymentStatus:payment==='COD'?'Thanh toán khi nhận hàng':'Chờ thanh toán',items:state.cart.map(x=>({...x,extras:(x.extras||[]).map(e=>({...e}))})),subtotal:pricing.subtotal,goodsDiscount:pricing.goodsDiscount,shippingDiscount:pricing.shippingDiscount,discount:pricing.discount,shipping:pricing.ship,total:pricing.final,voucher:pricing.voucherCodes.join(' + ')||null,voucherCodes:pricing.voucherCodes,status:'new',timeline:[{status:'new',at:createdAt}],scheduled:time,scheduledAt:time==='schedule'?new Date(scheduledAt).toISOString():null};
   if(!setOrders([order,...getOrders()]))throw Error('Không lưu được đơn. Kiểm tra dung lượng trình duyệt rồi thử lại.');rememberPlacedOrder(order);
  }
  state.currentOrderId=order.id;state.cart=[];state.appliedVoucher=null;state.shippingVoucher=null;state.voucherAuto=true;state.checkoutDraft={};persistCustomerState();updateAfterCheckout();closeModal('cartModal');
  if(payment!=='COD'){renderBankPayment(order);openModal('bankPaymentModal');toast('Đã tạo đơn. Quét QR hoặc theo dõi để thanh toán sau.','success');}
  else{document.getElementById('successOrderCode').textContent=order.id;document.getElementById('successSummary').textContent=`${orderedCount} món · ${money(order.total)} · ${dining?'Phục vụ tại '+order.table.label:order.mode==='delivery'?'Giao tận nơi':'Đến lấy tại quầy'}`;renderTracker(order);openModal('successModal');toast(dining?'Đã gửi đơn đến nhà hàng.':'Đặt hàng thành công.','success');}
  window.dispatchEvent(new Event('gagion-admin-refresh'));
 }catch(e){if(e.code==='item_sold_out')await syncTableAvailability().catch(()=>{});if(e.code==='price_changed'){state.checkoutDraft.welcomeEligible=e.detail?.welcomeEligible;renderCart();}toast(e.message||'Chưa gửi được đơn. Giữ giỏ và thử lại.','error');}
 finally{checkoutBusy=false;if(state.cart.length)renderCart();}
}
function updateAfterCheckout(){window.updateCartBadges?.();}

export function renderTracker(order){
 const current=order?.status||'new';const currentIndex=orderStatuses.findIndex(x=>x.id===current);const tracker=document.getElementById('successTracker');if(!tracker)return;
 const steps=[['new','✓','Đã nhận'],['cooking','♨','Chuẩn bị'],[order?.mode!=='delivery'?'ready':'shipping',order?.mode!=='delivery'?'⌂':'➜',order?.mode!=='delivery'?'Sẵn sàng':'Đang giao'],['done','★','Hoàn tất']];
 tracker.innerHTML=steps.map(([id,icon,label])=>{const idx=orderStatuses.findIndex(s=>s.id===id);const active=id===current||order?.timeline?.some(t=>t.status===id)||(current==='done');return `<div class="tracker-step ${active?'active':''}"><span>${icon}</span>${label}</div>`;}).join('');
}
export { openOrderHistory, searchOrderHistory, renderHistory, renderOrderProgress } from './orderTracking.js';
export function reopenPaymentQr(id){
 const order=getOrders().find(o=>o.id===id);
 if(!canAccessOrder(order)||['done','cancelled'].includes(order.status)||order.payment==='COD'){toast('Đơn không còn yêu cầu thanh toán QR.','error');return;}
 if(order.paymentVerified){toast('Nhà hàng đã xác nhận nhận tiền.');renderOrderProgress(order.id);return;}
 renderBankPayment(order);openModal('bankPaymentModal');
}
export function openMember(){if(!state.member){closeModal('authModal');window.openAuth();return;}renderMemberProfile();const m=state.member||{};document.getElementById('memberName').value=m.name||'';document.getElementById('memberPhone').value=m.phone||'';document.getElementById('memberEmail').value=m.email||'';openModal('memberModal');}
export function renderMemberProfile(){const root=document.getElementById('memberProfile');const m=state.member;if(!root)return;root.innerHTML=m?`<b>${esc(m.name)}</b><p>${esc(m.phone)}${m.email?' · '+esc(m.email):''}</p><p>Điểm thưởng: <span class="member-points">${Number(m.points||0).toLocaleString('vi-VN')} điểm</span></p>`:'<b>Chào mừng bạn đến với ChickyJoy Rewards</b><p>Tham gia thành viên để theo dõi điểm thưởng và ưu đãi của bạn.</p>';}
export function saveMember(){
 const name=document.getElementById('memberName').value.trim();
 const phone=document.getElementById('memberPhone').value.trim();
 const email=(document.getElementById('memberEmail').value||'').trim().toLowerCase();
 if(email&&!/^\S+@\S+\.\S+$/.test(email)){toast('Email chưa hợp lệ.','error');return;}
 if(name.length<2){toast('Họ tên cần có ít nhất 2 ký tự.','error');return;}
 if(!isValidVietnamPhone(phone)){toast('Số điện thoại chưa đúng định dạng.','error');return;}
 let memberEmail=email;
 try{
  const session=JSON.parse(localStorage.getItem('gagion_session_v1')||'null');
  const users=JSON.parse(localStorage.getItem('gagion_accounts_v1')||'[]');
  if(session?.email&&Array.isArray(users)){
   const account=users.find(user=>user.email===session.email);
   if(account){
    const nextEmail=email||account.email;
    if(users.some(user=>user!==account&&user.email===nextEmail)){toast('Email này đã được sử dụng bởi tài khoản khác.','error');return;}
    if(nextEmail!==account.email&&typeof account.passwordHash==='string'){toast('Vui lòng đăng xuất và đăng nhập lại trước khi đổi email.','error');return;}
    account.name=name;account.phone=phone;account.email=nextEmail;account.points=Number(state.member?.points)||Number(account.points)||0;
    localStorage.setItem('gagion_accounts_v1',JSON.stringify(users));
    localStorage.setItem('gagion_session_v1',JSON.stringify({email:nextEmail}));
    memberEmail=nextEmail;
   }
  }
 }catch{}
 state.member={id:state.member?.id,name,phone,email:memberEmail,points:Number(state.member?.points)||0,createdAt:state.member?.createdAt||new Date().toISOString()};
 persistCustomerState();renderMemberCard();renderMemberProfile();
 window.dispatchEvent(new Event('gagion-auth-account-updated'));
 toast('Thông tin thành viên đã được cập nhật.','success');
}


export function deferOrderPayment(){if(currentBankPaymentOrderId)renderOrderProgress(currentBankPaymentOrderId);else closeModal('bankPaymentModal');}
