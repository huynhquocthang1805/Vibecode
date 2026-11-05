import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { forecastMetric, nowcast } from '@/lib/analytics';
import { buildRollups, applyDelta, getSeries } from '@/lib/data/aggregate';
import { decodeState, encodeState } from '@/lib/data/storage/codec';
import { addDays } from '@/lib/domain/dates';
import { computeKpis, sumTotals } from '@/lib/domain/kpi';
import { CONTRACT_VERSION, type DailyEntry, type MetricForecast, type PersistedState } from '@/types/domain';

const options = { numRuns: 200, seed: 20261106 };
const query = { today: '2026-11-06', campaignId: 'all' as const, grain: 'day' as const };
const rawRow = fc.record({
  day: fc.integer({ min: 0, max: 365 }),
  camp: fc.integer({ min: 1, max: 3 }),
  reach: fc.integer({ min: 0, max: 100000 }),
  clicks: fc.integer({ min: 0, max: 100000 }),
  cost: fc.integer({ min: 0, max: 100000000 }),
  orders: fc.integer({ min: 0, max: 1000 }),
});
const rowsArb = fc
  .uniqueArray(rawRow, { selector: (row) => `${row.camp}|${row.day}`, maxLength: 45 })
  .map((rows): DailyEntry[] =>
    rows.map((row) => {
      const date = addDays('2025-11-01', row.day),
        campaignId = `c${row.camp}`;
      return {
        date,
        campaignId,
        id: `${campaignId}|${date}`,
        reach: row.reach,
        clicks: Math.min(row.clicks, row.reach),
        cost: row.cost,
        orders: row.orders,
        source: 'mock',
        createdAt: 0,
        updatedAt: 0,
      };
    }),
  );
const settings: PersistedState['settings'] = {
  activeCampaignId: 'all',
  grain: 'day',
  range: null,
  liveMode: false,
  liveSpeed: 1,
  targets: {},
  reportFormat: 'short',
  duplicatePolicy: 'ask',
};
const project = (rows: DailyEntry[]) =>
  rows.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...row }) => row).sort((a, b) => a.id.localeCompare(b.id));

describe('QA-01 · sáu bất biến contracts, seed cố định / 200 lượt', () => {
  it('#1 · tổng tháng = tổng ngày = tổng entries ở mọi chiến dịch', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const index = buildRollups(rows);
        for (const campaignId of ['all', 'c1', 'c2', 'c3']) {
          const expected = sumTotals(rows.filter((row) => campaignId === 'all' || row.campaignId === campaignId));
          for (const grain of ['day', 'week', 'month', 'quarter'] as const)
            expect(sumTotals(getSeries(index, { ...query, campaignId, grain }).buckets)).toEqual(expected);
        }
      }),
      options,
    );
  });
  it('#2 · thêm delta tương đương rebuild; thêm rồi xóa trở về ban đầu', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const a = rows.filter((_, index) => index % 2 === 0),
          b = rows.filter((_, index) => index % 2 === 1);
        const index = buildRollups(a);
        applyDelta(index, { added: b, removed: [] });
        for (const grain of ['day', 'month', 'quarter'] as const)
          expect(getSeries(index, { ...query, grain })).toEqual(getSeries(buildRollups(rows), { ...query, grain }));
        applyDelta(index, { added: [], removed: b });
        expect(getSeries(index, query)).toEqual(getSeries(buildRollups(a), query));
      }),
      options,
    );
  });
  it('#3 · CTR trong [0,1], mọi KPI hữu hạn hoặc null kể cả mẫu số 0', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const kpis = computeKpis(sumTotals(rows));
        for (const value of Object.values(kpis)) expect(value === null || Number.isFinite(value)).toBe(true);
        if (kpis.ctr !== null) {
          expect(kpis.ctr).toBeGreaterThanOrEqual(0);
          expect(kpis.ctr).toBeLessThanOrEqual(1);
        }
      }),
      options,
    );
  });
  it('#4 · codec giữ dữ liệu nghiệp vụ; timestamp không nằm trong codec (docs/13)', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const state: PersistedState = {
          v: CONTRACT_VERSION,
          campaigns: [1, 2, 3].map((n) => ({ id: `c${n}`, name: `Chiến dịch ${n}`, createdAt: 0 })),
          entries: rows,
          settings,
        };
        const result = decodeState(encodeState(state));
        expect(project(result.entries)).toEqual(project(rows));
        expect(result.settings).toEqual(settings);
        expect(result.campaigns).toEqual(state.campaigns);
      }),
      options,
    );
  });
  it('#5 · dự báo không âm, khoảng 95% bao 80% và mean', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 7, maxLength: 20 }), (values) => {
        const result = forecastMetric(
          values,
          values.map((_, index) => addDays('2026-10-01', index)),
          'orders',
          14,
        );
        expect(result.points).toHaveLength(14);
        for (const point of result.points) {
          const sequence = [point.lo95, point.lo80, point.mean, point.hi80, point.hi95];
          expect(sequence.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
          expect(sequence).toEqual([...sequence].sort((a, b) => a - b));
        }
      }),
      options,
    );
  });
  it('#6 · nowcast từng chỉ số không nhỏ hơn thực tế, kể cả hôm nay partial', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }), (actual, prediction) => {
        const totals = { reach: actual * 100, clicks: actual * 5, cost: actual * 1000, orders: actual };
        const daily = {
          grain: 'day' as const,
          campaignId: 'default',
          buckets: [
            {
              ...totals,
              kpis: computeKpis(totals),
              key: '2026-10-31',
              grain: 'day' as const,
              start: '2026-10-31',
              end: '2026-10-31',
              daysWithData: 1,
              daysInPeriod: 1,
              isPartial: true,
            },
          ],
        };
        const forecasts: MetricForecast[] = (['reach', 'clicks', 'cost', 'orders'] as const).map((metric) => ({
          metric,
          model: 'naive',
          params: {},
          horizonDays: 1,
          confidence: 'low',
          backtest: { smape: null, mae: null, baselineSmape: null },
          points: [
            { date: '2026-10-31', mean: prediction, lo80: 0, hi80: prediction * 2, lo95: 0, hi95: prediction * 3 },
          ],
        }));
        const result = nowcast(daily, forecasts, '2026-10', 'month', '2026-10-31');
        for (const metric of ['reach', 'clicks', 'cost', 'orders'] as const)
          expect(result.projected[metric].mean).toBeGreaterThanOrEqual(result.actualToDate[metric]);
      }),
      options,
    );
  });
});
