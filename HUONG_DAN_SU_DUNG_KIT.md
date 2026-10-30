# Hướng dẫn dùng bộ kit chia việc cho AI agent

## 1. Cài vào repo
1. Tạo repo trống (GitHub), clone về máy.
2. Chép **toàn bộ** nội dung kit này vào thư mục gốc repo (giữ nguyên `.claude/`, `docs/`, `handoffs/`, `src/types/domain.ts`, `CLAUDE.md`, `TASKS.md`…).
3. `chmod +x .claude/hooks/*.sh` (macOS/Linux). Windows: chạy agent trong Git Bash hoặc WSL để hook hoạt động.
4. Commit: `chore: add agent kit`.

## 2. Cấu trúc
```
CLAUDE.md                  luật chung (mọi agent đọc đầu tiên)
AGENTS.md                  hướng dẫn cho agent không phải Claude Code
TASKS.md                   bảng công việc, ID task, owner, phụ thuộc
src/types/domain.ts        hợp đồng dữ liệu v1 (đã viết sẵn)
docs/00..12                đặc tả chi tiết (brief, kiến trúc, schema, KPI, dự báo, AI, UI, báo cáo, test, timeline, contracts, log AI, demo)
.claude/agents/*.md        9 role (subagent)
.claude/commands/*.md      /kickoff /handoff /check /review /gen-mock /perf /release /log-ai
.claude/skills/*/SKILL.md  kpi-metrics, time-series-forecasting, llm-structured-output, big-data-frontend
.claude/rules/*.md         quy tắc tự nạp theo thư mục (paths)
.claude/hooks/*.sh         format sau khi sửa, chặn lệnh nguy hiểm, in tiến độ đầu phiên
.claude/settings.json      quyền + đăng ký hook
.claude/output-styles/     handoff-report (trả lời ngắn dạng bàn giao)
handoffs/                  bàn giao sau mỗi task + change request
```

## 3. Thứ tự chạy agent — đội 5 người (chi tiết: `TEAM.md`)
| Bước | Người · AI | Câu lệnh đầu tiên |
|---|---|---|
| 1 | Thắng · Claude (techlead) | `/kickoff techlead TL-01` → `TL-02` → `TL-03` → `TL-04` |
| 1 (song song) | Nhân · ChatGPT (ba-analyst) | prompt `TEAM.md` §6.1 + §6.2 với `BA-01` → `BA-05` (giao demo-30d sớm) |
| 2 (sau TL-03) | Huy · Gemini (data-engineer + forecast-engineer) | `DATA-01` → … → `DATA-04` → `FC-01` |
| 2 | Hoàng Anh · Gemini (ai-engineer) | `AI-01` |
| 2 | Trường · ChatGPT (frontend-dashboard + frontend-input) | `FD-01` |
| 2 | Nhân · ChatGPT (ba-analyst + qa-engineer) | `BA-02..04` → `QA-01` |
| 3 | Thắng · Claude (techlead) | `/review <nhánh>` từng PR → merge → `TL-06` (Gate G1) |
| 4 | cả đội | task P1 trong TASKS.md → Gate G2 → P2 → Gate G3 |
| 5 | Thắng · Claude (pm-release) | `PM-02..07`, `/release` |
Thắng · Claude chạy `PM-01` (theo dõi) bất cứ lúc nào: "Đọc TASKS.md và handoffs/, cập nhật docs/STATUS.md".

Mỗi người làm trên máy mình, nhánh `feat/<role>/<TASK-ID>`, PR vào `main`; chỉ techlead merge. Nếu một người chạy 2 agent song song trên 1 máy: dùng worktree để agent không đè file của nhau:
```bash
git worktree add ../kpi-data -b feat/data-engineer/DATA-01
git worktree add ../kpi-fc   -b feat/forecast-engineer/FC-01
```

## 4. Prompt khởi động (copy cho agent bất kỳ, kể cả không phải Claude Code)
```
Bạn là <ROLE> trong dự án "Dashboard KPI Chiến dịch Mini".
Đọc theo thứ tự: CLAUDE.md, TEAM.md, AGENTS.md, .claude/agents/<ROLE>.md, TASKS.md, src/types/domain.ts, docs/10_CONTRACTS.md
và các tài liệu được nhắc trong task <TASK-ID>.
Chỉ sửa file thuộc quyền sở hữu của bạn. Không đổi chữ ký trong contracts.
Làm task <TASK-ID>: lập kế hoạch ≤ 10 dòng, thực hiện, viết test, chạy lint+typecheck+test đến khi xanh,
rồi ghi handoffs/<TASK-ID>.md theo handoffs/_TEMPLATE.md (kèm dòng log AI). Không sửa TASKS.md / docs/11 — PM cập nhật lúc merge.
```
Bản đầy đủ theo từng bước (mở đầu, giao task, sửa lỗi, kết thúc, sửa theo review) + bản điền sẵn cho từng người: `TEAM.md` §6.

## 5. Gộp role cho đội 5 người (đang áp dụng)
| Người | Role gộp |
|---|---|
| Thắng · Claude | techlead + pm-release |
| Huy · Gemini (Argon) | data-engineer + forecast-engineer |
| Hoàng Anh · Gemini (Argon) | ai-engineer |
| Trường · ChatGPT (Astral) | frontend-dashboard + frontend-input |
| Nhân · ChatGPT (Astral) | ba-analyst + qa-engineer |
Khi gộp: agent đọc **cả hai** file role, sở hữu hợp của hai phạm vi. Lý do chia: `TEAM.md` §1.

## 6. Vai trò của bạn (chủ dự án)
- Cấp key AI vào Vercel/`.env.local` (agent không được đọc file này).
- Duyệt `npm install` và `git push` (settings để ở chế độ hỏi).
- Mời 4 thành viên vào repo, bật branch protection cho `main` (`TEAM.md` §8); là người duy nhất bấm merge PR.
- Ký 3 gate cùng techlead; quyết định cắt phạm vi khi trễ.
