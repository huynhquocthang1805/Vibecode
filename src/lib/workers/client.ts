import * as Comlink from 'comlink';

import { bus } from '@/lib/data/realtime/bus';
import { daysBetween } from '@/lib/domain/dates';
import { LIMITS, type AnalyticsQuery, type AnalyticsSnapshot, type DailyEntry, type EntryDelta } from '@/types/domain';

import { createAnalyticsEngine } from './analytics.worker';
import type { AnalyticsWorkerApi, PackedEntries } from './types';

let singletonClient: AnalyticsWorkerApi | null = null;
let activeWorkerInstance: Worker | null = null;
let lastEntriesSnapshot: DailyEntry[] = [];
const restartTimestamps: number[] = [];
let isCompatibilityMode = false;

const SOURCE_TO_NUM: Record<string, number> = {
  manual: 0,
  paste: 1,
  csv: 2,
  live: 3,
  mock: 4,
};

/**
 * Đóng gói mảng DailyEntry thành TypedArray (zero-copy / compact transfer) (docs/13 §4).
 */
export function packEntries(entries: DailyEntry[]): PackedEntries {
  const n = entries.length;
  const epoch = entries[0]?.date ?? '2024-01-01';

  const campMap = new Map<string, number>();
  const campList: string[] = [];

  const days = new Int32Array(n);
  const campaignIdxs = new Uint16Array(n);
  const reaches = new Float64Array(n);
  const clicks = new Float64Array(n);
  const costs = new Float64Array(n);
  const orders = new Float64Array(n);
  const sources = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const e = entries[i]!;
    days[i] = daysBetween(epoch, e.date);

    let cIdx = campMap.get(e.campaignId);
    if (cIdx === undefined) {
      cIdx = campList.length;
      campMap.set(e.campaignId, cIdx);
      campList.push(e.campaignId);
    }
    campaignIdxs[i] = cIdx;

    reaches[i] = e.reach;
    clicks[i] = e.clicks;
    costs[i] = e.cost;
    orders[i] = e.orders;
    sources[i] = SOURCE_TO_NUM[e.source] ?? 0;
  }

  return {
    days,
    campaignIdxs,
    reaches,
    clicks,
    costs,
    orders,
    sources,
    epoch,
    campaigns: campList,
  };
}

function spawnWorker(): AnalyticsWorkerApi {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || isCompatibilityMode) {
    return createAnalyticsEngine({ isCompatibilityMode });
  }

  try {
    const worker = new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' });
    activeWorkerInstance = worker;

    worker.onerror = (e) => {
      handleWorkerFailure('WORKER_ERROR: ' + e.message);
    };

    worker.onmessageerror = () => {
      handleWorkerFailure('WORKER_MESSAGE_ERROR');
    };

    return Comlink.wrap<AnalyticsWorkerApi>(worker);
  } catch {
    isCompatibilityMode = true;
    bus.emit({
      type: 'system/health',
      area: 'worker',
      status: 'degraded',
      message: 'Không thể tạo Web Worker. Chuyển sang Chế độ tương thích trên main thread.',
    });
    return createAnalyticsEngine({ isCompatibilityMode: true });
  }
}

function handleWorkerFailure(reason: string): void {
  const now = Date.now();
  // Giữ lại các lần restart trong vòng 60 giây
  while (restartTimestamps.length > 0 && now - restartTimestamps[0]! > 60_000) {
    restartTimestamps.shift();
  }

  if (restartTimestamps.length >= LIMITS.WORKER_MAX_RESTARTS) {
    // Quá số lần restart cho phép -> Chế độ tương thích
    isCompatibilityMode = true;
    if (activeWorkerInstance) {
      activeWorkerInstance.terminate();
      activeWorkerInstance = null;
    }
    bus.emit({
      type: 'system/health',
      area: 'worker',
      status: 'degraded',
      message: 'Worker gặp sự cố liên tục. Đã chuyển sang Chế độ tương thích trên main thread.',
      detail: reason,
    });
    singletonClient = createSupervisedClient(createAnalyticsEngine({ isCompatibilityMode: true }));
    if (lastEntriesSnapshot.length > 0) {
      void singletonClient.init(lastEntriesSnapshot).catch(() => {});
    }
    return;
  }

  restartTimestamps.push(now);
  bus.emit({
    type: 'system/health',
    area: 'worker',
    status: 'degraded',
    message: 'Worker gặp sự cố, đang tự động khởi động lại supervisor.',
    detail: reason,
  });

  if (activeWorkerInstance) {
    activeWorkerInstance.terminate();
    activeWorkerInstance = null;
  }

  singletonClient = createSupervisedClient(spawnWorker());
  if (lastEntriesSnapshot.length > 0) {
    void singletonClient.init(lastEntriesSnapshot).catch(() => {});
  }
}

function createSupervisedClient(baseApi: AnalyticsWorkerApi): AnalyticsWorkerApi {
  const activeApi = baseApi;

  return {
    async ping(): Promise<string> {
      if (activeApi.ping) {
        return activeApi.ping();
      }
      return 'pong';
    },

    async init(entries: DailyEntry[] | PackedEntries): Promise<number> {
      if (Array.isArray(entries)) {
        lastEntriesSnapshot = [...entries];
        if (entries.length > 500 && !isCompatibilityMode) {
          const packed = packEntries(entries);
          return activeApi.init(packed);
        }
      }
      return activeApi.init(entries);
    },

    async applyDelta(delta: EntryDelta, revision: number): Promise<number> {
      const res = await activeApi.applyDelta(delta, revision);
      // R-04: Cập nhật lastEntriesSnapshot khi applyDelta để khi worker restart không mất dữ liệu
      if (lastEntriesSnapshot.length > 0) {
        const removedIds = new Set(delta.removed.map((e) => e.id));
        const remaining = lastEntriesSnapshot.filter((e) => !removedIds.has(e.id));
        const map = new Map<string, DailyEntry>();
        for (const e of remaining) map.set(e.id, e);
        for (const e of delta.added) map.set(e.id, e);
        lastEntriesSnapshot = Array.from(map.values());
      }
      return res;
    },

    async snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot> {
      let timer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('SNAPSHOT_TIMEOUT'));
        }, LIMITS.SNAPSHOT_TIMEOUT_MS);
      });

      try {
        const result = await Promise.race([activeApi.snapshot(q), timeoutPromise]);
        return result;
      } catch (err) {
        if (err instanceof Error && err.message === 'SNAPSHOT_TIMEOUT') {
          handleWorkerFailure('SNAPSHOT_TIMEOUT');
          // Thử lại 1 lần sau khi khởi động lại worker hoặc chuyển chế độ tương thích
          if (singletonClient) {
            return singletonClient.snapshot(q);
          }
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

/**
 * Lấy AnalyticsClient kết nối tới Web Worker có giám sát (Supervisor) (docs/13 §4).
 */
export function getAnalyticsClient(): AnalyticsWorkerApi {
  if (singletonClient) {
    return singletonClient;
  }
  singletonClient = createSupervisedClient(spawnWorker());
  return singletonClient;
}

/**
 * Reset client (dành cho kiểm thử hoặc phục hồi khẩn cấp).
 */
export function resetAnalyticsClient(): void {
  if (activeWorkerInstance) {
    activeWorkerInstance.terminate();
    activeWorkerInstance = null;
  }
  singletonClient = null;
  isCompatibilityMode = false;
  restartTimestamps.length = 0;
  lastEntriesSnapshot = [];
}

/**
 * Giả lập lỗi worker cho supervisor test (R-04, R-05).
 */
export function simulateWorkerFailure(reason: string = 'SIMULATED_FAILURE'): void {
  handleWorkerFailure(reason);
}
