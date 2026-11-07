# Bug register — Nhân (QA)

Retest 2026-11-06: local build c4816a7, deploy https://vibecode-three-xi.vercel.app (chưa xác minh SHA). Expected failure là yêu cầu chưa đạt.

| ID | Mức | Owner | Trạng thái | Bước tái hiện | Kỳ vọng | Thực tế / bằng chứng |
|---|---|---|---|---|---|---|
| BUG-QA02-01 | major | data-engineer | **Verified fixed**, PR38 | Getter window.localStorage ném SecurityError, import store phiên mới | RAM fallback, không crash | storage-worker.test.ts hiện 8/8 pass, owner đã bỏ it.fails; trước sửa hydration đọc active storage ngoài try/catch. |
| BUG-QA04-01 | major | techlead + data-engineer | **Closed** (TL-06d, retest 2026-11-07 trên deploy) | Hai tab cùng context, nhập 1 dòng ở A | B nhận dòng và KPI trước reload | Trước: B giữ 0 dòng; startCrossTabSync chưa có caller. Sửa: DashboardPage gọi startCrossTabSync khi mount; tab nhận cũng lên lịch lưu (reload B trong 300 ms không mất). Retest QA trên https://vibecode-three-xi.vercel.app (main 210b72f): crosstab.spec **6/6** (3 lần × desktop/iPhone 12); toàn bộ e2e trên deploy 44/46 — 2 lỗi còn lại là account.spec A1 do môi trường test (Node request context không có proxy → ENOTFOUND), không phải lỗi sản phẩm. Review (vai Huy, REVIEW-QA04-FC10): thêm hàng đợi delta tới trước khi hydrate — không còn nguy cơ ghi đè dữ liệu đã lưu. |
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

QA-02 tiêm lỗi jsdom, không suy diễn mọi Safari private session chặn getter. QA-04 giữ nguyên assertions trên bản owner sửa: 22 functional pass + 2 expected cross-tab mỗi môi trường. QA_VERIFY_FIXES=1 chạy cross-tab không marker khi owner hoàn tất wiring. Không sửa code sản phẩm ngoài quyền QA.
