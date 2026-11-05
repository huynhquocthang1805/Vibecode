import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalyticsSnapshot, InsightResponse } from '@/types/domain';

import { _resetInflightState, useInsights } from './useInsights';

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
    _resetInflightState();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    _resetInflightState();
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

  it('R-02 (E26): không gọi fetch và giữ status idle khi sufficient = false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const snap = makeMockSnapshot();
    snap.trend!.dataQuality.sufficient = false;

    const { result } = renderHook(() => useInsights(snap));
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
  });

  it('R-02: refresh() không gọi fetch khi sufficient = false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const snap = makeMockSnapshot();
    snap.trend!.dataQuality.sufficient = false;

    const { result } = renderHook(() => useInsights(snap));
    act(() => {
      result.current.refresh();
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R-03: gộp request trùng khi 2 hook gọi useInsights cùng lúc', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => mockAiResponse,
            } as Response);
          }, 30);
        }),
    );

    const snap = makeMockSnapshot();
    const { result: hook1 } = renderHook(() => useInsights(snap));
    const { result: hook2 } = renderHook(() => useInsights(snap));

    await waitFor(() => {
      expect(hook1.current.status).toBe('success');
      expect(hook2.current.status).toBe('success');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(hook1.current.data?.headline).toBe('Chiến dịch tăng trưởng tốt.');
    expect(hook2.current.data?.headline).toBe('Chiến dịch tăng trưởng tốt.');
  });

  it('R-04: caller re-render nhiều lần tạo object mới cùng cacheKey và revision không gọi lại fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockAiResponse,
    } as Response);

    const baseSnap = makeMockSnapshot();
    const { rerender } = renderHook(({ s }) => useInsights(s), {
      initialProps: { s: baseSnap },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Re-render 10 lần với object mới nhưng cùng nội dung/revision
    for (let i = 0; i < 10; i++) {
      const clonedSnap = structuredClone(baseSnap);
      rerender({ s: clonedSnap });
    }

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('R-05: đổi grain sang key mới (đã có trong cache) khi fetch cũ chưa resolve → không bị đè dữ liệu cũ', async () => {
    const dayResponse: InsightResponse = {
      ...mockAiResponse,
      headline: 'Dữ liệu theo Ngày',
    };
    const weekResponse: InsightResponse = {
      ...mockAiResponse,
      headline: 'Dữ liệu theo Tuần (Cached)',
    };

    // Pre-populate cache cho key theo tuần
    const snapWeek = makeMockSnapshot();
    snapWeek.query.grain = 'week';
    const weekRangeKey = `${snapWeek.dataSpan.first ?? ''}_${snapWeek.dataSpan.last ?? ''}`;
    const weekCacheKey = `${snapWeek.query.campaignId}|week|${weekRangeKey}`;

    window.localStorage.setItem(
      'kpi-dash:ai-cache',
      JSON.stringify({
        [weekCacheKey]: {
          value: weekResponse,
          expiresAt: Date.now() + 86400000,
          totals: snapWeek.totals,
        },
      }),
    );

    // Fetch của ngày sẽ resolve chậm (sau 60ms)
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => dayResponse,
            } as Response);
          }, 60);
        }),
    );

    const snapDay = makeMockSnapshot();
    snapDay.query.grain = 'day';

    const { result, rerender } = renderHook(({ s }) => useInsights(s), {
      initialProps: { s: snapDay },
    });

    expect(result.current.status).toBe('loading');

    // Chuyển sang grain week sau 10ms (khi fetch của day vẫn đang bay)
    await new Promise((r) => setTimeout(r, 10));
    rerender({ s: snapWeek });

    // snapWeek nạp ngay từ cache client
    await waitFor(() => {
      expect(result.current.data?.headline).toBe('Dữ liệu theo Tuần (Cached)');
    });

    // Chờ 80ms để fetch cũ của day resolve xong
    await new Promise((r) => setTimeout(r, 80));

    // Đảm bảo dữ liệu không bị fetch của day ghi đè lên
    expect(result.current.data?.headline).toBe('Dữ liệu theo Tuần (Cached)');
    expect(result.current.status).toBe('success');
  });

  it('R-05: đổi grain sang key mới (chưa có trong cache) khi fetch cũ chưa resolve → data cuối cùng là của key mới', async () => {
    const dayResponse: InsightResponse = {
      ...mockAiResponse,
      headline: 'Dữ liệu Ngày',
    };
    const monthResponse: InsightResponse = {
      ...mockAiResponse,
      headline: 'Dữ liệu Tháng',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as { grain: string };
      const isMonth = body.grain === 'month';
      return new Promise((resolve) => {
        // Giả lập request day về chậm hơn request month
        const delay = isMonth ? 20 : 60;
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => (isMonth ? monthResponse : dayResponse),
          } as Response);
        }, delay);
      });
    });

    const snapDay = makeMockSnapshot();
    snapDay.query.grain = 'day';

    const snapMonth = makeMockSnapshot();
    snapMonth.query.grain = 'month';

    const { result, rerender } = renderHook(({ s }) => useInsights(s), {
      initialProps: { s: snapDay },
    });

    // Chuyển sang month sau 10ms
    await new Promise((r) => setTimeout(r, 10));
    rerender({ s: snapMonth });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.data?.headline).toBe('Dữ liệu Tháng');
    });

    // Chờ fetch của day kết thúc
    await new Promise((r) => setTimeout(r, 80));

    // Data vẫn phải là của Month
    expect(result.current.data?.headline).toBe('Dữ liệu Tháng');
  });

  it('R-05: unmount giữa chừng khi fetch đang bay không gây lỗi hoặc setState', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => mockAiResponse,
            } as Response);
          }, 50);
        }),
    );

    const snap = makeMockSnapshot();
    const { unmount } = renderHook(() => useInsights(snap));

    // Unmount sau 10ms khi fetch đang bay
    await new Promise((r) => setTimeout(r, 10));
    unmount();

    // Chờ fetch resolve xong
    await new Promise((r) => setTimeout(r, 80));
    // Không có lỗi unhandled rejection hay warning setState
  });
});
