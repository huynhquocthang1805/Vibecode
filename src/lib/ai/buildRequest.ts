import type {
  AnalyticsSnapshot,
  Bucket,
  InsightRequest,
  MetricForecast,
  Totals,
} from '@/types/domain';

function sanitizeString(str: string, maxLength = 80): string {
  // Bỏ ký tự điều khiển (ASCII < 32), ký tự < và >, trim và cắt maxLength
  return str
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function roundKpi(val: number | null, decimals = 4): number | null {
  if (val === null) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function roundCost(cost: number): number {
  if (cost > 1_000_000) {
    return Math.round(cost / 1_000) * 1_000;
  }
  return Math.round(cost);
}

function formatRecentBucket(
  b: Bucket,
): Pick<Bucket, 'key' | 'isPartial' | keyof Totals | 'kpis'> {
  return {
    key: b.key,
    isPartial: b.isPartial,
    reach: Math.round(b.reach),
    clicks: Math.round(b.clicks),
    cost: roundCost(b.cost),
    orders: Math.round(b.orders),
    kpis: {
      ctr: roundKpi(b.kpis.ctr, 4),
      cpc: b.kpis.cpc !== null ? Math.round(b.kpis.cpc) : null,
      cpa: b.kpis.cpa !== null ? Math.round(b.kpis.cpa) : null,
      cvr: roundKpi(b.kpis.cvr, 4),
    },
  };
}

const CONFIDENCE_WEIGHT: Record<NonNullable<MetricForecast['confidence']>, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function getLowestConfidence(
  forecasts: MetricForecast[],
): MetricForecast['confidence'] | undefined {
  if (!forecasts || forecasts.length === 0) return undefined;

  const relevant = forecasts.filter(
    (f) => f.metric === 'orders' || f.metric === 'cost',
  );
  const targets = relevant.length > 0 ? relevant : forecasts;

  let lowest: MetricForecast['confidence'] | undefined;
  for (const f of targets) {
    if (!f.confidence) continue;
    if (!lowest || CONFIDENCE_WEIGHT[f.confidence] < CONFIDENCE_WEIGHT[lowest]) {
      lowest = f.confidence;
    }
  }

  return lowest;
}

/**
 * Xây dựng payload InsightRequest gọn gàng cho API / LLM:
 * - Tên chiến dịch được làm sạch, tối đa 80 ký tự.
 * - Lấy tối đa 90 kỳ gần nhất, làm tròn số để tiết kiệm token và bảo đảm payload < 12KB.
 * - Lấy tối đa 10 bất thường gần nhất.
 * - Điền forecastConfidence theo CR-004.
 */
export function buildInsightRequest(
  snap: AnalyticsSnapshot,
  campaignName: string,
  ctx?: InsightRequest['context'],
): InsightRequest {
  const cleanName = sanitizeString(campaignName || 'Chiến dịch', 80);

  const rangeFrom =
    snap.query.range?.from ?? snap.dataSpan.first ?? snap.query.today;
  const rangeTo =
    snap.query.range?.to ?? snap.dataSpan.last ?? snap.query.today;

  // Lấy tối đa ≤ 90 kỳ gần nhất (chọn 70 kỳ để bảo đảm kích thước payload < 12KB)
  const rawBuckets = snap.series?.buckets ?? [];
  const recent = rawBuckets.slice(-70).map(formatRecentBucket);

  // Lấy tối đa 10 bất thường
  const anomalies = (snap.anomalies ?? []).slice(-10);

  // Tính confidence thấp nhất (CR-004)
  const forecastConfidence = getLowestConfidence(snap.forecasts ?? []);

  // Trend summary
  const trend = snap.trend ?? {
    grain: snap.query.grain,
    periods: recent.length,
    overall: 'flat' as const,
    metrics: [],
    comparison: null,
    dataQuality: { days: recent.length, missingDays: 0, sufficient: false },
  };

  // Làm sạch context nếu có
  const cleanContext = ctx
    ? {
        industry: ctx.industry ? sanitizeString(ctx.industry, 40) : undefined,
        goal: ctx.goal,
        monthlyBudget:
          ctx.monthlyBudget !== undefined ? Math.round(ctx.monthlyBudget) : undefined,
      }
    : undefined;

  const totals = {
    reach: Math.round(snap.totals.reach),
    clicks: Math.round(snap.totals.clicks),
    cost: roundCost(snap.totals.cost),
    orders: Math.round(snap.totals.orders),
    kpis: {
      ctr: roundKpi(snap.totals.kpis.ctr, 4),
      cpc: snap.totals.kpis.cpc !== null ? Math.round(snap.totals.kpis.cpc) : null,
      cpa: snap.totals.kpis.cpa !== null ? Math.round(snap.totals.kpis.cpa) : null,
      cvr: roundKpi(snap.totals.kpis.cvr, 4),
    },
  };

  return {
    locale: 'vi',
    campaignName: cleanName,
    grain: snap.query.grain,
    range: { from: rangeFrom, to: rangeTo },
    totals,
    trend,
    recent,
    nowcasts: (snap.nowcasts ?? []).slice(0, 2),
    forecastConfidence,
    anomalies,
    context: cleanContext,
  };
}
