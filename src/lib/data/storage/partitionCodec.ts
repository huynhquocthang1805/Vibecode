import { addDays, daysBetween } from '@/lib/domain/dates';
import type { Campaign, DailyEntry, EntrySource, Settings } from '@/types/domain';

export const PARTITION_PREFIX = 'kpi-dash:v1:p:';
export const MANIFEST_KEY = 'kpi-dash:v1';

export const SOURCE_TO_NUM: Record<EntrySource, number> = {
  manual: 0,
  paste: 1,
  csv: 2,
  live: 3,
  mock: 4,
};

export const NUM_TO_SOURCE: EntrySource[] = ['manual', 'paste', 'csv', 'live', 'mock'];

export interface PartitionMeta {
  gen: number;
  rows: number;
  sum: [number, number, number, number]; // [reach, clicks, cost, orders]
}

export interface ManifestPayload {
  v: number;
  gen: number;
  savedAt: number;
  epoch: string;
  campaigns: Campaign[];
  settings: Settings;
  parts: Record<string, PartitionMeta>;
}

export interface PartitionPayload {
  /** RLE [[campIdx, count], ...] */
  c: [number, number][];
  /** Delta ngày tính từ epoch (cho dòng đầu campaign) hoặc từ ngày trước đó */
  d: number[];
  r: number[];
  k: number[];
  s: number[];
  o: number[];
  /** RLE [[srcIdx, count], ...] */
  src: [number, number][];
}

export function partitionKey(year: string, gen: number): string {
  return `${PARTITION_PREFIX}${year}:${gen}`;
}

export function parsePartitionKey(key: string): { year: string; gen: number } | null {
  if (!key.startsWith(PARTITION_PREFIX)) return null;
  const parts = key.slice(PARTITION_PREFIX.length).split(':');
  if (parts.length !== 2) return null;
  const year = parts[0];
  const gen = Number(parts[1]);
  if (!year || Number.isNaN(gen)) return null;
  return { year, gen };
}

/**
 * Mã hoá các DailyEntry của một năm thành PartitionPayload gọn nhẹ (docs/13 §2).
 * Sắp xếp theo (campaignIndex, date) để delta-encode ngày và RLE cho campaign & source.
 */
export function encodePartition(
  entries: DailyEntry[],
  epoch: string,
  campaignIndexMap: Map<string, number>,
): { payload: PartitionPayload; rows: number; sum: [number, number, number, number] } {
  // Sắp xếp theo (campaignIndex, date)
  const sorted = [...entries].sort((a, b) => {
    const cA = campaignIndexMap.get(a.campaignId) ?? 0;
    const cB = campaignIndexMap.get(b.campaignId) ?? 0;
    if (cA !== cB) return cA - cB;
    return a.date.localeCompare(b.date);
  });

  const n = sorted.length;
  const d: number[] = new Array(n);
  const r: number[] = new Array(n);
  const k: number[] = new Array(n);
  const s: number[] = new Array(n);
  const o: number[] = new Array(n);

  let sumR = 0;
  let sumK = 0;
  let sumS = 0;
  let sumO = 0;

  const cRle: [number, number][] = [];
  const srcRle: [number, number][] = [];

  let curCampIdx = -1;
  let prevDate = epoch;

  for (let i = 0; i < n; i++) {
    const entry = sorted[i]!;
    const cIdx = campaignIndexMap.get(entry.campaignId) ?? 0;
    const sIdx = SOURCE_TO_NUM[entry.source] ?? 0;

    // RLE cho campaign
    if (cRle.length === 0 || cRle[cRle.length - 1]![0] !== cIdx) {
      cRle.push([cIdx, 1]);
    } else {
      cRle[cRle.length - 1]![1]++;
    }

    // RLE cho source
    if (srcRle.length === 0 || srcRle[srcRle.length - 1]![0] !== sIdx) {
      srcRle.push([sIdx, 1]);
    } else {
      srcRle[srcRle.length - 1]![1]++;
    }

    // Delta ngày: dòng đầu của campaign tính từ epoch, sau đó tính từ prevDate
    if (cIdx !== curCampIdx) {
      curCampIdx = cIdx;
      d[i] = daysBetween(epoch, entry.date);
    } else {
      d[i] = daysBetween(prevDate, entry.date);
    }
    prevDate = entry.date;

    r[i] = entry.reach;
    k[i] = entry.clicks;
    s[i] = entry.cost;
    o[i] = entry.orders;

    sumR += entry.reach;
    sumK += entry.clicks;
    sumS += entry.cost;
    sumO += entry.orders;
  }

  return {
    payload: {
      c: cRle,
      d,
      r,
      k,
      s,
      o,
      src: srcRle,
    },
    rows: n,
    sum: [sumR, sumK, sumS, sumO],
  };
}

/**
 * Giải mã PartitionPayload thành danh sách DailyEntry.
 */
export function decodePartition(
  payload: PartitionPayload,
  epoch: string,
  campaigns: Campaign[],
  savedAt: number,
): DailyEntry[] {
  const { c: cRle, d, r, k, s, o, src: srcRle } = payload;
  const n = d.length;
  const entries: DailyEntry[] = new Array(n);

  // Unpack campaign RLE
  const campIndices: number[] = new Array(n);
  let cRow = 0;
  for (const [cIdx, count] of cRle) {
    for (let j = 0; j < count; j++) {
      campIndices[cRow++] = cIdx;
    }
  }

  // Unpack source RLE
  const srcIndices: number[] = new Array(n);
  let sRow = 0;
  for (const [sIdx, count] of srcRle) {
    for (let j = 0; j < count; j++) {
      srcIndices[sRow++] = sIdx;
    }
  }

  let curCampIdx = -1;
  let prevDate = epoch;

  for (let i = 0; i < n; i++) {
    const cIdx = campIndices[i] ?? 0;
    const campaignId = campaigns[cIdx]?.id ?? 'default';

    let date: string;
    if (cIdx !== curCampIdx) {
      curCampIdx = cIdx;
      date = addDays(epoch, d[i] ?? 0);
    } else {
      date = addDays(prevDate, d[i] ?? 0);
    }
    prevDate = date;

    const source = NUM_TO_SOURCE[srcIndices[i] ?? 0] ?? 'manual';
    const id = `${campaignId}|${date}`;

    entries[i] = {
      id,
      date,
      campaignId,
      reach: r[i] ?? 0,
      clicks: k[i] ?? 0,
      cost: s[i] ?? 0,
      orders: o[i] ?? 0,
      source,
      createdAt: savedAt,
      updatedAt: savedAt,
    };
  }

  return entries;
}
