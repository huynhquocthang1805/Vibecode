// Owner: forecast-engineer — FC-10 (techlead làm thay Thắng 2, 2026-11-06). docs/13 §5 "Dự báo bền vững".
// Pure: chuẩn bị chuỗi quan sát TRƯỚC khi fit. Dữ liệu gốc không đổi (anomaly vẫn thấy giá trị thật).
import { daysBetween } from '@/lib/domain/dates';
import type { ISODate } from '@/types/domain';

export const ROBUST_CONFIG = {
  /** Khoảng trống dài hơn → chỉ fit đoạn sau khoảng trống cuối */
  longGapDays: 28,
  /** Kẹp giá trị khi fit vào median ± k·MAD (một ngày gõ nhầm không làm dự báo "bay") */
  winsorK: 5,
} as const;

export interface RobustSeries {
  values: number[];
  dates: ISODate[];
  /** Số điểm đã kẹp (winsorize) */
  clipped: number;
  /** Đã bỏ phần trước khoảng trống dài cuối cùng */
  cutAtGap: boolean;
  /** Số ngày 0 ở đầu chuỗi đã bỏ (chiến dịch chưa chạy) */
  leadingZeros: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Bỏ các ngày 0 ở đầu (docs/13 §5 "Ngày đầu tiên có dữ liệu → cắt bỏ phần 0 phía trước") */
export function trimLeadingZeros(values: number[], dates: ISODate[]): { values: number[]; dates: ISODate[]; removed: number } {
  let i = 0;
  while (i < values.length && values[i] === 0) i++;
  if (i === values.length) return { values, dates, removed: 0 }; // toàn 0 → giữ nguyên (dự báo hằng 0)
  return { values: values.slice(i), dates: dates.slice(i), removed: i };
}

/** Chỉ giữ đoạn sau khoảng trống > longGapDays cuối cùng (ngày quan sát liên tiếp cách nhau quá xa) */
export function sliceAfterLongGap(
  values: number[],
  dates: ISODate[],
  longGapDays: number = ROBUST_CONFIG.longGapDays,
): { values: number[]; dates: ISODate[]; cut: boolean } {
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1]!, dates[i]!) - 1 > longGapDays) {
      return { values: values.slice(i), dates: dates.slice(i), cut: true };
    }
  }
  return { values, dates, cut: false };
}

/** Kẹp vào [median − k·MAD, median + k·MAD], không âm. MAD = 0 (chuỗi gần hằng) → không kẹp. */
export function winsorize(values: number[], k: number = ROBUST_CONFIG.winsorK): { values: number[]; clipped: number } {
  if (values.length < 3) return { values, clipped: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  if (!(mad > 0) || !Number.isFinite(mad)) return { values, clipped: 0 };
  const lo = Math.max(0, med - k * mad);
  const hi = med + k * mad;
  let clipped = 0;
  const out = values.map((v) => {
    if (v > hi) {
      clipped++;
      return hi;
    }
    if (v < lo) {
      clipped++;
      return lo;
    }
    return v;
  });
  return { values: out, clipped };
}

/** Thứ tự docs/13 §5: bỏ 0 đầu chuỗi → cắt sau khoảng trống dài → winsorize */
export function robustSeries(values: number[], dates: ISODate[]): RobustSeries {
  const trimmed = trimLeadingZeros(values, dates);
  const sliced = sliceAfterLongGap(trimmed.values, trimmed.dates);
  const w = winsorize(sliced.values);
  return { values: w.values, dates: sliced.dates, clipped: w.clipped, cutAtGap: sliced.cut, leadingZeros: trimmed.removed };
}
