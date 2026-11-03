import { safeDiv } from '@/lib/domain/kpi';

import { assertInteger, assertObservations, assertSmoothing, mean } from './modelMath';

/** Additive, m = 7 (mùa vụ tuần) — docs/04 §3 */
export function holtWinters(
  y: number[],
  m: number,
  alpha: number,
  beta: number,
  gamma: number,
  h: number,
  phi: number = 1,
): { fitted: number[]; forecast: number[] } {
  assertInteger(m, 2);
  assertInteger(h);
  assertObservations(y, 2 * m);
  assertSmoothing(alpha, beta, gamma, phi);
  const { fitted, forecast } = runHoltWinters(y, m, alpha, beta, gamma, h, phi);
  return { fitted, forecast };
}

/** Kernel loss-only dừng sớm khi SSE đã vượt ứng viên tốt nhất; không đổi lưới tham số. */
export function runHoltWinters(
  y: number[],
  m: number,
  alpha: number,
  beta: number,
  gamma: number,
  h: number,
  phi: number,
  lossFrom?: number,
  scale = 1,
  lossLimit = Infinity,
): { fitted: number[]; forecast: number[]; loss: number } {
  let level = mean(y.slice(0, m));
  let trend = safeDiv(mean(y.slice(m, 2 * m)) - level, m) ?? 0;
  const seasons = y.slice(0, m).map((value) => value - level);
  const fitted: number[] = [];
  let loss = 0;
  for (let t = 0; t < y.length; t++) {
    const season = seasons[t % m]!;
    const previousLevel = level;
    const prediction = Math.max(0, level + phi * trend + season);
    if (lossFrom === undefined) fitted.push(prediction);
    else if (t >= lossFrom) {
      const error = safeDiv(y[t]! - prediction, scale) ?? 0;
      loss += error * error;
      if (loss >= lossLimit) return { fitted, forecast: [], loss };
    }
    level = alpha * (y[t]! - season) + (1 - alpha) * (previousLevel + phi * trend);
    trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
    seasons[t % m] = gamma * (y[t]! - level) + (1 - gamma) * season;
  }
  let dampedHorizon = 0;
  const forecast = Array.from({ length: h }, (_, index) => {
    dampedHorizon += Math.pow(phi, index + 1);
    return Math.max(0, level + dampedHorizon * trend + seasons[(y.length + index) % m]!);
  });
  return { fitted, forecast, loss };
}
