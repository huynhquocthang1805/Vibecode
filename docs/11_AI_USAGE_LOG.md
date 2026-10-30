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
| 2026-10-30 | techlead + pm (Claude) | — | Phân công 5 người, quy trình nhánh/PR, prompt cho Gemini/ChatGPT | Prompt | — | `TEAM.md`, `AGENTS.md`, `TASKS.md` |
| 2026-10-30 | techlead (Claude) | — | Rà đặc tả dữ liệu lớn, viết docs/13 | Review | Phát hiện thiết kế cũ sai: tổng có thể vượt 2^53 (cost 1e12 × 50k), debounce thuần không bao giờ ghi khi live x60, id chiếm ~40% quota → sửa bằng `LIMITS`, max-wait, bỏ cột id | `docs/13`, `domain.ts` |
| 2026-10-30 | techlead (Claude) | TL-01 | Khởi tạo Next.js 16.4 + stack + scripts | Sinh code | AI suýt dùng kiến thức Next cũ → đọc `node_modules/next/dist/docs` (Cache Components, `LayoutProps` cần `next typegen` trước `tsc`) | `package.json`, config |
| 2026-10-30 | techlead (Claude) | TL-02 | Bổ sung kiểu còn thiếu (TrendConfig, AnomalyConfig, MetricMeta, ReportTemplate), đóng băng v1 | Sinh code | docs/10 nhắc kiểu chưa định nghĩa → bổ sung trước khi đóng băng | `domain.ts`, `docs/10` |
| 2026-10-30 | techlead (Claude) | TL-03 | Stub mọi hàm public, store tạm, trang ghép, shadcn viết tay | Sinh code | Ảnh chụp 375px lộ tab bị cắt chữ đầu (justify-center + overflow) → sửa `tabs.tsx` | `src/**` |
| 2026-10-30 | techlead (Claude) | TL-04 | CI GitHub Actions (check + e2e trên PR) | Sinh code | — | `.github/workflows/ci.yml` |

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
