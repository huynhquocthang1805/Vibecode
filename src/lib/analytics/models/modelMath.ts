import { safeDiv } from '@/lib/domain/kpi';

/** Các model nhận quan sát đã chuẩn hóa; không âm, không thiếu, không vô hạn. */
export function assertObservations(y: number[], minimum = 1): void {
  if (y.length < minimum || y.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('FORECAST_INVALID_OBSERVATIONS');
  }
}

export function assertInteger(value: number, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError('FORECAST_INVALID_INTEGER');
  }
}

export function assertSmoothing(...values: number[]): void {
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError('FORECAST_INVALID_SMOOTHING');
  }
}

export function mean(values: number[]): number {
  // Chia trước khi cộng để tránh tràn tổng đối với dãy giá trị hữu hạn lớn.
  return values.reduce((sum, value) => sum + (safeDiv(value, values.length) ?? 0), 0);
}

/** SD mẫu của phần dư; bỏ giai đoạn khởi tạo chưa có dự đoán one-step. */
export function residualSd(y: number[], fitted: number[], warmup: number): number {
  const residuals = y.slice(warmup).map((value, index) => value - fitted[index + warmup]!);
  if (residuals.length < 2) return 0;
  const average = mean(residuals);
  const scale = Math.max(...residuals.map((value) => Math.abs(value - average)));
  if (scale === 0) return 0;
  const squares = residuals.reduce((sum, value) => {
    const normalized = safeDiv(value - average, scale) ?? 0;
    return sum + normalized * normalized;
  }, 0);
  return scale * Math.sqrt(safeDiv(squares, residuals.length - 1) ?? 0);
}
