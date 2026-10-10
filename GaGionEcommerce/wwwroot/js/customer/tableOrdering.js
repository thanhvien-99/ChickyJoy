import { branches, tableOrdering } from '../data/catalog.js';
import { state, persistCustomerState } from '../state.js';
import { qrImage } from '../services/payment.js';
import { esc } from '../utils.js';
import { toast, updateBranchHeader } from '../components/ui.js';
import { renderCart, updateCartBadges } from './cart.js';
import { initTableOrderSync, syncTableAvailability } from '../services/tableOrders.js';

export async function initTableOrdering(){
 initTableOrderSync();const params=new URLSearchParams(location.search),table=params.get('table'),branch=params.get('branch');if(!table)return;
 const banner=document.getElementById('tableOrderBanner');banner.hidden=false;banner.innerHTML='<span>⌗</span><div><b>Đang xác nhận bàn…</b><small>Chờ trong giây lát trước khi đặt món.</small></div>';state.tableLoading=true;
 try{const response=await fetch('/api/tables?branch='+encodeURIComponent(branch||'')+'&table='+encodeURIComponent(table));const data=await response.json();if(!response.ok)throw Error(data.message||'Mã bàn không hợp lệ.');state.table={...data.table,branchId:data.branch.id};state.branch=data.branch.id;state.mode='dinein';await syncTableAvailability();persistCustomerState();updateBranchHeader();updateCartBadges();banner.innerHTML=`<span>⌗</span><div><b>Đặt món tại ${esc(data.table.label)} · ${esc(data.branch.name)}</b><small>Chọn món, kiểm tra giỏ và xác nhận. Nhà hàng mang món đến đúng bàn này.</small></div><button class="outline-btn small" onclick="openCart()">Chọn xong? Mở giỏ →</button>`;if(document.getElementById('cartModal')?.classList.contains('open'))renderCart();window.dispatchEvent(new Event('gagion-branch-changed'));}
 catch(e){state.tableInvalid=true;state.table=null;banner.innerHTML=`<span>!</span><div><b>Chưa xác nhận được bàn</b><small>${esc(e.message)} Hãy quét lại mã hoặc hỏi nhân viên.</small></div>`;}
 finally{state.tableLoading=false;}
}
export async function renderTableQrManager(){
 const root=document.getElementById('adminTablesPanel');if(!root)return;
 let info;try{const r=await fetch('/api/tables');info=await r.json();if(!r.ok)throw Error(info.message);}catch(e){root.innerHTML=`<p class="table-qr-error">${esc(e.message||'Không tải được cấu hình bàn.')}</p>`;return;}
 root.innerHTML=`<div class="admin-panel"><h2>QR đặt món tại bàn</h2><p class="panel-muted">Mỗi mã mở thực đơn với đúng nhà hàng và số bàn.</p><div class="table-staff-notice">Dùng điện thoại và máy chạy ChickyJoy cùng Wi-Fi. Địa chỉ QR cần truy cập được từ điện thoại; với website đã đưa lên mạng, nhập tên miền đang chạy. Màn hình nhân viên mở bằng localhost trên máy cửa hàng.</div><div class="table-qr-toolbar"><label class="field"><span>Địa chỉ website dùng trong QR</span><input id="tableQrBase" value="${esc(info.publicBaseUrl)}" inputmode="url"></label><label class="field"><span>Nhà hàng</span><select id="tableQrBranch">${branches.map(b=>`<option value="${b.id}" ${b.id===state.branch?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label><button class="primary-btn" onclick="generateTableQrs()">Tạo mã cho các bàn</button><button class="outline-btn" onclick="printTableQrs()">In mã QR ↓</button></div><div id="tableQrMessage"></div><div id="tableQrGrid" class="table-qr-grid"></div><p class="table-orders-note">Nếu điện thoại chưa mở được địa chỉ, kiểm tra cùng Wi-Fi và quyền cho ứng dụng qua tường lửa Windows. Mã bàn này dùng để đặt món; QR chuyển khoản nằm ở bước thanh toán.</p></div>`;
 generateTableQrs();
}
export function generateTableQrs(){
 const input=document.getElementById('tableQrBase'),grid=document.getElementById('tableQrGrid'),message=document.getElementById('tableQrMessage');if(!input||!grid)return;
 let base;try{base=new URL(input.value.trim());if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error();}catch{message.innerHTML='<p class="table-qr-error">Nhập địa chỉ bắt đầu bằng http:// hoặc https://.</p>';grid.innerHTML='';return;}
 const branch=branches.find(b=>b.id===document.getElementById('tableQrBranch').value)||branches[0];const local=['localhost','127.0.0.1','[::1]','0.0.0.0','[::]'].includes(base.hostname);
 message.innerHTML=local?'<p class="table-qr-error">Địa chỉ localhost chỉ mở trên máy này. Đổi sang IP Wi-Fi của máy hoặc tên miền trước khi in QR cho khách.</p>':'';
 grid.innerHTML=tableOrdering.tables.map(table=>{const url=new URL(base.pathname,base.origin);url.searchParams.set('branch',branch.id);url.searchParams.set('table',table.id);return `<article class="table-qr-card"><strong>ChickyJoy</strong><h3>${esc(table.label)}</h3><small>${esc(branch.name)}</small><img src="${qrImage(url.href)}" alt="QR đặt món ${esc(table.label)}"><b>Quét mã · Chọn món · Nhận tại bàn</b><small>Mở camera điện thoại để bắt đầu</small><a href="${esc(url.href)}" target="_blank" rel="noopener">Mở thử bàn này ↗</a></article>`;}).join('');
}
export function printTableQrs(){if(!document.querySelector('#tableQrGrid img')){toast('Tạo mã QR trước khi in.','error');return;}const base=new URL(document.getElementById('tableQrBase').value);if(['localhost','127.0.0.1','[::1]','0.0.0.0','[::]'].includes(base.hostname)){toast('Đổi localhost sang địa chỉ điện thoại truy cập được trước khi in.','error');return;}window.print();}
