/**
 * BA-05 — Nhân. Giả định demo, KHÔNG phải số liệu thị trường:
 * CTR 0.8–4%, CVR 1–6%, CPC 1,500–12,000 VND; cuối tuần reach ×1.25.
 * Mulberry32 + log-normal; trước Tết đơn xấp xỉ ×2.5, sau Tết giảm.
 * Lịch Tết 2024–2026 (ngoài khoảng này báo lỗi, không đoán ngày âm lịch):
 * https://en.baochinhphu.vn/pm-decides-seven-days-off-for-2024-lunar-new-year-holiday-111231104085606548.htm
 * https://vietnam.travel/things-to-do/festival-event/t%E1%BA%BFt-nguy%C3%AAn-%C4%91%C3%A1n
 * https://www.mps.gov.vn/bai-viet/tinh-hinh-trat-tu-an-toan-giao-thong-ngay-mung-1-tet-nguyen-dan-binh-ngo-1771323466
 * Black Friday = thứ Sáu sau thứ Năm thứ tư tháng 11.
 * PowerShell tại root repo, Node >=22; tsx đã có, không thêm dependency:
 * npm.cmd run gen:mock -- --help
 * npm.cmd run gen:mock
 * npm.cmd run gen:mock -- --seed 20261101 --today 2026-11-01 --end-date 2026-10-31
 * npm.cmd run gen:mock -- --dataset stress --rows 100000 --days 1000 --campaigns 100
 * npm.cmd run test -- tests/integration/gen-mock.test.ts
 * npm.cmd run check
 * Tái lập cần CÙNG seed, today, khoảng ngày, cấu hình và phiên bản script.
 * Mặc định kết thúc hôm qua giờ VN. Metadata = 0 cố định như adapter BA-01.
 * Stress không mô phỏng Tết, không thuộc BA-08; không commit stress-*.json.
 * Chỉ ghi sau kiểm tra bằng helper thật DATA-01/02; không bỏ qua stub.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { addDays, daysBetween, parseISODate, todayVN } from '@/lib/domain/dates';
import { computeKpis, safeDiv, sumTotals } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import { LIMITS } from '@/types/domain';
import type { Campaign, DailyEntry, ISODate } from '@/types/domain';

export const DEFAULT_SEED = 20261101;
/** Mapping bàn giao DATA-04; không import script Node này vào client. */
export const MOCK_CAMPAIGNS: readonly Campaign[] = [
  { id: 'thoi-trang', name: 'Thời trang', createdAt: 0 },
  { id: 'my-pham', name: 'Mỹ phẩm', createdAt: 0 },
  { id: 'do-gia-dung', name: 'Đồ gia dụng', createdAt: 0 },
];
const TET: Readonly<Record<string, ISODate>> = { '2024': '2024-02-10', '2025': '2025-01-29', '2026': '2026-02-17' };
const seedSchema = z.number().int().min(0).max(0xffffffff);
const rowCountSchema = z.number().int().min(1).max(LIMITS.MAX_ROWS_TOTAL);
const optionsSchema = z
  .object({
    seed: seedSchema.default(DEFAULT_SEED),
    today: z.string().optional(),
    endDate: z.string().optional(),
    days: z.number().int().min(1).max(LIMITS.MAX_ROWS_TOTAL).optional(),
    campaignCount: z.number().int().min(1).max(LIMITS.MAX_CAMPAIGNS).optional(),
    profile: z.enum(['demo', 'campaign', 'stress']).default('stress'),
  })
  .strict();
export type GenerateOptions = z.input<typeof optionsSchema>;

function ratio(a: number, b: number): number {
  const value = safeDiv(a, b);
  if (value === null || !Number.isFinite(value)) throw new Error('UNDEFINED_RATIO');
  return value;
}
export function mulberry32(seed: number): () => number {
  let state = seedSchema.parse(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ratio((t ^ (t >>> 14)) >>> 0, 4294967296);
  };
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
/** Box–Muller tránh log(0); log-normal có mean lý thuyết = 1. */
function logNormal(random: () => number, sigma: number): number {
  const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  return Math.exp(sigma * normal - sigma * sigma * 0.5);
}
function iso(value: string): ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parseISODate(value) !== value) throw new Error(`INVALID_DATE: ${value}`);
  return value;
}
/** Thứ 2 = 0; neo tại 2024-01-01 (thứ Hai), tránh lỗi TZ của DATA-02 R-05. */
function weekday(date: ISODate): number {
  return ((daysBetween('2024-01-01', date) % 7) + 7) % 7;
}
export function eventFactors(date: ISODate): { reach: number; conversion: number; event: string } {
  const year = date.slice(0, 4);
  const tet = TET[year];
  if (!tet) throw new Error(`UNSUPPORTED_TET_YEAR: ${year}`);
  const distance = daysBetween(tet, date);
  if (distance >= -14 && distance <= -1) return { reach: 1.25, conversion: 2, event: 'pre-tet' };
  if (distance >= 0 && distance <= 7) return { reach: 0.55, conversion: 0.8, event: 'post-tet' };
  const november = `${year}-11-01`;
  const blackFriday = addDays(november, ((3 - weekday(november) + 7) % 7) + 22);
  if (date === blackFriday || date.endsWith('-11-11') || date.endsWith('-12-12')) {
    return { reach: 1.6, conversion: 1.45, event: 'sale' };
  }
  return { reach: 1, conversion: 1, event: 'normal' };
}

/** Cổng xuất dữ liệu: validation thật + hợp đồng metadata + giới hạn riêng của demo. */
export function auditDataset(entries: DailyEntry[], today: ISODate, expectedCount: number): void {
  if (entries.length !== expectedCount) throw new Error('WRONG_ROW_COUNT');
  const keys = new Set<string>();
  const lastDates = new Map<string, ISODate>();
  for (const entry of entries) {
    const result = validateEntry(entry, { today, existingKeys: keys });
    if (!result.ok || result.issues.length > 0)
      throw new Error(`VALIDATION: ${entry.id}: ${result.issues.map((issue) => issue.code).join(',')}`);
    if (entry.id !== `${entry.campaignId}|${entry.date}` || keys.has(entry.id))
      throw new Error('DUPLICATE_OR_INVALID_ID');
    if (entry.source !== 'mock' || entry.createdAt !== 0 || entry.updatedAt !== 0) throw new Error('INVALID_METADATA');
    iso(entry.date);
    if (entry.date < LIMITS.MIN_DATE || entry.date >= today) throw new Error('INVALID_DATE_RANGE');
    for (const field of ['reach', 'clicks', 'cost', 'orders'] as const) {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0 || entry[field] > LIMITS.MAX_VALUE[field])
        throw new Error(`INVALID_METRIC: ${field}`);
    }
    const previous = lastDates.get(entry.campaignId);
    if (previous && addDays(previous, 1) !== entry.date) throw new Error('NON_CONTIGUOUS_DATES');
    const ctr = ratio(entry.clicks, entry.reach),
      cvr = ratio(entry.orders, entry.clicks),
      cpc = ratio(entry.cost, entry.clicks);
    if (
      entry.clicks > entry.reach ||
      entry.orders > entry.clicks ||
      ctr < 0.008 ||
      ctr > 0.04 ||
      cvr < 0.01 ||
      cvr > 0.06 ||
      cpc < 1500 ||
      cpc > 12000
    )
      throw new Error('OUTSIDE_DEMO_BOUNDS');
    keys.add(entry.id);
    lastDates.set(entry.campaignId, entry.date);
  }
  if (lastDates.size > LIMITS.MAX_CAMPAIGNS) throw new Error('TOO_MANY_CAMPAIGNS');
}

/** n = số dòng, không phải số ngày. Import hàm không ghi file. */
export function generate(n: number, options: GenerateOptions = {}): DailyEntry[] {
  rowCountSchema.parse(n);
  const config = optionsSchema.parse(options);
  const { profile, seed } = config;
  const fixedCount = profile === 'demo' ? 1 : profile === 'campaign' ? 3 : undefined;
  const campaignCount = config.campaignCount ?? fixedCount ?? Math.min(100, n);
  if (fixedCount && campaignCount !== fixedCount) throw new Error('INVALID_PROFILE_CAMPAIGNS');
  const days = config.days ?? Math.ceil(ratio(n, campaignCount));
  if (profile === 'demo' && (n !== 30 || days !== 30)) throw new Error('DEMO_REQUIRES_30_DAYS');
  if (profile === 'campaign' && (n !== 2190 || days !== 730)) throw new Error('CAMPAIGN_REQUIRES_730_X_3');
  if (n > days * campaignCount || n <= (days - 1) * campaignCount) throw new Error('ROWS_DAYS_MISMATCH');
  const today = iso(config.today ?? todayVN());
  const endDate = iso(config.endDate ?? addDays(today, -1));
  const startDate = addDays(endDate, 1 - days);
  if (startDate < LIMITS.MIN_DATE || endDate >= today) throw new Error('INVALID_DATE_RANGE');
  if (profile === 'campaign') {
    for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year++) {
      if (!TET[String(year)]) throw new Error(`UNSUPPORTED_TET_YEAR: ${year}`);
    }
  }
  const random = mulberry32(seed);
  const entries: DailyEntry[] = [];
  for (let day = 0; day < days; day++) {
    const date = addDays(startDate, day);
    const weekend = weekday(date) >= 5 ? 1.25 : 1;
    const event = profile === 'campaign' ? eventFactors(date) : { reach: 1, conversion: 1 };
    for (let campaign = 0; campaign < campaignCount && entries.length < n; campaign++) {
      const progress = ratio(day, Math.max(1, days - 1));
      const trend = 1 + progress * (campaign % 3 === 1 ? -0.12 : 0.35);
      const wobble = clamp(logNormal(random, profile === 'demo' ? 0.035 : 0.1), 0.7, 1.4);
      const reach = Math.round((22000 + (campaign % 3) * 8000) * trend * weekend * event.reach * wobble);
      const creativeCtr =
        profile === 'demo'
          ? day < 14
            ? 0.027 + day * 0.00015
            : day < 21
              ? 0.027 - (day - 13) * 0.0015
              : 0.016
          : 0.022 + 0.002 * Math.sin(day * 0.035 + campaign);
      const clicks = Math.round(reach * clamp(creativeCtr * logNormal(random, 0.018), 0.009, 0.039));
      const targetCvr =
        profile === 'demo'
          ? day < 21
            ? 0.04
            : 0.032 - (day - 21) * 0.0012
          : (0.022 + 0.002 * Math.sin(day * 0.04 + campaign)) * event.conversion;
      const orders = clamp(Math.round(clicks * targetCvr), Math.ceil(clicks * 0.01), Math.floor(clicks * 0.06));
      const cpc = Math.round(
        clamp(
          (profile === 'demo' && day >= 21 ? 4200 + (day - 21) * 220 : 3600 + (campaign % 3) * 800) *
            logNormal(random, 0.025),
          1500,
          12000,
        ),
      );
      const campaignId =
        profile === 'demo'
          ? 'default'
          : profile === 'campaign'
            ? MOCK_CAMPAIGNS[campaign]?.id
            : `stress-${String(campaign + 1).padStart(3, '0')}`;
      if (!campaignId) throw new Error('MISSING_CAMPAIGN');
      entries.push({
        id: `${campaignId}|${date}`,
        date,
        campaignId,
        reach,
        clicks,
        cost: clicks * cpc,
        orders,
        source: 'mock',
        createdAt: 0,
        updatedAt: 0,
      });
    }
  }
  auditDataset(entries, today, n);
  return entries;
}
export function summarize(entries: DailyEntry[]) {
  const totals = sumTotals(entries);
  return { ...totals, kpis: computeKpis(totals) };
}
/** Giai đoạn theo vị trí trong 30 ngày; không phải bucket tuần ISO của UI. */
export function demoEvidence(entries: DailyEntry[]) {
  if (entries.length !== 30) throw new Error('DEMO_REQUIRES_30_DAYS');
  const early = summarize(entries.slice(0, 14)),
    fatigue = summarize(entries.slice(14, 21)),
    late = summarize(entries.slice(21));
  if (
    early.kpis.ctr === null ||
    fatigue.kpis.ctr === null ||
    fatigue.kpis.cpa === null ||
    late.kpis.cpa === null ||
    fatigue.kpis.ctr >= early.kpis.ctr ||
    late.kpis.cpa <= fatigue.kpis.cpa
  )
    throw new Error('DEMO_NARRATIVE_NOT_MET');
  return { early, fatigue, late };
}

export async function main(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h' },
      seed: { type: 'string' },
      today: { type: 'string' },
      'end-date': { type: 'string' },
      dataset: { type: 'string', default: 'all' },
      rows: { type: 'string' },
      days: { type: 'string' },
      campaigns: { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  if (values.help) {
    process.stdout.write(
      'BA-05: --dataset all|demo-30d|campaign-2y|stress --seed UINT32 --today YYYY-MM-DD --end-date YYYY-MM-DD\nStress only: --rows N --days N --campaigns N. Chạy tại root repo; cần DATA-01/02.\n',
    );
    return;
  }
  const dataset = z.enum(['all', 'demo-30d', 'campaign-2y', 'stress']).parse(values.dataset);
  if (
    dataset !== 'stress' &&
    (values.rows !== undefined || values.days !== undefined || values.campaigns !== undefined)
  )
    throw new Error('CUSTOM_SIZE_REQUIRES_STRESS');
  const options: GenerateOptions = {
    seed: values.seed === undefined ? DEFAULT_SEED : Number(values.seed),
    today: values.today,
    endDate: values['end-date'],
  };
  optionsSchema.parse(options);
  options.today = options.today ?? todayVN();
  const outputs: Array<{ name: string; entries: DailyEntry[] }> = [];
  if (dataset === 'all' || dataset === 'demo-30d') {
    const entries = generate(30, { ...options, profile: 'demo' });
    demoEvidence(entries);
    outputs.push({ name: 'demo-30d.json', entries });
  }
  if (dataset === 'all' || dataset === 'campaign-2y')
    outputs.push({ name: 'campaign-2y.json', entries: generate(2190, { ...options, profile: 'campaign' }) });
  if (dataset === 'stress') {
    const n = values.rows === undefined ? 100000 : Number(values.rows);
    outputs.push({
      name: `stress-${n}.json`,
      entries: generate(n, {
        ...options,
        profile: 'stress',
        days: values.days === undefined ? undefined : Number(values.days),
        campaignCount: values.campaigns === undefined ? undefined : Number(values.campaigns),
      }),
    });
  }
  const reports = outputs.map(({ name, entries }) => ({
    file: name,
    rows: entries.length,
    from: entries[0]?.date,
    to: entries.at(-1)?.date,
    seed: options.seed,
    totals: summarize(entries),
    ...(name === 'demo-30d.json' ? { evidence: demoEvidence(entries) } : {}),
  }));
  // Hoàn thành TẤT CẢ kiểm tra trước khi ghi. Lỗi I/O vẫn báo lên caller.
  const directory = resolve('src/fixtures');
  await mkdir(directory, { recursive: true });
  for (const output of outputs)
    await writeFile(resolve(directory, output.name), `${JSON.stringify(output.entries, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
}
if (/(?:^|[\\/])gen-mock\.ts$/.test(process.argv[1] ?? '')) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
