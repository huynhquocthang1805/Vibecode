import { LIMITS, type ForecastModel } from '@/types/domain';

import { evaluateOrigins, minimumTraining, rollingOrigins } from './evaluation';
import { assertInteger, assertObservations } from './modelMath';

/** Rolling-origin; sMAPE chịu được số 0 */
export function backtest(
  y: number[],
  model: ForecastModel,
  horizon: number,
  folds: number,
): { smape: number; mae: number } {
  assertInteger(horizon, 1);
  assertInteger(folds, 1);
  const recent = y.slice(-LIMITS.FORECAST_WINDOW_DAYS);
  assertObservations(recent);
  const origins = rollingOrigins(recent.length, horizon, folds, minimumTraining(model));
  const { smape, mae } = evaluateOrigins(recent, model, origins, horizon);
  return { smape, mae };
}
