// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import {
  CROSS_TAB_CHANNEL_NAME,
  CROSS_TAB_STORAGE_KEY,
  startCrossTabSync,
} from '@/lib/data/realtime/crossTab';
import { useDataStore } from '@/lib/data/store';
import type { DailyEntry, DomainEvent, EntryDelta } from '@/types/domain';

// Giả lập hệ thống BroadcastChannel nội bộ để test kết nối nhiều tab
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    let set = MockBroadcastChannel.channels.get(name);
    if (!set) {
      set = new Set();
      MockBroadcastChannel.channels.set(name, set);
    }
    set.add(this);
  }

  postMessage(data: unknown): void {
    const set = MockBroadcastChannel.channels.get(this.name);
    if (!set) return;
    for (const ch of set) {
      if (ch !== this && ch.onmessage) {
        ch.onmessage(new MessageEvent('message', { data }));
      }
    }
  }

  close(): void {
    const set = MockBroadcastChannel.channels.get(this.name);
    if (set) {
      set.delete(this);
    }
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

describe('DATA-08: CrossTab Sync (BroadcastChannel & Storage fallback)', () => {
  const originalBC = (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    localStorage.clear();
    useDataStore.setState({
      entries: [],
      campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 0 }],
      revision: 1,
    });
  });

  afterEach(() => {
    (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = originalBC;
  });

  it('gửi delta qua BroadcastChannel khi có thay đổi nội bộ (origin local)', () => {
    (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = MockBroadcastChannel;

    const stopSync = startCrossTabSync();
    const otherChannel = new MockBroadcastChannel(CROSS_TAB_CHANNEL_NAME);
    const messages: unknown[] = [];
    otherChannel.onmessage = (ev) => {
      messages.push(ev.data);
    };

    const newEntry: DailyEntry = {
      id: 'default|2026-11-01',
      date: '2026-11-01',
      campaignId: 'default',
      reach: 1000,
      clicks: 50,
      cost: 200000,
      orders: 2,
      source: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    bus.emit({
      type: 'entries/changed',
      delta: { added: [newEntry], removed: [] },
      origin: 'local',
      revision: 2,
    });

    expect(messages.length).toBe(1);
    const msg = messages[0] as { tabId: string; delta: EntryDelta; revision: number };
    expect(msg.revision).toBe(2);
    expect(msg.delta.added[0]?.id).toBe('default|2026-11-01');

    stopSync();
    otherChannel.close();
  });

  it('nhận delta từ tab khác, áp dụng với origin remote và không phát lại (chống lặp vô hạn)', () => {
    (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = MockBroadcastChannel;

    const stopSync = startCrossTabSync();
    const remoteSender = new MockBroadcastChannel(CROSS_TAB_CHANNEL_NAME);

    const receivedEvents: Extract<DomainEvent, { type: 'entries/changed' }>[] = [];
    const unlisten = bus.on('entries/changed', (e) => {
      receivedEvents.push(e);
    });

    const remoteEntry: DailyEntry = {
      id: 'default|2026-11-02',
      date: '2026-11-02',
      campaignId: 'default',
      reach: 5000,
      clicks: 250,
      cost: 1000000,
      orders: 10,
      source: 'csv',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Gửi từ tab khác với tabId khác
    remoteSender.postMessage({
      tabId: 'other-tab-123',
      delta: { added: [remoteEntry], removed: [] },
      revision: 5,
      timestamp: Date.now(),
    });

    // Kiểm tra store đã cập nhật dữ liệu
    const state = useDataStore.getState();
    expect(state.entries.some((e) => e.id === 'default|2026-11-02')).toBe(true);
    expect(state.revision).toBeGreaterThanOrEqual(5);

    // Sự kiện nội bộ được phát với origin: 'remote'
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]?.origin).toBe('remote');

    // Chống lặp: Kiểm tra remoteSender KHÔNG nhận lại chính tin nhắn đó phản xạ về
    const echoMessages: unknown[] = [];
    remoteSender.onmessage = (ev) => {
      echoMessages.push(ev.data);
    };

    // Trigger một event remote trong bus xem startCrossTabSync có bỏ qua không
    bus.emit({
      type: 'entries/changed',
      delta: { added: [remoteEntry], removed: [] },
      origin: 'remote',
      revision: 6,
    });
    expect(echoMessages.length).toBe(0);

    unlisten();
    stopSync();
    remoteSender.close();
  });

  it('bỏ qua tin nhắn do chính tab mình phát ra (dựa vào tabId)', () => {
    (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = MockBroadcastChannel;

    const stopSync = startCrossTabSync();
    const otherChannel = new MockBroadcastChannel(CROSS_TAB_CHANNEL_NAME);

    let myTabId = '';
    otherChannel.onmessage = (ev) => {
      myTabId = (ev.data as { tabId: string }).tabId;
    };

    bus.emit({
      type: 'entries/changed',
      delta: { added: [], removed: [] },
      origin: 'local',
      revision: 2,
    });

    expect(myTabId).toBeTruthy();

    const initialEntriesCount = useDataStore.getState().entries.length;

    // Giả lập kênh dội lại chính tin nhắn của tab này
    const selfMessageChannel = new MockBroadcastChannel(CROSS_TAB_CHANNEL_NAME);
    const fakeEntry: DailyEntry = {
      id: 'default|2026-11-03',
      date: '2026-11-03',
      campaignId: 'default',
      reach: 100,
      clicks: 5,
      cost: 10000,
      orders: 0,
      source: 'manual',
      createdAt: 0,
      updatedAt: 0,
    };
    selfMessageChannel.postMessage({
      tabId: myTabId,
      delta: { added: [fakeEntry], removed: [] },
      revision: 10,
    });

    // Store không được phép nhận fakeEntry này vì tabId trùng
    expect(useDataStore.getState().entries.length).toBe(initialEntriesCount);

    stopSync();
    otherChannel.close();
    selfMessageChannel.close();
  });

  it('fallback sang sự kiện storage khi không có BroadcastChannel', () => {
    delete (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;

    const stopSync = startCrossTabSync();

    const remoteEntry: DailyEntry = {
      id: 'default|2026-11-04',
      date: '2026-11-04',
      campaignId: 'default',
      reach: 3000,
      clicks: 150,
      cost: 500000,
      orders: 6,
      source: 'csv',
      createdAt: 0,
      updatedAt: 0,
    };

    // Bắn sự kiện storage từ cửa sổ khác
    const storageEvent = new StorageEvent('storage', {
      key: CROSS_TAB_STORAGE_KEY,
      newValue: JSON.stringify({
        tabId: 'remote-tab-fallback',
        delta: { added: [remoteEntry], removed: [] },
        revision: 4,
        timestamp: Date.now(),
      }),
    });
    window.dispatchEvent(storageEvent);

    expect(useDataStore.getState().entries.some((e) => e.id === 'default|2026-11-04')).toBe(true);

    stopSync();
  });

  it('huỷ đăng ký hoàn toàn khi gọi hàm trả về', () => {
    (window as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = MockBroadcastChannel;

    const stopSync = startCrossTabSync();
    const otherChannel = new MockBroadcastChannel(CROSS_TAB_CHANNEL_NAME);
    const messages: unknown[] = [];
    otherChannel.onmessage = (ev) => {
      messages.push(ev.data);
    };

    stopSync();

    bus.emit({
      type: 'entries/changed',
      delta: { added: [], removed: [] },
      origin: 'local',
      revision: 3,
    });

    expect(messages.length).toBe(0);
    otherChannel.close();
  });
});
