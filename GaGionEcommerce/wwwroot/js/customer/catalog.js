import { categories, menu } from '../data/catalog.js';
import { buildMenuCollections } from '../data/collections.js';
import { state } from '../state.js';
import { esc, money, searchText } from '../utils.js';
import { toast } from '../components/ui.js';

const categoryLabels=Object.fromEntries(categories.map(([id,label])=>[id,label]));
let collectionResizeObserver;
const scrollBehavior=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';

function categoryCount(id){return id==='all'?menu.filter(p=>!state.soldOut.includes(p.id)).length:menu.filter(p=>p.cat===id&&!state.soldOut.includes(p.id)).length;}
export function renderCategories(){
 const bar=document.getElementById('categoryBar');if(!bar)return;
 bar.innerHTML=categories.map(([id,label,icon])=>`<button class="category ${state.category===id?'active':''}" onclick="setCategory('${id}')"><span class="cat-icon">${icon}</span>${esc(label)}<span class="cat-count">${categoryCount(id)}</span></button>`).join('');
}
export function applyCatalogFilters(){
 state.query=(document.getElementById('searchInput')?.value||'').trim();
 state.sort=document.getElementById('sortSelect')?.value||'popular';
 const spicy=Boolean(document.getElementById('spicyOnly')?.checked);
 let list=menu.filter(p=>!state.soldOut.includes(p.id));
 if(state.category!=='all')list=list.filter(p=>p.cat===state.category);
 if(state.onlyFavorites)list=list.filter(p=>state.favorites.includes(p.id));
 if(state.discoveryFilter==='new')list=list.filter(p=>p.tag.includes('MỚI'));
 if(spicy)list=list.filter(p=>p.spicy);
 if(state.query)list=list.filter(p=>searchText(p.name+' '+p.desc+' '+p.tag+' '+p.cat).includes(searchText(state.query)));
 if(state.category==='combo'&&state.comboGroup!=='all')list=list.filter(p=>p.group===state.comboGroup);
 renderComboGroups();
 if(state.sort==='priceAsc')list.sort((a,b)=>a.price-b.price);
 if(state.sort==='priceDesc')list.sort((a,b)=>b.price-a.price);
 if(state.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
 if(state.sort==='popular')list.sort((a,b)=>b.popular-a.popular);
 const count=document.getElementById('resultCount');if(count)count.textContent=`${list.length} món`;
 const grouped=state.category==='all'&&state.discoveryFilter!=='new'&&!state.query&&!spicy&&!state.onlyFavorites&&state.sort==='popular';
 const hint=document.getElementById('resultHint');if(hint)hint.textContent=state.onlyFavorites?' — món yêu thích của bạn':state.discoveryFilter==='new'?' — món mới trong thực đơn':grouped?' — chọn theo nhu cầu của bạn':' — tươi ngon, sẵn sàng lên đơn';
 renderProducts(list,grouped);
}
export function setDiscoveryFilter(filter){state.discoveryFilter=filter;applyCatalogFilters();}
export function setCategory(category){state.discoveryFilter='all';state.category=category;state.comboGroup='all';renderCategories();applyCatalogFilters();}
export function clearCatalogFilters(){state.discoveryFilter='all';state.category='all';state.comboGroup='all';state.onlyFavorites=false;const search=document.getElementById('searchInput');if(search)search.value='';const spicy=document.getElementById('spicyOnly');if(spicy)spicy.checked=false;const sort=document.getElementById('sortSelect');if(sort)sort.value='popular';document.getElementById('favoritesButton').textContent='♡ Món yêu thích';renderCategories();applyCatalogFilters();}
export function showFavorites(){state.discoveryFilter='all';state.onlyFavorites=!state.onlyFavorites;document.getElementById('favoritesButton').textContent=state.onlyFavorites?'♥ Đang xem yêu thích':'♡ Món yêu thích';state.category='all';renderCategories();applyCatalogFilters();document.getElementById('menuSection').scrollIntoView({behavior:'smooth',block:'start'});}
function productMarkup(p,heading='h3'){
 const fav=state.favorites.includes(p.id);const hot=p.popular>=85;
 return `<article class="product-card" data-product-id="${p.id}"><button type="button" class="product-open" onclick="openCustomize(${p.id})" aria-label="Xem và chọn ${esc(p.name)}"></button><div class="product-media"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/images/chicken.webp'"><span class="product-tag ${hot?'hot':''}">${esc(p.tag)}</span><button class="favorite-btn ${fav?'active':''}" onclick="toggleFavorite(${p.id})" aria-pressed="${fav}" aria-label="${fav?'Bỏ yêu thích':'Thêm yêu thích'} ${esc(p.name)}">${fav?'♥':'♡'}</button></div><div class="product-body"><span class="product-category">${esc(categoryLabels[p.cat]||p.cat)} ${p.spicy?' · 🌶️ Cay':''}</span><${heading} class="product-name">${esc(p.name)}</${heading}><p class="product-desc">${esc(p.desc)}</p><div class="product-meta"><span class="stars">✦</span><span>${p.popular>=80?'Nhiều người chọn':'Gợi ý từ thực đơn'}</span></div><div class="product-footer"><span class="product-price">${money(p.price)}</span><button class="add-btn" onclick="openCustomize(${p.id})">+ Chọn món</button></div></div></article>`;
}
export function renderProducts(list,grouped=false){
 const grid=document.getElementById('productGrid');const collections=document.getElementById('allMenuCollections');if(!grid)return;
 collectionResizeObserver?.disconnect();
 if(grouped&&list.length&&collections){
   const positions=new Map([...collections.querySelectorAll('.product-rail')].map(rail=>[rail.id,rail.scrollLeft]));
   grid.innerHTML='';grid.classList.add('hidden');collections.classList.remove('hidden');
   renderCollections(collections,buildMenuCollections(list),positions);return;
 }
 if(collections){collections.innerHTML='';collections.classList.add('hidden');}
 grid.classList.remove('hidden');
 if(!list.length){grid.innerHTML=`<div class="empty-state"><b>Chưa tìm thấy món phù hợp</b>Thử đổi từ khóa, bỏ bộ lọc hoặc chọn danh mục khác.<br><button class="outline-btn" style="margin-top:12px" onclick="clearCatalogFilters()">Xóa bộ lọc</button></div>`;return;}
 grid.innerHTML=list.map(p=>productMarkup(p)).join('');
}
function renderCollections(root,groups,positions){
 root.innerHTML=`<div class="collection-intro"><span class="collection-eyebrow">GỢI Ý THEO NHU CẦU</span><h3>Bữa này, bạn muốn ăn gì?</h3><p>Chọn một gợi ý, cuộn ngang và tìm món hợp với bữa ăn của bạn.</p><nav class="collection-nav" aria-label="Gợi ý theo nhu cầu">${groups.map(group=>`<button type="button" onclick="scrollToCollection('${group.id}')" aria-controls="collection-${group.id}">${esc(group.title)} <span aria-hidden="true">↘</span></button>`).join('')}</nav></div>${groups.map(group=>`<section class="menu-collection" id="collection-${group.id}" aria-labelledby="collection-title-${group.id}"><div class="collection-heading"><div><div class="collection-title-line"><h3 id="collection-title-${group.id}">${esc(group.title)}</h3><span class="collection-count">${group.products.length} món</span></div><p>${esc(group.description)}</p></div><div class="collection-controls"><button type="button" class="collection-arrow" data-direction="-1" onclick="scrollCollection('${group.id}',-1)" aria-controls="rail-${group.id}" aria-label="Cuộn về trước: ${esc(group.title)}" disabled><span aria-hidden="true">←</span></button><button type="button" class="collection-arrow" data-direction="1" onclick="scrollCollection('${group.id}',1)" aria-controls="rail-${group.id}" aria-label="Cuộn xem thêm: ${esc(group.title)}"><span aria-hidden="true">→</span></button></div></div><div class="product-rail" id="rail-${group.id}" tabindex="0" role="region" aria-labelledby="collection-title-${group.id}" aria-describedby="collection-keyboard-hint">${group.products.map(p=>productMarkup(p,'h4')).join('')}</div><p class="collection-swipe-hint" aria-hidden="true">Vuốt ngang để xem thêm món →</p></section>`).join('')}<span class="sr-only" id="collection-keyboard-hint">Dùng phím mũi tên trái, phải để cuộn; Home để về đầu, End để tới cuối hàng món.</span>`;
 const rails=[...root.querySelectorAll('.product-rail')];
 collectionResizeObserver=new ResizeObserver(()=>rails.forEach(updateCollectionControls));
 rails.forEach(rail=>{
   rail.scrollLeft=positions.get(rail.id)||0;
   rail.addEventListener('scroll',()=>updateCollectionControls(rail),{passive:true});
   rail.addEventListener('keydown',event=>{
     if(event.target!==rail||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();
     if(event.key==='Home'||event.key==='End')rail.scrollTo({left:event.key==='Home'?0:rail.scrollWidth,behavior:scrollBehavior()});
     else scrollCollection(rail.id.slice(5),event.key==='ArrowRight'?1:-1);
   });
   collectionResizeObserver.observe(rail);updateCollectionControls(rail);
 });
}
function updateCollectionControls(rail){
 const section=rail.closest('.menu-collection');if(!section)return;
 section.querySelector('[data-direction="-1"]').disabled=rail.scrollLeft<=2;
 section.querySelector('[data-direction="1"]').disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;
}
export function scrollCollection(id,direction){
 const rail=document.getElementById(`rail-${id}`);if(!rail)return;
 const gap=parseFloat(getComputedStyle(rail).columnGap)||0;
 const stride=(rail.firstElementChild?.getBoundingClientRect().width||rail.clientWidth)+gap;
 const visible=Math.max(1,Math.floor((rail.clientWidth+gap)/stride));
 rail.scrollBy({left:direction*stride*visible,behavior:scrollBehavior()});
}
export function scrollToCollection(id){
 const section=document.getElementById(`collection-${id}`);if(!section)return;
 const offset=(document.querySelector('.site-header')?.getBoundingClientRect().height||0)+20;
 window.scrollTo({top:window.scrollY+section.getBoundingClientRect().top-offset,behavior:scrollBehavior()});
}
export function toggleFavorite(id){
 const index=state.favorites.indexOf(id);if(index>=0)state.favorites.splice(index,1);else state.favorites.push(id);
 try{localStorage.setItem('gagion_favorites_v3',JSON.stringify(state.favorites));}catch{}
 applyCatalogFilters();toast(index>=0?'Đã bỏ món khỏi yêu thích.':'Đã lưu món vào danh sách yêu thích.','success');
}
export function initCatalog(){renderCategories();applyCatalogFilters();}
export function refreshCatalog(){renderCategories();applyCatalogFilters();renderFeaturedCombos();}

export function renderFeaturedCombos(){
 const grid=document.getElementById('featuredComboGrid');if(!grid)return;
 const featured=menu.filter(product=>product.cat==='combo'&&!state.soldOut.includes(product.id)).sort((a,b)=>b.popular-a.popular).slice(0,4);
 grid.innerHTML=featured.map(product=>`<article class="featured-combo-card"><button type="button" class="product-open" onclick="openCustomize(${product.id})" aria-label="Xem và chọn ${esc(product.name)}"></button><div class="featured-combo-image"><img src="${esc(product.img)}" alt="${esc(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/images/chicken.webp'"><span>${esc(product.tag)}</span></div><div class="featured-combo-body"><h3>${esc(product.name)}</h3><p>${esc(product.desc)}</p><div><strong>${money(product.price)}</strong><button class="add-btn" onclick="openCustomize(${product.id})">Chọn combo →</button></div></div></article>`).join('');
}

export function setComboGroup(group){state.comboGroup=group;applyCatalogFilters();}
function renderComboGroups(){const root=document.getElementById('comboGroups');if(!root)return;root.classList.toggle('hidden',state.category!=='combo');root.innerHTML=[['all','Tất cả combo'],['solo','1 người'],['duo','2 người'],['group','Nhóm & gia đình'],['party','Tiệc đông người']].map(([id,label])=>`<button class="${state.comboGroup===id?'active':''}" onclick="setComboGroup('${id}')">${label}</button>`).join('');}
