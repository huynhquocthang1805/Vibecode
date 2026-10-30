import { notImplemented } from '@/lib/notImplemented';

/** 125400 → "125.400"; null → "—" */
export function fmtInt(_n: number | null): string {
  return notImplemented('DATA-02');
}

/** → "18.500.000 ₫" */
export function fmtVnd(_n: number | null): string {
  return notImplemented('DATA-02');
}

/** → "18,5tr", "1,2 tỷ" */
export function fmtVndShort(_n: number | null): string {
  return notImplemented('DATA-02');
}

/** 0.0256 → "2,56%" */
export function fmtPct(_ratio: number | null, _digits: number = 2): string {
  return notImplemented('DATA-02');
}

/** 12.3 → "▲ 12,3%" */
export function fmtDelta(_pct: number | null): string {
  return notImplemented('DATA-02');
}
