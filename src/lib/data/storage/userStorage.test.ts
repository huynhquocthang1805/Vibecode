// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_STORAGE_KEY } from './localStorageAdapter';
import { MANIFEST_KEY } from './partitionCodec';
import {
  clearUserStorageData,
  getGuestDataStats,
  getUserStorageKey,
  hasUserStorageData,
  migrateGuestDataToUser,
} from './userStorage';

describe('ACC-04 · User storage space & guest migration', () => {
  const userId = 'usr_test_123';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('getUserStorageKey tạo đúng key phân vùng theo user', () => {
    expect(getUserStorageKey(userId)).toBe(`${DEFAULT_STORAGE_KEY}:u:${userId}`);
  });

  it('migrateGuestDataToUser sao chép manifest và partition của khách sang user', () => {
    // Giả lập dữ liệu khách
    const fakeGuestManifest = JSON.stringify({
      v: 1,
      rows: 1234,
      partitions: { '2026': { hash: 'h1', rows: 1234 } },
    });
    localStorage.setItem(MANIFEST_KEY, fakeGuestManifest);
    localStorage.setItem(`${MANIFEST_KEY}:p:2026`, 'fake-partition-data-2026');

    expect(hasUserStorageData(userId)).toBe(false);

    const stats = getGuestDataStats();
    expect(stats.exists).toBe(true);
    expect(stats.rows).toBe(1234);

    // Chuyển dữ liệu khách sang user
    const result = migrateGuestDataToUser(userId);
    expect(result.migrated).toBe(true);
    expect(result.rows).toBe(1234);

    // Dữ liệu user đã có
    expect(hasUserStorageData(userId)).toBe(true);
    const userManifest = localStorage.getItem(getUserStorageKey(userId));
    expect(userManifest).toBe(fakeGuestManifest);
    const userPartition = localStorage.getItem(`${getUserStorageKey(userId)}:p:2026`);
    expect(userPartition).toBe('fake-partition-data-2026');

    // Dữ liệu khách ban đầu vẫn còn nguyên
    expect(localStorage.getItem(MANIFEST_KEY)).toBe(fakeGuestManifest);
  });

  it('clearUserStorageData chỉ xoá dữ liệu của user mà không ảnh ảnh hưởng khách', () => {
    const fakeManifest = JSON.stringify({ v: 1, rows: 50 });
    localStorage.setItem(MANIFEST_KEY, fakeManifest);

    const userKey = getUserStorageKey(userId);
    localStorage.setItem(userKey, fakeManifest);
    localStorage.setItem(`${userKey}:p:2026`, 'partition-data');

    clearUserStorageData(userId);

    // Dữ liệu user bị xoá
    expect(localStorage.getItem(userKey)).toBeNull();
    expect(localStorage.getItem(`${userKey}:p:2026`)).toBeNull();

    // Dữ liệu khách còn nguyên
    expect(localStorage.getItem(MANIFEST_KEY)).toBe(fakeManifest);
  });
});
