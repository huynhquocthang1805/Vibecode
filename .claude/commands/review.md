---
description: (techlead) Review một nhánh/PR theo checklist của dự án
argument-hint: <tên nhánh hoặc số PR>
---

Review **$ARGUMENTS** so với `main`:

1. `git diff main...$ARGUMENTS --stat` rồi đọc diff từng file.
2. Đối chiếu ownership (CLAUDE.md §4): có file nào ngoài phạm vi của role không?
3. Checklist (đánh ✅/❌ + file:dòng):
   - Đúng `src/types/domain.ts`, không đổi chữ ký trong `docs/10_CONTRACTS.md`
   - Không `any`, không `ts-ignore`, không `console.log`
   - Logic ở `lib/` pure; component chỉ hiển thị
   - `safeDiv`; KPI = tỉ số của tổng; ngày theo giờ VN
   - Test có nhánh lỗi/ca biên, không chỉ happy path
   - Không secret, không gọi AI từ client
   - Hiệu năng: không tính nặng trên main thread, selector hẹp, ECharts lazy
   - UI: trạng thái rỗng/tải/lỗi, 375px
   - Có `handoffs/<TASK-ID>.md` + dòng log AI
4. Chạy `/check build` trên nhánh.
5. Kết luận: **APPROVE** / **REQUEST CHANGES** + danh sách việc phải sửa (đánh số, cụ thể).
6. Ghi biên bản `handoffs/REVIEW-<TASK-ID>.md` (đã có → thêm "Vòng N", không xoá vòng cũ): bảng kiểm tra · lỗi R-xx (mức, file, cách sửa) · lưu ý không chặn · điểm tốt. Lỗi đã biết nhưng vẫn merge → test `it.fails` kèm mã R-xx.
Trên GitHub, bước này do `.github/workflows/claude-review.yml` chạy tự động cho mọi PR Ready vào `main`; `scripts/pr-guard.mjs` kiểm phần ownership/handoff/file dùng chung trước.
