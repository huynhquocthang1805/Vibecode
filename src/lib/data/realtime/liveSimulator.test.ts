// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { startLiveSimulator } from '@/lib/data/realtime/liveSimulator';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import type { Anomaly } from '@/types/domain';

describe('DATA-08: Live Simulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDataStore.setState({
      entries: [
        {
          id: 'thoi-trang|2026-10-01',
          date: '2026-10-01',
          campaignId: 'thoi-trang',
          reach: 10000,
          clicks: 300,
          cost: 1500000,
          orders: 6,
          source: 'manual',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      campaigns: [{ id: 'thoi-trang', name: 'Thời trang', createdAt: 0 }],
      revision: 1,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sinh phần tăng cho ngày hôm nay và cộng dồn bằng policy sum (source: live)', () => {
    const stop = startLiveSimulator({
      speed: 10,
      campaignId: 'thoi-trang',
      seed: 42,
    });

    const today = todayVN();

    // Tiến hành 5 tick (mỗi tick 100ms ở speed 10)
    vi.advanceTimersByTime(500);

    const entries = useDataStore.getState().entries;
    const todayEntries = entries.filter((e) => e.campaignId === 'thoi-trang' && e.date === today);

    // Chỉ có đúng 1 entry cho ngày hôm nay (cộng dồn theo policy sum, không sinh nhiều dòng thừa)
    expect(todayEntries.length).toBe(1);
    const entry = todayEntries[0]!;
    expect(entry.source).toBe('live');
    expect(entry.reach).toBeGreaterThan(0);
    expect(entry.clicks).toBeGreaterThan(0);
    expect(entry.cost).toBeGreaterThan(0);
    expect(entry.clicks).toBeLessThanOrEqual(entry.reach);
    expect(entry.orders).toBeLessThanOrEqual(entry.clicks);

    stop();
  });

  it('dừng hoàn toàn khi gọi hàm trả về (không chạy thêm tick nào)', () => {
    const stop = startLiveSimulator({
      speed: 10,
      campaignId: 'thoi-trang',
      seed: 42,
    });

    vi.advanceTimersByTime(200);
    const today = todayVN();
    const entryAfter2Ticks = useDataStore
      .getState()
      .entries.find((e) => e.campaignId === 'thoi-trang' && e.date === today);
    const reachAtStop = entryAfter2Ticks?.reach ?? 0;

    stop();

    // Tiến thêm 1000ms nữa sau khi dừng
    vi.advanceTimersByTime(1000);

    const entryAfterWait = useDataStore
      .getState()
      .entries.find((e) => e.campaignId === 'thoi-trang' && e.date === today);
    expect(entryAfterWait?.reach).toBe(reachAtStop);
  });

  it('hoạt động ổn định ở tốc độ x60 (tick ~16ms) và đảm bảo các bất biến dữ liệu', () => {
    const stop = startLiveSimulator({
      speed: 60,
      campaignId: 'thoi-trang',
      seed: 999,
    });

    // 100 tick x 16ms = 1600ms
    vi.advanceTimersByTime(1600);

    const today = todayVN();
    const entry = useDataStore
      .getState()
      .entries.find((e) => e.campaignId === 'thoi-trang' && e.date === today);

    expect(entry).toBeDefined();
    if (entry) {
      expect(entry.reach).toBeGreaterThan(100);
      expect(entry.clicks).toBeLessThanOrEqual(entry.reach);
      expect(entry.orders).toBeLessThanOrEqual(entry.clicks);
      expect(entry.cost).toBeGreaterThan(0);
    }

    stop();
  });

  it('bơm cú sốc CPC đột biến và phát sự kiện anomaly/detected qua bus', () => {
    // Seed được chọn để kích hoạt isCpcShock
    const anomalies: Anomaly[] = [];
    const unlisten = bus.on('anomaly/detected', (e) => {
      anomalies.push(e.anomaly);
    });

    const stop = startLiveSimulator({
      speed: 60,
      campaignId: 'thoi-trang',
      seed: 777,
    });

    // Chạy đủ số tick để kích hoạt cú sốc CPC (~2% xác suất)
    vi.advanceTimersByTime(5000);

    expect(anomalies.length).toBeGreaterThan(0);
    const shock = anomalies[0]!;
    expect(shock.metric).toBe('cpc');
    expect(shock.severity).toBe('critical');
    expect(shock.direction).toBe('spike');
    expect(shock.value).toBeGreaterThan(shock.expected);

    unlisten();
    stop();
  });
});

