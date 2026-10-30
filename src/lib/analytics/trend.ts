import { notImplemented } from '@/lib/notImplemented';
import type { PeriodComparison, Series, TrendConfig, TrendSummary } from '@/types/domain';

/** docs/04 §2 — đầu vào chính của AI */
export function analyzeTrend(_series: Series, _cmp: PeriodComparison | null, _cfg: TrendConfig): TrendSummary {
  return notImplemented('FC-01');
}
