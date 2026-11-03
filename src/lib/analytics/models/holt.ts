import { safeDiv } from '@/lib/domain/kpi';

import { assertInteger, assertObservations, assertSmoothing } from './modelMath';

/** phi: damped trend (1 = không giảm chấn; khuyến nghị 0.98) */
export function holt(
  y: number[],
  alpha: number,
  beta: number,
  h: number,
  phi: number = 1,
): { fitted: number[]; forecast: number[] } {
  assertObservations(y, 2);
  assertInteger(h);
  assertSmoothing(alpha, beta, phi);
  const { fitted, forecast } = runHolt(y, alpha, beta, h, phi);
  return { fitted, forecast };
}

/** Kernel dùng chung cho dự đoán và grid SSE; loss-only không tạo mảng fitted. */
export function runHolt(
  y: number[],
  alpha: number,
  beta: number,
  h: number,
  phi: number,
  lossFrom?: number,
  scale = 1,
  lossLimit = Infinity,
): { fitted: number[]; forecast: number[]; loss: number } {
  let level = y[0]!;
  let trend = y[1]! - level;
  const fitted = lossFrom === undefined ? [level] : [];
  let loss = 0;
  for (let t = 1; t < y.length; t++) {
    const prediction = level + phi * trend;
    if (lossFrom === undefined) fitted.push(Math.max(0, prediction));
    else if (t >= lossFrom) {
      const error = safeDiv(y[t]! - Math.max(0, prediction), scale) ?? 0;
      loss += error * error;
      if (loss >= lossLimit) return { fitted, forecast: [], loss };
    }
    const previousLevel = level;
    level = alpha * y[t]! + (1 - alpha) * prediction;
    trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
  }
  let dampedHorizon = 0;
  const forecast = Array.from({ length: h }, (_, index) => {
    dampedHorizon += Math.pow(phi, index + 1);
    return Math.max(0, level + dampedHorizon * trend);
  });
  return { fitted, forecast, loss };
}
