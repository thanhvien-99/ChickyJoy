# Cấu hình riêng của chủ cửa hàng

`openai.local.json` chứa khóa bạn yêu cầu tích hợp ở máy chủ. Tệp nằm ngoài `wwwroot`, không được gửi xuống trình duyệt và được bỏ qua khi commit Git.

Giữ riêng thư mục này và bản ZIP có chứa nó. Khi thay khóa, sửa giá trị `OpenAI.ApiKey` trong tệp rồi khởi động lại ChickyJoy. Không dán khóa vào JavaScript, HTML hoặc ảnh chụp màn hình.

Biến môi trường `OpenAI__ApiKey`, User Secrets trong Visual Studio và tham số cấu hình vẫn có thể ghi đè giá trị này. Model, timeout và chỉ dẫn hội thoại được cấu hình trong mã nguồn hiện có.
