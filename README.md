# KPI Mini — Dashboard KPI Chiến dịch (Đề 7)

Web app một trang giúp **Marketer không rành Excel** nhập số liệu quảng cáo theo ngày và đọc chỉ số tự động: CTR / CPC / CPA, biểu đồ, AI nhận xét xu hướng + đúng 3 gợi ý, xuất báo cáo text để gửi sếp/khách hàng.

**🔗 Bản online:** https://vibecode-three-xi.vercel.app/ — Vercel tự deploy mỗi lần merge vào `main`; mỗi PR có link preview riêng.
Không cần đăng nhập: khách dùng đủ 5 tính năng, dữ liệu lưu ngay trên trình duyệt.

## 5 tính năng bắt buộc (P0)
| # | Tính năng | Dùng thế nào |
|---|---|---|
| 1 | **Nhập số liệu theo ngày** — reach, click, chi phí, đơn hàng; nhiều dòng; lưu localStorage | Tab **Nhập tay** (kiểm lỗi ngay: click > reach, số âm, ngày tương lai…) · **Dán Excel** · **Import CSV** (nhận `1.234.000 ₫`, `dd/mm/yyyy`) · trùng ngày → chọn Bỏ qua / Ghi đè / Cộng dồn · Hoàn tác |
| 2 | **Biểu đồ** reach / chi phí / đơn theo ngày | Đường + cột, đổi Ngày / Tuần / Tháng / Quý, kéo zoom, dải dự báo |
| 3 | **Tự tính CTR, CPC, CPA** | Thẻ KPI có ▲▼ so kỳ trước; KPI kỳ = **tỉ số của tổng** (Σclick/Σreach), chia 0 hiện "—" |
| 4 | **AI nhận xét xu hướng + đúng 03 gợi ý** | Bấm **Phân tích** → Gemini (server-side) trả nhận xét + 3 gợi ý; guardrail đối chiếu số liệu; lỗi/hết quota → bản dự phòng rule-based, không bao giờ trống |
| 5 | **Xuất báo cáo text** | Chọn mẫu Ngắn / Đầy đủ → **Sao chép** → dán Zalo / email |

## Nâng cao (P1/P2)
- **Dữ liệu lớn:** 50.000–200.000 dòng (nhiều chiến dịch × nhiều năm); tính toán trong Web Worker, rollup tăng dần, bảng ảo hoá, biểu đồ LTTB; tự chuyển IndexedDB khi localStorage đầy.
- **Thời gian thực:** mọi thay đổi → KPI/biểu đồ/dự báo cập nhật tức thì; đồng bộ nhiều tab; **Live mode** mô phỏng số chảy vào trong ngày; cảnh báo bất thường.
- **Dự báo:** Holt-Winters (mùa vụ tuần) / Holt / baseline, chọn bằng backtest, khoảng tin cậy 80/95%; **dự kiến cuối tháng & cuối quý**; bền vững với ngày gõ nhầm, khoảng trống, dữ liệu cũ.
- **Tài khoản (tuỳ chọn):** đăng ký có mã xác nhận 6 số qua Gmail, hồ sơ + avatar, đồng bộ dữ liệu nhiều máy (Postgres Neon).

## Thử nhanh với bộ dữ liệu test
Kéo xuống khu **Quản lý dữ liệu → Bộ dữ liệu test**: 8 tình huống thật của marketer, ngày tính đến hôm qua.
| Tình huống | Thấy gì |
|---|---|
| Tăng trưởng đều · CPA vọt · CTR giảm (mỏi quảng cáo) · Cuối tuần · Flash sale | Xu hướng, gợi ý AI, cảnh báo bất thường đúng câu chuyện |
| 3 chiến dịch × 2 năm | Đổi Tuần/Tháng/Quý, dự báo cuối quý |
| 50.000 dòng / 25 chiến dịch | UI không đơ |
| CSV lỗi (20 dòng) | Import báo từng dòng lỗi, nhận đúng dòng hợp lệ |
**Dùng ngay** nạp thẳng vào app (thay dữ liệu hiện tại — xuất backup trước nếu cần); **Tải CSV** để thử luồng Import.

## Chạy local
Yêu cầu Node 22 (`.nvmrc`).
```bash
npm ci
```
```bash
cp .env.example .env.local
```
```bash
npm run dev
```
Mở http://localhost:3000. Không có key AI vẫn chạy: thẻ AI dùng bản dự phòng rule-based.

### Biến môi trường (chỉ server — **không** tiền tố `NEXT_PUBLIC_`)
| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `AI_PROVIDER` | — | `gemini` (mặc định) · `openai` · `stub` (chỉ test, cần `ALLOW_STUB=1` ở production) |
| `AI_API_KEY` | để gọi AI thật | Key Google AI Studio (hoặc OpenAI) |
| `AI_MODEL` | — | Mặc định `gemini-flash-latest` |
| `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | để bật tài khoản | Thiếu → chế độ khách, API tài khoản trả 503, không lỗi. `npm run build` tự chạy migration |
| `SMTP_USER`, `SMTP_PASS` | để gửi mã xác nhận | Gmail + Mật khẩu ứng dụng; thiếu → đăng ký không cần mã |
Chi tiết: `.env.example`, `docs/14_ACCOUNTS_DB.md`.

## Lệnh
| Lệnh | Việc |
|---|---|
| `npm run check` | lint + typecheck + test (chạy trước mỗi PR) |
| `npm run test` | Vitest: unit + integration + property-based (≈ 4.260 test) |
| `npm run test:e2e` | Playwright desktop + iPhone 12 (tự build + start; `BASE_URL=...` để test bản deploy) |
| `npm run perf` | Benchmark dữ liệu lớn |
| `npm run eval:ai` | Bộ đánh giá đầu ra AI (8 kịch bản) |
| `npm run gen:mock` | Sinh lại dữ liệu giả lập (seed cố định) |
| `npm run build` | Build production (tự migrate DB nếu có `DATABASE_URL`) |

## Kiến trúc tóm tắt
```
Trình duyệt ── Form / CSV / Dán Excel / Live ──► Zustand store ──► localStorage | IndexedDB (codec cột)
                     │                               │ delta
                     │                               ▼
                     │                    Web Worker (Comlink): rollup tăng dần → KPI, xu hướng,
                     │                    dự báo Holt-Winters, nowcast, bất thường
                     ▼                               │ snapshot
              Dashboard (ECharts, thẻ KPI, AI card, báo cáo) ◄──┘
                     │ số đã tính (không gửi dữ liệu thô)
                     ▼
         /api/insights (server) ── Zod + rate limit ──► Gemini ──► guardrail ──► fallback rule-based
         /api/auth, /api/account (tuỳ chọn) ──► better-auth + Postgres Neon
```
Chi tiết: `docs/01_ARCHITECTURE.md`, `docs/13_SCALE_RESILIENCE.md`.

## Công nghệ
Next.js 16 (App Router, TypeScript strict) · Tailwind 4 + shadcn/ui · ECharts · Zustand · Zod · Web Worker + Comlink · @tanstack/react-virtual · papaparse · Gemini (server-side) · better-auth + drizzle + Neon · Vitest + fast-check + Playwright · Vercel + GitHub Actions. Lý do chọn: `CLAUDE.md` §2.

> Next.js 16 khác nhiều so với kiến thức cũ của AI (Cache Components bật sẵn, `LayoutProps` sinh tự động…). Trước khi code, đọc `AGENTS.md` và tài liệu trong `node_modules/next/dist/docs/`.

## Bằng chứng chất lượng
| | Ở đâu |
|---|---|
| Kiểm thử, ca biên KPI, kết quả QA | `docs/test-report.md`, `docs/08_TEST_PLAN.md`, `src/fixtures/edge-cases.json` |
| Hiệu năng 50k/200k dòng | `docs/perf-report.md` |
| Độ chính xác dự báo (sMAPE thật, so baseline) | `docs/forecast-validation.md` |
| Đánh giá đầu ra AI | `docs/ai-eval-report.md` |
| Lỗi đã biết + trạng thái | `docs/bugs.md` |
| Nhật ký dùng AI (vibe coding) | `docs/11_AI_USAGE_LOG.md` |
| Câu hỏi phản biện | `docs/QA_DEFENSE.md` |

## Đội & cách làm việc
5 người, 6 tài khoản, 3 hệ AI (Claude, Gemini, ChatGPT) — mỗi người giữ 1–2 vai AI agent trong `.claude/agents/`. Phân công, nhánh, prompt mẫu: **`TEAM.md`**; luật chung: **`CLAUDE.md`**; tiến độ: **`TASKS.md`**, **`docs/STATUS.md`**.
Mỗi task = 1 nhánh = 1 PR → CI + PR guard + Claude review bot → techlead duyệt → auto-merge → Vercel deploy.
