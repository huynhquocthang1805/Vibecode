import { addDays, bucketRange, daysBetween, parseISODate } from '@/lib/domain/dates';
import { computeKpis, safeDiv } from '@/lib/domain/kpi';
import type { BaseMetric, ForecastPoint, ISODate, MetricForecast, Nowcast, Series, Totals } from '@/types/domain';

import { BASE_METRICS } from './forecast';
import { FORECAST_CONFIG as CFG } from './forecastConfig';

function assertPoint(point: ForecastPoint): void {
  const ordered = [point.lo95, point.lo80, point.mean, point.hi80, point.hi95];
  if (
    parseISODate(point.date) !== point.date ||
    ordered.some((value, i) => !Number.isFinite(value) || value < 0 || (i > 0 && value < ordered[i - 1]!))
  )
    throw new RangeError('NOWCAST_INVALID_FORECAST');
}

/** docs/04 §4 — thực tế đến hôm nay + dự báo phần còn lại của kỳ */
export function nowcast(
  daily: Series,
  forecasts: MetricForecast[],
  periodKey: string,
  grain: 'month' | 'quarter',
  today: ISODate,
  target?: Partial<Totals>,
): Nowcast {
  const pattern = grain === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-Q[1-4]$/;
  if (daily.grain !== 'day' || !pattern.test(periodKey) || parseISODate(today) !== today)
    throw new RangeError('NOWCAST_INVALID_PERIOD');
  const range = bucketRange(periodKey, grain);
  const actualToDate: Totals = { reach: 0, clicks: 0, cost: 0, orders: 0 };
  const actualToday: Totals = { ...actualToDate };
  let completedToday = false;
  let previous = '';
  for (const bucket of daily.buckets) {
    if (parseISODate(bucket.start) !== bucket.start || bucket.start <= previous)
      throw new RangeError('NOWCAST_INVALID_SERIES');
    previous = bucket.start;
    if (bucket.start < range.start || bucket.start > range.end || bucket.start > today || bucket.daysWithData === 0)
      continue;
    for (const metric of BASE_METRICS) {
      if (!Number.isFinite(bucket[metric]) || bucket[metric] < 0) throw new RangeError('NOWCAST_INVALID_SERIES');
      actualToDate[metric] += bucket[metric];
      if (bucket.start === today) actualToday[metric] = bucket[metric];
    }
    if (bucket.start === today) completedToday = !bucket.isPartial;
  }
  const daysElapsed = Math.max(0, Math.min(range.days, daysBetween(range.start, today) + 1));
  const projected: Nowcast['projected'] = {
    reach: { mean: 0, lo80: 0, hi80: 0 },
    clicks: { mean: 0, lo80: 0, hi80: 0 },
    cost: { mean: 0, lo80: 0, hi80: 0 },
    orders: { mean: 0, lo80: 0, hi80: 0 },
  };
  const forecastMaps = new Map<BaseMetric, Map<ISODate, ForecastPoint>>();
  for (const forecast of forecasts) {
    if (forecastMaps.has(forecast.metric)) throw new RangeError('NOWCAST_DUPLICATE_METRIC');
    const points = new Map<ISODate, ForecastPoint>();
    for (const point of forecast.points) {
      assertPoint(point);
      if (points.has(point.date)) throw new RangeError('NOWCAST_DUPLICATE_DATE');
      points.set(point.date, point);
    }
    forecastMaps.set(forecast.metric, points);
  }
  const firstForecastDate = today < range.start ? range.start : completedToday ? addDays(today, 1) : today;
  for (const metric of BASE_METRICS) {
    if (target?.[metric] !== undefined && (!Number.isFinite(target[metric]) || target[metric]! < 0))
      throw new RangeError('NOWCAST_INVALID_TARGET');
    let mean = actualToDate[metric];
    let variance = 0;
    for (let date = firstForecastDate; date <= range.end; date = addDays(date, 1)) {
      const point = forecastMaps.get(metric)?.get(date);
      // Không trình bày dự báo 30 ngày như tổng cả quý khi thiếu ngày cuối quý.
      if (!point) throw new RangeError(`NOWCAST_INCOMPLETE_FORECAST:${metric}:${date}`);
      mean += date === today ? Math.max(0, point.mean - actualToday[metric]) : point.mean;
      const sd = safeDiv(point.hi80 - point.mean, CFG.z80) ?? 0;
      variance += sd * sd;
    }
    const margin = CFG.z80 * Math.sqrt(variance);
    projected[metric] = { mean, lo80: Math.max(actualToDate[metric], mean - margin), hi80: mean + margin };
    if (!Number.isFinite(projected[metric].hi80)) throw new RangeError('NOWCAST_NON_FINITE_RESULT');
  }
  const totals = {
    reach: projected.reach.mean,
    clicks: projected.clicks.mean,
    cost: projected.cost.mean,
    orders: projected.orders.mean,
  };
  return {
    periodKey,
    grain,
    daysElapsed,
    daysTotal: range.days,
    actualToDate,
    projected,
    projectedKpis: computeKpis(totals),
    ...(target ? { target: { ...target } } : {}),
  };
}
