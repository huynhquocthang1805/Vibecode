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

**Ghi chú QA-06 sau lượt đo:** JSON local gốc đã bị một lượt Playwright dọn output chung; mẫu thô trong bảng đã commit trước đó và vẫn giữ nguyên. Các đường dẫn trên là output khi chạy lại, không khẳng định file gốc còn trên máy. Dùng Playwright trực tiếp với output riêng và sao lưu artifact cần giữ ngoài test-results.

## QA-08 — 50k/200k, 2026-11-08

Local production từ main `1d0c019` (nhánh QA-08 chỉ thêm test/docs). Windows 10.0.26300, i7-12700H/20 logical CPUs, RAM 16,890,978,304 B, Node 22.16.0, Chromium 156.0.8078.4. Seed 20261106, ngày nghiệp vụ 2026-11-06; 100 campaign, range toàn bộ fixture. Không CPU/network throttling. Mỗi phép đo 5 mẫu lấy median; không chạy suite khác trong lượt scale. 200k được chạy lại riêng bằng `--200k` sau khi lượt đầu chưa hoàn tất; không dùng lượt dở làm số đo.

| Phép đo | 50k median | Budget 50k | 200k median | Budget 200k | Kết quả |
|---|---:|---:|---:|---:|---|
| IndexedDB → KPI đúng tổng | 1770 ms | <1200 ms | 2631 ms | <4000 ms | 50k chưa đạt; 200k đạt median |
| Sửa 1 dòng cũ → KPI + dữ liệu chart đổi + 2 frames | 248 ms | <100 ms | 2807 ms | <300 ms | Chưa đạt cả hai |
| Storage CPU, thay 1 dòng hôm nay | 97.68 ms | <30 ms | 4078.78 ms | <60 ms | Chưa đạt cả hai |
| Storage wall time (tham khảo) | 95.10 ms | — | 12572.10 ms | — | localStorage 50k; IndexedDB 200k |
| Snapshot live, đã xác nhận forecast cache hit | 104.60 ms | <5 ms | 501.60 ms | <10 ms | Chưa đạt cả hai |
| CSV đầu vào → báo cáo commit | 402 ms | <3000 ms | 1090 ms | <12000 ms | Đạt trong phạm vi collapse dưới đây |
| Maximum Long Task khi import (median 5 maximum) | 96 ms | <50 ms | 393 ms | <100 ms | Chưa đạt cả hai |
| localStorage UTF-16 đã commit | 2,332,726 B | ≤3.5 MB | IndexedDB | IndexedDB | Đạt; reload đủ 50k/200k và giá trị mới nhất |

**Cách đọc:** đây là benchmark theo máy, không phải SLA. 200k là mức sống sót được phép chậm hơn ngân sách (docs/13); vượt ngân sách không tự chứng minh crash/mất dữ liệu. Kết quả startup 200k có outlier 6908 ms nên median đạt không có nghĩa mọi lượt <4s. BUG-QA08-07 ghi các độ trễ cần tối ưu; Long Task tiếp tục BUG-QA05-02.

Điểm cần owner điều tra: `indexedDbAdapter.save` hiện clear store rồi put toàn bộ entries cho mỗi lần lưu; `localStorageAdapter.save` encode các năm trước khi so hash để tìm năm bẩn. Đây là quan sát code phù hợp với độ trễ ghi, chưa phải đo phân rã nguyên nhân. `forecastCached=1` chỉ xác nhận cache forecast, không có nghĩa toàn snapshot đã được cache.

### Phương pháp QA-08

- `qa08-scale.ts` tạo trang harness HTML riêng, bundle implementation storage/engine bằng esbuild đã có trong node_modules; không thêm dependency hoặc mã vào ứng dụng. Snapshot dùng engine thật trong browser, forecast cache hit bắt buộc; số đo không bao gồm Comlink và không chứng minh worker transport <5ms.
- Một delta của năm hiện tại được lưu qua adapter thật; CPU là chênh CDP Performance.TaskDuration quanh `save`, wall time ghi riêng. Adapter 50k là localStorage để kiểm budget codec; UI startup/Live dùng IndexedDB như runtime tự chuyển khi >40k. Đọc lại bằng adapter mới xác nhận đủ dòng và giá trị reach vừa sửa, không chấp nhận RAM fallback làm durable pass.
- Startup đo reload tới KPI đúng tổng toàn fixture, sau đó kiểm đúng số dòng. Thời gian poll/điều khiển browser nằm trong số đo startup nên là giới hạn trên thực dụng. Fixture reseed giữa các lượt.
- Update sửa dòng đầu fixture để ECharts aria data description phản ánh bucket đã đổi. Timestamp browser bắt đầu lúc xác nhận “Cộng dồn”, kết thúc khi KPI đúng và aria description của chart đổi + hai animation frames. Gồm tính snapshot, scheduling và frame đầu; không tuyên bố animation 450ms đã kết thúc.
- CSV 100 campaign × 500/2000 ngày, UI nhập vào một campaign nên **500/2000 dòng commit**, được assert chính xác mỗi lượt. Chỉ chứng minh xử lý 50k/200k dòng đầu vào và commit nhóm khóa đó. Long Task theo PerformanceObserver từ chọn file tới 500ms sau báo cáo.
- JSON mẫu giữ ở `%TEMP%/vibecode-qa08/scale-1108/{50000,200000}.json`; `result.json` của lượt `--200k` chỉ chứa 200k. Không commit fixture stress hay dữ liệu browser lớn.

### Năm mẫu thô QA-08 (ms)

| Phép đo | 50k | 200k |
|---|---|---|
| Startup | 1770,1009,2328,1815,1014 | 2378,4304,6908,2315,2631 |
| Update | 280,1864,245,244,248 | 7013,4127,2807,2661,2628 |
| Snapshot | 114.1,91.4,127.5,100.7,104.6 | 487.7,1260,1551,501.6,448.7 |
| Storage CPU | 77.639,111.756,108.489,95.504,97.677 | 4078.782,5719.816,6193.250,2984.257,2835.875 |
| Storage wall | 75,108.4,105.6,91.7,95.1 | 12572.1,16510.4,18603.6,5655.1,6048.1 |
| CSV | 400,402,410,406,400 | 1142,1068,1043,1090,1097 |
| Long Task maximum | 102,94,98,96,96 | 426,393,387,392,416 |

```powershell
$env:BASE_URL='http://localhost:3108' # production server stub đã chạy
$env:QA_ARTIFACT_DIR=Join-Path $env:TEMP 'vibecode-qa08/scale-repeat'
npx --no-install tsx tests/perf/qa08-scale.ts # --200k để chỉ đo mức 200k
Remove-Item Env:QA_ARTIFACT_DIR
```

### Live ×60 trong 10 phút — E48

Lượt 08/11 dùng hai guest contexts 50k/200k trong cùng Chromium, chạy đồng thời, cùng production `1d0c019`. Không chạy benchmark scale/E2E/check cùng lượt này. Đây là stress đồng thời có cạnh tranh CPU/I/O, **không phải** phép đo cô lập từng mức. Fixture có seed và đủ dòng hôm nay cho campaign đầu; simulator UI dùng ngẫu nhiên của app. Date tiến theo thời gian thật; 15s warmup, GC trước/sau, lấy mẫu mỗi khoảng 10s bằng đồng hồ Node, deadline CDP 15s.

| Kết quả | 50k | 200k |
|---|---|---|
| Thời gian quan sát thực | 615017.75 ms; lấy số cuối timeout thêm 15s | 601101.35 ms; toàn lượt sau dừng/GC 609790.26 ms |
| Commit trong cửa sổ | Không đủ lịch sử cuối; 8 mẫu thành công, bộ đếm cuối =7 ở 91s | **3** |
| Nhịp ghi E48 ≤2000ms | Chưa đạt ở đoạn đo được: có ≥10160ms bộ đếm không đổi | **Chưa đạt**, gap lớn nhất **511524ms** |
| Heap sau GC | Không lấy được heap cuối → **chưa xác nhận ổn định** | 81,270,820 → **251,361,016 B**, **+209.29%** → chưa ổn định trong lượt này |
| Reach toàn kỳ | Không lấy được giá trị cuối | 7,031,136,062 → **7,031,453,911**, xác nhận Live tăng dữ liệu |
| Khả năng quan sát | 21 timeout lấy heap; cuối lượt `end clock exceeded 15000ms` | 54 mẫu, 1 timeout heap; chụp được màn hình cuối với 200000 dòng |
| Pageerror / browser disconnect trong lúc quan sát | 0 / 0; không suy diễn thành browser crash | 0 / 0; trang không trắng ở ảnh cuối |

Script trả exit **1** vì mức 50k không lấy được số cuối; không ghi thành “Live pass”. Sự cố 50k là frame không phản hồi yêu cầu CDP/JS trong deadline, khác với lượt 07/11 mất kết nối browser. Với 200k, hai điểm heap sau GC và backlog ghi là dấu hiệu cần điều tra; **không kết luận memory leak vô hạn** từ một lượt. Owner cần retest từng mức độc lập sau sửa để tách cạnh tranh tài nguyên và xác minh retained heap; giới hạn này không thay đổi việc E48 chưa đạt trong stress đã chạy.

Artifact giữ tại `%TEMP%/vibecode-qa08/live-1108/`: `200000-result.json`, `200000-end.png`, hai `*-progress.json`, `50000-failure.json`. Không có result/ảnh cuối 50k. Lượt 07/11 ở `live-final/` bị disconnect, không dùng thay bằng chứng 10 phút. Mẫu hiện tại chứng minh cả hai đã được quan sát quá 600000ms trước kết luận cuối.

```powershell
$env:BASE_URL='http://localhost:3108'
$env:QA_ARTIFACT_DIR=Join-Path $env:TEMP 'vibecode-qa08/live-repeat'
npx --no-install tsx tests/perf/qa08-live.ts # khoảng 11 phút; --smoke chỉ 20s
Remove-Item Env:QA_ARTIFACT_DIR
```
