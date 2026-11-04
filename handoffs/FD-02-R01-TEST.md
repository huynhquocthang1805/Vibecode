# Handoff — FD-02-R01-TEST

- Người: Minh Trường / ChatGPT (Astral); nhánh `feat/frontend-dashboard/FD-02-R01-TEST`.
- Base: origin/main `9568e13`; giữ nguyên contracts.
- Người dùng yêu cầu rõ ngoại lệ ownership: sửa đúng khai báo QA R-01 từ `it.fails` thành `it`, tạo nhánh/PR riêng. Giữ nguyên assertions và R-02/R-03; không đổi code sản phẩm.
- File sửa: `tests/integration/fd-review.review.test.tsx` (một dòng) và handoff này.
- API công khai: không thay đổi.
- Cách dùng: giữ Draft; phụ thuộc frontend fix R-01 tại PR #12. Main hiện chưa có bản sửa KpiCards; không merge test riêng trước frontend.
- Hạn chế: test bình thường sẽ phát hiện lỗi KPI hiện còn trên main. Sau khi kết hợp frontend, chạy lại `npm run check` rồi mới Ready.
- Cần techlead: kết hợp commit test này vào nhánh PR #12 (cherry-pick) rồi chạy CI cho cả frontend + test; không merge riêng test vào main trước frontend. Xác nhận ngoại lệ ownership theo yêu cầu của người dùng. Không đổi TASKS/log dùng chung.
- Ghi chú AI: chuyển expected-failure thành regression test theo yêu cầu; đây không phải skip/xoá test hoặc nới assertions.

## Kiểm thử
- Chạy riêng `npx vitest run tests/integration/fd-review.review.test.tsx` trên main: R-01 fail thực sự vì card còn hiển thị tổng 692 thay cho kỳ hiện tại 14; R-02/R-03 vẫn expected-fail.
- Ghép thử riêng KpiCards từ commit frontend `73416c1` rồi chạy lại cùng file: **1 passed, 2 expected fail**. Hoàn nguyên toàn bộ file KpiCards sau phép kiểm; không commit code sản phẩm vào nhánh test.
- Đã cài dependency đúng lockfile main bằng `npm ci --ignore-scripts`. `npm run check`: lint/typecheck đạt; **3844 passed, 10 expected fail, 1 failed** (R-01 thiếu frontend fix trên main). Giữ Draft, chưa báo hoàn tất/nghiệm thu xanh.

## Log AI để PM tổng hợp
| Ngày | Role | Task | Nội dung | Hạn chế |
|---|---|---|---|---|
| 2026-11-04 | frontend-dashboard, ngoại lệ test QA do người dùng yêu cầu | FD-02-R01-TEST | Đổi duy nhất khai báo R-01, giữ assertions | Phụ thuộc frontend PR #12 |
