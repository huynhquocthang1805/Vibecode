# Handoff — DATA-FIX-01 · Sửa 5 lỗi sau review DATA-01..04 + FC-01
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-FIX-01   **Thời gian:** 2026-11-02 10:52
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- **R-01 (`store.ts`)**: Giới hạn `undoStack` chỉ giữ 1 thao tác gần nhất (docs/13 G12). Xoá sạch `undoStack` khi `clearAll()`, `loadMock()`, hoặc `hydrate`. Khi `undoLast()`, tính lại checksum chính xác theo dữ liệu thực tế (`computeChecksum`), đảm bảo checksum không bao giờ âm hoặc sinh dòng ma khi hoàn tác sau chuỗi thao tác ngẫu nhiên.
- **R-02 (`store.ts` - `updateEntry`)**: Xử lý triệt để trường hợp đổi ngày sang ngày đã có số liệu khi policy ≠ `ask` (vi phạm E47):
  - `overwrite`: xoá dòng xung đột cũ (đưa vào `removed`), cập nhật dòng đang sửa sang `nextId`.
  - `sum`: cộng dồn vào dòng xung đột, xoá dòng cũ.
  - `skip` / `ask`: trả lỗi `DUPLICATE_DATE`.
- **R-03 (`validation.ts`)**: Kiểm tra `source` theo enum (`manual`, `paste`, `csv`, `live`, `mock`). Nếu chuỗi ngoài enum thì bỏ (`undefined`), không cho chuỗi lạ lọt vào store/storage.
- **R-04 (`validation.ts` - `parseNumberField`)**: Thay regex xoá mọi ký tự tiền tệ bằng regex chỉ loại bỏ hậu tố tiền tệ ở cuối chuỗi (`/\s*(₫|đ|vnd)$/i`), ngăn chặn parse một phần các chuỗi như `"1d2"` (báo đúng `NOT_NUMBER`).
- **R-05 (`dates.ts` - `bucketKey`)**: Chuyển việc tính ISO week và quarter sang toán UTC thuần túy (`getISOWeekAndYearUTC`, `Math.ceil(m / 3)`), không phụ thuộc vào múi giờ của máy chủ hay runner (pass ở mọi múi giờ từ UTC, UTC+7 đến UTC+14).
- Cập nhật `tests/integration/data-layer.review.test.ts`: đổi 5 `it.fails` thành `it`.

## File thay đổi
- `src/lib/domain/dates.ts`
- `src/lib/domain/validation.ts`
- `src/lib/data/store.ts`
- `tests/integration/data-layer.review.test.ts`
- `handoffs/DATA-FIX-01.md`

## Kiểm thử
- Lệnh: `npm run check` → 10 passed (10 files) / 128 passed (128 tests) / 0 errors / 0 warnings.
- `tests/integration/data-layer.review.test.ts`: 83/83 tests passed.

## Ghi chú dùng AI
- AI phát hiện vấn đề timezone offset khi dùng `date-fns` tại múi giờ UTC+14 và đã thay bằng thuật toán toán học UTC thuần.

