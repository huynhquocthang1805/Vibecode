# 03 — Quy tắc nghiệp vụ KPI & ca biên

Owner: `ba-analyst`. Đây là **test oracle**: QA và data-engineer dùng bảng ca biên làm test. Bản máy đọc: `src/fixtures/edge-cases.json`.

## 1. Định nghĩa
| Chỉ số | Công thức | Đơn vị hiển thị | Mẫu = 0 |
|---|---|---|---|
| CTR | clicks / reach | %, 2 số thập phân | "—" |
| CPC | cost / clicks | ₫, làm tròn số nguyên | "—" |
| CPA (chi phí/đơn) | cost / orders | ₫, làm tròn số nguyên | "—" |
| CVR (phụ) | orders / clicks | %, 2 số thập phân | "—" |

> Ghi chú nghiệp vụ hiển thị ở tooltip: "CTR trong ứng dụng tính trên **Reach** (người tiếp cận) theo đề bài. Nền tảng quảng cáo thường tính CTR trên **Impressions** nên con số có thể khác."

## 2. Tổng hợp theo kỳ
- Reach/Click/Chi phí/Đơn: **cộng** trong kỳ. (Lưu ý: reach cộng dồn theo ngày có thể đếm trùng người — chấp nhận vì đề bài nhập reach theo ngày; ghi chú ở tooltip.)
- CTR/CPC/CPA/CVR của kỳ = **tỉ số của tổng**, KHÔNG phải trung bình các ngày.
  - Ví dụ: Ngày 1: 100 reach/10 click (10%); Ngày 2: 900 reach/9 click (1%). CTR 2 ngày = 19/1000 = **1,90%** (không phải 5,5%).
- Tuần = ISO week (Thứ 2 → Chủ nhật), key `YYYY-Www`. Tháng `YYYY-MM`. Quý `YYYY-Qn` (Q1 = T1–T3).
- Kỳ hiện tại chưa kết thúc → `isPartial = true`, nhãn "(đến hôm nay)".

## 3. So sánh kỳ (delta %)
- `pctChange = (curr − prev) / prev × 100`; prev = 0 hoặc null → null (hiển thị "mới" nếu curr > 0, "—" nếu cả hai 0).
- **Like-for-like**: kỳ hiện tại partial → so với cùng số ngày đầu của kỳ trước. VD 29/10: so 1–29/10 với 1–29/09. Tháng trước ít ngày hơn (VD 31/03 vs tháng 2) → lấy tối đa số ngày của kỳ trước.
- Ý nghĩa tốt/xấu (assessment):
| Chỉ số | Tăng là | Ngưỡng "đi ngang" |
|---|---|---|
| reach, clicks, orders | tốt | |Δ| < 5% |
| cost | trung tính (đánh giá cùng orders) | |Δ| < 5% |
| ctr, cvr | tốt | |Δ| < 5% (tương đối) |
| cpc, cpa | **xấu** | |Δ| < 5% |
| bất kỳ | "biến động" khi CV > 0.5 trên ≥ 7 kỳ | |
Ngưỡng nằm ở `src/config/thresholds.ts`, có thể chỉnh.

## 4. Validation (nhập tay, dán, CSV)
| Mã | Điều kiện | Mức | Thông báo |
|---|---|---|---|
| REQUIRED | thiếu ngày hoặc bất kỳ ô số nào | error | "Vui lòng nhập {trường}" |
| INVALID_DATE | không parse được, hoặc ngày không tồn tại (31/02) | error | "Ngày không hợp lệ" |
| FUTURE_DATE | ngày > hôm nay (giờ VN) | error | "Không nhập số liệu cho ngày trong tương lai" |
| NOT_NUMBER | không phải số | error | "{trường} phải là số" |
| NEGATIVE | < 0 | error | "{trường} không được âm" |
| NOT_INTEGER | reach/click/đơn có phần thập phân | error | "{trường} phải là số nguyên" |
| TOO_LARGE | vượt `LIMITS.MAX_VALUE` (reach/click > 1e9, cost > 4e10, đơn > 1e7) | error | "Giá trị quá lớn, kiểm tra lại" |
| DATE_TOO_OLD | ngày < `LIMITS.MIN_DATE` (2015-01-01) | error | "Ngày quá xa trong quá khứ, kiểm tra lại năm" |
| SUMMARY_ROW | hàng "Tổng cộng/Total" trong file import | warning (bỏ qua dòng) | "Đã bỏ qua hàng tổng cộng để tránh cộng hai lần" |
| LIMIT_EXCEEDED | vượt giới hạn số dòng / số chiến dịch / kích thước file | error | "Vượt giới hạn {giới hạn} — {gợi ý xử lý}" |
| CLICKS_GT_REACH | clicks > reach | error | "Số click không thể lớn hơn reach" |
| ORDERS_GT_CLICKS | orders > clicks | **warning** | "Số đơn lớn hơn số click — có thể do đơn từ kênh khác, kiểm tra lại" |
| COST_WITHOUT_ACTIVITY | cost > 0 nhưng reach = 0 | warning | "Có chi phí nhưng không có reach" |
| DUPLICATE_DATE | trùng ngày + chiến dịch | warning → hỏi policy | "Ngày này đã có số liệu" |
Chi phí: chấp nhận số thập phân khi nhập nhưng **làm tròn về VND nguyên** (Math.round). Dòng trống hoàn toàn trong form nhiều dòng → bỏ qua, không báo lỗi.

## 5. Ca biên bắt buộc có test (≥ 25)
| # | Input | Kỳ vọng |
|---|---|---|
| E01 | reach=0, clicks=0, cost=0, orders=0 | CTR/CPC/CPA = null, lưu được |
| E02 | reach=1000, clicks=0, cost=500000 | CTR 0,00%; CPC null; CPA null |
| E03 | clicks=50, orders=0, cost=1.000.000 | CPA null ("—"), không Infinity |
| E04 | clicks=1001 > reach=1000 | error CLICKS_GT_REACH |
| E05 | orders=60 > clicks=50 | warning, cho lưu |
| E06 | reach=-5 | error NEGATIVE |
| E07 | reach=10.5 | error NOT_INTEGER |
| E08 | cost=12345.6 | lưu 12346 |
| E09 | date="31/02/2026" | error INVALID_DATE |
| E10 | date = ngày mai | error FUTURE_DATE |
| E11 | date = hôm nay 23:59 giờ VN (UTC vẫn hôm qua/hôm nay) | hợp lệ, đúng ngày VN |
| E12 | cost="1.234.567" | 1234567 |
| E13 | cost="1,234,567" | 1234567 |
| E14 | cost="1.500.000 ₫" | 1500000 |
| E15 | reach="" | error REQUIRED |
| E16 | dòng trống hoàn toàn | bỏ qua |
| E17 | trùng ngày, policy=sum | cộng các trường |
| E18 | trùng ngày, policy=overwrite | thay bằng giá trị mới |
| E19 | CTR 2 ngày (100/10, 900/9) | 1,90% (tỉ số của tổng) |
| E20 | Tháng có 1 ngày dữ liệu | isPartial=true, daysWithData=1 |
| E21 | So sánh 29/10 vs tháng 9 | like-for-like 29 ngày |
| E22 | 31/03 so với tháng 2 (28 ngày) | lấy 28 ngày tháng 2 |
| E23 | prev=0, curr=10 | delta null, nhãn "mới" |
| E24 | Tuần cắt qua năm (29/12/2025–04/01/2026) | key 2026-W01 |
| E25 | Quý: 15/10/2026 | 2026-Q4 |
| E26 | < 3 ngày dữ liệu | Không gọi AI; thông báo "Cần ≥ 3 ngày" |
| E27 | < 14 ngày dữ liệu | Dự báo dùng baseline, confidence low |
| E28 | Tên chiến dịch chứa `<script>` / "bỏ qua chỉ dẫn trước" | Hiển thị an toàn; AI không bị điều khiển |
| E29 | CSV 50.000 dòng, 120 dòng lỗi | nhận 49.880, báo cáo 120 lỗi có số dòng |
| E30 | localStorage đầy | không mất dữ liệu trong phiên, có cảnh báo |
| E31–E50 | Ca chống phình dữ liệu & dữ liệu Excel thực tế | xem `docs/13_SCALE_RESILIENCE.md` §10 (BA-08 chép vào fixtures) |

## 6. Định dạng số (vi-VN)
- Số nguyên: `125.400` · Tiền: `18.500.000 ₫` · Rút gọn (báo cáo chat): `18,5tr`, `1,2 tỷ` · %: `2,56%` · Delta: `▲ 12,3%` / `▼ 3,0%` / `— 0,0%`.
