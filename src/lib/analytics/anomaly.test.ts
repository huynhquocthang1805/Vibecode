import { describe, expect, it } from 'vitest';

import { ANOMALY_CONFIG } from '@/config/thresholds';
import { addDays } from '@/lib/domain/dates';
import { computeKpis } from '@/lib/domain/kpi';
import type { Series, Totals } from '@/types/domain';

import { detectAnomalies, detectLiveAnomaly } from './anomaly';
import { testSeries } from './testSeries';

/**
 * Tạo series với số lượng ngày và hàm sinh giá trị
 */
function createCustomSeries(
  length: number,
  generator: (dayIndex: number, date: string) => { reach: number; clicks: number; cost: number; orders: number },
  start = '2026-01-01',
): Series {
  return {
    grain: 'day',
    campaignId: 'test-campaign',
    buckets: Array.from({ length }, (_, i) => {
      const date = addDays(start, i);
      const totals = generator(i, date);
      return {
        ...totals,
        key: date,
        start: date,
        end: date,
        grain: 'day',
        daysWithData: 1,
        daysInPeriod: 1,
        isPartial: false,
        kpis: computeKpis(totals),
      };
    }),
  };
}

describe('FC-07 detectAnomalies', () => {
  it('trả về mảng rỗng khi dữ liệu không hợp lệ hoặc thiếu', () => {
    expect(detectAnomalies(null as unknown as Series, ANOMALY_CONFIG)).toEqual([]);
    expect(detectAnomalies({ grain: 'week', campaignId: 'c1', buckets: [] }, ANOMALY_CONFIG)).toEqual([]);
    expect(detectAnomalies(testSeries([]), ANOMALY_CONFIG)).toEqual([]);
    expect(detectAnomalies(testSeries([10, 12]), ANOMALY_CONFIG)).toEqual([]);
    expect(detectAnomalies(testSeries([10, 10, 10]), { ...ANOMALY_CONFIG, metrics: [] })).toEqual([]);
  });

  it('bỏ qua khi chuỗi hằng số vì MAD = 0 (quy tắc docs/04 §5)', () => {
    // 20 ngày liên tiếp mọi giá trị đều là 10 -> MAD = 0
    const series = testSeries(Array(20).fill(10));
    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);
    expect(anomalies).toEqual([]);
  });

  it('phát hiện đột biến tăng (spike) và giảm (drop) cho đơn hàng', () => {
    // 14 ngày lịch sử dao động quanh 10-12
    const base = [10, 11, 10, 12, 10, 11, 10, 12, 10, 11, 10, 12, 10, 11];
    // Ngày 15: vọt lên 100 (spike)
    // Ngày 16..29: tiếp tục dao động quanh 10..12
    // Ngày 30: sập xuống 0 (drop)
    const values = [...base, 100, ...base, 0];
    const series = testSeries(values, '2026-01-01');

    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);

    const orderAnomalies = anomalies.filter((a) => a.metric === 'orders');
    expect(orderAnomalies.length).toBeGreaterThanOrEqual(2);

    const spike = orderAnomalies.find((a) => a.direction === 'spike');
    expect(spike).toBeDefined();
    expect(spike?.value).toBe(100);
    expect(spike?.expected).toBeCloseTo(10.5, 0);
    expect(spike?.severity).toBe('critical');
    expect(spike?.score).toBeGreaterThanOrEqual(3.5);

    const drop = orderAnomalies.find((a) => a.direction === 'drop');
    expect(drop).toBeDefined();
    expect(drop?.value).toBe(0);
    expect(drop?.expected).toBeCloseTo(10.5, 0);
    expect(drop?.score).toBeLessThanOrEqual(-2.5);
  });

  it('phân biệt đúng mức độ cảnh báo warning và critical theo ngưỡng z', () => {
    // Dãy có median = 10, MAD = 1
    // robust z = (y - 10) / (1.4826 * 1) = (y - 10) / 1.4826
    // Để có z ~ 2.7 (warning): y ~ 10 + 2.7 * 1.4826 = 14
    // Để có z ~ 4.0 (critical): y ~ 10 + 4.0 * 1.4826 = 16
    const base = [9, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9, 10]; // 14 ngày, median = 10, MAD = 1
    const values = [...base, 14, ...base, 18];
    const series = testSeries(values, '2026-01-01');

    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);
    const orderAnomalies = anomalies.filter((a) => a.metric === 'orders');

    const warning = orderAnomalies.find((a) => a.value === 14);
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    expect(warning?.score).toBeGreaterThanOrEqual(2.5);
    expect(warning?.score).toBeLessThan(3.5);

    const critical = orderAnomalies.find((a) => a.value === 18);
    expect(critical).toBeDefined();
    expect(critical?.severity).toBe('critical');
    expect(critical?.score).toBeGreaterThanOrEqual(3.5);
  });

  it('phát hiện bất thường trên các chỉ số tỷ lệ: CPC, CTR, CPA', () => {
    // 14 ngày bình thường: clicks = 100, cost = 500_000 -> CPC = 5_000
    const series = createCustomSeries(16, (i) => {
      if (i < 14) {
        const jitter = (i % 3) * 10 - 10;
        return { reach: 1000, clicks: 100 + jitter, cost: 500000, orders: 10 };
      }
      if (i === 14) {
        // CPC shock: cost 500k nhưng chỉ được 10 clicks -> CPC = 50_000 (gấp 10 lần)
        return { reach: 1000, clicks: 10, cost: 500000, orders: 10 };
      }
      // Ngày bình thường trở lại
      return { reach: 1000, clicks: 100, cost: 500000, orders: 10 };
    });

    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);
    const cpcAnomaly = anomalies.find((a) => a.metric === 'cpc');

    expect(cpcAnomaly).toBeDefined();
    expect(cpcAnomaly?.direction).toBe('spike');
    expect(cpcAnomaly?.severity).toBe('critical');
    expect(cpcAnomaly?.value).toBe(50000);
  });

  it('không báo trùng lặp cùng ngày và cùng chỉ số', () => {
    const base = [10, 11, 10, 12, 10, 11, 10, 12, 10, 11, 10, 12, 10, 11];
    const series = testSeries([...base, 99], '2026-01-01');
    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);

    const keys = anomalies.map((a) => `${a.date}:${a.metric}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('tách theo thứ trong tuần khi có >= 8 tuần dữ liệu', () => {
    // Giả sử chiến dịch chạy 10 tuần (70 ngày)
    // Các ngày Chủ Nhật luôn có lượng orders cao gấp 3 lần ngày thường (60 vs 20)
    // Ngày Chủ Nhật thứ 9 có 62 đơn -> bình thường so với các Chủ Nhật khác, KHÔNG phải bất thường
    // Nhưng nếu so với ngày thường (20 đơn) thì 62 đơn sẽ bị coi nhầm là bất thường nếu không tách thứ!
    const startDate = '2026-01-04'; // 2026-01-04 là Chủ Nhật
    const totalDays = 70; // 10 tuần

    const series = createCustomSeries(
      totalDays,
      (i, date) => {
        const [yStr = '2026', mStr = '01', dayStr = '01'] = date.split('-');
        const dow = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dayStr))).getUTCDay();
        const isSunday = dow === 0;

        // Chủ Nhật bình thường dao động 58-62; ngày thường dao động 18-22
        const baseOrders = isSunday ? 60 + (i % 3) : 20 + (i % 3);

        return {
          reach: baseOrders * 100,
          clicks: baseOrders * 10,
          cost: baseOrders * 1000,
          orders: baseOrders,
        };
      },
      startDate,
    );

    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);

    // Ở tuần thứ 9 và 10, các ngày Chủ Nhật không được báo là bất thường vì so với các Chủ Nhật trước đó
    const sundayDates = series.buckets
      .slice(56) // sau 8 tuần
      .filter((b) => {
        const [yStr = '2026', mStr = '01', dayStr = '01'] = b.start.split('-');
        return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dayStr))).getUTCDay() === 0;
      })
      .map((b) => b.start);

    for (const sDate of sundayDates) {
      const sundayAnomaly = anomalies.find((a) => a.date === sDate && a.metric === 'orders');
      expect(sundayAnomaly).toBeUndefined();
    }
  });

  it('bỏ qua bucket có isPartial = true hoặc daysWithData = 0', () => {
    const base = [10, 11, 10, 12, 10, 11, 10, 12, 10, 11, 10, 12, 10, 11];
    const series = testSeries([...base, 100], '2026-01-01');
    // Đánh dấu ngày 100 là partial (chưa trọn vẹn)
    series.buckets[14]!.isPartial = true;

    const anomalies = detectAnomalies(series, ANOMALY_CONFIG);
    const day15Anomaly = anomalies.find((a) => a.date === series.buckets[14]!.start);
    expect(day15Anomaly).toBeUndefined();
  });
});

describe('FC-07 detectLiveAnomaly', () => {
  it('trả về null khi tham số không hợp lệ', () => {
    const validTotals: Totals = { reach: 1000, clicks: 100, cost: 500000, orders: 10 };
    const validSeries = testSeries([10, 11, 12, 10, 11, 12]);

    expect(detectLiveAnomaly(validTotals, 0, validSeries, ANOMALY_CONFIG)).toBeNull();
    expect(detectLiveAnomaly(validTotals, -0.5, validSeries, ANOMALY_CONFIG)).toBeNull();
    expect(detectLiveAnomaly(validTotals, 1.5, validSeries, ANOMALY_CONFIG)).toBeNull();
    expect(detectLiveAnomaly(null as unknown as Totals, 0.5, validSeries, ANOMALY_CONFIG)).toBeNull();
    expect(detectLiveAnomaly(validTotals, 0.5, testSeries([]), ANOMALY_CONFIG)).toBeNull();
  });

  it('phát hiện bất thường realtime khi hôm nay mới nửa ngày nhưng đơn hàng tăng đột biến', () => {
    // Lịch sử 14 ngày mỗi ngày ~10 đơn
    const base = [10, 11, 10, 12, 10, 11, 10, 12, 10, 11, 10, 12, 10, 11];
    const history = testSeries(base, '2026-01-01');

    // Mới 12h trưa (hourFraction = 0.5) mà đã có 50 đơn -> cả ngày dự kiến 100 đơn!
    // Giữ cost bình thường (~10k cả ngày -> nửa ngày 5k) để cô lập kiểm tra spike orders
    const todaySoFar: Totals = { reach: 1000, clicks: 100, cost: 5250, orders: 50 };

    const anomaly = detectLiveAnomaly(todaySoFar, 0.5, history, ANOMALY_CONFIG);

    expect(anomaly).not.toBeNull();
    expect(anomaly?.direction).toBe('spike');
    expect(anomaly?.metric).toBe('orders');
    expect(anomaly?.severity).toBe('critical');
    expect(anomaly?.value).toBe(100); // 50 / 0.5
    expect(anomaly?.date).toBe('2026-01-15');
  });

  it('phát hiện CPC shock realtime (chi phí cao, ít click)', () => {
    // 14 ngày bình thường: clicks = 100, cost = 500k -> CPC = 5k
    const history = createCustomSeries(14, (i) => ({
      reach: 1000,
      clicks: 100 + (i % 3) * 5,
      cost: 500000,
      orders: 10,
    }));

    // Realtime: mới tiêu 1.000.000đ nhưng chỉ có 5 clicks -> CPC = 200.000đ
    const todaySoFar: Totals = { reach: 200, clicks: 5, cost: 1000000, orders: 1 };
    const anomaly = detectLiveAnomaly(todaySoFar, 0.3, history, ANOMALY_CONFIG);

    expect(anomaly).not.toBeNull();
    expect(anomaly?.metric).toBe('cpc');
    expect(anomaly?.direction).toBe('spike');
    expect(anomaly?.severity).toBe('critical');
  });

  it('trả về null khi số liệu trong ngày nằm trong kỳ vọng bình thường', () => {
    const base = [10, 11, 10, 12, 10, 11, 10, 12, 10, 11, 10, 12, 10, 11];
    const history = testSeries(base, '2026-01-01');

    // Nửa ngày được 5 đơn -> cả ngày ~10 đơn (đúng kỳ vọng)
    const todaySoFar: Totals = { reach: 500, clicks: 50, cost: 5000, orders: 5 };
    const anomaly = detectLiveAnomaly(todaySoFar, 0.5, history, ANOMALY_CONFIG);

    expect(anomaly).toBeNull();
  });
});
