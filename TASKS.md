# TASKS — Bảng công việc

Trạng thái: `[ ]` chưa làm · `[~] (agent)` đang làm · `[x]` xong (có handoff) · `[!]` bị chặn (ghi lý do).
Chi tiết tiêu chí nghiệm thu từng task: xem file role `.claude/agents/<owner>.md`.
Owner bảng: `pm-release`. Mỗi agent CHỈ đổi trạng thái task của mình.

## Wave 0 — Khởi tạo
| | ID | Task | Owner | P | Phụ thuộc |
|---|---|---|---|---|---|
| [ ] | TL-01 | Khởi tạo repo Next.js + TS strict + Tailwind + shadcn + ESLint/Prettier + Vitest + Playwright + scripts | techlead | P0 | — |
| [ ] | TL-02 | Hoàn thiện `src/types/domain.ts` + `docs/10_CONTRACTS.md`, đóng băng v1 | techlead | P0 | — |
| [ ] | TL-03 | Skeleton thư mục + stub mọi hàm public + trang ghép placeholder | techlead | P0 | TL-01, TL-02 |
| [ ] | TL-04 | CI GitHub Actions + Vercel preview + `.env.example` | techlead | P0 | TL-01 |
| [ ] | BA-01 | Chốt `docs/03_KPI_RULES.md` + `src/fixtures/edge-cases.json` (≥ 30 ca) | ba-analyst | P0 | — |
| [ ] | BA-05 | `scripts/gen-mock.ts` + fixtures demo-30d, campaign-2y | ba-analyst | P0 | TL-02 |

## Wave 1 — P0 (MVP)
| | ID | Task | Owner | P | Phụ thuộc |
|---|---|---|---|---|---|
| [ ] | DATA-01 | Zod schema + validateEntry/validateBatch | data-engineer | P0 | TL-03, BA-01 |
| [ ] | DATA-02 | kpi.ts, format.ts, dates.ts | data-engineer | P0 | TL-03 |
| [ ] | DATA-03 | StorageAdapter localStorage + codec cột + migrate + quota/corrupt | data-engineer | P0 | DATA-01 |
| [ ] | DATA-04 | Zustand store CRUD + duplicate policy + undo + loadMock | data-engineer | P0 | DATA-03 |
| [ ] | FC-01 | analyzeTrend + comparePeriods consumer (TrendSummary) | forecast-engineer | P0 | TL-03 |
| [ ] | BA-02 | `config/thresholds.ts`, `bannedPhrases.ts`, `ruleSuggestions.ts`, `glossary.ts` | ba-analyst | P0 | BA-01 |
| [ ] | BA-03 | System prompt v1 + user template + few-shot | ba-analyst | P0 | TL-02 |
| [ ] | BA-04 | `lib/report/templates.ts` (ngắn + đầy đủ) | ba-analyst | P0 | TL-02 |
| [ ] | AI-01 | Zod request/response + JSON schema provider | ai-engineer | P0 | TL-02 |
| [ ] | AI-02 | Route `/api/insights` (validate, size, rate limit, timeout, error map) | ai-engineer | P0 | AI-01 |
| [ ] | AI-03 | Provider adapter Gemini (+ OpenAI, + stub cho test) | ai-engineer | P0 | AI-01 |
| [ ] | AI-04 | enforceGuardrails (7 bước) | ai-engineer | P0 | AI-01, BA-02 |
| [ ] | AI-05 | fallbackInsight rule-based | ai-engineer | P0 | BA-02, FC-01 |
| [ ] | AI-06 | useInsights hook + cache client | ai-engineer | P0 | AI-02 |
| [ ] | AI-07 | buildInsightRequest (nén payload) | ai-engineer | P0 | FC-01 |
| [ ] | AI-08 | buildReport + copyText | ai-engineer | P0 | BA-04 |
| [ ] | FI-01 | EntryForm nhiều dòng + validation inline + dialog trùng ngày | frontend-input | P0 | DATA-01, DATA-04 |
| [ ] | FI-02 | EntryTable (sửa/xoá/hoàn tác) — bản thường, ảo hoá ở FI-02b | frontend-input | P0 | DATA-04 |
| [ ] | FI-05 | DataManager: dữ liệu mẫu, backup xuất/nhập, xoá hết | frontend-input | P0 | DATA-04 |
| [ ] | FD-01 | DashboardShell responsive + header + tabs | frontend-dashboard | P0 | TL-03 |
| [ ] | FD-02 | KpiCards (delta, màu ngữ nghĩa, tooltip, "—") | frontend-dashboard | P0 | DATA-02 |
| [ ] | FD-03 | TrendChart + KpiRatioChart (ECharts, lazy) | frontend-dashboard | P0 | BA-05 |
| [ ] | FD-05 | AiInsightCard (5 trạng thái) | frontend-dashboard | P0 | AI-06 |
| [ ] | FD-06 | ExportReportButton (dialog, copy, tải .txt, toast) | frontend-dashboard | P0 | AI-08 |
| [ ] | QA-01 | Test ca biên + property-based từ contracts | qa-engineer | P0 | BA-01, TL-02 |
| [ ] | TL-05 | Review PR liên tục (`/review`) | techlead | P0 | — |
| [ ] | TL-06 | Tích hợp end-to-end + **Gate G1** | techlead | P0 | tất cả P0 |

## Wave 4 — P1 (Dữ liệu lớn · Tháng/Quý · Dự báo)
| | ID | Task | Owner | P | Phụ thuộc |
|---|---|---|---|---|---|
| [ ] | DATA-05 | RollupIndex day/week/month/quarter + applyDelta + like-for-like | data-engineer | P1 | DATA-02 |
| [ ] | DATA-06 | Analytics Worker (Comlink) + useAnalytics + fallback main thread | data-engineer | P1 | DATA-05 |
| [ ] | DATA-07 | parseCsv (worker, chunk) + parsePastedTable + autoMapHeaders | data-engineer | P1 | DATA-01 |
| [ ] | FC-02 | Baselines naive / seasonal naive / moving avg | forecast-engineer | P1 | FC-01 |
| [ ] | FC-03 | Holt + Holt-Winters (damped) + grid fit | forecast-engineer | P1 | FC-02 |
| [ ] | FC-04 | Backtest rolling-origin + chọn mô hình + confidence | forecast-engineer | P1 | FC-03 |
| [ ] | FC-05 | Khoảng dự báo 80/95 | forecast-engineer | P1 | FC-03 |
| [ ] | FC-06 | Nowcast tháng/quý + projectedKpis | forecast-engineer | P1 | FC-05, DATA-05 |
| [ ] | FC-09 | `docs/forecast-validation.md` (sMAPE từng mô hình trên campaign-2y) | forecast-engineer | P1 | FC-04, BA-05 |
| [ ] | FI-02b | Ảo hoá bảng (100k dòng) + lọc/sort | frontend-input | P1 | FI-02 |
| [ ] | FI-03 | CsvImportDialog + PasteImportDialog (preview, mapping, tiến độ, báo lỗi) | frontend-input | P1 | DATA-07 |
| [ ] | FI-04 | Quản lý chiến dịch + bộ chọn chiến dịch | frontend-input | P1 | DATA-04 |
| [ ] | FI-06 | Form mobile (thẻ dọc, inputMode, format khi gõ) | frontend-input | P1 | FI-01 |
| [ ] | FD-04 | GrainSwitcher + ForecastPanel + vùng dự báo trên biểu đồ | frontend-dashboard | P1 | FC-06, DATA-06 |
| [ ] | AI-09 | `scripts/eval-ai.ts` + `docs/ai-eval-report.md` | ai-engineer | P1 | BA-06 |
| [ ] | BA-06 | 8 kịch bản eval AI `src/fixtures/ai-eval/` | ba-analyst | P1 | BA-03 |
| [ ] | BA-07 | Glossary + tooltip + microcopy UI | ba-analyst | P1 | — |
| [ ] | QA-02 | Integration store↔storage↔worker, migrate, corrupt, quota | qa-engineer | P1 | DATA-06 |
| [ ] | QA-03 | Test API + guardrails với provider giả (8 lỗi) | qa-engineer | P1 | AI-04 |
| [ ] | QA-05 | Perf benchmark + `docs/perf-report.md` | qa-engineer | P1 | DATA-06, FC-04 |
| [ ] | TL-07 | Review hiệu năng/bảo mật/bundle + **Gate G2** | techlead | P1 | P1 |

## Wave 5 — P2 (Realtime nâng cao) + Hardening + Release
| | ID | Task | Owner | P | Phụ thuộc |
|---|---|---|---|---|---|
| [ ] | DATA-08 | Event bus + BroadcastChannel + Live simulator | data-engineer | P2 | DATA-06 |
| [ ] | DATA-09 | IndexedDB adapter + tự chuyển khi vượt ngưỡng | data-engineer | P2 | DATA-03 |
| [ ] | FC-07 | detectAnomalies + detectLiveAnomaly | forecast-engineer | P2 | FC-05 |
| [ ] | FC-08 | Target pacing | forecast-engineer | P2 | FC-06 |
| [ ] | FD-07 | LiveModeToggle + AnomalyFeed + animation thẻ | frontend-dashboard | P2 | DATA-08, FC-07 |
| [ ] | FD-08 | Rà soát trạng thái rỗng/lỗi, a11y, dark mode | frontend-dashboard | P2 | — |
| [ ] | QA-04 | 8 E2E Playwright (cả mobile, cả trên deploy) | qa-engineer | P0* | G1 |
| [ ] | QA-06 | Phiên test vai Marketer + `docs/bugs.md` | qa-engineer | P0* | G1 |
| [ ] | QA-07 | Kiểm tra bảo mật nhanh | qa-engineer | P0* | G1 |
| [ ] | TL-08 | Tài liệu kiến trúc cuối + **Gate G3** | techlead | P0* | — |
| [ ] | PM-01 | Duy trì TASKS + `docs/STATUS.md` hằng ngày | pm-release | P0 | — |
| [ ] | PM-02 | README đầy đủ | pm-release | P0 | G1 |
| [ ] | PM-03 | Deploy production + smoke test | pm-release | P0 | G3 |
| [ ] | PM-04 | Tổng hợp `docs/11_AI_USAGE_LOG.md` (bằng chứng vibe coding) | pm-release | P0 | — |
| [ ] | PM-05 | Kịch bản demo + video + slide | pm-release | P0 | G3 |
| [ ] | PM-06 | Bộ 20 câu hỏi phản biện + đáp án | pm-release | P0 | G2 |
| [ ] | PM-07 | Checklist nộp bài | pm-release | P0 | PM-03 |

`P0*` = bắt buộc cho điểm kiểm thử/bàn giao dù nằm ở wave cuối.
