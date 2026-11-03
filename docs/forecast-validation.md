# FC-09 — Kiểm định dự báo

Ngày đo: 2026-11-04. Owner: forecast-engineer (Thắng 2).

## Phương pháp

- Dataset `src/fixtures/campaign-2y.json`: 2.190 dòng, 3 chiến dịch × 730 ngày, 2024-11-02 đến 2026-11-01; seed 20261101 của BA-05. Không sửa fixture.
- Dùng `buildRollups/getSeries` thật của DATA-05; mỗi chiến dịch fit 365 ngày cuối (2025-11-02–2026-11-01), bốn chỉ số gốc độc lập.
- Rolling-origin 3 fold × 7 ngày: holdout 2026-10-12–18, 19–25, 26–2026-11-01. Mỗi fold tìm lại tham số trên train của chính fold; không dùng holdout để fit hoặc nội suy train.
- sMAPE là phần trăm; cặp actual=forecast=0 bỏ khỏi mẫu số sMAPE, tất cả bằng 0 trả 0. MAE dùng toàn bộ quan sát, cùng đơn vị chỉ số (cost: VND).
- Baseline đối chứng: seasonal_naive(7). Model khác chỉ được chọn khi sMAPE tốt hơn ít nhất 5% tương đối. Hòa điểm giữ baseline. Không ép chọn model phức tạp.
- Grid α/β/γ = 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9; phi=0.98. SSE bỏ 2 điểm khởi tạo Holt và 14 điểm HW (khởi tạo dùng hai tuần).
- Cột confidence dưới đây thuộc **model được chọn**, không phải độ tin cậy của mọi ứng viên trong nhóm. Với dữ liệu ngắn, thiếu 3 fold/21 quan sát chấm điểm thì confidence=low; chưa chấm được trả số đo null.

## Kết quả từng model

| Chiến dịch | Metric | Model | sMAPE (%) | MAE | Chọn |
|---|---|---|---:|---:|:---:|
| do-gia-dung | reach | naive | 24.546 | 14388.667 |  |
| do-gia-dung | reach | seasonal_naive | 11.422 | 6056.429 |  |
| do-gia-dung | reach | moving_avg | 10.217 | 5490.551 |  |
| do-gia-dung | reach | holt | 21.582 | 12408.498 |  |
| do-gia-dung | reach | holt_winters | 8.060 | 4354.953 | ✓ |
| do-gia-dung | clicks | naive | 24.220 | 337.286 |  |
| do-gia-dung | clicks | seasonal_naive | 11.176 | 141.000 |  |
| do-gia-dung | clicks | moving_avg | 10.682 | 136.483 |  |
| do-gia-dung | clicks | holt | 20.033 | 270.237 |  |
| do-gia-dung | clicks | holt_winters | 8.856 | 112.915 | ✓ |
| do-gia-dung | cost | naive | 25.154 | 1831088.190 |  |
| do-gia-dung | cost | seasonal_naive | 11.634 | 770294.286 |  |
| do-gia-dung | cost | moving_avg | 11.079 | 736848.204 |  |
| do-gia-dung | cost | holt | 20.926 | 1476606.571 |  |
| do-gia-dung | cost | holt_winters | 9.541 | 642201.358 | ✓ |
| do-gia-dung | orders | naive | 22.707 | 6.524 |  |
| do-gia-dung | orders | seasonal_naive | 10.688 | 2.762 |  |
| do-gia-dung | orders | moving_avg | 10.014 | 2.653 |  |
| do-gia-dung | orders | holt | 22.756 | 6.529 |  |
| do-gia-dung | orders | holt_winters | 8.697 | 2.334 | ✓ |
| my-pham | reach | naive | 17.810 | 5264.667 |  |
| my-pham | reach | seasonal_naive | 8.774 | 2498.524 |  |
| my-pham | reach | moving_avg | 12.536 | 3553.340 |  |
| my-pham | reach | holt | 13.247 | 3776.196 |  |
| my-pham | reach | holt_winters | 7.917 | 2227.686 | ✓ |
| my-pham | clicks | naive | 15.649 | 108.429 |  |
| my-pham | clicks | seasonal_naive | 8.401 | 56.667 |  |
| my-pham | clicks | moving_avg | 12.043 | 81.129 |  |
| my-pham | clicks | holt | 13.927 | 95.020 |  |
| my-pham | clicks | holt_winters | 7.686 | 51.554 | ✓ |
| my-pham | cost | naive | 15.021 | 453569.810 |  |
| my-pham | cost | seasonal_naive | 10.082 | 297137.714 |  |
| my-pham | cost | moving_avg | 12.329 | 365787.497 |  |
| my-pham | cost | holt | 13.876 | 414934.960 |  |
| my-pham | cost | holt_winters | 7.800 | 229891.013 | ✓ |
| my-pham | orders | naive | 15.365 | 2.143 |  |
| my-pham | orders | seasonal_naive | 8.716 | 1.190 |  |
| my-pham | orders | moving_avg | 12.316 | 1.680 |  |
| my-pham | orders | holt | 15.203 | 2.108 |  |
| my-pham | orders | holt_winters | 6.661 | 0.905 | ✓ |
| thoi-trang | reach | naive | 25.719 | 9073.286 |  |
| thoi-trang | reach | seasonal_naive | 13.444 | 4450.905 |  |
| thoi-trang | reach | moving_avg | 11.386 | 3691.259 | ✓ |
| thoi-trang | reach | holt | 13.757 | 4527.723 |  |
| thoi-trang | reach | holt_winters | 12.042 | 3853.242 |  |
| thoi-trang | clicks | naive | 24.115 | 183.714 |  |
| thoi-trang | clicks | seasonal_naive | 12.656 | 90.714 |  |
| thoi-trang | clicks | moving_avg | 11.389 | 81.449 | ✓ |
| thoi-trang | clicks | holt | 14.899 | 108.824 |  |
| thoi-trang | clicks | holt_winters | 11.970 | 83.488 |  |
| thoi-trang | cost | naive | 24.838 | 687623.048 |  |
| thoi-trang | cost | seasonal_naive | 12.393 | 321203.667 |  |
| thoi-trang | cost | moving_avg | 11.196 | 288775.340 | ✓ |
| thoi-trang | cost | holt | 11.266 | 290361.778 |  |
| thoi-trang | cost | holt_winters | 12.524 | 313852.411 |  |
| thoi-trang | orders | naive | 22.807 | 3.667 |  |
| thoi-trang | orders | seasonal_naive | 12.789 | 1.952 |  |
| thoi-trang | orders | moving_avg | 11.091 | 1.667 | ✓ |
| thoi-trang | orders | holt | 18.874 | 2.990 |  |
| thoi-trang | orders | holt_winters | 16.361 | 2.293 |  |

## Nhận xét

- Đồ gia dụng và mỹ phẩm chọn Holt-Winters cho cả bốn chỉ số; sMAPE được chọn nằm trong 6,661–9,541%.
- Thời trang chọn moving_avg(7) cho cả bốn chỉ số; sMAPE 11,091–11,389%, tốt hơn seasonal naive và HW trên các fold này.
- Cả 12 lựa chọn có confidence=high theo ngưỡng sMAPE <15% và đủ ba fold. Đây là phân loại theo backtest, không phải bảo đảm kết quả kinh doanh.
- Test riêng trên chuỗi `100 + 2t + 20 sin(2πt/7) + noise(seed)` giữ lại 14 ngày đạt tiêu chí HW sMAPE <10%.

## Hiệu năng đo thực tế

Máy: 12th Gen Intel(R) Core(TM) i7-12700H; Node v22.16.0; Windows. `forecastAll` nhận chuỗi 730 ngày, fit tối đa 365 ngày × 4 chỉ số và dự báo 60 ngày; không cache kết quả. Bỏ 3 lượt làm nóng, đo 15 lượt (p95 nearest-rank là lượt lớn nhất). `nowcast` dùng cùng chuỗi và dự báo đủ quý Q4, bỏ 5 lượt làm nóng, đo 100 lượt; không fit lại mô hình.

| Chiến dịch | Forecast median (ms) | Forecast p95 (ms) | Nowcast median (ms) | Nowcast p95 (ms) |
|---|---:|---:|---:|---:|
| do-gia-dung | 37.944 | 41.266 | 0.442 | 0.664 |
| my-pham | 36.302 | 39.022 | 0.445 | 0.631 |
| thoi-trang | 31.458 | 32.847 | 0.436 | 0.591 |

Các lần đo sau tối ưu đạt ngân sách <100 ms và <5 ms. Lần đầu có forecast p95 204,555 ms; đã tối ưu kernel SSE để không tạo mảng fitted cho từng ứng viên và dừng sớm khi tổng lỗi vượt ứng viên tốt nhất. Giữ nguyên đủ 343 tổ hợp và toàn bộ 60 hàng sMAPE/MAE trước/sau tối ưu. Thời gian phụ thuộc tải máy; chưa đo trên thiết bị di động hoặc Worker trong trình duyệt.

## Tái lập

```powershell
npm run test -- src/lib/analytics/forecastValidation.test.ts src/lib/analytics/models/smoothing.test.ts
node --require tsx/cjs -e "const {validateForecasts}=require('./src/lib/analytics/forecastValidation.ts'); const entries=require('./src/fixtures/campaign-2y.json'); process.stdout.write(JSON.stringify(validateForecasts(entries), null, 2))"
```

Để đo hiệu năng, dùng `getSeries(buildRollups(entries), {campaignId, grain:'day', today:'2026-11-02'})`, `forecastAll(daily, 60)`, rồi `nowcast(daily, forecasts, '2026-Q4', 'quarter', '2026-11-02')`. Đo `performance.now()` bên ngoài hàm domain, với số lượt làm nóng/lấy mẫu ở trên; sort thời gian tăng dần, lấy index 7/14 cho forecast và 50/94 cho nowcast. Không assert thời gian từng lượt trong test CI vì nhiễu tải máy.

## Giới hạn và việc tích hợp

- Dataset giả lập, kết quả chỉ phản ánh ba tuần cuối. Các fold dùng để chọn model cũng là số đo công bố; chưa có tập holdout độc lập để đánh giá sau lựa chọn, chưa đại diện mọi mùa vụ/sự kiện.
- Khoảng 80/95% là xấp xỉ Gaussian từ SD phần dư, chưa kiểm định độ phủ thực nghiệm. Nowcast cộng phương sai với giả định độc lập; không mô hình hóa tương quan lỗi nhiều ngày.
- `forecastMetric` trả points rỗng dưới 7 quan sát thật; `forecastAll` trả [] khi không đủ dữ liệu. Các ngày thiếu không được tính như quan sát thật, không được chấm như ground truth.
- FC-10 (winsorize, stale/gap dài) chưa thuộc đợt này. Worker phải quyết định stale/disabled và không hiển thị forecast trong trạng thái đó.
- Worker hiện truyền horizon mặc định 30 và bắt chung lỗi nowcast tháng/quý. Cần DATA-06/techlead yêu cầu đủ ngày từ ngày hoàn tất cuối tới cuối quý và bắt lỗi từng kỳ riêng; tránh mất cả nowcast tháng vì thiếu ngày quý. `nowcast` cố ý báo `NOWCAST_INCOMPLETE_FORECAST` khi thiếu bất cứ ngày cần dự báo, thay vì xuất tổng quý thiếu.
- `hourFraction` chưa nằm trong contract; dùng `max(actualToday, forecastToday)`, không thay chữ ký. `target` được giữ lại, `pacing` chờ FC-08 của Hoàng Anh.
- Cấu hình forecast tạm trong `src/lib/analytics/forecastConfig.ts` theo kế hoạch được duyệt; BA/techlead chuyển sang cấu hình chung khi tích hợp.

