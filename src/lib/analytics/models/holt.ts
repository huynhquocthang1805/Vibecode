import { notImplemented } from '@/lib/notImplemented';

/** phi: damped trend (1 = không giảm chấn; khuyến nghị 0.98) */
export function holt(
  _y: number[],
  _alpha: number,
  _beta: number,
  _h: number,
  _phi: number = 1,
): { fitted: number[]; forecast: number[] } {
  return notImplemented('FC-03');
}
