import { notImplemented } from '@/lib/notImplemented';

import type { AnalyticsWorkerApi } from './types';

/**
 * Comlink tới `new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' })`.
 * Đóng gói cột typed array + transfer, supervisor restart/timeout, fallback main thread (docs/13 §4).
 */
export function getAnalyticsClient(): AnalyticsWorkerApi {
  return notImplemented('DATA-06');
}
