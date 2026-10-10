export const money = value => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value)||0);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = prefix => `${prefix||'GG'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
export const normalizePhone = value => String(value||'').replace(/[ .-]/g,'').replace(/^\+84/,'0');
export const searchText = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
export const csvCell = value => { let s=String(value??''); if(/^[=+@-]/.test(s))s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
export const todayKey = () => new Date().toLocaleDateString('en-CA');
export const formatDateTime = value => { try{return new Date(value).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'});}catch{return '—';} };
export const isValidVietnamPhone = value => /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(String(value||'').replace(/[ .-]/g,''));
