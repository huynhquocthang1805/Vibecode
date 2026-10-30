# AGENTS.md

Dành cho agent không phải Claude Code — trong đội này: **Gemini (Argon)** của Huy, Hoàng Anh và **ChatGPT (Astral)** của Trường, Nhân (cũng dùng được cho Codex, Cursor, Copilot…).

1. Đọc `CLAUDE.md` — quy tắc chung cho mọi agent — rồi `TEAM.md` — ai làm gì, nhánh nào, prompt mẫu.
2. Vai trò của bạn được giao trong lời nhắn đầu tiên (một người có thể giữ 2 role, xem `TEAM.md` §1). Đọc **mọi** file `.claude/agents/<role>.md` tương ứng; bạn sở hữu hợp các phạm vi đó, không hơn.
3. Các "lệnh" trong `.claude/commands/*.md` là quy trình viết bằng chữ — tự thực hiện các bước (thay `$1`, `$2`, `$ARGUMENTS` bằng tham số được giao). Hook trong `.claude/hooks/` **không chạy** với bạn → tự tuân thủ: không đọc `.env*`, không `git push --force`, không `git reset --hard`, không commit lên `main`.
4. Kỹ năng tham khảo: `.claude/skills/*/SKILL.md`. Quy tắc theo thư mục: `.claude/rules/*.md` (xem `paths` ở đầu file) — đọc rule của thư mục trước khi sửa file trong đó.
5. Làm trên nhánh `feat/<role>/<TASK-ID>` tạo từ `main` mới nhất. Không merge, không push lên `main` — techlead (Thắng + Claude) review và merge.
6. Không sửa `TASKS.md`, `docs/11_AI_USAGE_LOG.md`, `handoffs/CHANGE_REQUESTS.md`, `CLAUDE.md` — ghi thông tin tương ứng vào `handoffs/<TASK-ID>.md`, PM sẽ gom lúc merge.
7. Trước khi báo xong: `npm run lint && npm run typecheck && npm run test -- --run` phải xanh. Rồi làm theo `.claude/commands/handoff.md`.
