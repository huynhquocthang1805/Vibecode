import { addDays } from '@/lib/domain/dates';
import { buildRollups, getSeries } from '@/lib/data/aggregate';
import { LIMITS, type BaseMetric, type DailyEntry, type ForecastModel, type MetricForecast } from '@/types/domain';

import { BASE_METRICS, forecastMetric } from './forecast';
import { FORECAST_CONFIG as CFG } from './forecastConfig';
import { backtest } from './models/backtest';

export interface ForecastValidationRow {
  campaignId: string;
  metric: BaseMetric;
  model: ForecastModel;
  smape: number;
  mae: number;
  selected: boolean;
  confidence: MetricForecast['confidence'];
  trainStart: string;
  lastDate: string;
}

/** FC-09: kiểm định xác định trên dữ liệu truyền vào; không đọc file/đồng hồ, không gọi AI. */
export function validateForecasts(entries: DailyEntry[]): ForecastValidationRow[] {
  if (entries.length === 0) return [];
  const lastDate = entries.reduce((last, entry) => (entry.date > last ? entry.date : last), entries[0]!.date);
  const index = buildRollups(entries);
  const models: ForecastModel[] = ['naive', 'seasonal_naive', 'moving_avg', 'holt', 'holt_winters'];
  const results: ForecastValidationRow[] = [];
  for (const campaignId of [...new Set(entries.map((entry) => entry.campaignId))].sort()) {
    const series = getSeries(index, { campaignId, grain: 'day', today: addDays(lastDate, 1) });
    const buckets = series.buckets.slice(-LIMITS.FORECAST_WINDOW_DAYS);
    if (
      buckets.length < CFG.wintersMinDays + CFG.backtestFolds * CFG.backtestHorizon ||
      buckets.some((bucket) => bucket.daysWithData === 0)
    ) {
      throw new RangeError('VALIDATION_REQUIRES_COMPLETE_HISTORY');
    }
    for (const metric of BASE_METRICS) {
      const values = buckets.map((bucket) => bucket[metric]);
      const chosen = forecastMetric(
        values,
        buckets.map((bucket) => bucket.start),
        metric,
        CFG.backtestHorizon,
      );
      for (const model of models) {
        const score = backtest(values, model, CFG.backtestHorizon, CFG.backtestFolds);
        results.push({
          campaignId,
          metric,
          model,
          ...score,
          selected: model === chosen.model,
          confidence: chosen.confidence,
          trainStart: buckets[0]!.start,
          lastDate: buckets[buckets.length - 1]!.start,
        });
      }
    }
  }
  return results;
}
