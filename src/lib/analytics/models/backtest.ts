import { notImplemented } from '@/lib/notImplemented';
import type { ForecastModel } from '@/types/domain';

/** Rolling-origin; sMAPE chịu được số 0 */
export function backtest(
  _y: number[],
  _model: ForecastModel,
  _horizon: number,
  _folds: number,
): { smape: number; mae: number } {
  return notImplemented('FC-04');
}
