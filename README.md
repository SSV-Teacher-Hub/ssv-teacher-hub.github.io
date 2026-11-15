# Teacher Hub · Sedbergh Vietnam

Trang thông tin cho giáo viên và nhân viên Sedbergh Vietnam, cùng phong cách với
[Centre of Excellence](https://coe-ssv.github.io/). Trang tĩnh, chạy thẳng trên GitHub Pages,
**không cần Apps Script**: thông báo, lịch và sự kiện được đọc trực tiếp từ Google Sheet.

## Nội dung lấy từ đâu

| Phần trên trang | Nguồn |
|---|---|
| Today / số ngày đến mốc tiếp theo, **Key dates** | tab `Calendar` (date, title, color, full) |
| **Upcoming events** | tab `Event` (Month, Start Date, End Date, Event, Details) |
| **Announcements** | tab `Announcements` (Date, Title, Content, Tag, Public, Image, *Link*) |
| Resources, FAQ, Who to ask | viết thẳng trong `index.html` — mở file, sửa chữ |

## Kết nối Google Sheet (làm một lần)

1. Mở Google Sheet → **File → Share → Publish to web**.
2. Chọn **Entire document** (hoặc chọn riêng 3 tab Calendar, Event, Announcements) → **Publish**.
3. Mở trang web. Nếu các mục vẫn báo *Couldn’t load…*, dùng một trong hai cách:
   - **Share → General access → Anyone with the link → Viewer**, hoặc
   - Trong hộp thoại Publish to web, chọn từng tab + **Comma-separated values (.csv)**,
     copy link và dán vào `csv.calendar`, `csv.events`, `csv.announcements` trong `config.js`.

Google cập nhật bản đã publish sau khoảng 5 phút, nên chỉnh Sheet xong chờ vài phút là trang tự đổi.

Muốn xem thử với dữ liệu mẫu: thêm `?demo` vào cuối địa chỉ trang.

## Lưu ý khi publish Sheet

- **Ai cũng đọc được các tab đã publish**, kể cả các dòng `Public = FALSE`. Trang web vẫn ẩn những dòng đó,
  nhưng nếu có bản nháp nhạy cảm thì đừng để chung trong tab Announcements đã publish.
- CSV chỉ chứa chữ, nên **định dạng trong ô (đậm, màu, link gắn vào chữ) và ảnh chèn trong ô không hiện**. Thay vào đó:
  - Ảnh: dán link ảnh vào cột **Image** (link Google Drive cũng được — file phải chia sẻ công khai).
  - Link: dán URL thẳng vào **Content** (tự thành link bấm được), hoặc thêm cột **Link** để có nút *Open link*.
  - Chèn ảnh trong nội dung: `[img]https://...[/img]`.
- Ngày trong tab Event có thể lẫn DD/MM và MM/DD; trang dùng cột **Month** để đọc đúng (giống code cũ).

## Cấu trúc

```
index.html              nội dung trang (sửa Resources, FAQ, Who to ask ở đây)
config.js               ID Sheet, tên tab, link CSV, màu/nhãn bộ phận
assets/css/style.css    giao diện (màu, font theo trang COE)
assets/js/main.js       đọc CSV từ Sheet và hiển thị
assets/img/             logo Sedbergh Vietnam
data/demo/demo.js       dữ liệu mẫu (dùng với ?demo hoặc khi mở file bằng cách bấm đúp)
```

## Bật GitHub Pages

Repo → **Settings → Pages → Build and deployment → Deploy from a branch** → chọn nhánh chứa code
(ví dụ `main`) và thư mục `/ (root)` → **Save**. Trang sẽ có tại `https://ssv-teacher-hub.github.io/`.
