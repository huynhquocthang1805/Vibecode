# Chạy, xem và tự push nhánh sửa lỗi

Mở Terminal của dự án, dùng PowerShell. Nhánh cũ FD-01-MVP đã merge ở PR #7; lần này dùng nhánh mới dưới đây.

## 1. Kiểm tra đang ở đúng nhánh
```powershell
cd "D:\Project\Geocarbon\Vibecode"
git switch feat/frontend-dashboard/FD-02-FD-05-FD-10
git status
```
Sau commit bàn giao, `git status` cần báo cây làm việc sạch. Không dùng `git add .` nếu bạn có thêm file khác chưa kiểm tra.

## 2. Chạy để xem giao diện
```powershell
npm run dev
```
Mở http://localhost:3000 (hoặc cổng Terminal thông báo). Dừng bằng Ctrl+C.

- Nhập vài ngày, lọc khoảng ngày đó: số chính thuộc kỳ cuối, tổng có nhãn bên dưới.
- Bấm xem giao diện mẫu, đổi tab biểu đồ, thu cửa sổ và thử giao diện tối.
- Bảng dữ liệu, quản lý dữ liệu, hộp ngày/báo cáo chỉ tải khi mở. Báo cáo vẫn chờ AI-08; card AI thiếu dữ liệu phải khoá nút.

## 3. Kiểm tra trước khi gửi
```powershell
npm run check
```
Hiện còn duy nhất `Expect test to fail` của test QA R-01 vì code đã sửa thành công nhưng test còn đánh `it.fails`. Đừng tự xoá test hoặc bỏ điều kiện kiểm tra. Nhờ Nhân/techlead đổi khai báo R-01 sang `it` theo handoff FD-02. Có thể push **Draft PR** để họ xem và xử lý; chưa bấm Ready cho tới khi check xanh.

## 4. Push nhánh lên GitHub
```powershell
git push -u origin feat/frontend-dashboard/FD-02-FD-05-FD-10
```
Lệnh này đưa commit local lên nhánh riêng. Không đưa code thẳng lên main. Nếu Git yêu cầu đăng nhập, hoàn tất màn hình đăng nhập GitHub của Git Credential Manager.

## 5. Tạo Draft Pull Request
Mở [trang so sánh nhánh](https://github.com/huynhquocthang1805/Vibecode/compare/main...feat%2Ffrontend-dashboard%2FFD-02-FD-05-FD-10?expand=1).

- Base: `main`; compare: `feat/frontend-dashboard/FD-02-FD-05-FD-10`.
- Tiêu đề: `fix(FD-02, FD-05, FD-10): KPI cùng kỳ, guard AI và tối ưu frontend`.
- Dán nội dung `handoffs/FD-10/PR.md` vào mô tả.
- Chọn mũi tên cạnh Create pull request → **Create draft pull request**. Techlead vẫn xem được code trong Draft.
- Khi Nhân/techlead cập nhật QA R-01, lấy commit mới về nhánh, chạy lại check. Check xanh rồi bấm **Ready for review** để bot review; techlead quyết định merge.

## 6. Những lần sửa tiếp trên cùng PR
Sau khi kiểm tra và commit đúng file của bạn:
```powershell
git push
```
PR tự cập nhật; không mở PR khác cho cùng đợt sửa. Nếu Git báo remote có commit mới hoặc conflict, giữ nguyên dữ liệu và xử lý trước, không force push.
