---
description: Kết thúc task — ghi bàn giao, cập nhật TASKS và nhật ký dùng AI
argument-hint: <TASK-ID>
---

Hoàn tất task **$ARGUMENTS**:

1. Tạo `handoffs/$ARGUMENTS.md` theo `handoffs/_TEMPLATE.md` (điền đủ mọi mục, kể cả "Hạn chế / nợ kỹ thuật").
2. Trong `TASKS.md`: đổi task thành `[x]`.
3. Thêm 1 dòng vào bảng trong `docs/11_AI_USAGE_LOG.md`: thời gian, role, task, việc AI làm, chỗ AI sai/đội phải sửa (nếu có), file liên quan.
4. Nếu cần đổi file của người khác: ghi vào `handoffs/CHANGE_REQUESTS.md` (không tự sửa).
5. `git add` các file của bạn, commit `feat($ARGUMENTS): <mô tả ngắn>` và tóm tắt cho người dùng 3 dòng: đã làm gì, test thế nào, cần ai làm gì tiếp.
