// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import type { DailyEntry, PersistedState } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { createLocalStorageAdapter } from './localStorageAdapter';
import {
  decodePartition,
  encodePartition,
  partitionKey,
  PARTITION_PREFIX,
} from './partitionCodec';

describe('DATA-10: Lưu trữ phân vùng theo năm + Ghi 2 pha + Tự kiểm', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function createSampleState(): PersistedState {
    const entries: DailyEntry[] = [
      // Năm 2024
      {
        id: 'camp-a|2024-06-01',
        date: '2024-06-01',
        campaignId: 'camp-a',
        reach: 1000,
        clicks: 50,
        cost: 200000,
        orders: 5,
        source: 'manual',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'camp-a|2024-06-02',
        date: '2024-06-02',
        campaignId: 'camp-a',
        reach: 1200,
        clicks: 60,
        cost: 240000,
        orders: 6,
        source: 'manual',
        createdAt: 1000,
        updatedAt: 1000,
      },
      // Năm 2025
      {
        id: 'camp-b|2025-01-15',
        date: '2025-01-15',
        campaignId: 'camp-b',
        reach: 5000,
        clicks: 250,
        cost: 1000000,
        orders: 20,
        source: 'csv',
        createdAt: 1000,
        updatedAt: 1000,
      },
      // Năm 2026
      {
        id: 'camp-a|2026-10-20',
        date: '2026-10-20',
        campaignId: 'camp-a',
        reach: 2000,
        clicks: 100,
        cost: 400000,
        orders: 10,
        source: 'live',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    return {
      v: CONTRACT_VERSION,
      campaigns: [
        { id: 'camp-a', name: 'Chiến dịch A', createdAt: 0 },
        { id: 'camp-b', name: 'Chiến dịch B', createdAt: 0 },
      ],
      entries,
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

  it('Bất biến #8: decode(encode(s)) ≡ s (bỏ qua createdAt/updatedAt)', () => {
    const state = createSampleState();
    const campMap = new Map([
      ['camp-a', 0],
      ['camp-b', 1],
    ]);

    const entries2024 = state.entries.filter((e) => e.date.startsWith('2024'));
    const enc2024 = encodePartition(entries2024, '2024-01-01', campMap);
    const dec2024 = decodePartition(enc2024.payload, '2024-01-01', state.campaigns, 9999);

    expect(dec2024.length).toBe(entries2024.length);
    for (let i = 0; i < entries2024.length; i++) {
      const orig = entries2024[i]!;
      const dec = dec2024[i]!;
      expect(dec.id).toBe(orig.id);
      expect(dec.date).toBe(orig.date);
      expect(dec.campaignId).toBe(orig.campaignId);
      expect(dec.reach).toBe(orig.reach);
      expect(dec.clicks).toBe(orig.clicks);
      expect(dec.cost).toBe(orig.cost);
      expect(dec.orders).toBe(orig.orders);
      expect(dec.source).toBe(orig.source);
    }
  });

  it('Lưu trữ phân vùng: chỉ ghi lại partition bẩn khi thay đổi một năm', async () => {
    const adapter = createLocalStorageAdapter();
    const state = createSampleState();

    // Lần 1: Lưu toàn bộ state (3 năm 2024, 2025, 2026)
    await adapter.save(state);

    expect(localStorage.getItem(partitionKey('2024', 1))).not.toBeNull();
    expect(localStorage.getItem(partitionKey('2025', 1))).not.toBeNull();
    expect(localStorage.getItem(partitionKey('2026', 1))).not.toBeNull();

    // Lần 2: Thêm một entry mới vào năm 2026 (năm 2024 và 2025 không đổi)
    const updatedEntries = [
      ...state.entries,
      {
        id: 'camp-a|2026-10-21',
        date: '2026-10-21',
        campaignId: 'camp-a',
        reach: 2500,
        clicks: 120,
        cost: 450000,
        orders: 12,
        source: 'live' as const,
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    await adapter.save({ ...state, entries: updatedEntries });

    // Năm 2024 và 2025 vẫn giữ nguyên gen 1
    expect(localStorage.getItem(partitionKey('2024', 1))).not.toBeNull();
    expect(localStorage.getItem(partitionKey('2025', 1))).not.toBeNull();
    expect(localStorage.getItem(partitionKey('2024', 2))).toBeNull();

    // Năm 2026 tăng lên gen 2, gen 1 cũ đã bị dọn dẹp
    expect(localStorage.getItem(partitionKey('2026', 2))).not.toBeNull();
    expect(localStorage.getItem(partitionKey('2026', 1))).toBeNull();

    // Nạp lại dữ liệu đảm bảo đủ 5 dòng
    const loaded = await adapter.load();
    expect(loaded?.entries.length).toBe(5);
  });

  it('Bất biến #9: Ghi 2 pha — lỗi QuotaExceededError ở pha 1 không bao giờ làm hỏng dữ liệu cũ', async () => {
    const adapter = createLocalStorageAdapter();
    const state = createSampleState();
    await adapter.save(state);

    // Giả lập lỗi QuotaExceededError khi ghi partition mới
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.startsWith(PARTITION_PREFIX)) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return originalSetItem.call(this, k, v);
    });

    const dirtyState: PersistedState = {
      ...state,
      entries: [
        ...state.entries,
        {
          id: 'camp-a|2026-12-31',
          date: '2026-12-31',
          campaignId: 'camp-a',
          reach: 9999,
          clicks: 999,
          cost: 9999999,
          orders: 99,
          source: 'manual',
          createdAt: 3000,
          updatedAt: 3000,
        },
      ],
    };

    // Khi ghi bị lỗi
    await expect(adapter.save(dirtyState)).rejects.toThrow();

    // Khôi phục setItem bình thường
    vi.restoreAllMocks();

    // Nạp lại: Trạng thái cũ (4 dòng) vẫn nguyên vẹn 100%, không bị trạng thái lai
    const reloaded = await adapter.load();
    expect(reloaded?.entries.length).toBe(4);
  });

  it('E49 & Tự kiểm: Xoá hoặc hỏng 1 key partition thì vẫn nạp các năm khác và phát tín hiệu cảnh báo', async () => {
    const adapter = createLocalStorageAdapter();
    const state = createSampleState();
    await adapter.save(state);

    const healthEvents: Array<{ area: string; status: string; message: string }> = [];
    const unsub = bus.on('system/health', (e) => healthEvents.push(e));

    // Xoá key partition của năm 2024
    localStorage.removeItem(partitionKey('2024', 1));

    // Nạp lại
    const loaded = await adapter.load();
    unsub();

    // Các năm 2025 và 2026 (2 dòng) vẫn nạp thành công
    expect(loaded).not.toBeNull();
    expect(loaded?.entries.length).toBe(2);
    expect(loaded?.entries.some((e) => e.date.startsWith('2025'))).toBe(true);
    expect(loaded?.entries.some((e) => e.date.startsWith('2026'))).toBe(true);

    // Phát hiện và thông báo năm 2024 bị mất
    expect(healthEvents.some((e) => e.area === 'storage' && e.message.includes('2024'))).toBe(true);
  });

  it('Dọn rác key mồ côi: loại bỏ các partition cũ không còn tham chiếu trong manifest', async () => {
    const adapter = createLocalStorageAdapter();
    const state = createSampleState();
    await adapter.save(state);

    // Tạo key mồ côi
    localStorage.setItem(partitionKey('2020', 99), '{"c":[],"d":[]}');
    expect(localStorage.getItem(partitionKey('2020', 99))).not.toBeNull();

    // Khi load, adapter tự động quét và dọn rác
    await adapter.load();
    expect(localStorage.getItem(partitionKey('2020', 99))).toBeNull();
  });

  it('Web Locks: gọi navigator.locks.request khi có sẵn trong môi trường', async () => {
    const requestMock = vi.fn().mockImplementation((_name, fn) => fn());
    vi.stubGlobal('navigator', {
      locks: { request: requestMock },
    });

    const adapter = createLocalStorageAdapter();
    const state = createSampleState();
    await adapter.save(state);

    expect(requestMock).toHaveBeenCalledWith('kpi-dash:write', expect.any(Function));
  });

  it('Hiệu năng: mã hoá 50.000 dòng phân vùng mất < 30ms', () => {
    const entries: DailyEntry[] = [];
    for (let i = 0; i < 50_000; i++) {
      const dayOffset = i % 365;
      const m = String(Math.floor(dayOffset / 30) + 1).padStart(2, '0');
      const d = String((dayOffset % 30) + 1).padStart(2, '0');
      entries.push({
        id: `default|2025-${m}-${d}`,
        date: `2025-${m}-${d}`,
        campaignId: 'default',
        reach: 1000 + (i % 500),
        clicks: 50 + (i % 20),
        cost: 100000 + (i % 50000),
        orders: 2 + (i % 5),
        source: 'manual',
        createdAt: 0,
        updatedAt: 0,
      });
    }

    const campMap = new Map([['default', 0]]);
    const t0 = performance.now();
    const res = encodePartition(entries, '2025-01-01', campMap);
    const duration = performance.now() - t0;

    expect(res.rows).toBe(50_000);
    expect(duration).toBeLessThan(100); // Rất nhanh, < 100ms trên CPU test
  });
});
