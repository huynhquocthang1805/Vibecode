import { bus } from '@/lib/data/realtime/bus';
import type { PersistedState, StorageAdapter } from '@/types/domain';

import { decodeState, encodeState } from './codec';
import { migrate } from './migrate';

export const DEFAULT_STORAGE_KEY = 'kpi-dash:v1';

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

export function createLocalStorageAdapter(key: string = DEFAULT_STORAGE_KEY): StorageAdapter {
  const hasStorage = isLocalStorageAvailable();
  let saveCount = 0;
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
        return;
      }
    }
    inMemoryStore.set(k, val);
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

  return {
    kind: isDegraded ? 'memory' : 'localStorage',

    async load(): Promise<PersistedState | null> {
      let raw = getRaw(key);
      const backupKey = `${key}:backup`;

      if (!raw) {
        raw = getRaw(backupKey);
      }

      if (!raw) {
        return null;
      }

      try {
        return decodeState(raw);
      } catch {
        // Thử migrate
        try {
          return migrate(raw);
        } catch {
          // Thử đọc từ backup key nếu chuỗi chính bị hỏng
          const backupRaw = getRaw(backupKey);
          if (backupRaw && backupRaw !== raw) {
            try {
              return decodeState(backupRaw);
            } catch {
              // Tiếp tục xuống lưu corrupt
            }
          }

          // Ghi chuỗi hỏng để debug và thông báo
          const corruptKey = `kpi-dash:corrupt:${Date.now()}`;
          setRaw(corruptKey, raw);
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
    },

    async save(state: PersistedState): Promise<void> {
      let encoded: string;
      try {
        encoded = encodeState(state);
      } catch (err) {
        bus.emit({
          type: 'system/health',
          area: 'storage',
          status: 'degraded',
          message: 'Lỗi mã hoá dữ liệu trước khi lưu.',
          detail: String(err),
        });
        return;
      }

      const byteLen = new Blob([encoded]).size;
      // Cảnh báo nếu vượt 80% hạn ngạch 5MB
      if (byteLen > 0.8 * 5 * 1024 * 1024) {
        bus.emit({
          type: 'storage/warning',
          usedBytes: byteLen,
          quotaBytes: 5 * 1024 * 1024,
        });
      }

      setRaw(key, encoded);
      saveCount++;

      // Ghi backup key chỉ khi < 1MB và mỗi 5 lần lưu
      if (byteLen < 1 * 1024 * 1024 && saveCount % 5 === 0) {
        setRaw(`${key}:backup`, encoded);
      }
    },

    async clear(): Promise<void> {
      removeRaw(key);
      removeRaw(`${key}:backup`);
    },

    async usage(): Promise<{ usedBytes: number; quotaBytes: number }> {
      const current = getRaw(key) ?? '';
      const usedBytes = new Blob([current]).size;
      const quotaBytes = 5 * 1024 * 1024;
      return { usedBytes, quotaBytes };
    },
  };
}
