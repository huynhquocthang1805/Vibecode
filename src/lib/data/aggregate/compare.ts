import { addDays, bucketKey, bucketRange, daysBetween } from '@/lib/domain/dates';
import { computeKpis, pctChange, sumTotals } from '@/lib/domain/kpi';
import type { Bucket, ISODate, Metric, PeriodComparison, Series } from '@/types/domain';

function computeDeltaPct(curr: Bucket, prev: Bucket | null): Record<Metric, number | null> {
  if (!prev) {
    return {
      reach: null,
      clicks: null,
      cost: null,
      orders: null,
      ctr: null,
      cpc: null,
      cpa: null,
      cvr: null,
    };
  }

  return {
    reach: pctChange(curr.reach, prev.reach),
    clicks: pctChange(curr.clicks, prev.clicks),
    cost: pctChange(curr.cost, prev.cost),
    orders: pctChange(curr.orders, prev.orders),
    ctr: pctChange(curr.kpis.ctr, prev.kpis.ctr),
    cpc: pctChange(curr.kpis.cpc, prev.kpis.cpc),
    cpa: pctChange(curr.kpis.cpa, prev.kpis.cpa),
    cvr: pctChange(curr.kpis.cvr, prev.kpis.cvr),
  };
}

/**
 * Like-for-like (docs/03 §3). Kỳ hiện tại partial và grain ≠ day → cắt cùng số ngày đầu
 * của kỳ trước từ `daily` (CR-003). Không có `daily` → likeForLike = false.
 */
export function comparePeriods(series: Series, today: ISODate, daily?: Series): PeriodComparison | null {
  const buckets = series.buckets;
  if (!buckets || buckets.length === 0) {
    return null;
  }

  const current = buckets[buckets.length - 1]!;

  // Grain 'day': không áp dụng like-for-like
  if (series.grain === 'day') {
    const previous = buckets.length >= 2 ? buckets[buckets.length - 2]! : null;
    return {
      current,
      previous,
      likeForLike: false,
      deltaPct: computeDeltaPct(current, previous),
    };
  }

  // Grain != 'day': kiểm tra partial
  const isPartial = current.isPartial || current.end >= today;

  // Nếu không partial, hoặc không có daily data -> so sánh thông thường
  if (!isPartial || !daily || !daily.buckets || daily.buckets.length === 0) {
    const previous = buckets.length >= 2 ? buckets[buckets.length - 2]! : null;
    return {
      current,
      previous,
      likeForLike: false,
      deltaPct: computeDeltaPct(current, previous),
    };
  }

  // Like-for-like: tính số ngày đã trôi qua trong kỳ hiện tại
  const currentElapsedDays = Math.min(daysBetween(current.start, today) + 1, current.daysInPeriod);
  if (currentElapsedDays <= 0) {
    const previous = buckets.length >= 2 ? buckets[buckets.length - 2]! : null;
    return {
      current,
      previous,
      likeForLike: false,
      deltaPct: computeDeltaPct(current, previous),
    };
  }

  let prevKey: string;
  let prevStart: ISODate;
  let prevTotalDays: number;

  if (buckets.length >= 2) {
    const rawPrev = buckets[buckets.length - 2]!;
    prevKey = rawPrev.key;
    prevStart = rawPrev.start;
    prevTotalDays = rawPrev.daysInPeriod;
  } else {
    const prevLastDay = addDays(current.start, -1);
    prevKey = bucketKey(prevLastDay, series.grain);
    const prevInfo = bucketRange(prevKey, series.grain);
    prevStart = prevInfo.start;
    prevTotalDays = prevInfo.days;
  }

  const prevDaysToTake = Math.min(currentElapsedDays, prevTotalDays);
  const prevCutoff = addDays(prevStart, prevDaysToTake - 1);

  const prevDailyBuckets = daily.buckets.filter((b) => b.start >= prevStart && b.start <= prevCutoff);
  const prevTotals = sumTotals(prevDailyBuckets);
  const prevDaysWithData = prevDailyBuckets.filter((b) => b.daysWithData > 0).length;

  const previous: Bucket = {
    key: prevKey,
    grain: series.grain,
    start: prevStart,
    end: prevCutoff,
    daysWithData: prevDaysWithData,
    daysInPeriod: prevDaysToTake,
    isPartial: true,
    ...prevTotals,
    kpis: computeKpis(prevTotals),
  };

  return {
    current,
    previous,
    likeForLike: true,
    deltaPct: computeDeltaPct(current, previous),
  };
}
