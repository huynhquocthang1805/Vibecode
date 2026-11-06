import { describe, expect, it } from 'vitest';

import { weekendCpaRatio } from '@/config/ruleSuggestions';
import { validateEntry } from '@/lib/domain/validation';
import type { EntryInput } from '@/types/domain';

import { buildScenario, SAMPLE_SCENARIOS, scenarioCsv } from './scenarios';

const TODAY = '2026-11-06';
const sum = (rows: EntryInput[], k: 'reach' | 'clicks' | 'cost' | 'orders') => rows.reduce((a, r) => a + r[k], 0);
const cpa = (rows: EntryInput[]) => sum(rows, 'cost') / sum(rows, 'orders');
const ctr = (rows: EntryInput[]) => sum(rows, 'clicks') / sum(rows, 'reach');

describe('DATA-12 · bộ dữ liệu test theo tình huống', () => {
  it('id không trùng; mỗi tình huống có tiêu đề, mô tả, kỳ vọng', () => {
    const ids = SAMPLE_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SAMPLE_SCENARIOS) {
      expect(s.title && s.summary && s.expect, s.id).toBeTruthy();
      expect(s.campaigns.length).toBeGreaterThan(0);
    }
  });

  for (const s of SAMPLE_SCENARIOS.filter((x) => x.id !== 'errors' && x.id !== 'big-50k')) {
    it(`${s.id}: mọi dòng qua validateEntry, kết thúc hôm qua, không trùng ngày/chiến dịch, đúng số dòng`, () => {
      const rows = buildScenario(s.id, TODAY);
      expect(rows).toHaveLength(s.approxRows);
      const keys = new Set<string>();
      for (const r of rows) {
        const v = validateEntry(r, { today: TODAY });
        expect(v.ok, `${r.date} ${JSON.stringify(v.issues)}`).toBe(true);
        keys.add(`${r.campaignId}|${r.date}`);
        expect(r.clicks).toBeLessThanOrEqual(r.reach);
        expect(r.orders).toBeLessThanOrEqual(r.clicks);
      }
      expect(keys.size).toBe(rows.length);
      expect(rows.map((r) => r.date).sort().at(-1)).toBe('2026-11-05');
      for (const c of new Set(rows.map((r) => r.campaignId))) expect(s.campaigns.map((x) => x.id)).toContain(c);
    });
  }

  it('deterministic theo seed; ngày dịch theo hôm nay', () => {
    expect(buildScenario('growth', TODAY)).toEqual(buildScenario('growth', TODAY));
    expect(buildScenario('growth', '2026-12-01').at(-1)!.date).toBe('2026-11-30');
  });

  it('dữ liệu đúng câu chuyện: tăng trưởng · CPA vọt · CTR giảm · cuối tuần · flash sale', () => {
    const g = buildScenario('growth', TODAY);
    expect(sum(g.slice(-14), 'orders')).toBeGreaterThan(sum(g.slice(0, 14), 'orders') * 1.3);
    expect(cpa(g.slice(-14))).toBeLessThan(cpa(g.slice(0, 14)));

    const c = buildScenario('cpa-spike', TODAY);
    expect(cpa(c.slice(-10))).toBeGreaterThan(cpa(c.slice(0, 35)) * 1.6);

    const f = buildScenario('ctr-fatigue', TODAY);
    expect(ctr(f.slice(-7))).toBeLessThan(ctr(f.slice(0, 7)) * 0.7);

    const w = buildScenario('weekend', TODAY);
    const ratio = weekendCpaRatio({ grain: 'day', recent: w.map((r) => ({ ...r, key: r.date, isPartial: false, kpis: { ctr: null, cpc: null, cpa: null, cvr: null } })) } as never);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(0.8); // đủ để kích hoạt gợi ý "Dồn ngân sách T7–CN"

    const s = buildScenario('flash-sale', TODAY);
    const median = [...s].map((r) => r.cost).sort((a, b) => a - b)[20]!;
    expect(s.filter((r) => r.cost > median * 2.2)).toHaveLength(2);
  });

  it('big-50k đúng 50.000 dòng, 25 chiến dịch', () => {
    const rows = buildScenario('big-50k', TODAY);
    expect(rows).toHaveLength(50_000);
    expect(new Set(rows.map((r) => r.campaignId)).size).toBe(25);
  });

  it('CSV: BOM + tiêu đề tiếng Việt (khớp autoMapHeaders), tiền dạng 1.234.000, tên chiến dịch thay id', () => {
    const csv = scenarioCsv('multi-2y', TODAY);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Ngày,Chiến dịch,Lượt tiếp cận,Lượt click,Chi phí,Đơn hàng');
    expect(lines).toHaveLength(2191);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2},(Facebook Ads|Google Search|TikTok Ads),\d+,\d+,\d{1,3}(\.\d{3})*,\d+$/);
  });

  it('CSV lỗi: 20 dòng, có cả dòng hợp lệ định dạng Việt và các kiểu lỗi validate bắt được', () => {
    const lines = scenarioCsv('errors', TODAY).slice(1).trim().split('\r\n').slice(1);
    expect(lines).toHaveLength(20);
    const results = lines.map((l) => {
      const [date, campaign, reach, clicks, cost, orders] = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ''));
      return validateEntry({ date, campaignId: campaign || 'default', reach, clicks, cost, orders }, { today: TODAY });
    });
    const ok = results.filter((r) => r.ok).length;
    expect(ok).toBeGreaterThanOrEqual(7); // các dòng 1.500.000 ₫, dd/mm/yyyy, VND, đ, 0 đơn… được nhận
    expect(results.length - ok).toBeGreaterThanOrEqual(8); // click>reach, âm, trống, ngày sai, tương lai, chữ…
  });
});
