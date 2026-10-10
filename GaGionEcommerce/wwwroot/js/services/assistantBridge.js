import { menu } from '../data/catalog.js';
import { quoteMeal, matchesMealPreference } from './menuAdvisor.js';
import { searchText } from '../utils.js';

const categories=['combo','chicken','burger','rice','sides','drinks','dessert'];
const actionIds=['menu','deals','history','currentOrder','branch','party','receiving','cancellation','contact'];
const bounded=(value,max)=>Number.isInteger(value)&&value>=1&&value<=max?value:null;
export function normalizePreferences(p){
 if(!p||typeof p!=='object')return null;
 return {people:bounded(p.people,1000),budget:bounded(p.budget,100000000),spicy:typeof p.spicy==='boolean'?p.spicy:undefined,
  category:categories.includes(p.category)?p.category:null,excludes:Array.isArray(p.excludes)?[...new Set(p.excludes.filter(c=>categories.includes(c)))]:[],
  mode:['pickup','delivery','dinein'].includes(p.mode)?p.mode:null,withDrink:p.withDrink===true,includeShipping:p.includeShipping!==false};
}
export function serializePreferences(p){const n=normalizePreferences(p);return n?{...n,spicy:n.spicy??null}:null;}
function drinkCount(product){
 if(product.cat==='drinks')return 1;
 if(product.cat!=='combo')return 0;
 const text=searchText(product.desc),n=text.match(/(\d+)\s*(?:nuoc|thuc uong|tra\b)/);
 return n?Number(n[1]):/nuoc|thuc uong|\btra\b/.test(text)?1:0;
}
export function validateMealPlan(raw,pref={},context={}){
 if(!raw||typeof raw.title!=='string'||!raw.title.trim()||!Array.isArray(raw.lines)||raw.lines.length<1||raw.lines.length>8||!['pickup','delivery','dinein'].includes(raw.mode))return {error:'Phương án chưa có đủ thông tin để đặt.'};
 const merged=new Map();
 for(const line of raw.lines){
  const p=menu.find(p=>p.id===line?.id);
  if(!p||!bounded(line?.qty,20)||context.soldOut?.includes(p.id))return {error:'Có món không còn bán hoặc số lượng không hợp lệ.'};
  const auxiliary=['drinks','sides','dessert'].includes(p.cat);
  if(!matchesMealPreference(p,auxiliary?{...pref,spicy:undefined,category:null}:pref))return {error:'Có món chưa khớp khẩu vị hoặc điều kiện đã chọn.'};
  merged.set(line.id,(merged.get(line.id)||0)+line.qty);
 }
 const lines=[...merged].map(([id,qty])=>({id,qty}));
 if(lines.some(i=>i.qty>20))return {error:'Tối đa 20 phần cho mỗi món.'};
 const light=['drinks','sides','dessert'].includes(pref.category),primary=lines.reduce((s,i)=>{const p=menu.find(p=>p.id===i.id);return s+(['combo','burger','rice','chicken'].includes(p.cat)?i.qty*(p.serves||1):0);},0);
 if(!light&&(primary<Math.max(1,pref.people||1)||pref.people>20))return {error:'Phần món chính chưa đủ theo số người; vui lòng điều chỉnh phương án.'};
 if(pref.withDrink&&lines.reduce((s,i)=>s+drinkCount(menu.find(p=>p.id===i.id))*i.qty,0)<Math.max(1,pref.people||1))return {error:'Chưa đủ thức uống kèm theo yêu cầu.'};
 const quote=quoteMeal(lines,{mode:raw.mode}),budgetTotal=pref.includeShipping===false?quote.total-quote.shipping:quote.total;
 if(pref.mode&&pref.mode!==raw.mode)return {error:'Cách nhận món chưa khớp lựa chọn của bạn.'};
 if(pref.budget&&budgetTotal>pref.budget)return {error:'Phương án vượt ngân sách sau khi tính lại giá và phí.'};
 return {plan:{title:raw.title.trim().slice(0,100),description:String(raw.description||'').slice(0,400),mode:raw.mode,lines,...quote,badge:'AI đề xuất · giá đã kiểm tra'}};
}
export function normalizeAiAnswer(payload,context={}){
 if(typeof payload?.reply!=='string'||!payload.reply.trim())throw Error('invalid_answer');
 const proposed=Array.isArray(payload.plans)?payload.plans:[];
 const pref=normalizePreferences(payload.preferences)||(proposed.length?normalizePreferences(context.preferences):null),plans=[],rejected=[];
 for(const raw of proposed.slice(0,3)){
  const result=validateMealPlan(raw,pref||{},context);if(result.plan)plans.push(result.plan);else rejected.push(result.error);
 }
 const products=(Array.isArray(payload.products)?payload.products:[]).filter(id=>menu.some(p=>p.id===id)&&!context.soldOut?.includes(id)).slice(0,6);
 const actions=(Array.isArray(payload.actions)?payload.actions:[]).filter(id=>actionIds.includes(id)).slice(0,4);
 const suggestions=(Array.isArray(payload.suggestions)?payload.suggestions:[]).filter(s=>typeof s==='string'&&s.trim()&&s.length<=120).slice(0,3);
 return {text:payload.reply.trim().slice(0,6000),preferences:pref,plans,products,actions,sources:payload.sources,
  validationNote:rejected.length?'Chưa hiển thị '+rejected.length+' phương án: '+[...new Set(rejected)].join(' '):'',
  chips:suggestions.map(prompt=>({label:prompt,prompt})),origin:'ai'};
}
export function buildChatContext({branch,mode,soldOut,cart,orders},preferences,lastPlans){
 return {branchId:branch,mode,soldOut:soldOut.slice(0,72),preferences:serializePreferences(preferences),
  cart:cart.slice(0,72).map(i=>({id:i.productId,qty:i.qty})),
  lastPlans:(lastPlans||[]).slice(0,3).map(p=>({title:String(p.title).slice(0,100),description:String(p.description||'').slice(0,400),mode:p.mode,lines:p.lines.map(i=>({id:i.id,qty:i.qty}))})),
  orderSummaries:orders.slice(0,3).map(o=>({id:o.id,status:o.status,payment:o.payment,mode:o.mode,cancellation:o.cancellation?.status||null}))};
}
