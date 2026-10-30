# 02 — Lược đồ dữ liệu & lưu trữ

Owner: `data-engineer` (techlead duyệt). Kiểu chuẩn ở `src/types/domain.ts`.

## 1. Khoá & tính duy nhất
- Một dòng = 1 ngày × 1 chiến dịch. Khoá logic: `${campaignId}|${date}`.
- Trùng khoá khi nhập tay → hỏi người dùng (policy `ask`): **Ghi đè** / **Cộng dồn** / **Bỏ qua**. Import CSV → chọn policy 1 lần cho cả file. Live mode → luôn `sum` (cộng dồn vào ngày hôm nay).

## 2. Lưu trong localStorage
- Key chính: `kpi-dash:v1`. Key dự phòng: `kpi-dash:v1:backup` (ghi bản tốt gần nhất mỗi 5 lần lưu thành công).
- Định dạng nén cột (codec v1):
```json
{
  "v": 1,
  "epoch": "2024-01-01",
  "campaigns": [{"id":"default","name":"Chiến dịch chính","createdAt":1730000000000}],
  "settings": { "...": "..." },
  "cols": {
    "id":  ["a1","a2"],
    "d":   [0, 1],          // số ngày lệch so với epoch (int) — delta-encode nếu sắp xếp
    "c":   [0, 0],          // chỉ số campaign trong mảng campaigns
    "r":   [12000, 13500],  // reach
    "k":   [240, 310],      // clicks
    "s":   [1500000, 1620000], // cost (VND)
    "o":   [8, 11],         // orders
    "src": [0, 0],          // 0 manual,1 paste,2 csv,3 live,4 mock
    "t":   [[1730000000000,1730000000000], ...] // createdAt, updatedAt (tuỳ chọn, có thể bỏ khi > 20k dòng)
  }
}
```
- Ghi: debounce 300ms, `requestIdleCallback` nếu có. Đo kích thước chuỗi trước khi ghi: > 80% quota ước tính (5MB) → phát `storage/warning`.
- `QuotaExceededError` → giữ dữ liệu trong bộ nhớ, toast "Bộ nhớ trình duyệt đầy — hãy xuất backup hoặc bật lưu nâng cao (IndexedDB)". Không mất dữ liệu đang nhập.
- Đọc: parse lỗi / sai version → thử `migrate()` → thử key backup → nếu vẫn lỗi: khởi tạo rỗng + giữ chuỗi hỏng ở `kpi-dash:corrupt:<ts>` + toast thông báo.

## 3. Migration
`migrate(raw)`: nhận v0 (mảng object thô từ bản prototype) hoặc v1. Mỗi lần đổi `CONTRACT_VERSION` phải thêm hàm `vN→vN+1` + test.

## 4. IndexedDB (P2)
Khi số dòng > 40.000 hoặc gặp quota: chuyển adapter sang IndexedDB (DB `kpi-dash`, store `entries` keyPath `id`, index `campaignId_date`). localStorage vẫn giữ `settings` + cờ `storage: "indexedDB"` để đáp ứng yêu cầu "lưu localStorage" cho dữ liệu chuẩn.

## 5. Backup
- Xuất: file `kpi-backup-YYYYMMDD.json` = `PersistedState` dạng thường (không nén) để người dùng đọc được.
- Nhập: validate từng dòng qua `validateBatch`, báo cáo ImportReport.

## 6. CSV / dán từ Excel
Header tự nhận (không phân biệt hoa thường, bỏ dấu):
| Trường | Tên header chấp nhận |
|---|---|
| date | ngày, ngay, date, day, thời gian |
| campaign | chiến dịch, campaign, tên chiến dịch |
| reach | reach, tiếp cận, tiep can, lượt tiếp cận |
| clicks | click, clicks, lượt click, nhấp |
| cost | chi phí, chi phi, cost, spend, số tiền đã chi tiêu |
| orders | đơn hàng, don hang, orders, purchases, chuyển đổi |
Số kiểu VN: `1.234.567` và `1,234,567` và `1234567 ₫` đều phải parse đúng. Ngày: `YYYY-MM-DD`, `DD/MM/YYYY`, `D/M/YYYY`, số serial Excel.
