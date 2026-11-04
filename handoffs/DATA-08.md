# Handoff — DATA-08 · Event bus + BroadcastChannel + Live simulator
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-08-DATA-09   **Thời gian:** 2026-11-04 15:35
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- **BroadcastChannel & Cross-tab Sync (`crossTab.ts`)**:
  - Triển khai `startCrossTabSync` sử dụng BroadcastChannel với tên kênh `'kpi-dash'`.
  - Mỗi tab sinh một `tabId` ngẫu nhiên duy nhất; khi nhận message, kiểm tra và bỏ qua tin nhắn trùng `tabId` (tránh tự xử lý tin nhắn của chính mình).
  - Khi có thay đổi dữ liệu từ bus nội bộ (`entries/changed`), nếu `origin !== 'remote'` thì gửi payload gồm `{ tabId, delta, revision, timestamp }`.
  - Khi nhận delta từ tab khác, áp dụng vào store thông qua `applyRemoteDelta(delta, revision)`: cập nhật entries, tính lại checksum, tăng revision, và phát sự kiện `entries/changed` với `origin: 'remote'`.
  - Tuyệt đối không gọi `schedulePersist` và không re-broadcast khi `origin === 'remote'` (chống lặp vô hạn và chống ghi đè dữ liệu storage không cần thiết).
  - Tự động fallback sang sự kiện `storage` (`window.addEventListener('storage', ...)`) và lưu tạm qua key `'kpi-dash:sync'` trên localStorage khi trình duyệt không hỗ trợ `BroadcastChannel`.
  - Trả về hàm huỷ (cleanup) đóng channel và gỡ sạch event listener.
- **Live Simulator (`liveSimulator.ts`)**:
  - Triển khai `startLiveSimulator(opts)` hỗ trợ 3 mức tốc độ `speed: 1 | 10 | 60` (tương ứng tick ~1000ms, 100ms, 16ms).
  - Hỗ trợ `seed` tuỳ chọn với bộ sinh số giả ngẫu nhiên Mulberry32 (PRNG) giúp tái lập hoàn toàn kịch bản test.
  - Phân phối trọng số theo giờ trong ngày (diurnal curve `DIURNAL_HOURLY_WEIGHTS`): lượng truy cập thấp vào ban đêm (0–6h, ~0.15–0.3x) và tăng vọt vào khung giờ vàng (19–22h, ~1.8–1.95x).
  - **Sửa R-03**: Dùng `hourVN()` chuẩn múi giờ `Asia/Ho_Chi_Minh` từ `src/lib/domain/dates.ts` thay cho giờ máy (`new Date().getHours()`), đảm bảo đường cong ngày-đêm khớp hoàn hảo với `todayVN()`.
  - Lấy tỉ lệ baseline CTR, CPC, CVR từ dữ liệu 14 ngày gần nhất của `campaignId` (hoặc fallback chuẩn: CTR 3%, CPC 5.000đ, CVR 2%).
  - Bơm cú sốc CPC đột biến (~2% xác suất, CPC tăng 3x–5x) và phát sự kiện `anomaly/detected` (metric: `cpc`, severity: `critical`, direction: `spike`) phục vụ demo cảnh báo tức thì.
  - Ghi số liệu vào store với policy `'sum'`, `source: 'live'` vào ngày hôm nay (`todayVN()`) và phát sự kiện với `origin: 'live'`.
  - Dọn dẹp sạch sẽ qua hàm huỷ trả về, 0 rò rỉ bộ nhớ khi chạy x60 liên tục.

## File thay đổi
- `src/lib/domain/dates.ts`
- `src/lib/domain/dates.test.ts`
- `src/lib/data/realtime/crossTab.ts`
- `src/lib/data/realtime/crossTab.test.ts`
- `src/lib/data/realtime/liveSimulator.ts`
- `src/lib/data/realtime/liveSimulator.test.ts`
- `src/lib/data/store.ts`

## API / component công khai
```ts
// realtime/
export const bus: { emit(e: DomainEvent): void; on<T extends DomainEvent['type']>(t: T, fn: (e: Extract<DomainEvent,{type:T}>) => void): () => void };
export function startCrossTabSync(): () => void;           // BroadcastChannel + fallback 'storage' event
export function startLiveSimulator(opts: { speed: 1|10|60; campaignId: string; seed?: number }): () => void;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/realtime/ src/lib/domain/dates.test.ts` → 17 passed / 0 failed.
- Ca biên đã phủ:
  - Đồng bộ giữa nhiều tab qua Mock BroadcastChannel.
  - Chống echo tin nhắn của chính tab phát ra (so khớp `tabId`).
  - Chống lặp vô hạn (không phát lại remote delta qua BroadcastChannel).
  - Fallback sang sự kiện `storage` khi không có `BroadcastChannel`.
  - Dừng hoàn toàn và dọn dẹp bộ nhớ khi gọi hàm cancel.
  - Giờ VN chuẩn xác (`hourVN`) theo múi giờ `Asia/Ho_Chi_Minh`.
  - Cộng dồn chính xác theo policy `sum` vào `todayVN()`.
  - Giữ vững toàn vẹn các bất biến dữ liệu: `clicks <= reach`, `orders <= clicks`, `cost >= 0`.
  - Bơm cú sốc CPC đột biến kích hoạt sự kiện `anomaly/detected`.

## Cách dùng cho người nhận
- Trường (`frontend-dashboard` - FD-07):
  ```ts
  import { startCrossTabSync, startLiveSimulator } from '@/lib/data/realtime';

  // Khởi động đồng bộ đa tab khi mount app
  useEffect(() => {
    const stopSync = startCrossTabSync();
    return () => stopSync();
  }, []);

  // Bật/tắt Live Mode Toggle
  useEffect(() => {
    if (liveMode) {
      const stopLive = startLiveSimulator({ speed: 10, campaignId: 'default' });
      return () => stopLive();
    }
  }, [liveMode]);
  ```

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Trường (`frontend-dashboard`): Ghép `startCrossTabSync` và `startLiveSimulator` vào UI toggle live và panel anomaly (FD-07).

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-08 | Xây dựng CrossTab sync (BroadcastChannel + storage fallback) và Live Simulator với diurnal curve, CPC shock | Code + Test | Tránh echo bằng tabId, chống lặp vô hạn và sửa R-03 dùng hourVN | src/lib/data/realtime/crossTab.ts, src/lib/data/realtime/liveSimulator.ts |
