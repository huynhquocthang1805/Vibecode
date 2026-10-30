# CLAUDE.md — Dashboard KPI Chiến dịch Mini (Đề 7)

> File này là "hiến pháp" của dự án. MỌI agent phải đọc file này trước khi làm bất kỳ việc gì.
> Owner: `techlead`. Agent khác KHÔNG được sửa file này — muốn đổi thì ghi vào `handoffs/CHANGE_REQUESTS.md`.
> Đội 5 người — ai giữ role nào, nhánh nào, prompt mẫu cho Gemini/ChatGPT: **`TEAM.md`**.

## 0. Đội
| Người | Công cụ AI | Role |
|---|---|---|
| Thắng (chủ dự án) | Claude (+ ChatGPT review chéo) | `techlead` + `pm-release` — duy nhất được merge vào `main` |
| Huy | Gemini · Argon | `data-engineer` + `forecast-engineer` |
| Hoàng Anh | Gemini · Argon | `ai-engineer` (+ FC-07 bất thường, FC-08 pacing) |
| Trường | ChatGPT · Astral | `frontend-dashboard` + `frontend-input` |
| Nhân | ChatGPT · Astral | `ba-analyst` + `qa-engineer` |
Người giữ 2 role sở hữu hợp 2 phạm vi ở §4. Agent không phải Claude Code đọc thêm `AGENTS.md`.

## 1. Sản phẩm là gì
Web app một trang giúp Marketer (không rành Excel) nhập số liệu quảng cáo theo ngày và đọc chỉ số tự động.
5 tính năng BẮT BUỘC (P0 — chấm 25 điểm):
1. Form nhập số liệu theo ngày: reach, click, chi phí, số đơn hàng — nhập nhiều dòng, lưu localStorage.
2. Biểu đồ đường/cột: reach, chi phí, đơn hàng theo ngày.
3. Tự động tính CTR, CPC, chi phí/đơn hàng (CPA).
4. AI nhận xét xu hướng (tăng/giảm) + đúng 03 gợi ý cải thiện.
5. Nút xuất báo cáo tóm tắt dạng text để copy gửi sếp/khách hàng.

Định hướng nâng cao (ưu tiên của chủ dự án — P1/P2, CHỈ làm sau khi P0 chạy end-to-end):
- **Dữ liệu lớn**: chịu được ≥ 50.000 dòng (nhiều chiến dịch × nhiều năm), import CSV / dán từ Excel, bảng ảo hoá, biểu đồ downsample (LTTB), toàn bộ tính toán nặng chạy trong Web Worker.
- **Thời gian thực**: mọi thay đổi → KPI/biểu đồ/dự báo cập nhật tức thì bằng **cập nhật tăng dần (incremental rollup)**; đồng bộ nhiều tab (BroadcastChannel); "Live mode" mô phỏng dữ liệu chảy vào trong ngày; cảnh báo bất thường realtime.
- **Mô hình dự đoán**: Holt-Winters (mùa vụ tuần) / Holt / baseline, chọn mô hình bằng backtest; khoảng tin cậy 80/95%; **nowcast cuối tháng & cuối quý** = thực tế đến hôm nay + dự báo phần còn lại; tổng hợp theo **Ngày / Tuần / Tháng / Quý**.

## 2. Stack đã chốt (không tự ý thêm thư viện — xin techlead)
| Lớp | Công nghệ | Lý do |
|---|---|---|
| Framework | Next.js (App Router, bản stable mới nhất) + TypeScript `strict` | Có API route giữ API key phía server, deploy Vercel 1 click |
| UI | Tailwind CSS + shadcn/ui + lucide-react + sonner (toast) | Nhanh, đẹp, mobile-first |
| Biểu đồ | Apache ECharts (`echarts`, `echarts-for-react`) | Có `sampling: 'lttb'`, `large`, `dataZoom` → chịu dữ liệu lớn tốt hơn Recharts |
| State | Zustand | Nhẹ, selector tránh re-render |
| Validation | Zod (dùng chung cho form, CSV, API, output AI) | Một nguồn sự thật cho schema |
| Tính toán nền | Web Worker + Comlink | Không block UI khi dữ liệu lớn |
| Bảng lớn | @tanstack/react-virtual | Ảo hoá 100k dòng |
| CSV | papaparse (chế độ worker, chunk) | Import file lớn không treo |
| Ngày tháng | date-fns (ISO week, quarter) | Chuẩn, tree-shakable |
| AI | Google Gemini (structured output JSON) qua adapter; OpenAI là phương án 2 | Có free tier, hỗ trợ `responseSchema` |
| Test | Vitest + Testing Library + fast-check + Playwright | Unit, property-based, E2E, mobile viewport |
| Deploy | Vercel + GitHub Actions CI | Link online + CI xanh làm bằng chứng |

KHÔNG dùng: backend/database riêng (đề không yêu cầu, không cộng điểm), Redux, moment.js, thư viện ML nặng (tensorflow.js) — mô hình dự báo tự viết, thuần TypeScript, có test.

## 3. Lệnh
```bash
npm run dev          # chạy local http://localhost:3000
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (unit + integration)
npm run test:e2e     # Playwright
npm run perf         # benchmark dữ liệu lớn (tests/perf)
npm run gen:mock     # sinh dữ liệu giả lập vào src/fixtures
npm run eval:ai      # chạy bộ đánh giá đầu ra AI
npm run build        # build production
```
Biến môi trường: xem `.env.example`. KHÔNG BAO GIỜ đọc/in/commit `.env.local`. Key AI chỉ dùng ở server (`process.env.AI_API_KEY`), tuyệt đối không có tiền tố `NEXT_PUBLIC_`.

## 4. Cấu trúc thư mục & QUYỀN SỞ HỮU (ownership)
Mỗi file chỉ có 1 owner (role). Người phụ trách role: §0 / `TEAM.md` §2. Agent chỉ được sửa file mình sở hữu + test của mình. Cần sửa file người khác → ghi vào handoff + PR, techlead chuyển vào `handoffs/CHANGE_REQUESTS.md`.

```
src/
  types/domain.ts                 techlead   (HỢP ĐỒNG — đóng băng sau TL-02)
  app/layout.tsx, page.tsx, DashboardPage.tsx   techlead   (ghép trang, nối dữ liệu)
  app/api/insights/route.ts       ai-engineer
  components/ui/**                techlead   (shadcn; cần thêm → nhờ techlead `npx shadcn add`)
  lib/utils.ts, lib/notImplemented.ts   techlead
  components/input/**             frontend-input
  components/dashboard/**         frontend-dashboard
  lib/domain/**                   data-engineer   (kpi.ts, validation.ts, format.ts, dates.ts)
  lib/data/**                     data-engineer   (store, storage, aggregate, realtime, import)
  lib/workers/**                  data-engineer   (host worker; đăng ký hàm của forecast)
  lib/analytics/**                forecast-engineer (trend, forecast, nowcast, backtest)
  lib/analytics/anomaly.ts, pacing.ts   ai-engineer (FC-07, FC-08 — cân tải đội)
  lib/ai/** (trừ prompts/)        ai-engineer
  lib/ai/prompts/**               ba-analyst
  lib/report/buildReport.ts, clipboard.ts   ai-engineer
  lib/report/templates.ts         ba-analyst
  config/**                       ba-analyst      (ngưỡng, benchmark, glossary)
  fixtures/**                     ba-analyst      (mock data)
scripts/gen-mock.ts               ba-analyst
scripts/eval-ai.ts                ai-engineer
tests/integration/** tests/e2e/** tests/perf/**   qa-engineer
package.json, tsconfig, eslint/prettier, next/vitest/playwright config, .github/**, .env.example   techlead
**/*.test.ts cạnh file nguồn      owner của file nguồn
docs/00,01,10,13                  techlead
docs/03,05(phần prompt),07        ba-analyst
docs/04                           forecast-engineer
docs/06                           frontend-dashboard
docs/08                           qa-engineer
docs/09,11,12, STATUS, QA_DEFENSE, SUBMISSION_CHECKLIST, README.md, TASKS.md, TEAM.md, CHANGELOG.md  pm-release
docs/forecast-validation.md      forecast-engineer
docs/ai-eval-report.md           ai-engineer
docs/test-report, perf-report, bugs   qa-engineer
handoffs/**                       mọi agent (mỗi agent ghi file của task mình)
```

## 5. Quy ước code
- TypeScript strict, không `any` (dùng `unknown` + Zod). Không `// @ts-ignore`.
- Hàm tính toán (KPI, aggregate, forecast) là **pure function**, không đụng DOM/localStorage, có unit test.
- Chia an toàn: mọi phép chia qua `safeDiv(a, b): number | null` — mẫu = 0 → `null`, UI hiển thị "—". KHÔNG BAO GIỜ hiển thị `NaN`, `Infinity`.
- **KPI tổng hợp = tỉ số của tổng** (CTR tháng = Σclick / Σreach), KHÔNG lấy trung bình các CTR ngày.
- Ngày lưu dạng `YYYY-MM-DD` theo giờ `Asia/Ho_Chi_Minh`; không dùng `new Date('YYYY-MM-DD')` (bị lệch UTC) — dùng helper trong `lib/domain/dates.ts`.
- Tiền: VND, số nguyên. Hiển thị `Intl.NumberFormat('vi-VN')`. % hiển thị 2 chữ số thập phân.
- Đặt tên: component `PascalCase.tsx`, hàm/biến `camelCase`, hằng `SCREAMING_SNAKE`, file lib `camelCase.ts`.
- Text giao diện: tiếng Việt. Comment code: tiếng Việt hoặc tiếng Anh ngắn gọn.
- Component client nặng (ECharts) phải `dynamic(() => import(...), { ssr: false })`.
- Không gọi AI trực tiếp từ client; client → `/api/insights` → provider.
- Giới hạn dữ liệu chỉ lấy từ `LIMITS` (`domain.ts`). Lỗi runtime không được làm trắng trang: tầng dữ liệu trả trạng thái/phát `system/health`, UI bọc `ErrorBoundary` từng khu (docs/13).

## 6. Quy trình làm việc của agent
1. Đọc: `CLAUDE.md` → `TEAM.md` → file role của mình `.claude/agents/<role>.md` → `TASKS.md` → docs liên quan → `handoffs/` của task phụ thuộc.
2. Nhận task: báo nhóm hoặc mở Draft PR; PM (Claude) đổi `[ ]` → `[~]` trong `TASKS.md` trên `main`.
3. Làm trên nhánh `feat/<role>/<TASK-ID>` tạo từ `main` mới nhất (nếu chạy song song trên cùng máy: dùng `git worktree`). 1 task = 1 nhánh = 1 PR.
4. Viết test cùng lúc với code. Chạy `/check` (lint + typecheck + test) phải xanh.
5. Ghi `handoffs/<TASK-ID>.md` theo `handoffs/_TEMPLATE.md` (gồm dòng log AI + change request nếu có). Thành viên **không** sửa `TASKS.md`, `docs/11_AI_USAGE_LOG.md`, `handoffs/CHANGE_REQUESTS.md` trên nhánh task.
6. Rebase lên `origin/main`, push nhánh, mở PR vào `main` → techlead `/review` → techlead squash merge → PM đánh `[x]` + chép log AI. Không ai khác merge hoặc push lên `main`.

## 7. Definition of Done (mọi task)
- [ ] Đúng hợp đồng trong `src/types/domain.ts` (không tự đổi kiểu).
- [ ] Có test; `npm run lint && npm run typecheck && npm run test` xanh.
- [ ] Không có `console.log` thừa, không `any`, không secret.
- [ ] Xử lý trạng thái rỗng / lỗi / đang tải (nếu là UI).
- [ ] Chạy được trên màn 375px (nếu là UI).
- [ ] Có handoff + log AI.

## 8. Thứ tự ưu tiên khi xung đột
Đúng nghiệp vụ > Ổn định/không crash > 5 tính năng P0 > Hiệu năng dữ liệu lớn > Realtime/Dự báo > Đẹp.
Nếu thiếu thời gian: cắt P2 trước, rồi P1. KHÔNG BAO GIỜ để P0 hỏng vì làm tính năng nâng cao.

## 9. Tài liệu
`docs/00_PROJECT_BRIEF.md` đề bài + rubric · `01_ARCHITECTURE.md` kiến trúc · `02_DATA_SCHEMA.md` lưu trữ ·
`03_KPI_RULES.md` công thức + ca biên · `04_FORECAST_SPEC.md` dự báo · `05_AI_SPEC.md` AI + prompt ·
`06_UI_SPEC.md` giao diện · `07_REPORT_TEMPLATE.md` báo cáo · `08_TEST_PLAN.md` kiểm thử ·
`09_TIMELINE.md` tiến độ · `10_CONTRACTS.md` hợp đồng module · `11_AI_USAGE_LOG.md` bằng chứng vibe coding ·
`12_DEMO_SCRIPT.md` kịch bản demo · **`13_SCALE_RESILIENCE.md` dữ liệu lớn, chống phình, xử lý lỗi (giới hạn = `LIMITS` trong domain.ts)**.

@docs/10_CONTRACTS.md
