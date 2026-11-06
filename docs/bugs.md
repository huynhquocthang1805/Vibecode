# Bug register — Nhân (QA)

Các dòng open là lỗi sản phẩm còn tồn tại; expected failure trong suite không đồng nghĩa đã sửa.

| ID | Mức | Owner | Trạng thái | Bước tái hiện | Kỳ vọng | Thực tế / bằng chứng |
|---|---|---|---|---|---|---|
| BUG-QA02-01 | major | data-engineer | Open, 2026-11-06 | Cho getter `window.localStorage` ném `SecurityError`, import store ở phiên mới | Khởi tạo với RAM fallback và cảnh báo | Import reject ở `store.ts` phần hydration đọc `ACTIVE_STORAGE_TYPE_KEY` ngoài try/catch. Adapter riêng vẫn hoạt động. Regression `storage-worker.test.ts` dùng `it.fails`, giữ nguyên kỳ vọng không crash. |

## Phạm vi xác minh
- QA-02: jsdom, lỗi storage được tiêm có kiểm soát. Không khẳng định mọi Safari private session đều chặn getter.
- QA-06: phiên thao tác trên trình duyệt sẽ bổ sung riêng; chưa ghi nhận là đã thực hiện.

## BUG-QA03-01 — fallback cho HTTP413
- Mức: minor (bất nhất đặc tả/API); owner: ai-engineer + techlead; trạng thái: Open, 2026-11-06.
- Tái hiện: POST body JSON1MB vào handler; nhận413 PAYLOAD_TOO_LARGE không có fallback.
- Kỳ vọng docs/05§1: mọi4xx/5xx trừ400 đều cófallback. Thực tế413 không đáp ứng; request bị từ chối trước validate nên thiếu dữ liệu để tạo fallback có nghĩa.
- Cần owner quyết định sửa contract/spec hoặc route; QA giữ assertion nguyên bản qua it.fails trong insights-api.test.ts. Không coi đây là chức năng đã đạt.
