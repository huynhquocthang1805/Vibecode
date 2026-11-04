# REVIEW — DATA-FIX-02 (PR #8) · Verdict: ✅ APPROVE

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; 1 cảnh báo: `tests/integration/pipeline.review.test.ts` thuộc qa-engineer (xem lưu ý 1) |
| `npm run check` | ✅ lint + typecheck xanh; vitest 41 file pass, 3779 pass / 0 fail / 8 expected fail (BA-03) |
| `npm run build` | ✅ xanh |
| Hợp đồng `domain.ts` / `docs/10_CONTRACTS.md` | ✅ Không đổi chữ ký `createAnalyticsEngine` / `AnalyticsWorkerApi` |
| Không `any`, `ts-ignore`, `console.log` | ✅ (có `console.warn`, xem lưu ý 2) |
| Logic nowcast tháng/quý | ✅ Horizon = `max(q.horizonDays, ngày tới cuối quý)` tại `analytics.worker.ts`; tháng và quý có try/catch riêng; chỉ chạy nowcast khi `forecasts.length > 0` |
| Không nuốt lỗi im lặng | ✅ Có cờ `timings.forecastError` / `nowcastMonthError` / `nowcastQuarterError` |
| Test | ✅ Test mới ở `analytics.test.ts` (horizonDays=15 vẫn ra `2026-10` và `2026-Q4`); `it.fails` R-07 đã chuyển thành `it` và pass |
| Handoff + log AI | ✅ `handoffs/DATA-FIX-02.md` |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. Sửa `tests/integration/pipeline.review.test.ts` (của qa-engineer) là hợp lý, vì chỉ gỡ `it.fails` khi lỗi R-07 đã được sửa. Lần sau nên ghi rõ trong handoff là đã báo qa-engineer.
2. `console.warn` trong worker: lint không báo lỗi. Về lâu dài nên phát sự kiện `system/health` thay vì log (docs/13). Không chặn.
3. `snapshot.forecasts` giờ có thể dài tới cuối quý (~92 ngày), dài hơn `horizonDays`. Đây là suy luận từ diff, chưa kiểm chứng ở UI: `TrendChart` / `ForecastPanel` có thể vẽ dự báo dài hơn người dùng chọn. Nên cắt `forecasts` về `q.horizonDays` khi trả ra, hoặc frontend-dashboard tự cắt. Nowcast vẫn dùng bản đầy đủ.
4. Các nhánh `catch` mới (tháng lỗi, quý lỗi) chưa có test riêng. Nên thêm trong một task sau.

### Điểm tốt
- Sửa đúng nguyên nhân gốc (horizon thiếu), không chỉ che lỗi.
- Tách try/catch nên một kỳ lỗi không làm mất kỳ còn lại.
- Test hồi quy dùng `horizonDays` nhỏ nên thật sự kiểm chứng việc mở rộng horizon.
