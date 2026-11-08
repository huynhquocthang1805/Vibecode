// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { createAnalyticsEngine } from '@/lib/workers/analytics.worker';
import { getAnalyticsClient, resetAnalyticsClient, simulateWorkerFailure } from '@/lib/workers/client';
import type { AnalyticsWorkerApi } from '@/lib/workers/types';
import { LIMITS } from '@/types/domain';

import { checksum, QA_TODAY, row } from './qa08-fixtures';

const transport = vi.hoisted(() => ({ wrap: vi.fn() }));
vi.mock('comlink', () => ({ wrap: transport.wrap }));
const query = { campaignId: 'all', grain: 'day' as const, today: QA_TODAY, horizonDays: 0 };
class WorkerDouble {
  terminate = vi.fn();
  onerror: unknown = null;
  onmessageerror: unknown = null;
}
beforeEach(() => {
  resetAnalyticsClient();
  transport.wrap.mockReset();
  vi.stubGlobal('Worker', WorkerDouble);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T05:00:00Z'));
});
afterEach(() => {
  resetAnalyticsClient();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('snapshot treo: timeout tạo worker mới và giữ delta đã xác nhận', async () => {
  const first = createAnalyticsEngine();
  transport.wrap
    .mockReturnValueOnce({ ...first, snapshot: () => new Promise<never>(() => {}) } satisfies AnalyticsWorkerApi)
    .mockImplementation(() => createAnalyticsEngine());
  const client = getAnalyticsClient();
  await client.init([row(0)]);
  await client.applyDelta({ added: [row(1)], removed: [] }, 2);
  const pending = client.snapshot(query);
  await vi.advanceTimersByTimeAsync(LIMITS.SNAPSHOT_TIMEOUT_MS + 1);
  expect((await pending).checksum).toEqual(checksum([row(0), row(1)]));
  expect(transport.wrap).toHaveBeenCalledTimes(2);
});

it.fails('BUG-QA08-04: worker throw trong snapshot được restart và thử lại, không mất dữ liệu', async () => {
  const first = createAnalyticsEngine();
  transport.wrap
    .mockReset()
    .mockReturnValueOnce({
      ...first,
      snapshot: async () => {
        throw new Error('QA_SNAPSHOT_THROW');
      },
    } satisfies AnalyticsWorkerApi)
    .mockImplementation(() => createAnalyticsEngine());
  const client = getAnalyticsClient();
  await client.init([row(0)]);
  await expect(client.snapshot(query)).resolves.toMatchObject({ checksum: checksum([row(0)]) });
});

it.fails('BUG-QA08-05: worker crash liên tiếp sau khi khởi tạo rỗng vẫn giữ dòng đã thêm khi fallback', async () => {
  // Separate module instances model separate worker globals; factory calls alone share module state.
  await createAnalyticsEngine().init([]);
  const engines: AnalyticsWorkerApi[] = [];
  for (let i = 0; i <= LIMITS.WORKER_MAX_RESTARTS; i++) {
    vi.resetModules();
    engines.push((await import('@/lib/workers/analytics.worker')).createAnalyticsEngine());
  }
  transport.wrap.mockReset().mockImplementation(() => engines.shift()!);
  const events: string[] = [];
  const off = bus.on('system/health', (event) => events.push(event.message));
  try {
    const client = getAnalyticsClient();
    await client.init([]);
    await client.applyDelta({ added: [row(0)], removed: [] }, 2);
    for (let i = 0; i <= LIMITS.WORKER_MAX_RESTARTS; i++) simulateWorkerFailure('QA_CRASH');
    expect((await getAnalyticsClient().snapshot(query)).checksum).toEqual(checksum([row(0)]));
    expect(events.some((message) => message.includes('Chế độ tương thích'))).toBe(true);
  } finally {
    off();
  }
});
