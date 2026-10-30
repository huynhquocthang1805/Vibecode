import { notImplemented } from '@/lib/notImplemented';
import type { ForecastModel } from '@/types/domain';

export function fitBest(
  _y: number[],
  _m: number,
): { model: ForecastModel; params: Record<string, number>; residualSd: number } {
  return notImplemented('FC-04');
}
