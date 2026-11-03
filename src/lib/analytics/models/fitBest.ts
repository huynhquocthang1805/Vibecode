import { safeDiv } from '@/lib/domain/kpi';
import { LIMITS, type ForecastModel } from '@/types/domain';

import { FORECAST_CONFIG as CFG } from '../forecastConfig';
import { evaluateOrigins, fillMissing, minimumTraining, rollingOrigins, type Evaluation } from './evaluation';
import { fitModel, type FittedModel } from './fitModel';
import { assertInteger, assertObservations } from './modelMath';

export interface ModelSelection {
  fit: FittedModel;
  evaluation: Evaluation | null;
  baselineSmape: number | null;
}

/** Số đo của mọi ứng viên dùng cùng các ngày holdout, không fit tham số trên holdout. */
export function selectModel(input: number[], m: number, mask?: boolean[]): ModelSelection {
  assertInteger(m, 2);
  const y = input.slice(-LIMITS.FORECAST_WINDOW_DAYS);
  const observed = mask?.slice(-LIMITS.FORECAST_WINDOW_DAYS);
  assertObservations(y, CFG.minDays);
  const count = observed ? observed.filter(Boolean).length : y.length;
  const baseline: ForecastModel = count >= Math.max(CFG.seasonalMinDays, m) ? 'seasonal_naive' : 'naive';
  const candidates: ForecastModel[] = ['naive', 'moving_avg', 'seasonal_naive', 'holt', 'holt_winters'];
  const eligible = candidates.filter(
    (model) => rollingOrigins(y.length, CFG.backtestHorizon, 1, minimumTraining(model, m), observed).length > 0,
  );
  const baseOrigins = rollingOrigins(
    y.length,
    CFG.backtestHorizon,
    CFG.backtestFolds,
    minimumTraining(baseline, m),
    observed,
  );
  if (baseOrigins.length === 0) {
    return { fit: fitModel(fillMissing(y, observed), baseline, m), evaluation: null, baselineSmape: null };
  }
  const minimum = Math.max(...eligible.map((model) => minimumTraining(model, m)));
  const origins = rollingOrigins(y.length, CFG.backtestHorizon, CFG.backtestFolds, minimum, observed);
  const baselineScore = evaluateOrigins(y, baseline, origins, CFG.backtestHorizon, m, observed);
  let selected: ForecastModel = baseline;
  let bestScore = baselineScore;
  for (const candidate of eligible) {
    if (candidate === baseline) continue;
    const score = evaluateOrigins(y, candidate, origins, CFG.backtestHorizon, m, observed);
    if (score.smape < bestScore.smape) {
      selected = candidate;
      bestScore = score;
    }
  }
  const gain = safeDiv(baselineScore.smape - bestScore.smape, baselineScore.smape) ?? 0;
  if (gain < CFG.minImprovement) {
    selected = baseline;
    bestScore = baselineScore;
  }
  return {
    fit: fitModel(fillMissing(y, observed), selected, m),
    evaluation: bestScore,
    baselineSmape: baselineScore.smape,
  };
}

export function fitBest(
  y: number[],
  m: number,
): { model: ForecastModel; params: Record<string, number>; residualSd: number } {
  return selectModel(y, m).fit;
}
