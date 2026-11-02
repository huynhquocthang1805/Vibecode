import type { DomainEvent } from '@/types/domain';

type Handler<T extends DomainEvent['type']> = (e: Extract<DomainEvent, { type: T }>) => void;

// Map lưu trữ listener cho từng event type
const listeners = new Map<DomainEvent['type'], Set<(e: unknown) => void>>();

/** Typed event bus dùng chung cho hệ thống domain events */
export const bus: {
  emit(e: DomainEvent): void;
  on<T extends DomainEvent['type']>(t: T, fn: Handler<T>): () => void;
} = {
  emit(e: DomainEvent): void {
    const set = listeners.get(e.type);
    if (set) {
      for (const fn of set) {
        try {
          fn(e);
        } catch {
          // Tránh để listener ném lỗi làm đứt luồng emit
        }
      }
    }
  },
  on<T extends DomainEvent['type']>(t: T, fn: Handler<T>): () => void {
    let set = listeners.get(t);
    if (!set) {
      set = new Set();
      listeners.set(t, set);
    }
    const handler = fn as (e: unknown) => void;
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  },
};
