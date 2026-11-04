import { cleanup, render, waitFor } from '@testing-library/react';
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
    expect(forecastSeries).toHaveLength(6);
    for (const series of forecastSeries) expect(series.data).toHaveLength(option.xAxis.data.length);
  });
});
