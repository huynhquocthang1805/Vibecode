# 04 — Đặc tả Phân tích xu hướng, Dự báo, Nowcast & Bất thường

Owner: `forecast-engineer`. Toàn bộ là pure function TypeScript trong `src/lib/analytics/**`, chạy trong Web Worker.

## 1. Nguyên tắc
- Dự báo **4 chỉ số gốc** (reach, clicks, cost, orders) theo **ngày**; KPI tỉ số (CTR/CPC/CPA) suy ra từ dự báo gốc → luôn nhất quán.
- Tháng / quý = **bottom-up**: cộng dự báo ngày. Không fit mô hình riêng cho tháng khi < 24 tháng lịch sử.
- Mọi đầu ra ≥ 0 (clamp), số đếm làm tròn khi hiển thị (giữ số thực trong tính toán).
- Không đọc `Date.now()` trong hàm thuần — `today` truyền vào qua `AnalyticsQuery`.
- Ngày thiếu dữ liệu giữa chuỗi: KHÔNG coi là 0 (có thể người dùng quên nhập). **Nội suy tuyến tính chỉ để fit mô hình**, không hiển thị như dữ liệu thật; `dataQuality.missingDays` báo số ngày thiếu, UI nhắc "Thiếu N ngày dữ liệu".

Dữ liệu thưa / cũ / có ngày gõ nhầm, cache dự báo theo ngày đã kết thúc, `forecastStatus`: `docs/13_SCALE_RESILIENCE.md` §4–5 (FC-10).

## 2. Phân tích xu hướng (FC-01) — đầu vào chính của AI
Cho grain đang chọn, lấy N kỳ gần nhất (ngày: 14, tuần: 8, tháng: 6, quý: 4):
1. `changePct` = kỳ hiện tại vs kỳ trước (like-for-like từ `comparePeriods`).
2. `slopePerPeriod`, `r2` = hồi quy OLS y ~ t trên N kỳ (chuẩn hoá theo mean để so sánh giữa chỉ số).
3. `cv` = sd/mean trên N kỳ.
4. `direction`:
   - `volatile` nếu cv > 0.5 và N ≥ 7
   - `up` nếu changePct ≥ +5 **hoặc** (slope chuẩn hoá ≥ +2%/kỳ và r2 ≥ 0.5)
   - `down` tương tự chiều âm; ngược lại `flat`.
   - Mâu thuẫn (changePct dương, slope âm mạnh) → ưu tiên changePct, đặt cờ trong comment.
5. `assessment` theo bảng ở docs/03 §3.
6. `overall`: ưu tiên orders & CPA. orders up & CPA không up → `up`(tốt); CPA up > 10% → `down`(xấu)... Quy tắc chi tiết nằm ở `config/thresholds.ts` (BA chốt).

## 3. Mô hình dự báo (FC-02..05)
| Số ngày lịch sử | Mô hình ứng viên |
|---|---|
| < 7 | Không dự báo (UI: "Cần ≥ 7 ngày để dự báo") |
| 7–13 | moving_avg(7), naive |
| 14–27 | + holt (xu hướng tuyến tính), seasonal_naive(7) |
| ≥ 28 | + holt_winters additive, m = 7 (mùa vụ tuần) |
Fit chỉ trên **365 ngày gần nhất** (giới hạn chi phí khi dữ liệu nhiều năm).

### Holt-Winters additive (m = 7)
```
level:  ℓt = α(yt − s(t−m)) + (1−α)(ℓ(t−1) + b(t−1))
trend:  bt = β(ℓt − ℓ(t−1)) + (1−β)b(t−1)
season: st = γ(yt − ℓt) + (1−γ)s(t−m)
forecast: ŷ(t+h) = ℓt + h·bt + s(t+h−m·(⌊(h−1)/m⌋+1))
Khởi tạo: ℓ0 = mean(tuần đầu), b0 = (mean(tuần 2) − mean(tuần 1))/m, s_i = y_i − ℓ0 (tuần đầu)
```
- Tìm tham số: grid α, β, γ ∈ {0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9} (343 tổ hợp) tối thiểu SSE one-step-ahead. Có thể dùng damped trend φ = 0.98 để tránh dự báo bay quá xa (khuyến nghị bật).
- Holt: như trên, bỏ thành phần mùa vụ; grid α, β.

### Chọn mô hình & backtest (FC-04)
- Rolling-origin: 3 fold, mỗi fold horizon 7 ngày ở cuối chuỗi.
- Thước đo: **sMAPE** (chịu được số 0) + MAE.
- Chọn mô hình có sMAPE nhỏ nhất. Nếu không tốt hơn `seasonal_naive` (hoặc `naive` khi < 14 ngày) ít nhất 5% → dùng baseline. **Trung thực**: hiển thị độ chính xác thật.
- confidence: sMAPE < 15% → high · < 30% → medium · còn lại low.

### Khoảng dự báo (FC-05)
σ = độ lệch chuẩn phần dư one-step. Khoảng tại bước h: `mean ± z·σ·√h` (z80 = 1.2816, z95 = 1.96), clamp dưới 0. Ghi rõ đây là xấp xỉ.

## 4. Nowcast tháng / quý (FC-06) — "kết hợp realtime"
```
projected(period) = actualToDate(period, tới hôm nay)
                  + Σ forecast.mean(các ngày còn lại của period)
var ≈ Σ σ²·h   (cộng phương sai theo ngày, giả định độc lập) → lo80/hi80
```
- Hôm nay đang chạy (live mode / dữ liệu trong ngày chưa đủ): ngày hôm nay = max(thực tế đến giờ, dự báo cả ngày × 1) — tránh đếm thiếu; tham số `hourFraction`.
- Mỗi khi có delta mới → nowcast tính lại tức thì (vài ms) ⇒ con số "Dự kiến cuối tháng" nhảy realtime.
- projectedKpis = computeKpis(projected.mean).
- Target (P2): `pacing = projected / target × 100`; kèm "cần trung bình X đơn/ngày trong N ngày còn lại để đạt mục tiêu".

## 5. Phát hiện bất thường (FC-07)
- Theo ngày: robust z = (y − median₁₄) / (1.4826·MAD₁₄), cửa sổ 14 ngày **trước** ngày xét (không gồm chính nó), tách theo thứ trong tuần nếu ≥ 8 tuần dữ liệu.
- Áp cho: cost, orders, ctr, cpc, cpa. |z| ≥ 2.5 → warning, ≥ 3.5 → critical. MAD = 0 → bỏ qua.
- Realtime trong ngày (live): so sánh `todaySoFar / hourFraction` với kỳ vọng cả ngày từ forecast; lệch > 2.5σ → `anomaly/detected` → toast.
- Ví dụ thông điệp: "CPC hôm nay 9.800 ₫, cao hơn bình thường (~5.900 ₫) — z = 3,1".

## 6. Hiệu năng & test
- `forecastAll` cho 365 điểm × 4 chỉ số < 100ms (grid 343 × 365 × 4 ≈ 500k bước — OK). Nếu chậm: giảm grid hoặc tối ưu golden-section.
- Test bắt buộc: chuỗi hằng số → dự báo hằng số; chuỗi tuyến tính → Holt bám đúng; chuỗi mùa vụ tuần tổng hợp (sin + noise seed cố định) → HW sMAPE < 10%; chuỗi toàn 0 → không NaN; 7 điểm → baseline; dữ liệu có ngày thiếu.
- Viết `docs/forecast-validation.md`: bảng sMAPE từng mô hình trên dataset `campaign-2y` (bằng chứng cho phần phản biện).
