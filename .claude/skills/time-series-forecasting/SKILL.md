---
name: time-series-forecasting
description: Cách cài đặt dự báo chuỗi thời gian thuần TypeScript cho dữ liệu quảng cáo theo ngày (Holt, Holt-Winters mùa vụ tuần, baseline, backtest sMAPE, khoảng dự báo, nowcast tháng/quý, phát hiện bất thường robust z-score) — dùng khi viết hoặc sửa code trong src/lib/analytics.
---

# Time-series forecasting cho KPI quảng cáo

Spec đầy đủ: `docs/04_FORECAST_SPEC.md`. Đây là mẫu cài đặt tham chiếu.

## Holt-Winters additive, damped (m = 7)
```ts
export function holtWinters(y: number[], m: number, a: number, b: number, g: number, h: number, phi = 0.98) {
  const n = y.length;
  if (n < 2 * m) throw new Error('HW cần ≥ 2 chu kỳ');
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  let level = mean(y.slice(0, m));
  let trend = (mean(y.slice(m, 2 * m)) - level) / m;
  const season = y.slice(0, m).map((v) => v - level);
  const fitted: number[] = [];
  for (let t = 0; t < n; t++) {
    const s = season[t % m]!;
    fitted.push(level + phi * trend + s);           // one-step-ahead
    const prevLevel = level;
    level = a * (y[t]! - s) + (1 - a) * (prevLevel + phi * trend);
    trend = b * (level - prevLevel) + (1 - b) * phi * trend;
    season[t % m] = g * (y[t]! - level) + (1 - g) * s;
  }
  const forecast: number[] = [];
  let damp = 0;
  for (let k = 1; k <= h; k++) {
    damp += Math.pow(phi, k);
    forecast.push(Math.max(0, level + damp * trend + season[(n + k - 1) % m]!));
  }
  return { fitted, forecast };
}
```
(Vòng đầu dùng giá trị khởi tạo nên bỏ `m` điểm fitted đầu khi tính SSE/σ.)

## sMAPE (chịu số 0)
```ts
export const smape = (a: number[], f: number[]) => {
  let s = 0, k = 0;
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i]!) + Math.abs(f[i]!); if (d > 0) { s += (2 * Math.abs(f[i]! - a[i]!)) / d; k++; } }
  return k ? (s / k) * 100 : 0;
};
```

## Grid search
α, β, γ ∈ [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9]; tối thiểu SSE one-step; giới hạn 365 điểm cuối. Cache kết quả fit theo `(metric, campaignId, lastDate, n)` trong worker — live tick chỉ thay ngày hôm nay nên có thể dùng lại tham số, chỉ chạy lại recursion (rẻ).

## Khoảng dự báo
σ = sd(residual one-step); `mean ± z·σ·√h`; z80 = 1.2816, z95 = 1.96; clamp 0.

## Nowcast
`projected = actualToDate + Σ forecast(ngày còn lại của kỳ)`; phương sai cộng theo ngày. Ngày hôm nay partial: `max(actualSoFar, forecastToday)` hoặc ngoại suy theo `hourFraction`.

## Robust z-score
`z = (y − median(w)) / (1.4826 · MAD(w))`, w = 14 ngày trước. MAD = 0 → bỏ qua.

## Bẫy thường gặp
- Chỉ số tỉ số (CTR/CPC/CPA) KHÔNG dự báo trực tiếp — suy ra từ dự báo reach/clicks/cost/orders.
- Không đọc `Date.now()` — nhận `today`.
- Ngày thiếu: nội suy để fit, không coi là 0.
- Luôn so với baseline; nếu không tốt hơn ≥ 5% → dùng baseline.
