import { notImplemented } from '@/lib/notImplemented';
import type { ISODate, MetricForecast, Nowcast, Series, Totals } from '@/types/domain';

/** docs/04 §4 — thực tế đến hôm nay + dự báo phần còn lại của kỳ */
export function nowcast(
  _daily: Series,
  _forecasts: MetricForecast[],
  _periodKey: string,
  _grain: 'month' | 'quarter',
  _today: ISODate,
  _target?: Partial<Totals>,
): Nowcast {
  return notImplemented('FC-06');
}
