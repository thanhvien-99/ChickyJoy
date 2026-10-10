import { menu } from '../data/catalog.js';
import { state } from '../state.js';
import { money, esc } from '../utils.js';
import { quotePromotions, suggestBasketExtras } from '../services/promotions.js';
import { getPricing, promotionOptions, openCustomize, renderCustomTotal } from '../customer/cart.js';
import { captureCheckoutDraft } from '../customer/checkout.js';

let generation=0,controller=null,blocked='',debounce,activeFingerprint='',cooldownUntil=0;
const cache=new Map();
window.addEventListener('chickyjoy:ai-blocked',e=>{blocked=e.detail?.code||'ai_unavailable';});
window.addEventListener('chickyjoy:ai-reset',()=>{blocked='';cooldownUntil=0;cache.clear();});
function draw(suggestions,source='local',notice=''){
 const root=document.getElementById('checkoutAdvisor');if(!root||!state.cart.length)return;
 root.innerHTML=`<div class="advisor-heading"><span>✦</span><div><h3>Thêm một chút, vui hơn</h3><p>${source==='ai'?'ChickyJoy AI gợi ý · ưu đãi tính lại theo giỏ':'Gợi ý theo giỏ và ưu đãi hiện tại'}</p></div></div>${notice?`<p class="advisor-status">${esc(notice)}</p>`:''}<div class="checkout-suggestion-grid">${suggestions.map(s=>`<article class="checkout-suggestion"><img src="${esc(s.product.img)}" alt=""><div><span class="suggestion-label">${s.kind==='unlock'?'Mở thêm ưu đãi':source==='ai'?'AI gợi ý':'Dùng cùng bữa ăn'}</span><h4>${s.qty} × ${esc(s.product.name)}</h4><p>${s.unlocks.length?'Có thể dùng '+esc(s.unlocks.join(' + ')):'Thêm một lựa chọn cho bữa ăn'}</p><dl><div><dt>Tiền món thêm</dt><dd>${money(s.addedCost)}</dd></div>${s.extraSaving>0?`<div><dt>Mức giảm tăng thêm</dt><dd>−${money(s.extraSaving)}</dd></div>`:''}<div class="net-cost"><dt>${s.netIncrease<0?'Tổng trả giảm':'Tổng trả tăng'}</dt><dd>${money(Math.abs(s.netIncrease))}</dd></div></dl><button class="outline-btn small" type="button" onclick="openUpsellProduct(${s.product.id},${s.qty})">Xem món & chọn ưu đãi →</button></div></article>`).join('')}</div><p class="advisor-footnote">Mua thêm là tùy chọn. Chọn món và xác nhận trước khi thêm; ưu đãi đề xuất sẽ được chọn lại theo giỏ.</p>`;
}
export function renderCheckoutAdvisor(){
 const options=promotionOptions(),suggestions=suggestBasketExtras(state.cart,options);
 const fingerprint=JSON.stringify({lines:state.cart.map(i=>[i.productId,i.qty,i.unitPrice]),mode:state.mode,branch:state.branch,first:options.firstOrder,goods:options.goodsCode,freight:options.shippingCode,auto:options.auto,soldOut:state.soldOut});
 if(controller&&!controller.signal.aborted&&activeFingerprint===fingerprint){draw(suggestions,'local','Đang nhờ ChickyJoy AI chọn món dùng cùng…');return;}
 const token=++generation;controller?.abort();controller=null;draw(suggestions);
 if(blocked){draw(suggestions,'local','AI đang tạm dừng; gợi ý ưu đãi vẫn được tính từ giỏ.');return;}
 if(cache.has(fingerprint)){const value=cache.get(fingerprint);if(!value.expires||value.expires>Date.now()){draw(value.items,value.source,value.notice);return;}cache.delete(fingerprint);}
 if(cooldownUntil>Date.now()){draw(suggestions,'local','AI đang giới hạn lượt; gợi ý theo giỏ vẫn hoạt động.');return;}
 if(!suggestions.length&&!state.cart.length)return;
 controller=new AbortController();activeFingerprint=fingerprint;const current=controller;
 const timer=setTimeout(()=>current.abort(),55000);
 (async()=>{
  try{
   const status=await fetch('/api/chat/status',{signal:current.signal});const config=status.ok?await status.json():{};
   if(!config.available){cache.set(fingerprint,{items:suggestions,source:'local',notice:'AI chưa kết nối; ưu đãi được tính từ giỏ.'});if(token===generation)draw(suggestions,'local','AI chưa kết nối; ưu đãi được tính từ giỏ.');return;}
   if(token!==generation)return;draw(suggestions,'local','Đang nhờ ChickyJoy AI chọn món dùng cùng…');
   const price=getPricing(),hint=suggestions.map(s=>`${s.qty} x ${s.product.name}: thêm ${s.addedCost}, giảm tăng ${s.extraSaving}, chênh tổng ${s.netIncrease}, mã ${s.after.voucherCodes.join('+')}`).join('; ');
   const message=`Tôi đang thanh toán, muốn gợi ý món dùng cùng hoặc mua thêm nếu đáng tiền. Tổng hiện tại ${price.final} đồng; tiền món ${price.subtotal}, phí giao ${price.ship}, giảm ${price.discount}; cách nhận ${state.mode}. Phương án website đã tính: ${hint}. Trả lời ngắn theo khẩu vị/ghép món; trả products 1–3 ID món đang bán, plans rỗng, không tự đặt đơn. Không khẳng định giảm giá/số tiền khác dữ liệu trên.`.slice(0,1500);
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:current.signal,body:JSON.stringify({message,history:[],context:{branchId:state.branch,mode:state.mode,soldOut:state.soldOut,cart:state.cart.slice(0,72).map(i=>({id:i.productId,qty:i.qty}))}})});
   const answer=await response.json();if(!response.ok){const error=Error('ai_unavailable');error.code=answer.error;error.status=response.status;throw error;}
   const chosen=[...suggestions];
   for(const id of (Array.isArray(answer.products)?answer.products:[]).slice(0,3)){
    const product=menu.find(p=>p.id===id&&!state.soldOut.includes(p.id));if(!product||chosen.some(s=>s.product.id===id))continue;
    const after=quotePromotions([...state.cart,{productId:id,qty:1,unitPrice:product.price}],{...promotionOptions(),auto:true});
    chosen.push({product,qty:1,addedCost:product.price,extraSaving:after.discount-price.discount,netIncrease:after.total-price.final,after,unlocks:after.voucherCodes.filter(c=>!price.voucherCodes.includes(c)),kind:'pair'});
   }
   const ids=answer.products||[],items=chosen.sort((a,b)=>a.kind==='unlock'&&b.kind!=='unlock'?-1:b.kind==='unlock'&&a.kind!=='unlock'?1:(ids.includes(a.product.id)?ids.indexOf(a.product.id):999)-(ids.includes(b.product.id)?ids.indexOf(b.product.id):999)).slice(0,3);
   cache.set(fingerprint,{items,source:'ai',notice:''});if(cache.size>8)cache.delete(cache.keys().next().value);if(token===generation)draw(items,'ai');
  }catch(error){if(current.signal.aborted||token!==generation)return;if(['ai_quota','ai_auth','ai_model'].includes(error.code)){blocked=error.code;window.dispatchEvent(new CustomEvent('chickyjoy:ai-blocked',{detail:{code:blocked}}));}if(error.status===429||['ai_provider_rate_limit','rate_limit'].includes(error.code))cooldownUntil=Date.now()+60000;const notice=blocked?'AI đang tạm dừng; gợi ý ưu đãi vẫn được tính từ giỏ.':'AI chưa trả lời được; bạn vẫn xem được ưu đãi theo giỏ.';cache.set(fingerprint,{items:suggestions,source:'local',notice,expires:Date.now()+60000});draw(suggestions,'local',notice);}
  finally{clearTimeout(timer);if(controller===current){controller=null;activeFingerprint='';}while(cache.size>8)cache.delete(cache.keys().next().value);}
 })();
}
export function scheduleCheckoutPromotions(){clearTimeout(debounce);debounce=setTimeout(()=>{if(document.getElementById('cartModal')?.classList.contains('open')){window.refreshCartPricing?.();renderCheckoutAdvisor();}},550);}
export function openUpsellProduct(id,qty=1){captureCheckoutDraft();openCustomize(id);state.returnToCheckout=true;state.autoVoucherAfterCustomize=true;state.customQty=Math.max(1,Math.min(2,qty));document.getElementById('customQty').textContent=state.customQty;renderCustomTotal();}
