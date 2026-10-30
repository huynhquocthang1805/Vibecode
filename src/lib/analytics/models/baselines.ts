import { notImplemented } from '@/lib/notImplemented';

export interface ModelOutput {
  fitted: number[];
  forecast: number[];
  residualSd: number;
}

export function naive(_y: number[], _h: number): ModelOutput {
  return notImplemented('FC-02');
}

export function seasonalNaive(_y: number[], _m: number, _h: number): ModelOutput {
  return notImplemented('FC-02');
}

export function movingAverage(_y: number[], _k: number, _h: number): ModelOutput {
  return notImplemented('FC-02');
}
