# 11 — Nhật ký sử dụng AI (bằng chứng Vibe Coding)

Owner tổng hợp: `pm-release` (Thắng + Claude). Thành viên ghi dòng log trong `handoffs/<TASK-ID>.md`; PM chép vào bảng dưới lúc merge PR (tránh xung đột khi 5 người cùng sửa một file).

## 1. Đội AI agent & cách điều phối
| Role | File định nghĩa | Người · công cụ AI | Phạm vi |
|---|---|---|---|
| techlead | `.claude/agents/techlead.md` | Thắng · Claude | kiến trúc, contracts, review, merge, gate |
| pm-release | `.claude/agents/pm-release.md` | Thắng · Claude | tiến độ, README, deploy, pitching, tổng hợp log |
| data-engineer | `.claude/agents/data-engineer.md` | Huy · Gemini (Argon) | validation, storage, rollup, worker, realtime |
| forecast-engineer | `.claude/agents/forecast-engineer.md` | Huy · Gemini (Argon) | xu hướng, dự báo, nowcast, bất thường |
| ai-engineer | `.claude/agents/ai-engineer.md` | Hoàng Anh · Gemini (Argon) | API AI, guardrail, fallback, báo cáo |
| frontend-dashboard | `.claude/agents/frontend-dashboard.md` | Trường · ChatGPT (Astral) | dashboard, biểu đồ, AI card |
| frontend-input | `.claude/agents/frontend-input.md` | Trường · ChatGPT (Astral) | form, import, bảng |
| ba-analyst | `.claude/agents/ba-analyst.md` | Nhân · ChatGPT (Astral) | nghiệp vụ, prompt, mock data |
| qa-engineer | `.claude/agents/qa-engineer.md` | Nhân · ChatGPT (Astral) | test, perf, bảo mật |
Đội dùng **3 hệ AI khác nhau** (Claude, Gemini, ChatGPT) trên cùng một bộ luật (`CLAUDE.md` + `AGENTS.md` + `.claude/`), code của mỗi người được AI khác review trước khi merge (Claude review mọi PR; ChatGPT review chéo PR của Claude).
Cơ chế chống xung đột: hợp đồng đóng băng (`src/types/domain.ts`), quyền sở hữu file (CLAUDE.md §4), stub trước, 1 task = 1 nhánh = 1 PR, chỉ techlead merge `main`, file dùng chung (`TASKS.md`, log) chỉ PM sửa, handoff sau mỗi task, cổng chất lượng G1–G3, hook chặn lệnh nguy hiểm, CI.

## 2. Nhật ký
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| | | | | | | |

Loại: Sinh code · Review · AI sai → sửa · Quyết định không theo AI · Prompt.

## 3. Trường hợp AI sai và cách đội phát hiện (≥ 5)
### Mẫu
- **Bối cảnh:** …
- **AI đề xuất:** …
- **Sai ở đâu:** …
- **Phát hiện bằng:** test / review / đối chiếu spec / thử tay
- **Sửa:** …
- **Bài học → đã thêm vào:** rule / skill / test nào

(Các lỗi hay gặp nên chủ động kiểm: trung bình CTR thay vì tỉ số tổng · `new Date('YYYY-MM-DD')` lệch ngày · chia 0 ra Infinity · AI nói "CPA tăng là tốt" · AI trả 4 gợi ý · gọi API AI từ client lộ key · tính lại toàn bộ dữ liệu mỗi lần gõ.)

## 4. Quyết định không theo AI
| Đề xuất của AI | Đội chọn | Lý do |
|---|---|---|
| | | |

## 5. Prompt tiêu biểu
(≥ 10 prompt quan trọng, mỗi prompt ghi: role, mục đích, nội dung rút gọn, kết quả)
