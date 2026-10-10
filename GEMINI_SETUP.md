# Gemini API trong ChickyJoy

Dự án hỗ trợ Gemini trong `AiChatService.cs`, ưu tiên Gemini nếu có `Gemini:ApiKey` trong User Secrets. Nếu không có, dự án dùng cấu hình OpenAI trước đây.

Từ thư mục `ChickyJoy/GaGionEcommerce`, chạy:

```bash
dotnet user-secrets set "Gemini:ApiKey" "YOUR_GEMINI_API_KEY"
dotnet user-secrets set "Gemini:Model" "gemini-2.5-flash"
```

Hoặc Visual Studio > chuột phải project **GaGionEcommerce** > Manage User Secrets:

```json
{
  "Gemini": {
    "ApiKey": "YOUR_GEMINI_API_KEY",
    "Model": "gemini-2.5-flash"
  }
}
```

Không gửi API key vào hội thoại, không đưa khóa vào `appsettings.json` hoặc JavaScript. Khởi động lại server sau khi sửa Secrets.

Thử endpoint `/api/chat/status` (available=true) rồi gửi câu hỏi trong cửa sổ chat. Nếu còn trả lời mẫu, xem tab Network cho request `/api/chat` và cửa sổ Output cho mã HTTP (không chia sẻ thông tin nhạy cảm).

Lưu ý: cần Gemini API key hợp lệ với model và quota; lỗi kết nối vẫn có thể khiến giao diện sử dụng tư vấn dự phòng. Bản vá này chưa được build/test thực tế vì môi trường xử lý không có .NET SDK và không sử dụng khóa thật của bạn.
