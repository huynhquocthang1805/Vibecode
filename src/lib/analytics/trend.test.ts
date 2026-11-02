import { describe, expect, it } from 'vitest';

import { TREND_CONFIG } from '@/config/thresholds';
import type { Bucket, Series } from '@/types/domain';

import { analyzeTrend } from './trend';

function makeMockBucket(dayStr: string, orders: number, cost: number): Bucket {
  return {
    key: dayStr,
    grain: 'day',
    start: dayStr,
    end: dayStr,
    daysWithData: 1,
    daysInPeriod: 1,
    isPartial: false,
    reach: 1000,
    clicks: 100,
    cost,
    orders,
    kpis: {
      ctr: 0.1,
      cpc: cost / 100,
      cpa: orders > 0 ? cost / orders : null,
      cvr: orders / 100,
    },
  };
}

describe('FC-01: analyzeTrend', () => {
  it('detects upward trend for steadily increasing orders', () => {
    const buckets: Bucket[] = [];
    for (let i = 1; i <= 10; i++) {
      const day = `2026-10-${String(i).padStart(2, '0')}`;
      buckets.push(makeMockBucket(day, i * 10, 100000));
    }
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, TREND_CONFIG);
    const ordersTrend = summary.metrics.find((m) => m.metric === 'orders');

    expect(ordersTrend?.direction).toBe('up');
    expect(ordersTrend?.assessment).toBe('good');
    expect(summary.dataQuality.sufficient).toBe(true);
  });

  it('detects downward trend for decreasing metric', () => {
    const buckets: Bucket[] = [];
    for (let i = 10; i >= 1; i--) {
      const day = `2026-10-${String(11 - i).padStart(2, '0')}`;
      buckets.push(makeMockBucket(day, i * 10, 100000));
    }
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, TREND_CONFIG);
    const ordersTrend = summary.metrics.find((m) => m.metric === 'orders');

    expect(ordersTrend?.direction).toBe('down');
    expect(ordersTrend?.assessment).toBe('bad');
  });

  it('detects flat trend when values remain constant', () => {
    const buckets: Bucket[] = [];
    for (let i = 1; i <= 10; i++) {
      const day = `2026-10-${String(i).padStart(2, '0')}`;
      buckets.push(makeMockBucket(day, 50, 100000));
    }
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, TREND_CONFIG);
    const ordersTrend = summary.metrics.find((m) => m.metric === 'orders');

    expect(ordersTrend?.direction).toBe('flat');
    expect(ordersTrend?.assessment).toBe('neutral');
  });

  it('detects volatile trend when series has high variance without directional trend', () => {
    const buckets: Bucket[] = [];
    const values = [10, 100, 10, 100, 10, 100, 10, 100];
    for (let i = 0; i < values.length; i++) {
      const day = `2026-10-${String(i + 1).padStart(2, '0')}`;
      buckets.push(makeMockBucket(day, values[i] ?? 10, 100000));
    }
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, { ...TREND_CONFIG, flatPct: 1000 });
    const ordersTrend = summary.metrics.find((m) => m.metric === 'orders');
    expect(ordersTrend?.direction).toBe('volatile');
  });

  it('handles series with all zeroes gracefully without NaN', () => {
    const buckets: Bucket[] = [];
    for (let i = 1; i <= 5; i++) {
      const day = `2026-10-${String(i).padStart(2, '0')}`;
      buckets.push(makeMockBucket(day, 0, 0));
    }
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, TREND_CONFIG);
    for (const m of summary.metrics) {
      expect(Number.isNaN(m.slopePerPeriod)).toBe(false);
      expect(Number.isNaN(m.r2)).toBe(false);
      expect(Number.isNaN(m.cv)).toBe(false);
    }
  });

  it('handles small series (< 3 days) with sufficient: false', () => {
    const buckets: Bucket[] = [
      makeMockBucket('2026-10-01', 10, 1000),
      makeMockBucket('2026-10-02', 20, 2000),
    ];
    const series: Series = {
      grain: 'day',
      campaignId: 'default',
      buckets,
    };

    const summary = analyzeTrend(series, null, TREND_CONFIG);
    expect(summary.dataQuality.days).toBe(2);
    expect(summary.dataQuality.sufficient).toBe(false);
  });
});
