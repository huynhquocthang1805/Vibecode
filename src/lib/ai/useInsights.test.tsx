import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalyticsSnapshot, InsightResponse } from '@/types/domain';

import { useInsights } from './useInsights';

function makeMockSnapshot(): AnalyticsSnapshot {
  return {
    computedAt: 1730000000000,
    revision: 1,
    checksum: { reach: 10000, clicks: 500, cost: 15000000, orders: 50, rows: 10 },
    dataSpan: { first: '2026-01-01', last: '2026-01-10' },
    forecastStatus: 'ok',
    query: { campaignId: 'c1', grain: 'day', horizonDays: 30, today: '2026-01-10' },
    series: { grain: 'day', campaignId: 'c1', buckets: [] },
    daily: { grain: 'day', campaignId: 'c1', buckets: [] },
    totals: { reach: 10000, clicks: 500, cost: 15000000, orders: 50, kpis: { ctr: 0.05, cpc: 30000, cpa: 300000, cvr: 0.1 } },
    trend: {
      grain: 'day',
      periods: 10,
      overall: 'up',
      metrics: [],
      comparison: null,
      dataQuality: { days: 10, missingDays: 0, sufficient: true },
    },
    forecasts: [],
    nowcasts: [],
    anomalies: [],
    timings: {},
  };
}

const mockAiResponse: InsightResponse = {
  source: 'ai',
  model: 'gemini-1.5-flash@v1.0',
  generatedAt: 1730000000000,
  overall: 'up',
  headline: 'Chiến dịch tăng trưởng tốt.',
  metricComments: [],
  forecastComment: null,
  suggestions: [
    { title: 'S1', action: 'Hành động 1 dài hơn 25 ký tự cụ thể', rationale: 'R1', expectedImpact: 'E1', priority: 'high', relatedMetrics: ['orders'] },
    { title: 'S2', action: 'Hành động 2 dài hơn 25 ký tự cụ thể', rationale: 'R2', expectedImpact: 'E2', priority: 'medium', relatedMetrics: ['cpa'] },
    { title: 'S3', action: 'Hành động 3 dài hơn 25 ký tự cụ thể', rationale: 'R3', expectedImpact: 'E3', priority: 'low', relatedMetrics: ['cost'] },
  ],
  riskFlags: [],
  corrected: false,
  warnings: [],
};

describe('AI-06 Hook useInsights', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('trả về status idle khi snapshot là null', () => {
    const { result } = renderHook(() => useInsights(null));
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
  });

  it('gọi fetch và cập nhật status success khi API thành công', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAiResponse,
    } as Response);

    const snap = makeMockSnapshot();
    const { result } = renderHook(() => useInsights(snap));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.data?.headline).toBe('Chiến dịch tăng trưởng tốt.');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('chuyển sang status fallback khi server trả lỗi có kèm fallback', async () => {
    const fallbackResponse: InsightResponse = {
      ...mockAiResponse,
      source: 'fallback',
      model: 'rule-based@v1',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        code: 'PROVIDER_ERROR',
        message: 'Lỗi kết nối AI',
        fallback: fallbackResponse,
      }),
    } as Response);

    const snap = makeMockSnapshot();
    const { result } = renderHook(() => useInsights(snap));

    await waitFor(() => {
      expect(result.current.status).toBe('fallback');
    });

    expect(result.current.data?.source).toBe('fallback');
    expect(result.current.error?.code).toBe('PROVIDER_ERROR');
  });

  it('refresh() bỏ qua cache client và gọi lại API mới', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockAiResponse,
    } as Response);

    const snap = makeMockSnapshot();
    const { result } = renderHook(() => useInsights(snap));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Bấm refresh
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
