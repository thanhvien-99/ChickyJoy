// Nhóm khám phá trong Tất cả món, khác với danh mục loại món ở đầu thực đơn.
// Điều kiện được xét theo thứ tự: mỗi món chỉ thuộc một nhóm.
export const menuCollections = [
  {
    id: 'solo-meal', title: 'Bữa ngon một người',
    description: 'Một phần vừa bụng, từ bữa cơm đến burger và suất ăn cá nhân.',
    matches: product => product.group === 'solo' || ['rice', 'burger'].includes(product.cat)
  },
  {
    id: 'share-meal', title: 'Chia sẻ cùng hội bạn',
    description: 'Chọn phần ăn cho hai người, gia đình hoặc cả nhóm.',
    matches: product => product.cat === 'combo'
  },
  {
    id: 'spicy-bites', title: 'Cay đúng gu',
    description: 'Miếng gà và cánh gà dành cho người mê vị cay.',
    matches: product => product.cat === 'chicken' && product.spicy
  },
  {
    id: 'sweet-finish', title: 'Kết bữa ngọt mát',
    description: 'Thêm một ly mát lạnh hoặc chút ngọt cho bữa ăn trọn vẹn.',
    matches: product => ['drinks', 'dessert'].includes(product.cat) || product.id === 39
  },
  {
    id: 'snack-time', title: 'Ăn nhẹ, thêm vui',
    description: 'Nhâm nhi gà giòn, khoai và những món nhỏ bạn thích.',
    matches: () => true
  }
];

// Thứ tự hiển thị không phụ thuộc thứ tự phân loại.
const displayOrder = ['solo-meal', 'share-meal', 'spicy-bites', 'snack-time', 'sweet-finish'];
export function buildMenuCollections(products) {
  const groups = new Map(menuCollections.map(group => [group.id, {...group, products: []}]));
  products.forEach(product => {
    const group = menuCollections.find(collection => collection.matches(product));
    groups.get(group.id).products.push(product);
  });
  return displayOrder.map(id => groups.get(id)).filter(group => group.products.length);
}
