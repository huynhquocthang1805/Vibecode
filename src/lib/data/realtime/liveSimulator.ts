import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import type { Anomaly } from '@/types/domain';

import { bus } from './bus';

// Phân phối giờ trong ngày (0–23h): thấp vào 0–6h, đỉnh vào 19–22h
export const DIURNAL_HOURLY_WEIGHTS: readonly number[] = [
  0.25, 0.20, 0.15, 0.15, 0.20, 0.30, // 0..5h (đêm / sáng sớm: rất thấp)
  0.55, 0.80, 1.00, 1.10, 1.15, 1.20, // 6..11h (sáng: tăng dần)
  1.10, 1.15, 1.20, 1.25, 1.35, 1.50, // 12..17h (chiều)
  1.65, 1.85, 1.95, 1.80, 1.45, 0.75, // 18..23h (tối: đỉnh cao điểm 19–22h)
];

function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BaselineRates {
  ctr: number;
  cpc: number;
  cvr: number;
}

function getBaselineRates(campaignId: string): BaselineRates {
  const entries = useDataStore.getState().entries;
  const campEntries = entries
    .filter((e) => e.campaignId === campaignId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 14);

  let totalReach = 0;
  let totalClicks = 0;
  let totalCost = 0;
  let totalOrders = 0;

  for (const e of campEntries) {
    totalReach += e.reach;
    totalClicks += e.clicks;
    totalCost += e.cost;
    totalOrders += e.orders;
  }

  const ctr = totalReach > 0 && totalClicks > 0 ? Math.min(0.2, Math.max(0.005, totalClicks / totalReach)) : 0.03;
  const cpc = totalClicks > 0 && totalCost > 0 ? Math.min(100_000, Math.max(500, Math.round(totalCost / totalClicks))) : 5000;
  const cvr = totalClicks > 0 && totalOrders > 0 ? Math.min(0.2, Math.max(0.001, totalOrders / totalClicks)) : 0.02;

  return { ctr, cpc, cvr };
}

/**
 * Trình giả lập dữ liệu thời gian thực (Live Simulator).
 * Mỗi tick sinh phần tăng cho ngày hôm nay theo quy luật giờ trong ngày (diurnal curve),
 * tỉ lệ baseline CTR/CVR/CPC lấy từ 14 ngày gần nhất ± nhiễu.
 * Thỉnh thoảng bơm cú sốc CPC đột biến để demo phát hiện bất thường.
 * Ghi bằng policy 'sum', source: 'live'.
 * Trả về hàm huỷ (cleanup).
 */
export function startLiveSimulator(opts: { speed: 1 | 10 | 60; campaignId: string; seed?: number }): () => void {
  const prng = opts.seed !== undefined ? createPrng(opts.seed) : () => Math.random();
  const intervalMs = Math.max(16, Math.floor(1000 / opts.speed));
  const baseline = getBaselineRates(opts.campaignId);

  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (stopped) return;

    const hour = new Date().getHours();
    const diurnalWeight = DIURNAL_HOURLY_WEIGHTS[hour] ?? 1.0;

    // Tính phần tăng reach mỗi tick
    const baseReachStep = 10 + Math.round(prng() * 20);
    const reachInc = Math.max(1, Math.round(baseReachStep * diurnalWeight));

    // CTR dao động ± 20%
    const ctrNoise = 0.8 + prng() * 0.4;
    const ctr = Math.min(1.0, Math.max(0.005, baseline.ctr * ctrNoise));
    const clicksInc = Math.min(reachInc, Math.max(1, Math.round(reachInc * ctr)));

    // Bơm cú sốc CPC (~2% xác suất) để kích hoạt anomaly detector
    const isCpcShock = prng() < 0.02;
    const cpcMultiplier = isCpcShock ? 3.0 + prng() * 2.0 : 0.85 + prng() * 0.3;
    const cpc = Math.max(500, Math.round(baseline.cpc * cpcMultiplier));
    const costInc = Math.round(clicksInc * cpc);

    // CVR dao động ± 20%
    const cvrNoise = 0.8 + prng() * 0.4;
    const cvr = Math.min(1.0, Math.max(0.001, baseline.cvr * cvrNoise));
    const ordersInc = Math.min(clicksInc, Math.round(clicksInc * cvr));

    const today = todayVN();

    // Ghi số liệu tăng dần vào store với policy 'sum' và source 'live'
    useDataStore.getState().addEntries(
      [
        {
          date: today,
          campaignId: opts.campaignId,
          reach: reachInc,
          clicks: clicksInc,
          cost: costInc,
          orders: ordersInc,
          source: 'live',
        },
      ],
      'sum'
    );

    // Phát sự kiện anomaly nếu xảy ra CPC shock
    if (isCpcShock) {
      const anomalyEvent: Anomaly = {
        date: today,
        metric: 'cpc',
        value: cpc,
        expected: baseline.cpc,
        score: 4.2,
        direction: 'spike',
        severity: 'critical',
      };
      bus.emit({
        type: 'anomaly/detected',
        anomaly: anomalyEvent,
      });
    }

    if (!stopped) {
      timerId = setTimeout(tick, intervalMs);
    }
  };

  // Khởi động tick đầu tiên
  timerId = setTimeout(tick, intervalMs);

  return () => {
    stopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}
