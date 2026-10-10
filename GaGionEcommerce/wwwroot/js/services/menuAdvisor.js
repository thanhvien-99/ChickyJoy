import { menu, vouchers, SHIPPING_FEE } from '../data/catalog.js';
import { money, searchText } from '../utils.js';
import { quotePromotions } from './promotions.js';

const aliases={burger:['burger'],rice:['com','mi y'],chicken:['ga'],combo:['combo'],drinks:['thuc uong','do uong','nuoc','tra','ca phe'],dessert:['kem','trang mieng','banh ngot'],sides:['an vat','an nhe','khoai','an kem']};
const words={mot:1,hai:2,ba:3,bon:4,nam:5,sau:6,bay:7,tam:8,chin:9,muoi:10};
const follow=/re hon|tiet kiem hon|con mon|lua chon khac|khong thich|khong an|doi sang|(?:them|kem) (?:nuoc|thuc uong)|ca ship|tinh ship|den lay|khong cay|ko cay|k cay|hong cay|it cay/;
export function quoteMeal(lines,{mode='delivery',firstOrder=false}={}){
 const quote=quotePromotions(lines,{mode,firstOrder});return{...quote,voucherCode:quote.voucherCodes.join(' + ')||null};
}
function budget(q){
 const matches=[...q.matchAll(/(\d+(?:[.,]\d+)*)\s*(trieu|tr\b|k\b|nghin|ngan|dong|vnd|d\b)/g)];
 if(matches.length){const m=matches[0],unit=m[2],n=/trieu|^tr$/.test(unit)?Number(m[1].replace(',','.'))*1000000:/k|nghin|ngan/.test(unit)?Number(m[1].replace(',','.'))*1000:Number(m[1].replace(/[.,]/g,''));return Number.isFinite(n)&&n>0?Math.round(n):null;}
 const raw=q.match(/\b(\d{5,7})\b/);if(raw)return Number(raw[1]);
 const m=q.match(/(?:ngan sach|duoi|toi da|khoang|tam|co)\s*(\d[\d.,]*)/);if(!m)return null;const n=Number(m[1].replace(/[.,]/g,''));return n>0?(n<1000?n*1000:n):null;
}
function parse(q,previous){
 const continuing=follow.test(q)||previous.awaiting&&q.length<100||q.length<45&&/\d.*(?:k|nguoi)|^(mot|hai|ba|bon)\b/.test(q);
 const p=continuing?{...previous,excludes:[...(previous.excludes||[])]}:{excludes:[]};
 const group=q.match(/\b(\d{1,2}|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(?:nguoi|dua|ban|suat|phan)\b/);
 if(group)p.people=words[group[1]]||Number(group[1]);
 else if(/ca gia dinh|gia dinh|hoi ban/.test(q)&&!p.people)p.awaiting='people';
 else if(/mot minh|solo/.test(q))p.people=1;
 else if(/cap doi|couple/.test(q))p.people=2;
 else if(previous.awaiting==='people'&&/^(\d{1,2}|mot|hai|ba|bon|nam|sau|tam)$/.test(q.trim()))p.people=words[q.trim()]||Number(q.trim());
 let amount=budget(q);if(!amount&&previous.awaiting==='budget'&&/^\d+(?:[.,]\d+)*$/.test(q.trim())){amount=Number(q.replace(/[.,]/g,''));if(amount<1000)amount*=1000;}if(amount)p.budget=amount;
 if(/(?:moi|tren|cho tung) nguoi/.test(q)&&amount)p.unitBudget=amount;else if(amount)p.unitBudget=null;
 if(p.unitBudget&&p.people)p.budget=p.unitBudget*p.people;
 if(/(?:khong|ko|k|hong)(?: an)? cay|it cay/.test(q))p.spicy=false;else if(/\bcay\b/.test(q))p.spicy=true;
 if(/tre em|cho be|co be|con nho/.test(q)&&p.spicy===undefined)p.spicy=false;
 const drinkAddon=/\b(?:them|kem) (?:nuoc|thuc uong)\b/.test(q)&&! /\b(?:khong|ko|hong|k) (?:them|kem) (?:nuoc|thuc uong)\b/.test(q);
 if(drinkAddon)p.withDrink=true;
 for(const [cat,terms]of Object.entries(aliases)){
  if(cat==='drinks'&&drinkAddon)continue;
  const excluded=terms.some(t=>new RegExp('(?:khong|ko|hong)(?: thich| an| muon| lay| kem| them)? '+t+'\\b').test(q));
  if(excluded){p.excludes=[...new Set([...p.excludes,cat])];if(p.category===cat)p.category=null;}
  else if(terms.some(t=>!(cat==='dessert'&&t==='kem'&&drinkAddon)&&new RegExp('\\b'+t+'\\b').test(q))&&!p.excludes.includes(cat))p.category=cat;
 }
 if(/den lay|tu lay|tai quay/.test(q))p.mode='pickup';else if(/giao|ship/.test(q))p.mode='delivery';
 p.includeShipping=!/chua ship|khong tinh (?:phi )?ship|chi tien mon/.test(q);
 if(/re hon|tiet kiem hon/.test(q)&&previous.lowestTotal)p.cheaperThan=previous.lowestTotal;
 if(/lua chon khac|con mon nao|con gi khac/.test(q))p.skipIds=previous.suggestedIds||[];
 if(p.excludes.includes('drinks'))p.withDrink=false;
 return p;
}
export function matchesMealPreference(p,pref){
 if(pref.spicy!==undefined&&p.spicy!==pref.spicy)return false;
 const text=searchText(p.name+' '+p.desc);
 if(pref.spicy===false&&/khong qua cay|cay nhe|hoi cay/.test(text))return false;
 if(pref.excludes?.some(cat=>cat===p.cat||aliases[cat]?.some(t=>new RegExp('\\b'+t+'\\b').test(text))))return false;
 if(pref.skipIds?.includes(p.id))return false;
 if(pref.category&&pref.category!=='combo'&&pref.category!==p.cat){
  const terms=aliases[pref.category];if(!terms?.some(t=>new RegExp('\\b'+t+'\\b').test(text)))return false;
 }
 return true;
}
export function isAdviceQuestion(prompt,previous={}){
 const q=searchText(prompt);
 return /goi y|tu van|chon mon|an gi|nen an|ngan sach|combo|burger|\bcom\b|\bga\b|do uong|thuc uong|trang mieng|\d+\s*(k|nghin|ngan|nguoi)|so sanh/.test(q)||follow.test(q)&&previous.people||previous.awaiting&&q.length<100;
}
export function adviseMenu(prompt,previous={},context={}){
 const q=searchText(prompt),pref=parse(q,previous),available=menu.filter(p=>!context.soldOut?.includes(p.id));
 if(/di ung|khong dung nap/.test(q))return {text:'Mô tả thực đơn chưa đủ để xác nhận món an toàn với dị ứng. Bạn vui lòng hỏi nhà hàng qua Zalo về nguyên liệu và việc dùng chung dụng cụ trước khi đặt. Tôi có thể hỗ trợ lọc món theo sở thích sau khi bạn đã xác nhận.',preferences:pref,actions:[]};
 const named=available.filter(p=>q.includes(searchText(p.name))||(p.name.startsWith('Combo ')&&q.includes(searchText(p.name.replace(/^Combo /,'')))));
 if((/so sanh|khac nhau|hay|va/.test(q)||previous.comparisonId)&&named.length){
  const pair=[...new Map([...named,...(previous.comparisonId?[available.find(p=>p.id===previous.comparisonId)]:[])].filter(Boolean).map(p=>[p.id,p])).values()].slice(0,2);
  if(pair.length===2){const[a,b]=pair;return{text:`${a.name}: ${money(a.price)}. ${a.desc}\n${b.name}: ${money(b.price)}. ${b.desc}\n\n${a.price===b.price?'Hai món cùng mức giá.':(a.price<b.price?a.name:b.name)+' rẻ hơn '+money(Math.abs(a.price-b.price))+'.'} Đây là giá món, chưa tính phí giao và mã giảm.`,products:pair.map(p=>p.id),preferences:{...pref,comparisonId:null},actions:['menu']};}
  if(/so sanh/.test(q))return{text:'Bạn muốn so sánh '+pair[0].name+' với món nào?',preferences:{...pref,comparisonId:pair[0].id},products:[pair[0].id]};
 }
 if(pref.people>20)return{text:'Đơn cho hơn 20 người nên trao đổi với nhà hàng về khẩu phần và thời gian chuẩn bị. Bạn có thể gửi yêu cầu đặt tiệc hoặc liên hệ Zalo.',preferences:pref,actions:['party']};
 const light=['drinks','dessert','sides'].includes(pref.category);
 if(!pref.people&&!light)return{text:pref.budget?'Ngân sách '+money(pref.budget)+' là cho mấy người? Tôi sẽ tính cả phí giao và mã giảm phù hợp.':'Bạn ăn mấy người và muốn chi khoảng bao nhiêu? Nếu có món không thích hoặc không ăn cay, bạn có thể nói luôn để tôi lọc.',preferences:{...pref,awaiting:'people'},chips:[{label:'1 người · 100k',prompt:'1 người ngân sách 100k'},{label:'2 người · 150k',prompt:'2 người ngân sách 150k'},{label:'4 người · 300k',prompt:'4 người ngân sách 300k'}]};
 if(!pref.budget&&!light)return{text:'Bạn muốn chi khoảng bao nhiêu cho '+pref.people+' người? Ngân sách có thể gồm cả phí giao; tôi sẽ so sánh combo với món lẻ.',preferences:{...pref,awaiting:'budget'},chips:[{label:'150k',prompt:'Ngân sách 150k'},{label:'250k',prompt:'Ngân sách 250k'},{label:'400k',prompt:'Ngân sách 400k'}]};
 pref.awaiting=null;const people=Math.max(1,pref.people||1),mode=pref.mode||context.mode||'delivery',pool=available.filter(p=>matchesMealPreference(p,pref));
 const raw=[];
 const add=(lines,title,description,kind='single')=>{const price=quoteMeal(lines,{mode});raw.push({lines,title,description,kind,mode,...price});};
 if(light){let choices=pool.filter(p=>p.cat===pref.category);if(/it ngot|khong duong|khong ngot|zero/.test(q))choices=choices.filter(p=>/khong duong|khong calo|nuoc suoi/.test(searchText(p.name+' '+p.desc)));for(const p of choices)add([{id:p.id,qty:people}],p.name,p.desc);}
 else{
  if(!pref.excludes?.includes('combo'))for(const p of pool.filter(p=>p.cat==='combo')){const servings=p.serves||1,qty=Math.ceil(people/servings);if(qty>20||servings*qty>people+1)continue;add([{id:p.id,qty}],(qty>1?qty+' × ':'')+p.name,p.desc+(qty>1?' · '+qty+' combo cùng loại.':''),'combo');}
  if(pref.category!=='combo')for(const p of pool.filter(p=>['burger','rice','chicken'].includes(p.cat))){const lines=[{id:p.id,qty:people}];if(pref.withDrink){const drink=available.find(p=>p.id===48);if(!drink)continue;lines.push({id:drink.id,qty:people});}add(lines,people+' phần '+p.name,p.desc+(pref.withDrink?' · Kèm '+people+' nước suối.':' · Chưa kèm thức uống.'),'separate');}
 }
 const within=raw.filter(p=>(!pref.budget||(pref.includeShipping?p.total:p.total-p.shipping)<=pref.budget)&&(!pref.cheaperThan||p.total<pref.cheaperThan)).sort((a,b)=>a.total-b.total);
 if(!within.length){const cheapest=raw.sort((a,b)=>a.total-b.total)[0];return{text:cheapest?'Chưa có lựa chọn khớp tất cả yêu cầu trong ngân sách này. Phương án thấp nhất hiện là '+cheapest.title+', tổng '+money(cheapest.total)+(mode==='delivery'?' đã gồm phí giao.':'.')+' Bạn có thể tăng ngân sách, chuyển sang đến lấy hoặc bỏ bớt điều kiện.':'Chưa có món đang bán phù hợp các điều kiện đó. Bạn muốn đổi loại món hoặc nới một điều kiện nào?',preferences:{...pref,cheaperThan:null},chips:[{label:'Đổi ngân sách',prompt:'Gợi ý lại '+people+' người ngân sách '+Math.max(pref.budget||0,cheapest?.total||100000)+' đồng'},{label:'Đến lấy',prompt:'Đổi sang đến lấy, '+people+' người, ngân sách '+(pref.budget||100000)+' đồng'}],actions:['menu']};}
 const selected=[],take=p=>{if(p&&!selected.some(x=>JSON.stringify(x.lines)===JSON.stringify(p.lines)))selected.push(p);};
 take(within[0]);take(within.find(p=>p.kind==='combo'));take(within.find(p=>p.kind==='separate'));for(const p of within)if(selected.length<3)take(p);
 const plans=selected.slice(0,3).map((p,i)=>({...p,badge:i===0?'Tiết kiệm nhất':p.kind==='combo'?'Combo tiện chọn':'Thêm lựa chọn'}));
 const taste=pref.spicy===false?', không cay':pref.spicy?', có vị cay':'';
 const text=`Tôi chọn ${plans.length} phương án cho ${people} người${taste}${pref.budget?', ngân sách '+money(pref.budget):''}. ${mode==='delivery'?'Tổng bên dưới đã tính phí giao '+money(SHIPPING_FEE)+'.':mode==='dinein'?'Phục vụ tại bàn không tính phí giao.':'Đến lấy tại quầy không tính phí giao.'} Mỗi phương án chọn tối đa một ưu đãi món cùng một ưu đãi giao hàng đủ điều kiện; chưa tính món thêm. Bấm “Xem & chọn” để kiểm tra trước khi thêm vào giỏ.`;
 return{text,plans,preferences:{...pref,cheaperThan:null,lowestTotal:plans[0].total,suggestedIds:plans.flatMap(p=>p.lines.map(i=>i.id))},chips:[{label:'Rẻ hơn',prompt:'Có phương án rẻ hơn không?'},{label:'Không ăn cơm',prompt:'Tôi không ăn cơm, gợi ý lại'},{label:'Thêm thức uống',prompt:'Thêm nước vào gợi ý'}]};
}
