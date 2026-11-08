// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { createLocalStorageAdapter } from '@/lib/data/storage/localStorageAdapter';
import type { ManifestPayload } from '@/lib/data/storage/partitionCodec';
import { setStorageAdapter, useDataStore } from '@/lib/data/store';
import { LIMITS } from '@/types/domain';

import { generate } from '../../scripts/gen-mock';
import { business, checksum, persisted, QA_TODAY, row } from './qa08-fixtures';

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T05:00:00Z'));
  localStorage.clear();
  setStorageAdapter({
    kind: 'memory',
    load: async () => null,
    save: async () => {},
    clear: async () => {},
    usage: async () => ({ usedBytes: 0, quotaBytes: 0 }),
  });
  await useDataStore.getState().clearAll();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('QA-08 · partition và giao dịch khi có sự cố', () => {
  it.each(['missing', 'checksum'] as const)(
    'E49: partition %s chỉ cách ly năm hỏng, giữ năm lành và cảnh báo đúng năm',
    async (mode) => {
      const adapter = createLocalStorageAdapter();
      const data = persisted([row(0, 0, 100, '2025'), row(0, 0, 200, '2026')]);
      await adapter.save(data);
      const manifest = JSON.parse(localStorage.getItem('kpi-dash:v1')!) as ManifestPayload;
      const key = `kpi-dash:v1:p:2025:${manifest.parts['2025']!.gen}`;
      const messages: string[] = [];
      const off = bus.on('system/health', (event) => messages.push(event.message));
      try {
        if (mode === 'missing') localStorage.removeItem(key);
        else {
          const raw = JSON.parse(localStorage.getItem(key)!) as { r: number[] };
          raw.r[0] = 9999;
          localStorage.setItem(key, JSON.stringify(raw));
        }
        const loaded = await createLocalStorageAdapter().load();
        expect(business(loaded!.entries)).toEqual(business([data.entries[1]!]));
        expect(messages.some((message) => message.includes('2025'))).toBe(true);
        if (mode === 'checksum')
          expect(Object.keys(localStorage).some((name) => name.startsWith('kpi-dash:corrupt:2025:'))).toBe(true);
      } finally {
        off();
      }
    },
  );

  it.fails('BUG-QA08-02: partition thiếu cột không làm load crash, vẫn nạp năm lành', async () => {
    const adapter = createLocalStorageAdapter();
    await adapter.save(persisted([row(0, 0, 100, '2025'), row(0)]));
    const manifest = JSON.parse(localStorage.getItem('kpi-dash:v1')!) as ManifestPayload;
    localStorage.setItem(
      `kpi-dash:v1:p:2025:${manifest.parts['2025']!.gen}`,
      JSON.stringify({ d: [304], c: [[0, 1]], src: [[4, 1]] }),
    );
    const loaded = await createLocalStorageAdapter().load();
    expect(business(loaded!.entries)).toEqual(business([row(0)]));
  });

  for (const mode of ['deleted', 'malformed'] as const)
    (mode === 'deleted' ? it.fails : it)(
      `${mode === 'deleted' ? 'BUG-QA08-01: ' : ''}manifest ${mode} khôi phục số liệu còn trong partition và báo phục hồi`,
      async () => {
        const data = persisted([row(0, 0, 100, '2025'), row(0, 0, 200, '2026')]);
        await createLocalStorageAdapter().save(data);
        if (mode === 'deleted') localStorage.removeItem('kpi-dash:v1');
        else localStorage.setItem('kpi-dash:v1', '{ broken');
        const events: string[] = [];
        const off = bus.on('system/health', (event) => events.push(event.status));
        try {
          const loaded = await createLocalStorageAdapter().load();
          expect(loaded).not.toBeNull();
          // Missing campaign metadata may map to default per DATA-10 handoff; quantities/dates must survive.
          expect(
            loaded!.entries.map(({ date, reach, clicks, cost, orders }) => ({ date, reach, clicks, cost, orders })),
          ).toEqual(
            data.entries.map(({ date, reach, clicks, cost, orders }) => ({ date, reach, clicks, cost, orders })),
          );
          expect(events).toContain('recovered');
        } finally {
          off();
        }
      },
    );

  it.fails(
    'BUG-QA08-03: hai writer giữ snapshot cũ ghi cùng lúc trong Web Lock vẫn giữ cả hai dòng đã commit',
    async () => {
      let tail = Promise.resolve();
      vi.stubGlobal('navigator', {
        locks: {
          request: (_name: string, operation: () => Promise<void>) => {
            const task = tail.then(operation);
            tail = task.catch(() => {});
            return task;
          },
        },
      });
      const a = createLocalStorageAdapter(),
        b = createLocalStorageAdapter();
      const base = persisted([row(0)]);
      await a.save(base);
      const snapshotA = await a.load(),
        snapshotB = await b.load();
      await Promise.all([
        a.save({ ...snapshotA!, entries: [...snapshotA!.entries, row(1)] }),
        b.save({ ...snapshotB!, entries: [...snapshotB!.entries, row(2)] }),
      ]);
      expect(business((await createLocalStorageAdapter().load())!.entries)).toEqual(business([row(0), row(1), row(2)]));
    },
  );

  it('E40: import vượt trần 200k bị từ chối trước delta/lưu, dữ liệu và revision không đổi', async () => {
    const entries = generate(LIMITS.MAX_ROWS_TOTAL - 1, {
      today: QA_TODAY,
      endDate: '2026-11-06',
      campaignCount: LIMITS.MAX_CAMPAIGNS,
      seed: 20261107,
      profile: 'stress',
    });
    const save = vi.fn(async () => {});
    setStorageAdapter({
      kind: 'memory',
      load: async () => null,
      save,
      clear: async () => {},
      usage: async () => ({ usedBytes: 0, quotaBytes: 0 }),
    });
    useDataStore.setState({ entries, checksum: checksum(entries), revision: 123 });
    const changed = vi.fn();
    const off = bus.on('entries/changed', changed);
    try {
      const before = useDataStore.getState();
      const report = before.importBatch([row(0, 0), row(1, 0)], 'csv', 'overwrite');
      expect(report).toMatchObject({ aborted: true, accepted: 0 });
      expect(useDataStore.getState().entries).toBe(before.entries);
      expect(useDataStore.getState().checksum).toEqual(before.checksum);
      expect(useDataStore.getState().revision).toBe(123);
      expect(changed).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(LIMITS.PERSIST_MAX_WAIT_MS + 1);
      expect(save).not.toHaveBeenCalled();
    } finally {
      off();
    }
  }, 30000);
});
