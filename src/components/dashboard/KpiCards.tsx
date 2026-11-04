'use client';

import { Eye, Info, MousePointer2, ShoppingBag, Wallet } from 'lucide-react';
import { memo } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GLOSSARY } from '@/config/glossary';
import { METRIC_META } from '@/config/metricMeta';
import { fmtDelta, fmtInt, fmtPct, fmtVnd, fmtVndShort } from '@/lib/domain/format';
import { safeDiv } from '@/lib/domain/kpi';
import type { AnalyticsSnapshot, Metric } from '@/types/domain';

import { useDisplaySnapshot } from './ReviewContext';
import { METRIC_COLORS } from './chartTheme';

const PRIMARY = ['orders', 'reach', 'clicks', 'cost'] as const;
const RATIOS = ['ctr', 'cpc', 'cpa'] as const;
const ICONS = { orders: ShoppingBag, reach: Eye, clicks: MousePointer2, cost: Wallet };

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const finite = values.filter((n): n is number => n !== null && Number.isFinite(n));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const points = finite
    .map((n, i) => `${(safeDiv(i, finite.length - 1) ?? 0) * 84 + 2},${28 - (safeDiv(n - min, max - min) ?? 0.5) * 24}`)
    .join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 88 32" fill="none" aria-hidden="true">
      <polyline points={points} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricTooltip({ metric }: { metric: Metric }) {
  const meta = METRIC_META[metric];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="inline-flex size-11 items-center justify-center rounded-full"
          aria-label={`Giải thích ${meta.label}`}
        >
          <Info size={12} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {GLOSSARY[metric] ?? meta.formula ?? meta.label}
        {meta.unit === 'ratio' && ' · KPI tổng được tính từ tổng số liệu.'}
      </TooltipContent>
    </Tooltip>
  );
}

export const KpiCards = memo(function KpiCards({ snapshot }: { snapshot: AnalyticsSnapshot | null }) {
  const data = useDisplaySnapshot(snapshot);
  function value(metric: Metric): number | null {
    if (!data) return null;
    return metric in data.totals.kpis
      ? data.totals.kpis[metric as keyof typeof data.totals.kpis]
      : data.totals[metric as keyof Pick<typeof data.totals, 'reach' | 'clicks' | 'cost' | 'orders'>];
  }
  function delta(metric: Metric) {
    const pct = data?.trend?.comparison?.deltaPct[metric] ?? null;
    const better = METRIC_META[metric].higherIsBetter;
    const bad = pct !== null && better !== null && (better ? pct < 0 : pct > 0);
    return (
      <span
        className={`metric-delta ${bad ? 'bad' : ''}`}
        style={better === null ? { color: 'var(--subtle)' } : undefined}
      >
        {pct === null ? '— Chưa có so sánh' : fmtDelta(pct)}
      </span>
    );
  }
  function spark(metric: Metric, featured = false) {
    const values =
      data?.series.buckets
        .slice(-14)
        .map((b) =>
          metric in b.kpis
            ? b.kpis[metric as keyof typeof b.kpis]
            : b[metric as 'reach' | 'clicks' | 'cost' | 'orders'],
        ) ?? [];
    return <Sparkline values={values} color={featured ? '#ffffffb5' : METRIC_COLORS[metric]} />;
  }
  return (
    <div aria-live="polite" data-testid="kpi-cards">
      <div className="kpi-primary-grid">
        {PRIMARY.map((metric) => {
          const meta = METRIC_META[metric];
          const Icon = ICONS[metric];
          return (
            <article className={`bento-card metric-card ${metric === 'orders' ? 'featured' : ''}`} key={metric}>
              <div className="metric-top">
                <span className="flex items-center gap-2">
                  <span className="metric-icon">
                    <Icon size={15} />
                  </span>
                  {meta.label}
                </span>
                <MetricTooltip metric={metric} />
              </div>
              <p className="metric-value" title={metric === 'cost' ? fmtVnd(value(metric)) : undefined}>
                {metric === 'cost' ? fmtVndShort(value(metric)) : fmtInt(value(metric))}
                {metric === 'cost' && Math.abs(value(metric) ?? 0) >= 1_000 && <span className="metric-unit"> ₫</span>}
              </p>
              <div className="metric-footer">
                <div>
                  {delta(metric)}
                  <p className="metric-footnote mt-1">kỳ gần nhất / kỳ trước</p>
                </div>
                {spark(metric, metric === 'orders')}
              </div>
            </article>
          );
        })}
      </div>
      <div className="kpi-secondary-grid">
        {RATIOS.map((metric) => (
          <article className="bento-card ratio-card" key={metric}>
            <div>
              <div className="metric-top">
                <span>{METRIC_META[metric].short}</span>
                <MetricTooltip metric={metric} />
              </div>
              <p className="metric-value">{metric === 'ctr' ? fmtPct(value(metric)) : fmtVnd(value(metric))}</p>
              <div className="mt-2">{delta(metric)}</div>
            </div>
            {spark(metric)}
          </article>
        ))}
      </div>
      {data?.trend?.comparison?.current.isPartial && (
        <p className="card-description mt-2">
          Kỳ hiện tại: đến hôm nay.{' '}
          {data.trend.comparison.likeForLike ? 'So sánh cùng số ngày.' : 'Các kỳ có độ dài khác nhau.'}
        </p>
      )}
    </div>
  );
});
