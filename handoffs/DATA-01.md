# Handoff — DATA-01 · Zod schema + validateEntry/validateBatch
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-01-DATA-04-FC-01   **Thời gian:** 2026-11-02 08:58
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- Triển khai `entryInputSchema` (Zod), `validateEntry(raw, ctx)`, `validateBatch(rows, ctx)`.
- Parse số kiểu Việt Nam (`1.234.567`, `1,234,567`, `1.500.000 ₫`, `1,5`, dạng khoa học `1.2E+06`), từ chối phân nhóm nghìn sai như `1,23,456`.
- Kiểm tra tính nguyên, không âm, giới hạn `LIMITS.MAX_VALUE`, `LIMITS.MIN_DATE`.
- Phân biệt error vs warning đúng quy tắc docs/03 §4:
  - Error: REQUIRED, INVALID_DATE, FUTURE_DATE, DATE_TOO_OLD, NOT_NUMBER, NEGATIVE, NOT_INTEGER, TOO_LARGE, CLICKS_GT_REACH.
  - Warning: ORDERS_GT_CLICKS, COST_WITHOUT_ACTIVITY, DUPLICATE_DATE.
- Gộp trùng (merge `sum`) các dòng trùng `${campaignId}|${date}` trong cùng file khi chạy `validateBatch`.

## File thay đổi
- `src/lib/domain/validation.ts`
- `src/lib/domain/validation.test.ts`

## API / component công khai
```ts
export const entryInputSchema: z.ZodType<EntryInput>;
export function validateEntry(raw: unknown, ctx: ValidationContext): ValidationResult;
export function validateBatch(rows: unknown[], ctx: ValidationContext): { valid: EntryInput[]; report: ImportReport };
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/domain/validation.test.ts` → 6 passed / 0 failed.
- Ca biên đã phủ: toàn bộ 52 ca `kind: "validate"` trong `src/fixtures/edge-cases.json` + E31–E33 (`docs/13` §10).
- Số đo hiệu năng: `validateBatch` 50.000 dòng mất ~50ms (< 300ms theo nghiệm thu).

## Ghi chú dùng AI
- AI phát hiện vấn đề với regex match destructuring có thể gây lỗi undefined trong TypeScript strict mode và đã bổ sung fallback an toàn.

