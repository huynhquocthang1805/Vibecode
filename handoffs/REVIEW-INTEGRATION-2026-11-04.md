# Review tích hợp — techlead · 2026-11-04

Rà 1 lượt toàn bộ `main` sau PR #4 (DATA-05..07), #5 (BA-06), #6 (FC-02..06, FC-09) + 2 nhánh/PR đang mở.

## 1. Sức khoẻ `main` (commit `509bb37`)
| Hạng mục | Kết quả |
|---|---|
| lint · typecheck · build | ✅ |
| Test | ✅ 3.702 pass + 8 `it.fails` (BA-03 chờ merge code) — xanh ở UTC, America/Los_Angeles, Pacific/Kiritimati |
| Chạy production + Chromium | ✅ Web Worker khởi động dưới CSP, 0 lỗi console, **0 long task trong 3s** (vòng lặp vô hạn R-01 của PR #4 đã hết), 375px không tràn ngang |
| Pipeline engine trên fixture thật (test mới `tests/integration/pipeline.review.test.ts`) | ✅ rollup → trend → forecast ở 4 grain, 0 NaN; campaign-2y chọn Holt-Winters (high), demo-30d chọn baseline (low) đúng spec · ❌ nowcast rỗng (R-07) |
| Bot review | ✅ hoạt động: PR #4 vòng 1 bắt vòng lặp vô hạn + không incremental (6 lỗi) → vòng 2 APPROVE; PR #6 APPROVE có lưu ý đúng; PR #3 bắt build đỏ |

## 2. Lỗi mới phát hiện khi ghép (không PR riêng nào bắt được)
**R-07 (Cao cho FD-04, P1) — `src/lib/workers/analytics.worker.ts` (Huy)**
Engine gọi `forecastAll(daily, q.horizonDays)` với 30 ngày, nhưng nowcast quý cần dự báo tới cuối quý (VD 02/11 → 31/12 ≈ 60 ngày) → `nowcast` ném `NOWCAST_INCOMPLETE_FORECAST` (đúng thiết kế fail-fast của FC-06). Tháng + quý nằm chung 1 `try` → **mất cả 2**; `catch {}` rỗng → không log, không `system/health`. Kết quả: "Dự kiến cuối tháng/quý" không bao giờ có số.
Sửa: horizon dự báo cho nowcast = `max(q.horizonDays, daysBetween(today, cuối quý) + 1)`; tách try tháng/quý; trong `catch` ghi `timings`/`console.warn` 1 lần hoặc phát `system/health` (area `worker`). Gỡ `it.fails` ở test R-07. → task **DATA-FIX-02**.

## 3. Lưu ý không chặn
- `forecastAll` mất ~75–120 ms mỗi snapshot với chuỗi 730 ngày (ngân sách docs/04: < 100 ms) và **chạy lại mỗi lần** snapshot (chưa cache theo `completedVersion` — docs/13 §4) → DATA-11.
- `detectAnomalies` còn stub (FC-07, P2 — Hoàng Anh), engine nuốt lỗi → OK tạm thời.
- `forecastConfig.ts` hard-code ngưỡng (bot PR #6 đã ghi) → chuyển `config/thresholds.ts` khi BA-02.

## 4. PR / nhánh đang mở
| PR / nhánh | Người | Trạng thái | Cần làm |
|---|---|---|---|
| PR #3 `feat/ai-engineer/AI-01-AI-07` | Hoàng Anh | ❌ REQUEST_CHANGES (bot) | Sửa R-01 (xoá `export const runtime = 'nodejs'` — build đỏ do Cache Components), R-02 (dọn `rateLimitMap`), R-03 (`AI_PROVIDER` sai → báo lỗi); **rebase lên main** (không xung đột). Merge **sau** BA-03-code (route gọi `buildUserPrompt`) |
| nhánh `feat/ba-analyst/BA-03-code` (chưa có PR) | Nhân | ✅ techlead thử: ghép main không xung đột, 9/9 test nghiệm thu xanh, lint xanh, assertion giữ nguyên | **Mở PR ngay** — AI đang chờ |
| PR #5 BA-06 (đã merge, không qua bot) | Nhân | ⚠️ chỉ đặc tả + vá test CRLF Windows (hợp lý — chỉ chuẩn hoá `\r\n`, không nới so sánh) | 8 fixture eval chưa có → giữ `[~]`. Ưu tiên BA-02, BA-04 (P0) trước |
| UI FD-* + FI-* | Trường | làm local, chưa push | **Push + mở PR** — 8 task P0 |

## 5. Điểm tốt
Bot review đã chạy thật và bắt lỗi thật (vòng lặp vô hạn, build đỏ) trước khi vào `main`; Huy sửa đủ 6 lỗi vòng 1; Thắng 2 giao 6 task dự báo có kiểm định sMAPE trung thực.
