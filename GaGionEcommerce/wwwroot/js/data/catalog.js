// Dữ liệu dùng chung cho giao diện và trợ lý phía máy chủ.
const response=await fetch(new URL('../../assets/catalog/store-data.json',import.meta.url));
if(!response.ok)throw new Error('Không tải được thực đơn.');
const catalog=await response.json();
export const SHIPPING_FEE=catalog.shippingFee;
export const branches=catalog.branches;
export const menu=catalog.menu;
export const vouchers=catalog.vouchers;
export const siteContact=catalog.contact;
export const sitePayment=catalog.payment;
export const storeBrand=catalog.brand;
export const customerPolicies=catalog.customerPolicies;
export const sauces=catalog.sauces||[];
export const tableOrdering=catalog.tableOrdering;

export const categories = [
  ['all','Tất cả món','✦'], ['combo','Combo & suất ăn','♟'], ['chicken','Gà giòn','🍗'],
  ['burger','Burger','🍔'], ['rice','Cơm & Mì Ý','🍚'], ['sides','Món ăn kèm','🍟'],
  ['drinks','Thức uống','🥤'], ['dessert','Tráng miệng','🍦']
];

export const addonCatalog=catalog.addons;
export function productAddons(category){return [...(addonCatalog[category]||[]),...(['combo','chicken','burger','rice','sides'].includes(category)?sauces:[])];}

export const orderStatuses = [
  {id:'new',label:'Đơn mới'}, {id:'cooking',label:'Đang chuẩn bị'},
  {id:'shipping',label:'Đang giao'}, {id:'ready',label:'Sẵn sàng nhận'},
  {id:'done',label:'Hoàn tất'}, {id:'cancelled',label:'Đã hủy'}
];
