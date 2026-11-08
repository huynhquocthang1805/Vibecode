import { addDays } from '@/lib/domain/dates';
import { LIMITS, type BaseMetric, type ISODate, type MetricForecast, type Series } from '@/types/domain';

import { FORECAST_CONFIG as CFG } from './forecastConfig';
import { forecastPoint } from './intervals';
import { fillMissing } from './models/evaluation';
import { selectModel } from './models/fitBest';
import { naive } from './models/baselines';
import { predictModel } from './models/fitModel';
import { assertInteger } from './models/modelMath';
import { prepareDaily } from './prepareDaily';
import { robustSeries } from './robust';

export const BASE_METRICS: readonly BaseMetric[] = ['reach', 'clicks', 'cost', 'orders'];

export function forecastMetric(daily: number[], dates: ISODate[], metric: BaseMetric, horizon: number): MetricForecast {
  assertInteger(horizon);
  const empty: MetricForecast = {
    metric,
    model: 'naive',
    params: {},
    horizonDays: 0,
    points: [],
    backtest: { smape: null, mae: null, baselineSmape: null },
    confidence: 'low',
  };
  // Kiểm đầu vào (ngày sai/trùng/đảo, NaN, âm) TRƯỚC mọi xử lý — ném RangeError như cũ
  const raw = prepareDaily(daily, dates);
  if (horizon === 0 || raw.observed.filter(Boolean).length < CFG.minDays) return empty;
  // FC-10 (docs/13 §5): bỏ 0 đầu chuỗi, chỉ fit đoạn sau khoảng trống > 28 ngày, winsorize ngày gõ nhầm.
  // Review FC-10: robust chỉ trên cửa sổ fit 365 ngày (docs/04 §3) — lịch sử cũ hơn không ảnh hưởng ngưỡng kẹp
  const windowStart = addDays(dates[dates.length - 1]!, 1 - LIMITS.FORECAST_WINDOW_DAYS);
  const from = dates.findIndex((d) => d >= windowStart);
  const robust = robustSeries(daily.slice(from), dates.slice(from));
  if (robust.values.length < CFG.minDays) {
    // Đoạn dùng được quá ngắn → baseline naive trên đoạn đó (không bỏ trống, không fit mô hình phức tạp)
    const tail = prepareDaily(robust.values, robust.dates);
    const yTail = fillMissing(tail.values, tail.observed);
    const lastTail = tail.dates[tail.dates.length - 1]!;
    const base = naive(yTail, horizon);
    const points = base.forecast.map((prediction, index) =>
      forecastPoint(addDays(lastTail, index + 1), prediction, base.residualSd, index + 1),
    );
    return { ...empty, horizonDays: points.length, points };
  }
  const prepared = prepareDaily(robust.values, robust.dates);
  if (prepared.observed.filter(Boolean).length < CFG.minDays) return empty;
  const y = fillMissing(prepared.values, prepared.observed);
  const lastDate = prepared.dates[prepared.dates.length - 1]!;
  try {
    const { fit, evaluation, baselineSmape } = selectModel(prepared.values, CFG.seasonLength, prepared.observed);
    const forecast = predictModel(y, fit, horizon).forecast;
    const points = forecast.map((prediction, index) =>
      forecastPoint(addDays(lastDate, index + 1), prediction, fit.residualSd, index + 1),
    );
    const enough =
      evaluation !== null &&
      evaluation.folds === CFG.backtestFolds &&
      evaluation.observations === CFG.backtestFolds * CFG.backtestHorizon;
    const confidence =
      enough && evaluation.smape < CFG.highSmape
        ? 'high'
        : enough && evaluation.smape < CFG.mediumSmape
          ? 'medium'
          : 'low';
    return {
      metric,
      model: fit.model,
      params: fit.params,
      horizonDays: points.length,
      points,
      backtest: { smape: evaluation?.smape ?? null, mae: evaluation?.mae ?? null, baselineSmape },
      confidence,
    };
  } catch (error) {
    // Chỉ phục hồi lỗi số học của model; không che lỗi lập trình ngoài dự kiến.
    if (!(error instanceof RangeError) || !error.message.startsWith('FORECAST_NON_FINITE')) throw error;
    const fallback = naive(y, horizon);
    const points = fallback.forecast.map((prediction, index) =>
      forecastPoint(addDays(lastDate, index + 1), prediction, fallback.residualSd, index + 1),
    );
    return { ...empty, horizonDays: points.length, points };
  }
}

export function forecastAll(daily: Series, horizon: number): MetricForecast[] {
  assertInteger(horizon);
  if (daily.grain !== 'day') throw new RangeError('FORECAST_REQUIRES_DAILY_SERIES');
  // Bucket ngày partial là hôm nay; không fit dữ liệu chưa hết ngày. Ngày gap-fill có daysWithData=0.
  const completed = daily.buckets.filter((bucket) => bucket.daysWithData > 0 && !bucket.isPartial);
  const dates = completed.map((bucket) => bucket.start);
  const result = BASE_METRICS.map((metric) =>
    forecastMetric(
      completed.map((bucket) => bucket[metric]),
      dates,
      metric,
      horizon,
    ),
  );
  return result.filter((forecast) => forecast.points.length > 0);
}
