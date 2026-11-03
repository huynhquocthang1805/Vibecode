import { LIMITS, type ForecastModel } from '@/types/domain';

import { FORECAST_CONFIG as CFG } from '../forecastConfig';
import { movingAverage, naive, seasonalNaive } from './baselines';
import { holt, runHolt } from './holt';
import { holtWinters, runHoltWinters } from './holtWinters';
import { assertInteger, assertObservations, residualSd } from './modelMath';

export interface FittedModel {
  model: ForecastModel;
  params: Record<string, number>;
  residualSd: number;
}

export function predictModel(y: number[], fit: FittedModel, h: number): { fitted: number[]; forecast: number[] } {
  const { params: p } = fit;
  switch (fit.model) {
    case 'naive':
      return naive(y, h);
    case 'seasonal_naive':
      return seasonalNaive(y, p.m!, h);
    case 'moving_avg':
      return movingAverage(y, p.k!, h);
    case 'holt':
      return holt(y, p.alpha!, p.beta!, h, p.phi!);
    case 'holt_winters':
      return holtWinters(y, p.m!, p.alpha!, p.beta!, p.gamma!, h, p.phi!);
  }
}

/** Fit một model chỉ trên tập train; backtest gọi lại ở từng fold. */
export function fitModel(input: number[], model: ForecastModel, m = CFG.seasonLength as number): FittedModel {
  assertInteger(m, 2);
  const y = input.slice(-LIMITS.FORECAST_WINDOW_DAYS);
  assertObservations(y);
  const basic: FittedModel = { model, params: {}, residualSd: 0 };
  if (model === 'naive' || model === 'moving_avg' || model === 'seasonal_naive') {
    if (model === 'moving_avg') basic.params = { k: CFG.movingWindow };
    if (model === 'seasonal_naive') basic.params = { m };
    const output =
      model === 'naive'
        ? naive(y, 0)
        : model === 'moving_avg'
          ? movingAverage(y, CFG.movingWindow, 0)
          : seasonalNaive(y, m, 0);
    basic.residualSd = output.residualSd;
    return basic;
  }

  const warmup = model === 'holt' ? 2 : 2 * m;
  assertObservations(y, warmup + 1);
  const scale = Math.max(1, ...y);
  let bestSse = Infinity;
  for (const alpha of CFG.grid) {
    for (const beta of CFG.grid) {
      for (const gamma of model === 'holt' ? [0] : CFG.grid) {
        const params = { alpha, beta, phi: CFG.damping, ...(model === 'holt_winters' ? { gamma, m } : {}) };
        const { loss: sse } =
          model === 'holt'
            ? runHolt(y, alpha, beta, 0, CFG.damping, warmup, scale, bestSse)
            : runHoltWinters(y, m, alpha, beta, gamma, 0, CFG.damping, warmup, scale, bestSse);
        if (Number.isFinite(sse) && sse < bestSse) {
          bestSse = sse;
          basic.params = params;
        }
      }
    }
  }
  if (!Number.isFinite(bestSse)) throw new RangeError('FORECAST_NON_FINITE_FIT');
  basic.residualSd = residualSd(y, predictModel(y, basic, 0).fitted, warmup);
  if (!Number.isFinite(basic.residualSd)) throw new RangeError('FORECAST_NON_FINITE_FIT');
  return basic;
}
