import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { InsightRequest, MetricTrend } from '@/types/domain';

import { POST } from './route';

function makeValidRequest(): InsightRequest {
  const metrics: MetricTrend[] = [
    { metric: 'orders', direction: 'up', changePct: 15, slopePerPeriod: 1, r2: 0.8, cv: 0.1, assessment: 'good' },
    { metric: 'cpa', direction: 'down', changePct: -10, slopePerPeriod: -10, r2: 0.7, cv: 0.1, assessment: 'good' },
  ];

  return {
    locale: 'vi',
    campaignName: 'Test Campaign',
    grain: 'day',
    range: { from: '2026-10-01', to: '2026-10-10' },
    totals: { reach: 30000, clicks: 600, cost: 12000000, orders: 60, kpis: { ctr: 0.02, cpc: 20000, cpa: 200000, cvr: 0.1 } },
    trend: {
      grain: 'day',
      periods: 10,
      overall: 'up',
      metrics,
      comparison: null,
      dataQuality: { days: 10, missingDays: 0, sufficient: true },
    },
    recent: [],
    nowcasts: [],
    anomalies: [],
  };
}

describe('AI-02 Route POST /api/insights', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'stub';
    process.env.ALLOW_STUB = '1';
  });

  it('trả về 400 khi body không phải JSON hợp lệ', async () => {
    const req = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: 'invalid json text',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('trả về 413 khi payload vượt quá 32KB', async () => {
    const largeName = 'A'.repeat(33 * 1024);
    const req = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: JSON.stringify({ largeName }),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('trả về 422 INSUFFICIENT_DATA kèm fallback khi số ngày < 3', async () => {
    const payload = makeValidRequest();
    payload.trend.dataQuality.days = 2;

    const req = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('INSUFFICIENT_DATA');
    expect(data.fallback).toBeDefined();
    expect(data.fallback.source).toBe('fallback');
  });

  it('trả về 200 và kết quả AI hoàn chỉnh khi hợp lệ', async () => {
    const payload = makeValidRequest();
    const req = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe('ai');
    expect(data.suggestions).toHaveLength(3);
    expect(data.headline).toBeDefined();
  });

  it('lưu cache và trả về 200 cho cùng một request', async () => {
    const payload = makeValidRequest();
    payload.campaignName = 'Cache Test Campaign';

    const req1 = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    const req2 = new Request('http://localhost:3000/api/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data1.generatedAt).toBe(data2.generatedAt);
  });
});
