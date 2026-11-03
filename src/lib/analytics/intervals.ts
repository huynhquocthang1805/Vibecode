import type { ForecastPoint, ISODate } from '@/types/domain';

import { FORECAST_CONFIG as CFG } from './forecastConfig';
import { assertInteger } from './models/modelMath';

/** Xấp xỉ Gaussian; không khẳng định xác suất thực nghiệm là 80/95%. */
export function forecastPoint(date: ISODate, prediction: number, sigma: number, step: number): ForecastPoint {
  assertInteger(step, 1);
  if (!Number.isFinite(prediction) || !Number.isFinite(sigma) || sigma < 0)
    throw new RangeError('FORECAST_INVALID_INTERVAL');
  const mean = Math.max(0, prediction);
  const sd = sigma * Math.sqrt(step);
  const result = {
    date,
    mean,
    lo80: Math.max(0, mean - CFG.z80 * sd),
    hi80: mean + CFG.z80 * sd,
    lo95: Math.max(0, mean - CFG.z95 * sd),
    hi95: mean + CFG.z95 * sd,
  };
  if (!Number.isFinite(result.hi95)) throw new RangeError('FORECAST_NON_FINITE_INTERVAL');
  return result;
}
