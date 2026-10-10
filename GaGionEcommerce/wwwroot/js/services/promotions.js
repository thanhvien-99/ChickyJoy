import { menu, vouchers, SHIPPING_FEE } from '../data/catalog.js';
import { money } from '../utils.js';

const price=(line)=>Number(line.unitPrice??menu.find(p=>p.id===(line.productId??line.id))?.price)||0;
export function voucherEligibility(v,cart,{mode='delivery',firstOrder=false}={}){
 const subtotal=cart.reduce((n,i)=>n+price(i)*i.qty,0),shipping=mode==='delivery'&&subtotal>0?SHIPPING_FEE:0;
 if(v.type==='shipping'&&!shipping)return{ok:false,reason:mode==='dinein'?'Phục vụ tại bàn không tính phí giao.':'Chỉ dùng cho đơn giao tận nơi.',gap:0,saving:0};
 if(v.code==='WELCOME10'&&!firstOrder)return{ok:false,reason:'Nhập số điện thoại của đơn đầu tiên để kiểm tra ưu đãi.',gap:Math.max(0,v.min-subtotal),saving:0};
 if(subtotal<v.min)return{ok:false,reason:'Thêm '+money(v.min-subtotal)+' tiền món để đạt điều kiện.',gap:v.min-subtotal,saving:0};
 if(v.type==='combo'&&!cart.some(i=>menu.find(p=>p.id===(i.productId??i.id))?.cat==='combo'))return{ok:false,reason:'Giỏ cần có ít nhất một combo.',gap:0,saving:0};
 const saving=v.type==='shipping'?Math.min(shipping,v.value):v.type==='percent'?Math.min(Math.round(subtotal*v.value/100),v.cap||subtotal):Math.min(subtotal,v.value);
 return{ok:subtotal>0,reason:'Đủ điều kiện',gap:0,saving};
}
export function quotePromotions(cart,{mode='delivery',firstOrder=false,auto=true,goodsCode=null,shippingCode=null}={}){
 const subtotal=cart.reduce((n,i)=>n+price(i)*i.qty,0),shipping=mode==='delivery'&&subtotal>0?SHIPPING_FEE:0;
 const eligible=vouchers.map(v=>({...v,...voucherEligibility(v,cart,{mode,firstOrder})}));
 const best=type=>eligible.filter(v=>v.ok&&(type==='shipping'?v.type==='shipping':v.type!=='shipping')).sort((a,b)=>b.saving-a.saving||a.code.localeCompare(b.code))[0]||null;
 const goods=auto?best('goods'):eligible.find(v=>v.ok&&v.type!=='shipping'&&v.code===goodsCode)||null;
 const freight=auto?best('shipping'):eligible.find(v=>v.ok&&v.type==='shipping'&&v.code===shippingCode)||null;
 const goodsDiscount=goods?.saving||0,shippingDiscount=freight?.saving||0,discount=goodsDiscount+shippingDiscount;
 return{subtotal,shipping,ship:shipping,goodsDiscount,shippingDiscount,discount,total:Math.max(0,subtotal+shipping-discount),final:Math.max(0,subtotal+shipping-discount),applied:goods||freight,goods,freight,voucherCodes:[goods?.code,freight?.code].filter(Boolean),eligible};
}
export function suggestBasketExtras(cart,options={}){
 const before=quotePromotions(cart,options),bestBefore=quotePromotions(cart,{...options,auto:true});
 const pool=menu.filter(p=>!options.soldOut?.includes(p.id));
 const canAdd=(p,qty)=>cart.filter(i=>(i.productId??i.id)===p.id&&!(i.extras?.length)&&!i.note&&(!i.flavor||i.flavor==='Truyền thống')).reduce((n,i)=>n+i.qty,0)+qty<=20;
 const suggestions=[];
 for(const p of pool){
  for(const qty of [1,2]){if(!canAdd(p,qty))continue;
   const after=quotePromotions([...cart,{productId:p.id,qty,unitPrice:p.price}],{...options,auto:true});
   const addedCost=p.price*qty,extraSaving=after.discount-before.discount,netIncrease=after.total-before.total;
   const newlyAvailable=after.voucherCodes.filter(code=>!bestBefore.voucherCodes.includes(code));
   if(newlyAvailable.length&&extraSaving>0)suggestions.push({product:p,qty,addedCost,extraSaving,netIncrease,after,unlocks:newlyAvailable,kind:'unlock'});
  }
 }
 suggestions.sort((a,b)=>a.netIncrease-b.netIncrease||b.extraSaving-a.extraSaving||a.addedCost-b.addedCost);
 const chosen=[],seen=new Set();
 for(const item of suggestions){if(seen.has(item.product.id))continue;chosen.push(item);seen.add(item.product.id);if(chosen.length===2)break;}
 const hasDrink=cart.some(i=>menu.find(p=>p.id===(i.productId??i.id))?.cat==='drinks'||/\d+\s*nước/i.test(menu.find(p=>p.id===(i.productId??i.id))?.desc||''));
 if(!hasDrink){const drink=pool.filter(p=>p.cat==='drinks').sort((a,b)=>a.price-b.price||b.popular-a.popular).find(p=>!seen.has(p.id)&&canAdd(p,1));if(drink){const after=quotePromotions([...cart,{productId:drink.id,qty:1,unitPrice:drink.price}],{...options,auto:true});chosen.push({product:drink,qty:1,addedCost:drink.price,extraSaving:after.discount-before.discount,netIncrease:after.total-before.total,after,unlocks:after.voucherCodes.filter(c=>!before.voucherCodes.includes(c)),kind:'pair'});}}
 return chosen.slice(0,3);
}
