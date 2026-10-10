import { branches } from './data/catalog.js';
import { state } from './state.js';
import { esc } from './utils.js';
export function renderRestaurants(){
 const root=document.getElementById('restaurantGrid');if(!root)return;
 root.innerHTML=branches.map((branch,index)=>{
  const query=encodeURIComponent(branch.address);
  const selected=state.branch===branch.id;
  const now=new Date();const local=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));const mins=local.getHours()*60+local.getMinutes();const [start,end]=branch.hours.split('–').map(x=>{const[h,m]=x.split(':').map(Number);return h*60+m;});const open=mins>=start&&mins<end;
  return `<article class="restaurant-card"><div class="restaurant-card-top"><span class="restaurant-pin">⌖</span><span class="restaurant-status"><i style="background:${open?'#18a66a':'#8a8e96'}"></i> ${open?'Đang mở cửa':'Ngoài giờ phục vụ'}</span></div><h3>${esc(branch.name)}</h3><p class="restaurant-address">${esc(branch.address)}</p><div class="restaurant-meta"><span>◷ ${esc(branch.hours)}</span><span>↗ ${esc(branch.eta)}</span></div><div class="restaurant-actions"><button class="primary-btn small" onclick="chooseBranch('${esc(branch.id)}')">${selected?'✓ Đang chọn':'Chọn chi nhánh'}</button><a class="outline-btn small" href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></div></article>`;
 }).join('');
}
