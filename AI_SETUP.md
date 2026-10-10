# ChickyJoy AI — V14

Khóa bạn cung cấp đã được tích hợp vào `Secrets/openai.local.json`, ngoài thư mục giao diện `wwwroot`. Máy chủ đọc tệp này khi chạy nhanh hoặc từ Visual Studio, không cần nhập lại mỗi lần mở. Giữ riêng bản ZIP/thư mục `Secrets` vì có khóa của bạn.

## Mở website trên Windows

1. Chọn **Extract All / Giải nén tất cả** vào thư mục mới. Không chạy file ngay trong ZIP.
2. Mở **Start-ChickyJoy.cmd**; `Start-ChickyJoy-AI.cmd` cũng mở cùng bản này.
3. Công cụ chạy DLL đã biên dịch. Nếu thiếu .NET + ASP.NET Core 8, công cụ tải runtime chính thức từ Microsoft, kiểm tra SHA512 và lưu trong thư mục ứng dụng của người dùng. Không cần Visual Studio, SDK hoặc quyền Admin.
4. Trình duyệt tự mở khi máy chủ sẵn sàng. Cổng mặc định là `http://localhost:5157`; nếu bận, công cụ chọn cổng trống và in địa chỉ chính xác.
5. Giữ cửa sổ mở khi dùng website; Ctrl+C để dừng. Lỗi AI không làm website dừng khởi chạy.

File `.cmd` đặt chính sách thực thi PowerShell riêng cho tiến trình mở ứng dụng; không đổi chính sách toàn máy. Nếu máy quản lý chặn công cụ, dùng runtime đã cài theo [hướng dẫn Microsoft](https://learn.microsoft.com/en-us/dotnet/core/install/windows) hoặc mở bằng Visual Studio.

## Kết quả thử khóa thật

Ngày 10/10/2026, OpenAI Responses API với model `gpt-4.1` trả **HTTP 429**, `type: insufficient_quota`, `code: credit_balance_exhausted`. Yêu cầu qua máy chủ ChickyJoy cũng nhận đúng lỗi hạn mức; website vẫn tư vấn từ dữ liệu quán. Chưa có câu trả lời model để đánh giá khả năng ứng biến.

Chủ cửa hàng cần mở [OpenAI Platform](https://platform.openai.com/), kiểm tra **Billing / Usage** của tài khoản/tổ chức chứa project của khóa và bổ sung số dư. Theo [tài liệu lỗi OpenAI](https://developers.openai.com/api/docs/guides/error-codes), `credit_balance_exhausted` nghĩa là số dư trả trước đã hết. Khởi động lại hay đổi cách hỏi không khắc phục được số dư.

Sau khi khôi phục số dư, mở chat và bấm **↺ làm mới kết nối** hoặc **Thử lại câu hỏi**. Nếu thay khóa, sửa `OpenAI.ApiKey` trong `Secrets/openai.local.json` rồi khởi động lại. Vì khóa đã được gửi trong cuộc trò chuyện, nên tạo khóa thay thế cho lần sử dụng lâu dài.

## Trạng thái chat

- **Sẵn sàng kết nối:** máy chủ có cấu hình khóa; chưa chứng minh đã nhận câu trả lời AI.
- **Đang hoạt động:** một yêu cầu vừa nhận câu trả lời AI thành công.
- **AI hết hạn mức:** tiếp tục tra cứu món/giá/địa chỉ; cửa hàng cần khôi phục số dư hoặc hạn mức. Không tự gửi lặp lại đến khi người dùng làm mới/thử lại.
- **Khóa cần cập nhật / model chưa truy cập được:** chủ cửa hàng kiểm tra cấu hình máy chủ.
- **Giới hạn lượt hỏi:** gửi chậm lại. Lỗi này khác với hết số dư.
- **Tạm gián đoạn:** lỗi kết nối/dịch vụ; có thể thử lại hoặc liên hệ Zalo.

Nút hỏi nhanh chỉ là gợi ý. Khi nhận được AI, mọi câu hỏi được gửi cùng lịch sử và dữ liệu cửa hàng, không bị giới hạn theo biểu mẫu. Khi chưa nhận được AI, tra cứu dữ liệu không có khả năng hội thoại tự do của model.

## Cấu hình

`GaGionEcommerce/appsettings.json` đặt model `gpt-4.1`, tối đa 2400 token đầu ra, timeout 45 giây và tìm web tắt. Dữ liệu tên quán/món/giá/địa chỉ/giờ/Zalo nằm trong `GaGionEcommerce/wwwroot/assets/catalog/store-data.json`; chỉ dẫn tại `GaGionEcommerce/Services/AssistantInstructions.md`.

Biến môi trường `OpenAI__ApiKey`, User Secrets ở chế độ Development và tham số cấu hình có thể ghi đè tệp riêng. Khi hosting, dùng cấu hình bí mật máy chủ; không tải `Secrets` vào nơi lưu tệp công khai. Không dán khóa vào HTML/JavaScript. Xem [xác thực OpenAI](https://developers.openai.com/api/reference/overview).

Muốn chỉnh mã C#, mở `ChickyJoy.sln` bằng Visual Studio 2022 có workload ASP.NET và .NET 8 SDK, chọn profile ChickyJoy rồi Ctrl+F5. Sau khi sửa C#, cần build lại để thay DLL chạy nhanh hoặc chạy từ Visual Studio.

## Thử hội thoại sau khi nạp số dư

Giữ nguyên cuộc trò chuyện khi hỏi tiếp:

- “Quán tên gì, địa chỉ Quận 1 và món best seller?”
- “Món thứ hai có cay không?”
- “Chỗ đó mấy giờ đóng cửa?”
- “Hai người 160k, không cay và có nước.”
- “Đổi sang đến lấy thì còn bao nhiêu?”
- “Đơn đang nấu thì hủy thế nào?”
- “Giải thích 12 nhân 8 bằng bao nhiêu.”

Giá trên thẻ phương án được website tính lại từ danh mục, phí giao và voucher. AI không tự tạo/hủy đơn, chuyển tiền hoặc gửi Zalo. Chọn phương án vẫn cần xem giỏ và xác nhận. Khi thiếu dữ kiện về vị trí, nguyên liệu hay đơn hàng, trợ lý cần hỏi thêm hoặc hướng dẫn liên hệ nhân viên.

## Phạm vi kiểm tra

DLL đã chạy trên .NET 8. Script PowerShell đã mở máy chủ thật, trang đã tải trong Chrome và một yêu cầu thật đến OpenAI đã xác nhận hết số dư. Kiểm tra thêm ngữ cảnh, đề xuất món, riêng tư, lỗi, dừng/thử lại và khôi phục bằng đầu ra giả lập; xem `Tests/ready-v13-results.json`.

Script được thực thi bằng PowerShell 7.4 trên Linux với đường dẫn .NET cụ thể; chưa thực thi `.cmd` trên máy Windows thật. Chưa có phản hồi suy luận thành công để đánh giá chất lượng model. Chưa thực hiện giao dịch ngân hàng.
