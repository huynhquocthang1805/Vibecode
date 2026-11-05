// Owner: ai-engineer (Hoàng Anh) — FC-07. Pure, không I/O.
import { addDays } from '@/lib/domain/dates';
import { safeDiv } from '@/lib/domain/kpi';
import type {
  Anomaly,
  AnomalyConfig,
  Bucket,
  ISODate,
  Metric,
  Series,
  Totals,
} from '@/types/domain';

/**
 * Tính trung vị (median) của một mảng số.
 * Mảng phải được sắp xếp tăng dần trước khi truyền vào.
 */
function calculateMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Tính MAD (Median Absolute Deviation): median(|x_i - median|).
 */
function calculateMad(sorted: number[], median: number): number {
  if (sorted.length === 0) return 0;
  const deviations = sorted.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  return calculateMedian(deviations);
}

/**
 * Lấy thứ trong tuần (0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy) từ ISODate.
 */
function getDayOfWeek(d: ISODate): number {
  const [yStr = '2026', mStr = '01', dayStr = '01'] = d.split('-');
  return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dayStr))).getUTCDay();
}

/**
 * Lấy giá trị của chỉ số từ Bucket (tự tính KPI nếu bucket chưa có sẵn).
 */
function getMetricValueFromBucket(b: Bucket, m: Metric): number | null {
  switch (m) {
    case 'reach':
      return Number.isFinite(b.reach) ? b.reach : null;
    case 'clicks':
      return Number.isFinite(b.clicks) ? b.clicks : null;
    case 'cost':
      return Number.isFinite(b.cost) ? b.cost : null;
    case 'orders':
      return Number.isFinite(b.orders) ? b.orders : null;
    case 'ctr':
      return b.kpis?.ctr !== undefined ? b.kpis.ctr : safeDiv(b.clicks, b.reach);
    case 'cpc':
      return b.kpis?.cpc !== undefined ? b.kpis.cpc : safeDiv(b.cost, b.clicks);
    case 'cpa':
      return b.kpis?.cpa !== undefined ? b.kpis.cpa : safeDiv(b.cost, b.orders);
    case 'cvr':
      return b.kpis?.cvr !== undefined ? b.kpis.cvr : safeDiv(b.orders, b.clicks);
    default:
      return null;
  }
}

/**
 * Lấy giá trị của chỉ số từ Totals cho live mode (đã quy đổi theo hourFraction).
 */
function getMetricValueFromTotals(t: Totals, m: Metric, hourFraction: number): number | null {
  if (hourFraction <= 0 || !Number.isFinite(hourFraction)) return null;

  switch (m) {
    case 'reach':
      return Number.isFinite(t.reach) ? t.reach / hourFraction : null;
    case 'clicks':
      return Number.isFinite(t.clicks) ? t.clicks / hourFraction : null;
    case 'cost':
      return Number.isFinite(t.cost) ? t.cost / hourFraction : null;
    case 'orders':
      return Number.isFinite(t.orders) ? t.orders / hourFraction : null;
    case 'ctr':
      return safeDiv(t.clicks, t.reach);
    case 'cpc':
      return safeDiv(t.cost, t.clicks);
    case 'cpa':
      return safeDiv(t.cost, t.orders);
    case 'cvr':
      return safeDiv(t.orders, t.clicks);
    default:
      return null;
  }
}

/**
 * Phát hiện bất thường theo lô từ chuỗi theo ngày (docs/04 §5):
 * - Theo ngày: robust z = (y - median_14) / (1.4826 * MAD_14)
 * - Cửa sổ 14 ngày trước ngày xét (không gồm chính nó)
 * - Tách theo thứ trong tuần nếu lịch sử >= 8 tuần dữ liệu (minWeeksForWeekday)
 * - Ngưỡng: |z| >= 2.5 -> warning, |z| >= 3.5 -> critical
 * - MAD = 0 -> bỏ qua
 * - Không báo trùng cùng ngày - chỉ số
 */
export function detectAnomalies(daily: Series, cfg: AnomalyConfig): Anomaly[] {
  if (
    !daily ||
    daily.grain !== 'day' ||
    !Array.isArray(daily.buckets) ||
    daily.buckets.length === 0 ||
    !cfg ||
    !Array.isArray(cfg.metrics) ||
    cfg.metrics.length === 0
  ) {
    return [];
  }

  // Sắp xếp các bucket theo ngày tăng dần
  const sortedBuckets = [...daily.buckets]
    .filter((b) => b && (b.start || b.key))
    .sort((a, b) => (a.start || a.key).localeCompare(b.start || b.key));

  const windowSize = cfg.windowDays ?? 14;
  const warnZ = cfg.warnZ ?? 2.5;
  const criticalZ = cfg.criticalZ ?? 3.5;
  const minWeeks = cfg.minWeeksForWeekday ?? 8;

  const anomalies: Anomaly[] = [];

  for (let i = 0; i < sortedBuckets.length; i++) {
    const current = sortedBuckets[i]!;
    // Không đánh giá ngày chưa trọn vẹn hoặc không có dữ liệu
    if (current.isPartial || current.daysWithData === 0) {
      continue;
    }

    const currentDate = (current.start || current.key) as ISODate;

    // Lọc các ngày đã hoàn thành trước ngày đang xét
    const priorBuckets = sortedBuckets.slice(0, i).filter((p) => {
      const pDate = p.start || p.key;
      return !p.isPartial && p.daysWithData > 0 && pDate < currentDate;
    });

    if (priorBuckets.length < 3) {
      continue;
    }

    const currentDow = getDayOfWeek(currentDate);
    const sameWeekdayPrior = priorBuckets.filter((p) => getDayOfWeek((p.start || p.key) as ISODate) === currentDow);

    // Tách theo thứ trong tuần nếu có đủ >= minWeeks tuần
    let windowBuckets: Bucket[];
    if (sameWeekdayPrior.length >= minWeeks) {
      windowBuckets = sameWeekdayPrior.slice(-windowSize);
    } else {
      windowBuckets = priorBuckets.slice(-windowSize);
    }

    if (windowBuckets.length < 3) {
      continue;
    }

    for (const metric of cfg.metrics) {
      const y = getMetricValueFromBucket(current, metric);
      if (y === null || !Number.isFinite(y) || y < 0) {
        continue;
      }

      const windowValues = windowBuckets
        .map((wb) => getMetricValueFromBucket(wb, metric))
        .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);

      if (windowValues.length < 3) {
        continue;
      }

      const sortedValues = [...windowValues].sort((a, b) => a - b);
      const median = calculateMedian(sortedValues);
      const mad = calculateMad(sortedValues, median);

      // Quy tắc docs/04 §5: MAD = 0 -> bỏ qua
      if (mad === 0) {
        continue;
      }

      // Robust z-score
      const score = (y - median) / (1.4826 * mad);
      const absZ = Math.abs(score);

      if (absZ < warnZ) {
        continue;
      }

      const severity: 'warning' | 'critical' = absZ >= criticalZ ? 'critical' : 'warning';
      const direction: 'spike' | 'drop' = score > 0 ? 'spike' : 'drop';

      anomalies.push({
        date: currentDate,
        metric,
        value: y,
        expected: median,
        score,
        direction,
        severity,
      });
    }
  }

  return anomalies;
}

/**
 * Phát hiện bất thường thời gian thực (live mode):
 * - So sánh todaySoFar / hourFraction với kỳ vọng cả ngày từ phân phối lịch sử
 * - |z| >= warnZ -> Anomaly
 * - Trả về bất thường nghiêm trọng nhất nếu có nhiều chỉ số vượt ngưỡng, hoặc null
 */
export function detectLiveAnomaly(
  todaySoFar: Totals,
  hourFraction: number,
  history: Series,
  cfg: AnomalyConfig,
): Anomaly | null {
  if (
    !todaySoFar ||
    hourFraction <= 0 ||
    hourFraction > 1 ||
    !Number.isFinite(hourFraction) ||
    !history ||
    !Array.isArray(history.buckets) ||
    history.buckets.length === 0 ||
    !cfg ||
    !Array.isArray(cfg.metrics) ||
    cfg.metrics.length === 0
  ) {
    return null;
  }

  const sortedBuckets = [...history.buckets]
    .filter((b) => b && (b.start || b.key))
    .sort((a, b) => (a.start || a.key).localeCompare(b.start || b.key));

  if (sortedBuckets.length === 0) {
    return null;
  }

  const lastBucket = sortedBuckets[sortedBuckets.length - 1]!;
  const todayDate = (
    lastBucket.isPartial ? (lastBucket.start || lastBucket.key) : addDays((lastBucket.start || lastBucket.key) as ISODate, 1)
  ) as ISODate;

  // Baseline chỉ lấy các ngày đã hoàn thành trước todayDate
  const priorBuckets = sortedBuckets.filter((p) => {
    const pDate = p.start || p.key;
    return !p.isPartial && p.daysWithData > 0 && pDate < todayDate;
  });

  if (priorBuckets.length < 3) {
    return null;
  }

  const currentDow = getDayOfWeek(todayDate);
  const sameWeekdayPrior = priorBuckets.filter((p) => getDayOfWeek((p.start || p.key) as ISODate) === currentDow);

  const windowSize = cfg.windowDays ?? 14;
  const warnZ = cfg.warnZ ?? 2.5;
  const criticalZ = cfg.criticalZ ?? 3.5;
  const minWeeks = cfg.minWeeksForWeekday ?? 8;

  let windowBuckets: Bucket[];
  if (sameWeekdayPrior.length >= minWeeks) {
    windowBuckets = sameWeekdayPrior.slice(-windowSize);
  } else {
    windowBuckets = priorBuckets.slice(-windowSize);
  }

  if (windowBuckets.length < 3) {
    return null;
  }

  const candidates: Anomaly[] = [];

  for (const metric of cfg.metrics) {
    const y = getMetricValueFromTotals(todaySoFar, metric, hourFraction);
    if (y === null || !Number.isFinite(y) || y < 0) {
      continue;
    }

    const windowValues = windowBuckets
      .map((wb) => getMetricValueFromBucket(wb, metric))
      .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);

    if (windowValues.length < 3) {
      continue;
    }

    const sortedValues = [...windowValues].sort((a, b) => a - b);
    const median = calculateMedian(sortedValues);
    const mad = calculateMad(sortedValues, median);

    if (mad === 0) {
      continue;
    }

    const score = (y - median) / (1.4826 * mad);
    const absZ = Math.abs(score);

    if (absZ < warnZ) {
      continue;
    }

    const severity: 'warning' | 'critical' = absZ >= criticalZ ? 'critical' : 'warning';
    const direction: 'spike' | 'drop' = score > 0 ? 'spike' : 'drop';

    candidates.push({
      date: todayDate,
      metric,
      value: y,
      expected: median,
      score,
      direction,
      severity,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Ưu tiên: critical trước warning, sau đó score tuyệt đối lớn nhất
  candidates.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return Math.abs(b.score) - Math.abs(a.score);
  });

  return candidates[0]!;
}
