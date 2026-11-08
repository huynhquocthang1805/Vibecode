# Bug register — Nhân (QA)

Retest 2026-11-06: local build c4816a7, deploy https://vibecode-three-xi.vercel.app (chưa xác minh SHA). Expected failure là yêu cầu chưa đạt.

| ID | Mức | Owner | Trạng thái | Bước tái hiện | Kỳ vọng | Thực tế / bằng chứng |
|---|---|---|---|---|---|---|
| BUG-QA02-01 | major | data-engineer | **Verified fixed**, PR38 | Getter window.localStorage ném SecurityError, import store phiên mới | RAM fallback, không crash | storage-worker.test.ts hiện 8/8 pass, owner đã bỏ it.fails; trước sửa hydration đọc active storage ngoài try/catch. |
| BUG-QA04-01 | major | techlead + data-engineer | **Verified fixed**, PR43, retest 2026-11-07 | Hai tab cùng context, nhập 1 dòng ở A | B nhận dòng và KPI trước reload | crosstab.spec pass desktop/iPhone local + deploy. QA-08 còn xác nhận hai tab ghi đồng thời, cả BroadcastChannel và storage event fallback: 4/4 mỗi môi trường. Không dùng expected-failure marker cho cross-tab. |
| BUG-QA04-02 | major | data-engineer + forecast-engineer | **Verified fixed**, PR38 | Today 2026-11-06, campaign-2y, chọn Quý | Có nowcast cuối quý | grain-forecast.spec.ts qua cả 2 viewport local/deploy. Owner bù gap từ ngày cuối fixture tới today; đã bỏ marker. |
| BUG-QA04-03 | major | data-engineer | **Verified fixed**, PR38 | Nhập 7 ngày 30/10–05/11, bật Live x60 | KPI hôm nay và nowcast tăng khi Live chạy | live.spec.ts qua cả 2 viewport local/deploy. Owner sửa throttle/maxWait và pending snapshot; đã bỏ marker. |
| BUG-QA03-01 | minor | ai-engineer + techlead | **Open**, spec/API mismatch | POST JSON 1 MB vào handler | docs/05 §1: mọi 4xx/5xx trừ 400 có fallback | 413 PAYLOAD_TOO_LARGE không có fallback. insights-api.test.ts giữ it.fails. Request bị từ chối trước validate; owner quyết định spec hay route, không tạo fallback vô nghĩa chỉ để test xanh. |
| BUG-QA05-01 | minor | frontend-chart + data-engineer | **Open** | Fixture 1095 ngày, full range, Quý→Ngày, đo click tới canvas 1095 kỳ + 2 frames, 5 lượt | <500 ms theo docs/01 §5 | Median 580 ms local/534 ms deploy, bao gồm snapshot/scheduling. tests/perf/browser.ts, docs/perf-report.md. |
| BUG-QA05-02 | minor | frontend-core + data-engineer | **Open** | Import CSV 50k đầu vào, observer từ chọn file tới 500 ms sau commit report | Không Long Task vượt 50 ms | Median maximum 93 ms local/92 ms deploy, cả 5 lượt đều vượt. CSV collapse thành 500 khóa, xem giới hạn báo cáo. |
| BUG-QA05-03 | minor | techlead + frontend | **Open** | Gzip riêng 11 script trong HTML đầu, bỏ nomodule/chunk lazy | Tổng <256000 B | Local 257414 B, deploy 258189 B; phép đo gần First Load JS. Local build 7bea10f; cần đo lại sau tối ưu. |

## QA-06 và vấn đề của bộ kiểm thử

- Phiên iPhone12 emulation thực 45 phút 41.65 giây, 141 hành động: 124 pass, 17 fail ở assertion paste báo cáo, 0 pageerror. Cả 17 fail do textarea chuẩn hóa CRLF thành LF trong khi assertion giữ CRLF; không có bằng chứng mất nội dung clipboard. Đã sửa so sánh newline và đóng composer trong finally.
- Smoke 60 giây sau sửa: 9 hành động pass, 0 fail, 0 pageerror. Không đổi kết quả gốc thành 141 pass. Chưa xác nhận bug sản phẩm mới ngoài register trên.
- Lệnh npm/PowerShell làm mất cờ output của một lượt Playwright; runner dọn test-results chung, mất trace/ảnh/JSON gốc phiên dài và benchmark. Số liệu đã đọc vào log và mẫu benchmark đã commit trước đó. Không khẳng định artifact gốc còn tồn tại. Script QA-06 hiện lưu ngoài output Playwright, dưới thư mục tạm hoặc QA_ARTIFACT_DIR.
- AI stub và composer local; không gửi Zalo thật. Đây là phiên tự động theo kịch bản Marketer, không thay thế usability người thật hoặc kiểm tra iOS/WebKit.

## Phạm vi retest

QA-02 tiêm lỗi jsdom, không suy diễn mọi Safari private session chặn getter. Số liệu QA-04 ngày 06/11 giữ trong báo cáo lịch sử; retest cross-tab ngày 07/11 đã xanh trên local và deploy. Không sửa code sản phẩm ngoài quyền QA.

## QA-08 — chaos, 2026-11-07

Local production main `210b72f`; deploy chưa xác minh SHA. Năm lỗi integration dưới đây đã chạy đỏ trước khi gắn `it.fails`; marker giữ nguyên kỳ vọng sản phẩm và sẽ báo lỗi khi owner sửa mà chưa bỏ marker. E49 UI dùng `QA_VERIFY_FIXES=1` để bỏ marker khi retest. Expected failure **không phải** nghiệm thu đạt.

| ID | Mức | Owner | Trạng thái | Bước tái hiện | Kỳ vọng | Thực tế / bằng chứng |
|---|---|---|---|---|---|---|
| BUG-QA08-01 | major | data-engineer | Open | Lưu 2 năm qua partition adapter; chỉ xoá manifest; tạo adapter mới load | Quét partition còn lại, khôi phục số liệu và phát recovered | `load()` trả null dù partition còn. `qa08-chaos.test.ts`, ca manifest deleted. Manifest JSON hỏng có phục hồi, nhưng thiếu hẳn key không đi vào nhánh này. |
| BUG-QA08-02 | major | data-engineer | Open | Giữ manifest hợp lệ; thay partition 2025 bằng JSON có `d/c/src`, thiếu `r/k/s/o`; vẫn có partition 2026 lành | Cách ly 2025, giữ 2026, không throw | TypeError khi truy cập `pPayload.r[i]`; adapter chưa kiểm cấu trúc các cột trước checksum. `qa08-chaos.test.ts`. Không suy diễn rằng mọi loại corruption đều crash: checksum sai/thiếu key vẫn giữ năm lành. |
| BUG-QA08-03 | major | data-engineer | Open | 2 adapter load cùng base; trong Web Lock tuần tự, A save base+A rồi B save base+B từ snapshot cũ | Reload giữ base+A+B theo docs/13 §2 | Reload chỉ còn base+B; dòng A đã commit bị ghi đè. `qa08-chaos.test.ts`. UI hai tab thường hội tụ nhờ bus; ca adapter stale writer vẫn cần merge theo generation, không bị UI pass che khuất. |
| BUG-QA08-04 | major | data-engineer | Open | Comlink double cho engine thật; init dữ liệu; snapshot reject Error, worker kế tiếp có thể hoạt động | Supervisor restart + retry một lần và giữ checksum | Promise reject `QA_SNAPSHOT_THROW`, không restart; timeout riêng vẫn phục hồi. `qa08-worker.test.ts`. Đây là lỗi method snapshot, không phải onerror event. |
| BUG-QA08-05 | major | data-engineer | Open | Worker init([]); applyDelta thêm dòng; crash 3 lần → main-thread fallback | Snapshot vẫn chứa dòng vừa thêm | Checksum fallback bằng 0; `lastEntriesSnapshot` chỉ được cập nhật khi length > 0. Test dùng các module engine độc lập để không chia sẻ globals giữa worker giả. `qa08-worker.test.ts`. |
| BUG-QA08-06 | major | data-engineer + frontend-dashboard | Open | UI lưu 2025+2026; xoá partition 2025; reload | Giữ năm lành và banner báo năm bị mất/khôi phục backup | Form vẫn hiện, KPI 2026 đúng, nhưng không có alert. 2 viewport local + deploy đều tái hiện. `qa08-chaos.spec.ts`; health event lúc hydrate chưa đến banner. |

Artifact E2E: `test-results/qa08-chaos-local-final/`, `test-results/qa08-chaos-deploy/` (trace/error-context, ignored). Dữ liệu guest, AI stub, không chạm tài khoản người dùng. Worker/lock ở integration là doubles có kiểm soát; E2E dùng browser thật để kiểm chứng luồng UI/cross-tab.
