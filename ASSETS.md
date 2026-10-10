# Ảnh trong project

26 ảnh sản phẩm được tạo mới bằng công cụ imagegen tích hợp. Ảnh có phong cách chụp thực đơn trên nền kem sáng; một số biến thể/size và combo dùng chung ảnh. Nội dung mô tả món xác định khẩu phần thực tế.

Prompt chung: `create image. Use case: product-mockup. Square photorealistic fast food catalog photograph, centered complete serving, three-quarter front view, soft studio light, pale ivory background. No text, logos, watermark, people or collage.`

| Tệp trong wwwroot/assets/images | Nội dung prompt |
|---|---|
| chicken.webp | Two golden crispy fried chicken drumsticks on a clean white plate, no sides. |
| burger.webp | One crispy CHICKEN fillet burger with lettuce, tomato, slice of cheese and mayonnaise. Clearly golden breaded chicken, no beef. |
| rice.webp | Vietnamese white steamed rice with sliced golden breaded fried chicken, black pepper sauce and sliced cucumber on a white plate. |
| combo.webp | Fast food meal for two: FOUR golden fried chicken pieces, a white carton of fries and TWO red paper soft drink cups, arranged neatly on white studio backdrop, no logos, no text. |
| fries.webp | Golden straight French fries in a small unbranded red carton. |
| tea.webp | Iced peach tea with peach slices, orange wheel and lemongrass stalk in a clear takeaway cup, no text. |
| icecream.webp | Vanilla soft serve ice cream sundae in white paper cup, with strawberry sauce, no text. |
| corn.webp | Yellow sweet corn kernels in a small white bowl, butter glistening, no other food. |
| coleslaw.webp | Finely shredded white cabbage and carrot coleslaw with creamy mayonnaise in a white bowl, no salad leaves. |
| cheesesticks.webp | Three crispy golden breaded mozzarella cheese sticks, one split showing stretchy melted white cheese. |
| tart.webp | Two small Portuguese style egg custard tarts with golden flaky pastry in white plate. |
| bao.webp | One white steamed bao bun and one half bun showing cooked shredded chicken filling on white plate. |
| nuggets.webp | Six golden breaded chicken nuggets with a small cup of red dipping sauce on white plate. |
| pasta.webp | Spaghetti in tomato sauce topped with small golden chicken nuggets on white plate. |
| soda.webp | Clear unbranded takeaway cup of dark cola with ice cubes and straw, on white tabletop. |
| cake.webp | One slice of dark chocolate cake with chocolate frosting on white plate. |
| applepie.webp | One individual small golden baked apple pie with visible apple filling and cinnamon on white plate. |
| water.webp | Clear water bottle with blank white label and white cap standing on white studio surface. |
| coffee.webp | Vietnamese iced coffee with milk, dark coffee over condensed milk in clear takeaway cup with straw. |
| orange.webp | A clear cup of orange soda with ice, vivid orange beverage and plain straw, no logos. |
| lemon.webp | A clear takeaway cup of pale transparent lemon lime soda with ice and lime slices, no logos. |
| vanilla.webp | Vanilla soft serve ice cream in a white paper cup, pure creamy vanilla, NO sauce. |
| chocolateice.webp | Chocolate soft serve ice cream in a white paper cup, rich brown chocolate, NO vanilla. |
| chocolatesundae.webp | Vanilla soft serve ice cream topped with dark chocolate sauce in a white paper cup. |
| wings.webp | Four golden crispy fried chicken wings on a white plate with a tiny bowl of barbecue sauce. |
| familycombo.webp | EIGHT golden crispy fried chicken pieces, TWO small white cartons of French fries, a white bowl of coleslaw, FOUR plain red cola cups, family meal spread on white background. |

Hai ảnh giữ lại từ nguồn cũ: `photo-1551183053-bf91a1d81141.jpg` (mì xốt kem) và `photo-1528605248644-14dd04022da1.jpg` (không khí bàn tiệc), tải từ images.unsplash.com bằng ID tương ứng. Xác nhận quyền sử dụng và thay bằng ảnh kinh doanh thật trước khi phát hành.

## Biểu tượng V9

Các SVG trong `GaGionEcommerce/wwwroot/assets/icons/` được dựng riêng cho giao diện: `zalo.svg`, `payment-cod.svg`, `payment-bank.svg`, `payment-momo.svg`, `payment-vnpay.svg`. Đây là hình nhận diện đơn giản dùng tên/màu phương thức, không phải bộ logo chính thức được các thương hiệu cung cấp. Không dùng CDN nên biểu tượng vẫn hiển thị khi máy không truy cập mạng ngoài.

Hình MoMo/VNPay chỉ nhận diện lựa chọn của người dùng; dự án chưa kết nối merchant hoặc xử lý giao dịch qua hai dịch vụ này.


## QR do chủ cửa hàng cung cấp (V10)

`GaGionEcommerce/wwwroot/assets/payments/techcombank-original.png` là bản sao nguyên vẹn ảnh đính kèm của người dùng. QR được đọc bằng bộ giải mã và hiển thị lại từ chính payload đó bằng thư viện local, không dùng imagegen cho mã thanh toán. Tài khoản nhận 7772585858, Techcombank; tên trong ảnh NGUYEN THANH VIEN. Mã nhận tiền cố định không chứa số tiền hoặc nội dung đơn. Kiểm tra đọc lại ảnh QR trong trình duyệt ghi trong `Tests/qr-results.json`.
