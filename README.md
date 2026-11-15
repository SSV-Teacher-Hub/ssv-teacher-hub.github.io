# SSV Teacher Hub

Trang thông tin một trang (landing page) cho giáo viên SSV, chạy trên GitHub Pages.

- **Announcements** và **Key dates** tự lấy từ Google Sheet (3 tab sẵn có: `Calendar`, `Event`, `Announcements`).
- **Quick links**, **Who to ask** và **FAQ** viết thẳng trong `index.html` — mở file, sửa chữ là xong.

## Cấu trúc

```
index.html            nội dung trang (sửa link, liên hệ, FAQ ở đây)
config.js             apiUrl + màu/nhãn bộ phận
assets/css/style.css  giao diện
assets/js/main.js     đọc dữ liệu từ Sheet và hiển thị
data/demo.js          nội dung mẫu, chỉ dùng khi apiUrl để trống
apps-script/Code.gs   backend Apps Script (bản cập nhật của code cũ)
```

## Kết nối Google Sheet (làm một lần)

1. Mở project Apps Script hiện tại, thay nội dung `Code.gs` bằng file `apps-script/Code.gs`.
   Trang HTML cũ (Index.html) vẫn chạy như trước — chỉ thêm chế độ `?format=json`.
2. **Deploy → Manage deployments →** bút chì **Edit → Version: New version → Deploy**.
   Mục **Who has access** phải là **Anyone**.
3. Copy URL web app (kết thúc bằng `/exec`), dán vào `apiUrl` trong `config.js`.
4. Kiểm tra: mở `URL/exec?format=json` trên trình duyệt, phải thấy dữ liệu dạng `{"ok":true,...}`.

Trong Apps Script đã sửa thêm: tách ghi chú (dòng 2 trở đi trong ô Event) để hiện dưới tên sự kiện,
và khi dữ liệu vượt giới hạn cache 100KB thì vẫn trả dữ liệu thay vì mất cả danh sách.

## Đưa lên GitHub Pages

1. Đẩy toàn bộ file lên nhánh `main` của repo `ssv-teacher-hub.github.io`.
2. Repo → **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Trang sẽ có tại `https://ssv-teacher-hub.github.io/`.

## Lưu ý

- Trang GitHub Pages ai cũng xem được. Thông báo chỉ hiện khi cột **Public = TRUE** (giống trang cũ).
- Nhớ thay các email mẫu `@your-school.edu.vn` trong phần **Who to ask** bằng email thật.
