import { assertInteger, assertObservations, mean, residualSd } from './modelMath';

export interface ModelOutput {
  fitted: number[];
  forecast: number[];
  residualSd: number;
}

export function naive(y: number[], h: number): ModelOutput {
  assertObservations(y);
  assertInteger(h);
  const fitted = y.map((value, index) => (index === 0 ? value : y[index - 1]!));
  return { fitted, forecast: Array<number>(h).fill(y[y.length - 1]!), residualSd: residualSd(y, fitted, 1) };
}

export function seasonalNaive(y: number[], m: number, h: number): ModelOutput {
  assertInteger(m, 1);
  assertInteger(h);
  assertObservations(y, m);
  const fitted = y.map((value, index) => (index < m ? value : y[index - m]!));
  const forecast = Array.from({ length: h }, (_, index) => y[y.length - m + (index % m)]!);
  return { fitted, forecast, residualSd: residualSd(y, fitted, m) };
}

/** Dự báo nhiều bước giữ nguyên trung bình k quan sát cuối, không đưa dự báo vào cửa sổ. */
export function movingAverage(y: number[], k: number, h: number): ModelOutput {
  assertInteger(k, 1);
  assertInteger(h);
  assertObservations(y);
  const fitted = y.map((value, index) => (index === 0 ? value : mean(y.slice(Math.max(0, index - k), index))));
  return {
    fitted,
    forecast: Array<number>(h).fill(mean(y.slice(-k))),
    residualSd: residualSd(y, fitted, Math.min(k, y.length - 1)),
  };
}
