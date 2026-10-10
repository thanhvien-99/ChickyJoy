import { esc, money } from '../utils.js';
import { categories, vouchers, branches } from '../data/catalog.js';
import { state, getBranch, persistCustomerState } from '../state.js';

export function toast(message, type='success') {
  const root=document.getElementById('toastRoot');
  if(!root)return;
  for(const existing of root.children)if(existing.textContent===message)existing.remove();while(root.children.length>=2)root.firstElementChild.remove();
  const node=document.createElement('div');node.className=`toast ${type}`;node.textContent=message;root.appendChild(node);
  window.setTimeout(()=>node.remove(),3200);
}
const modalFocus=new Map();
const focusables=el=>[...el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(n=>n.getClientRects().length);
export function openModal(id){const el=document.getElementById(id);if(!el)return;if(document.getElementById('chatWindow')?.classList.contains('open'))window.toggleChat?.(false);document.querySelectorAll('.overlay.open').forEach(other=>{if(other!==el){other.classList.remove('open');window.dispatchEvent(new CustomEvent('gagion-modal-closed',{detail:{id:other.id}}));}});modalFocus.set(id,document.activeElement);el.classList.add('open');document.body.style.overflow='hidden';window.setTimeout(()=>{if(el.classList.contains('open')&&!el.contains(document.activeElement))focusables(el)[0]?.focus({preventScroll:true});},30);}
export function closeModal(id){const el=document.getElementById(id);if(!el)return;el.classList.remove('open');if(!document.querySelector('.overlay.open'))document.body.style.overflow='';modalFocus.get(id)?.focus?.({preventScroll:true});window.dispatchEvent(new CustomEvent('gagion-modal-closed',{detail:{id}}));}
export function bindGlobalUiHandlers(){
 document.querySelectorAll('.overlay').forEach(overlay=>overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal(overlay.id);}));
 document.addEventListener('keydown',e=>{const open=document.querySelector('.overlay.open');if(e.key==='Escape'){if(open)closeModal(open.id);if(document.getElementById('chatWindow')?.classList.contains('open'))window.toggleChat?.(false);}if(e.key==='Tab'&&open){const nodes=focusables(open),first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(e.shiftKey&&(document.activeElement===first||!open.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!open.contains(document.activeElement))){e.preventDefault();first.focus();}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('searchInput')?.focus();}});
 document.addEventListener('change',event=>{if(event.target.matches('input[name="flavor"]'))document.querySelectorAll('input[name="flavor"]').forEach(input=>input.closest('label')?.classList.toggle('active',input.checked));});
 document.addEventListener('error',event=>{const el=event.target;if(el.tagName==='IMG'&&el.id!=='bankQrImage'&&!el.dataset.fallback){el.dataset.fallback='1';el.src='assets/images/chicken.webp';}},true);
 const sections=[...document.querySelectorAll('.main-nav a')].map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
 const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)document.querySelectorAll('.main-nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+visible.target.id));},{rootMargin:'-120px 0px -50% 0px'});sections.forEach(el=>observer.observe(el));
}
export function scrollToDeals(){document.getElementById('dealsSection')?.scrollIntoView({behavior:'smooth'});}
export function switchView(view){
  const isStore=view==='storefront';
  document.getElementById('storefrontView')?.classList.toggle('hidden',!isStore);
  document.getElementById('adminView')?.classList.toggle('hidden',isStore);
  document.querySelector('.site-header')?.classList.toggle('hidden',!isStore);
  document.querySelector('.site-footer')?.classList.toggle('hidden',!isStore);
  document.querySelector('.promo-strip')?.classList.toggle('hidden',!isStore);
  document.getElementById('supportDock')?.classList.toggle('hidden',!isStore);
  if(document.getElementById('chatWindow')?.classList.contains('open'))window.toggleChat?.(false);
  document.querySelector('.mobile-cart-bar')?.classList.toggle('hidden',!isStore);
  if(!isStore)window.dispatchEvent(new Event('gagion-admin-refresh'));
  window.scrollTo({top:0,behavior:'smooth'});
}
export function renderVouchers(takeVoucher){
  const grid=document.getElementById('voucherGrid');if(!grid)return;
  grid.innerHTML=vouchers.map(v=>`<article class="voucher-card"><span class="voucher-type">✦ ƯU ĐÃI ONLINE</span><h3>${esc(v.title)}</h3><p>${esc(v.desc)}</p><div class="voucher-bottom"><span class="voucher-code">${esc(v.code)}</span><button onclick="takeVoucher('${esc(v.code)}')">Chọn ưu đãi →</button></div></article>`).join('');
}
export function initBranchUi(chooseBranch){
  const list=document.getElementById('branchList');if(!list)return;
  list.innerHTML=branches.map(b=>`<button class="branch-option ${state.branch===b.id?'active':''}" onclick="chooseBranch('${b.id}')"><span class="branch-pin">⌖</span><span><b>${esc(b.name)}</b><small>${esc(b.address)}</small><small>Giờ mở cửa ${esc(b.hours)}</small></span><em>${esc(b.eta)}</em></button>`).join('');
  updateBranchHeader();
}
export function updateBranchHeader(){
  const branch=getBranch();const name=document.getElementById('branchName');const hint=document.getElementById('branchHint');const label=document.getElementById('branchLabel');
  if(name)name.textContent=branch.name;if(hint)hint.textContent=state.mode==='dinein'?`Phục vụ tại ${state.table?.label||'bàn'} • ${branch.hours}`:state.mode==='delivery'?`Dự kiến ${branch.eta}`:`Đến lấy tại cửa hàng • ${branch.hours}`;if(label)label.textContent=state.mode==='delivery'?'CHI NHÁNH ĐẶT MÓN':'ĐIỂM NHẬN HÀNG';
  document.getElementById('modeDelivery')?.classList.toggle('active',state.mode==='delivery');document.getElementById('modePickup')?.classList.toggle('active',state.mode==='pickup');
  for(const [id,mode]of [['branchModeDelivery','delivery'],['branchModePickup','pickup']]){const button=document.getElementById(id);button?.classList.toggle('active',state.mode===mode);button?.setAttribute('aria-pressed',String(state.mode===mode));}
}
export function renderMemberCard(){
 const m=state.member;const name=document.getElementById('memberNameCard');const points=document.getElementById('memberPointsCard');if(name)name.textContent=m?.name?.trim()?m.name.trim().slice(0,20).toLocaleUpperCase('vi'):'JOY FAN';if(points)points.textContent=Number(m?.points||0).toLocaleString('vi-VN');
}
