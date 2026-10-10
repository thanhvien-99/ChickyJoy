import { branches } from '../data/catalog.js';
import { esc, formatDateTime, csvCell } from '../utils.js';
import { toast } from '../components/ui.js';

const STORAGE_KEY='gagion_party_reservations_v1';
const statuses=['Đã tiếp nhận','Đã xác nhận','Đang chuẩn bị','Hoàn tất','Đã hủy'];
function readReservations(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value.map(i=>({...i,branch:i.branch?{...i.branch,name:branches.find(b=>b.id===i.branch.id)?.name||i.branch.name}:i.branch})):[];}catch{return[];}}
function writeReservations(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items));window.dispatchEvent(new Event('gagion-party-reservations-changed'));}
export function renderPartyReservations(){
 const root=document.getElementById('partyReservationsList');if(!root)return;
 const items=readReservations();
 const subhead=document.getElementById('partyReservationsSubhead');if(subhead)subhead.textContent=`${items.length} yêu cầu đặt tiệc · Lịch hẹn và thông tin liên hệ`;
 if(!items.length){root.innerHTML='<div class="admin-empty">Chưa có yêu cầu đặt tiệc. Yêu cầu mới sẽ xuất hiện tại đây.</div>';return;}
 root.innerHTML=items.map(item=>`<article class="party-reservation-card"><div class="party-reservation-main"><div class="party-reservation-title"><b>${esc(item.id)}</b><span class="status-badge ${item.status==='Đã hủy'?'status-cancelled':item.status==='Hoàn tất'?'status-done':item.status==='Đã xác nhận'?'status-ready':'status-new'}">${esc(item.status||'Đã tiếp nhận')}</span></div><h3>${esc(item.type)} · ${esc(item.guestRange||`${item.guests||0} khách`)}</h3><p><b>${esc(item.name)}</b> · <a href="tel:${esc(item.phone)}">${esc(item.phone)}</a>${item.email?` · ${esc(item.email)}`:''}</p><p>◷ ${formatDateTime(item.date)} · ${esc(item.branch?.name||'Chi nhánh ChickyJoy')}</p><p>Ngân sách: ${esc(item.budget||'Chưa xác định')}</p>${item.note?`<p class="party-reservation-note">Yêu cầu: ${esc(item.note)}</p>`:''}</div><div class="party-reservation-controls"><label class="field"><span>Cập nhật trạng thái</span><select onchange="updatePartyReservationStatus('${esc(item.id)}',this.value)" ${item.status==='Đã hủy'?'disabled':''}>${statuses.map(status=>`<option value="${esc(status)}" ${status===(item.status||'Đã tiếp nhận')?'selected':''}>${esc(status)}</option>`).join('')}</select></label><a class="outline-btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.branch?.address||'TP.HCM')}" target="_blank" rel="noopener noreferrer">Mở bản đồ ↗</a></div></article>`).join('');
}
export function updatePartyReservationStatus(id,status){
 if(!statuses.includes(status)){toast('Trạng thái đặt tiệc không hợp lệ.','error');return;}
 const items=readReservations();const item=items.find(entry=>entry.id===id);if(!item){toast('Không tìm thấy yêu cầu đặt tiệc.','error');return;}
 item.status=status;item.updatedAt=new Date().toISOString();writeReservations(items);renderPartyReservations();toast('Đã cập nhật trạng thái yêu cầu đặt tiệc.','success');
}
export function exportPartyReservationsCSV(){
 const items=readReservations();if(!items.length){toast('Chưa có yêu cầu đặt tiệc để xuất.','error');return;}
 const header=['Mã yêu cầu','Người liên hệ','Điện thoại','Email','Loại tiệc','Quy mô khách','Ngày giờ','Chi nhánh','Ngân sách','Trạng thái','Yêu cầu'];
 const rows=[header,...items.map(i=>[i.id,i.name,i.phone,i.email,i.type,i.guestRange||i.guests, i.date,i.branch?.name||'',i.budget||'',i.status||'Đã tiếp nhận',i.note||''])];
 const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`chickyjoy-party-reservations-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);toast('Đã xuất danh sách đặt tiệc.','success');
}
