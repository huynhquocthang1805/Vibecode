# Handoff — DATA-07 · parseCsv (worker, chunk) + parsePastedTable + autoMapHeaders
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-05-DATA-07   **Thời gian:** 2026-11-03 20:35
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- `autoMapHeaders(headers)`: Tự nhận header không phân biệt hoa thường, bỏ dấu tiếng Việt theo bảng `docs/02 §6`, xử lý BOM `\uFEFF`.
- `parsePastedTable(text)`: Parse TSV dán từ Excel/Google Sheets, tự nhận diện header hoặc gán tên cột mặc định khi chỉ dán số liệu.
- `parseCsv(file, onProgress?, signal?)`: Nhận diện mã hóa (BOM, UTF-8, UTF-16, windows-1258), phân cách (`,`, `;`, `\t`), phát hiện dòng tiêu đề trước header (quét 10 dòng đầu), hỗ trợ `AbortSignal` và tiến độ.
- `store.importBatch`:
  - Bỏ qua hàng tổng cộng với cảnh báo `SUMMARY_ROW` (E38).
  - Gộp các dòng trùng trong cùng file bằng `sum`, đếm `mergedInFile` (E39).
  - Kiểm tra sức chứa trước khi ghi: từ chối cả file nếu `total > MAX_ROWS_TOTAL` (E40).
  - Ghi 1 delta nguyên tử duy nhất, hỗ trợ hoàn tác qua `undoLast`.

## File thay đổi
- `src/lib/data/import/headers.ts`
- `src/lib/data/import/paste.ts`
- `src/lib/data/import/csv.ts`
- `src/lib/data/store.ts`
- `src/lib/data/import/import.test.ts`

## API / component công khai
```ts
export function parseCsv(file: File, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<{ rows: Record<string,string>[]; headers: string[]; encoding: string; delimiter: string }>;
export function parsePastedTable(text: string): { rows: Record<string,string>[]; headers: string[] };
export function autoMapHeaders(headers: string[]): Partial<Record<keyof Totals | 'date' | 'campaign', string>>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/import/` → 10 passed / 0 failed.
- Ca biên đã phủ: E34 (BOM header 'Ngày'), E35 (tiếng Việt windows-1258/không dấu), E36 (phân cách `;`), E37 (dòng tiêu đề trước header), E38 (SUMMARY_ROW), E39 (mergedInFile = 2), E40 (chặn vượt MAX_ROWS_TOTAL).

## Cách dùng cho người nhận
```ts
const { rows, headers } = await parseCsv(file, (p) => setProgress(p));
const mapping = autoMapHeaders(headers);
const report = store.importBatch(mappedInputs, 'csv', 'overwrite');
```

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- frontend-input (Trường): Tích hợp `parseCsv` và `parsePastedTable` vào `CsvImportDialog` và `PasteImportDialog` (FI-03).

## Ghi chú dùng AI
- Dòng log:

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-03 20:35 | data-engineer | DATA-07 | Csv/Paste parser + autoMapHeaders + importBatch atomic | Code + Test | Khắc phục kiểu error callback của Papa.parse | `src/lib/data/import/**`, `src/lib/data/store.ts` |
