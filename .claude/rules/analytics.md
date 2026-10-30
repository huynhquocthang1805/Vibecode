---
paths:
  - "src/lib/analytics/**"
---

# Quy tắc phân tích & dự báo (owner: forecast-engineer)
- Pure TypeScript: không I/O, không `Date.now()`, không thư viện ML. `today` nhận qua tham số.
- Chỉ dự báo reach/clicks/cost/orders; CTR/CPC/CPA suy ra từ dự báo gốc.
- Đầu ra ≥ 0; không NaN/Infinity (test với chuỗi toàn 0 và chuỗi hằng).
- Luôn so với baseline, báo cáo sMAPE thật; không "làm đẹp" độ chính xác.
- Ngưỡng lấy từ `src/config/thresholds.ts`, không hard-code.
- Ngân sách: `forecastAll` 365 điểm × 4 chỉ số < 100ms; `nowcast` < 5ms.
- Xem skill `time-series-forecasting` cho mẫu cài đặt.
