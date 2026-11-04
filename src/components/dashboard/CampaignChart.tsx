'use client';

import type { EChartsOption } from 'echarts';
import { ChartNoAxesCombined } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useContext, useSyncExternalStore } from 'react';

import { METRIC_META } from '@/config/metricMeta';
import { fmtInt, fmtPct, fmtVnd, fmtVndShort } from '@/lib/domain/format';
import type { AnalyticsSnapshot, Metric } from '@/types/domain';

import { ChartAppearanceContext, useDisplaySnapshot } from './ReviewContext';
import { METRIC_COLORS, CHART_FONT } from './chartTheme';

const EChart = dynamic(() => import('./EChartCanvas'), {
  ssr: false,
  loading: () => <div className="skeleton-block h-full" aria-label="Đang tải biểu đồ" />,
});
const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};

export function CampaignChart({
  snapshot,
  ratio = false,
  showForecast = false,
}: {
  snapshot: AnalyticsSnapshot | null;
  ratio?: boolean;
  showForecast?: boolean;
}) {
  const data = useDisplaySnapshot(snapshot);
  const dark = useContext(ChartAppearanceContext);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  if (!data?.series.buckets.length)
    return (
      <div className="chart-empty">
        <span className="empty-icon">
          <ChartNoAxesCombined size={24} />
        </span>
        <strong className="text-sm font-medium">Biến số liệu thành góc nhìn</strong>
        <p>Nhập số liệu để bắt đầu, hoặc chọn “Xem giao diện mẫu” để khám phá biểu đồ.</p>
      </div>
    );
  const buckets = data.series.buckets;
  const metrics: Metric[] = ratio ? ['ctr', 'cpc', 'cpa'] : ['reach', 'cost', 'orders'];
  const labels = buckets.map((b) => b.key);
  const series: NonNullable<EChartsOption['series']> = metrics.map((metric, index) => ({
    name: METRIC_META[metric].short,
    type: !ratio && metric === 'reach' ? 'bar' : 'line',
    yAxisIndex: index === 0 ? 0 : index === 1 ? 1 : ratio ? 1 : 2,
    data: buckets.map((b) =>
      metric in b.kpis ? b.kpis[metric as keyof typeof b.kpis] : b[metric as 'reach' | 'clicks' | 'cost' | 'orders'],
    ),
    itemStyle: { color: METRIC_COLORS[metric], borderRadius: metric === 'reach' ? [3, 3, 0, 0] : undefined },
    lineStyle: { width: 2.5 },
    barMaxWidth: 14,
    showSymbol: buckets.length < 10,
    symbolSize: 5,
    connectNulls: false,
    sampling: 'lttb',
    progressive: 2000,
    tooltip: {
      valueFormatter: (value) => {
        const number = typeof value === 'number' ? value : null;
        return METRIC_META[metric].unit === 'ratio'
          ? fmtPct(number)
          : METRIC_META[metric].unit === 'vnd'
            ? fmtVnd(number)
            : fmtInt(number);
      },
    },
    emphasis: { focus: 'series' },
  }));
  if (showForecast && data.series.grain === 'day') {
    for (const forecast of data.forecasts) {
      if (!metrics.includes(forecast.metric)) continue;
      const metricIndex = metrics.indexOf(forecast.metric);
      const points = forecast.points.filter((p) => p.date > (buckets.at(-1)?.end ?? ''));
      const pointMap = new Map(points.map((p) => [p.date, p]));
      const futureDates = points.map((p) => p.date);
      for (const date of futureDates) if (!labels.includes(date)) labels.push(date);
      const forecastData = labels.map((date) => pointMap.get(date)?.mean ?? null);
      const axis = metricIndex === 0 ? 0 : metricIndex === 1 ? 1 : 2;
      series.push({
        name: `${METRIC_META[forecast.metric].short} dự báo`,
        type: 'line',
        yAxisIndex: axis,
        data: forecastData,
        showSymbol: false,
        lineStyle: { type: 'dashed', color: METRIC_COLORS[forecast.metric], width: 2 },
        itemStyle: { color: METRIC_COLORS[forecast.metric] },
        markLine: {
          symbol: 'none',
          label: { formatter: 'Hôm nay', color: dark ? '#bac4d9' : '#6f7787' },
          lineStyle: { color: '#a9b4ce' },
          data: [{ xAxis: data.query.today }],
        },
      });
      series.push({
        name: `${forecast.metric}-lo80`,
        type: 'line',
        yAxisIndex: axis,
        stack: `band-${forecast.metric}`,
        data: labels.map((date) => pointMap.get(date)?.lo80 ?? null),
        lineStyle: { opacity: 0 },
        showSymbol: false,
        areaStyle: { opacity: 0 },
        silent: true,
        tooltip: { show: false },
      });
      series.push({
        name: `${forecast.metric}-hi80`,
        type: 'line',
        yAxisIndex: axis,
        stack: `band-${forecast.metric}`,
        data: labels.map((date) => {
          const p = pointMap.get(date);
          return p ? p.hi80 - p.lo80 : null;
        }),
        lineStyle: { opacity: 0 },
        showSymbol: false,
        areaStyle: { color: METRIC_COLORS[forecast.metric], opacity: 0.1 },
        silent: true,
        tooltip: { show: false },
      });
    }
  }
  const labelColor = dark ? '#a1aabc' : '#8992a4';
  const option: EChartsOption = {
    animation: !reduced && buckets.length <= 2000,
    animationDuration: 450,
    textStyle: { fontFamily: CHART_FONT, fontSize: 10 },
    aria: { enabled: true, decal: { show: true } },
    grid: { left: 6, right: ratio ? 8 : 36, top: 55, bottom: labels.length > 90 ? 60 : 14, containLabel: true },
    legend: {
      top: 6,
      left: 0,
      data: metrics.map((m) => METRIC_META[m].short),
      icon: 'roundRect',
      itemWidth: 9,
      itemHeight: 5,
      itemGap: 18,
      textStyle: { color: labelColor, fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: dark ? '#232b3b' : '#fff',
      borderColor: dark ? '#384159' : '#e9ecf1',
      textStyle: { color: dark ? '#eef1f8' : '#202633', fontFamily: CHART_FONT, fontSize: 11 },
      axisPointer: { type: 'shadow', shadowStyle: { color: '#5373ff08' } },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: dark ? '#30384a' : '#edf0f5' } },
      axisTick: { show: false },
      axisLabel: {
        color: labelColor,
        fontSize: 9,
        hideOverlap: true,
        formatter: (value: string) => (data.series.grain === 'day' ? value.slice(8) + '/' + value.slice(5, 7) : value),
      },
    },
    yAxis: [
      {
        type: 'value',
        name: ratio ? 'CTR (%)' : 'Reach',
        nameTextStyle: { color: labelColor, fontSize: 9 },
        splitLine: { lineStyle: { color: dark ? '#2b3241' : '#edf0f5', type: 'dashed' } },
        axisLabel: { color: labelColor, fontSize: 9, formatter: (v: number) => (ratio ? fmtPct(v) : fmtInt(v)) },
      },
      {
        type: 'value',
        name: ratio ? '₫' : 'Chi phí (₫)',
        nameTextStyle: { color: labelColor, fontSize: 9 },
        splitLine: { show: false },
        axisLabel: { color: labelColor, fontSize: 9, formatter: (v: number) => fmtVndShort(v) },
      },
      ...(!ratio
        ? [
            {
              type: 'value' as const,
              name: 'Đơn',
              position: 'right' as const,
              offset: 58,
              nameTextStyle: { color: labelColor, fontSize: 9 },
              splitLine: { show: false },
              axisLabel: { color: labelColor, fontSize: 9, formatter: (v: number) => fmtInt(v) },
            },
          ]
        : []),
    ],
    dataZoom:
      labels.length > 90
        ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 0, borderColor: 'transparent' }]
        : [],
    series,
  };
  return (
    <>
      <div
        className="chart-canvas"
        role="img"
        aria-label={
          ratio ? 'Biểu đồ CTR, CPC và CPA theo kỳ' : 'Biểu đồ reach, chi phí và đơn hàng với ba trục đơn vị riêng'
        }
      >
        <EChart option={option} pointCount={labels.length} />
      </div>
      <div className="chart-footer">
        <span>
          {buckets[0]?.start.split('-').reverse().join('/')} — {buckets.at(-1)?.end.split('-').reverse().join('/')}
        </span>
        <span>{buckets.length} kỳ · Chạm chú giải để ẩn/hiện</span>
      </div>
    </>
  );
}
