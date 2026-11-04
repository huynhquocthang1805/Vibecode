# Handoff — FI-02b · Bảng ảo hoá
- **Role:** frontend-input · **Người:** Minh Trường · ChatGPT (Astral)
- **Nhánh:** feat/frontend-input/FI-02b-FI-03-FI-04-FI-06-FI-07 · **Ngày:** 2026-11-05
- **Contracts:** đã đọc domain.ts và docs/10, không đổi chữ ký.

## Đã làm
Bảng TanStack Virtual, đo chiều cao hàng, thẻ mobile, lọc nguồn/chiến dịch/ngày, sắp xếp số/ngày và đi tới ngày. Giữ sửa, xoá và hoàn tác.

## File thay đổi
Xem diff src/components/input/ của PR cùng nhánh; component công khai cũ giữ nguyên.

## API / component công khai
EntryTable(), EntryFields(props), ImportDialog(props), DataManager(); ArchiveManager(), CampaignManager() dùng nội bộ.

## Kiểm thử
npm run check xanh: lint + typecheck + 57 file test, 3890 passed, 2 expected fail có sẵn. Test nhập liệu riêng: 28/28 xanh, gồm 100k dòng giới hạn DOM, lỗi validation, huỷ/xác nhận lưu trữ, revision đổi và hoàn tác import.

## Cách dùng cho người nhận
Mở tab Bảng dữ liệu / Import / Dữ liệu. Lưu trữ: chọn năm, tải JSON, kiểm file rồi xác nhận xoá. Nhập lại JSON để khôi phục lâu dài.

## Hạn chế / nợ kỹ thuật
Chưa có số đo cuộn 100k trên thiết bị thật; test kiểm số hàng DOM có giới hạn.

## Cần người khác làm
Techlead/data-engineer: xử lý giới hạn hợp đồng nêu trên; PM cập nhật trạng thái task theo chức năng thực tế, không đánh hoàn tất các tiêu chí chưa đo.

## Ghi chú dùng AI
- Prompt chính: đọc AGENTS, lấy main mới nhất, rà toàn bộ nhiệm vụ của Minh Trường, triển khai và tạo PR.
- AI gặp lỗi kiểm thử vì jsdom không có layout cho virtualizer; bổ sung kích thước viewport/hàng trong test, giữ virtualizer thật.
- Không có xác nhận người dùng đã review code; chờ techlead review PR.

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-05 | frontend-input | FI-02b | Bảng ảo hoá và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
