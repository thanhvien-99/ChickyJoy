import { menu, branches, storeBrand } from '../data/catalog.js';
import { contact } from '../data/siteConfig.js';
import { money, searchText } from '../utils.js';

// Answers from the actual catalog when the language model is disconnected.
// This supports store facts and references; it does not simulate a language model.
const normalize=s=>searchText(s).replace(/phomai/g,'pho mai').replace(/com bo/g,'combo').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const categoryTerms={chicken:/\bga ran\b|\bga gion\b|\bga\b/,burger:/burger/,rice:/\bcom\b|mi y/,sides:/khoai|salad|mon kem|mon phu/,drinks:/nuoc|thuc uong|do uong|\btra\b/,dessert:/trang mieng|\bkem\b/,combo:/combo/};
const stop=new Set('toi minh ban anh chi em cho cua co la va hay voi mon gia gom bao nhieu tien nao gi cay khong khongcay mot hai ba phan an muon xem hoi thi nay do duoc ne a nhe nha them'.split(' '));
const tokens=s=>normalize(s).split(' ').filter(t=>t.length>1&&!stop.has(t));
const ordinal=value=>Number(value)||({mot:1,hai:2,ba:3,bon:4,dau:1,'dau tien':1})[value];
function closeToken(a,b){
 if(a===b)return true;if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,diff=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++diff>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return diff+a.length-i+b.length-j<=1;
}
function namedProducts(q){
 const qt=tokens(q);
 const ranked=menu.map(p=>{const name=normalize(p.name),pt=tokens(name),exact=q.includes(name)||name.startsWith('combo ')&&q.includes(name.slice(6));const hits=pt.filter(t=>qt.some(w=>closeToken(w,t))).length;return {p,score:exact?100+pt.length:hits>=2&&hits/pt.length>=.5?hits/pt.length:0};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.p.popular-a.p.popular);
 const top=ranked[0]?.score||0;return ranked.filter(x=>top>=100?x.score>=100:x.score===top).map(x=>x.p).slice(0,4);
}
function branchMatch(q){
 const rules={q5:/\bq\s*5\b|quan\s*5|an duong vuong/,q1:/\bq\s*1\b|quan\s*1|nguyen thi minh khai/,bt:/binh thanh|xo viet nghe tinh/,td:/thu duc|vo van ngan/};
 return branches.find(b=>rules[b.id]?.test(q));
}
function reference(q,ids){
 const m=q.match(/(?:mon|cai|combo|phan|lua chon)(?: thu)?\s*(1|2|3|4|mot|hai|ba|bon|dau(?: tien)?)/);
 if(m){const n=ordinal(m[1]);return ids[n-1]?[ids[n-1]]:[];}
 return /mon do|cai do|combo do|phan do|mon nay|loai do/.test(q)?ids.slice(0,1):[];
}
const describe=(p,soldOut=[])=>`**${p.name}** — ${money(p.price)} tiền món${soldOut.includes(p.id)?' · hiện hết món':''}. ${p.desc}${p.serves?' Khẩu phần tham khảo: '+p.serves+' người.':''}`;
export function rememberStoreFocus(prompt,productIds,memory={}){
 const branch=branchMatch(normalize(prompt)),ids=(productIds||[]).filter(id=>menu.some(p=>p.id===id));
 return {...memory,...(branch?{branchId:branch.id,topic:'branch'}:{}),...(ids.length?{productIds:ids.slice(0,6),topic:'products'}:{})};
}
export function consultStore(prompt,context={}){
 const q=normalize(prompt),old=context.memory||{},available=menu.filter(p=>!context.soldOut?.includes(p.id));
 if(/di ung|khong dung nap|an chay|gluten|calo|calorie|dinh duong|co sua|co trung|co dau phong/.test(q))return {text:'Thực đơn chỉ có mô tả thành phần chính, chưa đủ thông tin để xác nhận dị ứng, ăn chay hoặc giá trị dinh dưỡng. Bạn nên hỏi nhà hàng qua Zalo trước khi đặt; tôi không thể bảo đảm an toàn chỉ từ mô tả món.',actions:['contact']};
 if(/gan (?:toi|minh|day|nhat)|gan nha/.test(q)&&!branchMatch(q))return {text:'Tôi chưa có vị trí của bạn để xác định nhà hàng gần nhất. Bạn đang ở quận hoặc khu vực nào? Tôi có thể đối chiếu với các địa chỉ đang có trên website.',actions:['branch']};
 const current=branches.find(b=>b.id===context.branchId)||branches[0],explicit=branchMatch(q),remembered=branches.find(b=>b.id===old.branchId);
 const parts=[],actions=[],products=[],chips=[];let topic=old.topic,focus=old.productIds||[];
 const identity=/ten (?:quan|shop|cua hang|thuong hieu)|(?:quan|shop|cua hang).{0,12}ten|ban la ai|thuong hieu|gioi thieu|ve chickyjoy|ve ga gion|slogan|thong diep/.test(q);
 const where=/dia chi|o dau|nam dau|cho nao|duong nao|chi nhanh|co so|dia diem|den quan|toi quan/.test(q)||!!explicit;
 const hours=/\b(?:mo cua|dong cua|gio hoat dong|gio phuc vu|may gio|mo den|ban den|con mo|con ban)\b/.test(q)&&!/(giao|ship).{0,10}may gio/.test(q);
 const branch=explicit||(/cho do|o do|chi nhanh do|nha hang do/.test(q)||hours&&old.topic==='branch'?remembered:null)||current;
 const reach=/zalo|hotline|so dien thoai|sdt|lien he|nhan vien|nguoi that/.test(q);
 const popular=/best\s*sell(?:er)?|ban chay|hot nhat|mon hot|nhieu nguoi chon|pho bien|dac trung|chu luc|signature|must try/.test(q);
 const inventory=/ban gi|co gi|thuc don|\bmenu\b|nhung mon nao|co nhung mon|mon an nao/.test(q);
 const details=/gia|bao nhieu|gom|thanh phan|cay|so sanh|khac nhau|voi|\bvs\b|du cho|may nguoi/.test(q);
 let named=namedProducts(q);const ref=reference(q,focus);if(!named.length&&ref.length)named=ref.map(id=>menu.find(p=>p.id===id)).filter(Boolean);
 if(identity){parts.push(`Quán tên **${storeBrand.name}**, thương hiệu thức ăn nhanh với thông điệp **“${storeBrand.slogan}”**. ${storeBrand.description} Thực đơn còn có burger, cơm, mì Ý, món kèm và thức uống.`);topic='brand';}
 if(where||hours){
  const all=/tat ca|bao nhieu|nhung chi nhanh|danh sach|cac chi nhanh/.test(q)&&!explicit;
  const targets=all?branches:[branch];
  parts.push(targets.map(b=>`**${b.name}**${where?' — '+b.address:''}. Giờ phục vụ: ${b.hours}.`).join('\n')+(all?'':`\n${explicit||remembered?'':'Đây là nhà hàng đang được chọn trên website. '}Bạn có thể mở danh sách để chọn điểm nhận phù hợp.`));
  topic='branch';actions.push('branch');
 }
 if(reach){parts.push(`Bạn có thể liên hệ ChickyJoy qua **Zalo ${contact.zaloPhone}** bằng liên kết dưới khung chat. Nếu cần hỗ trợ đơn, gửi kèm mã đơn để nhà hàng kiểm tra.`);actions.push('contact');topic='contact';}
 if(popular){
  const category=Object.keys(categoryTerms).find(c=>categoryTerms[c].test(q)),noSpicy=/khong cay|ko cay|k cay|it cay/.test(q);
  const pool=available.filter(p=>(!category||p.cat===category)&&(!noSpicy||!p.spicy&&!/cay nhe|khong qua cay/.test(normalize(p.desc))));
  const selected=[...pool].sort((a,b)=>(normalize(b.tag).includes('ban chay')?1000:0)+b.popular-((normalize(a.tag).includes('ban chay')?1000:0)+a.popular)).slice(0,3);
  if(selected.length){parts.push('Các món nổi bật bạn có thể thử:\n'+selected.map(p=>describe(p)).join('\n')+'\nĐây là gợi ý từ danh mục hiện tại; website chưa có thống kê doanh số thực.');products.push(...selected.map(p=>p.id));focus=selected.map(p=>p.id);topic='products';chips.push({label:'Món đầu có cay không?',prompt:'Món đầu tiên có cay không?'},{label:'So sánh hai món',prompt:'So sánh món thứ 1 và món thứ 2'});}
  else parts.push('Hiện chưa có món còn bán khớp điều kiện này. Bạn muốn đổi loại món hay khẩu vị?');
 }else if(named.length&&(details||ref.length||!inventory)){
  if(/so sanh|khac nhau|\bvs\b/.test(q)&&ref.length&&focus.length>=2){const refs=[...q.matchAll(/(?:mon|cai|combo|phan)(?: thu)?\s*(\d|mot|hai|ba)|\bthu\s*(\d|mot|hai|ba)/g)].map(m=>focus[ordinal(m[1]||m[2])-1]);named=[...new Set(refs)].map(id=>menu.find(p=>p.id===id)).filter(Boolean);}
  const selected=named.slice(0,/so sanh|khac nhau|\bvs\b/.test(q)?2:3);
  parts.push(selected.map(p=>describe(p,context.soldOut)).join('\n')+'\n'+selected.map(p=>`${p.name}: ${p.spicy?'có cay':'được đánh dấu không cay'} trong thực đơn.`).join(' '));
  if(selected.length===2&&/so sanh|khac nhau|\bvs\b/.test(q)){const [a,b]=selected;parts.push(a.price===b.price?'Hai món cùng giá.':`${a.price<b.price?a.name:b.name} rẻ hơn ${money(Math.abs(a.price-b.price))} tiền món.`);}
  if(/du cho|may nguoi/.test(q)&&selected.some(p=>!p.serves))parts.push('Món lẻ chưa có khẩu phần theo người trong dữ liệu; không thể bảo đảm đủ cho cả nhóm chỉ từ tên món.');
  products.push(...selected.filter(p=>available.includes(p)).map(p=>p.id));focus=selected.map(p=>p.id);topic='products';
 }else if(inventory){
  const category=Object.keys(categoryTerms).find(c=>categoryTerms[c].test(q)),pool=category?available.filter(p=>p.cat===category):available;
  const selected=[...pool].sort((a,b)=>b.popular-a.popular).slice(0,3);
  parts.push(`ChickyJoy có ${menu.length} món trong thực đơn: gà rán, combo, burger, cơm và mì Ý, món kèm, thức uống, tráng miệng.\n`+selected.map(p=>describe(p)).join('\n'));
  products.push(...selected.map(p=>p.id));focus=selected.map(p=>p.id);topic='products';actions.push('menu');
 }
 if(!parts.length)return null;
 if(products.length)parts.push('Giá trên là tiền món; phí giao và mã giảm được tính trong giỏ trước khi xác nhận.');
 return {text:parts.join('\n\n'),products:[...new Set(products)].slice(0,6),actions:[...new Set(actions)],chips,
  sellerMemory:{topic,productIds:focus.slice(0,6),branchId:explicit?.id||(where||hours?branch.id:old.branchId)}};
}
