import { pctChange, safeDiv } from '@/lib/domain/kpi';
import type {
  Assessment,
  Bucket,
  Metric,
  MetricTrend,
  PeriodComparison,
  Series,
  TrendConfig,
  TrendDirection,
  TrendSummary,
} from '@/types/domain';

const ALL_METRICS: Metric[] = ['reach', 'clicks', 'cost', 'orders', 'ctr', 'cpc', 'cpa', 'cvr'];

function getMetricValue(b: Bucket, m: Metric): number | null {
  switch (m) {
    case 'reach':
      return b.reach;
    case 'clicks':
      return b.clicks;
    case 'cost':
      return b.cost;
    case 'orders':
      return b.orders;
    case 'ctr':
      return b.kpis.ctr;
    case 'cpc':
      return b.kpis.cpc;
    case 'cpa':
      return b.kpis.cpa;
    case 'cvr':
      return b.kpis.cvr;
    default:
      return null;
  }
}

function getAssessment(m: Metric, dir: TrendDirection): Assessment {
  if (dir === 'flat' || dir === 'volatile') return 'neutral';
  if (m === 'cost') return 'neutral';

  if (m === 'cpc' || m === 'cpa') {
    return dir === 'up' ? 'bad' : 'good';
  }

  // reach, clicks, orders, ctr, cvr
  return dir === 'up' ? 'good' : 'bad';
}

interface RegressionResult {
  slope: number | null;
  slopePct: number | null;
  r2: number | null;
  cv: number | null;
}

function calculateRegression(values: Array<number | null>): RegressionResult {
  // Lọc lấy các điểm số hữu hạn
  const validPoints: Array<{ t: number; y: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      validPoints.push({ t: i, y: v });
    }
  }

  const n = validPoints.length;
  if (n < 2) {
    return { slope: null, slopePct: null, r2: null, cv: null };
  }

  let sumT = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    const pt = validPoints[i];
    if (!pt) continue;
    sumT += pt.t;
    sumY += pt.y;
  }

  const meanT = sumT / n;
  const meanY = sumY / n;

  let ssTT = 0;
  let ssTY = 0;
  let ssYY = 0;

  for (let i = 0; i < n; i++) {
    const pt = validPoints[i];
    if (!pt) continue;
    const dt = pt.t - meanT;
    const dy = pt.y - meanY;
    ssTT += dt * dt;
    ssTY += dt * dy;
    ssYY += dy * dy;
  }

  const slope = ssTT === 0 ? 0 : ssTY / ssTT;
  const r2 = ssTT === 0 || ssYY === 0 ? 0 : Math.min(1, Math.max(0, (ssTY * ssTY) / (ssTT * ssYY)));
  const sd = Math.sqrt(ssYY / (n - 1));
  const cv = safeDiv(sd, Math.abs(meanY));
  const slopePct = safeDiv(slope, Math.abs(meanY)) !== null ? (slope / Math.abs(meanY)) * 100 : null;

  return { slope, slopePct, r2, cv };
}

/** docs/04 §2 — đầu vào chính của AI */
export function analyzeTrend(series: Series, cmp: PeriodComparison | null, cfg: TrendConfig): TrendSummary {
  const maxPeriods = cfg.periods[series.grain] ?? 14;
  const buckets = series.buckets.slice(-maxPeriods);
  const nPeriods = buckets.length;

  let totalDays = 0;
  let totalMissingDays = 0;
  for (const b of buckets) {
    totalDays += b.daysWithData;
    totalMissingDays += Math.max(0, b.daysInPeriod - b.daysWithData);
  }

  const dataQuality = {
    days: totalDays,
    missingDays: totalMissingDays,
    sufficient: totalDays >= 3,
  };

  const metricTrends: MetricTrend[] = [];

  for (const metric of ALL_METRICS) {
    const values = buckets.map((b) => getMetricValue(b, metric));
    const currVal = values[values.length - 1] ?? null;
    const prevVal = values.length >= 2 ? (values[values.length - 2] ?? null) : null;

    // 1. changePct
    let changePct: number | null = null;
    if (cmp && cmp.deltaPct[metric] !== undefined) {
      changePct = cmp.deltaPct[metric];
    } else {
      changePct = pctChange(currVal, prevVal);
    }

    // 2. OLS regression & CV
    const reg = calculateRegression(values);

    // 3. Direction
    let direction: TrendDirection = 'flat';

    const isUpByChange = changePct !== null && changePct >= cfg.flatPct;
    const isUpBySlope = reg.slopePct !== null && reg.slopePct >= cfg.slopePct && reg.r2 !== null && reg.r2 >= cfg.minR2;

    const isDownByChange = changePct !== null && changePct <= -cfg.flatPct;
    const isDownBySlope = reg.slopePct !== null && reg.slopePct <= -cfg.slopePct && reg.r2 !== null && reg.r2 >= cfg.minR2;

    if (isUpByChange || isUpBySlope) {
      direction = 'up';
    } else if (isDownByChange || isDownBySlope) {
      direction = 'down';
    } else if (nPeriods >= cfg.volatileMinPeriods && reg.cv !== null && reg.cv > cfg.volatileCv) {
      direction = 'volatile';
    } else {
      direction = 'flat';
    }

    const assessment = getAssessment(metric, direction);

    metricTrends.push({
      metric,
      direction,
      changePct,
      slopePerPeriod: reg.slope,
      r2: reg.r2,
      cv: reg.cv,
      assessment,
    });
  }

  // 4. Overall Trend Direction
  const ordersTrend = metricTrends.find((m) => m.metric === 'orders');
  const cpaTrend = metricTrends.find((m) => m.metric === 'cpa');

  let overall: TrendDirection = 'flat';
  if (ordersTrend?.direction === 'up' && cpaTrend?.direction !== 'up') {
    overall = 'up';
  } else if (cpaTrend?.direction === 'up' && (cpaTrend.changePct ?? 0) > 10) {
    overall = 'down';
  } else if (ordersTrend?.direction === 'down') {
    overall = 'down';
  } else if (metricTrends.filter((m) => m.direction === 'volatile').length >= 3) {
    overall = 'volatile';
  } else if (ordersTrend?.direction) {
    overall = ordersTrend.direction;
  }

  return {
    grain: series.grain,
    periods: nPeriods,
    overall,
    metrics: metricTrends,
    comparison: cmp,
    dataQuality,
  };
}
