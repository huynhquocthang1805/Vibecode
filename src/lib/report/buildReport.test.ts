import { describe, expect, it, vi } from 'vitest';

import { addDays } from '@/lib/domain/dates';
import { computeKpis } from '@/lib/domain/kpi';
import type { Anomaly, Bucket, MetricForecast, Nowcast, ReportInput, Totals } from '@/types/domain';

import { buildReport } from './buildReport';
import * as templates from './templates';

function bucket(totals: Totals, start = '2026-11-01', end = '2026-11-30'): Bucket {
  return {
    ...totals,
    kpis: computeKpis(totals),
    key: start.slice(0, 7),
    grain: 'month',
    start,
    end,
    daysWithData: 5,
    daysInPeriod: 30,
    isPartial: true,
  };
}

function forecast(metric: MetricForecast['metric'], confidence: MetricForecast['confidence']): MetricForecast {
  return {
    metric,
    model: 'moving_avg',
    confidence,
    params: { k: 7 },
    horizonDays: 56,
    points: [{ date: '2026-11-06', mean: 6, lo80: 4, hi80: 8, lo95: 2, hi95: 10 }],
    backtest: { smape: 10, mae: 2, baselineSmape: 15 },
  };
}

function nowcast(grain: Nowcast['grain']): Nowcast {
  const projected =
    grain === 'month'
      ? { reach: 72000, clicks: 3600, cost: 7200000, orders: 180 }
      : { reach: 180000, clicks: 9000, cost: 18000000, orders: 450 };
  const interval = (mean: number) => ({ mean, lo80: mean * 0.8, hi80: mean * 1.2 });
  return {
    grain,
    periodKey: grain === 'month' ? '2026-11' : '2026-Q4',
    daysElapsed: 5,
    daysTotal: 30,
    actualToDate: { reach: 12000, clicks: 600, cost: 1200000, orders: 30 },
    projected: {
      reach: interval(projected.reach),
      clicks: interval(projected.clicks),
      cost: interval(projected.cost),
      orders: interval(projected.orders),
    },
    projectedKpis: computeKpis(projected),
  };
}

function input(format: ReportInput['format'] = 'full', ai = true, hasForecast = true): ReportInput {
  const current = bucket({ reach: 12000, clicks: 600, cost: 1200000, orders: 30 });
  const previous = bucket({ reach: 10000, clicks: 500, cost: 1000000, orders: 20 }, '2026-10-01', '2026-10-05');
  const daily = Array.from({ length: 5 }, (_, index): Bucket => {
    const day = addDays('2026-11-01', index);
    return {
      ...bucket({ reach: 2400, clicks: 120, cost: 240000, orders: 6 }, day, day),
      key: day,
      grain: 'day',
      daysWithData: 1,
      daysInPeriod: 1,
      isPartial: false,
    };
  });
  const suggestion = (title: string) => ({
    title,
    action: 'Thử trong 3 ngày',
    rationale: 'Dựa trên CPA',
    expectedImpact: 'Giảm chi phí mỗi đơn',
    priority: 'medium' as const,
    relatedMetrics: ['cpa' as const],
  });
  return {
    campaignName: 'Chiến dịch tháng 11',
    format,
    generatedAt: new Date('2026-11-05T02:30:00Z'),
    insight: ai
      ? {
          source: 'ai',
          model: 'gemini@v1',
          generatedAt: 1793845800000,
          overall: 'up',
          headline: 'Đơn tăng 50%, CPA giảm 20%',
          metricComments: [
            { metric: 'cpa', direction: 'down', changePct: -20, comment: 'CPA giảm, hiệu quả tốt hơn.' },
          ],
          forecastComment: null,
          suggestions: [suggestion('Thử mẫu quảng cáo'), suggestion('Rà trang đích'), suggestion('Theo dõi CPA')],
          riskFlags: [],
          corrected: false,
          warnings: [],
        }
      : null,
    snapshot: {
      computedAt: 1793845800000,
      revision: 1,
      checksum: { reach: 12000, clicks: 600, cost: 1200000, orders: 30, rows: 5 },
      dataSpan: { first: '2026-10-01', last: '2026-11-05' },
      forecastStatus: hasForecast ? 'ok' : 'insufficient',
      query: {
        campaignId: 'demo',
        grain: 'month',
        range: { from: '2026-11-01', to: '2026-11-05' },
        horizonDays: 56,
        today: '2026-11-05',
      },
      series: { campaignId: 'demo', grain: 'month', buckets: [current] },
      daily: { campaignId: 'demo', grain: 'day', buckets: daily },
      totals: { reach: 12000, clicks: 600, cost: 1200000, orders: 30, kpis: computeKpis(current) },
      trend: {
        grain: 'month',
        periods: 2,
        overall: 'up',
        metrics: [],
        dataQuality: { days: 35, missingDays: 0, sufficient: true },
        comparison: {
          current,
          previous,
          likeForLike: true,
          deltaPct: { reach: 20, clicks: 20, cost: 20, orders: 50, ctr: 0, cpc: 0, cpa: -20, cvr: 25 },
        },
      },
      forecasts: hasForecast ? [forecast('orders', 'medium'), forecast('cost', 'low')] : [],
      nowcasts: hasForecast ? [nowcast('month'), nowcast('quarter')] : [],
      anomalies: [],
      timings: {},
    },
  };
}

describe('AI-08 · snapshot từ template BA-04 thật', () => {
  it('ngắn: có AI và có dự báo', () => {
    expect(buildReport(input('short'))).toMatchInlineSnapshot(`
      "📊 BÁO CÁO QUẢNG CÁO — Chiến dịch tháng 11
      Kỳ: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ)

      • Reach: 12.000 (▲ 20,0%)
      • Click: 600 (▲ 20,0%) · CTR 5,00%
      • Chi phí: 1,2tr (▲ 20,0%) · CPC 2.000 ₫
      • Đơn hàng: 30 (▲ 50,0%) · CPA 40.000 ₫

      📈 Đơn tăng 50%, CPA giảm 20%
      🔮 Dự kiến cuối tháng 11/2026: ~180 đơn, chi phí ~7,2tr

      ✅ Đề xuất:
      1. Thử mẫu quảng cáo
      2. Rà trang đích
      3. Theo dõi CPA"
    `);
  });
  it('ngắn: có AI và không dự báo', () => {
    expect(buildReport(input('short', true, false))).toMatchInlineSnapshot(`
      "📊 BÁO CÁO QUẢNG CÁO — Chiến dịch tháng 11
      Kỳ: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ)

      • Reach: 12.000 (▲ 20,0%)
      • Click: 600 (▲ 20,0%) · CTR 5,00%
      • Chi phí: 1,2tr (▲ 20,0%) · CPC 2.000 ₫
      • Đơn hàng: 30 (▲ 50,0%) · CPA 40.000 ₫

      📈 Đơn tăng 50%, CPA giảm 20%

      ✅ Đề xuất:
      1. Thử mẫu quảng cáo
      2. Rà trang đích
      3. Theo dõi CPA"
    `);
  });
  it('ngắn: không AI và có dự báo', () => {
    expect(buildReport(input('short', false))).toMatchInlineSnapshot(`
      "📊 BÁO CÁO QUẢNG CÁO — Chiến dịch tháng 11
      Kỳ: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ)

      • Reach: 12.000 (▲ 20,0%)
      • Click: 600 (▲ 20,0%) · CTR 5,00%
      • Chi phí: 1,2tr (▲ 20,0%) · CPC 2.000 ₫
      • Đơn hàng: 30 (▲ 50,0%) · CPA 40.000 ₫

      🔮 Dự kiến cuối tháng 11/2026: ~180 đơn, chi phí ~7,2tr
      (Chưa chạy phân tích AI)"
    `);
  });
  it('ngắn: không AI và không dự báo', () => {
    expect(buildReport(input('short', false, false))).toMatchInlineSnapshot(`
      "📊 BÁO CÁO QUẢNG CÁO — Chiến dịch tháng 11
      Kỳ: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ)

      • Reach: 12.000 (▲ 20,0%)
      • Click: 600 (▲ 20,0%) · CTR 5,00%
      • Chi phí: 1,2tr (▲ 20,0%) · CPC 2.000 ₫
      • Đơn hàng: 30 (▲ 50,0%) · CPA 40.000 ₫

      (Chưa chạy phân tích AI)"
    `);
  });
  it('đầy đủ: có AI và có dự báo', () => {
    expect(buildReport(input())).toMatchInlineSnapshot(`
      "BÁO CÁO HIỆU QUẢ QUẢNG CÁO
      Chiến dịch: Chiến dịch tháng 11
      Kỳ báo cáo: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ) · So sánh với: 01/10/2026 – 05/10/2026

      1. TỔNG QUAN
         Reach ............ 12.000   (▲ 20,0%)
         Click ............ 600   (▲ 20,0%)
         Chi phí .......... 1.200.000 ₫   (▲ 20,0%)
         Đơn hàng ......... 30   (▲ 50,0%)

      2. CHỈ SỐ HIỆU QUẢ
         CTR (click/reach) ......... 5,00%   (0,0%)
         CPC (chi phí/click) ....... 2.000 ₫   (0,0%)
         CPA (chi phí/đơn hàng) .... 40.000 ₫   (▼ 20,0%)

      3. NHẬN XÉT XU HƯỚNG
         Đơn tăng 50%, CPA giảm 20%
         - CPA giảm, hiệu quả tốt hơn.

      4. DỰ BÁO
         Cuối tháng 11/2026: ~180 đơn (144–216), chi phí ~7.200.000 ₫, CPA dự kiến 40.000 ₫
         Cuối quý 4/2026: ~450 đơn, chi phí ~18.000.000 ₫
         (Mô hình trung bình trượt, độ tin cậy thấp)

      5. ĐỀ XUẤT HÀNH ĐỘNG
         1) Thử mẫu quảng cáo — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)
         2) Rà trang đích — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)
         3) Theo dõi CPA — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)

      —
      Tạo bởi KPI Mini Dashboard lúc 09:30 05/11/2026. Nhận xét do AI (gemini@v1) tạo, đã đối chiếu với số liệu."
    `);
  });
  it('đầy đủ: có AI và không dự báo', () => {
    expect(buildReport(input('full', true, false))).toMatchInlineSnapshot(`
      "BÁO CÁO HIỆU QUẢ QUẢNG CÁO
      Chiến dịch: Chiến dịch tháng 11
      Kỳ báo cáo: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ) · So sánh với: 01/10/2026 – 05/10/2026

      1. TỔNG QUAN
         Reach ............ 12.000   (▲ 20,0%)
         Click ............ 600   (▲ 20,0%)
         Chi phí .......... 1.200.000 ₫   (▲ 20,0%)
         Đơn hàng ......... 30   (▲ 50,0%)

      2. CHỈ SỐ HIỆU QUẢ
         CTR (click/reach) ......... 5,00%   (0,0%)
         CPC (chi phí/click) ....... 2.000 ₫   (0,0%)
         CPA (chi phí/đơn hàng) .... 40.000 ₫   (▼ 20,0%)

      3. NHẬN XÉT XU HƯỚNG
         Đơn tăng 50%, CPA giảm 20%
         - CPA giảm, hiệu quả tốt hơn.

      5. ĐỀ XUẤT HÀNH ĐỘNG
         1) Thử mẫu quảng cáo — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)
         2) Rà trang đích — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)
         3) Theo dõi CPA — Thử trong 3 ngày (Kỳ vọng: Giảm chi phí mỗi đơn)

      —
      Tạo bởi KPI Mini Dashboard lúc 09:30 05/11/2026. Nhận xét do AI (gemini@v1) tạo, đã đối chiếu với số liệu."
    `);
  });
  it('đầy đủ: không AI và có dự báo', () => {
    expect(buildReport(input('full', false))).toMatchInlineSnapshot(`
      "BÁO CÁO HIỆU QUẢ QUẢNG CÁO
      Chiến dịch: Chiến dịch tháng 11
      Kỳ báo cáo: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ) · So sánh với: 01/10/2026 – 05/10/2026

      1. TỔNG QUAN
         Reach ............ 12.000   (▲ 20,0%)
         Click ............ 600   (▲ 20,0%)
         Chi phí .......... 1.200.000 ₫   (▲ 20,0%)
         Đơn hàng ......... 30   (▲ 50,0%)

      2. CHỈ SỐ HIỆU QUẢ
         CTR (click/reach) ......... 5,00%   (0,0%)
         CPC (chi phí/click) ....... 2.000 ₫   (0,0%)
         CPA (chi phí/đơn hàng) .... 40.000 ₫   (▼ 20,0%)

      (Chưa chạy phân tích AI)

      4. DỰ BÁO
         Cuối tháng 11/2026: ~180 đơn (144–216), chi phí ~7.200.000 ₫, CPA dự kiến 40.000 ₫
         Cuối quý 4/2026: ~450 đơn, chi phí ~18.000.000 ₫
         (Mô hình trung bình trượt, độ tin cậy thấp)

      —
      Tạo bởi KPI Mini Dashboard lúc 09:30 05/11/2026."
    `);
  });
  it('đầy đủ: không AI và không dự báo', () => {
    expect(buildReport(input('full', false, false))).toMatchInlineSnapshot(`
      "BÁO CÁO HIỆU QUẢ QUẢNG CÁO
      Chiến dịch: Chiến dịch tháng 11
      Kỳ báo cáo: 01/11/2026 – 05/11/2026 (theo tháng, chưa hết kỳ) · So sánh với: 01/10/2026 – 05/10/2026

      1. TỔNG QUAN
         Reach ............ 12.000   (▲ 20,0%)
         Click ............ 600   (▲ 20,0%)
         Chi phí .......... 1.200.000 ₫   (▲ 20,0%)
         Đơn hàng ......... 30   (▲ 50,0%)

      2. CHỈ SỐ HIỆU QUẢ
         CTR (click/reach) ......... 5,00%   (0,0%)
         CPC (chi phí/click) ....... 2.000 ₫   (0,0%)
         CPA (chi phí/đơn hàng) .... 40.000 ₫   (▼ 20,0%)

      (Chưa chạy phân tích AI)

      —
      Tạo bởi KPI Mini Dashboard lúc 09:30 05/11/2026."
    `);
  });
});

describe('AI-08 · ca biên báo cáo', () => {
  it('điền đủ mọi khóa của BA-04, giữ nguyên đầu vào và kết quả xác định', () => {
    const source = input();
    const before = structuredClone(source);
    const fill = vi.spyOn(templates, 'fillTemplate');
    const result = buildReport(source);
    const values = fill.mock.calls[0]?.[1];
    for (const key of templates.templatePlaceholders(templates.TEMPLATES.full.body)) expect(values).toHaveProperty(key);
    expect(result).toBe(buildReport(source));
    expect(source).toEqual(before);
    expect(result).not.toMatch(/\{[#/\w]|undefined|NaN|Infinity|\n$/);
    expect(result).not.toMatch(/\n{3}|[ \t]+\n/);
  });

  it('E01: dữ liệu rỗng cho tổng 0 và tỷ số —, không tự tạo ngày hoặc dự báo', () => {
    const source = input('full', false, false);
    source.snapshot.query.range = undefined;
    source.snapshot.daily.buckets = [];
    source.snapshot.series.buckets = [];
    source.snapshot.dataSpan = { first: null, last: null };
    source.snapshot.trend = null;
    const totals = { reach: 0, clicks: 0, cost: 0, orders: 0 };
    source.snapshot.totals = { ...totals, kpis: computeKpis(totals) };
    const result = buildReport(source);
    expect(result).toContain('Kỳ báo cáo: — – —');
    expect(result).toContain('Reach ............ 0');
    expect(result).toContain('CTR (click/reach) ......... —');
    expect(result).not.toMatch(/NaN|Infinity|4\. DỰ BÁO/);
  });

  it('E03/E19: KPI là tỉ số của tổng; số đơn 0 cho CPA —', () => {
    const source = input();
    source.snapshot.totals = {
      reach: 10000,
      clicks: 190,
      cost: 380000,
      orders: 0,
      kpis: { ctr: 0.055, cpc: 999, cpa: 999, cvr: 0.01 },
    };
    const result = buildReport(source);
    expect(result).toContain('CTR (click/reach) ......... 1,90%');
    expect(result).toContain('CPC (chi phí/click) ....... 2.000 ₫');
    expect(result).toContain('CPA (chi phí/đơn hàng) .... —');
  });

  it('E23: kỳ trước có dữ liệu 0 cho mới; kỳ trước không có dữ liệu cho —', () => {
    const source = input();
    const comparison = source.snapshot.trend!.comparison!;
    comparison.previous = bucket({ reach: 0, clicks: 0, cost: 0, orders: 0 }, '2026-10-01', '2026-10-05');
    comparison.deltaPct = {
      reach: null,
      clicks: null,
      cost: null,
      orders: null,
      ctr: null,
      cpc: null,
      cpa: null,
      cvr: null,
    };
    expect(buildReport(source)).toContain('Reach ............ 12.000   (mới)');
    comparison.previous.daysWithData = 0;
    expect(buildReport(source)).toContain('Reach ............ 12.000   (—)');
    expect(buildReport(source)).not.toContain('(mới)');
  });

  it('CPC/CPA tăng vẫn dùng mũi tên lên và hiển thị đúng khoảng so sánh like-for-like', () => {
    const source = input();
    source.snapshot.trend!.comparison!.deltaPct.cpa = 12.3;
    expect(buildReport(source)).toContain('40.000 ₫   (▲ 12,3%)');
    expect(buildReport(source)).toContain('So sánh với: 01/10/2026 – 05/10/2026');
  });

  it('không gắn delta kỳ cuối vào tổng nhiều kỳ hoặc khoảng bị cắt', () => {
    const source = input();
    source.snapshot.query.range = { from: '2026-10-01', to: '2026-11-05' };
    expect(buildReport(source)).toContain('Reach ............ 12.000   (—)');
    expect(buildReport(source)).toContain('So sánh với: — – —');
    source.snapshot.query.range = { from: '2026-11-02', to: '2026-11-05' };
    expect(buildReport(source)).not.toContain('(▲ 20,0%)');
  });

  it('không có bộ lọc ngày thì lấy ngày thực của series ngày', () => {
    const source = input();
    source.snapshot.query.range = undefined;
    expect(buildReport(source)).toContain('Kỳ báo cáo: 01/11/2026 – 05/11/2026');
  });

  it('E11: thời điểm in báo cáo dùng giờ Việt Nam qua nửa đêm', () => {
    const source = input();
    source.generatedAt = new Date('2026-11-04T17:05:00Z');
    expect(buildReport(source)).toContain('00:05 05/11/2026');
  });

  it('giá trị không hữu hạn và ngày lỗi hiển thị —, không làm vỡ báo cáo', () => {
    const source = input();
    source.snapshot.totals.cost = Number.POSITIVE_INFINITY;
    source.generatedAt = new Date(Number.NaN);
    source.snapshot.query.range = { from: '2026-02-31', to: 'invalid' };
    const result = buildReport(source);
    expect(result).toContain('Kỳ báo cáo: — – —');
    expect(result).not.toMatch(/NaN|Infinity|Invalid Date/);
  });

  it('ghi nguồn quy tắc cho fallback, không nhận là AI thật', () => {
    const source = input();
    source.insight!.source = 'fallback';
    const result = buildReport(source);
    expect(result).toContain(templates.REPORT_COPY.aiSourceFallback);
    expect(result).not.toContain('Nhận xét do AI');
    expect(result).toContain('3) Theo dõi CPA');
  });

  it.each(['insufficient', 'stale', 'disabled'] as const)('ẩn nowcast lưu cũ khi trạng thái là %s', (status) => {
    const source = input();
    source.snapshot.forecastStatus = status;
    expect(buildReport(source)).not.toContain('4. DỰ BÁO');
  });

  it('không xuất nowcast sai tháng/quý; thiếu quý thì chỉ xuất tháng', () => {
    const source = input();
    source.snapshot.nowcasts[1]!.periodKey = '2026-Q3';
    const result = buildReport(source);
    expect(result).toContain('Cuối tháng 11/2026');
    expect(result).not.toContain('Cuối quý');
    source.snapshot.nowcasts[0]!.periodKey = '2026-10';
    expect(buildReport(source)).not.toContain('4. DỰ BÁO');
  });

  it('chỉ có quý thì mẫu đầy đủ vẫn xuất, mẫu ngắn không dựng tháng giả', () => {
    const source = input();
    source.snapshot.nowcasts = [nowcast('quarter')];
    expect(buildReport(source)).toContain('Cuối quý 4/2026');
    expect(buildReport(source)).not.toContain('Cuối tháng');
    source.format = 'short';
    expect(buildReport(source)).not.toContain('🔮');
  });

  it('dùng độ tin cậy thấp nhất orders/cost, tính CPA từ tổng dự kiến', () => {
    const source = input();
    source.snapshot.nowcasts[0]!.projectedKpis.cpa = 1;
    source.snapshot.forecasts.push(forecast('reach', 'high'));
    const result = buildReport(source);
    expect(result).toContain('CPA dự kiến 40.000 ₫');
    expect(result).toContain('độ tin cậy thấp');
  });

  it('chỉ xuất tối đa 3 cảnh báo trong kỳ, ưu tiên critical rồi ngày mới, không sửa mảng gốc', () => {
    const source = input();
    const anomaly = (date: string, severity: Anomaly['severity']): Anomaly => ({
      date,
      severity,
      metric: 'cpc',
      direction: 'spike',
      value: 9800,
      expected: 5900,
      score: 4,
    });
    source.snapshot.anomalies = [
      anomaly('2026-10-31', 'critical'),
      anomaly('2026-11-06', 'critical'),
      anomaly('2026-11-05', 'info'),
      anomaly('2026-11-01', 'critical'),
      anomaly('2026-11-04', 'warning'),
      anomaly('2026-11-03', 'warning'),
      anomaly('2026-11-05', 'warning'),
    ];
    const before = structuredClone(source.snapshot.anomalies);
    const result = buildReport(source);
    expect(result.match(/⚠/g)).toHaveLength(3);
    expect(result).toContain('⚠ 01/11: CPC cao bất thường (9.800 ₫ so với ~5.900 ₫)');
    expect(result).toContain('⚠ 05/11');
    expect(result).toContain('⚠ 04/11');
    expect(result).not.toMatch(/⚠ (31\/10|06\/11|03\/11)/);
    expect(source.snapshot.anomalies).toEqual(before);
  });

  it('E28: tên và nhận xét chứa cú pháp mẫu vẫn là dữ liệu thuần, không chèn mục mới', () => {
    const source = input();
    source.campaignName = '{reach} $& {#ai}\nTên khác';
    source.insight!.headline = '{s1.title} $&';
    const result = buildReport(source);
    expect(result).toContain('Chiến dịch: {reach} $& {#ai} Tên khác');
    expect(result).toContain('{s1.title} $&');
  });

  it('giới hạn 900 ký tự với emoji và câu dài, giữ số liệu cùng ba gợi ý', () => {
    const source = input('short');
    source.campaignName = '👩‍💻'.repeat(100);
    source.insight!.headline = 'Chiến dịch tốt 👩‍💻 '.repeat(300);
    for (const suggestion of source.insight!.suggestions) suggestion.title = 'Gợi ý 👩‍💻 '.repeat(300);
    const result = buildReport(source);
    expect(result.length).toBeLessThanOrEqual(900);
    expect(result).toContain('• Reach: 12.000 (▲ 20,0%)');
    expect(result).toContain('• Chi phí: 1,2tr');
    for (const index of [1, 2, 3]) expect(result).toMatch(new RegExp(`\\n${index}\\. .+`));
    expect(result).not.toContain('�');
    expect(result).not.toMatch(/\u200d…/u);
    expect(result.endsWith('\n')).toBe(false);
  });
});
