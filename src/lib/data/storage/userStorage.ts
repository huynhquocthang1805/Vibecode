// Owner: data-engineer (Huy) — ACC-04: User storage space & guest data migration
import { DEFAULT_STORAGE_KEY } from './localStorageAdapter';
import { MANIFEST_KEY } from './partitionCodec';

export function getUserStorageKey(userId?: string | null): string {
  if (!userId) return DEFAULT_STORAGE_KEY;
  return `${DEFAULT_STORAGE_KEY}:u:${userId}`;
}

/**
 * Kiểm tra xem tài khoản người dùng đã có dữ liệu trong localStorage trên máy này chưa
 */
export function hasUserStorageData(userId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const userKey = getUserStorageKey(userId);
  return window.localStorage.getItem(userKey) !== null;
}

/**
 * Lấy số dòng dữ liệu hiện có trong không gian khách (kpi-dash:v1)
 */
export function getGuestDataStats(): { rows: number; exists: boolean } {
  if (typeof window === 'undefined' || !window.localStorage) return { rows: 0, exists: false };
  const raw = window.localStorage.getItem(MANIFEST_KEY);
  if (!raw) return { rows: 0, exists: false };
  try {
    const manifest = JSON.parse(raw);
    const rows = manifest.rows ?? 0;
    return { rows, exists: rows > 0 };
  } catch {
    return { rows: 0, exists: false };
  }
}

/**
 * Chuyển dữ liệu khách sang không gian người dùng (không xoá dữ liệu khách cũ)
 */
export function migrateGuestDataToUser(userId: string): { rows: number; migrated: boolean } {
  if (typeof window === 'undefined' || !window.localStorage) return { rows: 0, migrated: false };

  const guestManifestRaw = window.localStorage.getItem(MANIFEST_KEY);
  if (!guestManifestRaw) return { rows: 0, migrated: false };

  const userKey = getUserStorageKey(userId);
  const userPrefix = `${userKey}:p:`;
  const guestPrefix = `${MANIFEST_KEY}:p:`;

  try {
    const manifest = JSON.parse(guestManifestRaw);
    const rows = manifest.rows ?? 0;

    // Sao chép manifest sang key của user
    window.localStorage.setItem(userKey, guestManifestRaw);

    // Sao chép tất cả partition
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(guestPrefix)) {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          const suffix = key.slice(guestPrefix.length);
          window.localStorage.setItem(`${userPrefix}${suffix}`, val);
        }
      }
    }

    return { rows, migrated: true };
  } catch {
    return { rows: 0, migrated: false };
  }
}

/**
 * Xoá sạch dữ liệu của người dùng trên máy này (khi đăng xuất từ máy dùng chung)
 */
export function clearUserStorageData(userId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const userKey = getUserStorageKey(userId);
  const userPrefix = `${userKey}:p:`;

  window.localStorage.removeItem(userKey);

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(userPrefix)) {
      keysToRemove.push(key);
    }
  }

  for (const k of keysToRemove) {
    window.localStorage.removeItem(k);
  }
}
