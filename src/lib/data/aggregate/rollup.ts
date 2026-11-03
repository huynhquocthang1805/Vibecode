import { addDays, bucketKey, bucketRange, daysBetween } from '@/lib/domain/dates';
import { computeKpis } from '@/lib/domain/kpi';
import type { AnalyticsQuery, Bucket, CampaignFilter, Checksum, DailyEntry, EntryDelta, Series } from '@/types/domain';

const BASE_DATE = '2015-01-01';
const INITIAL_CAPACITY = 8192; // covers > 22 years

interface CampaignData {
  reach: Float64Array;
  clicks: Float64Array;
  cost: Float64Array;
  orders: Float64Array;
  entryCount: Uint16Array;
  firstDay: number;
  lastDay: number;
}

function createCampaignData(cap: number): CampaignData {
  return {
    reach: new Float64Array(cap),
    clicks: new Float64Array(cap),
    cost: new Float64Array(cap),
    orders: new Float64Array(cap),
    entryCount: new Uint16Array(cap),
    firstDay: Infinity,
    lastDay: -1,
  };
}

function growCampaignData(data: CampaignData, newCap: number): CampaignData {
  const nextReach = new Float64Array(newCap);
  const nextClicks = new Float64Array(newCap);
  const nextCost = new Float64Array(newCap);
  const nextOrders = new Float64Array(newCap);
  const nextEntryCount = new Uint16Array(newCap);

  nextReach.set(data.reach);
  nextClicks.set(data.clicks);
  nextCost.set(data.cost);
  nextOrders.set(data.orders);
  nextEntryCount.set(data.entryCount);

  return {
    reach: nextReach,
    clicks: nextClicks,
    cost: nextCost,
    orders: nextOrders,
    entryCount: nextEntryCount,
    firstDay: data.firstDay,
    lastDay: data.lastDay,
  };
}

function isoToDay(iso: string): number {
  return daysBetween(BASE_DATE, iso);
}

function dayToIso(d: number): string {
  return addDays(BASE_DATE, d);
}

/**
 * Kiểu nội bộ của RollupIndex (opaque với các module khác).
 * Cài đặt bằng mảng dày theo ngày theo docs/13 §3.
 */
export interface RollupIndex {
  readonly kind: 'rollup-index';
  campaignData: Map<string, CampaignData>;
  allData: CampaignData;
  capacity: number;
  checksum: Checksum;
}

export function getRollupChecksum(index: RollupIndex): Checksum {
  return { ...index.checksum };
}

export function getRollupDataSpan(
  index: RollupIndex,
  campaignId: CampaignFilter,
): { first: string | null; last: string | null } {
  const data = campaignId === 'all' ? index.allData : index.campaignData.get(campaignId);
  if (!data || data.firstDay === Infinity || data.firstDay > data.lastDay) {
    return { first: null, last: null };
  }
  return {
    first: dayToIso(data.firstDay),
    last: dayToIso(data.lastDay),
  };
}

/** O(n) */
export function buildRollups(entries: DailyEntry[]): RollupIndex {
  let capacity = INITIAL_CAPACITY;
  // Tìm max day nếu có
  for (let i = 0; i < entries.length; i++) {
    const d = isoToDay(entries[i]!.date);
    if (d >= capacity) {
      capacity = Math.max(capacity * 2, d + 1024);
    }
  }

  const campaignData = new Map<string, CampaignData>();
  const allData = createCampaignData(capacity);
  const checksum: Checksum = {
    rows: entries.length,
    reach: 0,
    clicks: 0,
    cost: 0,
    orders: 0,
  };

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const d = isoToDay(e.date);
    if (d < 0) continue;

    let camp = campaignData.get(e.campaignId);
    if (!camp) {
      camp = createCampaignData(capacity);
      campaignData.set(e.campaignId, camp);
    }

    camp.reach[d] = (camp.reach[d] ?? 0) + e.reach;
    camp.clicks[d] = (camp.clicks[d] ?? 0) + e.clicks;
    camp.cost[d] = (camp.cost[d] ?? 0) + e.cost;
    camp.orders[d] = (camp.orders[d] ?? 0) + e.orders;
    camp.entryCount[d] = (camp.entryCount[d] ?? 0) + 1;
    if (d < camp.firstDay) camp.firstDay = d;
    if (d > camp.lastDay) camp.lastDay = d;

    allData.reach[d] = (allData.reach[d] ?? 0) + e.reach;
    allData.clicks[d] = (allData.clicks[d] ?? 0) + e.clicks;
    allData.cost[d] = (allData.cost[d] ?? 0) + e.cost;
    allData.orders[d] = (allData.orders[d] ?? 0) + e.orders;
    if (camp.entryCount[d] === 1) {
      allData.entryCount[d] = (allData.entryCount[d] ?? 0) + 1;
    }
    if (d < allData.firstDay) allData.firstDay = d;
    if (d > allData.lastDay) allData.lastDay = d;

    checksum.reach += e.reach;
    checksum.clicks += e.clicks;
    checksum.cost += e.cost;
    checksum.orders += e.orders;
  }

  return {
    kind: 'rollup-index',
    campaignData,
    allData,
    capacity,
    checksum,
  };
}

/** O(|delta|) */
export function applyDelta(index: RollupIndex, delta: EntryDelta): RollupIndex {
  // Check if we need capacity expansion
  let neededCap = index.capacity;
  for (let i = 0; i < delta.added.length; i++) {
    const d = isoToDay(delta.added[i]!.date);
    if (d >= neededCap) {
      neededCap = Math.max(neededCap * 2, d + 1024);
    }
  }

  if (neededCap > index.capacity) {
    index.capacity = neededCap;
    index.allData = growCampaignData(index.allData, neededCap);
    for (const [cid, cdata] of index.campaignData.entries()) {
      index.campaignData.set(cid, growCampaignData(cdata, neededCap));
    }
  }

  const { allData, campaignData, checksum } = index;

  // Process removals
  for (let i = 0; i < delta.removed.length; i++) {
    const e = delta.removed[i]!;
    const d = isoToDay(e.date);
    if (d < 0 || d >= index.capacity) continue;

    const camp = campaignData.get(e.campaignId);
    if (camp) {
      camp.reach[d] = Math.max(0, (camp.reach[d] ?? 0) - e.reach);
      camp.clicks[d] = Math.max(0, (camp.clicks[d] ?? 0) - e.clicks);
      camp.cost[d] = Math.max(0, (camp.cost[d] ?? 0) - e.cost);
      camp.orders[d] = Math.max(0, (camp.orders[d] ?? 0) - e.orders);
      const currentCount = camp.entryCount[d] ?? 0;
      camp.entryCount[d] = currentCount > 0 ? currentCount - 1 : 0;

      if (camp.entryCount[d] === 0) {
        const allCount = allData.entryCount[d] ?? 0;
        allData.entryCount[d] = allCount > 0 ? allCount - 1 : 0;
      }
    }

    allData.reach[d] = Math.max(0, (allData.reach[d] ?? 0) - e.reach);
    allData.clicks[d] = Math.max(0, (allData.clicks[d] ?? 0) - e.clicks);
    allData.cost[d] = Math.max(0, (allData.cost[d] ?? 0) - e.cost);
    allData.orders[d] = Math.max(0, (allData.orders[d] ?? 0) - e.orders);

    checksum.rows = Math.max(0, checksum.rows - 1);
    checksum.reach = Math.max(0, checksum.reach - e.reach);
    checksum.clicks = Math.max(0, checksum.clicks - e.clicks);
    checksum.cost = Math.max(0, checksum.cost - e.cost);
    checksum.orders = Math.max(0, checksum.orders - e.orders);
  }

  // Process additions
  for (let i = 0; i < delta.added.length; i++) {
    const e = delta.added[i]!;
    const d = isoToDay(e.date);
    if (d < 0 || d >= index.capacity) continue;

    let camp = campaignData.get(e.campaignId);
    if (!camp) {
      camp = createCampaignData(index.capacity);
      campaignData.set(e.campaignId, camp);
    }

    camp.reach[d] = (camp.reach[d] ?? 0) + e.reach;
    camp.clicks[d] = (camp.clicks[d] ?? 0) + e.clicks;
    camp.cost[d] = (camp.cost[d] ?? 0) + e.cost;
    camp.orders[d] = (camp.orders[d] ?? 0) + e.orders;
    camp.entryCount[d] = (camp.entryCount[d] ?? 0) + 1;
    if (d < camp.firstDay) camp.firstDay = d;
    if (d > camp.lastDay) camp.lastDay = d;

    allData.reach[d] = (allData.reach[d] ?? 0) + e.reach;
    allData.clicks[d] = (allData.clicks[d] ?? 0) + e.clicks;
    allData.cost[d] = (allData.cost[d] ?? 0) + e.cost;
    allData.orders[d] = (allData.orders[d] ?? 0) + e.orders;
    if (camp.entryCount[d] === 1) {
      allData.entryCount[d] = (allData.entryCount[d] ?? 0) + 1;
    }
    if (d < allData.firstDay) allData.firstDay = d;
    if (d > allData.lastDay) allData.lastDay = d;

    checksum.rows++;
    checksum.reach += e.reach;
    checksum.clicks += e.clicks;
    checksum.cost += e.cost;
    checksum.orders += e.orders;
  }

  return index;
}

export function getSeries(
  index: RollupIndex,
  q: Pick<AnalyticsQuery, 'campaignId' | 'grain' | 'range' | 'today'>,
): Series {
  const isAll = q.campaignId === 'all' || !q.campaignId;
  const data = isAll ? index.allData : index.campaignData.get(q.campaignId);

  // If no data exists
  if (!data || data.firstDay === Infinity || data.firstDay > data.lastDay) {
    if (!q.range) {
      return { grain: q.grain, campaignId: q.campaignId, buckets: [] };
    }
  }

  let from: string;
  let to: string;

  if (q.range) {
    from = q.range.from;
    to = q.range.to;
  } else if (data && data.firstDay !== Infinity && data.firstDay <= data.lastDay) {
    from = dayToIso(data.firstDay);
    to = dayToIso(data.lastDay);
  } else {
    return { grain: q.grain, campaignId: q.campaignId, buckets: [] };
  }

  if (from > to) {
    return { grain: q.grain, campaignId: q.campaignId, buckets: [] };
  }

  const buckets: Bucket[] = [];
  let currentKey = bucketKey(from, q.grain);
  const endLimitKey = bucketKey(to, q.grain);
  const endLimitRange = bucketRange(endLimitKey, q.grain);

  let iterations = 0;
  while (iterations < 10000) {
    iterations++;
    const range = bucketRange(currentKey, q.grain);
    if (range.start > endLimitRange.end) {
      break;
    }

    const startD = isoToDay(range.start);
    const endD = isoToDay(range.end);

    let reach = 0;
    let clicks = 0;
    let cost = 0;
    let orders = 0;
    let daysWithData = 0;

    if (data) {
      for (let d = startD; d <= endD; d++) {
        if (d >= 0 && d < index.capacity) {
          const count = data.entryCount[d] ?? 0;
          if (count > 0) {
            daysWithData++;
            reach += data.reach[d] ?? 0;
            clicks += data.clicks[d] ?? 0;
            cost += data.cost[d] ?? 0;
            orders += data.orders[d] ?? 0;
          }
        }
      }
    }

    const isPartial = range.end >= q.today || daysWithData < range.days;
    const totals = { reach, clicks, cost, orders };

    buckets.push({
      key: currentKey,
      grain: q.grain,
      start: range.start,
      end: range.end,
      daysWithData,
      daysInPeriod: range.days,
      isPartial,
      ...totals,
      kpis: computeKpis(totals),
    });

    const nextDay = addDays(range.end, 1);
    currentKey = bucketKey(nextDay, q.grain);
  }

  return {
    grain: q.grain,
    campaignId: q.campaignId,
    buckets,
  };
}
