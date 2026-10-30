---
description: Kết thúc task — ghi bàn giao, mở PR; PM cập nhật TASKS và nhật ký dùng AI lúc merge
argument-hint: <TASK-ID>
---

Hoàn tất task **$ARGUMENTS**:

1. Tạo `handoffs/$ARGUMENTS.md` theo `handoffs/_TEMPLATE.md` (điền đủ mọi mục, kể cả "Hạn chế / nợ kỹ thuật" và "Ghi chú dùng AI" — dòng log để PM chép vào `docs/11_AI_USAGE_LOG.md`).
2. Cần đổi file của người khác: ghi vào mục "Cần người khác làm" của handoff + mô tả PR (techlead chép vào `handoffs/CHANGE_REQUESTS.md`). Không tự sửa.
3. KHÔNG sửa `TASKS.md`, `docs/11_AI_USAGE_LOG.md`, `handoffs/CHANGE_REQUESTS.md` trên nhánh task — PM (Claude) cập nhật trên `main` khi merge.
4. `git add` các file của bạn, commit `feat($ARGUMENTS): <mô tả ngắn>`, `git fetch origin && git rebase origin/main`, chạy lại `/check`, `git push -u origin feat/<role>/$ARGUMENTS`.
5. Mở Pull Request vào `main` theo `.github/pull_request_template.md`, reviewer: techlead (Thắng). Không tự merge.
6. Tóm tắt cho người dùng 3 dòng: đã làm gì, test thế nào, cần ai làm gì tiếp.
