import { describe, expect, it } from 'vitest';

import type { AnalyticsSnapshot, Bucket } from '@/types/domain';

import { buildInsightRequest } from './buildRequest';
import { insightRequestSchema } from './schemas';

function makeSnapshot(dayCount = 30): AnalyticsSnapshot {
  const buckets: Bucket[] = Array.from({ length: dayCount }, (_, i) => ({
    key: `2026-01-${String(i + 1).padStart(2, '0')}`,
    grain: 'day',
    start: '2026-01-01',
    end: '2026-01-31',
    daysWithData: 1,
    daysInPeriod: 1,
    isPartial: false,
    reach: 1000 + i * 10,
    clicks: 50 + i,
    cost: 1500000 + i * 10000,
    orders: 5 + (i % 3),
    kpis: { ctr: 0.05, cpc: 30000, cpa: 300000, cvr: 0.1 },
  }));

  return {
    computedAt: 1730000000000,
    revision: 1,
    checksum: { reach: 10000, clicks: 500, cost: 15000000, orders: 50, rows: dayCount },
    dataSpan: { first: '2026-01-01', last: '2026-01-30' },
    forecastStatus: 'ok',
    query: { campaignId: 'c1', grain: 'day', horizonDays: 30, today: '2026-01-30' },
    series: { grain: 'day', campaignId: 'c1', buckets },
    daily: { grain: 'day', campaignId: 'c1', buckets },
    totals: { reach: 30000, clicks: 1500, cost: 45000000, orders: 150, kpis: { ctr: 0.05, cpc: 30000, cpa: 300000, cvr: 0.1 } },
    trend: {
      grain: 'day',
      periods: dayCount,
      overall: 'up',
      metrics: [
        { metric: 'orders', direction: 'up', changePct: 15, slopePerPeriod: 0.5, r2: 0.8, cv: 0.1, assessment: 'good' },
      ],
      comparison: null,
      dataQuality: { days: dayCount, missingDays: 0, sufficient: true },
    },
    forecasts: [
      {
        metric: 'orders',
        model: 'holt',
        params: {},
        horizonDays: 30,
        points: [],
        backtest: { smape: 10, mae: 2, baselineSmape: 15 },
        confidence: 'medium',
      },
      {
        metric: 'cost',
        model: 'holt_winters',
        params: {},
        horizonDays: 30,
        points: [],
        backtest: { smape: 12, mae: 3, baselineSmape: 18 },
        confidence: 'low',
      },
    ],
    nowcasts: [],
    anomalies: Array.from({ length: 25 }, () => ({
      date: '2026-01-10',
      metric: 'orders',
      value: 100,
      expected: 50,
      score: 3.8,
      direction: 'spike',
      severity: 'warning',
    })),
    timings: {},
  };
}

describe('AI-07 Payload Builder', () => {
  it('làm sạch tên chiến dịch: bỏ ký tự điều khiển, <>, cắt 80 ký tự', () => {
    const snap = makeSnapshot(10);
    const messyName = '<script>alert("hack")</script>\x00\x1FChiến dịch Mega Sale ' + 'X'.repeat(100);
    const req = buildInsightRequest(snap, messyName);

    expect(req.campaignName).not.toContain('<');
    expect(req.campaignName).not.toContain('>');
    expect(req.campaignName).not.toContain('\x00');
    expect(req.campaignName.length).toBeLessThanOrEqual(80);
    expect(req.campaignName).toContain('Chiến dịch Mega Sale');
  });

  it('lấy tối đa ≤ 90 kỳ gần nhất và 10 anomalies', () => {
    const snap = makeSnapshot(120); // 120 buckets
    const req = buildInsightRequest(snap, 'Test');

    expect(req.recent.length).toBeLessThanOrEqual(90);
    expect(req.anomalies.length).toBe(10);
  });

  it('tính confidence thấp nhất theo CR-004 (low < medium < high)', () => {
    const snap = makeSnapshot(10); // orders có medium, cost có low
    const req = buildInsightRequest(snap, 'Test');
    expect(req.forecastConfidence).toBe('low');
  });

  it('payload với 2 năm dữ liệu (730 ngày) có kích thước < 12KB', () => {
    const snap = makeSnapshot(730);
    const req = buildInsightRequest(snap, '2 Years Campaign');

    const jsonString = JSON.stringify(req);
    const byteSize = Buffer.byteLength(jsonString, 'utf8');

    // Kiểm tra schema hợp lệ
    const parseResult = insightRequestSchema.safeParse(req);
    expect(parseResult.success).toBe(true);

    // Kích thước phải < 12KB (12288 bytes)
    expect(byteSize).toBeLessThan(12 * 1024);
  });
});
