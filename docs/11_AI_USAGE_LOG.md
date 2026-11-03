# 11 — Nhật ký sử dụng AI (bằng chứng Vibe Coding)

Owner tổng hợp: `pm-release` (Thắng + Claude). Thành viên ghi dòng log trong `handoffs/<TASK-ID>.md`; PM chép vào bảng dưới lúc merge PR (tránh xung đột khi 5 người cùng sửa một file).

## 1. Đội AI agent & cách điều phối
| Role | File định nghĩa | Người · công cụ AI | Phạm vi |
|---|---|---|---|
| techlead | `.claude/agents/techlead.md` | Thắng · Claude | kiến trúc, contracts, review, merge, gate |
| pm-release | `.claude/agents/pm-release.md` | Thắng · Claude | tiến độ, README, deploy, pitching, tổng hợp log |
| data-engineer | `.claude/agents/data-engineer.md` | Huy · Gemini (Argon) | validation, storage, rollup, worker, realtime |
| forecast-engineer | `.claude/agents/forecast-engineer.md` | Huy · Gemini (FC-01) → Thắng 2 · Claude tk 2 (từ 2026-11-03) | xu hướng, dự báo, nowcast; + AI-08 buildReport |
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
| 2026-11-01 | ba-analyst (Nhân · ChatGPT) | BA-01 | Đặc tả KPI + 81 ca biên (`edge-cases.json`), hướng dẫn adapter QA | Sinh code | AI tự ghi rõ phần chưa xác minh thay vì tuyên bố pass; techlead kiểm lại bằng oracle độc lập: 71/71 ca khớp | `docs/03`, `src/fixtures/edge-cases.json` |
| 2026-11-01 | techlead (Claude) | TL-05 | Review BA-01: oracle Python tính lại kỳ vọng từ docs/03 + LIMITS, không dùng đáp án của fixture | Review | Không tìm thấy sai; chốt 2 điểm BA nêu (CVR > 1, dữ liệu ngày cho like-for-like) → CR-002, CR-003 | `handoffs/CHANGE_REQUESTS.md` |
| 2026-11-02 | data-engineer + forecast-engineer (Huy · Gemini) | DATA-01..04, FC-01 | Validation, KPI/format/dates, codec, store, analyzeTrend + 45 test | Sinh code | AI dùng date-fns (giờ máy) → test CI lệch múi giờ; Huy sửa `bucketRange` sang UTC thuần (commit fix). `bucketKey` còn sót (R-05) | `src/lib/domain`, `src/lib/data`, `trend.ts` |
| 2026-11-02 | techlead (Claude) | TL-05 | Review Huy: fixture 71/71, property test fast-check (store/codec/dates/trend), chạy 4 múi giờ | AI sai → sửa | Fast-check tìm 2 lỗi toàn vẹn dữ liệu test viết tay bỏ sót: undo áp delta cũ sau "Xoá hết" (R-01), sửa ngày tạo 2 dòng cùng khoá (R-02); + R-03..R-05 → DATA-FIX-01 | `tests/integration/data-layer.review.test.ts` |
| 2026-11-02 | data-engineer (Huy · Gemini) | DATA-FIX-01 | Sửa R-01..R-05 theo biên bản review, tự gỡ `it.fails` | Sinh code | Tự viết lại tuần ISO bằng toán UTC (thay date-fns) → techlead đối chiếu Python 7.670 ngày khớp hết | `store.ts`, `dates.ts`, `validation.ts` |
| 2026-11-02 | ba-analyst + qa (Nhân · ChatGPT) | BA-05 | `gen:mock` seed cố định, fixture 2 bộ, 3.000+ test ma trận | Sinh code | Techlead chạy lại theo ví dụ ở comment đầu file → ra file khác; đúng lệnh trong handoff thì trùng từng byte → góp ý ghi lệnh chuẩn ở cả comment | `scripts/gen-mock.ts`, `src/fixtures/*` |
| 2026-11-02 | techlead (Claude) | TL-05 | Review DATA-FIX-01 + BA-05; bổ sung test policy/undo/tuần ISO vào test review | Review | — | `tests/integration/data-layer.review.test.ts` |
| 2026-11-03 | ba-analyst (Nhân · ChatGPT/Codex) | BA-03 | Đặc tả Prompt v1: BR/FR/NFR, prompt đề xuất, serialize, few-shot, AC, eval, 6 rủi ro | Prompt | AI tự phát hiện request thiếu confidence (→ CR-004) và lệch tham chiếu §7/§8 trong docs/05; bản nháp prompt bỏ ví dụ cụm cấm cụ thể — techlead yêu cầu giữ vì model không thấy danh sách | `docs/BA-03.md` |
| 2026-11-03 | techlead (Claude) | TL-05 | Review BA-03; chuyển AC thành 9 test chạy được, kiểm khả thi bằng bản cài đặt mẫu theo spec (9/9 xanh, không commit); chốt RISK-01..06 | Review | — | `tests/integration/ba03-prompt.review.test.ts`, `handoffs/REVIEW-BA-03.md` |
| 2026-11-03 | techlead (Claude) | TL-05 | Chuyển sang quy trình PR tự động: `PR guard` (script kiểm ownership/handoff/file dùng chung), Claude review bot (GitHub Action) ghi biên bản + auto-merge, xoá nhánh sau merge; thêm Thắng 2 | Sinh code | Phát hiện bẫy: commit của bot bằng GITHUB_TOKEN không kích hoạt CI → required check không chạy, auto-merge kẹt → gọi lại CI qua `workflow_dispatch`. Chạy thử guard trên 4 nhánh cũ + 2 ca sai | `.github/workflows/*`, `scripts/pr-guard.mjs` |
| 2026-11-03 | pm (Claude) | PM-01 | Đổi phân công: UI (FD+FI) đã làm local → trả FI cho Trường; Thắng 2 nhận dự báo P1 (từ Huy) + AI-08; cập nhật PR guard theo người | Quyết định | — | `TEAM.md`, `TASKS.md`, `scripts/pr-guard.mjs` |
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
