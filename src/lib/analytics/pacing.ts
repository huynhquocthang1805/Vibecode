// Owner: ai-engineer (Hoàng Anh) — FC-08. Pure, không I/O.
import { notImplemented } from '@/lib/notImplemented';
import type { Nowcast, Totals } from '@/types/domain';

/** % dự kiến đạt so với mục tiêu (100 = đạt đúng). nowcast() gọi hàm này khi có target. */
export function computePacing(
  _projected: Nowcast['projected'],
  _target: Partial<Totals>,
): NonNullable<Nowcast['pacing']> {
  return notImplemented('FC-08');
}
