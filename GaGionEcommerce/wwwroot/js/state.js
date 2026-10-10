import { branches } from './data/catalog.js';
import { loadJSON, saveJSON } from './services/storage.js';

export const STORAGE_KEY = 'gagion_orders_v3';
export const CART_KEY = 'gagion_cart_v3';
export const PREF_KEY = 'gagion_pref_v3';
export const FAVORITES_KEY = 'gagion_favorites_v3';
export const SOLD_OUT_KEY = 'gagion_soldout_v3';
export const MEMBER_KEY = 'gagion_member_v3';

const savedPref = loadJSON(PREF_KEY, {mode:'delivery', branch:'q5'});
export const state = {
  cart: loadJSON(CART_KEY, []), orders: loadJSON(STORAGE_KEY, []),
  category:'all', query:'', sort:'popular', onlyFavorites:false,
  currentItem:null, customQty:1, appliedVoucher:savedPref?.appliedVoucher||null, shippingVoucher:savedPref?.shippingVoucher||null, voucherAuto:savedPref?.voucherAuto!==false, table:null, customEditLineId:null, returnToCheckout:false,
  mode:['delivery','pickup'].includes(savedPref?.mode)?savedPref.mode:'delivery', branch:savedPref?.branch || 'q5',
  checkoutDraft:{}, comboGroup:'all', adminFilter:'all', adminQuery:'', adminTab:'orders',
  favorites:loadJSON(FAVORITES_KEY, []), soldOut:loadJSON(SOLD_OUT_KEY, []),
  member:loadJSON(MEMBER_KEY, null), currentOrderId:null
};

export function persistCustomerState(){
  saveJSON(CART_KEY,state.cart);
  saveJSON(PREF_KEY,{mode:state.mode,branch:state.branch,appliedVoucher:state.appliedVoucher,shippingVoucher:state.shippingVoucher,voucherAuto:state.voucherAuto});
  saveJSON(FAVORITES_KEY,state.favorites);
  saveJSON(SOLD_OUT_KEY,state.soldOut);
  saveJSON(MEMBER_KEY,state.member);
}
export function getBranch(){return branches.find(b=>b.id===state.branch)||branches[0];}
export function getOrders(){
 const orders=Array.isArray(state.orders)?state.orders:[];
 for(const order of orders){const branch=branches.find(b=>b.id===order.branch?.id);if(branch)order.branch={...order.branch,name:branch.name};}
 return orders;
}
export function setOrders(orders){
  const next=Array.isArray(orders)?orders:[];
  if(!saveJSON(STORAGE_KEY,next))return false;
  state.orders=next;
  window.dispatchEvent(new Event('gagion-orders-changed'));
  return true;
}

// Bảo vệ dữ liệu cũ/hỏng và cập nhật đường dẫn ảnh khi mở phiên bản mới.
import { menu } from './data/catalog.js';
for(const key of ['cart','orders','favorites','soldOut'])if(!Array.isArray(state[key]))state[key]=[];
state.cart=state.cart.filter(i=>menu.some(p=>p.id===i.productId)&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=20&&Number.isFinite(i.unitPrice)&&i.unitPrice>=0).map(i=>({...i,img:menu.find(p=>p.id===i.productId).img}));
