import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { useDataStore } from '@/lib/data/store';
import type { AnalyticsQuery, DailyEntry } from '@/types/domain';

import { getAnalyticsClient } from './client';
import { useAnalytics } from './useAnalytics';

function makeEntry(campaignId: string, date: string, reach: number, clicks: number, cost: number, orders: number): DailyEntry {
  return {
    id: `${campaignId}|${date}`,
    campaignId,
    date,
    reach,
    clicks,
    cost,
    orders,
    source: 'manual',
    createdAt: 1730000000000,
    updatedAt: 1730000000000,
  };
}

describe('DATA-06 · useAnalytics hook (R-01, R-02, R-04)', () => {
  beforeEach(async () => {
    const store = useDataStore.getState();
    await store.clearAll();
    useDataStore.setState({
      hydrated: true,
      entries: [makeEntry('default', '2026-10-15', 1000, 50, 100000, 5)],
      revision: 1,
    });
  });

  it('R-01: qKey ổn định không gây vòng lặp khi truyền object mới cùng giá trị', async () => {
    const client = getAnalyticsClient();
    const snapshotSpy = vi.spyOn(client, 'snapshot');

    const baseQuery: AnalyticsQuery = {
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    };

    const { result, rerender } = renderHook(
      ({ q }) => useAnalytics(q),
      { initialProps: { q: { ...baseQuery } } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });

    const callsAfterMount = snapshotSpy.mock.calls.length;

    // Rerender với object mới nhưng cùng giá trị
    rerender({ q: { ...baseQuery } });
    rerender({ q: { ...baseQuery } });

    // Không kích hoạt thêm snapshot
    expect(snapshotSpy.mock.calls.length).toBe(callsAfterMount);
    snapshotSpy.mockRestore();
  });

  it('R-02: thay đổi store kích hoạt applyDelta tăng dần (không init lại)', async () => {
    const client = getAnalyticsClient();
    const applyDeltaSpy = vi.spyOn(client, 'applyDelta');
    const initSpy = vi.spyOn(client, 'init');

    const q: AnalyticsQuery = {
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    };

    const { result } = renderHook(() => useAnalytics(q));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });

    initSpy.mockClear();
    applyDeltaSpy.mockClear();

    // Thêm dòng mới vào store thông qua addEntries (sẽ phát bus 'entries/changed')
    act(() => {
      useDataStore.getState().addEntries([
        { date: '2026-10-16', campaignId: 'default', reach: 2000, clicks: 100, cost: 200000, orders: 10 },
      ]);
    });

    await waitFor(() => {
      expect(applyDeltaSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).not.toHaveBeenCalled();
      expect(result.current.data?.totals.reach).toBe(3000);
    });

    applyDeltaSpy.mockRestore();
    initSpy.mockRestore();
  });

  it('bắt lỗi mà không ném ra màn hình render khi snapshot thất bại', async () => {
    const client = getAnalyticsClient();
    const snapshotSpy = vi.spyOn(client, 'snapshot').mockRejectedValueOnce(new Error('MOCK_WORKER_ERROR'));

    const q: AnalyticsQuery = {
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    };

    const { result } = renderHook(() => useAnalytics(q));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error?.message).toBe('MOCK_WORKER_ERROR');
    });

    snapshotSpy.mockRestore();
  });

  it('tự chữa lệch khi gặp REVISION_GAP bằng cách gọi init lại', async () => {
    const client = getAnalyticsClient();
    const initSpy = vi.spyOn(client, 'init');

    const q: AnalyticsQuery = {
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    };

    const { result } = renderHook(() => useAnalytics(q));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    initSpy.mockClear();

    // Bơm sự kiện lệch revision (nhảy cóc lên 99)
    act(() => {
      bus.emit({
        type: 'entries/changed',
        delta: { added: [makeEntry('default', '2026-10-17', 500, 20, 50000, 2)], removed: [] },
        origin: 'local',
        revision: 99,
      });
    });

    await waitFor(() => {
      // REVISION_GAP khiến hook gọi init lại để tự chữa lành
      expect(initSpy).toHaveBeenCalled();
    });

    initSpy.mockRestore();
  });

  it('DATA-FIX-03 · BUG-QA04-03: không bị đói snapshot khi nhận chuỗi delta liên tục mỗi 16ms (Live x60)', async () => {
    const q: AnalyticsQuery = {
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    };

    const { result } = renderHook(() => useAnalytics(q));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data?.totals.reach).toBe(1000);
    });

    // Mô phỏng chuỗi tick dồn dập (mỗi ~15ms < 50ms debounce) nhưng nhờ maxWait 100ms vẫn cập nhật
    let stopStream = false;
    const interval = setInterval(() => {
      if (stopStream) return;
      act(() => {
        useDataStore.getState().addEntries(
          [{ date: '2026-10-20', campaignId: 'default', reach: 100, clicks: 5, cost: 10000, orders: 1 }],
          'sum',
        );
      });
    }, 15);

    try {
      await waitFor(
        () => {
          expect(result.current.data?.totals.reach).toBeGreaterThan(1000);
        },
        { timeout: 1500 },
      );
    } finally {
      stopStream = true;
      clearInterval(interval);
    }
  });
});
