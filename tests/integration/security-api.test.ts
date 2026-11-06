import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StubProvider } from '@/lib/ai/provider/stub';
import { insightResponseSchema } from '@/lib/ai/schemas';
import type { InsightRequest } from '@/types/domain';

vi.mock('server-only', () => ({}));
const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/ai/provider', () => ({ getProvider: provider.create }));
let post: typeof import('@/app/api/insights/route').POST;
const payload: InsightRequest = {
  locale: 'vi',
  campaignName: 'QA security',
  grain: 'day',
  range: { from: '2026-11-01', to: '2026-11-03' },
  totals: { reach: 3000, clicks: 60, cost: 300000, orders: 6, kpis: { ctr: 0.02, cpc: 5000, cpa: 50000, cvr: 0.1 } },
  trend: {
    grain: 'day',
    periods: 3,
    overall: 'flat',
    comparison: null,
    dataQuality: { days: 3, missingDays: 0, sufficient: true },
    metrics: [],
  },
  recent: [],
  nowcasts: [],
  anomalies: [],
};
function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/insights', {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': '192.0.2.77', ...headers },
  });
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T05:00:00Z'));
  vi.stubEnv('ALLOW_STUB', '1');
  provider.create.mockReset().mockReturnValue(new StubProvider());
  ({ POST: post } = await import('@/app/api/insights/route'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('QA-07 · giới hạn body và rate limit qua route thật', () => {
  it.each(['declared', 'missing', 'understated'] as const)(
    'body 1MB với Content-Length %s trả 413 trước provider',
    async (mode) => {
      const body = JSON.stringify({ data: 'x'.repeat(1024 * 1024) });
      const headers: Record<string, string> =
        mode === 'missing' ? {} : { 'content-length': mode === 'declared' ? String(Buffer.byteLength(body)) : '1' };
      const response = await post(request(body, headers));
      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
      expect(provider.create).not.toHaveBeenCalled();
    },
  );
  it('20 request cùng IP: 10 thành công, 10 trả 429/fallback; IP khác và phút sau hoạt động', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      const response = await post(request(JSON.stringify({ ...payload, campaignName: `QA ${i}` })));
      statuses.push(response.status);
      const body: unknown = await response.json();
      if (i < 10) expect(insightResponseSchema.parse(body).suggestions).toHaveLength(3);
      else {
        expect(body).toMatchObject({ code: 'RATE_LIMITED', fallback: { source: 'fallback' } });
        expect(insightResponseSchema.parse((body as { fallback: unknown }).fallback).suggestions).toHaveLength(3);
      }
    }
    expect(statuses).toEqual([...Array<number>(10).fill(200), ...Array<number>(10).fill(429)]);
    expect(provider.create).toHaveBeenCalledTimes(10);
    expect((await post(request(JSON.stringify(payload), { 'x-forwarded-for': '192.0.2.78' }))).status).toBe(200);
    vi.setSystemTime(Date.now() + 60_001);
    expect((await post(request(JSON.stringify({ ...payload, campaignName: 'after refill' })))).status).toBe(200);
  });
});
