import type { Kpis, Totals } from '@/types/domain';

/** b === 0 → null. Mọi phép chia trong dự án đi qua hàm này. */
export function safeDiv(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

export function computeKpis(t: Totals): Kpis {
  return {
    ctr: safeDiv(t.clicks, t.reach),
    cpc: safeDiv(t.cost, t.clicks),
    cpa: safeDiv(t.cost, t.orders),
    cvr: safeDiv(t.orders, t.clicks),
  };
}

export function sumTotals(items: Totals[]): Totals {
  return items.reduce(
    (acc, cur) => ({
      reach: acc.reach + cur.reach,
      clicks: acc.clicks + cur.clicks,
      cost: acc.cost + cur.cost,
      orders: acc.orders + cur.orders,
    }),
    { reach: 0, clicks: 0, cost: 0, orders: 0 },
  );
}

/** prev = 0 hoặc null → null. Đơn vị %: 12.5 = +12,5% */
export function pctChange(curr: number | null, prev: number | null): number | null {
  if (prev === null || prev === 0 || curr === null) {
    return null;
  }
  return ((curr - prev) / prev) * 100;
}
