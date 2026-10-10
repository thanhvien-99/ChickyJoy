import { state, persistCustomerState, MEMBER_KEY } from '../state.js';
import { esc, isValidVietnamPhone } from '../utils.js';
import { openModal, closeModal, toast, renderMemberCard } from '../components/ui.js';

const USERS_KEY = 'gagion_accounts_v1';
const SESSION_KEY = 'gagion_session_v1';
let currentUser = null;
let authMode = 'login';

function readUsers(){ try { const value=JSON.parse(localStorage.getItem(USERS_KEY)||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } }
function writeUsers(users){ localStorage.setItem(USERS_KEY,JSON.stringify(users)); }
async function hashPassword(email,password){
  const data = new TextEncoder().encode(`${String(email).trim().toLowerCase()}:${password}:gagion-account-v1`);
  const digest = await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function secureHash(password,salt){
 const bytes=salt?Uint8Array.from(salt.match(/.{2}/g),x=>parseInt(x,16)):crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:210000,hash:'SHA-256'},key,256);
 const hex=v=>Array.from(new Uint8Array(v),x=>x.toString(16).padStart(2,'0')).join('');
 return {algorithm:'PBKDF2-SHA256',iterations:210000,salt:hex(bytes),hash:hex(bits)};
}
async function verifyPassword(user,password,email){
 if(typeof user.passwordHash==='object')return (await secureHash(password,user.passwordHash.salt)).hash===user.passwordHash.hash;
 const valid=user.passwordHash===await hashPassword(email,password);
 if(valid){user.passwordHash=await secureHash(password);writeUsers(readUsers().map(u=>u.id===user.id?user:u));}
 return valid;
}
function syncMember(user){
  currentUser=user;
  state.member={id:user.id,name:user.name,phone:user.phone||'',email:user.email,points:Number(user.points)||0,createdAt:user.createdAt||new Date().toISOString()};
  persistCustomerState();
  renderMemberCard();
  renderAuthHeader();
}
export function initAuth(){
  let session=null; try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{}
  if(session?.email){const user=readUsers().find(x=>x.email===session.email);if(user)syncMember(user);}
  if(!currentUser){state.member=null;persistCustomerState();renderMemberCard();}
  renderAuthHeader();
  window.addEventListener('gagion-auth-account-updated',()=>{
    let currentSession=null;try{currentSession=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{}
    currentUser=currentSession?.email?readUsers().find(user=>user.email===currentSession.email)||null:null;
    if(currentUser)syncMember(currentUser);else {state.member=null;state.checkoutDraft={};renderMemberCard();renderAuthHeader();}
  });
}
export function renderAuthHeader(){
  const btn=document.getElementById('accountButton');
  const label=document.getElementById('accountButtonLabel');
  if(label)label.textContent=currentUser?`Xin chào, ${currentUser.name.split(/\s+/).slice(-1)[0]}`:'Đăng nhập';
  if(btn){btn.title=currentUser?`Tài khoản ${currentUser.name}`:'Đăng nhập hoặc đăng ký';btn.classList.toggle('is-authenticated',Boolean(currentUser));}
}
export function openAuth(){
  const tabs=document.getElementById('authTabs');const login=document.getElementById('authLoginForm');const register=document.getElementById('authRegisterForm');const account=document.getElementById('authAccountPanel');
  if(currentUser){tabs?.classList.add('hidden');login?.classList.add('hidden');register?.classList.add('hidden');account?.classList.remove('hidden');const name=document.getElementById('authAccountName');const email=document.getElementById('authAccountEmail');if(name)name.textContent=currentUser.name;if(email)email.textContent=currentUser.email;}
  else{account?.classList.add('hidden');tabs?.classList.remove('hidden');switchAuthMode(authMode);}
  openModal('authModal');
}
export function switchAuthMode(mode){
  authMode=mode==='register'?'register':'login';
  document.getElementById('authLoginForm')?.classList.toggle('hidden',authMode!=='login');
  document.getElementById('authRegisterForm')?.classList.toggle('hidden',authMode!=='register');
  document.getElementById('authAccountPanel')?.classList.add('hidden');
  document.getElementById('authTabs')?.classList.remove('hidden');
  document.querySelectorAll('[data-auth-mode]').forEach(button=>button.classList.toggle('active',button.dataset.authMode===authMode));
  const title=document.getElementById('authModalTitle');if(title)title.textContent=authMode==='login'?'Đăng nhập':'Tạo tài khoản';
}
export async function submitAuth(mode){
  const chosen=mode==='register'?'register':'login';
  const email=(document.getElementById(chosen==='login'?'loginEmail':'registerEmail')?.value||'').trim().toLowerCase();
  const password=document.getElementById(chosen==='login'?'loginPassword':'registerPassword')?.value||'';
  if(!/^\S+@\S+\.\S+$/.test(email)){toast('Vui lòng nhập địa chỉ email hợp lệ.','error');return;}
  if(password.length<8){toast('Mật khẩu cần có ít nhất 8 ký tự.','error');return;}
  const users=readUsers();
  try{
    if(chosen==='register'){
      const name=(document.getElementById('registerName')?.value||'').trim();
      const phone=(document.getElementById('registerPhone')?.value||'').trim();
      const confirm=document.getElementById('registerPasswordConfirm')?.value||'';
      if(name.length<2){toast('Vui lòng nhập họ tên hợp lệ.','error');return;}
      if(!isValidVietnamPhone(phone)){toast('Số điện thoại chưa đúng định dạng.','error');return;}
      if(password!==confirm){toast('Mật khẩu xác nhận không khớp.','error');return;}
      if(users.some(user=>user.email===email)){toast('Email này đã được đăng ký. Hãy đăng nhập.','error');switchAuthMode('login');return;}
      const user={id:`USR-${Date.now().toString(36).toUpperCase()}`,name,phone,email,passwordHash:await secureHash(password),points:0,createdAt:new Date().toISOString()};
      users.push(user);writeUsers(users);localStorage.setItem(SESSION_KEY,JSON.stringify({email}));syncMember(user);closeModal('authModal');toast('Tài khoản đã được tạo thành công.','success');return;
    }
    const user=users.find(item=>item.email===email);
    if(!user||!await verifyPassword(user,password,email)){toast('Email hoặc mật khẩu chưa chính xác.','error');return;}
    localStorage.setItem(SESSION_KEY,JSON.stringify({email}));syncMember(user);closeModal('authModal');toast(`Chào mừng ${user.name} quay trở lại!`,'success');
  }catch(error){console.error(error);toast('Không thể xử lý tài khoản trên trình duyệt này.','error');}
}
export function logout(){
  localStorage.removeItem(SESSION_KEY);authMode='login';currentUser=null;state.member=null;state.checkoutDraft={};localStorage.removeItem(MEMBER_KEY);renderMemberCard();renderAuthHeader();closeModal('authModal');toast('Bạn đã đăng xuất.','success');
}
