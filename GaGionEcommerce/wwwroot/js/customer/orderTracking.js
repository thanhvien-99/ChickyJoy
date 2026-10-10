import { tableOrderAction } from '../services/tableOrders.js';
import { state, getOrders, setOrders, persistCustomerState } from '../state.js';
import { orderStatuses, menu, productAddons } from '../data/catalog.js';
import { contact } from '../data/siteConfig.js';
import { canAccessOrder, customerOrders, legacyGuestOrders, rememberPlacedOrder, forgetDeviceOrders, RECEIPTS_KEY } from '../services/orderAccess.js';
import { money, esc, formatDateTime, normalizePhone, uid } from '../utils.js';
import { openModal, closeModal, toast } from '../components/ui.js';
import { reopenPaymentQr } from './checkout.js';
import { openCart, updateCartBadges } from './cart.js';

const label=status=>({cancel_requested:'Đã gửi yêu cầu hủy',cancel_rejected:'Nhà hàng chưa chấp thuận hủy'}[status]||orderStatuses.find(s=>s.id===status)?.label||status);
const reported=o=>Boolean(o.paymentReported||o.paymentConfirmed);
const active=o=>!['done','cancelled'].includes(o.status);
let cancellationId=null,directCancellation=false;
function authorized(id){const o=getOrders().find(o=>o.id===id);if(!canAccessOrder(o)){toast('Mở đơn của bạn hoặc tra cứu bằng mã đơn và số điện thoại.','error');return null;}return o;}
function historyCard(o){return `<article class="history-item"><div class="history-item-top"><div><h4>${esc(o.id)}</h4><p>${formatDateTime(o.createdAt)} · ${esc(o.branch?.name||'ChickyJoy')}</p><p>${(o.items||[]).reduce((s,i)=>s+i.qty,0)} món · ${money(o.total)}</p><p>${esc(o.paymentStatus||'Chờ xử lý')}${o.cancellation?.status==='pending'?' · Đang chờ phản hồi yêu cầu hủy':''}</p></div><span class="status-badge status-${esc(o.status)}">${esc(label(o.status))}</span></div><div class="history-item-actions"><button class="primary-btn small" onclick="renderOrderProgress('${esc(o.id)}')">Mở đơn & theo dõi →</button>${active(o)&&o.cancellation?.status!=='pending'?`<button class="order-cancel-link" onclick="startOrderCancellation('${esc(o.id)}')">${o.status==='new'?'Hủy đơn':'Yêu cầu hủy'}</button>`:''}</div></article>`;}
export function openOrderHistory(){document.getElementById('historyPhone').value='';document.getElementById('historyCode').value='';renderHistory();openModal('historyModal');}
export function searchOrderHistory(){renderHistory(true);}
export function renderHistory(search=false){
 const root=document.getElementById('historyResults');if(!root)return;
 const phone=(document.getElementById('historyPhone')?.value||'').trim(),code=(document.getElementById('historyCode')?.value||'').trim().toUpperCase();
 if(phone||code){
  if(!phone||!code){root.innerHTML='<div class="empty-state"><b>Cần cả mã đơn và số điện thoại</b>Đơn đã lưu ở trình duyệt này có thể mở trực tiếp khi để trống ô tra cứu.</div>';return;}
  const order=getOrders().find(o=>o.id.toUpperCase()===code&&normalizePhone(o.customer?.phone)===normalizePhone(phone));
  if(!order){root.innerHTML='<div class="empty-state"><b>Không tìm thấy đơn khớp thông tin</b>Kiểm tra mã đơn và số điện thoại đã đặt. Đơn ở trình duyệt/địa chỉ website khác chưa đồng bộ sang đây.</div>';return;}
  if(order.serverManaged&&!canAccessOrder(order)){root.innerHTML='<div class="empty-state">Đơn tại bàn cần biên nhận trên thiết bị đã đặt. Liên hệ nhà hàng với mã đơn nếu bạn đổi máy.</div>';return;}
  if(search||!canAccessOrder(order))rememberPlacedOrder(order,{persist:Boolean(document.getElementById('rememberOrderLookup')?.checked),lookup:true});
  root.innerHTML=historyCard(order);return;
 }
 const rows=customerOrders(),legacy=legacyGuestOrders();
 root.innerHTML=(rows.length?'<p class="history-section-caption">Đơn của bạn · mở trực tiếp, không cần nhập lại</p>'+rows.slice(0,50).map(historyCard).join(''):'<div class="empty-state"><b>Chưa có đơn đã lưu để mở nhanh</b>Sau khi đặt, đơn xuất hiện tại đây. Bạn cũng có thể tra cứu đơn cũ bằng mã và số điện thoại.</div>')+
 (legacy.length?`<div class="legacy-orders"><h3>Đơn khách từ phiên bản trước trên trình duyệt này</h3><p>Chọn mã rồi nhập số điện thoại đã đặt để mở chi tiết.</p>${legacy.map(o=>`<button onclick="prepareOrderLookup('${esc(o.id)}')"><span><b>${esc(o.id)}</b><small>${formatDateTime(o.createdAt)} · ${esc(label(o.status))}</small></span><span>Xác minh & mở →</span></button>`).join('')}</div>`:'');
}
export function prepareOrderLookup(id){openOrderHistory();document.getElementById('historyCode').value=id;document.getElementById('historyPhone').focus();}
export function openCurrentOrder(){const id=state.currentOrderId||customerOrders()[0]?.id;if(id)renderOrderProgress(id);else openOrderHistory();}
export async function copyOrderCode(id){try{await navigator.clipboard.writeText(id);toast('Đã sao chép mã đơn.');}catch{toast('Mã đơn: '+id);}}
export function renderActiveOrders(){
 const root=document.getElementById('activeOrderBanner');if(!root)return;
 const rows=customerOrders().filter(active),o=rows[0];root.hidden=!o;
 const badge=document.getElementById('headerOrderCount');if(badge){badge.hidden=!rows.length;badge.textContent=rows.length;}
 if(!o){root.innerHTML='';return;}
 root.innerHTML=`<div class="active-order-copy"><span class="active-order-dot"></span><div><b>Đơn ${esc(o.id)} · ${esc(label(o.status))}</b><small>${o.cancellation?.status==='pending'?'Đã gửi yêu cầu hủy — chờ nhà hàng phản hồi':o.mode==='dinein'?'Phục vụ tại '+esc(o.table?.label||'bàn'):o.mode==='pickup'?'Nhận tại '+esc(o.branch?.name||'nhà hàng'):'Giao tận nơi'} · ${money(o.total)}</small></div></div><button class="primary-btn small" onclick="renderOrderProgress('${esc(o.id)}')">Theo dõi đơn →</button>${rows.length>1?`<button class="outline-btn small" onclick="openOrderHistory()">Xem ${rows.length} đơn</button>`:''}`;
}
export function renderOrderProgress(id){
 const o=authorized(id);if(!o)return;state.currentOrderId=id;
 const statuses=orderStatuses.filter(s=>s.id!=='cancelled'&&(o.mode!=='delivery'?s.id!=='shipping':s.id!=='ready'));
 const c=o.cancellation;
 const cancellation=c?.status==='pending'?`<div class="order-notice pending"><b>Đã gửi yêu cầu hủy</b><p>Lý do: ${esc(c.reason)}. Nhà hàng cần phản hồi; đơn chưa được hủy.</p></div>`:c?.status==='rejected'?'<div class="order-notice"><b>Nhà hàng chưa chấp thuận yêu cầu hủy</b><p>Đơn vẫn tiếp tục xử lý. Liên hệ Zalo để trao đổi thêm.</p></div>':'';
 const ended=o.status==='cancelled'?'Đơn hàng đã hủy.':o.status==='done'?'Đơn hàng đã hoàn tất.':'Trạng thái cập nhật khi nhà hàng xử lý; chưa có xác nhận thì đơn vẫn ở trạng thái hiện tại.';
 const pay=o.paymentVerified?'Nhà hàng đã xác nhận nhận tiền':reported(o)?'Bạn đã báo chuyển tiền — chờ nhà hàng đối soát':o.payment==='COD'?'Thanh toán khi nhận món':'Chưa báo thanh toán';
 document.getElementById('detailTitle').textContent='Theo dõi đơn '+o.id;
 document.getElementById('orderDetailBody').innerHTML=`<div class="order-detail-heading"><div><span class="eyebrow dark-eyebrow">ĐƠN HÀNG CỦA BẠN</span><h3>${esc(o.id)}</h3><p>Đặt lúc ${formatDateTime(o.createdAt)}</p></div><span class="status-badge status-${esc(o.status)}">${esc(label(o.status))}</span></div>
 ${cancellation}${o.refundStatus?`<div class="order-notice"><b>Kiểm tra khoản đã chuyển</b><p>Nhà hàng cần đối soát khoản thanh toán và xử lý hoàn tiền nếu đã nhận. Việc hủy đơn không tự hoàn tiền.</p></div>`:''}
 <div class="order-tracker">${statuses.map(s=>`<div class="tracker-step ${o.status!=='cancelled'&&(o.timeline?.some(t=>t.status===s.id)||o.status===s.id||o.status==='done')?'active':''}"><span>${({new:'✓',cooking:'♨',shipping:'➜',ready:'⌂',done:'★'})[s.id]}</span>${esc(s.label)}</div>`).join('')}</div><p class="order-progress-note">${ended}</p>
 <div class="customer-order-actions">${active(o)&&o.payment!=='COD'&&!o.paymentVerified?`<button class="primary-btn" onclick="reopenPaymentQr('${esc(o.id)}')">${reported(o)?'Xem thông tin thanh toán':'Mở QR thanh toán'}</button>`:''}${active(o)&&c?.status!=='pending'?`<button class="outline-btn order-cancel-link" onclick="startOrderCancellation('${esc(o.id)}')">${o.status==='new'?'Hủy đơn hàng':'Gửi yêu cầu hủy'}</button>`:''}<a class="outline-btn" href="${contact.zaloUrl}" target="_blank" rel="noopener noreferrer">Hỗ trợ Zalo ↗</a><button class="outline-btn" onclick="copyOrderCode('${esc(o.id)}')">Sao chép mã đơn</button>${!active(o)?`<button class="primary-btn" onclick="reorderOrder('${esc(o.id)}')">Đặt lại các món</button>`:''}</div>
 <div class="detail-grid"><div class="detail-box"><h3>Nhận món & liên hệ</h3><p><b>${esc(o.customer?.name||'')}</b> · ${esc(o.customer?.phone||'')}</p><p>${esc(o.customer?.address||'')}</p>${o.customer?.area?`<p>${esc(o.customer.area)}</p>`:''}<p><b>${esc(o.branch?.name||'')}</b><br>${esc(o.branch?.address||'')}</p>${o.scheduledAt?`<p>Hẹn nhận: ${formatDateTime(o.scheduledAt)}</p>`:''}${o.customer?.note?`<p>Ghi chú: ${esc(o.customer.note)}</p>`:''}</div><div class="detail-box"><h3>Thanh toán</h3><p>${esc(({BANK:'Chuyển khoản Techcombank',COD:'Tiền mặt',MOMO:'MoMo — chưa tích hợp',VNPAY:'VNPay — chưa tích hợp'})[o.payment]||o.payment)}</p><p><b>${pay}</b></p>${o.paymentVerifiedAt?`<p>Đối soát lúc ${formatDateTime(o.paymentVerifiedAt)}</p>`:''}<div class="detail-line"><span>Tiền món</span><b>${money(o.subtotal)}</b></div><div class="detail-line"><span>Giảm giá${o.voucher?' · '+esc(o.voucher):''}</span><b>−${money(o.discount)}</b></div><div class="detail-line"><span>Phí giao</span><b>${money(o.shipping)}</b></div><div class="detail-line"><span>Tổng tiền</span><b>${money(o.total)}</b></div></div></div>
 <div class="detail-box track-items-box"><h3>Món đã đặt</h3>${(o.items||[]).map(i=>`<div class="detail-line"><span>${i.qty} × ${esc(i.name)}<small class="muted track-item-detail">${esc([i.flavor,...(i.extras||[]).map(e=>e.name),i.note?'Ghi chú: '+i.note:''].filter(Boolean).join(' · '))}</small></span><b>${money(i.unitPrice*i.qty)}</b></div>`).join('')}</div>
 <div class="detail-box order-event-history"><h3>Lịch sử xử lý</h3>${(o.timeline||[]).map(t=>`<div class="detail-line"><span>${esc(label(t.status))}${t.actor==='customer'?' · Khách hàng':''}</span><small>${formatDateTime(t.at)}</small></div>`).join('')}</div><button class="outline-btn full" onclick="openOrderHistory()">← Tất cả đơn của bạn</button>`;
 openModal('orderDetailModal');
}
export function startOrderCancellation(id){
 const o=authorized(id);if(!o)return;
 if(!active(o)){toast('Đơn đã kết thúc, không thể hủy.','error');return;}
 if(o.cancellation?.status==='pending'){toast('Yêu cầu hủy đang chờ nhà hàng phản hồi.');return;}
 cancellationId=id;directCancellation=o.status==='new';
 document.getElementById('cancelOrderTitle').textContent=directCancellation?'Xác nhận hủy đơn':'Gửi yêu cầu hủy đơn';
 document.getElementById('cancelOrderDescription').textContent=directCancellation?'Đơn chưa vào bếp. Xác nhận bên dưới sẽ hủy đơn '+id+'.':'Nhà hàng đã bắt đầu xử lý đơn '+id+'. Bạn có thể gửi yêu cầu; đơn chỉ hủy sau khi được chấp thuận.';
 document.getElementById('cancelOrderNote').value='';document.querySelector('input[name="cancelReason"]').checked=true;
 document.getElementById('cancelOrderSubmit').textContent=directCancellation?'Xác nhận hủy đơn':'Gửi yêu cầu cho nhà hàng';
 document.getElementById('cancelOrderRefund').hidden=!reported(o)&&!o.paymentVerified;
 openModal('cancelOrderModal');
}
export async function submitOrderCancellation(){
 const o=authorized(cancellationId);if(!o)return;
 if(!active(o)||o.cancellation?.status==='pending'){toast('Trạng thái đơn đã thay đổi.');renderOrderProgress(o.id);return;}
 if((o.status==='new')!==directCancellation){startOrderCancellation(o.id);toast('Nhà hàng vừa bắt đầu xử lý. Vui lòng xem lại hình thức yêu cầu hủy.');return;}
 const reason=document.querySelector('[name="cancelReason"]:checked')?.value||'Thay đổi nhu cầu',note=document.getElementById('cancelOrderNote').value.trim();
 if(o.serverManaged){try{const result=await tableOrderAction(o,'cancel',{reason:reason+(note?' — '+note:'')});renderOrderProgress(result.id);toast(result.status==='cancelled'?'Đơn đã hủy.':'Đã gửi yêu cầu hủy; chờ nhà hàng phản hồi.');}catch(e){renderOrderProgress(o.id);toast(e.message,'error');}return;}
 const at=new Date().toISOString(),next=structuredClone(getOrders()),order=next.find(x=>x.id===o.id);
 order.cancellation={status:directCancellation?'accepted':'pending',reason:reason+(note?' — '+note:''),requestedAt:at,...(directCancellation?{resolvedAt:at,resolvedBy:'customer'}:{})};
 if(directCancellation){order.status='cancelled';if(reported(order)||order.paymentVerified)order.refundStatus='review';}
 order.timeline=[...(order.timeline||[]),{status:directCancellation?'cancelled':'cancel_requested',at,actor:'customer'}];
 if(!setOrders(next)){toast('Không lưu được yêu cầu. Đơn vẫn giữ trạng thái trước đó.','error');return;}
 renderOrderProgress(order.id);toast(directCancellation?'Đơn đã hủy.':'Đã gửi yêu cầu hủy; chờ nhà hàng phản hồi.');
}
export function reorderOrder(id){
 const o=authorized(id);if(!o)return;
 const additions=[];let skipped=0;
 for(const old of o.items||[]){const p=menu.find(p=>p.id===old.productId);if(!p||state.soldOut.includes(p.id)){skipped++;continue;}
 const extras=(old.extras||[]).map(e=>productAddons(p.cat).find(a=>a.id===e.id)).filter(Boolean).map(e=>({...e}));
 const qty=Math.min(20,Math.max(1,Number(old.qty)||1)),flavor=old.flavor||'',note=old.note||'',signature=JSON.stringify({productId:p.id,flavor,extras:extras.map(e=>e.id).sort(),note});
 additions.push({lineId:uid('LINE'),signature,productId:p.id,name:p.name,cat:p.cat,img:p.img,unitPrice:p.price+extras.reduce((s,e)=>s+e.price,0),qty,flavor,extras,note});}
 if(!additions.length){toast('Các món cũ hiện không có sẵn. Vui lòng chọn trong thực đơn.','error');return;}
 for(const item of additions){const existing=state.cart.find(i=>i.signature===item.signature);if(existing)existing.qty=Math.min(20,existing.qty+item.qty);else state.cart.push(item);}
 state.appliedVoucher=null;state.shippingVoucher=null;state.voucherAuto=true;persistCustomerState();updateCartBadges();openCart();toast('Đã thêm món với giá hiện tại. Kiểm tra giỏ trước khi đặt'+(skipped?' · bỏ qua món hết hàng.':'.'));
}
export function clearDeviceOrderShortcuts(){document.getElementById('historyPhone').value='';document.getElementById('historyCode').value='';forgetDeviceOrders();renderHistory();toast('Đã bỏ lối mở nhanh trên trình duyệt này. Đơn hàng vẫn được giữ.');}
export function initOrderTracking(){
 renderActiveOrders();for(const name of ['gagion-orders-changed','gagion-customer-orders-changed','gagion-auth-account-updated'])window.addEventListener(name,()=>{renderActiveOrders();if(document.getElementById('historyModal')?.classList.contains('open'))renderHistory();});
 window.addEventListener('storage',e=>{if(e.key===RECEIPTS_KEY||e.key==='gagion_orders_v3')renderActiveOrders();});
}
