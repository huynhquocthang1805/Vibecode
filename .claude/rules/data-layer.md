---
paths:
  - "src/lib/domain/**"
  - "src/lib/data/**"
  - "src/lib/workers/**"
---

# Quy tắc tầng dữ liệu (owner: data-engineer)
- Hàm trong `lib/domain` là pure; không import React, không đụng `window`.
- Mọi chia qua `safeDiv`. KPI tổng hợp = tỉ số của tổng.
- Ngày: chỉ dùng helper `dates.ts` (giờ Asia/Ho_Chi_Minh); cấm `new Date('YYYY-MM-DD')` và `toISOString().slice(0,10)` để lấy ngày.
- Mọi thay đổi dữ liệu đi qua store → tạo `EntryDelta` → `bus.emit`. Không ghi localStorage ở nơi khác ngoài `storage/`.
- Batch (import/live) phát **một** delta, không phát từng dòng.
- Truy cập `localStorage`/`BroadcastChannel`/`Worker` luôn bọc try/catch và có fallback.
- Hot path (rollup, codec): vòng `for`, tránh tạo object tạm trong vòng lặp lớn.
- Mỗi hàm public có test, gồm ca biên trong `src/fixtures/edge-cases.json`.
