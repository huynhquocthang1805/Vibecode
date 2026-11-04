import { bus } from '@/lib/data/realtime/bus';
import type { Campaign, DailyEntry, PersistedState, Settings, StorageAdapter } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { createLocalStorageAdapter } from './localStorageAdapter';

export const IDB_DATABASE_NAME = 'kpi-dash-db';
export const IDB_DATABASE_VERSION = 1;
export const IDB_SETTINGS_STORAGE_KEY = 'kpi-dash:v1:settings';
export const ACTIVE_STORAGE_TYPE_KEY = 'kpi-dash:active-storage';

const DEFAULT_CAMPAIGN: Campaign = {
  id: 'default',
  name: 'Chiến dịch chính',
  createdAt: 0,
};

const DEFAULT_SETTINGS: Settings = {
  activeCampaignId: 'all',
  grain: 'day',
  range: null,
  liveMode: false,
  liveSpeed: 1,
  targets: {},
  reportFormat: 'short',
  duplicatePolicy: 'ask',
};

function isIndexedDbAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in current environment'));
      return;
    }

    const request = window.indexedDB.open(IDB_DATABASE_NAME, IDB_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('entries')) {
        const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
        entryStore.createIndex('date', 'date', { unique: false });
        entryStore.createIndex('campaignId', 'campaignId', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    request.onblocked = () => {
      // Khi phiên bản cũ đang khoá kết nối
    };
  });
}

/**
 * Adapter lưu trữ IndexedDB thuần (không phụ thuộc thư viện bên ngoài).
 * Chuyên dùng khi số lượng bản ghi vượt quá 40.000 dòng hoặc khi localStorage đầy.
 * Cấu hình (settings) vẫn được đồng bộ vào localStorage để tải nhanh giao diện ban đầu.
 */
export function createIndexedDbAdapter(): StorageAdapter {
  const inMemoryBackup: Map<string, unknown> = new Map();
  let degradedReported = false;

  function reportDegraded(err: unknown) {
    if (!degradedReported) {
      degradedReported = true;
      bus.emit({
        type: 'system/health',
        area: 'storage',
        status: 'degraded',
        message: 'Không thể truy cập IndexedDB. Đang chuyển sang lưu trữ tạm trong bộ nhớ RAM.',
        detail: String(err),
      });
    }
  }

  return {
    kind: 'indexedDB' as const,

    async load(): Promise<PersistedState | null> {
      try {
        const db = await openDatabase();
        return await new Promise<PersistedState | null>((resolve, reject) => {
          const tx = db.transaction(['entries', 'meta'], 'readonly');
          const entryStore = tx.objectStore('entries');
          const metaStore = tx.objectStore('meta');

          const entriesReq = entryStore.getAll();
          const campaignsReq = metaStore.get('campaigns');
          const settingsReq = metaStore.get('settings');
          const versionReq = metaStore.get('version');

          tx.oncomplete = () => {
            const rawEntries = (entriesReq.result as DailyEntry[]) ?? [];
            const campaignsMeta = campaignsReq.result as { key: string; value: Campaign[] } | undefined;
            const settingsMeta = settingsReq.result as { key: string; value: Settings } | undefined;
            const versionMeta = versionReq.result as { key: string; value: number } | undefined;

            // Đọc settings từ localStorage (nếu có) theo tiêu chuẩn "settings vẫn ở localStorage"
            let settings = settingsMeta?.value ?? DEFAULT_SETTINGS;
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                const rawLocal = window.localStorage.getItem(IDB_SETTINGS_STORAGE_KEY);
                if (rawLocal) {
                  settings = { ...DEFAULT_SETTINGS, ...JSON.parse(rawLocal) };
                }
              } catch {
                // Giữ settings từ meta store nếu không đọc được từ localStorage
              }
            }

            if (rawEntries.length === 0 && !campaignsMeta) {
              resolve(null);
              return;
            }

            resolve({
              v: (versionMeta?.value ?? CONTRACT_VERSION) as typeof CONTRACT_VERSION,
              campaigns: campaignsMeta?.value ?? [DEFAULT_CAMPAIGN],
              entries: rawEntries,
              settings,
            });
          };

          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        reportDegraded(err);
        const mem = inMemoryBackup.get('state') as PersistedState | undefined;
        return mem ?? null;
      }
    },

    async save(state: PersistedState): Promise<void> {
      // 1. Lưu settings vào localStorage để sẵn sàng bootstrap nhanh
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(IDB_SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
        } catch {
          // Bỏ qua lỗi hạn ngạch localStorage đối với settings nhỏ
        }
      }

      // 2. Lưu entries và metadata vào IndexedDB
      try {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['entries', 'meta'], 'readwrite');
          const entryStore = tx.objectStore('entries');
          const metaStore = tx.objectStore('meta');

          entryStore.clear();
          for (let i = 0; i < state.entries.length; i++) {
            const entry = state.entries[i];
            if (entry) {
              entryStore.put(entry);
            }
          }

          metaStore.put({ key: 'version', value: state.v ?? CONTRACT_VERSION });
          metaStore.put({ key: 'campaigns', value: state.campaigns });
          metaStore.put({ key: 'settings', value: state.settings });

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        });
      } catch (err) {
        reportDegraded(err);
        inMemoryBackup.set('state', state);
      }
    },

    async clear(): Promise<void> {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(IDB_SETTINGS_STORAGE_KEY);
        } catch {
          // Bỏ qua
        }
      }

      inMemoryBackup.clear();

      try {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['entries', 'meta'], 'readwrite');
          tx.objectStore('entries').clear();
          tx.objectStore('meta').clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        reportDegraded(err);
      }
    },

    async usage(): Promise<{ usedBytes: number; quotaBytes: number }> {
      if (
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.estimate === 'function'
      ) {
        try {
          const est = await navigator.storage.estimate();
          return {
            usedBytes: est.usage ?? 0,
            quotaBytes: est.quota ?? 50 * 1024 * 1024,
          };
        } catch {
          // Ước lượng bên dưới
        }
      }

      try {
        const db = await openDatabase();
        const count = await new Promise<number>((resolve) => {
          const tx = db.transaction(['entries'], 'readonly');
          const req = tx.objectStore('entries').count();
          req.onsuccess = () => resolve(req.result ?? 0);
          req.onerror = () => resolve(0);
        });
        return {
          usedBytes: count * 128 + 2048,
          quotaBytes: 50 * 1024 * 1024,
        };
      } catch {
        return {
          usedBytes: 0,
          quotaBytes: 50 * 1024 * 1024,
        };
      }
    },
  };
}

/**
 * Chuyển dữ liệu hai chiều giữa 2 adapter lưu trữ.
 */
export async function migrateStorage(from: StorageAdapter, to: StorageAdapter): Promise<void> {
  const state = await from.load();
  if (state) {
    await to.save(state);
    await from.clear();
  }
}

/**
 * Di chuyển dữ liệu từ localStorage sang IndexedDB.
 */
export async function migrateToIndexedDb(
  sourceAdapter?: StorageAdapter,
  targetAdapter?: StorageAdapter
): Promise<StorageAdapter> {
  const from = sourceAdapter ?? createLocalStorageAdapter();
  const to = targetAdapter ?? createIndexedDbAdapter();
  await migrateStorage(from, to);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ACTIVE_STORAGE_TYPE_KEY, 'indexedDB');
    } catch {
      // Bỏ qua
    }
  }
  return to;
}

/**
 * Di chuyển dữ liệu từ IndexedDB về lại localStorage.
 */
export async function migrateToLocalStorage(
  sourceAdapter?: StorageAdapter,
  targetAdapter?: StorageAdapter
): Promise<StorageAdapter> {
  const from = sourceAdapter ?? createIndexedDbAdapter();
  const to = targetAdapter ?? createLocalStorageAdapter();
  await migrateStorage(from, to);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ACTIVE_STORAGE_TYPE_KEY, 'localStorage');
    } catch {
      // Bỏ qua
    }
  }
  return to;
}
