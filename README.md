# ChickyJoy V14

## Mở website trên Windows

1. Tải ZIP và chọn **Extract All / Giải nén tất cả** vào thư mục mới.
2. Mở **Start-ChickyJoy.cmd** trong thư mục đã giải nén. Không chạy ngay trong cửa sổ ZIP, không nhấp đúp `index.html`.
3. Bản đã biên dịch nằm trong `Run/ChickyJoy.dll`; không cần Visual Studio để mở. Nếu thiếu runtime .NET/ASP.NET Core 8, công cụ tải từ Microsoft và kiểm tra SHA512, không cần quyền Admin.
4. Trình duyệt tự mở. Giữ cửa sổ khởi động mở trong khi sử dụng. Nếu lỗi, đọc thông báo trong cửa sổ và thư mục `Logs`.

Khóa API chủ cửa hàng đã được tích hợp trong cấu hình riêng **ngoài giao diện**. Bản ZIP có khóa theo yêu cầu của bạn, vì vậy giữ riêng ZIP và thư mục `Secrets`. OpenAI đã trả `credit_balance_exhausted`: tài khoản API hiện hết số dư. Nạp số dư ở OpenAI Platform → Billing/Usage rồi bấm **Làm mới kết nối / Thử lại** trong chat. Website và gợi ý ưu đãi theo giỏ vẫn hoạt động khi AI chưa trả lời được.

## Nâng cấp V14

- **Voucher chọn bằng thẻ:** không gõ mã. Tự chọn mức giảm tốt nhất hoặc chọn lại; một ưu đãi món có thể dùng cùng một ưu đãi giao hàng. Thẻ chưa đủ điều kiện giải thích số tiền cần thêm hoặc lý do không áp dụng. Đổi giỏ, cách nhận hoặc số điện thoại sẽ tính lại điều kiện.
- **Gợi ý mua thêm ở thanh toán:** so sánh tiền món thêm, mức giảm tăng thêm và tổng phải trả tăng/giảm. Khách xem và xác nhận món trước khi thêm. Khi API hoạt động, AI chọn món dùng cùng từ thực đơn; website tự tính lại giá/voucher. Khi API chưa hoạt động, vẫn có đề xuất theo giỏ, ghi rõ nguồn dữ liệu.
- **6 loại xốt:** phô mai, BBQ, Hàn Quốc cay, mật ong mù tạt, chua ngọt, tiêu đen. Dùng cho combo, gà, burger, cơm và món ăn kèm. Đồ uống/tráng miệng không gắn xốt mặn. Sửa món ngay trong giỏ để chọn lại xốt; giá tính theo từng phần và số lượng món.
- **Giới thiệu ChickyJoy toàn màn hình:** ảnh món lớn, câu chuyện thương hiệu, khu vực xốt và đường dẫn thực đơn/nhà hàng. Hiệu ứng xuất hiện khi cuộn, phản hồi nút, thẻ món và ảnh nổi; tôn trọng thiết lập giảm chuyển động của thiết bị.
- **QR đặt tại bàn:** đơn có chi nhánh và số bàn, không tính phí giao, không bắt buộc tên/số điện thoại. Máy chủ kiểm tra giá, tùy chọn và voucher; khách theo dõi và gửi hủy, nhân viên nhận và xử lý đơn trên một danh sách chung.

Giữ 72 món có ảnh local, nhóm cuộn trong Tất cả món, popup chào mừng, Zalo **0355135071**, theo dõi đơn và QR Techcombank của chủ cửa hàng. Một số combo/size dùng chung ảnh minh họa; thành phần và số lượng trong mô tả là thông tin cần kiểm tra.

## Dùng QR tại bàn trong cửa hàng

1. Chạy ChickyJoy trên máy cửa hàng. Mở đường dẫn **/staff** từ địa chỉ localhost đang chạy, ví dụ `http://localhost:5157/staff`.
2. Chọn **QR tại bàn**, chọn chi nhánh. Mỗi chi nhánh có 12 bàn được cấu hình trong `store-data.json`.
3. Kiểm tra **Địa chỉ website dùng trong QR**. Công cụ thử lấy IP mạng nội bộ; nếu không tìm được, nhập IP Wi-Fi của máy, ví dụ `http://192.168.1.20:5157`. Dùng đúng cổng mà cửa sổ khởi động hiển thị.
4. Điện thoại và máy chạy ChickyJoy cần cùng Wi-Fi. Mở thử địa chỉ bằng điện thoại trước khi in. `localhost` chỉ dùng trên máy chạy; trình tạo QR sẽ cảnh báo và chặn in địa chỉ localhost.
5. Bấm **Tạo mã cho các bàn → In mã QR**. Khách quét bằng camera điện thoại; trang mở đúng nhà hàng và bàn.
6. Khách chọn món, kiểm tra ưu đãi và xác nhận. Đơn xuất hiện ở **Đơn hàng** trên màn hình nhân viên; cập nhật định kỳ 5 giây khi trang đang mở. Nhân viên chuyển **Vào bếp → Sẵn sàng → Hoàn tất**. Món tạm hết được tắt/bật ở mục Quản lý thực đơn, đồng bộ cho khách QR và kiểm tra lại trên máy chủ.

Công cụ khởi động nghe trên mạng nội bộ. Nếu điện thoại không mở được trang, kiểm tra Wi-Fi, IP/cổng và cho ứng dụng qua tường lửa Windows. Công cụ không tự sửa tường lửa. Có thể cấu hình `Store:PublicBaseUrl` khi dùng một địa chỉ cố định.

**QR bàn và QR thanh toán là hai mục riêng.** QR bàn mở thực đơn; QR chuyển khoản xuất hiện sau khi tạo đơn ngân hàng.

## Theo dõi, hủy và thanh toán

Đơn QR tại bàn lưu trên máy chủ trong `GaGionEcommerce/App_Data/table-orders.json`, ngoài thư mục công khai. Không xóa thư mục này khi nâng cấp nếu cần giữ đơn. Trình duyệt khách lưu biên nhận riêng để mở đúng đơn; số điện thoại không tự cấp quyền truy cập đơn bàn. Dùng lại cùng trình duyệt/địa chỉ khi mở lại đơn.

- Đơn mới: khách chọn lý do và xác nhận hủy trực tiếp.
- Đã vào bếp: gửi yêu cầu hủy, chờ nhân viên chấp thuận hoặc phản hồi. Nếu trạng thái vừa đổi, hệ thống yêu cầu xem lại.
- Gửi lại cùng một yêu cầu sau lỗi mạng không tạo đơn trùng. Nếu giá/ưu đãi thay đổi, giữ giỏ và yêu cầu kiểm tra tổng mới trước khi đặt lại.
- Khách báo chuyển khoản chưa có nghĩa cửa hàng đã nhận tiền. Nhân viên đối soát rồi bấm **Đã nhận tiền** trước khi hoàn tất đơn ngân hàng. Hủy không tự hoàn tiền.

Techcombank **7772585858 — NGUYEN THANH VIEN**, BIN **970407**, giữ nguyên payload QR được cung cấp. Đây là mã nhận tiền cố định: nhập số tiền đơn và nội dung **THANHTOAN + mã đơn** trong app ngân hàng. Có nút sao chép nội dung và xem ảnh gốc. Tiền mặt và chuyển khoản được chọn; MoMo/VNPay chưa kết nối nên tạm khóa.

## Chat và AI

Khi API có số dư/quyền model, mọi câu hỏi đi qua AI với lịch sử và dữ liệu quán: tên, món, giá, địa chỉ, giờ, khẩu vị, ngân sách, món hết và ngữ cảnh giỏ. Trợ lý được hướng dẫn trả lời trực tiếp, giữ điều kiện khi hỏi tiếp, so sánh lựa chọn và ứng biến theo hội thoại. Đề xuất món vẫn cần khách xem lại, không tự đặt/hủy/nhận tiền.

Khi AI lỗi, giao diện giải thích lỗi và tiếp tục tra cứu dữ liệu món/quán. Phần này không có khả năng hội thoại tự do của model. Không bảo đảm AI đúng mọi câu hỏi. Model mặc định `gpt-4.1`, tùy chọn tìm web mặc định tắt. Xem `AI_SETUP.md` để thay cấu hình và kiểm tra kết nối.

Không gửi tên, số điện thoại hoặc địa chỉ của biểu mẫu checkout vào API gợi ý. Nội dung người dùng tự nhập vào chat vẫn được gửi khi AI hoạt động. Khóa không nằm trong HTML/JavaScript hoặc thư mục công khai.

## Chỉnh sửa bằng Visual Studio

Mở `ChickyJoy.sln` bằng Visual Studio 2022, cài workload **ASP.NET and web development** và .NET 8 SDK, chọn profile ChickyJoy rồi **Ctrl+F5**. Khi sửa C#, cần biên dịch lại DLL trước khi dùng công cụ mở bản chạy sẵn.

| Nội dung | Tệp trong `GaGionEcommerce` |
|---|---|
| Món, giá, xốt, voucher, chi nhánh, số bàn, Zalo và QR nhận tiền | `wwwroot/assets/catalog/store-data.json` |
| Tính ưu đãi, thẻ chọn voucher và mua thêm | `wwwroot/js/services/promotions.js`, `customer/voucherPicker.js`, `components/checkoutAdvisor.js` |
| Máy chủ nhận/lưu đơn QR | `Services/TableOrderService.cs` |
| Tạo QR, nhận diện bàn và đồng bộ đơn | `wwwroot/js/customer/tableOrdering.js`, `services/tableOrders.js` |
| Giới thiệu, thông tin cửa hàng và hiệu ứng | `wwwroot/js/data/storeInfo.js`, `components/motion.js`, `wwwroot/css/chickyjoy-v14.css` |
| Chat máy chủ và chỉ dẫn seller | `Services/AiChatService.cs`, `Services/AssistantInstructions.md` |

Các đường dẫn `customer/`, `services/`, `components/` rút gọn trong bảng nằm trong `wwwroot/js`.

## Phạm vi của bản này

Đơn QR bàn đã có API nghiệp vụ và lưu tập trung trên máy cửa hàng. API nhân viên của đơn bàn chỉ cho truy cập từ localhost trên máy đang chạy, kiểm tra cả địa chỉ kết nối và Host; khách không tải được toàn bộ đơn. Mã đơn riêng cần biên nhận để theo dõi/hủy/báo thanh toán.

Đơn giao/đến lấy, tài khoản thành viên và đặt tiệc vẫn lưu tại trình duyệt như bản trước. `/staff` của các phần cục bộ này chưa có tài khoản nhân viên/phân quyền máy chủ. Bản này phù hợp chạy thử hoặc dùng mạng nội bộ trên một máy cửa hàng; để vận hành nhiều máy nhân viên/đưa công khai cần xác thực nhân viên và cơ sở dữ liệu phù hợp. Ưu đãi đơn đầu kiểm tra trên lịch sử hiện có, chưa phải hệ thống khách hàng liên thông.

Địa chỉ chi nhánh, thực đơn, giá và ảnh là dữ liệu khởi tạo từ dự án trước; chủ cửa hàng cần thay bằng thông tin kinh doanh đã xác nhận. Không có API ngân hàng hoặc tự hoàn tiền.

## Kiểm tra và giới hạn xác nhận

`Tests/upgrade-v14.cjs` chạy trên máy chủ ASP.NET Core thật, có hai hồ sơ khách/nhân viên; kiểm tra voucher, xốt, mua thêm, AI giả lập, toàn màn hình, QR, gửi/nhận/hủy đơn, biên nhận, chống giả giá, gửi trùng, tranh chấp và đối soát. Kết quả, ảnh giao diện và hướng dẫn chạy nằm trong `Tests`.

C# được biên dịch bằng Roslyn/.NET 8, máy chủ và trình duyệt được chạy thử. Môi trường tạo gói không chạy được MSBuild do quyền đọc thông tin tiến trình, nên không coi đây là xác nhận Build Solution. Script PowerShell chạy thử trên Linux với .NET cụ thể; chưa thực thi `.cmd` trên Windows thật. API thật đã báo hết số dư nên chưa đánh giá khả năng ứng biến của model bằng phản hồi thực. Chưa thực hiện giao dịch ngân hàng thật.
