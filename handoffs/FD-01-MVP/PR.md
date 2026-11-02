## Task
- **ID:** FD-01-MVP
- **Role:** frontend-dashboard + frontend-input
- **Người:** Minh Trường · ChatGPT (Astral/Codex)
- **Handoff:** `handoffs/FD-01-MVP.md`

## Đã làm
Thay các khung UI bằng dashboard Bento off-white/Electric Blue có dark mode, thẻ KPI/sparkline, ECharts, bộ lọc và giao diện AI/báo cáo/dự báo theo contract. Form/bảng/backup dùng store thật: nhập nhiều dòng, validation, xác nhận trùng ngày trước khi ghi batch, sửa/xoá/hoàn tác và khôi phục JSON.

Người dùng chọn chỉ sửa phạm vi frontend. Bản xem trước thẻ/biểu đồ dùng snapshot minh hoạ tĩnh có banner rõ ràng; không thay store hoặc ngụ ý AI/analytics đã tích hợp. Đây là bản frontend để review, chưa phải Gate G1/P0 end-to-end.

## Kiểm thử
- [x] `npm run lint` xanh
- [x] `npm run typecheck` xanh
- [x] `npm run test` xanh: 3.646 test, gồm 31 test frontend mới
- [x] `npm run build` xanh
- [x] Chrome production: 15 kiểm tra, không pageerror/hydration mismatch
- [x] 375/768/1280/1440px không tràn ngang, ảnh sáng/tối tại `handoffs/FD-01-MVP/screens/`

## Tự kiểm
- [x] Chỉ component frontend + docs/06 + handoff; không đổi domain.ts/config/app/lib hoặc file chung được bảo vệ
- [x] Không đổi chữ ký trong docs/10_CONTRACTS.md
- [x] Không any, ts-ignore, console.log, secret, dependency mới
- [x] Đã cập nhật thông tin origin/main mới nhất trước bàn giao; techlead kiểm tra lại trước merge

## Cần người khác làm / change request
- DATA-05/06: snapshot thật. DATA-07: parse CSV/Excel.
- AI-01..08 + BA-04: AI thật và buildReport/copyText/template.
- FC-02..06: dự báo. Live và bảng ảo hoá là P1/P2, chưa triển khai.
- Techlead TL-06 ghép các module vào trang hiện có, xử lý loading/error và bỏ nhãn “store tạm”.
- Techlead thống nhất fixture LF trên Windows bằng .gitattributes (4 test byte BA-05 lỗi khi checkout CRLF).
- Huy hoàn thiện importBackup nhiều chiến dịch/settings. Roundtrip UI hiện kiểm với default.

## Ghi chú dùng AI
Browser phát hiện và agent đã sửa lỗi đọc ngày khi prerender, banner storage hydration và blur làm thay đổi vị trí nút Lưu. Người dùng chưa duyệt thiết kế. Log chi tiết trong handoff; không sửa nhật ký chung.
