import { state, getOrders, setOrders, persistCustomerState } from '../state.js';
import { receiptTokenFor, tableReceipts, rememberPlacedOrder } from './orderAccess.js';

const staff=()=>location.pathname.replace(/\/$/,'')==='/staff';
let polling=false,started=false;
async function api(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',...options.headers}});const payload=await response.json().catch(()=>({}));if(!response.ok){const e=Error(payload.message||'Chưa kết nối được máy chủ đơn tại bàn.');e.code=payload.error;e.detail=payload.detail;throw e;}return payload;}
 finally{clearTimeout(timer);}
}
export function mergeTableOrders(incoming){
 const rows=getOrders(),byId=new Map(rows.map(o=>[o.id,o]));let changed=false;
 for(const o of incoming){const old=byId.get(o.id);if(!old||(o.revision||0)>(old.revision||0)){byId.set(o.id,o);changed=true;}}
 if(changed)setOrders([...byId.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
}
export async function createTableOrder(payload){
 const fingerprint=JSON.stringify(payload);let pending=null;try{pending=JSON.parse(sessionStorage.getItem('chickyjoy_pending_table_order')||'null');}catch{}
 if(pending?.fingerprint!==fingerprint){pending={fingerprint,id:crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16))};try{sessionStorage.setItem('chickyjoy_pending_table_order',JSON.stringify(pending));}catch{}}
 const result=await api('/api/table-orders',{method:'POST',body:JSON.stringify({...payload,clientRequestId:pending.id})});
 rememberPlacedOrder(result.order,{receiptToken:result.receiptToken});mergeTableOrders([result.order]);try{sessionStorage.removeItem('chickyjoy_pending_table_order');}catch{}return result.order;
}
export async function refreshTableOrder(id){const token=receiptTokenFor(id);if(!token)throw Error('Biên nhận của đơn không có trên thiết bị này.');const o=await api('/api/table-orders/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token}});mergeTableOrders([o]);return o;}
function applyAvailability(ids){if(!Array.isArray(ids))return;const next=[...new Set(ids.filter(Number.isInteger))].sort((a,b)=>a-b);if(JSON.stringify([...state.soldOut].sort((a,b)=>a-b))===JSON.stringify(next))return;state.soldOut=next;persistCustomerState();window.dispatchEvent(new Event('gagion-catalog-availability-changed'));}
export async function syncTableAvailability(){applyAvailability(await api('/api/table-availability'));}
export async function setTableAvailability(id,available){applyAvailability(await api('/api/table-availability/'+id,{method:'POST',body:JSON.stringify({available})}));}
export async function tableOrderAction(order,action,extra={}){
 const isStaff=staff(),token=isStaff?'':receiptTokenFor(order.id);if(!isStaff&&!token)throw Error('Biên nhận của đơn không có trên thiết bị này.');
 try{const o=await api('/api/table-orders/'+encodeURIComponent(order.id)+(isStaff?'/staff':'/actions'),{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({revision:order.revision,action,...extra})});mergeTableOrders([o]);return o;}
 catch(e){if(e.code==='order_changed'){if(isStaff)await pollTableOrders();else await refreshTableOrder(order.id);}throw e;}
}
export async function pollTableOrders(){
 if(polling||document.hidden)return;polling=true;
 try{
  if(staff()){await syncTableAvailability();const rows=await api('/api/table-orders/staff');mergeTableOrders(rows);const el=document.getElementById('tableSyncLabel');if(el)el.textContent='Đơn QR tại bàn · đã đồng bộ '+new Date().toLocaleTimeString('vi-VN');}
  else{if(state.table)await syncTableAvailability();const receipts=tableReceipts().filter(r=>{const o=getOrders().find(o=>o.id===r.id);return !o||!['done','cancelled'].includes(o.status)||o.id===state.currentOrderId;}).slice(0,12);await Promise.allSettled(receipts.map(r=>refreshTableOrder(r.id)));}
 }catch(e){const el=document.getElementById('tableSyncLabel');if(el)el.textContent=e.message;}
 finally{polling=false;}
}
export function initTableOrderSync(){if(started)return;started=true;if(!staff()){const owned=new Set(tableReceipts().map(r=>r.id));const kept=getOrders().filter(o=>!o.serverManaged||owned.has(o.id));if(kept.length!==getOrders().length)setOrders(kept);}pollTableOrders();setInterval(pollTableOrders,5000);window.addEventListener('focus',pollTableOrders);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollTableOrders();});}
