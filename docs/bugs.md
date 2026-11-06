# Bug register — Nhân (QA)

Các dòng open là lỗi sản phẩm còn tồn tại; expected failure trong suite không đồng nghĩa đã sửa.

| ID | Mức | Owner | Trạng thái | Bước tái hiện | Kỳ vọng | Thực tế / bằng chứng |
|---|---|---|---|---|---|---|
| BUG-QA02-01 | major | data-engineer | Open, 2026-11-06 | Cho getter `window.localStorage` ném `SecurityError`, import store ở phiên mới | Khởi tạo với RAM fallback và cảnh báo | Import reject ở `store.ts` phần hydration đọc `ACTIVE_STORAGE_TYPE_KEY` ngoài try/catch. Adapter riêng vẫn hoạt động. Regression `storage-worker.test.ts` dùng `it.fails`, giữ nguyên kỳ vọng không crash. |

| BUG-QA04-01 | major | techlead + data-engineer | Open, 2026-11-06 | Hai tab cùng context, nhập một dòng ở A | B nhận dòng và KPI trước reload | B giữ 0 dòng. startCrossTabSync chỉ được export, chưa có caller trong app. crosstab.spec.ts, desktop/iPhone. |
| BUG-QA04-02 | major | data-engineer + forecast-engineer | Open, 2026-11-06 | Today 2026-11-06, nạp campaign-2y, chọn Quý | Có nowcast cuối quý | Chỉ có tháng. Horizon tính từ today nhưng forecast bắt đầu sau dòng cuối; thiếu phần bù khoảng trống đến today. grain-forecast.spec.ts, hai viewport. |
| BUG-QA04-03 | major | data-engineer | Open, 2026-11-06 | Nhập 7 ngày 30/10–05/11, bật Live x60 | KPI hôm nay và nowcast tăng khi Live đang bật | Row count tăng 7→8 nhưng KPI reach giữ1000, nowcast đứng yên. Debounce snapshot50ms bị reset bởi tick~16ms; cần throttle/maxWait. live.spec.ts, hai viewport. |

## Phạm vi xác minh
- QA-02: jsdom, lỗi storage được tiêm có kiểm soát. Không khẳng định mọi Safari private session đều chặn getter.
- QA-06: phiên thao tác trên trình duyệt sẽ bổ sung riêng; chưa ghi nhận là đã thực hiện.
- QA-04: regression dùng test.fail sau setup; QA_VERIFY_FIXES=1 chạy kỳ vọng nguyên bản. Owner sửa xong phải bỏ marker. Không tính expected failure là functional pass.
