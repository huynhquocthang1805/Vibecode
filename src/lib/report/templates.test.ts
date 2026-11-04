import { describe, expect, it } from 'vitest';

import { fillTemplate, REPORT_COPY, TEMPLATES, templatePlaceholders, type ReportSection } from './templates';

/** Giá trị mẫu (đã định dạng) — buildReport sẽ tính thật */
const V: Record<string, string> = {
  campaignName: 'Demo đơn hàng',
  from: '01/10/2026',
  to: '31/10/2026',
  grainLabel: 'theo ngày',
  partialNote: '',
  prevFrom: '01/09/2026',
  prevTo: '30/09/2026',
  reach: '125.400',
  reachDelta: '▲ 12,3%',
  clicks: '3.200',
  clicksDelta: '▲ 4,0%',
  ctr: '2,55%',
  ctrDelta: '▼ 7,4%',
  cost: '18.500.000 ₫',
  costShort: '18,5tr',
  costDelta: '▲ 9,0%',
  cpc: '5.781 ₫',
  cpcDelta: '▲ 4,8%',
  orders: '92',
  ordersDelta: '▼ 3,0%',
  cpa: '201.087 ₫',
  cpaDelta: '▲ 12,4%',
  aiHeadline: 'CPA tăng 12,4% trong khi đơn giảm nhẹ',
  metricCommentLines: '   - CPA tăng 12,4%: chi phí mỗi đơn đang xấu đi.\n   - CTR giảm 7,4%: mẫu quảng cáo bắt đầu nhàm.',
  monthLabel: 'tháng 11',
  quarterLabel: 'quý 4',
  projOrders: '96',
  projOrdersLo: '80',
  projOrdersHi: '112',
  projCost: '19.000.000 ₫',
  projCostShort: '19tr',
  projCpa: '197.917 ₫',
  projQOrders: '280',
  projQCost: '55.000.000 ₫',
  modelLabel: 'Holt-Winters (xu hướng + mùa vụ tuần)',
  confidenceLabel: 'trung bình',
  's1.title': 'Kiểm tra luồng thanh toán',
  's1.action': 'Trong 3 ngày rà trang đích và giỏ hàng',
  's1.expectedImpact': 'CPA về dưới 190.000 ₫',
  's2.title': 'Thay 2 mẫu quảng cáo',
  's2.action': 'Thay 2 mẫu có CTR thấp nhất',
  's2.expectedImpact': 'CTR về lại 2,7%',
  's3.title': 'Giảm chi nhóm kém',
  's3.action': 'Giảm 20% ngân sách nhóm có CPA cao nhất',
  's3.expectedImpact': 'Tiết kiệm ~1,5tr/tuần',
  alertsSection: '⚠ 27/10: CPC cao bất thường (9.800 ₫ so với ~5.900 ₫)',
  generatedAt: '09:30 04/11/2026',
  aiSourceNote: REPORT_COPY.aiSourceReal('gemini@v1.2'),
};

const CASES: Array<{ name: string; s: Partial<Record<ReportSection, boolean>> }> = [
  { name: 'có AI + có dự báo', s: { ai: true, forecast: true, alerts: true } },
  { name: 'có AI, không dự báo', s: { ai: true } },
  { name: 'không AI, có dự báo', s: { noAi: true, forecast: true } },
  { name: 'không AI, không dự báo', s: { noAi: true } },
];

describe('BA-04 · TEMPLATES', () => {
  it('đúng id/label; mẫu ngắn giới hạn 900 ký tự; không còn TODO', () => {
    expect(TEMPLATES.short.id).toBe('short');
    expect(TEMPLATES.full.id).toBe('full');
    expect(TEMPLATES.short.maxChars).toBe(900);
    for (const t of Object.values(TEMPLATES)) expect(t.body).not.toMatch(/TODO/);
  });

  it('có đủ placeholder theo docs/07 (số liệu, delta, AI, dự báo, 3 gợi ý)', () => {
    const short = templatePlaceholders(TEMPLATES.short.body);
    for (const k of ['campaignName', 'reach', 'ctr', 'cpc', 'cpa', 'ordersDelta', 'aiHeadline', 'projOrders', 's3.title'])
      expect(short, k).toContain(k);
    const full = templatePlaceholders(TEMPLATES.full.body);
    for (const k of ['prevFrom', 'ctrDelta', 'cpaDelta', 'projOrdersLo', 'modelLabel', 's1.expectedImpact', 'aiSourceNote'])
      expect(full, k).toContain(k);
  });

  it('mẫu ngắn đủ AI + dự báo ra đúng từng dòng như docs/07', () => {
    expect(fillTemplate(TEMPLATES.short.body, V, { ai: true, forecast: true })).toBe(
      [
        '📊 BÁO CÁO QUẢNG CÁO — Demo đơn hàng',
        'Kỳ: 01/10/2026 – 31/10/2026 (theo ngày)',
        '',
        '• Reach: 125.400 (▲ 12,3%)',
        '• Click: 3.200 (▲ 4,0%) · CTR 2,55%',
        '• Chi phí: 18,5tr (▲ 9,0%) · CPC 5.781 ₫',
        '• Đơn hàng: 92 (▼ 3,0%) · CPA 201.087 ₫',
        '',
        '📈 CPA tăng 12,4% trong khi đơn giảm nhẹ',
        '🔮 Dự kiến cuối tháng 11: ~96 đơn, chi phí ~19tr',
        '',
        '✅ Đề xuất:',
        '1. Kiểm tra luồng thanh toán',
        '2. Thay 2 mẫu quảng cáo',
        '3. Giảm chi nhóm kém',
      ].join('\n'),
    );
  });

  for (const { name, s } of CASES) {
    it(`2 mẫu × ${name}: không sót placeholder/marker, không dòng trống đôi, không xuống dòng cuối`, () => {
      for (const t of Object.values(TEMPLATES)) {
        const out = fillTemplate(t.body, V, s);
        expect(out).not.toMatch(/\{[#/]?[\w.]+\}/);
        expect(out).not.toMatch(/undefined|null|NaN/);
        expect(out).not.toMatch(/\n\n\n/);
        expect(out).not.toMatch(/\s$/);
        expect(out).toMatch(/BÁO CÁO/);
        if (t.maxChars) expect(out.length).toBeLessThanOrEqual(t.maxChars);
        // docs/07: không AI → bỏ mục nhận xét + đề xuất, thêm dòng "(Chưa chạy phân tích AI)"
        expect(out.includes('(Chưa chạy phân tích AI)')).toBe(!s.ai);
        expect(out.includes('Kiểm tra luồng thanh toán')).toBe(!!s.ai);
        // không dự báo (< 7 ngày) → bỏ mục dự báo
        expect(out.includes('~96 đơn')).toBe(!!s.forecast);
      }
    });
  }

  it('mẫu đầy đủ: đánh số mục, 3 đề xuất có kỳ vọng, ghi chú nguồn AI ở cuối', () => {
    const out = fillTemplate(TEMPLATES.full.body, V, { ai: true, forecast: true, alerts: true });
    for (const h of ['1. TỔNG QUAN', '2. CHỈ SỐ HIỆU QUẢ', '3. NHẬN XÉT XU HƯỚNG', '4. DỰ BÁO', '5. ĐỀ XUẤT HÀNH ĐỘNG'])
      expect(out).toContain(h);
    expect(out).toContain('   - CTR giảm 7,4%');
    expect(out).toContain('3) Giảm chi nhóm kém — Giảm 20% ngân sách nhóm có CPA cao nhất (Kỳ vọng: Tiết kiệm ~1,5tr/tuần)');
    expect(out).toContain('⚠ 27/10: CPC cao bất thường');
    expect(out.endsWith('Nhận xét do AI (gemini@v1.2) tạo, đã đối chiếu với số liệu.')).toBe(true);
  });
});

describe('BA-04 · fillTemplate', () => {
  it('thiếu giá trị → "—", không in "{x}"', () => {
    expect(fillTemplate('CPA {cpa} · {s1.title}', {})).toBe('CPA — · —');
  });

  it('khối trong dòng giữ/bỏ theo cờ; khối nhiều dòng bỏ cả dòng marker', () => {
    expect(fillTemplate('A{#ai} · B{/ai}', {}, { ai: true })).toBe('A · B');
    expect(fillTemplate('A{#ai} · B{/ai}', {})).toBe('A');
    expect(fillTemplate('A\n{#ai}\nX\n{/ai}\nB', {}, { ai: true })).toBe('A\nX\nB');
    expect(fillTemplate('A\n{#ai}\nX\n{/ai}\nB', {})).toBe('A\nB');
  });

  it('giá trị chứa "{...}" hoặc "$&" không bị hiểu là cú pháp (tên chiến dịch do người dùng nhập)', () => {
    expect(fillTemplate('{campaignName}', { campaignName: 'KM {#ai}$& {reach}' })).toBe('KM {#ai}$& {reach}');
  });

  it('deterministic, không sửa input', () => {
    const vals = Object.freeze({ ...V });
    const a = fillTemplate(TEMPLATES.full.body, vals, { ai: true });
    expect(fillTemplate(TEMPLATES.full.body, vals, { ai: true })).toBe(a);
  });

  it('alertLine đúng mẫu docs/07', () => {
    expect(REPORT_COPY.alertLine('27/10', 'CPC', true, '9.800 ₫', '5.900 ₫')).toBe(
      '⚠ 27/10: CPC cao bất thường (9.800 ₫ so với ~5.900 ₫)',
    );
  });
});
