# QA-05 — Performance report

Đo ngày 2026-11-06 trên Windows 10.0.26300, Intel i7-12700H (20 logical CPUs), RAM 16,890,978,304 bytes, Node 22.16.0, Chromium 156.0.8078.4. Local production build từ main `7bea10f`; deploy `https://vibecode-three-xi.vercel.app` đo lúc 16:41 UTC (không xác minh được commit của deployment). Seed 20261106; năm mẫu, lấy median. Không CPU/network throttling.

## Kết quả

| Phép đo | Local median | Deploy median | Ngân sách | Kết luận |
|---|---:|---:|---:|---|
| buildRollups 100k | 89.08 ms | — | <300 ms | Đạt |
| applyDelta thay 1 dòng | 0.105 ms | — | <2 ms | Đạt |
| full snapshot 2 năm, forecast cache lạnh | 144.96 ms | — | <150 ms | Đạt, sát ngưỡng |
| encode + decode 50k | 69.94 ms | — | <200 ms | Đạt |
| codec 50k, UTF-16 storage | 2,996,084 B | — | <3,670,016 B | Đạt |
| IndexedDB 50k → KPI | 1001.87 ms | 1178.11 ms | <1200 ms | Đạt |
| IndexedDB 200k → KPI | 2174.23 ms | 2433.90 ms | <4000 ms | Đạt |
| Quý → Ngày, chart 3 năm | 580 ms | 534 ms | <500 ms | Chưa đạt |
| CSV 50k dòng đầu vào → báo cáo commit | 373.55 ms | 326.25 ms | <3000 ms | Đạt trong phạm vi dưới |
| Long Task lớn nhất mỗi lần import | 93 ms | 92 ms | <50 ms | Chưa đạt |
| Tổng gzip JS có trong HTML đầu tiên (11 scripts) | 257,414 B | 258,189 B | <256,000 B | Chưa đạt |

## Phương pháp và giới hạn

- CPU: một warmup không tính; năm mẫu; tạo index/engine trước phần đo delta/snapshot. Chạy cùng hàm worker trong Node, không đo overhead truyền message tới worker. Mỗi snapshot tính đủ 4 forecast và 2 nowcast.
- Browser: context guest mới, AI stub, dữ liệu chỉ nằm trong browser. Seed IndexedDB không nằm trong thời gian startup; HTTP cache ấm, chờ KPI đúng tổng reach của toàn bộ fixture và đúng số dòng. Range được đặt rõ toàn bộ fixture, tránh mặc định 90 ngày của UI.
- Chart: timestamp trong browser từ click đến canvas + nhãn 1095 kỳ + hai animation frames. Bao gồm snapshot và scheduling, không phải riêng chi phí vẽ ECharts. Poll mỗi 16 ms có thể cộng tối đa một khoảng poll; độ trễ polling Playwright không cộng vào timestamp.
- CSV gồm 100 campaign × 500 ngày; UI gán một campaign đã chọn nên deduplicate còn **500 dòng commit**. Chỉ kết luận throughput đọc/validate 50k dòng đầu vào, chưa chứng minh commit 50k khóa khác nhau. Long Task quan sát từ chọn file đến 500 ms sau báo cáo, median của maximum mỗi lần.
- JS: gzip riêng các script trong HTML, bỏ nomodule, không tính chunk lazy. Đây là phép đo gần với First Load JS, không phải output bundle analyzer hay toàn bộ payload mạng.
- Một lượt thăm dò khi phiên QA-06 đang chạy cho snapshot 154.8 ms và codec 263.2 ms. Bảng dùng lượt máy rảnh sau cập nhật main; không khẳng định số đo độc lập tải máy hoặc là SLA CI. Không có kiểm thử chaos/heap 10 phút QA-08 trong task này.

## Năm mẫu thô (ms)

| Phép đo | Local | Deploy |
|---|---|---|
| buildRollups | 89.0464,87.6815,90.4458,92.3603,89.0815 | — |
| delta | 0.0718,0.4252,0.0641,0.1927,0.1052 | — |
| snapshot | 150.0418,147.3657,144.9614,144.1912,143.8931 | — |
| codec | 75.2414,69.9388,68.3681,68.7111,73.7794 | — |
| startup50k | 1003.9283,1010.7674,1001.8715,985.0453,991.2286 | 1273.9513,1178.1121,797.2265,1448.7795,748.5729 |
| startup200k | 2183.7613,2151.7584,2174.8675,2174.2340,2152.6018 | 2725.9279,2650.1191,2433.9035,2418.6102,2386.4885 |
| chart | 599,580,574,593,558 | 534,844,590,378,512 |
| CSV | 358.9133,379.3128,342.6453,377.7007,373.5520 | 312.2753,362.0202,326.2495,340.7430,311.2873 |
| Long Task | 94,93,91,91,93 | 91,93,92,91,92 |

## Chạy lại

```powershell
npx tsx tests/perf/benchmark.ts
# Production server đã chạy, không chạy benchmark đồng thời với suite khác.
$env:BASE_URL='http://localhost:3000'
npx tsx tests/perf/browser.ts
$env:BASE_URL='https://vibecode-three-xi.vercel.app'
npx tsx tests/perf/browser.ts
```

JSON đầy đủ ở `test-results/qa05-node.json`, `qa05-browser.json`, `qa05-deploy.json` (ignored local). Script trả lỗi khi đo không hợp lệ; ngân sách được ghi `pass:false`, không biến benchmark phụ thuộc máy thành CI gate. Owner frontend-chart/data xem chart; frontend-core/data xem Long Task; techlead/frontend xem bundle. QA không sửa nguồn ngoài quyền.
