import { bus } from '@/lib/data/realtime/bus';
import type { DailyEntry, PersistedState, StorageAdapter } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { decodeState } from './codec';
import { migrate } from './migrate';
import {
  computePayloadHash,
  decodePartition,
  encodePartition,
  MANIFEST_KEY,
  parsePartitionKey,
  partitionKey,
  type ManifestPayload,
  type PartitionMeta,
  type PartitionPayload,
} from './partitionCodec';

export const DEFAULT_STORAGE_KEY = MANIFEST_KEY;

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * DATA-HOTFIX-01: navigator.locks.request chạy callback ở task sau → khi trang đang đóng (pagehide/reload)
 * callback không kịp chạy, bản ghi cuối bị mất (E2E F3 trên CI). Thân các hàm chạy trong lock không có `await`
 * nên gọi thẳng fn() là ghi xong localStorage ngay trong lời gọi. Vì vậy lúc unload:
 *  1. các thao tác đang xếp hàng chờ lock được chạy ngay, đồng bộ, theo thứ tự gọi (bản save mới nhất ghi sau cùng);
 *  2. lời gọi mới bỏ qua lock. Ghi 2 pha vẫn giữ manifest an toàn nếu có tab khác ghi cùng lúc.
 */
let unloading = false;
const queued = new Set<() => unknown>();

export function setUnloading(v: boolean): void {
  unloading = v;
  if (!v) return;
  for (const run of [...queued]) {
    const r = run();
    if (r instanceof Promise) r.catch(() => undefined); // lỗi đã được caller gốc xử lý nếu lock còn chạy
  }
}
if (typeof window !== 'undefined') {
  // capture: chạy trước listener pagehide của store (store flush dữ liệu còn chờ debounce sau đó)
  window.addEventListener('pagehide', () => setUnloading(true), { capture: true });
  // quay lại từ bfcache → dùng lock như bình thường
  window.addEventListener('pageshow', () => setUnloading(false));
}

async function runWithLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
  if (
    unloading ||
    typeof navigator === 'undefined' ||
    !navigator.locks ||
    typeof navigator.locks.request !== 'function'
  ) {
    return fn();
  }
  let result: Promise<T> | null = null;
  const runOnce = (): Promise<T> => {
    if (!result) {
      queued.delete(runOnce);
      result = fn();
    }
    return result;
  };
  queued.add(runOnce);
  return navigator.locks.request(lockName, runOnce);
}

export function createLocalStorageAdapter(key: string = DEFAULT_STORAGE_KEY): StorageAdapter {
  const partitionPrefix = `${key}:p:`;
  const inMemoryStore: Map<string, string> = new Map();
  const hasStorage = isLocalStorageAvailable();
  let isDegraded = !hasStorage;

  if (isDegraded) {
    bus.emit({
      type: 'system/health',
      area: 'storage',
      status: 'degraded',
      message: 'Bộ nhớ trình duyệt (localStorage) bị chặn. Đang sử dụng bộ nhớ RAM tạm thời.',
    });
  }

  function getRaw(k: string): string | null {
    const memVal = inMemoryStore.get(k);
    if (memVal !== undefined) return memVal;

    if (hasStorage) {
      try {
        const item = window.localStorage.getItem(k);
        if (item !== null) return item;
      } catch {
        // Fallback to memory
      }
    }
    return null;
  }

  function setRaw(k: string, val: string): void {
    if (hasStorage && !isDegraded) {
      try {
        window.localStorage.setItem(k, val);
        return;
      } catch (err) {
        isDegraded = true;
        inMemoryStore.set(k, val);
        const usedBytes = new Blob([val]).size;
        bus.emit({
          type: 'storage/warning',
          usedBytes,
          quotaBytes: 5 * 1024 * 1024,
        });
        bus.emit({
          type: 'system/health',
          area: 'storage',
          status: 'degraded',
          message: 'Vượt hạn ngạch bộ nhớ hoặc bị chặn ghi localStorage. Dữ liệu đang lưu tạm trong bộ nhớ RAM.',
          detail: String(err),
        });
        throw err;
      }
    } else {
      inMemoryStore.set(k, val);
    }
  }

  function removeRaw(k: string): void {
    if (hasStorage) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // Ignore
      }
    }
    inMemoryStore.delete(k);
  }

  function getAllKeys(): string[] {
    const keys = new Set<string>();
    if (hasStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) keys.add(k);
        }
      } catch {
        // Ignore
      }
    }
    for (const k of inMemoryStore.keys()) {
      keys.add(k);
    }
    return Array.from(keys);
  }

  return {
    kind: isDegraded ? 'memory' : 'localStorage',

    async load(): Promise<PersistedState | null> {
      const manifestRaw = getRaw(key);

      if (!manifestRaw) {
        return null;
      }

      // 1. Kiểm tra nếu là định dạng P0 cũ (chứa 'cols') -> decodeState trực tiếp
      try {
        const parsed = JSON.parse(manifestRaw) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && 'cols' in parsed) {
          return decodeState(manifestRaw);
        }
      } catch {
        // Không phải JSON hợp lệ -> xử lý ở nhánh phục hồi bên dưới
      }

      // 2. Parse Manifest P1
      let manifest: ManifestPayload | null = null;
      try {
        const parsed = JSON.parse(manifestRaw) as Partial<ManifestPayload>;
        if (parsed.v === CONTRACT_VERSION && parsed.parts && typeof parsed.parts === 'object') {
          manifest = parsed as ManifestPayload;
        }
      } catch {
        manifest = null;
      }

      // Nếu manifest hỏng: thử migrate hoặc quét partition mồ côi để tự dựng lại
      if (!manifest) {
        try {
          return migrate(manifestRaw);
        } catch {
          // Tự cứu: quét các partition có sẵn trong storage để dựng lại
          const allKeys = getAllKeys().filter((k) => k.startsWith(partitionPrefix));
          if (allKeys.length > 0) {
            const reconstructedEntries: DailyEntry[] = [];
            for (const pKey of allKeys) {
              const info = parsePartitionKey(pKey, partitionPrefix);
              if (!info) continue;
              const pRaw = getRaw(pKey);
              if (!pRaw) continue;
              try {
                const payload = JSON.parse(pRaw) as PartitionPayload;
                const entries = decodePartition(payload, `${info.year}-01-01`, [], Date.now());
                reconstructedEntries.push(...entries);
              } catch {
                // bỏ qua partition hỏng
              }
            }

            if (reconstructedEntries.length > 0) {
              bus.emit({
                type: 'system/health',
                area: 'storage',
                status: 'recovered',
                message: 'Đã tự động phục hồi dữ liệu từ các phân vùng còn nguyên vẹn sau khi manifest bị hỏng. Cần kiểm tra lại tên chiến dịch.',
              });
              return {
                v: CONTRACT_VERSION,
                campaigns: [],
                entries: reconstructedEntries,
                settings: {
                  activeCampaignId: 'all',
                  grain: 'day',
                  range: null,
                  liveMode: false,
                  liveSpeed: 1,
                  targets: {},
                  reportFormat: 'short',
                  duplicatePolicy: 'ask',
                },
              };
            }
          }

          // Cách ly manifest hỏng
          const corruptKey = `kpi-dash:corrupt:manifest:${Date.now()}`;
          setRaw(corruptKey, manifestRaw);
          bus.emit({
            type: 'system/health',
            area: 'storage',
            status: 'degraded',
            message: 'Dữ liệu lưu trữ bị lỗi cấu trúc. Đã cô lập chuỗi hỏng.',
            detail: corruptKey,
          });
          return null;
        }
      }

      // 3. Tải từng partition theo manifest và tự kiểm tra (rows, sum)
      const allEntries: DailyEntry[] = [];
      const healthyParts: Record<string, PartitionMeta> = {};
      const activePartitionKeys = new Set<string>();

      for (const [year, meta] of Object.entries(manifest.parts)) {
        const pKey = partitionKey(year, meta.gen, partitionPrefix);
        activePartitionKeys.add(pKey);
        const pRaw = getRaw(pKey);

        if (!pRaw) {
          // E49: Thiếu key partition
          bus.emit({
            type: 'system/health',
            area: 'storage',
            status: 'degraded',
            message: `Dữ liệu năm ${year} bị thiếu (đã cách ly) — [Nhập backup]`,
            detail: pKey,
          });
          continue;
        }

        let pPayload: PartitionPayload | null = null;
        try {
          pPayload = JSON.parse(pRaw) as PartitionPayload;
        } catch {
          pPayload = null;
        }

        // Tự kiểm tra tính toàn vẹn (rows và sum)
        let isCorrupt = false;
        if (!pPayload || !Array.isArray(pPayload.d) || pPayload.d.length !== meta.rows) {
          isCorrupt = true;
        } else {
          let sumR = 0;
          let sumK = 0;
          let sumS = 0;
          let sumO = 0;
          for (let i = 0; i < meta.rows; i++) {
            sumR += pPayload.r[i] ?? 0;
            sumK += pPayload.k[i] ?? 0;
            sumS += pPayload.s[i] ?? 0;
            sumO += pPayload.o[i] ?? 0;
          }
          if (
            sumR !== meta.sum[0] ||
            sumK !== meta.sum[1] ||
            sumS !== meta.sum[2] ||
            sumO !== meta.sum[3]
          ) {
            isCorrupt = true;
          }
        }

        if (isCorrupt || !pPayload) {
          const corruptKey = `kpi-dash:corrupt:${year}:${Date.now()}`;
          if (pRaw) setRaw(corruptKey, pRaw);
          removeRaw(pKey);
          bus.emit({
            type: 'system/health',
            area: 'storage',
            status: 'degraded',
            message: `Dữ liệu năm ${year} bị hỏng (đã cách ly) — [Nhập backup]`,
            detail: corruptKey,
          });
          continue;
        }

        // Partition lành lặn -> giải mã
        const epoch = `${year}-01-01`;
        const entries = decodePartition(pPayload, epoch, manifest.campaigns, manifest.savedAt);
        allEntries.push(...entries);
        healthyParts[year] = meta;
      }

      // 4. Dọn rác key mồ côi (R-03: bọc trong lock và chỉ dọn key thế hệ cũ gen < active gen để tránh race với tab khác)
      await runWithLock('kpi-dash:write', async () => {
        const storageKeys = getAllKeys();
        for (const k of storageKeys) {
          if (!k.startsWith(partitionPrefix)) continue;
          const info = parsePartitionKey(k, partitionPrefix);
          if (!info) continue;

          const currentPartMeta = manifest.parts[info.year];
          if (currentPartMeta) {
            // Chỉ xoá nếu gen cũ hơn gen đang kích hoạt trong manifest
            if (info.gen < currentPartMeta.gen) {
              removeRaw(k);
            }
          }
        }
      });

      return {
        v: CONTRACT_VERSION,
        campaigns: manifest.campaigns,
        entries: allEntries,
        settings: manifest.settings,
      };
    },

    async save(state: PersistedState): Promise<void> {
      return runWithLock('kpi-dash:write', async () => {
        // Đọc manifest hiện tại để xác định gen và dirty partitions
        let currentManifest: ManifestPayload | null = null;
        const currentManifestRaw = getRaw(key);
        if (currentManifestRaw) {
          try {
            const p = JSON.parse(currentManifestRaw) as ManifestPayload;
            if (p && p.parts) currentManifest = p;
          } catch {
            currentManifest = null;
          }
        }

        const currentGen = currentManifest?.gen ?? 0;
        const campaigns = state.campaigns ?? [];
        const campaignIndexMap = new Map<string, number>();
        campaigns.forEach((c, idx) => campaignIndexMap.set(c.id, idx));

        // Nhóm entries theo năm
        const entriesByYear = new Map<string, DailyEntry[]>();
        for (const e of state.entries) {
          const year = e.date.slice(0, 4);
          let list = entriesByYear.get(year);
          if (!list) {
            list = [];
            entriesByYear.set(year, list);
          }
          list.push(e);
        }

        // Xác định các partition bẩn (R-02: dùng rows + sum + hash nội dung FNV-1a)
        const dirtyYears = new Set<string>();
        const encodedPartitions = new Map<
          string,
          { raw: string; rows: number; sum: [number, number, number, number]; hash: number; newGen: number }
        >();
        const updatedParts: Record<string, PartitionMeta> = {};

        for (const [year, entries] of entriesByYear.entries()) {
          const epoch = `${year}-01-01`;
          const prevMeta = currentManifest?.parts[year];

          const encoded = encodePartition(entries, epoch, campaignIndexMap);
          const raw = JSON.stringify(encoded.payload);
          const hash = computePayloadHash(raw);

          const isDirty =
            !prevMeta ||
            prevMeta.rows !== encoded.rows ||
            prevMeta.hash !== hash ||
            prevMeta.sum[0] !== encoded.sum[0] ||
            prevMeta.sum[1] !== encoded.sum[1] ||
            prevMeta.sum[2] !== encoded.sum[2] ||
            prevMeta.sum[3] !== encoded.sum[3];

          if (isDirty) {
            dirtyYears.add(year);
            const newGen = (prevMeta?.gen ?? 0) + 1;
            encodedPartitions.set(year, {
              raw,
              rows: encoded.rows,
              sum: encoded.sum,
              hash,
              newGen,
            });
            updatedParts[year] = {
              gen: newGen,
              rows: encoded.rows,
              sum: encoded.sum,
              hash,
            };
          } else {
            // Giữ nguyên partition cũ
            updatedParts[year] = prevMeta;
          }
        }

        // ── Ghi 2 pha ─────────────────────────────────────────────────────
        const writtenNewKeys: string[] = [];
        try {
          // Pha 1: Ghi từng partition bẩn sang key thế hệ mới
          for (const [year, data] of encodedPartitions.entries()) {
            const nextKey = partitionKey(year, data.newGen, partitionPrefix);
            setRaw(nextKey, data.raw);
            writtenNewKeys.push(nextKey);
          }

          // Pha 2: Commit - Ghi manifest trỏ sang thế hệ mới
          const nextManifestGen = currentGen + 1;
          const newManifest: ManifestPayload = {
            v: CONTRACT_VERSION,
            gen: nextManifestGen,
            savedAt: Date.now(),
            epoch: state.entries[0]?.date ?? '2024-01-01',
            campaigns,
            settings: state.settings,
            parts: updatedParts,
          };

          const manifestString = JSON.stringify(newManifest);
          setRaw(key, manifestString);

          // Pha 3: Xoá key thế hệ cũ của các partition bẩn và các năm bị xoá
          for (const year of dirtyYears) {
            const oldGen = currentManifest?.parts[year]?.gen;
            if (oldGen !== undefined) {
              removeRaw(partitionKey(year, oldGen, partitionPrefix));
            }
          }
          if (currentManifest?.parts) {
            for (const oldYear of Object.keys(currentManifest.parts)) {
              if (!entriesByYear.has(oldYear)) {
                const oldGen = currentManifest.parts[oldYear]?.gen;
                if (oldGen !== undefined) {
                  removeRaw(partitionKey(oldYear, oldGen, partitionPrefix));
                }
              }
            }
          }
        } catch (err) {
          // R-01 (Cao): Lỗi / QuotaExceededError ở pha 1 hoặc pha 2
          // 1. Rollback: Xoá các key mới ghi dở
          for (const k of writtenNewKeys) {
            removeRaw(k);
          }

          // 2. Fallback in-memory: Lưu giữ toàn bộ state vào inMemoryStore để không bao giờ mất dữ liệu
          isDegraded = true;
          inMemoryStore.set(key, JSON.stringify({
            v: CONTRACT_VERSION,
            gen: currentGen + 1,
            savedAt: Date.now(),
            epoch: state.entries[0]?.date ?? '2024-01-01',
            campaigns,
            settings: state.settings,
            parts: updatedParts,
          }));
          for (const [year, data] of encodedPartitions.entries()) {
            inMemoryStore.set(partitionKey(year, data.newGen, partitionPrefix), data.raw);
          }

          // 3. Phát cảnh báo sức khoẻ
          bus.emit({
            type: 'system/health',
            area: 'storage',
            status: 'degraded',
            message: 'Vượt hạn ngạch bộ nhớ localStorage khi lưu. Dữ liệu đã được chuyển sang lưu tạm trong RAM an toàn.',
            detail: String(err),
          });

          // R-01: KHÔNG rethrow ra ngoài để tránh unhandled rejection làm trắng trang / đơ ứng dụng
          return;
        }
      });
    },

    async clear(): Promise<void> {
      removeRaw(key);
      const allKeys = getAllKeys();
      for (const k of allKeys) {
        if (k.startsWith(partitionPrefix) || k.startsWith('kpi-dash:corrupt:')) {
          removeRaw(k);
        }
      }
    },

    async usage(): Promise<{ usedBytes: number; quotaBytes: number }> {
      let totalBytes = 0;
      const allKeys = getAllKeys();
      for (const k of allKeys) {
        if (k === key || k.startsWith(partitionPrefix)) {
          const val = getRaw(k) ?? '';
          totalBytes += new Blob([val]).size;
        }
      }
      return { usedBytes: totalBytes, quotaBytes: 5 * 1024 * 1024 };
    },
  };
}
