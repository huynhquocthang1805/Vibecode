import { safeDiv } from '@/lib/domain/kpi';
import type { ForecastModel } from '@/types/domain';

import { FORECAST_CONFIG as CFG } from '../forecastConfig';
import { fitModel, predictModel } from './fitModel';

export interface Evaluation {
  smape: number;
  mae: number;
  folds: number;
  observations: number;
}

export function minimumTraining(model: ForecastModel, m = CFG.seasonLength as number): number {
  switch (model) {
    case 'holt_winters':
      return Math.max(CFG.wintersMinDays, 2 * m + 1);
    case 'holt':
      return CFG.holtMinDays;
    case 'seasonal_naive':
      return Math.max(CFG.seasonalMinDays, m);
    default:
      return CFG.minDays;
  }
}

/** Chỉ nội suy trong tập train được truyền vào; cuối train thiếu ngày thì giữ quan sát cuối. */
export function fillMissing(y: number[], observed?: boolean[]): number[] {
  if (!observed) return y;
  const out = [...y];
  const first = observed.findIndex(Boolean);
  if (first < 0) throw new RangeError('FORECAST_NO_OBSERVATIONS');
  for (let t = 0; t < first; t++) out[t] = y[first]!;
  let previous = first;
  for (let t = first + 1; t < y.length; t++) {
    if (!observed[t]) continue;
    for (let gap = previous + 1; gap < t; gap++) {
      const fraction = safeDiv(gap - previous, t - previous) ?? 0;
      out[gap] = y[previous]! + fraction * (y[t]! - y[previous]!);
    }
    previous = t;
  }
  for (let t = previous + 1; t < y.length; t++) out[t] = y[previous]!;
  return out;
}

export function rollingOrigins(
  length: number,
  horizon: number,
  folds: number,
  minimum: number,
  observed?: boolean[],
): number[] {
  const result: number[] = [];
  // Không lặp folds tùy ý khi caller truyền một số rất lớn.
  const available = Math.min(folds, Math.floor(safeDiv(length - minimum, horizon) ?? 0));
  for (let fold = available; fold >= 1; fold--) {
    const origin = length - fold * horizon;
    const trainCount = observed ? observed.slice(0, origin).filter(Boolean).length : origin;
    if (trainCount >= minimum && (!observed || observed.slice(origin, origin + horizon).some(Boolean)))
      result.push(origin);
  }
  return result;
}

export function evaluateOrigins(
  y: number[],
  model: ForecastModel,
  origins: number[],
  horizon: number,
  m = CFG.seasonLength as number,
  observed?: boolean[],
): Evaluation {
  let percentageError = 0;
  let percentageCount = 0;
  let absoluteError = 0;
  let observations = 0;
  for (const origin of origins) {
    const train = fillMissing(y.slice(0, origin), observed?.slice(0, origin));
    const fit = fitModel(train, model, m);
    const forecast = predictModel(train, fit, horizon).forecast;
    for (let step = 0; step < horizon; step++) {
      if (observed && !observed[origin + step]) continue;
      const actual = y[origin + step]!;
      const predicted = forecast[step]!;
      const difference = Math.abs(actual - predicted);
      const denominator = Math.abs(actual) + Math.abs(predicted);
      if (denominator > 0) {
        percentageError += (safeDiv(difference, denominator) ?? 0) * 200;
        percentageCount++;
      }
      absoluteError += difference;
      observations++;
    }
  }
  if (observations === 0) throw new RangeError('FORECAST_INSUFFICIENT_BACKTEST');
  const result = {
    smape: safeDiv(percentageError, percentageCount) ?? 0,
    mae: safeDiv(absoluteError, observations) ?? 0,
    folds: origins.length,
    observations,
  };
  if (!Number.isFinite(result.smape) || !Number.isFinite(result.mae))
    throw new RangeError('FORECAST_NON_FINITE_BACKTEST');
  return result;
}
