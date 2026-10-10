import { state, getOrders } from '../state.js';
import { loadJSON, saveJSON } from './storage.js';
import { normalizePhone } from '../utils.js';

export const RECEIPTS_KEY='gagion_order_receipts_v1';
const sessionAccess=new Map();
const privateTokens=new Map();
const receipts=()=>{const rows=loadJSON(RECEIPTS_KEY,[]);return Array.isArray(rows)?rows:[];};
const belongsToMember=order=>Boolean(state.member?.email&&(order.memberId?order.memberId===state.member.id:order.memberEmail===state.member.email));
export function canAccessOrder(order){
 if(!order)return false;
 if(order.serverManaged)return Boolean(receiptTokenFor(order.id));
 if(belongsToMember(order)||(sessionAccess.has(order.id)&&(sessionAccess.get(order.id)||(!order.memberId&&!order.memberEmail)||belongsToMember(order))))return true;
 return receipts().some(r=>r.id===order.id&&normalizePhone(r.phone)===normalizePhone(order.customer?.phone)&&(r.lookup||(!r.memberId&&!r.memberEmail)||belongsToMember(order)));
}
export function receiptTokenFor(id){return privateTokens.get(id)||receipts().find(r=>r.id===id)?.receiptToken||'';}
export function tableReceipts(){const saved=receipts().filter(r=>r.receiptToken);for(const [id,receiptToken] of privateTokens)if(!saved.some(r=>r.id===id))saved.push({id,receiptToken});return saved;}
export function rememberPlacedOrder(order,{persist=true,lookup=false,receiptToken=''}={}){
 if(receiptToken)privateTokens.set(order.id,receiptToken);
 sessionAccess.set(order.id,lookup);state.currentOrderId=order.id;
 if(persist){const token=receiptToken||receiptTokenFor(order.id);const rows=receipts().filter(r=>r.id!==order.id);rows.unshift({id:order.id,phone:normalizePhone(order.customer?.phone),memberId:order.memberId||'',memberEmail:order.memberEmail||'',lookup,...(token?{receiptToken:token}:{})});saveJSON(RECEIPTS_KEY,rows.slice(0,100));}
 window.dispatchEvent(new Event('gagion-customer-orders-changed'));
}
export function customerOrders(){return getOrders().filter(canAccessOrder).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}
export function legacyGuestOrders(){return getOrders().filter(o=>!o.memberId&&!o.memberEmail&&!canAccessOrder(o)).slice(0,20);}
export function forgetDeviceOrders(){sessionAccess.clear();privateTokens.clear();saveJSON(RECEIPTS_KEY,[]);state.currentOrderId=null;window.dispatchEvent(new Event('gagion-customer-orders-changed'));}
