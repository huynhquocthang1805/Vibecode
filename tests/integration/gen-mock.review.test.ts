/** BA-05 REVIEW: hồi quy sau DATA-01/02 + review R-01..R-05.
 * KHÔNG mock DATA-01/02. Test runner phải dùng hàm thật trong repository.
 * Các ca DATA-FIX-01 R-01..R-04 được ghi blocker cho owner; chỉ R-05 có
 * phép thử lịch độc lập tại generator, không sửa dates.ts của Huy.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { addDays, daysBetween } from '@/lib/domain/dates';
import { computeKpis, sumTotals } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import { LIMITS } from '@/types/domain';
import type { DailyEntry } from '@/types/domain';

import {
  DEFAULT_SEED, MOCK_CAMPAIGNS, auditDataset, demoEvidence, eventFactors,
  generate, mulberry32, summarize,
} from '../../scripts/gen-mock';

const today = '2026-11-02';
const endDate = '2026-11-01';
const demo = (seed = DEFAULT_SEED) => generate(30, { seed, today, endDate, profile: 'demo' });
const campaign = (seed = DEFAULT_SEED) => generate(2190, { seed, today, endDate, profile: 'campaign' });
const signature = (rows: DailyEntry[]) => rows.map(r => `${r.id}:${r.reach}:${r.clicks}:${r.cost}:${r.orders}`).join(';');

describe('BA-05 REVIEW — PRNG an toàn, seed tái lập', () => {
  it.each([0, 1, 2, 3, 7, 13, 17, 31, 42, 73, 101, 1024, 2024, 2025, 2026, 20261101, 2147483647, 4294967295])('seed %s: luôn trả số trong [0, 1), lặp lại được', seed => {
    const a=mulberry32(seed), b=mulberry32(seed);
    for (let i=0;i<128;i++) { const x=a(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); expect(x).toBe(b()); }
  });
  it.each([0, 1, 2, 3, 7, 13, 17, 31, 42, 73, 101, 1024, 2024, 2025, 2026, 20261101, 2147483647, 4294967295])('seed %s: demo 30 ngày tái lập, không trùng khoá', seed => {
    const a=demo(seed), b=demo(seed);
    expect(signature(a)).toBe(signature(b));
    expect(new Set(a.map(r=>r.id)).size).toBe(30);
    expect(a.every(r=>r.source==='mock' && r.createdAt===0 && r.updatedAt===0)).toBe(true);
  });
  it('200 seed ngẫu nhiên có kiểm tra range + tính tái lập (fast-check)', () => {
    fc.assert(fc.property(fc.integer({min: 0, max: 4294967295}), seed => {
      const a=mulberry32(seed), b=mulberry32(seed);
      for(let i=0;i<32;i++) { const v=a(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); expect(v).toBe(b()); }
    }), {numRuns:200, seed:20261102});
  });
});
describe('BA-05 REVIEW — chuỗi ngày 30 ngày, biên tháng/quý/năm/nhuận', () => {
  it.each(["2024-02-29", "2024-03-01", "2024-03-31", "2024-04-01", "2024-10-31", "2024-12-31", "2025-01-01", "2025-01-31", "2025-02-28", "2025-03-01", "2025-06-30", "2025-07-01", "2025-11-30", "2025-12-31", "2026-01-01", "2026-02-17", "2026-02-28", "2026-03-01", "2026-06-30", "2026-07-01", "2026-10-31", "2026-11-01"])('30 ngày liên tiếp tới %s, không có ngày tương lai', end => {
    const rows=generate(30, {seed:42, today, endDate:end, profile:'demo'});
    expect(rows.at(-1)?.date).toBe(end);
    expect(rows[0]?.date).toBe(addDays(end,-29));
    rows.forEach((r,i) => { expect(r.date).toBe(addDays(end,i-29)); expect(r.id).toBe(`${r.campaignId}|${r.date}`); expect(r.date < today).toBe(true); });
    auditDataset(rows,today,30);
  });
  it('mọi ngày kiểm tra lệch ngày tới neo: không mất 29/02/2024', () => {
    const rows=generate(30,{seed:3,today,endDate:'2024-03-03',profile:'demo'});
    expect(rows.filter(r=>r.date==='2024-02-29')).toHaveLength(1);
    expect(daysBetween(rows[0]!.date, rows.at(-1)!.date)).toBe(29);
  });
});
describe('BA-05 REVIEW — ngày sai, dữ liệu tương lai và biên kích thước', () => {
  it.each(["2026-02-30", "2026-00-01", "2026-13-01", "2026-11-31", "2025-02-29", "2024-02-30", "2026/10/30", "30/10/2026", "2026-2-09", "", "2014-12-31", "2026-11-02", "2026-12-01"])('từ chối endDate %s', end => {
    expect(() => generate(30,{seed:3,today,endDate:end,profile:'demo'})).toThrow();
  });
  it.each([0, -1, -9, 0.5, 1.5, 1000000000.0, 200001])('từ chối n = %s', n => {
    expect(() => generate(n,{seed:3,today,endDate})).toThrow();
  });
  it('chặn số chiến dịch vượt LIMITS', () => {
    expect(() => generate(202,{seed:1,today,endDate,campaignCount:LIMITS.MAX_CAMPAIGNS+1})).toThrow();
  });
  it('stress 200 seed × 20 dòng, không ghi file', () => {
    fc.assert(fc.property(fc.integer({min:0,max:0xffffffff}), seed => {
      const rows=generate(20,{seed,today,endDate,profile:'stress',campaignCount:2,days:10});
      expect(rows).toHaveLength(20);
      expect(new Set(rows.map(r=>r.id)).size).toBe(20);
      rows.forEach(r => {expect(r.orders).toBeLessThanOrEqual(r.clicks); expect(r.clicks).toBeLessThanOrEqual(r.reach);});
    }), {numRuns:200,seed:20261102});
  });
});
describe('BA-05 REVIEW — lịch sự kiện 2024–2026', () => {
  it.each([["2024-11-29", "sale"], ["2025-11-28", "sale"], ["2026-11-27", "sale"], ["2024-11-11", "sale"], ["2024-12-12", "sale"], ["2025-11-11", "sale"], ["2025-12-12", "sale"], ["2026-11-11", "sale"], ["2026-12-12", "sale"], ["2024-01-27", "pre-tet"], ["2024-02-03", "pre-tet"], ["2024-02-09", "pre-tet"], ["2024-02-10", "post-tet"], ["2024-02-11", "post-tet"], ["2024-02-17", "post-tet"], ["2024-02-18", "normal"], ["2025-01-15", "pre-tet"], ["2025-01-22", "pre-tet"], ["2025-01-28", "pre-tet"], ["2025-01-29", "post-tet"], ["2025-01-30", "post-tet"], ["2025-02-05", "post-tet"], ["2025-02-06", "normal"], ["2026-02-03", "pre-tet"], ["2026-02-10", "pre-tet"], ["2026-02-16", "pre-tet"], ["2026-02-17", "post-tet"], ["2026-02-18", "post-tet"], ["2026-02-24", "post-tet"], ["2026-02-25", "normal"]])('%s có event=%s', (date,kind) => {
    expect(eventFactors(date).event).toBe(kind);
  });
  it('Tết trước: reach 1.25, conversion 2; sau: reach .55 conversion .8', () => {
    expect(eventFactors('2026-02-16')).toEqual({event:'pre-tet',reach:1.25,conversion:2});
    expect(eventFactors('2026-02-18')).toEqual({event:'post-tet',reach:.55,conversion:.8});
  });
  it.each(['2023-11-24','2027-11-26'])('không tự đoán Tết ngoài lịch đã duyệt: %s', date => {
    expect(() => eventFactors(date)).toThrow(/UNSUPPORTED_TET_YEAR/);
  });
});
describe('BA-05 REVIEW — 730 ngày × 3 chiến dịch + KPI thực', () => {
  it.each([0, 1, 42, 20261101, 4294967295])('seed %s: 2190 dòng, 3 campaign, 730 ngày/campaign', seed => {
    const rows=campaign(seed);
    expect(rows).toHaveLength(2190);
    expect(new Set(rows.map(r=>r.id)).size).toBe(2190);
    for(const c of MOCK_CAMPAIGNS){
      const part=rows.filter(r=>r.campaignId===c.id);
      expect(part).toHaveLength(730);
      expect(part.at(-1)?.date).toBe(endDate);
      expect(daysBetween(part[0]!.date,part.at(-1)!.date)).toBe(729);
    }
    expect(rows.every(r=>r.clicks<=r.reach && r.orders<=r.clicks)).toBe(true);
  });
  it('KPI tổng là tỷ số tổng, không phải trung bình tỷ lệ', () => {
    const rows: DailyEntry[]=[
      {id:'a|2026-10-01',campaignId:'a',date:'2026-10-01',reach:100,clicks:10,orders:1,cost:5000,source:'mock',createdAt:0,updatedAt:0},
      {id:'a|2026-10-02',campaignId:'a',date:'2026-10-02',reach:900,clicks:45,orders:3,cost:18000,source:'mock',createdAt:0,updatedAt:0},
    ];
    const t=sumTotals(rows), k=computeKpis(t);
    expect(t).toEqual({reach:1000,clicks:55,cost:23000,orders:4});
    expect(k.ctr).toBe(.055);
    expect(k.cpc).toBeCloseTo(23000/55, 9);
    expect(k.cpa).toBe(5750);
    expect(k.cvr).toBeCloseTo(4/55, 9);
  });
  it('CTR tuần 3 giảm và CPA cuối kỳ tăng đúng theo tích chéo', () => {
    const {early,fatigue,late}=demoEvidence(demo());
    expect(fatigue.clicks*early.reach).toBeLessThan(early.clicks*fatigue.reach);
    expect(late.cost*fatigue.orders).toBeGreaterThan(fatigue.cost*late.orders);
  });
  it('tất cả dòng demo 30 có validateEntry thật không error/warning', () => {
    const keys=new Set<string>();
    for(const r of demo()) {
      const v=validateEntry(r,{today,existingKeys:keys});
      expect(v.ok).toBe(true); expect(v.issues).toHaveLength(0);
      keys.add(r.id);
    }
  });
});
describe('BA-05 REVIEW — cổng audit phát hiện dữ liệu sai', () => {
  it('trùng id bị chặn; click vượt reach bị chặn', () => {
    const row=demo()[0]!;
    expect(()=>auditDataset([row,row],today,2)).toThrow();
    expect(()=>auditDataset([{...row,clicks:row.reach+1}],today,1)).toThrow();
  });
  it('source không phải mock, metadata sai, id sai bị chặn', () => {
    const row=demo()[0]!;
    expect(()=>auditDataset([{...row,source:'manual'}],today,1)).toThrow('INVALID_METADATA');
    expect(()=>auditDataset([{...row,createdAt:1}],today,1)).toThrow('INVALID_METADATA');
    expect(()=>auditDataset([{...row,id:'wrong'}],today,1)).toThrow();
  });
  it('cost âm và quá giới hạn bị chặn', () => {
    const row=demo()[0]!;
    expect(()=>auditDataset([{...row,cost:-1}],today,1)).toThrow();
    expect(()=>auditDataset([{...row,cost:LIMITS.MAX_VALUE.cost+1}],today,1)).toThrow();
  });
});
describe('BA-05 REVIEW — fixtures phát hành, tái lập nguyên byte', () => {
  it.each([['demo-30d',30,'demo'], ['campaign-2y',2190,'campaign']] as const)('%s đúng seed, schema, thứ tự và ngày', (name,n,profile) => {
    const content=readFileSync(`src/fixtures/${name}.json`,'utf8');
    const rows=JSON.parse(content) as DailyEntry[];
    expect(rows).toHaveLength(n);
    const finalDate=rows.at(-1)!.date;
    const nextDay=addDays(finalDate,1);
    auditDataset(rows,nextDay,n);
    const generated=generate(n,{profile,seed:DEFAULT_SEED,today:nextDay,endDate:finalDate});
    // Chỉ chuẩn hóa CRLF khi checkout trên Windows, không bỏ qua sai dữ liệu/định dạng.
    expect(content.replace(/\r\n/g, '\n')).toBe(`${JSON.stringify(generated,null,2)}\n`);
  });
});

// Ma trận hồi quy mở rộng theo ngày thật và seed. Các hàng khác nhau về ngày/seed, không tạo test rỗng.
const all365EndDates = Array.from({length:365}, (_,i) => addDays('2025-11-02', i));
const extra128Seeds = Array.from({length:128}, (_,i) => ((i * 2654435761) >>> 0));

describe('BA-05 REVIEW — 365 ngày kết thúc demo liên tiếp (2025-11-02..2026-11-01)', () => {
  it.each(all365EndDates)('kết thúc %s: 30 ngày đúng lịch, không trùng, không tương lai', end => {
    const rows=generate(30,{seed:DEFAULT_SEED,today,endDate:end,profile:'demo'});
    expect(rows).toHaveLength(30);
    expect(rows[0]!.date).toBe(addDays(end,-29));
    expect(rows.at(-1)!.date).toBe(end);
    expect(new Set(rows.map(r=>r.id)).size).toBe(30);
    expect(rows.every(r=>r.date<today && r.orders<=r.clicks && r.clicks<=r.reach)).toBe(true);
  });
});

describe('BA-05 REVIEW — 128 seed phân tán UINT32', () => {
  it.each(extra128Seeds)('seed %s: 30 dòng tái lập, KPI hữu hạn hoặc null', seed => {
    const a=demo(seed), b=demo(seed);
    expect(signature(a)).toBe(signature(b));
    const k=summarize(a).kpis;
    for(const x of [k.ctr,k.cpc,k.cpa,k.cvr]) expect(x===null || Number.isFinite(x)).toBe(true);
  });
});
