import type { Kpis, Totals } from '@/types/domain';
import { notImplemented } from '@/lib/notImplemented';

/** b === 0 → null. Mọi phép chia trong dự án đi qua hàm này. */
export function safeDiv(_a: number, _b: number): number | null {
  return notImplemented('DATA-02');
}

export function computeKpis(_t: Totals): Kpis {
  return notImplemented('DATA-02');
}

export function sumTotals(_items: Totals[]): Totals {
  return notImplemented('DATA-02');
}

/** prev = 0 hoặc null → null. Đơn vị %: 12.5 = +12,5% */
export function pctChange(_curr: number | null, _prev: number | null): number | null {
  return notImplemented('DATA-02');
}
