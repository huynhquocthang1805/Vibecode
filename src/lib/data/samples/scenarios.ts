// Owner: data-engineer — DATA-12 (techlead làm theo yêu cầu chủ dự án 2026-11-06): bộ dữ liệu test theo tình huống.
// Pure + deterministic (seed). Ngày tính lùi từ `today` để dự báo/nowcast luôn có dữ liệu sát hiện tại.
// Dùng ở: thư viện "Bộ dữ liệu test" (nạp ngay vào app / tải CSV để thử luồng import).
import { addDays } from '@/lib/domain/dates';
import type { EntryInput, ISODate } from '@/types/domain';

export interface SampleCampaign {
  id: string;
  name: string;
}

export interface SampleScenario {
  id: string;
  title: string;
  /** Mô tả ngắn dữ liệu trông như thế nào */
  summary: string;
  /** Kỳ vọng thấy gì khi phân tích — để kiểm thử bằng mắt */
  expect: string;
  campaigns: SampleCampaign[];
  /** Số dòng xấp xỉ (hiển thị) */
  approxRows: number;
  /** false = chỉ tải CSV (dữ liệu lỗi / quá lớn để nạp thẳng) */
  loadable: boolean;
}

/** mulberry32 — PRNG nhỏ, có seed, đủ cho dữ liệu giả lập */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 = Thứ 2 … 6 = Chủ nhật (2024-01-01 là Thứ 2), không dùng new Date('YYYY-MM-DD') */
function weekday(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const dt = Date.UTC(y, m - 1, day);
  return (((Math.round((dt - Date.UTC(2024, 0, 1)) / 86_400_000) % 7) + 7) % 7);
}

interface DayParams {
  reach: number;
  ctr: number; // click / reach
  cvr: number; // đơn / click
  cpc: number; // ₫ / click
}

/** Ghép tham số ngày → dòng hợp lệ (click ≤ reach, đơn ≤ click, số nguyên, chi phí làm tròn 1.000 ₫) */
function row(date: ISODate, campaignId: string, p: DayParams, rand: () => number): EntryInput {
  const noise = (k: number) => 1 + (rand() - 0.5) * k;
  const reach = Math.max(100, Math.round(p.reach * noise(0.18)));
  const clicks = Math.min(reach, Math.max(1, Math.round(reach * p.ctr * noise(0.2))));
  const orders = Math.min(clicks, Math.max(0, Math.round(clicks * p.cvr * noise(0.35))));
  const cost = Math.max(1000, Math.round((clicks * p.cpc * noise(0.12)) / 1000) * 1000);
  return { date, campaignId, reach, clicks, cost, orders, source: 'mock' };
}

type Builder = (today: ISODate, rand: () => number) => EntryInput[];

/** n ngày kết thúc ở hôm qua (hôm nay thường chưa đủ số) */
function days(today: ISODate, n: number): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n));
}

const base: DayParams = { reach: 24_000, ctr: 0.021, cvr: 0.032, cpc: 4_800 };

const BUILDERS: Record<string, Builder> = {
  // 1. Tăng trưởng đều: đơn tăng ~60%, CPA giảm
  growth: (today, r) =>
    days(today, 60).map((d, i) => {
      const t = i / 59;
      return row(d, 'shop-chinh', { ...base, reach: base.reach * (0.85 + 0.45 * t), cvr: base.cvr * (0.85 + 0.4 * t) }, r);
    }),
  // 2. CPA tăng vọt 10 ngày cuối: trang thanh toán lỗi → tỉ lệ chuyển đổi rơi một nửa
  'cpa-spike': (today, r) =>
    days(today, 45).map((d, i) => {
      const broken = i >= 35;
      return row(d, 'shop-chinh', { ...base, cvr: base.cvr * (broken ? 0.45 : 1), cpc: base.cpc * (broken ? 1.15 : 1) }, r);
    }),
  // 3. Quảng cáo bị nhàm: CTR giảm dần ~45%, CPC tăng
  'ctr-fatigue': (today, r) =>
    days(today, 45).map((d, i) => {
      const t = i / 44;
      return row(d, 'shop-chinh', { ...base, ctr: base.ctr * (1.15 - 0.55 * t), cpc: base.cpc * (0.9 + 0.35 * t) }, r);
    }),
  // 4. Cuối tuần bán chạy: T7–CN chuyển đổi gấp ~1,8 → luật "dồn ngân sách cuối tuần"
  weekend: (today, r) =>
    days(today, 42).map((d) => {
      const we = weekday(d) >= 5;
      return row(d, 'shop-chinh', { ...base, reach: base.reach * (we ? 1.2 : 1), cvr: base.cvr * (we ? 1.8 : 0.9) }, r);
    }),
  // 5. Flash sale: 2 ngày đột biến (chi phí ×3, đơn ×4) cách đây ~12 ngày → cảnh báo bất thường
  'flash-sale': (today, r) =>
    days(today, 40).map((d, i) => {
      const spike = i === 27 || i === 28;
      return row(d, 'shop-chinh', { ...base, reach: base.reach * (spike ? 3 : 1), cvr: base.cvr * (spike ? 1.35 : 1) }, r);
    }),
  // 6. 3 chiến dịch × 2 năm, mùa vụ năm (cao điểm Q4, Tết) → thử Tháng/Quý + dự báo
  'multi-2y': (today, r) => {
    const out: EntryInput[] = [];
    const scale: Record<string, number> = { 'facebook-ads': 1, 'google-search': 0.6, 'tiktok-ads': 0.8 };
    for (const id of Object.keys(scale)) {
      days(today, 730).forEach((d, i) => {
        const month = Number(d.slice(5, 7));
        const season = month >= 10 ? 1.35 : month <= 1 ? 1.25 : month >= 6 && month <= 8 ? 0.85 : 1;
        const trend = 0.8 + 0.4 * (i / 729);
        const we = weekday(d) >= 5 ? 1.12 : 1;
        out.push(row(d, id, { ...base, reach: base.reach * scale[id]! * season * trend * we, cvr: base.cvr * (id === 'google-search' ? 1.6 : 1) }, r));
      });
    }
    return out;
  },
  // 7. Dữ liệu lớn: 25 chiến dịch × 2.000 ngày = 50.000 dòng (thử hiệu năng; chỉ tải CSV)
  'big-50k': (today, r) => {
    const out: EntryInput[] = [];
    for (let c = 1; c <= 25; c++) {
      const id = `cd-${String(c).padStart(2, '0')}`;
      const k = 0.4 + (c % 7) * 0.25;
      days(today, 2000).forEach((d) => out.push(row(d, id, { ...base, reach: base.reach * k }, r)));
    }
    return out;
  },
};

export const SAMPLE_SCENARIOS: readonly SampleScenario[] = [
  {
    id: 'growth',
    title: 'Tăng trưởng đều',
    summary: '60 ngày, 1 chiến dịch. Reach và tỉ lệ chuyển đổi tăng dần.',
    expect: 'Đơn hàng ▲, CPA ▼ (tốt). AI khuyên tăng ngân sách cho nhóm hiệu quả. Dự báo cuối tháng đi lên.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 60,
    loadable: true,
  },
  {
    id: 'cpa-spike',
    title: 'CPA tăng vọt',
    summary: '45 ngày. 10 ngày cuối trang thanh toán "lỗi": chuyển đổi rơi một nửa.',
    expect: 'CPA ▲ mạnh, CVR ▼, cảnh báo bất thường CPA. AI ưu tiên kiểm tra trang đích / thanh toán.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 45,
    loadable: true,
  },
  {
    id: 'ctr-fatigue',
    title: 'Quảng cáo bị nhàm',
    summary: '45 ngày. CTR giảm dần ~45%, CPC tăng — khách đã chán mẫu quảng cáo.',
    expect: 'CTR ▼ liên tục, CPC ▲. AI khuyên thay 2–3 mẫu quảng cáo mới.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 45,
    loadable: true,
  },
  {
    id: 'weekend',
    title: 'Cuối tuần bán chạy',
    summary: '6 tuần. Thứ 7 – Chủ nhật chuyển đổi gần gấp đôi ngày thường.',
    expect: 'Biểu đồ răng cưa theo tuần. Gợi ý dự phòng "Dồn thêm ngân sách vào T7–CN". Dự báo có mùa vụ tuần.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 42,
    loadable: true,
  },
  {
    id: 'flash-sale',
    title: 'Flash sale đột biến',
    summary: '40 ngày, có 2 ngày sale: chi phí ×3, đơn ×4.',
    expect: 'Cột nhô cao trên biểu đồ, "Theo dõi bất thường" báo 2 ngày đó. KPI tổng vẫn là tỉ số của tổng.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 40,
    loadable: true,
  },
  {
    id: 'multi-2y',
    title: '3 chiến dịch × 2 năm',
    summary: 'Facebook, Google, TikTok — 2.190 dòng, mùa cao điểm Q4 và Tết.',
    expect: 'Thử Ngày/Tuần/Tháng/Quý, lọc từng chiến dịch, nowcast cuối tháng & cuối quý, mô hình Holt-Winters.',
    campaigns: [
      { id: 'facebook-ads', name: 'Facebook Ads' },
      { id: 'google-search', name: 'Google Search' },
      { id: 'tiktok-ads', name: 'TikTok Ads' },
    ],
    approxRows: 2190,
    loadable: true,
  },
  {
    id: 'big-50k',
    title: 'Dữ liệu lớn 50.000 dòng',
    summary: '25 chiến dịch × 2.000 ngày (~2,5 MB). Tải CSV rồi Import để thử hiệu năng.',
    expect: 'Import có thanh tiến độ, bảng cuộn mượt (ảo hoá), biểu đồ vẫn nhanh (LTTB), không treo trang.',
    campaigns: Array.from({ length: 25 }, (_, i) => ({ id: `cd-${String(i + 1).padStart(2, '0')}`, name: `Chiến dịch ${i + 1}` })),
    approxRows: 50_000,
    loadable: false,
  },
  {
    id: 'errors',
    title: 'File có lỗi (kiểm tra nhập liệu)',
    summary: '20 dòng: click > reach, số âm, ngày sai/tương lai, trùng ngày, ô trống, "1.500.000 ₫", dd/mm/yyyy.',
    expect: 'Màn Import báo đúng từng dòng lỗi bằng tiếng Việt, nhận dòng hợp lệ (kể cả 1.500.000 ₫ và 05/10/2026), tải được file lỗi.',
    campaigns: [{ id: 'shop-chinh', name: 'Shop chính' }],
    approxRows: 20,
    loadable: false,
  },
];

const SEEDS: Record<string, number> = {
  growth: 11,
  'cpa-spike': 22,
  'ctr-fatigue': 33,
  weekend: 44,
  'flash-sale': 55,
  'multi-2y': 66,
  'big-50k': 77,
};

/** Dòng hợp lệ của tình huống (không dùng cho 'errors') */
export function buildScenario(id: string, today: ISODate, seed?: number): EntryInput[] {
  const b = BUILDERS[id];
  if (!b) return [];
  return b(today, rng(seed ?? SEEDS[id] ?? 1));
}

const HEADER = ['Ngày', 'Chiến dịch', 'Lượt tiếp cận', 'Lượt click', 'Chi phí', 'Đơn hàng'];
const vnInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const csvCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (rows: string[][]) => `﻿${[HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

/** 20 dòng cố ý có lỗi lẫn dòng hợp lệ ở định dạng Việt Nam */
function errorRows(today: ISODate): string[][] {
  const d = (n: number) => addDays(today, -n);
  const dmy = (iso: ISODate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return [
    [d(20), 'Shop chính', '20000', '400', '1.900.000', '12'],
    [dmy(d(19)), 'Shop chính', '21.500', '430', '2.050.000 ₫', '13'],
    [d(18), 'Shop chính', '19000', '25000', '1.800.000', '10'], // click > reach
    [d(17), 'Shop chính', '-500', '300', '1.500.000', '9'], // reach âm
    [d(16), 'Shop chính', '22000', '440', '', '11'], // thiếu chi phí
    ['32/13/2026', 'Shop chính', '20000', '400', '1.900.000', '12'], // ngày không tồn tại
    [addDays(today, 3), 'Shop chính', '20000', '400', '1.900.000', '12'], // ngày tương lai
    [d(15), 'Shop chính', '23000', '460', '2.100.000', '600'], // đơn > click
    [d(14), 'Shop chính', '20.000', '400', '1,900,000', '12'], // phân cách kiểu Mỹ
    [d(14), 'Shop chính', '20500', '410', '1.950.000', '12'], // trùng ngày với dòng trên
    [d(13), 'Shop chính', 'hai mươi nghìn', '400', '1.900.000', '12'], // chữ thay số
    [d(12), 'Shop chính', '20000', '400.5', '1.900.000', '12'], // click lẻ
    [d(11), '', '20000', '400', '1.900.000', '12'], // thiếu chiến dịch → mặc định
    [d(10), 'Shop chính', '0', '0', '0', '0'], // ngày không chạy (hợp lệ)
    [d(9), 'Shop chính', '24000', '480', '2.200.000', '0'], // có chi phí, 0 đơn (CPA "—")
    [dmy(d(8)), 'Shop chính', '22.800', '456', '2.000.000', '14'],
    [d(7), 'Shop chính', '21000', '420', '1.950.000 VND', '13'],
    [d(6), 'Shop chính', '20000', '400', '1.900.000đ', '12'],
    ['2014-12-31', 'Shop chính', '20000', '400', '1.900.000', '12'], // trước MIN_DATE
    [d(5), 'Shop chính', '9999999999999', '400', '1.900.000', '12'], // vượt giới hạn
  ];
}

/** CSV (UTF-8 BOM, tiêu đề tiếng Việt, tiền "1.234.000") — import lại được bằng "Import CSV" */
export function scenarioCsv(id: string, today: ISODate): string {
  if (id === 'errors') return toCsv(errorRows(today));
  const s = SAMPLE_SCENARIOS.find((x) => x.id === id);
  const names = new Map((s?.campaigns ?? []).map((c) => [c.id, c.name]));
  const rows = buildScenario(id, today).map((e) => [
    e.date,
    names.get(e.campaignId) ?? e.campaignId,
    String(e.reach),
    String(e.clicks),
    vnInt(e.cost),
    String(e.orders),
  ]);
  return toCsv(rows);
}
