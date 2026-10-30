import { notImplemented } from '@/lib/notImplemented';
import type { PersistedState } from '@/types/domain';

/** Codec cột (docs/02 §2, docs/13 §2) — không lưu id/createdAt/updatedAt */
export function encodeState(_s: PersistedState): string {
  return notImplemented('DATA-03');
}

/** Ném lỗi có mã (VD 'CORRUPT_MANIFEST') nếu hỏng */
export function decodeState(_raw: string): PersistedState {
  return notImplemented('DATA-03');
}
