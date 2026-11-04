// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import {
  ACTIVE_STORAGE_TYPE_KEY,
  createIndexedDbAdapter,
  IDB_SETTINGS_STORAGE_KEY,
  migrateToIndexedDb,
  migrateToLocalStorage,
} from '@/lib/data/storage/indexedDbAdapter';
import { createLocalStorageAdapter } from '@/lib/data/storage/localStorageAdapter';
import { checkAndAutoSwitchAdapter, getStorageAdapter, setStorageAdapter, useDataStore } from '@/lib/data/store';
import type { PersistedState } from '@/types/domain';
import { CONTRACT_VERSION, LIMITS } from '@/types/domain';

// Giả lập IndexedDB trong môi trường jsdom
class FakeIDBRequest {
  result: unknown = null;
  error: Error | null = null;
  onsuccess: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
}

class FakeIDBObjectStore {
  name: string;
  data: Map<string, unknown> = new Map();
  keyPath: string;

  constructor(name: string, options?: { keyPath?: string }) {
    this.name = name;
    this.keyPath = options?.keyPath ?? 'id';
  }

  createIndex(): void {
    // Không cần logic cho index trong unit test
  }

  put(value: unknown): FakeIDBRequest {
    const req = new FakeIDBRequest();
    const v = value as Record<string, unknown>;
    const key = (v[this.keyPath] as string) ?? String(this.data.size);
    this.data.set(key, value);
    req.result = key;
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  }

  get(key: string): FakeIDBRequest {
    const req = new FakeIDBRequest();
    req.result = this.data.get(key);
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  }

  getAll(): FakeIDBRequest {
    const req = new FakeIDBRequest();
    req.result = Array.from(this.data.values());
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  }

  clear(): FakeIDBRequest {
    const req = new FakeIDBRequest();
    this.data.clear();
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  }

  count(): FakeIDBRequest {
    const req = new FakeIDBRequest();
    req.result = this.data.size;
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  }
}

class FakeIDBTransaction {
  stores: Map<string, FakeIDBObjectStore>;
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: Error | null = null;

  constructor(stores: Map<string, FakeIDBObjectStore>) {
    this.stores = stores;
    queueMicrotask(() => {
      this.oncomplete?.();
    });
  }

  objectStore(name: string): FakeIDBObjectStore {
    const s = this.stores.get(name);
    if (!s) throw new Error(`ObjectStore ${name} not found`);
    return s;
  }
}

class FakeIDBDatabase {
  stores: Map<string, FakeIDBObjectStore> = new Map();

  get objectStoreNames() {
    return {
      contains: (name: string) => this.stores.has(name),
    };
  }

  createObjectStore(name: string, options?: { keyPath?: string }): FakeIDBObjectStore {
    const store = new FakeIDBObjectStore(name, options);
    this.stores.set(name, store);
    return store;
  }

  transaction(_names: string | string[]): FakeIDBTransaction {
    return new FakeIDBTransaction(this.stores);
  }
}

const fakeGlobalDB = new FakeIDBDatabase();

const fakeIndexedDB = {
  open(_name: string, _version?: number) {
    const req = new FakeIDBRequest() as unknown as IDBOpenDBRequest;
    queueMicrotask(() => {
      (req as unknown as { result: unknown }).result = fakeGlobalDB;
      if (req.onupgradeneeded) {
        req.onupgradeneeded(new Event('upgradeneeded') as IDBVersionChangeEvent);
      }
      req.onsuccess?.(new Event('success'));
    });
    return req;
  },
};

describe('DATA-09: IndexedDB Adapter & Auto Migration', () => {
  beforeEach(() => {
    localStorage.clear();
    fakeGlobalDB.stores.clear();
    (window as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDB;
    setStorageAdapter(createLocalStorageAdapter());
  });

  afterEach(() => {
    localStorage.clear();
  });

  const sampleState: PersistedState = {
    v: CONTRACT_VERSION,
    campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 1730000000000 }],
    entries: [
      {
        id: 'default|2026-11-01',
        date: '2026-11-01',
        campaignId: 'default',
        reach: 20000,
        clicks: 800,
        cost: 4000000,
        orders: 20,
        source: 'manual',
        createdAt: 1730000000000,
        updatedAt: 1730000000000,
      },
    ],
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

  it('lưu trữ và tải lại đúng cấu trúc qua IndexedDB adapter', async () => {
    const adapter = createIndexedDbAdapter();
    expect(adapter.kind).toBe('indexedDB');

    // Chưa có dữ liệu → trả về null
    const initial = await adapter.load();
    expect(initial).toBeNull();

    // Lưu dữ liệu
    await adapter.save(sampleState);

    // Tải lại dữ liệu
    const loaded = await adapter.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.entries.length).toBe(1);
    expect(loaded?.entries[0]?.reach).toBe(20000);
    expect(loaded?.campaigns[0]?.id).toBe('default');
    expect(loaded?.settings.grain).toBe('day');

    // Settings được lưu và đọc từ localStorage theo yêu cầu
    const localSettings = localStorage.getItem(IDB_SETTINGS_STORAGE_KEY);
    expect(localSettings).toBeTruthy();
    expect(JSON.parse(localSettings!).grain).toBe('day');
  });

  it('xoá sạch dữ liệu với clear() bao gồm cả settings trong localStorage', async () => {
    const adapter = createIndexedDbAdapter();
    await adapter.save(sampleState);

    expect(localStorage.getItem(IDB_SETTINGS_STORAGE_KEY)).toBeTruthy();

    await adapter.clear();

    const loaded = await adapter.load();
    expect(loaded).toBeNull();
    expect(localStorage.getItem(IDB_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('đo lường dung lượng với usage()', async () => {
    const adapter = createIndexedDbAdapter();
    await adapter.save(sampleState);

    const u = await adapter.usage();
    expect(u.quotaBytes).toBeGreaterThan(0);
    expect(u.usedBytes).toBeGreaterThan(0);
  });

  it('di chuyển dữ liệu hai chiều: migrateToIndexedDb và migrateToLocalStorage', async () => {
    const local = createLocalStorageAdapter();
    const idb = createIndexedDbAdapter();

    // 1. Lưu vào localStorage
    await local.save(sampleState);
    expect(await local.load()).not.toBeNull();
    expect(await idb.load()).toBeNull();

    // 2. Chuyển sang IndexedDB
    await migrateToIndexedDb(local, idb);
    expect(await idb.load()).not.toBeNull();
    expect(await local.load()).toBeNull(); // localStorage cũ đã được dọn
    expect(localStorage.getItem(ACTIVE_STORAGE_TYPE_KEY)).toBe('indexedDB');

    // 3. Chuyển ngược lại về localStorage
    await migrateToLocalStorage(idb, local);
    expect(await local.load()).not.toBeNull();
    expect(await idb.load()).toBeNull(); // IndexedDB đã được dọn
    expect(localStorage.getItem(ACTIVE_STORAGE_TYPE_KEY)).toBe('localStorage');
  });

  it('tự động chuyển đổi sang IndexedDB khi số dòng vượt ngưỡng 40.000 dòng', async () => {
    const initialAdapter = getStorageAdapter();
    expect(initialAdapter.kind).toBe('localStorage');

    // Kích hoạt kiểm tra vượt ngưỡng
    await checkAndAutoSwitchAdapter(LIMITS.LOCAL_STORAGE_SOFT_ROWS + 10);

    const newAdapter = getStorageAdapter();
    expect(newAdapter.kind).toBe('indexedDB');
    expect(useDataStore.getState().storage.kind).toBe('indexedDB');
  });

  it('tự động chuyển đổi sang IndexedDB khi nhận cảnh báo quota (storage/warning)', async () => {
    const initialAdapter = getStorageAdapter();
    expect(initialAdapter.kind).toBe('localStorage');

    // Phát sự kiện cảnh báo bộ nhớ
    bus.emit({
      type: 'storage/warning',
      usedBytes: 5 * 1024 * 1024,
      quotaBytes: 5 * 1024 * 1024,
    });

    // Chờ microtasks để adapter chuyển đổi
    await new Promise((r) => setTimeout(r, 50));

    expect(getStorageAdapter().kind).toBe('indexedDB');
  });

  it('xử lý gracefully và phát cảnh báo degraded khi IndexedDB không khả dụng', async () => {
    delete (window as unknown as { indexedDB?: unknown }).indexedDB;

    let degradedEventEmitted = false;
    const unlisten = bus.on('system/health', (e) => {
      if (e.area === 'storage' && e.status === 'degraded') {
        degradedEventEmitted = true;
      }
    });

    const brokenAdapter = createIndexedDbAdapter();
    await brokenAdapter.save(sampleState);
    const loaded = await brokenAdapter.load();

    expect(degradedEventEmitted).toBe(true);
    // Vẫn lưu trữ và đọc được tạm trong RAM mà không throw crash app
    expect(loaded).not.toBeNull();
    expect(loaded?.entries.length).toBe(1);

    unlisten();
  });
});
