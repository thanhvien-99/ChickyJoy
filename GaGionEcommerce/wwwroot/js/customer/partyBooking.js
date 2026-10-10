import { branches } from '../data/catalog.js';
import { esc, uid, isValidVietnamPhone, formatDateTime } from '../utils.js';
import { toast, closeModal, openModal } from '../components/ui.js';

const STORAGE_KEY='gagion_party_reservations_v1';
export function openPartyBooking(){openModal('partyBookingModal');}
export function initPartyBooking(){
 const select=document.getElementById('partyBranch');if(select)select.innerHTML=branches.map(branch=>`<option value="${esc(branch.id)}">${esc(branch.name)} — ${esc(branch.address)}</option>`).join('');
 const date=document.getElementById('partyDate');if(date){const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());date.min=now.toISOString().slice(0,16);}
}
export function submitPartyBooking(){
 const name=document.getElementById('partyName')?.value.trim()||'';
 const phone=document.getElementById('partyPhone')?.value.trim()||'';
 const email=document.getElementById('partyEmail')?.value.trim()||'';
 const dateValue=document.getElementById('partyDate')?.value||'';
 const guests=Number(document.getElementById('partyGuests')?.value||0);
 const guestRange=document.getElementById('partyGuests')?.selectedOptions?.[0]?.textContent||`${guests} khách`;
 const type=document.getElementById('partyType')?.value||'Sinh nhật';
 const budget=document.getElementById('partyBudget')?.value||'';
 const branchId=document.getElementById('partyBranch')?.value||branches[0].id;
 const note=document.getElementById('partyNote')?.value.trim()||'';
 if(name.length<2){toast('Vui lòng nhập họ tên người liên hệ.','error');return;}
 if(!isValidVietnamPhone(phone)){toast('Số điện thoại chưa đúng định dạng.','error');return;}
 if(!dateValue||new Date(dateValue)<=new Date()){toast('Vui lòng chọn thời gian đặt tiệc trong tương lai.','error');return;}
 if(guests<4){toast('Đặt tiệc cần tối thiểu 4 khách.','error');return;}
 if(email&&!/^\S+@\S+\.\S+$/.test(email)){toast('Địa chỉ email chưa hợp lệ.','error');return;}
 const date=new Date(dateValue);const mins=date.getHours()*60+date.getMinutes();const b=branches.find(b=>b.id===branchId);const [start,end]=(b?.hours||'09:00–22:00').split('–').map(t=>{const[h,m]=t.split(':').map(Number);return h*60+m;});
 if(mins<start||mins>end-60){toast('Vui lòng chọn giờ trong thời gian mở cửa và trước giờ đóng cửa ít nhất 1 tiếng.','error');return;}
 const list=(()=>{try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}})();
 const reservation={id:uid('GT'),name,phone,email,date: new Date(dateValue).toISOString(),guests,guestRange,type,budget,branch:branches.find(b=>b.id===branchId)||branches[0],note,status:'Đã tiếp nhận',createdAt:new Date().toISOString()};
 list.unshift(reservation);localStorage.setItem(STORAGE_KEY,JSON.stringify(list));window.dispatchEvent(new Event('gagion-party-reservations-changed'));
 const result=document.getElementById('partyBookingSuccess');if(result){result.innerHTML=`<div class="party-success-icon">✓</div><h3>Đã tiếp nhận yêu cầu đặt tiệc</h3><p>Mã yêu cầu <strong>${esc(reservation.id)}</strong></p><p>${esc(type)} · ${esc(guestRange)} · ${formatDateTime(reservation.date)}</p><p>Chi nhánh: ${esc(reservation.branch.name)}</p><p class="muted">Nhân viên sẽ liên hệ theo số ${esc(phone)} để xác nhận chi tiết.</p>`;result.classList.remove('hidden');}
 document.getElementById('partyBookingForm')?.classList.add('hidden');
 document.querySelector('.party-success-actions')?.classList.remove('hidden');
 toast('Yêu cầu đặt tiệc đã được ghi nhận.','success');
}
export function resetPartyBookingForm(){document.getElementById('partyBookingForm')?.reset();document.getElementById('partyBookingForm')?.classList.remove('hidden');document.getElementById('partyBookingSuccess')?.classList.add('hidden');document.querySelector('.party-success-actions')?.classList.add('hidden');initPartyBooking();}
