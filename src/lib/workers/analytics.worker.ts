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
  type EntrySource,
  type ForecastStatus,
  type MetricForecast,
  type Nowcast,
  type Series,
} from '@/types/domain';

import type { AnalyticsWorkerApi, PackedEntries } from './types';

const NUM_TO_SOURCE: EntrySource[] = ['manual', 'paste', 'csv', 'live', 'mock'];

function unpackEntries(packed: PackedEntries): DailyEntry[] {
  const count = packed.days.length;
  const entries: DailyEntry[] = new Array(count);
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const dayOffset = packed.days[i] ?? 0;
    const date = addDays(packed.epoch, dayOffset);
    const cIdx = packed.campaignIdxs[i] ?? 0;
    const campaignId = packed.campaigns[cIdx] ?? 'default';
    const sourceIdx = packed.sources[i] ?? 0;
    const source = NUM_TO_SOURCE[sourceIdx] ?? 'manual';
    const id = `${campaignId}|${date}`;

    entries[i] = {
      id,
      date,
      campaignId,
      reach: packed.reaches[i] ?? 0,
      clicks: packed.clicks[i] ?? 0,
      cost: packed.costs[i] ?? 0,
      orders: packed.orders[i] ?? 0,
      source,
      createdAt: now,
      updatedAt: now,
    };
  }
  return entries;
}

let rollupIndex: RollupIndex = buildRollups([]);
let currentRevision = 0;
let completedVersion = 1;
let lastKnownToday: string | null = null;

// Cache theo phần: forecastCache key: `${campaignId}:${forecastHorizon}`
interface ForecastCacheEntry {
  completedVersion: number;
  forecasts: MetricForecast[];
}
const forecastCache = new Map<string, ForecastCacheEntry>();

function computeForecastStatus(
  dataSpan: { first: string | null; last: string | null },
  daily: Series,
  today: string,
  totalRows: number,
  isCompatibilityMode: boolean,
): ForecastStatus {
  // Chế độ tương thích trên main thread: tắt dự báo khi > 20k dòng (docs/13 §4)
  if (isCompatibilityMode && totalRows > 20_000) {
    return 'disabled';
  }

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

export function createAnalyticsEngine(options?: { isCompatibilityMode?: boolean }): AnalyticsWorkerApi {
  const isCompat = options?.isCompatibilityMode ?? false;

  return {
    async ping(): Promise<string> {
      return 'pong';
    },

    async init(entriesInput: DailyEntry[] | PackedEntries): Promise<number> {
      const entries = Array.isArray(entriesInput) ? entriesInput : unpackEntries(entriesInput);
      rollupIndex = buildRollups(entries);
      currentRevision = 1;
      completedVersion++;
      forecastCache.clear();
      return currentRevision;
    },

    async applyDelta(delta: EntryDelta, revision: number): Promise<number> {
      if (currentRevision !== 0 && revision !== currentRevision + 1) {
        throw new Error('REVISION_GAP');
      }

      // Kiểm tra xem delta có chạm ngày đã kết thúc (< lastKnownToday) không
      if (lastKnownToday) {
        const touchesCompletedDay =
          delta.added.some((e) => e.date < lastKnownToday!) ||
          delta.removed.some((e) => e.date < lastKnownToday!);

        if (touchesCompletedDay) {
          completedVersion++;
        }
      } else {
        completedVersion++;
      }

      rollupIndex = applyDelta(rollupIndex, delta);
      currentRevision = revision;
      return currentRevision;
    },

    async snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot> {
      lastKnownToday = q.today;
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

      const monthKey = bucketKey(q.today, 'month');
      const quarterKey = bucketKey(q.today, 'quarter');
      const qRange = bucketRange(quarterKey, 'quarter');
      const daysToQuarterEnd = Math.max(0, daysBetween(q.today, qRange.end) + 1);
      const forecastHorizon = Math.max(q.horizonDays, daysToQuarterEnd);

      const dataSpan = getRollupDataSpan(rollupIndex, q.campaignId);
      const checksum = getRollupChecksum(rollupIndex);
      const forecastStatus = computeForecastStatus(dataSpan, daily, q.today, checksum.rows, isCompat);

      // Cache theo phần cho forecast: chỉ tính lại khi completedVersion đổi
      const fcKey = `${q.campaignId}:${forecastHorizon}`;
      let forecasts: MetricForecast[] = [];

      if (forecastStatus === 'ok') {
        const cachedFc = forecastCache.get(fcKey);
        if (cachedFc && cachedFc.completedVersion === completedVersion) {
          forecasts = cachedFc.forecasts;
          timings.forecastCached = 1;
        } else {
          try {
            const tFc = performance.now();
            forecasts = forecastAll(daily, forecastHorizon);
            timings.forecast = performance.now() - tFc;
            forecastCache.set(fcKey, {
              completedVersion,
              forecasts,
            });
          } catch (err) {
            forecasts = [];
            timings.forecastError = 1;
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[AnalyticsWorker] forecastAll failed:', err instanceof Error ? err.message : err);
            }
          }
        }
      }

      // Nowcast tính rẻ (< 5ms) từ forecasts và actualToDate
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
