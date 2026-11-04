/**
 * Review tích hợp (techlead, 2026-11-04) — chạy cả chuỗi worker engine trên fixture thật của BA-05:
 * rollup (DATA-05) → trend (FC-01) → forecast (FC-02..05) → nowcast (FC-06). QA-02 tiếp quản.
 * `it.fails` = lỗi đã biết, mã R-xx ở handoffs/REVIEW-INTEGRATION-2026-11-04.md.
 */
import { describe, expect, it } from 'vitest';

import campaign2y from '@/fixtures/campaign-2y.json';
import demo30d from '@/fixtures/demo-30d.json';
import { createAnalyticsEngine } from '@/lib/workers/analytics.worker';
import type { AnalyticsSnapshot, DailyEntry, Grain } from '@/types/domain';

const TODAY = '2026-11-02'; // fixture kết thúc 2026-11-01
const GRAINS: Grain[] = ['day', 'week', 'month', 'quarter'];

async function snapshots(rows: unknown): Promise<AnalyticsSnapshot[]> {
  const eng = createAnalyticsEngine();
  await eng.init(rows as DailyEntry[]);
  const out: AnalyticsSnapshot[] = [];
  for (const grain of GRAINS) out.push(await eng.snapshot({ campaignId: 'all', grain, horizonDays: 30, today: TODAY }));
  return out;
}

describe('pipeline engine · fixture thật', () => {
  it.each([
    ['campaign-2y', campaign2y],
    ['demo-30d', demo30d],
  ])('%s: 4 grain đều có series, trend, đủ 4 dự báo, không NaN/Infinity', async (_n, rows) => {
    for (const s of await snapshots(rows)) {
      expect(s.series.buckets.length).toBeGreaterThan(0);
      expect(s.trend).not.toBeNull();
      expect(s.forecasts.map((f) => f.metric).sort()).toEqual(['clicks', 'cost', 'orders', 'reach']);
      expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/);
      expect(s.forecastStatus).toBe('ok');
    }
  });

  it('campaign-2y (730 ngày, mùa vụ tuần rõ) chọn Holt-Winters; demo-30d (30 ngày) dùng baseline độ tin cậy thấp', async () => {
    const [big] = await snapshots(campaign2y);
    const [small] = await snapshots(demo30d);
    expect(big!.forecasts.every((f) => f.model === 'holt_winters')).toBe(true);
    expect(small!.forecasts.every((f) => ['naive', 'seasonal_naive', 'moving_avg'].includes(f.model))).toBe(true);
    expect(small!.forecasts.every((f) => f.confidence === 'low')).toBe(true);
  });

  // R-07 (DATA-FIX-02): engine dự báo đủ tới cuối quý -> snapshot có cả nowcast tháng và quý
  it('R-07 snapshot có nowcast tháng (2026-11) và quý (2026-Q4)', async () => {
    const [s] = await snapshots(campaign2y);
    expect(s!.nowcasts.map((n) => n.periodKey)).toEqual(['2026-11', '2026-Q4']);
    for (const n of s!.nowcasts) expect(n.projected.orders.mean).toBeGreaterThanOrEqual(n.actualToDate.orders);
  });
});
