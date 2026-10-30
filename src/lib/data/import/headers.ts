import { notImplemented } from '@/lib/notImplemented';
import type { Totals } from '@/types/domain';

export type MappableField = keyof Totals | 'date' | 'campaign';

/** Bảng header docs/02 §6 — bỏ dấu tiếng Việt khi so khớp */
export function autoMapHeaders(_headers: string[]): Partial<Record<MappableField, string>> {
  return notImplemented('DATA-07');
}
