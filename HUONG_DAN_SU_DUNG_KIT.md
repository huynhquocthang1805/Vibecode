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

## 3. Thứ tự chạy agent (mỗi agent = 1 phiên/terminal riêng)
| Bước | Mở phiên | Câu lệnh đầu tiên |
|---|---|---|
| 1 | techlead | `/kickoff techlead TL-01` → `TL-02` → `TL-03` → `TL-04` |
| 1 (song song) | ba-analyst | `/kickoff ba-analyst BA-01` → `BA-05` (giao demo-30d sớm) |
| 2 (sau TL-03) | data-engineer | `/kickoff data-engineer DATA-01` |
| 2 | forecast-engineer | `/kickoff forecast-engineer FC-01` |
| 2 | ai-engineer | `/kickoff ai-engineer AI-01` |
| 2 | frontend-input | `/kickoff frontend-input FI-01` |
| 2 | frontend-dashboard | `/kickoff frontend-dashboard FD-01` |
| 2 | qa-engineer | `/kickoff qa-engineer QA-01` |
| 3 | techlead | `/review <nhánh>` từng PR → `TL-06` (Gate G1) |
| 4 | các role | task P1 trong TASKS.md → Gate G2 → P2 → Gate G3 |
| 5 | pm-release | `PM-02..07`, `/release` |
pm-release có thể chạy `PM-01` (theo dõi) bất cứ lúc nào: "Đọc TASKS.md và handoffs/, cập nhật docs/STATUS.md".

Chạy song song trên 1 máy: dùng worktree để agent không đè file của nhau:
```bash
git worktree add ../kpi-data -b feat/data-engineer/DATA-01
git worktree add ../kpi-fd   -b feat/frontend-dashboard/FD-01
```

## 4. Prompt khởi động (copy cho agent bất kỳ, kể cả không phải Claude Code)
```
Bạn là <ROLE> trong dự án "Dashboard KPI Chiến dịch Mini".
Đọc theo thứ tự: CLAUDE.md, .claude/agents/<ROLE>.md, TASKS.md, src/types/domain.ts, docs/10_CONTRACTS.md
và các tài liệu được nhắc trong task <TASK-ID>.
Chỉ sửa file thuộc quyền sở hữu của bạn. Không đổi chữ ký trong contracts.
Làm task <TASK-ID>: lập kế hoạch ≤ 10 dòng, thực hiện, viết test, chạy lint+typecheck+test đến khi xanh,
rồi ghi handoffs/<TASK-ID>.md theo handoffs/_TEMPLATE.md, cập nhật TASKS.md và docs/11_AI_USAGE_LOG.md.
```

## 5. Nếu có ít agent hơn 9
| Số agent | Gộp |
|---|---|
| 7 | forecast-engineer + data-engineer → "data-forecast" · pm-release + qa-engineer → "qa-release" |
| 5 (giống file gốc) | techlead · data-engineer+ai-engineer (Backend) + frontend-input (FE phụ) · frontend-dashboard (FE chính) · ba-analyst (+ forecast spec) · pm-release+qa-engineer |
Khi gộp: agent mới đọc **cả hai** file role, sở hữu hợp của hai phạm vi.

## 6. Vai trò của bạn (chủ dự án)
- Cấp key AI vào Vercel/`.env.local` (agent không được đọc file này).
- Duyệt `npm install` và `git push` (settings để ở chế độ hỏi).
- Ký 3 gate cùng techlead; quyết định cắt phạm vi khi trễ.
