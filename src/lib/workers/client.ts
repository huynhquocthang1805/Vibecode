import * as Comlink from 'comlink';

import { LIMITS, type AnalyticsQuery, type AnalyticsSnapshot, type DailyEntry, type EntryDelta } from '@/types/domain';

import { createAnalyticsEngine } from './analytics.worker';
import type { AnalyticsWorkerApi } from './types';

let singletonClient: AnalyticsWorkerApi | null = null;

function wrapWithTimeout(baseClient: AnalyticsWorkerApi): AnalyticsWorkerApi {
  return {
    init(entries: DailyEntry[]): Promise<number> {
      return baseClient.init(entries);
    },
    applyDelta(delta: EntryDelta, revision: number): Promise<number> {
      return baseClient.applyDelta(delta, revision);
    },
    async snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot> {
      let timer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('SNAPSHOT_TIMEOUT'));
        }, LIMITS.SNAPSHOT_TIMEOUT_MS);
      });

      try {
        const result = await Promise.race([baseClient.snapshot(q), timeoutPromise]);
        return result;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

/**
 * Tạo AnalyticsClient kết nối tới Web Worker qua Comlink.
 * Nếu không có môi trường Worker (SSR, Node.js, Vitest) hoặc khởi tạo Worker thất bại,
 * tự động fallback về engine chạy trên main thread (docs/13 §4).
 * Có bọc timeout SNAPSHOT_TIMEOUT_MS chống treo worker (R-05).
 */
export function getAnalyticsClient(): AnalyticsWorkerApi {
  if (singletonClient) {
    return singletonClient;
  }

  // Fallback nếu không có Worker (ví dụ SSR hoặc Vitest test)
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    singletonClient = wrapWithTimeout(createAnalyticsEngine());
    return singletonClient;
  }

  try {
    const worker = new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' });
    const remoteApi = Comlink.wrap<AnalyticsWorkerApi>(worker);
    singletonClient = wrapWithTimeout(remoteApi);
    return singletonClient;
  } catch {
    singletonClient = wrapWithTimeout(createAnalyticsEngine());
    return singletonClient;
  }
}
