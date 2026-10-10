import { menu, vouchers, addonCatalog, sauces, productAddons } from '../data/catalog.js';
import { state, getBranch, persistCustomerState } from '../state.js';
import { money, esc, uid, normalizePhone, isValidVietnamPhone } from '../utils.js';
import { quotePromotions, voucherEligibility } from '../services/promotions.js';
import { toast, openModal, closeModal } from '../components/ui.js';
import { applyCatalogFilters } from './catalog.js';
import { renderCheckoutFields, captureCheckoutDraft } from './checkout.js';
import { renderCheckoutAdvisor } from '../components/checkoutAdvisor.js';

export function cartCount(){return state.cart.reduce((sum,item)=>sum+item.qty,0);}
export function cartSubtotal(){return state.cart.reduce((sum,item)=>sum+item.unitPrice*item.qty,0);}
export function hasCombo(){return state.cart.some(item=>menu.find(p=>p.id===item.productId)?.cat==='combo');}
export function validateVoucher(code){
 const voucher=vouchers.find(v=>v.code===String(code||'').trim().toUpperCase());if(!voucher)return{ok:false,msg:'Mã voucher không tồn tại.'};
 const check=voucherEligibility(voucher,state.cart,promotionOptions());if(!check.ok)return{ok:false,msg:check.reason};
 return{ok:true,voucher};
}
export function promotionOptions(){const phone=state.checkoutDraft?.Phone||state.member?.phone||'';return{mode:state.mode,firstOrder:isValidVietnamPhone(phone)&&!state.orders.some(o=>o.status!=='cancelled'&&normalizePhone(o.customer?.phone)===normalizePhone(phone))&&state.checkoutDraft?.welcomeEligible!==false,auto:state.voucherAuto,goodsCode:state.appliedVoucher,shippingCode:state.shippingVoucher,soldOut:state.soldOut};}
export function getPricing(){
 return quotePromotions(state.cart,promotionOptions());
}
export function formatLineDetails(item){const parts=[];if(item.flavor)parts.push(item.flavor);if(item.extras?.length)parts.push(...item.extras.map(x=>x.name));if(item.note)parts.push('Ghi chú: '+item.note);return parts.join(' • ')||'Không tùy biến';}
export function updateCartBadges(){const count=cartCount(),total=getPricing().final;document.getElementById('headerCartCount').textContent=count;document.getElementById('mobileCartCount').textContent=count;document.getElementById('mobileCartTotal').textContent=money(total);const mobile=document.querySelector('.mobile-cart-bar');if(mobile&&window.matchMedia){mobile.style.display=window.matchMedia('(max-width: 600px)').matches&&count?'block':'none';}}
export function openCustomize(productId){
 const product=menu.find(p=>p.id===Number(productId));if(!product)return;
 if(state.soldOut.includes(product.id)){toast('Món này hiện tạm hết hàng.','error');return;}
 state.currentItem=product;state.customQty=1;
 state.customEditLineId=null;state.returnToCheckout=false;state.autoVoucherAfterCustomize=false;
 document.getElementById('customTitle').textContent='Tùy biến món';document.getElementById('customName').textContent=product.name;document.getElementById('customDesc').textContent=product.desc;document.getElementById('customImg').src=product.img;document.getElementById('customImg').alt=product.name;document.getElementById('customBasePrice').textContent=money(product.price);document.getElementById('customNote').value='';
 const flavorGroup=document.getElementById('flavorGroup');flavorGroup.classList.toggle('hidden',product.cat!=='combo');
 document.querySelectorAll('input[name="flavor"]').forEach(r=>{r.checked=r.value==='Truyền thống';r.closest('label')?.classList.toggle('active',r.checked);});
 document.getElementById('customQty').textContent='1';
 const addons=addonCatalog[product.cat]||[];const addonList=document.getElementById('addonList');
 if(!addons.length){addonList.innerHTML='<div class="muted" style="font-size:10px;padding:8px 0">Món này không có tùy chọn thêm.</div>';}
 else addonList.innerHTML=addons.map(a=>`<div class="addon-option"><label><input type="checkbox" name="customAddon" value="${esc(a.id)}" data-name="${esc(a.name)}" data-price="${a.price}" onchange="renderCustomTotal()"><span>${esc(a.name)}</span><b>${a.price?'+ '+money(a.price):'Miễn phí'}</b></label></div>`).join('');
 document.querySelectorAll('input[name="customAddon"]').forEach(input=>input.addEventListener('change',()=>input.closest('.addon-option')?.classList.toggle('selected',input.checked)));
 const sauceBox=document.getElementById('sauceList'),sauceGroup=document.getElementById('sauceGroup');
 sauceGroup.hidden=!['combo','chicken','burger','rice','sides'].includes(product.cat);
 sauceBox.innerHTML=sauces.map(a=>`<label class="sauce-choice"><input type="checkbox" name="customAddon" value="${esc(a.id)}" data-name="${esc(a.name)}" data-price="${a.price}" onchange="renderCustomTotal()"><span class="sauce-cup" style="--sauce-color:${a.color}" aria-hidden="true"></span><span><b>${esc(a.name)}</b><small>${a.spicy?'Cay · ':''}+${money(a.price)} / phần</small></span></label>`).join('');
 renderCustomTotal();openModal('customizeModal');
}
export function editCartItem(id){const old=state.cart.find(i=>i.lineId===id);if(!old)return;captureCheckoutDraft();openCustomize(old.productId);state.customEditLineId=id;state.returnToCheckout=true;state.customQty=old.qty;document.getElementById('customQty').textContent=old.qty;document.getElementById('customNote').value=old.note||'';for(const input of document.querySelectorAll('input[name="customAddon"]'))input.checked=(old.extras||[]).some(e=>e.id===input.value);const flavor=[...document.querySelectorAll('input[name="flavor"]')].find(e=>e.value===old.flavor);if(flavor)flavor.checked=true;renderCustomTotal();}
export function changeCustomQty(delta){state.customQty=Math.max(1,Math.min(20,state.customQty+delta));document.getElementById('customQty').textContent=state.customQty;renderCustomTotal();}
export function currentCustomization(){
 const product=state.currentItem;if(!product)return null;
 const flavor=document.querySelector('input[name="flavor"]:checked')?.value||'';
 const allowed=productAddons(product.cat);const extras=[...document.querySelectorAll('input[name="customAddon"]:checked')].filter(el=>!el.closest('[hidden]')).map(el=>allowed.find(a=>a.id===el.value)).filter(Boolean).map(a=>({id:a.id,name:a.name,price:a.price}));
 const note=document.getElementById('customNote').value.trim();return{product,flavor:document.getElementById('flavorGroup').classList.contains('hidden')?'':flavor,extras,note,qty:state.customQty};
}
export function renderCustomTotal(){
 if(!state.currentItem)return;const selected=currentCustomization();const unit=state.currentItem.price+(selected?.extras||[]).reduce((s,x)=>s+x.price,0);const total=unit*state.customQty;
 document.getElementById('customTotal').textContent=money(total);document.getElementById('customCtaPrice').textContent=money(total);
}
export function confirmCustomization(){
 const selected=currentCustomization();if(!selected)return;
 const{product,flavor,extras,note,qty}=selected;
 if(state.soldOut.includes(product.id)){toast('Món vừa hết hàng. Vui lòng chọn món khác.','error');return;}
 if(qty<1||qty>20)return;
 const unitPrice=product.price+extras.reduce((sum,e)=>sum+e.price,0);
 const signature=JSON.stringify({productId:product.id,flavor,extras:extras.map(x=>x.id).sort(),note});
 const editing=state.customEditLineId;const existing=state.cart.find(item=>item.signature===signature&&item.lineId!==editing);
 if(existing&&existing.qty+qty>20){toast('Tối đa 20 phần cho mỗi lựa chọn món.','error');return;}
 if(!editing&&!existing&&state.cart.length>=72){toast('Giỏ đã có 72 lựa chọn. Gộp hoặc bớt món trước khi thêm.','error');return;}
 if(editing)state.cart=state.cart.filter(i=>i.lineId!==editing);
 if(existing){if(existing.qty+qty>20){toast('Tối đa 20 phần cho mỗi lựa chọn món.','error');return;}existing.qty+=qty;}else state.cart.push({lineId:uid('LINE'),signature,productId:product.id,name:product.name,cat:product.cat,img:product.img,unitPrice,qty,flavor,extras,note});
 persistCustomerState();updateCartBadges();closeModal('customizeModal');toast(`Đã thêm ${qty} × ${product.name} vào giỏ hàng.`,'success');
 if(state.autoVoucherAfterCustomize){state.voucherAuto=true;state.appliedVoucher=null;state.shippingVoucher=null;state.autoVoucherAfterCustomize=false;persistCustomerState();}
 state.customEditLineId=null;if(state.returnToCheckout){state.returnToCheckout=false;openCart();}
}
export function takeVoucher(code){const normalized=String(code||'').trim().toUpperCase(),v=vouchers.find(v=>v.code===normalized);if(!v)return;state.voucherAuto=false;if(v.type==='shipping')state.shippingVoucher=normalized;else state.appliedVoucher=normalized;persistCustomerState();toast('Đã chọn ưu đãi. Giỏ hàng sẽ kiểm tra điều kiện khi đặt.');if(document.getElementById('cartModal')?.classList.contains('open'))renderCart();}
export function applyVoucher(code){if(code){const result=validateVoucher(code);if(!result.ok){toast(result.msg,'error');return;}takeVoucher(result.voucher.code);renderCart();}else window.openVoucherPicker();}
export function removeVoucher(){state.appliedVoucher=null;state.shippingVoucher=null;state.voucherAuto=false;persistCustomerState();renderCart();toast('Đã bỏ các ưu đãi.');}
export function openCart(){renderCart();openModal('cartModal');}
export function refreshCartPricing(){const quote=getPricing(),rows=document.querySelectorAll('#cartContent .pricing-line');if(rows.length>=4){rows[0].querySelector('strong').textContent=money(quote.subtotal);rows[1].querySelector('span').textContent='Giảm giá'+(quote.voucherCodes.length?' ('+quote.voucherCodes.join(' + ')+')':'');rows[1].querySelector('strong').textContent='−'+money(quote.discount);rows[2].querySelector('strong').textContent=quote.ship?money(quote.ship):'Không tính phí giao';rows[3].querySelector('strong').textContent=money(quote.final);}const pill=document.querySelector('.voucher-summary');if(pill){pill.querySelector('b').textContent=quote.voucherCodes.length?'Đã chọn '+quote.voucherCodes.length+' ưu đãi':'Chọn ưu đãi cho giỏ hàng';pill.querySelector('small').textContent=quote.voucherCodes.length?quote.voucherCodes.join(' + ')+' · Tiết kiệm '+money(quote.discount):'Không cần nhập mã · xem điều kiện và chọn';}const footer=document.querySelector('#cartFooter .primary-btn span');if(footer)footer.textContent=money(quote.final)+' →';updateCartBadges();}
export function renderCart(){
 captureCheckoutDraft();updateCartBadges();const box=document.getElementById('cartContent'),foot=document.getElementById('cartFooter');if(!box||!foot)return;
 if(!state.cart.length){document.getElementById('checkoutAdvisor')?.remove();box.innerHTML='<div class="empty-state"><b>Giỏ hàng đang trống</b>Chọn vài món ngon trong thực đơn rồi quay lại đây nhé.<br><button class="outline-btn" style="margin-top:14px" onclick="closeModal(\'cartModal\');document.getElementById(\'menuSection\').scrollIntoView({behavior:\'smooth\'})">← Khám phá thực đơn</button></div>';foot.innerHTML='';return;}
 const pricing=getPricing();
 const cartHtml=`<div class="cart-layout"><section><h3 class="cart-section-title">Món đã chọn (${cartCount()})</h3><div class="cart-list">${state.cart.map(item=>`<article class="cart-item"><img src="${esc(item.img)}" alt="${esc(item.name)}" onerror="this.onerror=null;this.src='assets/images/chicken.webp'"><div class="cart-item-info"><h4>${esc(item.name)}</h4><p>${esc(formatLineDetails(item))}</p><small>${money(item.unitPrice)} / món</small></div><div class="cart-side"><strong>${money(item.unitPrice*item.qty)}</strong><button class="cart-edit" onclick="editCartItem('${item.lineId}')">Sửa / chọn xốt</button><div class="cart-mini-qty"><button onclick="changeCartQty('${item.lineId}',-1)" aria-label="Giảm">−</button><span>${item.qty}</span><button onclick="changeCartQty('${item.lineId}',1)" aria-label="Tăng">+</button></div><button class="cart-remove" onclick="removeCartItem('${item.lineId}')">Xóa</button></div></article>`).join('')}</div><div style="margin-top:16px"><button class="outline-btn" onclick="closeModal('cartModal');document.getElementById('menuSection').scrollIntoView({behavior:'smooth'})">+ Thêm món khác</button></div><section id="checkoutAdvisor" class="checkout-advisor" aria-live="polite"></section></section><aside class="checkout-panel"><h3>Tóm tắt đơn hàng</h3><div class="pricing-lines"><div class="pricing-line"><span>Tạm tính món</span><strong>${money(pricing.subtotal)}</strong></div><div class="pricing-line discount"><span>Giảm giá${pricing.voucherCodes.length?` (${esc(pricing.voucherCodes.join(' + '))})`:''}</span><strong>−${money(pricing.discount)}</strong></div><div class="pricing-line"><span>Phí giao hàng</span><strong>${pricing.ship?money(pricing.ship):'Miễn phí / đến lấy'}</strong></div><div class="pricing-line total"><span>Tổng thanh toán</span><strong>${money(pricing.final)}</strong></div></div><button type="button" class="voucher-summary" onclick="openVoucherPicker()"><span class="voucher-summary-icon">%</span><span><b>${pricing.voucherCodes.length?'Đã chọn '+pricing.voucherCodes.length+' ưu đãi':'Chọn ưu đãi cho giỏ hàng'}</b><small>${pricing.voucherCodes.length?esc(pricing.voucherCodes.join(' + '))+' · Tiết kiệm '+money(pricing.discount):'Không cần nhập mã · xem điều kiện và chọn'}</small></span><em>Đổi ›</em></button><h3 style="margin-top:12px">Thông tin nhận hàng</h3>${renderCheckoutFields()}<p class="checkout-summary-pill">Chi nhánh: <b>${esc(getBranch().name)}</b></p><div class="payment-info-note">Sau khi đặt hàng, hệ thống sẽ hiển thị mã QR kèm mã đơn và nội dung thanh toán cho các phương thức điện tử.</div></aside></div>`;
 box.innerHTML=cartHtml;foot.innerHTML='<button class="primary-btn full" onclick="checkout()">Xác nhận đặt hàng <span>'+money(pricing.final)+' →</span></button>';renderCheckoutAdvisor();
}
export function changeCartQty(lineId,delta){const item=state.cart.find(x=>x.lineId===lineId);if(!item)return;if(item.qty+delta>20){toast('Tối đa 20 phần cho mỗi lựa chọn món.','error');return;}item.qty+=delta;if(item.qty<=0)state.cart=state.cart.filter(x=>x.lineId!==lineId);persistCustomerState();renderCart();}
export function removeCartItem(lineId){state.cart=state.cart.filter(x=>x.lineId!==lineId);persistCustomerState();renderCart();toast('Đã xóa món khỏi giỏ hàng.','success');}
export function initCart(){updateCartBadges();window.addEventListener('resize',updateCartBadges);}
