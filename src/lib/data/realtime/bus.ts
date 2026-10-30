import { notImplemented } from '@/lib/notImplemented';
import type { DomainEvent } from '@/types/domain';

type Handler<T extends DomainEvent['type']> = (e: Extract<DomainEvent, { type: T }>) => void;

/** Typed event bus. DATA-04 (store) cần emit sớm → làm phần này trước DATA-08. */
export const bus: {
  emit(e: DomainEvent): void;
  on<T extends DomainEvent['type']>(t: T, fn: Handler<T>): () => void;
} = {
  emit: () => notImplemented('DATA-08'),
  on: () => notImplemented('DATA-08'),
};
