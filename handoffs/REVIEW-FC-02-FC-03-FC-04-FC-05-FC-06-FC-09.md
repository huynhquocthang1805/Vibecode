# REVIEW — FC-02..FC-06 + FC-09 (PR #6) — Vòng 1: **APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard (/tmp/guard.md) | ✅ Không có lỗi chặn |
| `npm run check` | ✅ lint + typecheck xanh; 26 file test, 3.702 passed + 8 expected fail (`it.fails` có sẵn của BA-03/DATA, không thuộc PR này) |
| `npm run build` | ✅ build thành công |
| Ownership (CLAUDE.md §4) | ✅ chỉ `lib/analytics/**`, `docs/04`, `docs/forecast-validation.md`, `handoffs/FC-*` |
| Hợp đồng domain.ts / docs/10 | ✅ chữ ký `forecastMetric`, `forecastAll`, `nowcast`, `holt`, `holtWinters`, `fitBest`, `backtest` giữ nguyên |
| Không `any`/`ts-ignore`/`console.log`/`new Date('YYYY-MM-DD')` | ✅ grep trên diff không có |
| Pure, `today` qua tham số, không `Date.now()` | ✅ |
| safeDiv; KPI = tỉ số của tổng | ✅ nowcast dùng `computeKpis` trên tổng dự phóng |
| Ca lỗi/ca biên | ✅ chuỗi toàn 0, chuỗi hằng, NaN/âm/horizon sai, năm nhuận, cuối quý, partial hôm nay, thiếu horizon, trùng metric/ngày, target lỗi; property-based (nowcast projected ≥ actual, khoảng 80 ⊂ 95) |
| Ngân sách hiệu năng | ✅ theo handoff/docs: forecastAll p95 ≈ 33–41 ms (<100 ms), nowcast p95 ≈ 0,6 ms (<5 ms) |
| Handoff + log AI | ✅ `handoffs/FC-02..06, FC-09` |
| docs/forecast-validation.md | ✅ báo sMAPE thật so với baseline |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. `forecastConfig.ts` hard-code ngưỡng (grid, z, sMAPE…) trong `lib/analytics`, trái `.claude/rules/analytics.md` ("ngưỡng lấy từ `config/thresholds.ts`"). Đã ghi rõ là tạm thời theo kế hoạch; techlead/BA chuyển sang `config/thresholds.ts` khi tích hợp (ghi `CHANGE_REQUESTS.md`).
2. Benchmark hiệu năng chỉ nằm trong docs/handoff, chưa có test tự động; QA-05 nên đưa vào `tests/perf`.
3. Handoff ghi thời gian 2026-11-04 trong khi hôm nay là 2026-11-03 — PM chỉnh khi tổng hợp.
4. PR gộp 6 task: chấp nhận vì mỗi task có handoff riêng; lần sau nên tách PR nhỏ hơn.

## Điểm tốt
- Fail-fast có mã lỗi rõ (`NOWCAST_INCOMPLETE_FORECAST`, `FORECAST_NON_FINITE`), không che lỗi lập trình.
- Nowcast không đếm đôi ngày hôm nay (dùng phần bù `max(0, forecast − actual)`).
- Chọn mô hình bằng backtest, luôn so baseline, confidence tính từ sMAPE thật.
- Test dày (58 test analytics mới) và tài liệu kiểm định trung thực.
