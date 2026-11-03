import { addDays } from '@/lib/domain/dates';
import { computeKpis } from '@/lib/domain/kpi';
import type { Series } from '@/types/domain';

/** Fixture dùng chung cho test colocated; không dùng trong luồng runtime. */
export function testSeries(values: number[], start = '2026-01-01'): Series {
  return {
    grain: 'day',
    campaignId: 'test',
    buckets: values.map((value, index) => {
      const date = addDays(start, index);
      const totals = { reach: value * 100, clicks: value * 10, cost: value * 1000, orders: value };
      return {
        ...totals,
        key: date,
        start: date,
        end: date,
        grain: 'day',
        daysWithData: 1,
        daysInPeriod: 1,
        isPartial: false,
        kpis: computeKpis(totals),
      };
    }),
  };
}
