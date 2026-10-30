# AGENTS.md

Dành cho agent không phải Claude Code (Codex, Cursor, Gemini CLI, Copilot agent…).

1. Đọc `CLAUDE.md` — đây là quy tắc chung, áp dụng cho mọi agent.
2. Vai trò của bạn được giao trong lời nhắn đầu tiên. Đọc file tương ứng trong `.claude/agents/<role>.md` và làm đúng phạm vi sở hữu ở đó.
3. Các "lệnh" trong `.claude/commands/*.md` là quy trình viết bằng chữ — hãy tự thực hiện các bước (thay `$1`, `$2`, `$ARGUMENTS` bằng tham số được giao).
4. Kỹ năng tham khảo: `.claude/skills/*/SKILL.md`. Quy tắc theo thư mục: `.claude/rules/*.md` (xem `paths` ở đầu file).
5. Khi xong task: làm theo `.claude/commands/handoff.md`.
