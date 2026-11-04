/// <reference lib="webworker" />
import * as Comlink from 'comlink';

import { TREND_CONFIG, ANOMALY_CONFIG } from '@/config/thresholds';
import {
  applyDelta,
  buildRollups,
  comparePeriods,
  getRollupChecksum,
  getRollupDataSpan,
  getSeries,
  type RollupIndex,
} from '@/lib/data/aggregate';
import { analyzeTrend, detectAnomalies, forecastAll, nowcast } from '@/lib/analytics';
import { addDays, bucketKey, bucketRange, daysBetween } from '@/lib/domain/dates';
import { computeKpis, sumTotals } from '@/lib/domain/kpi';
import {
  LIMITS,
  type AnalyticsQuery,
  type AnalyticsSnapshot,
  type Anomaly,
  type DailyEntry,
  type EntryDelta,
  type ForecastStatus,
  type MetricForecast,
  type Nowcast,
  type Series,
} from '@/types/domain';

import type { AnalyticsWorkerApi } from './types';

let rollupIndex: RollupIndex = buildRollups([]);
let currentRevision = 0;

function computeForecastStatus(
  dataSpan: { first: string | null; last: string | null },
  daily: Series,
  today: string,
): ForecastStatus {
  if (!dataSpan.first || !dataSpan.last) {
    return 'insufficient';
  }

  const daysWithData = daily.buckets.filter((b) => b.daysWithData > 0).length;
  if (daysWithData < 7) {
    return 'insufficient';
  }

  const staleCutoff = addDays(today, -LIMITS.STALE_DATA_DAYS);
  if (dataSpan.last < staleCutoff) {
    return 'stale';
  }

  return 'ok';
}

export function createAnalyticsEngine(): AnalyticsWorkerApi {
  return {
    async init(entries: DailyEntry[]): Promise<number> {
      rollupIndex = buildRollups(entries);
      currentRevision = 1;
      return currentRevision;
    },

    async applyDelta(delta: EntryDelta, revision: number): Promise<number> {
      if (currentRevision !== 0 && revision !== currentRevision + 1) {
        throw new Error('REVISION_GAP');
      }
      rollupIndex = applyDelta(rollupIndex, delta);
      currentRevision = revision;
      return currentRevision;
    },

    async snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot> {
      const timings: Record<string, number> = {};

      const t0 = performance.now();
      const series = getSeries(rollupIndex, {
        campaignId: q.campaignId,
        grain: q.grain,
        range: q.range,
        today: q.today,
      });
      timings.series = performance.now() - t0;

      const tDaily = performance.now();
      const daily = getSeries(rollupIndex, {
        campaignId: q.campaignId,
        grain: 'day',
        range: q.range,
        today: q.today,
      });
      timings.daily = performance.now() - tDaily;

      const tCmp = performance.now();
      const cmp = comparePeriods(series, q.today, daily);
      timings.compare = performance.now() - tCmp;

      const tTotals = performance.now();
      const sum = sumTotals(daily.buckets);
      const totals = { ...sum, kpis: computeKpis(sum) };
      timings.totals = performance.now() - tTotals;

      const tTrend = performance.now();
      const trend = analyzeTrend(series, cmp, TREND_CONFIG);
      timings.trend = performance.now() - tTrend;

      // R-07 / DATA-FIX-02: Horizon dự báo cần tối thiểu tới cuối quý cho nowcast
      const monthKey = bucketKey(q.today, 'month');
      const quarterKey = bucketKey(q.today, 'quarter');
      const qRange = bucketRange(quarterKey, 'quarter');
      const daysToQuarterEnd = Math.max(0, daysBetween(q.today, qRange.end) + 1);
      const forecastHorizon = Math.max(q.horizonDays, daysToQuarterEnd);

      let forecasts: MetricForecast[] = [];
      try {
        const tFc = performance.now();
        forecasts = forecastAll(daily, forecastHorizon);
        timings.forecast = performance.now() - tFc;
      } catch (err) {
        forecasts = [];
        timings.forecastError = 1;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[AnalyticsWorker] forecastAll failed:', err instanceof Error ? err.message : err);
        }
      }

      const nowcasts: Nowcast[] = [];
      if (forecasts.length > 0) {
        const mTarget = q.targets?.[`${q.campaignId}:${monthKey}`];
        const qTarget = q.targets?.[`${q.campaignId}:${quarterKey}`];

        const tNow = performance.now();
        try {
          nowcasts.push(nowcast(daily, forecasts, monthKey, 'month', q.today, mTarget));
        } catch (err) {
          timings.nowcastMonthError = 1;
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[AnalyticsWorker] nowcast month failed:', err instanceof Error ? err.message : err);
          }
        }

        try {
          nowcasts.push(nowcast(daily, forecasts, quarterKey, 'quarter', q.today, qTarget));
        } catch (err) {
          timings.nowcastQuarterError = 1;
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[AnalyticsWorker] nowcast quarter failed:', err instanceof Error ? err.message : err);
          }
        }
        timings.nowcast = performance.now() - tNow;
      }

      let anomalies: Anomaly[] = [];
      try {
        const tAnom = performance.now();
        anomalies = detectAnomalies(daily, ANOMALY_CONFIG);
        timings.anomaly = performance.now() - tAnom;
      } catch {
        anomalies = [];
      }

      const dataSpan = getRollupDataSpan(rollupIndex, q.campaignId);
      const checksum = getRollupChecksum(rollupIndex);
      const forecastStatus = computeForecastStatus(dataSpan, daily, q.today);

      return {
        computedAt: Date.now(),
        revision: currentRevision,
        checksum,
        dataSpan,
        forecastStatus,
        query: q,
        series,
        daily,
        totals,
        trend,
        forecasts,
        nowcasts,
        anomalies,
        timings,
      };
    },
  };
}

const api = createAnalyticsEngine();

if (typeof self !== 'undefined' && typeof (self as unknown as WorkerGlobalScope).importScripts !== 'undefined') {
  Comlink.expose(api);
}
