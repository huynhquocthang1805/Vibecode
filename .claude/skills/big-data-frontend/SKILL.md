---
name: big-data-frontend
description: Kỹ thuật xử lý dữ liệu lớn và thời gian thực trong trình duyệt cho Dashboard KPI — rollup tăng dần, Web Worker + Comlink, codec cột cho localStorage, ảo hoá bảng, ECharts LTTB/dataZoom, BroadcastChannel, throttle render — dùng khi làm việc với lib/data, lib/workers hoặc component hiển thị nhiều dữ liệu.
---

# Big data & realtime ở phía client

## 1. Rollup tăng dần (không tính lại toàn bộ)
```ts
const GRAINS: Grain[] = ['day', 'week', 'month', 'quarter'];
function bump(index: RollupIndex, e: DailyEntry, sign: 1 | -1) {
  for (const cid of [e.campaignId, 'all']) for (const g of GRAINS) {
    const k = `${cid}|${g}|${bucketKey(e.date, g)}`;
    const b = index.buckets.get(k) ?? { reach: 0, clicks: 0, cost: 0, orders: 0, days: 0 };
    b.reach += sign * e.reach; b.clicks += sign * e.clicks; b.cost += sign * e.cost; b.orders += sign * e.orders;
    b.days += sign; index.buckets.set(k, b);
  }
}
export const applyDelta = (ix: RollupIndex, d: EntryDelta) => { d.removed.forEach((e) => bump(ix, e, -1)); d.added.forEach((e) => bump(ix, e, 1)); return ix; };
```
Mỗi delta 1 dòng = 8 cập nhật Map → < 1ms bất kể có 100k dòng.
Lưu ý: `days` ở bucket `all` đang đếm theo entry (nhiều chiến dịch cùng ngày sẽ bị đếm nhiều lần) — `daysWithData` chính xác phải lấy từ `dayEntries` theo ngày duy nhất (docs/01 §3). Đoạn trên là khung minh hoạ.

## 2. Worker
- `new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' })` + `Comlink.wrap`.
- Gửi toàn bộ entries 1 lần (`init`), sau đó chỉ gửi delta. Kèm `revision`; UI bỏ kết quả cũ.
- Gộp delta dồn dập (import, live x60) bằng debounce 50ms.

## 3. Lưu trữ gọn
Codec cột: mảng số thay vì mảng object (bỏ tên key lặp), ngày = số ngày từ epoch, campaign = index. Ghi debounce + `requestIdleCallback`. Đo `raw.length` trước khi ghi để cảnh báo quota.

## 4. Biểu đồ
```ts
series: [{ type: 'line', data, sampling: 'lttb', showSymbol: false, large: true, progressive: 2000 }],
dataZoom: data.length > 90 ? [{ type: 'inside' }, { type: 'slider' }] : [],
animation: data.length < 2000,
```
Cập nhật realtime: `chart.setOption(partial, { notMerge: false, lazyUpdate: true })`.

## 5. Bảng
`useVirtualizer({ count, getScrollElement, estimateSize: () => 44, overscan: 10 })`. Sort/lọc trên mảng chỉ số (index array) thay vì copy object.

## 6. Realtime UI
- Throttle render 250ms khi live; `React.memo` cho thẻ KPI; selector Zustand hẹp (`useDataStore(s => s.revision)`).
- BroadcastChannel: kèm `tabId`, bỏ qua thông điệp của chính mình; dữ liệu nhận từ tab khác không persist lại.
- `aria-live="polite"` cho vùng số cập nhật, tôn trọng `prefers-reduced-motion`.

## 7. Đo đạc
`performance.mark/measure` quanh từng bước trong worker → `snapshot.timings`; panel debug (ẩn, bật bằng `?debug=1`) hiển thị để demo cho giám khảo.
