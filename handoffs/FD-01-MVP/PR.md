## Task
- **ID:** FD-01-MVP (frontend MVP để review; gồm component FD-01/02/03/05/06 và FI-01/02/05)
- **Role:** frontend-dashboard + frontend-input
- **Người:** Minh Trường · ChatGPT (Astral/Codex)
- **Handoff:** `handoffs/FD-01-MVP.md`

## Đã làm
Thay các khung UI bằng dashboard Bento off-white/Electric Blue có dark mode, 7 thẻ KPI/sparkline, biểu đồ ECharts tải động, bộ lọc và các khu AI/dự báo/báo cáo theo contract. Form và bảng hỗ trợ nhập nhiều dòng, validation inline, xác nhận trùng ngày trước khi ghi batch, sửa/xoá/hoàn tác, xuất/nhập backup và tạo chiến dịch.

Đã rebase lên `main` mới nhất (`2c48866`) và kiểm tra với DATA-05/06/07 mới: dán Excel → preview/mapping → import → KPI thật cập nhật từ 12 thành 13 đơn. Bản xem trước thiết kế vẫn tách biệt và có banner minh hoạ rõ ràng.

## Kiểm thử
- [x] `npm run check`: lint + typecheck + 3.736 test pass, 9 expected-fail đã có trên main
- [x] `npm run build`
- [x] `node scripts/pr-guard.mjs feat/frontend-dashboard/FD-01-MVP origin/main`: không có lỗi chặn
- [x] Chrome production: 16 kiểm tra PASS, không pageerror/hydration mismatch
- [x] 375/768/1280/1440px không tràn ngang; ảnh sáng/tối tại `handoffs/FD-01-MVP/screens/`
- [x] Lưu, sửa sai bị chặn, xoá/hoàn tác, reload giữ dữ liệu, backup roundtrip và dán Excel cập nhật KPI thật

## Tự kiểm
- [x] Chỉ component frontend + docs/06 + handoff; không sửa app/lib/config/domain hoặc file dùng chung được bảo vệ
- [x] Không đổi chữ ký trong docs/10_CONTRACTS.md
- [x] Không any, ts-ignore, console.log, secret, dependency mới
- [x] Đã rebase lên origin/main mới nhất và đọc quy tắc PR/bot mới

## Cần người khác làm / change request
- Huy: DATA-FIX-02/R-07 — forecast horizon chưa đủ cho nowcast quý, khiến kết quả nowcast rỗng. Lỗi đã có trong review tích hợp của techlead; nhánh UI không sửa thay.
- Hoàng Anh/Nhân/Thắng 2: hoàn tất AI, BA-04 và AI-08 buildReport/copyText. Component đã có các trạng thái chờ/lỗi theo contract.
- Techlead TL-06: hoàn thiện today/loading/error của trang ghép, bỏ nhãn “store tạm”.
- Huy: hoàn thiện khôi phục campaigns/settings qua importBackup và fixture loadMock.
- Bảng ảo hoá, live mode và yêu cầu dữ liệu lớn P1/P2 chưa hoàn tất; không coi PR này là Gate G1 đầy đủ.

## Ghi chú dùng AI
Agent đã dựng UI, viết test và kiểm tra bằng Chrome. Khi cập nhật main ngày 04/11, đã đổi smoke test từ kiểm lỗi dependency stub sang kiểm nhập Excel/KPI thật. Lịch sử lỗi prerender/hydration/blur và cách sửa được ghi trong handoff; người dùng chưa duyệt cuối cùng về thẩm mỹ.
