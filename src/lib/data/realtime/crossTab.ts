import { applyRemoteDelta } from '@/lib/data/store';
import type { EntryDelta } from '@/types/domain';

import { bus } from './bus';

export const CROSS_TAB_CHANNEL_NAME = 'kpi-dash';
export const CROSS_TAB_STORAGE_KEY = 'kpi-dash:sync';

export interface CrossTabMessage {
  tabId: string;
  delta: EntryDelta;
  revision: number;
  timestamp: number;
}

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/**
 * Đồng bộ hai chiều giữa các tab trình duyệt qua BroadcastChannel ('kpi-dash').
 * Fallback sang sự kiện 'storage' khi trình duyệt không hỗ trợ BroadcastChannel.
 * Trả về hàm hủy đăng ký/dọn dẹp.
 */
export function startCrossTabSync(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const tabId = generateTabId();
  let channel: BroadcastChannel | null = null;

  const handleIncomingMessage = (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as Partial<CrossTabMessage>;
    if (msg.tabId === tabId) {
      // Bỏ qua tin nhắn do chính tab này phát
      return;
    }
    if (!msg.delta || !Array.isArray(msg.delta.added) || !Array.isArray(msg.delta.removed)) {
      return;
    }

    applyRemoteDelta(msg.delta, msg.revision);
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CROSS_TAB_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<CrossTabMessage>) => {
        handleIncomingMessage(event.data);
      };
    } catch {
      channel = null;
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== CROSS_TAB_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      handleIncomingMessage(parsed);
    } catch {
      // Bỏ qua nếu dữ liệu storage không phải JSON hợp lệ
    }
  };

  if (!channel) {
    window.addEventListener('storage', handleStorage);
  }

  // Lắng nghe sự kiện thay đổi dữ liệu từ bus nội bộ
  const unlistenBus = bus.on('entries/changed', (e) => {
    // Chống vòng lặp vô hạn: KHÔNG phát lại các delta có nguồn gốc remote
    if (e.origin === 'remote') {
      return;
    }

    const payload: CrossTabMessage = {
      tabId,
      delta: e.delta,
      revision: e.revision,
      timestamp: Date.now(),
    };

    if (channel) {
      try {
        channel.postMessage(payload);
      } catch {
        // Channel có thể đã bị đóng
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CROSS_TAB_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Bỏ qua lỗi quota hoặc storage bị chặn
      }
    }
  });

  return () => {
    unlistenBus();
    if (channel) {
      channel.onmessage = null;
      channel.close();
      channel = null;
    }
    window.removeEventListener('storage', handleStorage);
  };
}
