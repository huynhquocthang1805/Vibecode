// Owner: ba-analyst (Nhân) — BA-02 rà lại. Giá trị chép từ docs/03 §3, docs/04 §2, §5.
import type { AnomalyConfig, TrendConfig } from '@/types/domain';

export const TREND_CONFIG: TrendConfig = {
  periods: { day: 14, week: 8, month: 6, quarter: 4 },
  flatPct: 5,
  slopePct: 2,
  minR2: 0.5,
  volatileCv: 0.5,
  volatileMinPeriods: 7,
};

export const ANOMALY_CONFIG: AnomalyConfig = {
  windowDays: 14,
  warnZ: 2.5,
  criticalZ: 3.5,
  metrics: ['cost', 'orders', 'ctr', 'cpc', 'cpa'],
  minWeeksForWeekday: 8,
};
