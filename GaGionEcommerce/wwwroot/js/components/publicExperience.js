import { openModal, closeModal, toast } from './ui.js';
import { informationTopics, storeInformation } from '../data/storeInfo.js';
import { contact } from '../data/siteConfig.js';

function localDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const motion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';

export function scrollToSection(id){
  const target=document.getElementById(id);if(!target)return;
  const offset=(document.querySelector('.site-header')?.getBoundingClientRect().height||0)+20;
  window.scrollTo({top:scrollY+target.getBoundingClientRect().top-offset,behavior:motion()});
}
export function openSiteMenu(){openModal('siteMenuModal');document.getElementById('menuToggle')?.setAttribute('aria-expanded','true');}
export function drawerNavigate(type,value,group){
  closeModal('siteMenuModal');
  if(type==='category'){
    window.clearCatalogFilters();window.setCategory(value);
    if(group)window.setComboGroup(group);
    scrollToSection('menuSection');
  }else if(type==='new'){
    window.clearCatalogFilters();window.setDiscoveryFilter('new');scrollToSection('menuSection');
  }else if(type==='section')scrollToSection(value);
  else if(type==='history')window.openOrderHistory();
  else if(type==='party')window.openPartyBooking();
  else if(type==='chat')window.toggleChat(true);
  else if(type==='info')openInfoPage(value);
}
export function openInfoPage(page){openInfoTab(page);openModal('infoModal');}
export function openInfoTab(page){
 document.querySelector('#infoModal .modal').classList.toggle('about-fullscreen',page==='about');
 const info=storeInformation(page);document.getElementById('infoTitle').textContent=info.title;document.getElementById('infoContent').innerHTML=info.body;
 const nav=document.getElementById('infoTabs');nav.innerHTML=informationTopics.map(([id,label])=>`<button type="button" class="${id===page?'active':''}" aria-pressed="${id===page}" data-topic="${id}">${label}</button>`).join('');
 nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>openInfoTab(button.dataset.topic)));
 document.querySelector('#infoModal .modal-body').scrollTop=0;
}
export function welcomeAction(action){closeModal('welcomeModal');if(action==='deals')scrollToSection('dealsSection');else{window.clearCatalogFilters();scrollToSection('menuSection');}}
export function copyWelcomeCode(){window.takeVoucher('WELCOME10');closeModal('welcomeModal');scrollToSection('menuSection');}


export function initPublicExperience(){
  document.querySelectorAll('.zalo-contact').forEach(link=>{link.href=contact.zaloUrl;link.target='_blank';link.rel='noopener noreferrer';});
  window.addEventListener('gagion-modal-closed',event=>{
    if(event.detail?.id==='siteMenuModal')document.getElementById('menuToggle')?.setAttribute('aria-expanded','false');
    if(event.detail?.id==='welcomeModal'&&document.getElementById('welcomeDontShow')?.checked){try{localStorage.setItem('gagion_welcome_hide_day_v9',localDay());}catch{}}
  });
  if(location.pathname.replace(/\/$/,'')==='/staff'||new URLSearchParams(location.search).has('table'))return;
  let seen=false;try{seen=sessionStorage.getItem('gagion_welcome_seen_v9')===localDay()||localStorage.getItem('gagion_welcome_hide_day_v9')===localDay();}catch{}
  if(!seen&&!location.hash)window.setTimeout(()=>{
    if(document.querySelector('.overlay.open')||document.getElementById('chatWindow')?.classList.contains('open'))return;
    try{sessionStorage.setItem('gagion_welcome_seen_v9',localDay());}catch{}
    openModal('welcomeModal');
  },450);
}
