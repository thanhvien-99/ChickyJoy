# Kiểm tra V14

`upgrade-v14.cjs` cần máy chủ ASP.NET Core đang chạy. Khởi động máy chủ với tệp dữ liệu thử riêng, tắt khóa cho các kiểm tra không cần AI:

```bash
dotnet Run/ChickyJoy.dll --urls http://127.0.0.1:5157 --contentroot GaGionEcommerce --Store:DataPath=/duong-dan-thu/table-orders.json --OpenAI:ApiKey=
```

Ở cửa sổ thứ hai:

```bash
npm install --no-save playwright
npx playwright install chromium
node Tests/upgrade-v14.cjs
```

Có thể đặt `CHICKYJOY_BASE_URL` và `CHROME_PATH`. Dùng dữ liệu thử trống; bài kiểm tra tạo đơn giả định tại bàn, không chuyển tiền. Các kiểm tra có chữ AI dùng đầu ra giả để kiểm tra tích hợp và tính giá, không đánh giá model thật. `upgrade-v14-results.json` và ảnh V14 ghi lại lần chạy. Bài kiểm tra API thêm một số đơn, vì vậy không chạy vào máy đang có đơn thật.

Các bài V10–V13 bên dưới dùng máy chủ tĩnh/nhà cung cấp giả và kiểm tra hồi quy giao diện. Bài V14 kiểm tra thêm máy chủ đơn bàn thực. Kết quả trước đây giữ theo phiên bản; không dùng ảnh cũ để đánh giá bố cục V14.

# Các kiểm tra kế thừa

Node.js, Playwright và Python chỉ cần cho người phát triển chạy kiểm tra, không cần để mở website bằng Visual Studio.

## Trình duyệt

Chạy từ thư mục chứa solution:

```bash
npm install --no-save playwright
npx playwright install chromium
node Tests/browser.cjs
node Tests/experience.cjs
node Tests/customer-v10.cjs
node Tests/assistant-v11.cjs
node Tests/seller-v12.cjs
node Tests/assistant-v13.cjs
```

Có thể đặt `CHROME_PATH` để dùng Chrome có sẵn. Mỗi script tự mở HTTP server tạm và hồ sơ trình duyệt tạm, không sửa dữ liệu người dùng.

`browser.cjs` kiểm tra toàn bộ thực đơn, ảnh, nhóm cuộn, bộ lọc, tài khoản, món thêm, giỏ hàng, voucher, hẹn giờ, QR, đơn hàng, điểm và đặt tiệc. `experience.cjs` kiểm tra menu mới, popup, chat, Zalo, vùng bấm, phương thức thanh toán và mobile. Chat AI được giả lập ở kiểm tra trình duyệt; không gọi OpenAI hoặc thực hiện thanh toán.

Kết quả nằm trong `results.json`, `experience-results.json`. Các ảnh desktop/mobile, menu, chat, popup và phương thức thanh toán được tạo lại khi chạy.

## Dịch vụ AI

Không cần khóa API; chương trình dùng `HttpMessageHandler` giả:

```bash
dotnet run --project Tests/ChatContractTests -- GaGionEcommerce
```

Kiểm tra cấu trúc Responses request, khóa chỉ ở máy chủ, `store: false`, lịch sử, danh mục dùng chung, tùy chọn tìm web, nguồn HTTP(S), lỗi nhà cung cấp, phản hồi sai định dạng, phản hồi rỗng và từ chối trả lời. `chat-contract-results.json` ghi lại lần kiểm tra đóng gói.

## API ASP.NET Core thật

```bash
dotnet build GaGionEcommerce/GaGionEcommerce.csproj
python Tests/api-smoke.py
```

Dùng `python3` thay cho `python` nếu cần. Tùy chọn `--assembly` chỉ định DLL đã biên dịch; `--dotnet` chỉ định runtime .NET. Script tự mở máy chủ trên cổng tạm, bỏ cấu hình khóa khỏi môi trường tiến trình kiểm tra và chạy ở Production để không nạp User Secrets. Kiểm tra status, giới hạn dữ liệu, lịch sử không hợp lệ, origin, thiếu khóa, tốc độ gửi, đường dẫn staff và API không tồn tại. Kết quả HTTP ghi vào `api-smoke-results.json`.

Mã C# trong gói đã biên dịch trực tiếp bằng Roslyn/.NET 8 và chạy máy chủ thật. `backend-results.json` ghi phạm vi này. MSBuild không chạy được trong môi trường tạo gói do quyền đọc thông tin tiến trình; không coi biên dịch trực tiếp là bằng chứng Build Solution đã qua. Đã thử API thật bằng khóa chủ cửa hàng, nhận HTTP 429 `credit_balance_exhausted`; chưa có phản hồi suy luận thành công. Chưa thực hiện giao dịch ngân hàng thật.

## Kiểm tra trải nghiệm V10

`customer-v10.cjs` bấm nút Theo dõi từ màn hình thành công, tải lại, mở lại đơn khách, xác minh đơn cũ và kiểm tra hủy/yêu cầu hủy/nhân viên phản hồi. Bao gồm thay đổi trạng thái lúc xác nhận, lỗi lưu, báo thanh toán không đồng nghĩa nhận tiền, nội dung cửa hàng và tư vấn bữa ăn theo ngân sách/khẩu vị/giá sau mã/phí giao. Kết quả lưu `customer-v10-results.json`.

`techcombank-qr.png` là QR hiển thị trong trình duyệt. Đã dùng bộ đọc QR đối chiếu với ảnh gốc; `qr-results.json` ghi nhận hai payload bằng nhau. Chưa chuyển tiền hoặc tra soát tài khoản ngân hàng thực.

## Hội thoại và thương hiệu V11

`assistant-v11.cjs` dùng các đầu ra AI được xác định trước để kiểm tra việc gửi câu hỏi tới API, ngữ cảnh, phương án trước, lọc dữ liệu/giá sai, khôi phục khi tải lại, mở đơn thực, lỗi/dừng/thử lại, định dạng và bố cục. `assistant-v11-results.json` ghi rõ đây là kiểm tra tích hợp/phần mềm, không đánh giá độ đúng của model thật.

`ChatContractTests` kiểm tra Responses JSON schema nghiêm ngặt, ngữ cảnh có giới hạn, tên ChickyJoy và danh mục dùng chung, loại sản phẩm giả/hết hàng, từ chối, lỗi và hủy yêu cầu. Kiểm tra này dùng nhà cung cấp giả. Lần thử nhà cung cấp thật và lỗi số dư được ghi riêng trong `ready-v13-results.json`; xem `AI_SETUP.md`.

## Tư vấn bán hàng V12

`seller-v12.cjs` kiểm tra câu “MÓN BEST SELLER” từ ảnh lỗi, cách hỏi tên quán không theo biểu mẫu, giá/tên món có lỗi nhỏ, tham chiếu thứ tự, so sánh, địa chỉ/giờ được nhớ qua tải lại và câu hỏi nhiều ý. Có kiểm tra món hết, thiếu dữ liệu dị ứng/vị trí và giao diện 320–1366px. Phần không có AI chỉ tra cứu dữ liệu; phần AI dùng đầu ra giả để kiểm tra tích hợp.

## Khởi chạy và kết nối V13

`assistant-v13.cjs` kiểm tra phân biệt hết số dư/giới hạn lượt/khóa sai, tiếp tục tư vấn quán, không gửi lặp lại khi bị chặn và phục hồi sau thử lại. Dùng đầu ra giả lập, không gọi API ngoài.

`ready-v13-results.json` ghi lần mở DLL có sẵn bằng script PowerShell 7.4 trên Linux, tải 72 món trong Chrome, kiểm tra không lộ tệp khóa và thực hiện một yêu cầu từ ChickyJoy đến OpenAI. Nhà cung cấp trả `credit_balance_exhausted`; chat trả dữ liệu quán, xử lý câu tham chiếu và hiển thị trên mobile. Không đánh giá độ thông minh khi không có phản hồi model.

`Start-ChickyJoy.cmd` chạy DLL trực tiếp; Windows thiếu runtime thì tải từ Microsoft. `.cmd` chưa được thực thi trên Windows thật; phần PowerShell đã thực thi với đường dẫn .NET cụ thể. Kết quả không chứng minh model trả lời đúng mọi câu hỏi.
