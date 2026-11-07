// Owner: forecast-engineer — FC-10 (techlead làm thay Thắng 2, 2026-11-06). docs/13 §5 "Dự báo bền vững".
// Pure: chuẩn bị chuỗi quan sát TRƯỚC khi fit. Dữ liệu gốc không đổi (anomaly vẫn thấy giá trị thật).
import { addDays, daysBetween } from '@/lib/domain/dates';
import type { ISODate } from '@/types/domain';

export const ROBUST_CONFIG = {
  /** Khoảng trống dài hơn → chỉ fit đoạn sau khoảng trống cuối */
  longGapDays: 28,
  /** Kẹp ngày vượt tham chiếu + k·MAD phần dư (một ngày gõ nhầm không làm dự báo "bay") */
  winsorK: 5,
  /** Số tuần trước dùng làm tham chiếu cùng thứ */
  refWeeks: 4,
  /** Ngưỡng tối thiểu: vượt tham chiếu ít nhất 125% (tức > 2,25×) mới coi là nhầm — flash sale ×3 vẫn bị kẹp khi fit */
  minRelativeJump: 1.25,
  /** Ngưỡng tối thiểu tuyệt đối (đơn ít: 0–2/ngày không bị kẹp) */
  minAbsoluteJump: 5,
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

/**
 * Kẹp ngày "gõ nhầm" khi fit. Review FC-10 (vai Thắng 2, 2026-11-07): bản đầu kẹp quanh MỘT median của cả chuỗi
 * → cắt cả ngày cuối tuần thật (kịch bản cuối tuần: 12/42 ngày) và 3 ngày mới nhất của chiến dịch đang tăng ×20.
 * Nay: tham chiếu = median các ngày CÙNG THỨ trong 4 tuần TRƯỚC (giữ mùa vụ tuần, nhân quả → áp được cả ngày mới nhất);
 * chỉ kẹp phía trên khi vượt tham chiếu + max(k·MAD phần dư, 125% tham chiếu, 5 đơn vị) và là đỉnh ĐƠN LẺ (ngày kề không
 * vượt — gõ nhầm là 1 ngày; Tết/sale nhiều ngày là thật — thiếu điều kiện này fixture campaign-2y bị kẹp 13 ngày,
 * dự báo đơn rơi khỏi Holt-Winters). Ngày giảm/0 giữ nguyên
 * (có thể là thật: tạm dừng chiến dịch). Ít hơn 2 ngày cùng thứ trước đó (2 tuần đầu) → median các ngày cùng thứ khác
 * trong chuỗi; vẫn < 2 → median cả chuỗi.
 */
export function winsorize(
  values: number[],
  dates: ISODate[],
  k: number = ROBUST_CONFIG.winsorK,
): { values: number[]; clipped: number } {
  if (values.length < 3 || values.length !== dates.length) return { values, clipped: 0 };
  const byDate = new Map<ISODate, number>();
  for (let i = 0; i < dates.length; i++) byDate.set(dates[i]!, values[i]!);
  const globalMedian = median([...values].sort((a, b) => a - b));
  // Nhóm theo thứ (vị trí theo daysBetween → không phụ thuộc múi giờ máy)
  const dow = dates.map((d) => ((daysBetween(dates[0]!, d) % 7) + 7) % 7);
  const refs = dates.map((d, i) => {
    const prior: number[] = [];
    for (let w = 1; w <= ROBUST_CONFIG.refWeeks; w++) {
      const v = byDate.get(addDays(d, -7 * w));
      if (v !== undefined) prior.push(v);
    }
    if (prior.length >= 2) return median(prior.sort((a, b) => a - b));
    // Đầu chuỗi (chưa đủ 2 tuần trước): median các ngày cùng thứ khác trong chuỗi, rồi mới tới median cả chuỗi
    const same: number[] = [];
    for (let j = 0; j < values.length; j++) if (j !== i && dow[j] === dow[i]) same.push(values[j]!);
    return same.length >= 2 ? median(same.sort((a, b) => a - b)) : globalMedian;
  });
  const residuals = values.map((v, i) => Math.abs(v - refs[i]!)).sort((a, b) => a - b);
  const mad = median(residuals);
  if (!Number.isFinite(mad)) return { values, clipped: 0 };
  const his = refs.map(
    (ref) => ref + Math.max(k * mad, ROBUST_CONFIG.minRelativeJump * Math.abs(ref), ROBUST_CONFIG.minAbsoluteJump),
  );
  const over = values.map((v, i) => v > his[i]!);
  let clipped = 0;
  const out = values.map((v, i) => {
    // Chỉ kẹp đỉnh ĐƠN LẺ: ngày kề cũng vượt ngưỡng → đợt thật (Tết, sale nhiều ngày), giữ nguyên
    if (over[i] && !over[i - 1] && !over[i + 1]) {
      clipped++;
      return his[i]!;
    }
    return v;
  });
  return { values: out, clipped };
}

/** Thứ tự docs/13 §5: bỏ 0 đầu chuỗi → cắt sau khoảng trống dài → winsorize */
export function robustSeries(values: number[], dates: ISODate[]): RobustSeries {
  const trimmed = trimLeadingZeros(values, dates);
  const sliced = sliceAfterLongGap(trimmed.values, trimmed.dates);
  const w = winsorize(sliced.values, sliced.dates);
  return { values: w.values, dates: sliced.dates, clipped: w.clipped, cutAtGap: sliced.cut, leadingZeros: trimmed.removed };
}
