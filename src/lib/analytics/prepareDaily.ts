import { addDays, daysBetween, parseISODate } from '@/lib/domain/dates';
import { LIMITS, type ISODate } from '@/types/domain';

import { assertObservations } from './models/modelMath';

/** Ngày thiếu được giữ mask riêng: không chấm backtest trên giá trị nội suy. */
export function prepareDaily(
  values: number[],
  dates: ISODate[],
): { values: number[]; observed: boolean[]; dates: ISODate[] } {
  if (values.length !== dates.length) throw new RangeError('FORECAST_MISMATCHED_DATES');
  if (values.length === 0) return { values: [], observed: [], dates: [] };
  assertObservations(values);
  for (let i = 0; i < dates.length; i++) {
    if (parseISODate(dates[i]!) !== dates[i] || (i > 0 && dates[i]! <= dates[i - 1]!))
      throw new RangeError('FORECAST_INVALID_DATES');
  }
  const end = dates[dates.length - 1]!;
  const cutoff = addDays(end, 1 - LIMITS.FORECAST_WINDOW_DAYS);
  const start = dates[0]! > cutoff ? dates[0]! : cutoff;
  const length = daysBetween(start, end) + 1;
  const dense = Array<number>(length).fill(0);
  const observed = Array<boolean>(length).fill(false);
  for (let i = 0; i < dates.length; i++) {
    if (dates[i]! < start) continue;
    const index = daysBetween(start, dates[i]!);
    dense[index] = values[i]!;
    observed[index] = true;
  }
  return { values: dense, observed, dates: Array.from({ length }, (_, i) => addDays(start, i)) };
}
