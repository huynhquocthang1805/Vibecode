# 11 — Nhật ký sử dụng AI (bằng chứng Vibe Coding)

Owner tổng hợp: `pm-release`. Mọi agent ghi 1 dòng sau mỗi task (`/handoff` hoặc `/log-ai`).

## 1. Đội AI agent & cách điều phối
| Role | File định nghĩa | Model | Phạm vi |
|---|---|---|---|
| techlead | `.claude/agents/techlead.md` | opus | kiến trúc, contracts, review, gate |
| ba-analyst | `.claude/agents/ba-analyst.md` | sonnet | nghiệp vụ, prompt, mock data |
| data-engineer | `.claude/agents/data-engineer.md` | sonnet | validation, storage, rollup, worker, realtime |
| forecast-engineer | `.claude/agents/forecast-engineer.md` | opus | xu hướng, dự báo, nowcast, bất thường |
| ai-engineer | `.claude/agents/ai-engineer.md` | sonnet | API AI, guardrail, fallback, báo cáo |
| frontend-input | `.claude/agents/frontend-input.md` | sonnet | form, import, bảng |
| frontend-dashboard | `.claude/agents/frontend-dashboard.md` | sonnet | dashboard, biểu đồ, AI card |
| qa-engineer | `.claude/agents/qa-engineer.md` | sonnet | test, perf, bảo mật |
| pm-release | `.claude/agents/pm-release.md` | sonnet | tiến độ, README, deploy, pitching |
Cơ chế chống xung đột: hợp đồng đóng băng (`src/types/domain.ts`), quyền sở hữu file (CLAUDE.md §4), stub trước, handoff sau mỗi task, cổng chất lượng G1–G3, hook chặn lệnh nguy hiểm, CI.

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
