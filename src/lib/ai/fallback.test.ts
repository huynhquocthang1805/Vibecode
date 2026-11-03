import { describe, expect, it } from 'vitest';

import type { InsightRequest, MetricTrend } from '@/types/domain';

import { fallbackInsight } from './fallback';
import { insightResponseSchema } from './schemas';

function makeTestRequest(overrides?: Partial<InsightRequest>): InsightRequest {
  const metrics: MetricTrend[] = [
    { metric: 'reach', direction: 'down', changePct: -12, slopePerPeriod: -5, r2: 0.6, cv: 0.1, assessment: 'bad' },
    { metric: 'clicks', direction: 'down', changePct: -15, slopePerPeriod: -2, r2: 0.5, cv: 0.1, assessment: 'bad' },
    { metric: 'cost', direction: 'up', changePct: 8, slopePerPeriod: 100, r2: 0.7, cv: 0.05, assessment: 'neutral' },
    { metric: 'orders', direction: 'down', changePct: -20, slopePerPeriod: -1, r2: 0.4, cv: 0.2, assessment: 'bad' },
    { metric: 'ctr', direction: 'down', changePct: -5, slopePerPeriod: -0.01, r2: 0.3, cv: 0.05, assessment: 'bad' },
    { metric: 'cpc', direction: 'up', changePct: 27, slopePerPeriod: 15, r2: 0.8, cv: 0.1, assessment: 'bad' },
    { metric: 'cpa', direction: 'up', changePct: 35, slopePerPeriod: 50, r2: 0.75, cv: 0.15, assessment: 'bad' },
    { metric: 'cvr', direction: 'down', changePct: -8, slopePerPeriod: -0.02, r2: 0.5, cv: 0.1, assessment: 'bad' },
  ];

  return {
    locale: 'vi',
    campaignName: 'Test Campaign',
    grain: 'day',
    range: { from: '2026-10-01', to: '2026-10-15' },
    totals: { reach: 50000, clicks: 1000, cost: 20000000, orders: 40, kpis: { ctr: 0.02, cpc: 20000, cpa: 500000, cvr: 0.04 } },
    trend: {
      grain: 'day',
      periods: 14,
      overall: 'down',
      metrics,
      comparison: null,
      dataQuality: { days: 14, missingDays: 0, sufficient: true },
    },
    recent: [],
    nowcasts: [],
    anomalies: [],
    ...overrides,
  };
}

describe('AI-05 Fallback Insight', () => {
  it('trả về phản hồi hợp lệ theo Zod schema', () => {
    const req = makeTestRequest();
    const res = fallbackInsight(req);
    expect(res.source).toBe('fallback');
    expect(res.model).toBe('rule-based@v1');
    expect(res.suggestions).toHaveLength(3);

    const parseResult = insightResponseSchema.safeParse(res);
    expect(parseResult.success).toBe(true);
  });

  it('hoạt động mang tính tất định (deterministic) với cùng input', () => {
    const req = makeTestRequest();
    const res1 = fallbackInsight(req);
    const res2 = fallbackInsight(req);

    expect(res1.headline).toBe(res2.headline);
    expect(res1.suggestions).toEqual(res2.suggestions);
    expect(res1.metricComments).toEqual(res2.metricComments);
  });

  it('kích hoạt luật CPA tăng & CVR giảm với độ ưu tiên high', () => {
    const req = makeTestRequest();
    const res = fallbackInsight(req);
    const cpaSug = res.suggestions.find((s) => s.relatedMetrics.includes('cpa'));
    expect(cpaSug).toBeDefined();
    expect(cpaSug?.priority).toBe('high');
  });

  it('sinh forecastComment khi có nowcasts', () => {
    const req = makeTestRequest({
      nowcasts: [
        {
          periodKey: '2026-10',
          grain: 'month',
          daysElapsed: 15,
          daysTotal: 31,
          actualToDate: { reach: 50000, clicks: 1000, cost: 20000000, orders: 40 },
          projected: {
            reach: { mean: 100000, lo80: 90000, hi80: 110000 },
            clicks: { mean: 2000, lo80: 1800, hi80: 2200 },
            cost: { mean: 40000000, lo80: 38000000, hi80: 42000000 },
            orders: { mean: 85, lo80: 75, hi80: 95 },
          },
          projectedKpis: { ctr: 0.02, cpc: 20000, cpa: 470588, cvr: 0.0425 },
        },
      ],
    });
    const res = fallbackInsight(req);
    expect(res.forecastComment).toContain('2026-10');
    expect(res.forecastComment).toContain('85');
  });
});
