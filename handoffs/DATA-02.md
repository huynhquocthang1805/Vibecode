# Handoff — DATA-02 · kpi.ts, format.ts, dates.ts
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-01-DATA-04-FC-01   **Thời gian:** 2026-11-02 08:58
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- `kpi.ts`: Triển khai `safeDiv`, `computeKpis`, `sumTotals`, `pctChange` theo đúng docs/03 §1-3. 100% coverage.
- `format.ts`: Cache instance `Intl.NumberFormat('vi-VN')`, triển khai `fmtInt`, `fmtVnd`, `fmtVndShort`, `fmtPct`, `fmtDelta`.
- `dates.ts`: `todayVN` dùng `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`, `bucketKey` hỗ trợ ISO week cross-year (`getISOWeekYear`), quarter, month, day; `bucketRange`, `addDays`, `daysBetween`.

## File thay đổi
- `src/lib/domain/kpi.ts`
- `src/lib/domain/kpi.test.ts`
- `src/lib/domain/format.ts`
- `src/lib/domain/format.test.ts`
- `src/lib/domain/dates.ts`
- `src/lib/domain/dates.test.ts`

## API / component công khai
```ts
// kpi.ts
export function safeDiv(a: number, b: number): number | null;
export function computeKpis(t: Totals): Kpis;
export function sumTotals(items: Totals[]): Totals;
export function pctChange(curr: number | null, prev: number | null): number | null;

// format.ts
export function fmtInt(n: number | null): string;
export function fmtVnd(n: number | null): string;
export function fmtVndShort(n: number | null): string;
export function fmtPct(ratio: number | null, digits?: number): string;
export function fmtDelta(pct: number | null): string;

// dates.ts
export function todayVN(now?: Date): ISODate;
export function parseISODate(s: string): ISODate | null;
export function bucketKey(d: ISODate, g: Grain): string;
export function bucketRange(key: string, g: Grain): { start: ISODate; end: ISODate; days: number };
export function addDays(d: ISODate, n: number): ISODate;
export function daysBetween(a: ISODate, b: ISODate): number;
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/domain/` → 23 passed / 0 failed.
- Ca biên đã phủ: E11 (múi giờ VN 23:59), E19 (CTR tổng là tỉ số của tổng), E23 (pctChange với 0 và null), E24 (ISO week 2025-12-29 -> 2026-W01), E25 (quý 4).
- Coverage: 100% cho `kpi.ts`.

