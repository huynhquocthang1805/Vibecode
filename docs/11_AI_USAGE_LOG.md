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
> PM-04 (2026-11-08): đã gom **79 dòng** từ `handoffs/*.md` (mỗi task 1–3 dòng) vào bảng này, sắp theo ngày. Dòng gốc vẫn ở handoff của task.

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-10-30 | techlead + pm (Claude) | — | Phân công 5 người, quy trình nhánh/PR, prompt cho Gemini/ChatGPT | Prompt | — | `TEAM.md`, `AGENTS.md`, `TASKS.md` |
| 2026-10-30 | techlead (Claude) | — | Rà đặc tả dữ liệu lớn, viết docs/13 | Review | Phát hiện thiết kế cũ sai: tổng có thể vượt 2^53 (cost 1e12 × 50k), debounce thuần không bao giờ ghi khi live x60, id chiếm ~40% quota → sửa bằng `LIMITS`, max-wait, bỏ cột id | `docs/13`, `domain.ts` |
| 2026-10-30 | techlead (Claude) | TL-01 | Khởi tạo Next.js 16.4 + stack + scripts | Sinh code | AI suýt dùng kiến thức Next cũ → đọc `node_modules/next/dist/docs` (Cache Components, `LayoutProps` cần `next typegen` trước `tsc`) | `package.json`, config |
| 2026-10-30 | techlead (Claude) | TL-02 | Bổ sung kiểu còn thiếu (TrendConfig, AnomalyConfig, MetricMeta, ReportTemplate), đóng băng v1 | Sinh code | docs/10 nhắc kiểu chưa định nghĩa → bổ sung trước khi đóng băng | `domain.ts`, `docs/10` |
| 2026-10-30 | techlead (Claude) | TL-03 | Stub mọi hàm public, store tạm, trang ghép, shadcn viết tay | Sinh code | Ảnh chụp 375px lộ tab bị cắt chữ đầu (justify-center + overflow) → sửa `tabs.tsx` | `src/**` |
| 2026-10-30 | techlead (Claude) | TL-04 | CI GitHub Actions (check + e2e trên PR) | Sinh code | — | `.github/workflows/ci.yml` |
| 2026-11-01 | ba-analyst (Nhân · ChatGPT) | BA-01 | Đặc tả KPI + 81 ca biên (`edge-cases.json`), hướng dẫn adapter QA | Sinh code | AI tự ghi rõ phần chưa xác minh thay vì tuyên bố pass; techlead kiểm lại bằng oracle độc lập: 71/71 ca khớp | `docs/03`, `src/fixtures/edge-cases.json` |
| 2026-11-01 | techlead (Claude) | TL-05 | Review BA-01: oracle Python tính lại kỳ vọng từ docs/03 + LIMITS, không dùng đáp án của fixture | Review | Không tìm thấy sai; chốt 2 điểm BA nêu (CVR > 1, dữ liệu ngày cho like-for-like) → CR-002, CR-003 | `handoffs/CHANGE_REQUESTS.md` |
| 2026-11-01 | `ba-analyst` | BA-01 | Hỗ trợ đối chiếu tài liệu, soạn handoff theo template | Tài liệu/bàn giao | Chưa có ghi nhận lỗi cụ thể; test fixture/runtime vẫn cần QA xác minh | `handoffs/BA-01.md` |
| 2026-11-02 | data-engineer + forecast-engineer (Huy · Gemini) | DATA-01..04, FC-01 | Validation, KPI/format/dates, codec, store, analyzeTrend + 45 test | Sinh code | AI dùng date-fns (giờ máy) → test CI lệch múi giờ; Huy sửa `bucketRange` sang UTC thuần (commit fix). `bucketKey` còn sót (R-05) | `src/lib/domain`, `src/lib/data`, `trend.ts` |
| 2026-11-02 | techlead (Claude) | TL-05 | Review Huy: fixture 71/71, property test fast-check (store/codec/dates/trend), chạy 4 múi giờ | AI sai → sửa | Fast-check tìm 2 lỗi toàn vẹn dữ liệu test viết tay bỏ sót: undo áp delta cũ sau "Xoá hết" (R-01), sửa ngày tạo 2 dòng cùng khoá (R-02); + R-03..R-05 → DATA-FIX-01 | `tests/integration/data-layer.review.test.ts` |
| 2026-11-02 | data-engineer (Huy · Gemini) | DATA-FIX-01 | Sửa R-01..R-05 theo biên bản review, tự gỡ `it.fails` | Sinh code | Tự viết lại tuần ISO bằng toán UTC (thay date-fns) → techlead đối chiếu Python 7.670 ngày khớp hết | `store.ts`, `dates.ts`, `validation.ts` |
| 2026-11-02 | ba-analyst + qa (Nhân · ChatGPT) | BA-05 | `gen:mock` seed cố định, fixture 2 bộ, 3.000+ test ma trận | Sinh code | Techlead chạy lại theo ví dụ ở comment đầu file → ra file khác; đúng lệnh trong handoff thì trùng từng byte → góp ý ghi lệnh chuẩn ở cả comment | `scripts/gen-mock.ts`, `src/fixtures/*` |
| 2026-11-02 | techlead (Claude) | TL-05 | Review DATA-FIX-01 + BA-05; bổ sung test policy/undo/tuần ISO vào test review | Review | — | `tests/integration/data-layer.review.test.ts` |
| 2026-11-02 | `ba-analyst` | BA-05 | Đối chiếu review DATA-01/02, cập nhật generator, 2 fixture, +621 ca, khung docs và handoff | Code/test/docs | Tránh R-05 qua weekday UTC; chưa thể chạy npm do EAI_AGAIN, cần test lại trên repo | `scripts/gen-mock.ts`, `src/fixtures/*`, `tests/integration/*`, `handoffs/BA-05.md` |
| 2026-11-02 | frontend-dashboard + frontend-input | FD-01-MVP | Bento responsive sáng/tối, KPI/ECharts, form/bảng/backup, trạng thái phụ thuộc, test và ảnh review | Tạo code + kiểm thử + tự phản biện | Browser tìm ra prerender/hydration và blur làm mất click; đã sửa. Người dùng chưa review. | src/components/dashboard/**; src/components/input/**; docs/06_UI_SPEC.md |
| 2026-11-03 | ba-analyst (Nhân · ChatGPT/Codex) | BA-03 | Đặc tả Prompt v1: BR/FR/NFR, prompt đề xuất, serialize, few-shot, AC, eval, 6 rủi ro | Prompt | AI tự phát hiện request thiếu confidence (→ CR-004) và lệch tham chiếu §7/§8 trong docs/05; bản nháp prompt bỏ ví dụ cụm cấm cụ thể — techlead yêu cầu giữ vì model không thấy danh sách | `docs/BA-03.md` |
| 2026-11-03 | techlead (Claude) | TL-05 | Review BA-03; chuyển AC thành 9 test chạy được, kiểm khả thi bằng bản cài đặt mẫu theo spec (9/9 xanh, không commit); chốt RISK-01..06 | Review | — | `tests/integration/ba03-prompt.review.test.ts`, `handoffs/REVIEW-BA-03.md` |
| 2026-11-03 | techlead (Claude) | TL-05 | Chuyển sang quy trình PR tự động: `PR guard` (script kiểm ownership/handoff/file dùng chung), Claude review bot (GitHub Action) ghi biên bản + auto-merge, xoá nhánh sau merge; thêm Thắng 2 | Sinh code | Phát hiện bẫy: commit của bot bằng GITHUB_TOKEN không kích hoạt CI → required check không chạy, auto-merge kẹt → gọi lại CI qua `workflow_dispatch`. Chạy thử guard trên 4 nhánh cũ + 2 ca sai | `.github/workflows/*`, `scripts/pr-guard.mjs` |
| 2026-11-03 | pm (Claude) | PM-01 | Đổi phân công: UI (FD+FI) đã làm local → trả FI cho Trường; Thắng 2 nhận dự báo P1 (từ Huy) + AI-08; cập nhật PR guard theo người | Quyết định | — | `TEAM.md`, `TASKS.md`, `scripts/pr-guard.mjs` |
| 2026-11-03 | ai-engineer | AI-01 | Xây dựng Zod request/response schema, JSON schema provider và hàm chuyển đổi Gemini schema | Code + Test | Khắc phục type inference khi dùng .extend() trên ZodType | src/lib/ai/schemas.ts, src/lib/ai/schemas.test.ts |
| 2026-11-03 | ai-engineer | AI-02 | Viết route POST /api/insights (body 32KB, rate limit 10/min, LRU cache, retry, error map) | Code + Test | Đảm bảo luôn kèm fallbackInsight cho các mã lỗi 4xx/5xx | src/app/api/insights/route.ts, src/app/api/insights/route.test.ts |
| 2026-11-03 | ai-engineer | AI-03 | Triển khai provider Gemini, OpenAI, Stub và factory getProvider | Code + Test | Khắc phục mock server-only khi chạy unit test trên môi trường Vitest | src/lib/ai/provider/** |
| 2026-11-03 | ai-engineer | AI-04 | Triển khai 7 bước guardrails kiểm soát đầu ra LLM | Code + Test | Đảm bảo kiểu tuple 3 gợi ý không bị undefined trong TypeScript strict | src/lib/ai/guardrails.ts, src/lib/ai/guardrails.test.ts |
| 2026-11-03 | ai-engineer | AI-05 | Triển khai hàm fallbackInsight deterministic và thư viện luật gợi ý | Code + Test | Sắp xếp độ ưu tiên high -> medium -> low đảm bảo lấy đúng 3 gợi ý | src/lib/ai/fallback.ts, src/lib/ai/fallback.test.ts |
| 2026-11-03 | ai-engineer | AI-06 | Triển khai client hook useInsights, cache localStorage 24h và debounce refresh | Code + Test | Khắc phục dependency array và hủy request an toàn trong React 19 | src/lib/ai/useInsights.ts, src/lib/ai/useInsights.test.tsx |
| 2026-11-03 | ai-engineer | AI-07 | Xây dựng hàm buildInsightRequest nén payload, sanitize tên và tính confidence | Code + Test | Tối ưu số kỳ recent để payload 730 ngày luôn < 12KB | src/lib/ai/buildRequest.ts, src/lib/ai/buildRequest.test.ts |
| 2026-11-03 | ba-analyst + qa-engineer | BA-06 | Soạn đặc tả/handoff, kiểm recipe/request, sửa hai assertion CRLF; Linux mô phỏng và ảnh Windows đều đạt 3.616 passed + 8 expected fail; chuẩn bị gửi nhánh theo yêu cầu Nhân | Tài liệu/sửa test/bàn giao | Nhân phát hiện lỗi EOL do main thiếu bản vá; đã sửa, ảnh Windows sau sửa không còn fail thực tế; eval AI chưa chạy | docs/BA-06.md; handoffs/BA-06.md; tests/integration/gen-mock.test.ts; tests/integration/gen-mock.review.test.ts |
| 2026-11-03 20:35 | data-engineer | DATA-05 | Triển khai RollupIndex mảng dày + getSeries + comparePeriods like-for-like | Code + Test | Khắc phục noUncheckedIndexedAccess TypedArray | `src/lib/data/aggregate/**` |
| 2026-11-03 20:35 | data-engineer | DATA-06 | Analytics worker Comlink + fallback client + hook useAnalytics self-healing | Code + Test | Đảm bảo hook không throw khi render | `src/lib/workers/**` |
| 2026-11-03 20:35 | data-engineer | DATA-07 | Csv/Paste parser + autoMapHeaders + importBatch atomic | Code + Test | Khắc phục kiểu error callback của Papa.parse | `src/lib/data/import/**`, `src/lib/data/store.ts` |
| 2026-11-04 | techlead (Claude bot) | TL-05 | Bot review chạy thật lần đầu: PR #4 vòng 1 bắt vòng lặp vô hạn useAnalytics↔DashboardPage + không incremental (6 lỗi) → vòng 2 APPROVE; PR #6 APPROVE; PR #3 bắt build đỏ (`runtime` không hợp Cache Components) | Review | — | `handoffs/REVIEW-*.md` |
| 2026-11-04 | techlead (Claude) | TL-05 | Review tích hợp sau 3 PR: chạy engine trên fixture thật → phát hiện nowcast luôn rỗng (horizon 30 ngày < cuối quý, 2 nowcast chung 1 try, catch rỗng) — lỗi ghép giữa 2 PR đều đã APPROVE riêng; PR guard bỏ sót DATA-06 do tên nhánh dạng dải → sửa | AI sai → sửa | Từng PR qua bot nhưng lỗi chỉ lộ khi ghép → thêm `tests/integration/pipeline.review.test.ts` (it.fails R-07) | `analytics.worker.ts`, `scripts/pr-guard.mjs` |
| 2026-11-04 | techlead (Claude) | TL-05 | Review lại UI của Trường bằng cách chạy production + nhập số liệu qua form như marketer (bot chỉ đọc code + chạy test) | Review | Bot APPROVE nhưng chạy thật lộ: KPI hiện tổng kỳ kèm delta của 1 ngày (R-01), AI tự gọi khi trang trống → 400 (R-02, vi phạm E26), 2 request trùng mỗi lần (R-03), bundle 297 KB > 250 KB → 3 test it.fails | `tests/integration/fd-review.review.test.tsx` |
| 2026-11-04 | techlead (Claude) | ACC-00 | Hỏi chủ dự án trước khi đổi kiến trúc (CLAUDE.md cấm backend), chọn stack, đặc tả + stub cho Huy | Quyết định | AI đề xuất làm cục bộ (đúng luật cũ); chủ dự án chọn server thật → ghi CR-005, giữ ràng buộc "không làm hỏng P0" | `docs/14`, `domain.ts` |
| 2026-11-04 18:10 | data-engineer | ACC-01 | Tạo Drizzle schema, migration, getDb hỗ trợ Neon/PGlite | feat | `resetDb` ban đầu close client làm gãy singleton better-auth; sửa thành truncate/delete | src/lib/server/db/client.ts |
| 2026-11-04 18:10 | data-engineer | ACC-02 | Tích hợp better-auth server, requireUser, rate limit, authClient, route handler | feat | Không có | src/lib/server/auth.ts, src/app/api/auth/[...all]/route.ts |
| 2026-11-04 18:35 | data-engineer | ACC-03 | Xây dựng API profile, avatar magic bytes và xoá tài khoản xác nhận | feat | Không có | src/app/api/account/profile/route.ts, src/app/api/account/avatar/route.ts, src/app/api/account/route.ts |
| 2026-11-04 18:35 | data-engineer | ACC-04 | API sync dữ liệu cloud có kiểm soát revision 409, storage isolation theo user | feat | Kiểm tra revision rồi mới update không atomic; sửa thành optimistic locking update where revision = baseRevision | src/app/api/account/data/route.ts, src/lib/data/storage/userStorage.ts |
| 2026-11-04 18:35 | data-engineer | ACC-05 | Xây dựng bộ UI Account: AccountMenu, AuthDialog, ProfileDialog, ConflictDialog, nén canvas avatar | feat | React 19 linter cảnh báo setState trong useEffect; sửa thành derived state và async promise resolution | src/components/account/AccountMenu.tsx, src/components/account/useAccount.ts |
| 2026-11-04 19:05 | data-engineer | ACC-05 | Sửa R-02 resolveConflict local đọc key fallback và báo lỗi khi PUT thất bại | fix | Không có | src/components/account/useAccount.ts, src/components/account/accountUi.test.tsx |
| 2026-11-04 18:35 | data-engineer | ACC-06 | Viết test suite A1–A11 trên PGlite và test E2E Playwright A1, A12 | test | Chạy sign-up lặp lại trong test làm dính rate limit; sửa dynamic IP/email để cô lập | src/app/api/account/account.test.ts |
| 2026-11-04 | ba-analyst (techlead làm thay) | BA-02 | Soạn cụm cấm, tách luật fallback ra config + luật cuối tuần, glossary, test | content+code | Dùng nhầm kiểu `SeriesBucket` (không tồn tại) → typecheck bắt, đổi sang `InsightRequest['recent'][number]` | `src/config/*` |
| 2026-11-04 | qa-engineer + ba-analyst | BA-03 / PR #13 | Sửa E2E theo review Huy, thêm chờ 350 ms, kiểm KPI sau reload, cập nhật handoff và chạy kiểm chứng trên main có DATA-HOTFIX-01 | Test / tài liệu | Phân biệt chờ debounce với hotfix runtime và expected-failure với ca chức năng đạt; không khẳng định CI xanh trước push | tests/e2e/g1-smoke.spec.ts; handoffs/BA-03.md |
| 2026-11-04 | ba-analyst (techlead làm thay) | BA-04 | Chép mẫu docs/07, thiết kế khối tuỳ chọn + fillTemplate, 13 test | content+code | Khối bị bỏ để lại 1 dòng trống thừa → test bắt, sửa regex | `src/lib/report/templates.ts` |
| 2026-11-04 | data-engineer | DATA-04b | Sửa R-01 & R-02: validateEntry cho edge-cases, test chặt clicks <= reach và loại trừ ID lỗi | Code + Test | Khắc phục format kết quả của validateBatch | src/lib/data/store.ts, src/lib/data/store.test.ts |
| 2026-11-04 | data-engineer | DATA-08 | Xây dựng CrossTab sync (BroadcastChannel + storage fallback) và Live Simulator với diurnal curve, CPC shock | Code + Test | Tránh echo bằng tabId, chống lặp vô hạn và sửa R-03 dùng hourVN | src/lib/data/realtime/crossTab.ts, src/lib/data/realtime/liveSimulator.ts |
| 2026-11-04 | data-engineer | DATA-09 | Triển khai IndexedDB adapter thuần, 2-way migration, auto-switch, sửa R-01 xác minh trước khi clear và R-02 chống race persist | Code + Test | Xác minh persistent storage trước khi xoá nguồn cũ và hoãn persist trong lúc migrate | src/lib/data/storage/indexedDbAdapter.ts, src/lib/data/store.ts |
| 2026-11-04 | data-engineer | DATA-10 | Lưu trữ phân vùng theo năm, ghi 2 pha, tự kiểm tra rows/sum và Web Locks | Code + Test | Sửa R-01 không reject khi quota, R-02 phát hiện bẩn bằng hash, R-03 dọn rác an toàn | src/lib/data/storage/**, src/lib/data/store.ts |
| 2026-11-04 | data-engineer | DATA-11 | Worker supervisor, typed array packEntries, cache theo phần completedVersion và tự chữa lệch | Code + Test | Sửa R-04 bảo toàn delta khi restart, R-05 bổ sung test supervisor và self-healing | src/lib/workers/**, src/lib/workers/supervisor.test.ts |
| 2026-11-04 | data-engineer | DATA-FIX-02 | Tính toán horizon bao phủ cuối quý cho nowcast, tách try/catch tháng và quý, gỡ it.fails R-07 | Code + Test | Đảm bảo chỉ gọi nowcast khi có ít nhất 1 dự báo được tạo | src/lib/workers/analytics.worker.ts, src/lib/workers/analytics.test.ts, tests/integration/pipeline.review.test.ts |
| 2026-11-04 | forecast-engineer | FC-02 | Baselines và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/models/baselines.ts, src/lib/analytics/models/modelMath.ts, src/lib/analytics/models/baselines.test.ts |
| 2026-11-04 | forecast-engineer | FC-03 | Holt, Holt-Winters và grid SSE và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/models/holt.ts, src/lib/analytics/models/holtWinters.ts, src/lib/analytics/models/fitModel.ts, src/lib/analytics/models/smoothing.test.ts |
| 2026-11-04 | forecast-engineer | FC-04 | Backtest và chọn mô hình và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/models/backtest.ts, src/lib/analytics/models/fitBest.ts, src/lib/analytics/models/evaluation.ts, src/lib/analytics/models/backtest.test.ts, src/lib/analytics/forecast.ts, src/lib/analytics/forecast.test.ts, src/lib/analytics/prepareDaily.ts, src/lib/analytics/forecastConfig.ts, src/lib/analytics/testSeries.ts |
| 2026-11-04 | forecast-engineer | FC-05 | Khoảng dự báo 80/95% và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/intervals.ts, src/lib/analytics/intervals.test.ts, src/lib/analytics/forecast.ts |
| 2026-11-04 | forecast-engineer | FC-06 | Nowcast tháng/quý và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/nowcast.ts, src/lib/analytics/nowcast.test.ts |
| 2026-11-04 | forecast-engineer | FC-02–06, FC-09 | Thuật toán, test, đo thực tế, handoff | Code/test/docs | AI tự sửa test harness/precision/union; tối ưu SSE sau đo vượt ngân sách, kết quả sai số giữ nguyên | src/lib/analytics/**, docs/forecast-validation.md, handoffs/FC-*.md |
| 2026-11-04 | forecast-engineer | FC-09 | Báo cáo kiểm định và kiểm thử/đối chiếu contracts | Code/test/docs | AI tự sửa lỗi test harness, precision/union; chưa có phản biện người dùng | src/lib/analytics/forecastValidation.ts, src/lib/analytics/forecastValidation.test.ts, docs/forecast-validation.md, docs/04_FORECAST_SPEC.md |
| 2026-11-04 | frontend-dashboard | FD-02 | Đồng bộ số chính và delta, giữ tổng có nhãn; test hồi quy | fix | QA cần bỏ expected-failure sau sửa lỗi | KpiCards.tsx, KpiCards.test.tsx |
| 2026-11-04 | frontend-dashboard | FD-05 | Guard đủ dữ liệu trước useInsights, test 6 trạng thái | fix | AI-FIX-01 vẫn cần sửa hook dùng chung | AiInsightCard.tsx, AiInsightCard.test.tsx |
| 2026-11-04 | frontend-dashboard + frontend-input | FD-10 | Lazy fixture/dialog/tab/AI content, modular ECharts + Canvas/resize, bỏ tên cá nhân; đo bundle và browser | fix/perf | Lazy fixture chưa đủ budget; sửa thêm theo số đo, ghi rõ nomodule | DashboardShell, EChartCanvas, dialog/tab components, handoffs/FD-10 |
| 2026-11-04 | techlead (Claude) | TL-06a | Ghép today thật, E2E G1, chấm G1 | Sinh code | AI dùng `useState(() => todayVN())` → build Next 16 lỗi (new Date() lúc prerender), thử effect → lint chặn; đúng là `useSyncExternalStore`. E2E F5 lần đầu tưởng thất bại sai lý do do grep trộn log 2 test — chạy riêng xác nhận đúng | `DashboardPage.tsx`, `g1-smoke.spec.ts` |
| 2026-11-05 | forecast-engineer (Thắng 2) | AI-08 | buildReport, copyText, 38 test gồm 8 snapshot; check 4.050 test xanh | code + test | Cập nhật giả định BA-04 sau fetch; chưa có phản hồi sửa lỗi từ người dùng | src/lib/report/buildReport.ts, clipboard.ts và test; handoffs/AI-08.md |
| 2026-11-05 10:55 | ai-engineer | AI-09 | Dựng 8 fixtures ai-eval, evalMetrics, scripts/eval-ai.ts, 51 unit tests và khắc phục R-01..R-03 từ review Claude bot | Sinh mã & Tái cấu trúc | Đã sửa R-01 (báo cáo trung thực n/a mock), R-02 (51 unit tests phủ toàn diện runner), R-03 (loại bỏ Math.random) | scripts/eval-ai.ts, src/lib/ai/evalMetrics.ts, src/lib/ai/eval.test.ts, docs/ai-eval-report.md, handoffs/AI-09.md |
| 2026-11-05 10:05 | ai-engineer | AI-FIX-01 | Sửa R-02 guard sufficient (E26), R-03 in-flight request dedup, R-04 khoá effect theo cacheKey+revision | fix | React 19 cảnh báo ref trong render và setState trong effect; sửa thành effect ref và derived state | src/lib/ai/useInsights.ts, src/lib/ai/useInsights.test.tsx, tests/integration/fd-review.review.test.tsx, tests/e2e/g1-smoke.spec.ts |
| 2026-11-05 10:15 | ai-engineer | AI-FIX-01 | Sửa R-05 chống race condition đè kết quả khi đổi grain hoặc unmount, thêm 3 unit test | fix | Không có | src/lib/ai/useInsights.ts, src/lib/ai/useInsights.test.tsx |
| 2026-11-05 11:35 | ai-engineer | FC-07 | Cài đặt detectAnomalies và detectLiveAnomaly theo robust z / MAD | Sinh code + test | Test ban đầu cho live spike orders đồng thời làm tăng cost -> điều chỉnh test để cô lập orders | `src/lib/analytics/anomaly.ts`, `src/lib/analytics/anomaly.test.ts` |
| 2026-11-05 11:35 | ai-engineer | FC-08 | Cài đặt computePacing và computeRequiredDailyRate | Sinh code + test | Không có lỗi phát sinh | `src/lib/analytics/pacing.ts`, `src/lib/analytics/pacing.test.ts` |
| 2026-11-05 | frontend-dashboard | FD-04 | Grain và dự báo + test/browser | Code/test | Sửa sheet/ID sau browser | src/components/dashboard/, src/components/input/EntryForm.tsx |
| 2026-11-05 | frontend-dashboard | FD-07 | Live và cảnh báo + test/browser | Code/test | Sửa sheet/ID sau browser | src/components/dashboard/, src/components/input/EntryForm.tsx |
| 2026-11-05 | frontend-dashboard | FD-08 | Mobile, dark mode và a11y + test/browser | Code/test | Sửa sheet/ID sau browser | src/components/dashboard/, src/components/input/EntryForm.tsx |
| 2026-11-05 | frontend-dashboard | FD-09 | Dữ liệu lớn và trạng thái suy giảm + test/browser | Code/test | Sửa sheet/ID sau browser | src/components/dashboard/, src/components/input/EntryForm.tsx |
| 2026-11-05 | frontend-input | FI-02b | Bảng ảo hoá và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
| 2026-11-05 | frontend-input | FI-03 | Nhập CSV và Excel và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
| 2026-11-05 | frontend-input | FI-04 | Quản lý chiến dịch và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
| 2026-11-05 | frontend-input | FI-06 | Nhập liệu mobile và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
| 2026-11-05 | frontend-input | FI-07 | Lưu trữ và sức chứa và kiểm thử | Code + test | Sửa fixture layout jsdom qua test | src/components/input/ |
| 2026-11-05 | techlead | TL-06b | Quét main, tìm 5 lỗi tích hợp, sửa + test, đo bundle 3 vòng | review+fix | Đo bundle lần đầu tính cả polyfill `noModule` (38 KB) → đo lại chỉ script modern | route.ts, gemini.ts, DashboardPage.tsx |
| 2026-11-05 | techlead (làm phần ai-engineer) | TL-06c | Quét main sau AI-08, phát hiện E2E đỏ + eval lệch production, tách module prompt dùng chung | review+fix | — | systemPrompt.ts, route.ts, eval-ai.ts, g1-smoke.spec.ts |
| 2026-11-06 | techlead (phần data-engineer) | ACC-08, ACC-FIX-03 | emailOTP + Gmail SMTP, bước nhập mã, test PGlite; trusted origins Vercel | feature | Phát hiện better-auth nuốt lỗi gửi thư → thêm log gợi ý + nhắc Spam; selector test trùng tên nút → sửa test | auth.ts, mailer.ts, AuthDialog.tsx, accountConfig.ts |
| 2026-11-06 23:15 | data-engineer | ACC-FIX-01 | Khởi tạo lười betterAuth() qua Proxy khi accountConfigured() | Sửa lỗi + test | Không có lỗi phát sinh | `src/lib/server/auth.ts`, `src/app/api/auth/auth.test.ts` |
| 2026-11-06 | techlead | ACC-FIX-02 | Chạy luồng tài khoản 18 bước trên DB thật, phát hiện migrate hỏng, viết script migrate trong build | test+fix | Lint chặn `console.log` trong script → đổi `process.stdout.write` | scripts/db-migrate.mjs, drizzle.config.ts, package.json |
| 2026-11-06 | ba-analyst (Nhân) | BA-08 | 20 fixture, 3 generator profile, CSV 3 encoding, 9 test | code/test/docs | Test bắt lỗi CP1258 dấu nặng + mũ; sửa encoder, check 4.068 test xanh | scripts/gen-mock.ts; fixtures; docs/03; tests/integration/ba08-fixtures.test.ts |
| 2026-11-06 23:15 | data-engineer | DATA-FIX-03 | Sửa BUG-QA02-01 (localStorage SecurityError), BUG-QA04-02 (forecastHorizon bù gapToToday), BUG-QA04-03 (useAnalytics throttle/maxWait + single-flight) | Sửa lỗi + test | Phát hiện thêm race condition khi đối chiếu checksum lúc tick mới đến giữa chừng snapshot -> chỉ đối chiếu khi cùng revision | `src/lib/data/store.ts`, `src/lib/workers/analytics.worker.ts`, `src/lib/workers/useAnalytics.ts` |
| 2026-11-06 | forecast-engineer (techlead làm thay) | FC-10 | Đối chiếu docs/13 §5, thêm winsorize/cắt khoảng trống/bỏ 0 đầu, test | feature | `return` sớm bỏ qua kiểm đầu vào → test cũ bắt, đưa kiểm đầu vào lên trước | robust.ts, forecast.ts |
| 2026-11-06 | techlead | FD-11, DATA-12 | Chụp & soi giao diện, sửa 6 điểm, bộ sinh 8 tình huống + thư viện trong app | ui+data | Màu chữ thư viện quá nhạt (biến CSS không tồn tại) → ảnh chụp lộ, đổi `.muted`; sed làm hỏng cú pháp 1 dòng test → sửa | DashboardShell, CampaignChart, AnomalyFeed, InsightContent, guardrails, scenarios, SampleGallery |
| 2026-11-06 | qa-engineer | QA-01 | Runner fixtures và 1200 lượt property | test | Phân biệt metadata codec với dữ liệu nghiệp vụ | tests/integration/{edge-cases,properties}.test.ts |
| 2026-11-06 | qa-engineer | QA-02 | Integration storage/worker, ghi BUG-QA02-01 | test | Sửa harness quota và cách isolate engine, không sửa expected cho lỗi store | tests/integration/storage-worker.test.ts |
| 2026-11-06 | qa-engineer | QA-03 | Viết14route integration cases, đối chiếu docs05 và schemas | test | Phân biệt provider429 với rate limiter nội bộ; không nới expected413 | tests/integration/insights-api.test.ts |
| 2026-11-06 | qa-engineer | QA-04 | Tám luồng E2E, tái hiện ba lỗi tích hợp | test | Sửa harness blur trước click; giữ nguyên assertions nghiệp vụ | tests/e2e/** |
| 2026-11-06 | qa-engineer | QA-05 | Script benchmark, đo local/deploy, báo cáo | test/docs | Sửa range và timestamp theo kiểm chứng thực nghiệm | tests/perf/*, docs/perf-report.md |
| 2026-11-06 | qa-engineer | QA-06 | Phiên Marketer, retest, coverage và báo cáo | test/docs | Sửa CRLF assertion và vị trí artifact; công bố evidence gốc mất | tests/e2e/marketer-session.ts, docs/bugs.md, docs/test-report.md |
| 2026-11-06 | qa-engineer | QA-07 | API abuse limits, XSS, bundle canary | test/docs | Sửa fixture enum/typing theo lỗi test/build | tests/integration/security-*, tests/e2e/security.spec.ts |
| 2026-11-06 | techlead | TL-06d | Nối cross-tab, phát hiện race lưu ở tab nhận qua e2e lặp, sửa + test | fix | Bản đầu chỉ nối sync → e2e lặp lộ race reload; thêm persist ở tab nhận | DashboardPage.tsx, store.ts |
| 2026-11-07 | ba-analyst | BA-07 | Glossary, microcopy, semantic tests | code/test/docs | Rà lại reach, CVR, số câu và giới hạn dự báo | src/config/glossary*, src/config/microcopy.ts |
| 2026-11-07 | qa-engineer (techlead làm) | REVIEW-QA04-FC10 | Chạy crosstab.spec trên deploy, phân loại 2 lỗi A1 là do môi trường | Test | — | docs/bugs.md |
| 2026-11-07 | data-engineer review | REVIEW-QA04-FC10 | Tìm race delta trước hydrate ghi đè dữ liệu do chính TL-06d gây ra; thêm hàng đợi + test đỏ→xanh | Review/Fix | Bản TL-06d của AI thiếu guard hydrate | store.ts |
| 2026-11-07 | forecast-engineer review | REVIEW-QA04-FC10 | Thăm dò winsorize trên bộ dữ liệu test → kẹp sai cuối tuần/tăng trưởng; viết lại theo cùng thứ + đỉnh đơn lẻ | Review/Fix | Bản sửa đầu vẫn kẹp 2 ngày đầu chuỗi và Tết — test tích hợp campaign-2y bắt được | robust.ts |
| 2026-11-08 | qa-engineer | QA-08 | Property 4×200, chaos/E2E, benchmark và handoff | test/docs | Tách worker globals, đặt hydrated, timeout benchmark; ghi expected failure/lượt gián đoạn | tests/integration/qa08-*, tests/e2e/qa08-chaos.spec.ts, tests/perf/qa08-*, docs/08, docs/{bugs,test-report,perf-report}.md |

Loại: Sinh code · Review · AI sai → sửa · Quyết định không theo AI · Prompt.

## 3. Trường hợp AI sai và cách đội phát hiện (10 ca chọn lọc)
Mỗi ca: bối cảnh → AI đề xuất → sai ở đâu → phát hiện bằng gì → sửa → bài học đã đưa vào đâu.

### 3.1 Next.js 16 khác kiến thức cũ của AI (TL-01, TL-06a)
- **AI đề xuất:** `export const runtime = 'nodejs'` trong route; `useState(() => todayVN())` trong component client.
- **Sai ở đâu:** Next 16 bật Cache Components → `runtime` bị cấm, `new Date()` lúc prerender làm build đỏ.
- **Phát hiện bằng:** `npm run build` trên CI; bot review PR #3 bắt build đỏ.
- **Sửa:** bỏ `runtime`; dùng `useSyncExternalStore` cho "hôm nay".
- **Bài học → đã thêm vào:** `AGENTS.md` + README: "đọc `node_modules/next/dist/docs` trước khi code".

### 3.2 Ngày lệch múi giờ (DATA-01..04)
- **AI đề xuất:** `date-fns` theo giờ máy cho `bucketRange`/`bucketKey`.
- **Sai ở đâu:** CI chạy UTC, máy dev chạy giờ VN → tuần/quý lệch 1 ngày.
- **Phát hiện bằng:** test CI đỏ; techlead chạy test ở 4 múi giờ (TZ=…).
- **Sửa:** viết lại tuần ISO bằng toán UTC thuần; đối chiếu Python 7.670 ngày khớp hết.
- **Bài học → đã thêm vào:** `.claude/rules/data-layer.md` (cấm `new Date('YYYY-MM-DD')`), test đổi `TZ` trong `tests/integration/data-layer.review.test.ts`.

### 3.3 Undo áp delta cũ sau "Xoá hết" (DATA-03 → R-01)
- **AI đề xuất:** store + undo, kèm test viết tay đều xanh.
- **Sai ở đâu:** "Xoá hết" rồi Hoàn tác thao tác cũ → dữ liệu ma quay lại; sửa ngày tạo 2 dòng cùng khoá.
- **Phát hiện bằng:** property test **fast-check** (chuỗi thao tác ngẫu nhiên) do techlead viết khi review.
- **Sửa:** DATA-FIX-01 (xoá ngăn undo khi clearAll, chặn trùng khoá).
- **Bài học → đã thêm vào:** `.claude/rules/tests.md` (property test `numRuns: 200`), `tests/integration/properties.test.ts`.

### 3.4 Lỗi chỉ lộ khi ghép 2 PR (FC-06 + DATA-06 → R-07)
- **AI đề xuất:** 2 PR riêng, mỗi PR đều được bot APPROVE.
- **Sai ở đâu:** horizon 30 ngày < cuối quý, 2 nowcast chung 1 `try`, `catch` rỗng → nowcast **luôn rỗng**.
- **Phát hiện bằng:** techlead chạy cả engine trên fixture thật (`pipeline.review.test.ts`).
- **Sửa:** DATA-FIX-02 bù horizon tới cuối quý, tách try.
- **Bài học → đã thêm vào:** review tích hợp sau mỗi đợt merge; test pipeline trên fixture thật.

### 3.5 Bot APPROVE nhưng chạy thật lộ lỗi UI (FD-02, TL-05)
- **AI đề xuất:** KPI cards + AI card, test component xanh.
- **Sai ở đâu:** thẻ KPI hiện tổng kỳ kèm delta của 1 ngày; AI tự gọi khi trang trống → 400; mỗi lần 2 request trùng; bundle 297 KB.
- **Phát hiện bằng:** chạy production + nhập liệu như marketer (bot chỉ đọc code + chạy test).
- **Sửa:** FD-05, AI-FIX-01, FD-10; 3 test `it.fails` đổi thành test thường khi sửa xong.
- **Bài học → đã thêm vào:** techlead chạy production + thử tay sau mỗi đợt merge UI (checklist `/review` có mục 375px); `tests/integration/fd-review.review.test.tsx`.

### 3.6 Đồng bộ nhiều tab mất dữ liệu (TL-06d → REVIEW-QA04-FC10)
- **AI đề xuất:** gọi `startCrossTabSync()` khi mount; sau đó cho tab nhận lên lịch lưu.
- **Sai ở đâu:** (1) bản đầu: tab B nhận nhưng không lưu → reload trong 300 ms mất dòng; (2) bản sửa: delta tới **trước khi hydrate** → ghi đè dữ liệu đã lưu.
- **Phát hiện bằng:** (1) e2e lặp 5 lần; (2) review vai data-engineer, viết test đỏ trước khi sửa.
- **Sửa:** lưu ở tab nhận + hàng đợi delta trước hydrate.
- **Bài học → đã thêm vào:** `remotePersist.test.ts`; QA retest trên deploy 6/6 rồi mới đóng BUG-QA04-01.

### 3.7 Winsorize cắt nhầm dữ liệu thật (FC-10)
- **AI đề xuất:** kẹp ngày "gõ nhầm" quanh median ± 5·MAD của cả chuỗi.
- **Sai ở đâu:** cắt 12/42 ngày cuối tuần thật, 3 ngày mới nhất của chiến dịch tăng ×20; bản sửa lần 1 vẫn cắt 13 ngày Tết.
- **Phát hiện bằng:** chạy hàm trên bộ dữ liệu test DATA-12; test tích hợp campaign-2y (mô hình rơi khỏi Holt-Winters).
- **Sửa:** tham chiếu cùng thứ 4 tuần trước, chỉ kẹp đỉnh **đơn lẻ**, chỉ trong cửa sổ 365 ngày.
- **Bài học → đã thêm vào:** `robust.test.ts` (weekend, ×20, Tết, ngày mới nhất).

### 3.8 Lỗi AI bị "nuốt" trên deploy (AI-FIX-03)
- **AI đề xuất:** route trả "Lỗi phản hồi từ nhà cung cấp AI hoặc chưa có API key" cho mọi lỗi; key Gemini nằm trong URL.
- **Sai ở đâu:** gắn key thật trên Vercel vẫn 502 mà không biết vì sao (không log, không mã); key trong query dễ lộ qua log.
- **Phát hiện bằng:** techlead gọi `/api/insights` trên deploy bằng 4 kịch bản eval.
- **Sửa:** key qua header, message có mã + gợi ý (429/400/403/404/5xx), `console.error` ở server.
- **Bài học → đã thêm vào:** `provider.test.ts` (key không có trong URL).

### 3.9 Đăng ký báo "Invalid origin" trên Vercel (ACC-FIX-03)
- **AI đề xuất:** `trustedOrigins` chỉ có `BETTER_AUTH_URL`.
- **Sai ở đâu:** mở bằng link deploy riêng (`vibecode-…-dashboard-data.vercel.app`) → 403.
- **Phát hiện bằng:** Thắng thử tay, gửi ảnh chụp.
- **Sửa:** thêm đúng `VERCEL_URL`/`VERCEL_BRANCH_URL`/`VERCEL_PROJECT_PRODUCTION_URL` — chủ ý **không** dùng wildcard `*.vercel.app` (mọi site trên Vercel sẽ được tin).
- **Bài học → đã thêm vào:** `accountConfig.test.ts`.

### 3.10 Chữ vô hình trên giao diện (FD-11, DATA-12)
- **AI đề xuất:** `color: var(--muted)` cho mô tả bộ dữ liệu test.
- **Sai ở đâu:** biến CSS không tồn tại → chữ gần như vô hình; test DOM vẫn xanh.
- **Phát hiện bằng:** ảnh chụp desktop + 375px.
- **Sửa:** dùng class `.muted` có sẵn.
- **Bài học → đã thêm vào:** kiểm UI bằng ảnh chụp trước khi mở PR.

## 4. Quyết định không theo AI
| Đề xuất của AI | Đội chọn | Lý do |
|---|---|---|
| Bản đầu của tiêu chí ngày gõ nhầm: kẹp quanh median cả chuỗi (FC-10) | Tham chiếu cùng thứ + chỉ kẹp đỉnh đơn lẻ | Mùa vụ tuần và đợt sale/Tết là dữ liệu thật, không phải lỗi gõ |
| Làm tài khoản cục bộ (đúng luật cũ "không backend") | Server thật: better-auth + Postgres Neon (CR-005) | Chủ dự án muốn đăng nhập nhiều máy; giữ ràng buộc khách vẫn dùng đủ P0 |
| Thêm `AI_TIMEOUT_MS` + `maxDuration` 60 s cho route AI (nhánh AI-TIMEOUT-01) | Không merge, giữ Gemini Flash với ngân sách 20 s | Chủ dự án quyết: Flash đủ nhanh; quá hạn đã có fallback rule-based |
| Bỏ ví dụ cụm từ cấm khỏi prompt cho gọn (BA-03) | Giữ ví dụ | Model không thấy danh sách cấm thì không tránh được |

## 5. Prompt tiêu biểu
| # | Role · công cụ | Mục đích | Nội dung rút gọn | Kết quả |
|---|---|---|---|---|
| 1 | Mọi thành viên · Gemini/ChatGPT | Mở phiên | `TEAM.md` §6.1: "Đọc CLAUDE.md → TEAM.md → AGENTS.md → agent role → TASKS → domain.ts → docs/10; tóm tắt 5 dòng phạm vi; chưa viết code" | AI nắm ownership trước khi sửa, gần như không có PR đụng file người khác |
| 2 | Mọi thành viên | Giao task | §6.2: "Kế hoạch ≤ 10 gạch, CHỜ đồng ý; code + test cùng lúc, có ca lỗi/ca biên" | Mỗi PR có test kèm; người duyệt kế hoạch trước |
| 3 | Mọi thành viên | Khi test đỏ | §6.3: "Chỉ sửa lỗi trong file của tôi; file người khác → viết change request" | Lỗi chéo đi qua `CHANGE_REQUESTS.md` (CR-001..005) |
| 4 | techlead · Claude | Chốt hợp đồng | "Đóng băng `domain.ts` v1, stub mọi hàm public `NOT_IMPLEMENTED: <TASK-ID>`" | 5 người làm song song không chờ nhau |
| 5 | techlead · Claude bot | Review PR tự động | `.github/workflows/claude-review.yml` + `/review`: checklist ownership, contracts, test ca biên, chạy CI | Bắt vòng lặp vô hạn useAnalytics, build đỏ, 6 lỗi PR #4 |
| 6 | ba-analyst · ChatGPT | Prompt AI | BA-03: "System prompt tiếng Việt, đúng 3 gợi ý, chỉ dùng số đã cho, cấm cụm hứa hẹn, few-shot 2 ví dụ" | `PROMPT_VERSION` v1.2, guardrail đối chiếu số |
| 7 | ai-engineer · Gemini | Structured output | AI-02..05: "responseSchema JSON + Zod + repair 1 lần + fallback rule-based; mọi 4xx/5xx kèm fallback" | Người dùng không bao giờ thấy thẻ AI trống |
| 8 | data-engineer · Gemini | Dữ liệu lớn | DATA-05/06: "Rollup tăng dần O(|delta|), Web Worker + Comlink, typed array, không tạo object trong vòng lặp" | 50k dòng: snapshot dưới ngân sách (docs/perf-report.md) |
| 9 | forecast-engineer · Claude tk 2 | Dự báo | FC-02..05: "Holt/Holt-Winters thuần TS, backtest rolling-origin sMAPE, phải thắng seasonal-naive" | docs/forecast-validation.md với sai số thật |
| 10 | qa-engineer · ChatGPT | Phiên marketer | QA-06: "Đóng vai marketer 45 phút trên iPhone 12 emulation, ghi mọi lỗi, không sửa expected" | 141 hành động, 0 pageerror |
| 11 | techlead · Claude | Review vai người khác | "Review FC-10 như Thắng 2: chạy trên bộ dữ liệu test, tìm ca cắt nhầm" | 3 lỗi winsorize (§3.7) |
| 12 | pm-release · Claude | Tổng hợp log | "Gom dòng log từ mọi handoff vào docs/11, sắp theo ngày, chọn 10 ca AI sai" | Tài liệu này |
