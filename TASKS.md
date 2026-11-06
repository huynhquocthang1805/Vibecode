# TASKS — Bảng công việc

Trạng thái: `[ ]` chưa làm · `[~] (agent)` đang làm · `[x]` xong (có handoff) · `[!]` bị chặn (ghi lý do).
Chi tiết tiêu chí nghiệm thu từng task: xem file role `.claude/agents/<owner>.md`. Phân công người & quy trình nhánh: `TEAM.md`.
Owner bảng: `pm-release` (Thắng + Claude). **Chỉ PM / Claude review bot sửa file này**: thành viên báo nhận task bằng Draft PR, PM đánh `[~]`; Claude review bot đánh `[x]` trong PR khi APPROVE (merge cùng PR). Thành viên KHÔNG sửa file này trên nhánh của mình (tránh xung đột).

| Người | Công cụ AI | Role |
|---|---|---|
| Thắng (chủ dự án) | Claude (+ ChatGPT review chéo) | techlead + pm-release |
| Huy | Gemini · Argon | data-engineer (+ tài khoản ACC-01..06) |
| Hoàng Anh | Gemini · Argon | ai-engineer (+ FC-07, FC-08) |
| Trường | ChatGPT · Astral | frontend-dashboard + frontend-input |
| Thắng 2 (tài khoản 2) | Claude (tài khoản 2) | forecast-engineer (FC-02..06, 09, 10) + AI-08 |
| Nhân | ChatGPT · Astral | ba-analyst + qa-engineer |

## Wave 0 — Khởi tạo
| | ID | Task | Owner | Người | P | Phụ thuộc |
|---|---|---|---|---|---|---|
| [x] | TL-01 | Khởi tạo repo Next.js + TS strict + Tailwind + shadcn + ESLint/Prettier + Vitest + Playwright + scripts | techlead | Thắng+Claude | P0 | — |
| [x] | TL-02 | Hoàn thiện `src/types/domain.ts` + `docs/10_CONTRACTS.md`, đóng băng v1 | techlead | Thắng+Claude | P0 | — |
| [x] | TL-03 | Skeleton thư mục + stub mọi hàm public + trang ghép placeholder | techlead | Thắng+Claude | P0 | TL-01, TL-02 |
| [x] | TL-04 | CI GitHub Actions + Vercel preview + `.env.example` | techlead | Thắng+Claude | P0 | TL-01 |
| [x] | BA-01 | Chốt `docs/03_KPI_RULES.md` + `src/fixtures/edge-cases.json` (≥ 30 ca) | ba-analyst | Nhân | P0 | — |
| [x] | BA-05 | `scripts/gen-mock.ts` + fixtures demo-30d, campaign-2y | ba-analyst | Nhân | P0 | TL-02 |

## Wave 1 — P0 (MVP)
| | ID | Task | Owner | Người | P | Phụ thuộc |
|---|---|---|---|---|---|---|
| [x] | DATA-01 | Zod schema + validateEntry/validateBatch | data-engineer | Huy | P0 | TL-03, BA-01 |
| [x] | DATA-02 | kpi.ts, format.ts, dates.ts | data-engineer | Huy | P0 | TL-03 |
| [x] | DATA-03 | StorageAdapter localStorage + codec cột + migrate + quota/corrupt | data-engineer | Huy | P0 | DATA-01 |
| [x] | DATA-04 | Zustand store CRUD + duplicate policy + undo + loadMock | data-engineer | Huy | P0 | DATA-03 |
| [x] | DATA-FIX-01 | Sửa R-01..R-05 + hydrate tăng revision (`handoffs/REVIEW-DATA-01-04-FC-01.md`) | data-engineer | Huy | P0 | DATA-04 |
| [x] | DATA-04b | `loadMock` dùng fixture thật của BA-05 (`demo-30d`, `campaign-2y`) + đăng ký 3 chiến dịch mẫu; bỏ dữ liệu tạm dùng `toISOString` | data-engineer | Huy | P0 | BA-05 |
| [x] (thay bằng DATA-05 + DATA-06 thật) | DATA-05-lite | Snapshot P0 trên main thread: `buildRollups`/`getSeries` (không incremental) + `comparePeriods` + `useAnalytics` thật (không Worker) → mở khoá KPI/biểu đồ/AI cho G1 | data-engineer | Huy | P0 | DATA-FIX-01 |
| [x] | FC-01 | analyzeTrend + comparePeriods consumer (TrendSummary) | forecast-engineer | Huy | P0 | TL-03 |
| [x] | BA-02 | `config/thresholds.ts`, `bannedPhrases.ts`, `ruleSuggestions.ts`, `glossary.ts` | ba-analyst | Nhân | P0 | BA-01 |
| [x] | BA-03 | System prompt v1 + user template + few-shot | ba-analyst | Nhân | P0 | TL-02 |
| [x] | BA-04 | `lib/report/templates.ts` (ngắn + đầy đủ) | ba-analyst | Nhân | P0 | TL-02 |
| [x] | AI-01 | Zod request/response + JSON schema provider | ai-engineer | Hoàng Anh | P0 | TL-02 |
| [x] | AI-02 | Route `/api/insights` (validate, size, rate limit, timeout, error map) | ai-engineer | Hoàng Anh | P0 | AI-01 |
| [x] | AI-03 | Provider adapter Gemini (+ OpenAI, + stub cho test) | ai-engineer | Hoàng Anh | P0 | AI-01 |
| [x] | AI-04 | enforceGuardrails (7 bước) | ai-engineer | Hoàng Anh | P0 | AI-01, BA-02 |
| [x] | AI-05 | fallbackInsight rule-based | ai-engineer | Hoàng Anh | P0 | BA-02, FC-01 |
| [x] (R-02..R-04 sửa ở AI-FIX-01, PR #24) | AI-06 | useInsights hook + cache client | ai-engineer | Hoàng Anh | P0 | AI-02 |
| [x] | AI-07 | buildInsightRequest (nén payload) | ai-engineer | Hoàng Anh | P0 | FC-01 |
| [x] (PR #28; E2E F5 xanh desktop + iPhone) | AI-08 | buildReport + copyText | forecast-engineer | Thắng 2 | P0 | BA-04 |
| [x] | AI-FIX-01 | `useInsights`: không gọi khi chưa đủ dữ liệu (E26), gộp request trùng, khoá effect theo cacheKey (R-02..R-04 `handoffs/REVIEW-FD-FI-2026-11-04.md`) | ai-engineer | Hoàng Anh | P0 | AI-06 |
| [x] | FI-01 | EntryForm nhiều dòng + validation inline + dialog trùng ngày | frontend-input | Trường | P0 | DATA-01, DATA-04 |
| [x] | FI-02 | EntryTable (sửa/xoá/hoàn tác) — bản thường, ảo hoá ở FI-02b | frontend-input | Trường | P0 | DATA-04 |
| [x] | FI-05 | DataManager: dữ liệu mẫu, backup xuất/nhập, xoá hết | frontend-input | Trường | P0 | DATA-04 |
| [x] | FD-01 | DashboardShell responsive + header + tabs | frontend-dashboard | Trường | P0 | TL-03 |
| [x] (R-01 sửa ở PR #12) | FD-02 | KpiCards (delta, màu ngữ nghĩa, tooltip, "—") | frontend-dashboard | Trường | P0 | DATA-02 |
| [x] | FD-03 | TrendChart + KpiRatioChart (ECharts, lazy) | frontend-dashboard | Trường | P0 | BA-05 |
| [x] (R-02 sửa cùng AI-FIX-01) | FD-05 | AiInsightCard (5 trạng thái) | frontend-dashboard | Trường | P0 | AI-06 |
| [x] (chạy thật với AI-08 — E2E F5 xanh) | FD-06 | ExportReportButton (dialog, copy, tải .txt, toast) | frontend-dashboard | Trường | P0 | AI-08 |
| [x] | QA-01 | Test ca biên + property-based từ contracts | qa-engineer | Nhân | P0 | BA-01, TL-02 |
| [~] (Thắng+Claude · bot review + review tích hợp) | TL-05 | Review PR liên tục (`/review`) | techlead | Thắng+Claude | P0 | — |
| [x] | TL-06c | Sau AI-08: gỡ `test.fail` F5 (E2E main đang đỏ); route + eval-ai dùng chung `buildSystemPrompt()`/`modelLabel()` (eval trước thiếu few-shot, temperature 0.2 ≠ 0.3); nhãn model = model thật kể cả mặc định | techlead (làm phần ai-engineer) | Thắng+Claude | P0 | AI-08 |
| [x] | TL-06b | Rà soát sau BA-03: AI thật nhận few-shot + nhãn `AI_MODEL@PROMPT_VERSION` + Gemini mặc định `gemini-flash-latest`; lazy AccountMenu/tab phụ/dự báo → bundle 277 → 256 KB | techlead | Thắng+Claude | P0 | BA-03 |
| [x] | TL-06a | Ghép trang (today thật) + E2E smoke G1 desktop/iPhone + chấm G1 lần 1 | techlead | Thắng+Claude | P0 | TL-03 |
| [~] (G1 lần 3 · 2026-11-05: 7/7 tự động — chờ Thắng thử Gemini thật trên điện thoại; handoffs/GATE-G1.md) | TL-06 | Tích hợp end-to-end + **Gate G1** | techlead | Thắng+Claude | P0 | tất cả P0 |

## Wave 4 — P1 (Dữ liệu lớn · Tháng/Quý · Dự báo)
| | ID | Task | Owner | Người | P | Phụ thuộc |
|---|---|---|---|---|---|---|
| [x] | DATA-05 | RollupIndex day/week/month/quarter + applyDelta + like-for-like | data-engineer | Huy | P1 | DATA-02 |
| [x] | DATA-06 | Analytics Worker (Comlink) + useAnalytics + fallback main thread | data-engineer | Huy | P1 | DATA-05 |
| [x] | DATA-07 | parseCsv (worker, chunk) + parsePastedTable + autoMapHeaders | data-engineer | Huy | P1 | DATA-01 |
| [x] | DATA-FIX-02 | Nowcast rỗng: horizon dự báo đủ tới cuối quý, tách try tháng/quý, không nuốt lỗi im lặng (R-07, `handoffs/REVIEW-INTEGRATION-2026-11-04.md`) | data-engineer | Huy | P1 | DATA-06, FC-06 |
| [x] | FC-02 | Baselines naive / seasonal naive / moving avg | forecast-engineer | Thắng 2 | P1 | FC-01 |
| [x] | FC-03 | Holt + Holt-Winters (damped) + grid fit | forecast-engineer | Thắng 2 | P1 | FC-02 |
| [x] | FC-04 | Backtest rolling-origin + chọn mô hình + confidence | forecast-engineer | Thắng 2 | P1 | FC-03 |
| [x] | FC-05 | Khoảng dự báo 80/95 | forecast-engineer | Thắng 2 | P1 | FC-03 |
| [x] | FC-06 | Nowcast tháng/quý + projectedKpis | forecast-engineer | Thắng 2 | P1 | FC-05, DATA-05 |
| [x] | FC-09 | `docs/forecast-validation.md` (sMAPE từng mô hình trên campaign-2y) | forecast-engineer | Thắng 2 | P1 | FC-04, BA-05 |
| [x] | FI-02b | Ảo hoá bảng (100k dòng) + lọc/sort | frontend-input | Trường | P1 | FI-02 |
| [x] | FI-03 | CsvImportDialog + PasteImportDialog (preview, mapping, tiến độ, báo lỗi) | frontend-input | Trường | P1 | DATA-07 |
| [x] | FI-04 | Quản lý chiến dịch + bộ chọn chiến dịch | frontend-input | Trường | P1 | DATA-04 |
| [x] | FI-06 | Form mobile (thẻ dọc, inputMode, format khi gõ) | frontend-input | Trường | P1 | FI-01 |
| [x] | FD-04 | GrainSwitcher + ForecastPanel + vùng dự báo trên biểu đồ | frontend-dashboard | Trường | P1 | FC-06, DATA-06 |
| [x] (runner + báo cáo **mock** — chưa chạy Gemini thật, xem AI-10) | AI-09 | `scripts/eval-ai.ts` + `docs/ai-eval-report.md` | ai-engineer | Hoàng Anh | P1 | BA-06 |
| [x] (8 fixture do Hoàng Anh làm trong AI-09 PR #25 theo đặc tả của Nhân; Nhân rà nội dung) | BA-06 | 8 kịch bản eval AI `src/fixtures/ai-eval/` | ba-analyst | Nhân | P1 | BA-03 |
| [ ] (runner đã sẵn sàng sau TL-06c — chỉ còn thiếu key; ai có key chạy 1 lệnh) | AI-10 | Chạy `npm run eval:ai` với **Gemini thật** (Thắng cấp `AI_API_KEY`, `AI_MODEL=gemini-flash-latest`) sau TL-06c; commit `docs/ai-eval-report.md` thật; kiểm tra 8 kịch bản qua guardrail | ai-engineer | Hoàng Anh | P0 | TL-06b |
| [ ] | BA-07 | Glossary + tooltip + microcopy UI | ba-analyst | Nhân | P1 | — |
| [x] | QA-02 | Integration store↔storage↔worker, migrate, corrupt, quota | qa-engineer | Nhân | P1 | DATA-06 |
| [x] | QA-03 | Test API + guardrails với provider giả (8 lỗi) | qa-engineer | Nhân | P1 | AI-04 |
| [ ] | QA-05 | Perf benchmark + `docs/perf-report.md` | qa-engineer | Nhân | P1 | DATA-06, FC-04 |
| [x] | DATA-10 | Lưu trữ phân vùng theo năm + ghi 2 pha + checksum + Web Locks (docs/13 §2) | data-engineer | Huy | P1 | DATA-03 |
| [x] | DATA-11 | Worker supervisor + cache theo phần + tự chữa lệch checksum (docs/13 §3–4) | data-engineer | Huy | P1 | DATA-06 |
| [ ] | FC-10 | Dự báo bền vững: stale/thưa/winsorize/forecastStatus (docs/13 §5) | forecast-engineer | Thắng 2 | P1 | FC-04 |
| [x] | FI-07 | Chống phình ở khu nhập: đồng hồ dung lượng, lưu trữ năm cũ, hoàn tác import (docs/13 §7) | frontend-input | Trường | P1 | FI-03, DATA-04 |
| [x] | FD-09 | UI dữ liệu lớn & trạng thái suy giảm (docs/13 §7) | frontend-dashboard | Trường | P1 | FD-04, DATA-11 |
| [x] | BA-08 | Ca biên E31–E50 + bộ dữ liệu stress / CSV thực tế (docs/13 §10) | ba-analyst | Nhân | P1 | BA-05 |
| [ ] | QA-08 | Stress & chaos test + bất biến #7–#10 (docs/13 §11) | qa-engineer | Nhân | P1 | DATA-10, DATA-11, BA-08 |
| [ ] | TL-07 | Review hiệu năng/bảo mật/bundle + **Gate G2** | techlead | Thắng+Claude | P1 | P1 |

## Wave A — Tài khoản & database (CR-005, song song G1 — KHÔNG được làm hỏng P0) · đặc tả `docs/14_ACCOUNTS_DB.md`
| | ID | Task | Owner | Người | P | Phụ thuộc |
|---|---|---|---|---|---|---|
| [x] | ACC-00 | Chốt stack, đặc tả docs/14, kiểu domain, stub 6 route (503 khi chưa cấu hình), cài thư viện | techlead | Thắng+Claude | P1 | — |
| [x] | ACC-01 | DB: schema Drizzle (bảng better-auth + profile + user_data), migration `drizzle/`, `getDb()` neon/pglite, harness test PGlite | data-engineer | Huy | P1 | ACC-00 |
| [x] | ACC-02 | better-auth server + `/api/auth/[...all]` + `requireUser` + rate limit; đăng ký/đăng nhập/đăng xuất (A2–A5) | data-engineer | Huy | P1 | ACC-01 |
| [x] | ACC-03 | Hồ sơ + avatar (magic bytes, ≤ 200 KB, cấm SVG) + xoá tài khoản (A6–A8, A11) | data-engineer | Huy | P1 | ACC-02 |
| [x] | ACC-04 | Đồng bộ dữ liệu: `/api/account/data` (revision, 409), không gian localStorage theo user, chuyển dữ liệu khách (A9, A10) | data-engineer | Huy | P1 | ACC-02, DATA-03 |
| [x] | ACC-05 | UI: `AccountMenu`, `AuthDialog`, `ProfileDialog`, nén avatar 256 px bằng canvas, dialog xung đột đồng bộ (A12) | data-engineer | Huy | P1 | ACC-03, ACC-04 |
| [x] | ACC-06 | Test: unit + integration route trên PGlite (A1–A11) + E2E `tests/e2e/account.spec.ts`; `g1-smoke` vẫn xanh khi không có DB | data-engineer | Huy | P1 | ACC-05 |
| [x] | DATA-FIX-03 | Sửa BUG-QA02-01 (store crash khi getter localStorage ném SecurityError) · BUG-QA04-03 (Live x60: debounce snapshot bị reset → cần throttle/maxWait) · phần data của BUG-QA04-02 (horizon bù khoảng dòng cuối → hôm nay). Test `it.fails`/`test.fail` có sẵn — sửa xong đổi thành test thường (docs/bugs.md) | data-engineer | Huy | P1 | QA-02, QA-04 |
| [ ] | AI-FIX-02 | Sửa BUG-QA03-01: lỗi 413 PAYLOAD_TOO_LARGE phải kèm `fallback` (docs/05 §1); đổi `it.fails` trong `tests/integration/insights-api.test.ts` thành `it` | ai-engineer | Hoàng Anh | P1 | QA-03 |
| [ ] | TL-06d | Sửa BUG-QA04-01: gọi `startCrossTabSync()` trong vòng đời trang (DashboardPage) để tab B nhận dòng tab A nhập; bỏ `test.fail` ở `tests/e2e/crosstab.spec.ts` | techlead | Thắng+Claude | P1 | DATA-08 |
| [x] | ACC-FIX-01 | `lib/server/auth.ts` tạo `betterAuth()` lúc import → `npm run build` in `BetterAuthError: default secret` + cảnh báo baseURL khi chưa cấu hình (docs/14 §1.2 yêu cầu im lặng, 503). Khởi tạo lười (chỉ khi `accountConfigured()`), giữ `export const auth` qua getter/CR | data-engineer | Huy | P1 | ACC-02 |
| [x] | ACC-FIX-02 | `npm run db:migrate` hỏng (drizzle.config thiếu `dbCredentials`) → Neon không có bảng, đăng ký lỗi 500. `npm run build` tự migrate qua `scripts/db-migrate.mjs` (neon-http, idempotent, bỏ qua khi không có DB) | techlead | Thắng+Claude | P1 | ACC-06 |
| [x] | ACC-08b | Sau review PR #36: "Gửi lại mã" bắt lỗi mạng; nhắc bấm Gửi lại mã khi đăng ký lại email chưa xác nhận | techlead | Thắng+Claude | P1 | ACC-08 |
| [x] | ACC-FIX-03 | Mở web qua địa chỉ deploy Vercel → đăng ký 403 "Invalid origin": `trustedOrigins` thêm đúng `VERCEL_URL`/`VERCEL_BRANCH_URL`/`VERCEL_PROJECT_PRODUCTION_URL` (không wildcard) | techlead | Thắng+Claude | P1 | ACC-02 |
| [x] | ACC-08 | Xác nhận đăng ký bằng **mã 6 số gửi Gmail** (emailOTP, 10 phút, 5 lần sai, lưu băm), bước nhập mã trong AuthDialog, gửi lại mã, log lỗi SMTP có gợi ý (docs/14 §8) | techlead (phần data-engineer) | Thắng+Claude | P1 | ACC-05 |
| [ ] (code đã sẵn sàng — luồng tài khoản 18/18 với DB thật PGlite; chỉ còn thao tác Vercel, xem handoffs/ACC-FIX-02.md) | ACC-07 | Bật trên Vercel: tạo Neon (Storage → Neon, tự đặt `DATABASE_URL`), đặt `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` → Redeploy (build tự migrate) | techlead | Thắng | P1 | ACC-FIX-02 |

## Wave 5 — P2 (Realtime nâng cao) + Hardening + Release
| | ID | Task | Owner | Người | P | Phụ thuộc |
|---|---|---|---|---|---|---|
| [x] | DATA-08 | Event bus + BroadcastChannel + Live simulator | data-engineer | Huy | P2 | DATA-06 |
| [x] | DATA-09 | IndexedDB adapter + tự chuyển khi vượt ngưỡng | data-engineer | Huy | P2 | DATA-03 |
| [x] | FC-07 | detectAnomalies + detectLiveAnomaly (`anomaly.ts`) | ai-engineer | Hoàng Anh | P2 | FC-05 |
| [x] | FC-08 | Target pacing (`pacing.ts`) | ai-engineer | Hoàng Anh | P2 | FC-06 |
| [x] | FD-07 | LiveModeToggle + AnomalyFeed + animation thẻ | frontend-dashboard | Trường | P2 | DATA-08, FC-07 |
| [x] | FD-08 | Rà soát trạng thái rỗng/lỗi, a11y, dark mode | frontend-dashboard | Trường | P2 | — |
| [~] (Trường xong R-05/R-06/canvas; bundle 256.139 B gzip modern sau TL-06b, còn ~6 KB — cần CR zod phía client; brotli thực tế 217 KiB) | FD-10 | Bundle đầu < 250 KB (lazy `reviewFixture`), renderer canvas khi nhiều điểm, bỏ tên hard-code (R-05, R-06) | frontend-dashboard | Trường | P1 | FD-01 |
| [x] | FD-11 | Kiểm thử UI/UX bằng ảnh (desktop/mobile): gọn log kiểm định AI (bỏ số thô, chữ 9px), dự báo biểu đồ ≤ ½ số ngày + 1 dải tin cậy, bất thường 4 dòng + Xem thêm + chip %, dải "Bắt đầu nhanh" khi trống, thanh công cụ mobile 2 hàng, ẩn nút đăng nhập khi server chưa bật (hết 503) | techlead (phần frontend) | Thắng+Claude | P1 | FD-08 |
| [x] | DATA-12 | Bộ dữ liệu test 8 tình huống (sinh có seed, tính lùi từ hôm nay): tăng trưởng, CPA vọt, CTR giảm, cuối tuần, flash sale, 3 chiến dịch × 2 năm, 50.000 dòng, file có lỗi — "Dùng ngay" / "Tải CSV" trong tab Dữ liệu | techlead | Thắng+Claude | P1 | DATA-07 |
| [ ] | DATA-FIX-04 | Thông báo lỗi nhập liệu dùng tên trường tiếng Anh ("Vui lòng nhập cost", "reach không được âm", "clicks phải là số nguyên") → đổi sang nhãn tiếng Việt từ `METRIC_META` (Chi phí, Lượt tiếp cận, Lượt click) | data-engineer | Huy | P1 | DATA-01 |
| [x] | QA-04 | 8 E2E Playwright (cả mobile, cả trên deploy) | qa-engineer | Nhân | P0* | G1 |
| [ ] | QA-06 | Phiên test vai Marketer + `docs/bugs.md` | qa-engineer | Nhân | P0* | G1 |
| [ ] | QA-07 | Kiểm tra bảo mật nhanh | qa-engineer | Nhân | P0* | G1 |
| [ ] | TL-08 | Tài liệu kiến trúc cuối + **Gate G3** | techlead | Thắng+Claude | P0* | — |
| [~] | PM-01 | Duy trì TASKS + `docs/STATUS.md` hằng ngày | pm-release | Thắng+Claude | P0 | — |
| [ ] | PM-02 | README đầy đủ | pm-release | Thắng+Claude | P0 | G1 |
| [ ] | PM-03 | Deploy production + smoke test | pm-release | Thắng+Claude | P0 | G3 |
| [ ] | PM-04 | Tổng hợp `docs/11_AI_USAGE_LOG.md` (bằng chứng vibe coding) | pm-release | Thắng+Claude | P0 | — |
| [ ] | PM-05 | Kịch bản demo + video + slide | pm-release | Thắng+Claude | P0 | G3 |
| [ ] | PM-06 | Bộ 20 câu hỏi phản biện + đáp án | pm-release | Thắng+Claude | P0 | G2 |
| [ ] | PM-07 | Checklist nộp bài | pm-release | Thắng+Claude | P0 | PM-03 |

`P0*` = bắt buộc cho điểm kiểm thử/bàn giao dù nằm ở wave cuối.
