import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';
import type { AnalyticsSnapshot, MetricForecast } from '@/types/domain';

import { CampaignChart } from './CampaignChart';
import fixture from './reviewFixture.json';

const captured = vi.hoisted(() => ({
  option: null as null | { animation: boolean; xAxis: { data: string[] }; series: { name: string; data: unknown[] }[] },
}));
vi.mock('./EChartCanvas', () => ({
  default: ({ option }: { option: typeof captured.option }) => {
    captured.option = option;
    return <div>Biểu đồ thử</div>;
  },
}));
beforeEach(async () => {
  await Promise.resolve();
  captured.option = null;
  useDataStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'deviceMemory');
  vi.unstubAllGlobals();
});

describe('FD-04/09 — biểu đồ dự báo', () => {
  it('dùng chuỗi ngày sẵn có khi đổi kỳ trong cùng chiến dịch và khoảng lọc', async () => {
    const base = fixture as AnalyticsSnapshot;
    const snapshot: AnalyticsSnapshot = {
      ...base,
      query: { ...base.query, grain: 'quarter' },
      series: { ...base.series, grain: 'quarter', buckets: [{ ...base.series.buckets[0]!, key: '2026-Q4' }] },
    };
    useDataStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        activeCampaignId: snapshot.query.campaignId,
        range: snapshot.query.range ?? null,
        grain: 'quarter',
      },
    });
    render(<CampaignChart snapshot={snapshot} />);
    await waitFor(() => expect(captured.option?.xAxis.data).toEqual(['2026-Q4']));
    act(() => useDataStore.getState().setSettings({ grain: 'day' }));
    expect(captured.option?.xAxis.data).toEqual(snapshot.daily.buckets.map((bucket) => bucket.key));
    act(() => useDataStore.getState().setSettings({ activeCampaignId: 'another-campaign' }));
    expect(captured.option?.xAxis.data).toEqual(['2026-Q4']);
  });

  it('đồng nhất trục ngày cho mọi dải dự báo khi horizon khác nhau, tắt animation ở thiết bị ít RAM', async () => {
    const make = (metric: 'cost' | 'orders', dates: string[]): MetricForecast => ({
      metric,
      model: 'naive',
      params: {},
      horizonDays: dates.length,
      points: dates.map((date) => ({ date, mean: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 })),
      backtest: { smape: null, mae: null, baselineSmape: null },
      confidence: 'low',
    });
    const snapshot: AnalyticsSnapshot = {
      ...(fixture as AnalyticsSnapshot),
      forecasts: [make('cost', ['2026-11-02']), make('orders', ['2026-11-02', '2026-11-03'])],
    };
    render(<CampaignChart snapshot={snapshot} showForecast />);
    await waitFor(() => expect(captured.option).not.toBeNull());
    const option = captured.option!;
    expect(option.animation).toBe(false);
    expect(option.xAxis.data.slice(-2)).toEqual(['2026-11-02', '2026-11-03']);
    const forecastSeries = option.series.filter((series) => /dự báo|lo80|hi80/.test(series.name));
    // UI audit 2026-11-06: mỗi chỉ số 1 đường dự báo; dải tin cậy chỉ cho chỉ số chính (Đơn) → 2 đường + 2 biên
    expect(forecastSeries.map((x) => x.name).sort()).toEqual(
      ['Chi phí dự báo', 'orders-hi80', 'orders-lo80', 'Đơn dự báo'].sort(),
    );
    expect(forecastSeries.find((series) => series.name === 'Chi phí dự báo')?.data).toEqual([['2026-11-02', 10]]);
    expect(forecastSeries.find((series) => series.name === 'orders-lo80')?.data).toEqual([
      ['2026-11-02', 8],
      ['2026-11-03', 8],
    ]);
  });

  it('UI audit: dự báo dài tới cuối quý chỉ hiện ~½ số ngày đang xem (14–30 ngày) sau ngày thực tế cuối', async () => {
    const base = fixture as AnalyticsSnapshot;
    const last = base.series.buckets.at(-1)!.end;
    const dates: string[] = [];
    for (let i = 1; i <= 60; i++) {
      const [y, m, d] = last.split('-').map(Number) as [number, number, number];
      dates.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
    }
    const snapshot: AnalyticsSnapshot = {
      ...base,
      forecasts: [
        {
          metric: 'orders',
          model: 'naive',
          params: {},
          horizonDays: 60,
          points: dates.map((date) => ({ date, mean: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 })),
          backtest: { smape: null, mae: null, baselineSmape: null },
          confidence: 'low',
        },
      ],
    };
    render(<CampaignChart snapshot={snapshot} showForecast />);
    await waitFor(() => expect(captured.option).not.toBeNull());
    const future = captured.option!.xAxis.data.filter((d) => d > last);
    const expected = Math.min(30, Math.max(14, Math.round(base.series.buckets.length / 2)));
    expect(future.length).toBeLessThanOrEqual(expected + 1); // +1 nếu "hôm nay" chen vào trục
    expect(future.length).toBeGreaterThanOrEqual(expected - 1);
  });
});
