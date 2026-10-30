import { notImplemented } from '@/lib/notImplemented';
import type { BaseMetric, ISODate, MetricForecast, Series } from '@/types/domain';

export function forecastMetric(
  _daily: number[],
  _dates: ISODate[],
  _metric: BaseMetric,
  _horizon: number,
): MetricForecast {
  return notImplemented('FC-04');
}

export function forecastAll(_daily: Series, _horizon: number): MetricForecast[] {
  return notImplemented('FC-04');
}
