import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { addDays, daysBetween } from '@/lib/domain/dates';
import { LIMITS } from '@/types/domain';
import type { DailyEntry } from '@/types/domain';

import {
  auditDataset,
  DEFAULT_SEED,
  demoEvidence,
  eventFactors,
  generate,
  main,
  mulberry32,
  summarize,
} from '../../scripts/gen-mock';

// Không mock DATA-01/02; stub phải xuất hiện là lỗi thật, không biến thành pass/skip.
const fixed = { seed: DEFAULT_SEED, today: '2026-11-01', endDate: '2026-10-31' };
const demo = () => generate(30, { ...fixed, profile: 'demo' });
const long = () => generate(2190, { ...fixed, profile: 'campaign' });
const sample: DailyEntry = {
  id: 'default|2026-10-01',
  date: '2026-10-01',
  campaignId: 'default',
  reach: 10000,
  clicks: 200,
  cost: 600000,
  orders: 6,
  source: 'mock',
  createdAt: 0,
  updatedAt: 0,
};
// Schema test độc lập cho envelope JSON; auditDataset gọi validation nghiệp vụ thật.
const rowSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    campaignId: z.string(),
    source: z.literal('mock'),
    createdAt: z.literal(0),
    updatedAt: z.literal(0),
    reach: z.number().int().min(0).max(LIMITS.MAX_VALUE.reach),
    clicks: z.number().int().min(0).max(LIMITS.MAX_VALUE.clicks),
    cost: z.number().int().min(0).max(LIMITS.MAX_VALUE.cost),
    orders: z.number().int().min(0).max(LIMITS.MAX_VALUE.orders),
  })
  .strict();

function checkRatios(rows: DailyEntry[]) {
  for (const row of rows) {
    // Đối chiếu bằng nhân chéo, không dùng cùng hàm chia làm oracle.
    expect(row.clicks).toBeGreaterThanOrEqual(row.reach * 0.008);
    expect(row.clicks).toBeLessThanOrEqual(row.reach * 0.04);
    expect(row.orders).toBeGreaterThanOrEqual(row.clicks * 0.01);
    expect(row.orders).toBeLessThanOrEqual(row.clicks * 0.06);
    expect(row.cost).toBeGreaterThanOrEqual(row.clicks * 1500);
    expect(row.cost).toBeLessThanOrEqual(row.clicks * 12000);
  }
}

describe('BA-05 — cấu hình và lỗi đầu vào', () => {
  it.each([0, -1, 1.5, NaN, Infinity, LIMITS.MAX_ROWS_TOTAL + 1])('từ chối số dòng %s', (n) => {
    expect(() => generate(n, fixed)).toThrow(z.ZodError);
  });
  it.each([-1, 1.5, NaN, Infinity, 4294967296])('từ chối seed %s', (seed) => {
    expect(() => mulberry32(seed)).toThrow(z.ZodError);
  });
  it('từ chối quá số chiến dịch cho phép', () => {
    expect(() => generate(30, { ...fixed, campaignCount: LIMITS.MAX_CAMPAIGNS + 1 })).toThrow(z.ZodError);
  });
  it('từ chối sai số chiến dịch của profile', () => {
    expect(() => generate(30, { ...fixed, profile: 'demo', campaignCount: 2 })).toThrow('INVALID_PROFILE_CAMPAIGNS');
  });
  it('từ chối tùy chọn CLI lạ', async () => {
    await expect(main(['--does-not-exist'])).rejects.toThrow('Unknown option');
  });
  it('không cho ghi preset demo với số dòng tùy ý', async () => {
    await expect(main(['--dataset', 'demo-30d', '--rows', '50'])).rejects.toThrow('CUSTOM_SIZE_REQUIRES_STRESS');
  });
  it('phát hiện số dòng đầu ra sai trước khi kiểm từng dòng', () => {
    expect(() => auditDataset([], fixed.today, 30)).toThrow('WRONG_ROW_COUNT');
  });
  it('từ chối năm Tết chưa có nguồn, không đoán ngày', () => {
    expect(() => eventFactors('2027-02-01')).toThrow('UNSUPPORTED_TET_YEAR');
  });
  it('từ chối số ngày không khớp số dòng', () => {
    expect(() => generate(100, { ...fixed, days: 10, campaignCount: 3 })).toThrow('ROWS_DAYS_MISMATCH');
  });
});

describe('BA-05 — tích hợp helper thật (DATA-01/02)', () => {
  it('PRNG seed 1 khớp vector mulberry32 độc lập và nằm trong [0,1)', () => {
    const random = mulberry32(1);
    const words = [2693262067, 11749833, 2265367787];
    for (const word of words) expect(random() * 4294967296).toBe(word);
  });
  it('demo đúng 30 ngày liên tục tới hôm qua, đủ schema và không trùng', () => {
    const rows = demo();
    expect(rowSchema.array().parse(JSON.parse(JSON.stringify(rows)))).toEqual(rows);
    expect(rows).toHaveLength(30);
    expect(rows[0]?.date).toBe('2026-10-02');
    expect(rows.at(-1)?.date).toBe('2026-10-31');
    expect(new Set(rows.map((r) => r.id)).size).toBe(30);
    expect(new Set(rows.map((r) => r.campaignId))).toEqual(new Set(['default']));
    rows.forEach((r, i) => expect(r.date).toBe(addDays('2026-10-02', i)));
    checkRatios(rows);
  });
  it('CTR tuần 3 giảm, CPA giai đoạn cuối tăng theo tỷ số của tổng', () => {
    const rows = demo();
    const { early, fatigue, late } = demoEvidence(rows);
    expect(fatigue.clicks * early.reach).toBeLessThan(early.clicks * fatigue.reach);
    expect(late.cost * fatigue.orders).toBeGreaterThan(fatigue.cost * late.orders);
  });
  it('730 ngày nhân 3 chiến dịch bằng 2190 dòng', () => {
    const rows = long();
    expect(rows).toHaveLength(2190);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2190);
    for (const id of ['thoi-trang', 'my-pham', 'do-gia-dung']) {
      const campaign = rows.filter((r) => r.campaignId === id);
      expect(campaign).toHaveLength(730);
      expect(daysBetween(campaign[0]!.date, campaign.at(-1)!.date)).toBe(729);
    }
    checkRatios(rows);
  });
  it('sinh lại cùng seed và mốc ngày giống từng byte; seed khác thay đổi số liệu', () => {
    expect(JSON.stringify(demo())).toBe(JSON.stringify(demo()));
    expect(generate(30, { ...fixed, seed: 1, profile: 'demo' })).not.toEqual(demo());
  });
  it('kiểm 200 tổ hợp seed/số dòng với giới hạn, schema và tái lập', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 1, max: 200 }), (seed, n) => {
        const rows = generate(n, { ...fixed, seed });
        expect(rows).toHaveLength(n);
        expect(rowSchema.array().parse(rows)).toEqual(rows);
        checkRatios(rows);
        expect(rows).toEqual(generate(n, { ...fixed, seed }));
      }),
      { seed: DEFAULT_SEED, numRuns: 200 },
    );
  });
  it('stress 100k không vượt giới hạn và không ghi file', () => {
    const rows = generate(100000, fixed);
    expect(rows).toHaveLength(100000);
    expect(new Set(rows.map((r) => r.id)).size).toBe(100000);
    checkRatios(rows);
  }, 60000);
  it('tính CTR/CPC/CPA tổng theo đáp án E19 và BA01-K03, không lấy trung bình tỷ lệ', () => {
    const rows = [
      { ...sample, reach: 100, clicks: 10, cost: 1000, orders: 1 },
      { ...sample, reach: 900, clicks: 90, cost: 18000, orders: 3 },
    ];
    expect(summarize(rows).kpis).toEqual({ ctr: 0.1, cpc: 190, cpa: 4750, cvr: 0.04 });
    expect(summarize([{ ...rows[0]! }, { ...rows[1]!, clicks: 9 }]).kpis.ctr).toBe(0.019);
    expect(summarize([]).kpis).toEqual({ ctr: null, cpc: null, cpa: null, cvr: null });
  });
  it.each(['2026-02-30', '2026-11-02', '2014-12-31'])('từ chối ngày sai hoặc ngoài phạm vi %s', (endDate) => {
    expect(() => generate(30, { ...fixed, endDate, profile: 'demo' })).toThrow(/INVALID_DATE/);
  });
  it('qua ngày nhuận bằng helper, không bỏ ngày 29/02', () => {
    const rows = generate(30, { ...fixed, endDate: '2024-03-01', profile: 'demo' });
    expect(rows.filter((r) => r.date === '2024-02-29')).toHaveLength(1);
  });
  it('dữ liệu sửa hỏng bị cổng validation chặn', () => {
    expect(() => auditDataset([{ ...sample, clicks: sample.reach + 1 }], fixed.today, 1)).toThrow(
      /VALIDATION|OUTSIDE_DEMO_BOUNDS/,
    );
    expect(() => auditDataset([sample, sample], fixed.today, 2)).toThrow(/VALIDATION|DUPLICATE_OR_INVALID_ID/);
    expect(() => auditDataset([{ ...sample, cost: -1 }], fixed.today, 1)).toThrow(/VALIDATION|INVALID_METRIC/);
  });
  it('lịch sự kiện đúng cả khi Black Friday thay ngày theo năm', () => {
    expect(eventFactors('2024-11-29').event).toBe('sale');
    expect(eventFactors('2025-11-28').event).toBe('sale');
    expect(eventFactors('2026-11-27').event).toBe('sale');
    expect(eventFactors('2025-11-11').event).toBe('sale');
    expect(eventFactors('2025-12-12').event).toBe('sale');
    expect(eventFactors('2026-02-16')).toEqual({ reach: 1.25, conversion: 2, event: 'pre-tet' });
    expect(eventFactors('2026-02-18')).toEqual({ reach: 0.55, conversion: 0.8, event: 'post-tet' });
  });
});

describe('BA-05 — fixture bàn giao thật', () => {
  it.each([
    ['demo-30d', 30],
    ['campaign-2y', 2190],
  ] as const)('%s có đúng schema, số dòng và tái sinh được', (name, n) => {
    const text = readFileSync(`src/fixtures/${name}.json`, 'utf8');
    const rows = rowSchema.array().parse(JSON.parse(text));
    expect(rows).toHaveLength(n);
    const endDate = rows.at(-1)!.date;
    const today = addDays(endDate, 1);
    auditDataset(rows, today, n);
    const regenerated = generate(n, {
      seed: DEFAULT_SEED,
      today,
      endDate,
      profile: name === 'demo-30d' ? 'demo' : 'campaign',
    });
    // Git trên Windows có thể đổi LF thành CRLF; dữ liệu và thứ tự vẫn phải khớp.
    expect(text.replace(/\r\n/g, '\n')).toBe(`${JSON.stringify(regenerated, null, 2)}\n`);
  });
});
