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

## Kết nối Google Sheet

Trang tải từng tab bằng link xuất CSV của Google (`/export?format=csv&gid=…`), giữ nguyên chữ như trong Sheet.
Điều kiện duy nhất: Sheet để chia sẻ **Anyone with the link** (hiện đã bật).

- `sheetId` và `gids` (mã từng tab) nằm trong `config.js`. Đổi tên tab không sao, nhưng nếu **xoá tab rồi tạo lại**
  thì gid đổi: mở tab đó, copy số sau `gid=` trên thanh địa chỉ và dán vào `config.js`.
- Sửa Sheet xong, tải lại trang là thấy ngay.
- Xem thử với dữ liệu mẫu: thêm `?demo` vào cuối địa chỉ trang.

## Lưu ý về Sheet

- **Quan trọng:** link Sheet đang cho phép **Anyone with the link → Editor**. Mã Sheet nằm công khai trong code trang web,
  nên ai cũng có thể mở và **sửa** Sheet. Nên đổi thành **Viewer**, rồi thêm riêng email các thầy cô cần sửa làm Editor.
- Ai có link đều đọc được toàn bộ Sheet, kể cả dòng `Public = FALSE` (trang web vẫn ẩn những dòng đó).
- CSV chỉ chứa chữ, nên **định dạng trong ô (đậm, màu, link gắn vào chữ ở cột Title) và ảnh chèn trong ô không hiện**. Thay vào đó:
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
