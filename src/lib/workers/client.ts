import * as Comlink from 'comlink';

import { createAnalyticsEngine } from './analytics.worker';
import type { AnalyticsWorkerApi } from './types';

let singletonClient: AnalyticsWorkerApi | null = null;

/**
 * Tạo AnalyticsClient kết nối tới Web Worker qua Comlink.
 * Nếu không có môi trường Worker (SSR, Node.js, Vitest) hoặc khởi tạo Worker thất bại,
 * tự động fallback về engine chạy trên main thread (docs/13 §4).
 */
export function getAnalyticsClient(): AnalyticsWorkerApi {
  if (singletonClient) {
    return singletonClient;
  }

  // Fallback nếu không có Worker (ví dụ SSR hoặc Vitest test)
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    singletonClient = createAnalyticsEngine();
    return singletonClient;
  }

  try {
    const worker = new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' });
    singletonClient = Comlink.wrap<AnalyticsWorkerApi>(worker);
    return singletonClient;
  } catch {
    singletonClient = createAnalyticsEngine();
    return singletonClient;
  }
}
