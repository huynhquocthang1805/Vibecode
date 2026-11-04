import { bus } from '@/lib/data/realtime/bus';
import type { DailyEntry, PersistedState, StorageAdapter } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { decodeState } from './codec';
import { migrate } from './migrate';
import {
  decodePartition,
  encodePartition,
  MANIFEST_KEY,
  parsePartitionKey,
  partitionKey,
  PARTITION_PREFIX,
  type ManifestPayload,
  type PartitionMeta,
  type PartitionPayload,
} from './partitionCodec';

export const DEFAULT_STORAGE_KEY = MANIFEST_KEY;

// In-memory fallback cache khi localStorage bị chặn hoặc dính quota
const inMemoryStore: Map<string, string> = new Map();

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

async function runWithLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    return navigator.locks.request(lockName, fn);
  }
  return fn();
}

export function createLocalStorageAdapter(key: string = DEFAULT_STORAGE_KEY): StorageAdapter {
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
    if (hasStorage) {
      try {
        return window.localStorage.getItem(k);
      } catch {
        // Fallback to memory
      }
    }
    return inMemoryStore.get(k) ?? null;
  }

  function setRaw(k: string, val: string): void {
    if (hasStorage && !isDegraded) {
      try {
        window.localStorage.setItem(k, val);
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
          message: 'Vượt hạn ngạch bộ nhớ hoặc bị chặn ghi localStorage. Chuyển sang lưu tạm trong bộ nhớ.',
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
          const allKeys = getAllKeys().filter((k) => k.startsWith(PARTITION_PREFIX));
          if (allKeys.length > 0) {
            const reconstructedEntries: DailyEntry[] = [];
            for (const pKey of allKeys) {
              const info = parsePartitionKey(pKey);
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
                message: 'Đã tự động phục hồi dữ liệu từ các phân vùng còn nguyên vẹn sau khi manifest bị hỏng.',
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
        const pKey = partitionKey(year, meta.gen);
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

      // 4. Dọn rác key mồ côi (các key partition không nằm trong manifest)
      const storageKeys = getAllKeys();
      for (const k of storageKeys) {
        if (k.startsWith(PARTITION_PREFIX) && !activePartitionKeys.has(k)) {
          removeRaw(k);
        }
      }

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

        // Xác định các partition bẩn (chỉ mã hoá lại partition bẩn)
        const dirtyYears = new Set<string>();
        const encodedPartitions = new Map<
          string,
          { raw: string; rows: number; sum: [number, number, number, number]; newGen: number }
        >();
        const updatedParts: Record<string, PartitionMeta> = {};

        for (const [year, entries] of entriesByYear.entries()) {
          const epoch = `${year}-01-01`;
          const prevMeta = currentManifest?.parts[year];

          // Tính rows và sums để so sánh
          const encoded = encodePartition(entries, epoch, campaignIndexMap);
          const isDirty =
            !prevMeta ||
            prevMeta.rows !== encoded.rows ||
            prevMeta.sum[0] !== encoded.sum[0] ||
            prevMeta.sum[1] !== encoded.sum[1] ||
            prevMeta.sum[2] !== encoded.sum[2] ||
            prevMeta.sum[3] !== encoded.sum[3];

          if (isDirty) {
            dirtyYears.add(year);
            const newGen = (prevMeta?.gen ?? 0) + 1;
            encodedPartitions.set(year, {
              raw: JSON.stringify(encoded.payload),
              rows: encoded.rows,
              sum: encoded.sum,
              newGen,
            });
            updatedParts[year] = {
              gen: newGen,
              rows: encoded.rows,
              sum: encoded.sum,
            };
          } else {
            // Giữ nguyên partition cũ
            updatedParts[year] = prevMeta;
          }
        }

        // ── Ghi 2 pha ─────────────────────────────────────────────────────
        // Pha 1: Ghi từng partition bẩn sang key thế hệ mới
        const writtenNewKeys: string[] = [];
        try {
          for (const [year, data] of encodedPartitions.entries()) {
            const nextKey = partitionKey(year, data.newGen);
            setRaw(nextKey, data.raw);
            writtenNewKeys.push(nextKey);
          }
        } catch (err) {
          // Lỗi / Quota ở bước 1 -> xoá các key mới ghi dở, giữ nguyên manifest cũ
          for (const k of writtenNewKeys) {
            removeRaw(k);
          }
          throw err;
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
        try {
          setRaw(key, manifestString);
        } catch (err) {
          // Nếu commit manifest thất bại -> rollback các key mới
          for (const k of writtenNewKeys) {
            removeRaw(k);
          }
          throw err;
        }

        // Pha 3: Xoá key thế hệ cũ của các partition bẩn và các năm bị xoá
        for (const year of dirtyYears) {
          const oldGen = currentManifest?.parts[year]?.gen;
          if (oldGen !== undefined) {
            removeRaw(partitionKey(year, oldGen));
          }
        }
        // Xoá các năm không còn tồn tại trong dữ liệu mới
        if (currentManifest?.parts) {
          for (const oldYear of Object.keys(currentManifest.parts)) {
            if (!entriesByYear.has(oldYear)) {
              const oldGen = currentManifest.parts[oldYear]?.gen;
              if (oldGen !== undefined) {
                removeRaw(partitionKey(oldYear, oldGen));
              }
            }
          }
        }
      });
    },

    async clear(): Promise<void> {
      removeRaw(key);
      const allKeys = getAllKeys();
      for (const k of allKeys) {
        if (k.startsWith(PARTITION_PREFIX) || k.startsWith('kpi-dash:corrupt:')) {
          removeRaw(k);
        }
      }
    },

    async usage(): Promise<{ usedBytes: number; quotaBytes: number }> {
      let totalBytes = 0;
      const allKeys = getAllKeys();
      for (const k of allKeys) {
        if (k === key || k.startsWith(PARTITION_PREFIX)) {
          const val = getRaw(k) ?? '';
          totalBytes += new Blob([val]).size;
        }
      }
      return { usedBytes: totalBytes, quotaBytes: 5 * 1024 * 1024 };
    },
  };
}
