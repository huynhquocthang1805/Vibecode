---
description: Chạy lint + typecheck + test (+ build nếu được yêu cầu) và sửa lỗi trong phạm vi file mình sở hữu
argument-hint: [build]
---

Chạy lần lượt và dừng ở bước lỗi đầu tiên:
```
npm run lint
npm run typecheck
npm run test -- --run
```
Nếu tham số là `build` thì chạy thêm `npm run build`.

Với mỗi lỗi: xác định file và owner (CLAUDE.md §4). Lỗi trong file bạn sở hữu → sửa. Lỗi ở file người khác → không sửa, ghi vào `handoffs/CHANGE_REQUESTS.md` (file, lỗi, đề xuất). Chạy lại đến khi các bước thuộc phạm vi của bạn xanh. Báo cáo kết quả dạng bảng: bước | trạng thái | ghi chú.
