import { vouchers } from '../data/catalog.js';
import { state, persistCustomerState } from '../state.js';
import { money, esc } from '../utils.js';
import { openModal, closeModal, toast } from '../components/ui.js';
import { getPricing, promotionOptions, renderCart } from './cart.js';
import { captureCheckoutDraft } from './checkout.js';
import { quotePromotions, voucherEligibility } from '../services/promotions.js';

let choice={goodsCode:null,shippingCode:null,auto:true};
export function openVoucherPicker(){captureCheckoutDraft();const current=getPricing();choice={goodsCode:current.goods?.code||null,shippingCode:current.freight?.code||null,auto:state.voucherAuto};renderVoucherPicker();openModal('voucherPickerModal');document.getElementById('voucherPickerContent').scrollTop=0;}
function renderVoucherPicker(){
 const opts=promotionOptions(),quote=quotePromotions(state.cart,{...opts,...choice});
 const card=v=>{const eligible=voucherEligibility(v,state.cart,opts),selected=choice.auto?quote.voucherCodes.includes(v.code):(v.type==='shipping'?choice.shippingCode:choice.goodsCode)===v.code;return `<button type="button" class="voucher-pick-card ${selected?'selected':''} ${eligible.ok?'':'unavailable'}" ${eligible.ok?'':'disabled'} onclick="selectVoucherChoice('${esc(v.code)}')"><span class="voucher-pick-mark">${v.type==='shipping'?'↗':v.type==='percent'?v.value+'%':v.value/1000+'K'}</span><span class="voucher-pick-copy"><b>${esc(v.desc)}</b><small>${esc(eligible.reason)}</small><em>${esc(v.code)}${selected?' · Đã chọn':''}</em></span><span class="voucher-pick-tick" aria-hidden="true">${selected?'✓':'○'}</span></button>`;};
 document.getElementById('voucherPickerContent').innerHTML=`<button type="button" class="voucher-auto ${choice.auto?'active':''}" onclick="selectBestVouchers()"><span>✦</span><span><b>Tự chọn ưu đãi tốt nhất</b><small>So sánh mức giảm theo giỏ và cách nhận món</small></span><i>${choice.auto?'✓':'○'}</i></button><div class="voucher-picker-group"><h3>Giảm tiền món <small>Chọn tối đa 1</small></h3>${vouchers.filter(v=>v.type!=='shipping').map(card).join('')}<button class="voucher-none" type="button" onclick="selectVoucherChoice('none-goods')">Không dùng ưu đãi món</button></div><div class="voucher-picker-group"><h3>Ưu đãi giao hàng <small>Có thể dùng cùng ưu đãi món</small></h3>${vouchers.filter(v=>v.type==='shipping').map(card).join('')}<button class="voucher-none" type="button" onclick="selectVoucherChoice('none-shipping')">Không dùng ưu đãi giao hàng</button></div>`;
 document.getElementById('voucherPickerSaving').textContent=money(quote.discount);
}
export function selectVoucherChoice(code){const q=quotePromotions(state.cart,{...promotionOptions(),...choice});if(choice.auto)choice={goodsCode:q.goods?.code||null,shippingCode:q.freight?.code||null,auto:false};if(code==='none-goods')choice.goodsCode=null;else if(code==='none-shipping')choice.shippingCode=null;else{const v=vouchers.find(v=>v.code===code);if(!v||!voucherEligibility(v,state.cart,promotionOptions()).ok)return;if(v.type==='shipping')choice.shippingCode=choice.shippingCode===code?null:code;else choice.goodsCode=code;}renderVoucherPicker();}
export function selectBestVouchers(){choice.auto=true;renderVoucherPicker();}
export function confirmVoucherChoice(){state.voucherAuto=choice.auto;state.appliedVoucher=choice.goodsCode;state.shippingVoucher=choice.shippingCode;persistCustomerState();closeModal('voucherPickerModal');renderCart();openModal('cartModal');toast('Đã cập nhật ưu đãi cho giỏ hàng.');}
export function backToCart(){closeModal('voucherPickerModal');renderCart();openModal('cartModal');}
