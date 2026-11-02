import { addDays, daysBetween } from '@/lib/domain/dates';
import type { Campaign, DailyEntry, EntrySource, PersistedState, Settings } from '@/types/domain';
import { ALL_CAMPAIGNS, CONTRACT_VERSION } from '@/types/domain';

const SOURCE_TO_NUM: Record<EntrySource, number> = {
  manual: 0,
  paste: 1,
  csv: 2,
  live: 3,
  mock: 4,
};

const NUM_TO_SOURCE: EntrySource[] = ['manual', 'paste', 'csv', 'live', 'mock'];

interface ColumnarPayload {
  v: number;
  epoch: string;
  campaigns: Campaign[];
  settings: Settings;
  cols: {
    d: number[];
    c: number[];
    r: number[];
    k: number[];
    s: number[];
    o: number[];
    src: number[];
  };
}

export const DEFAULT_SETTINGS: Settings = {
  activeCampaignId: ALL_CAMPAIGNS,
  grain: 'day',
  range: null,
  liveMode: false,
  liveSpeed: 1,
  targets: {},
  reportFormat: 'short',
  duplicatePolicy: 'ask',
};

/** Codec cột (docs/02 §2, docs/13 §2) — không lưu id/createdAt/updatedAt */
export function encodeState(s: PersistedState): string {
  const epoch = s.entries.length > 0 ? (s.entries[0]?.date ?? '2024-01-01') : '2024-01-01';

  // Map campaignId to index in campaigns array
  const campaignIndexMap = new Map<string, number>();
  const campaignsList: Campaign[] = [...s.campaigns];

  campaignsList.forEach((c, idx) => {
    campaignIndexMap.set(c.id, idx);
  });

  const n = s.entries.length;
  const d: number[] = new Array(n);
  const c: number[] = new Array(n);
  const r: number[] = new Array(n);
  const k: number[] = new Array(n);
  const sCol: number[] = new Array(n);
  const o: number[] = new Array(n);
  const src: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const entry = s.entries[i];
    if (!entry) continue;

    d[i] = daysBetween(epoch, entry.date);

    let cIdx = campaignIndexMap.get(entry.campaignId);
    if (cIdx === undefined) {
      cIdx = campaignsList.length;
      campaignIndexMap.set(entry.campaignId, cIdx);
      campaignsList.push({
        id: entry.campaignId,
        name: entry.campaignId,
        createdAt: Date.now(),
      });
    }
    c[i] = cIdx;

    r[i] = entry.reach;
    k[i] = entry.clicks;
    sCol[i] = entry.cost;
    o[i] = entry.orders;
    src[i] = SOURCE_TO_NUM[entry.source] ?? 0;
  }

  const payload: ColumnarPayload = {
    v: s.v,
    epoch,
    campaigns: campaignsList,
    settings: s.settings ?? DEFAULT_SETTINGS,
    cols: { d, c, r, k, s: sCol, o, src },
  };

  return JSON.stringify(payload);
}

/** Ném lỗi có mã (VD 'CORRUPT_STATE') nếu hỏng */
export function decodeState(raw: string): PersistedState {
  if (!raw || typeof raw !== 'string') {
    throw new Error('CORRUPT_STATE: Empty payload');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CORRUPT_STATE: Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('CORRUPT_STATE: Payload not an object');
  }

  const p = parsed as Partial<ColumnarPayload>;
  if (p.v !== CONTRACT_VERSION || !p.cols || !p.epoch) {
    throw new Error('CORRUPT_STATE: Version or column mismatch');
  }

  const cols = p.cols;
  const epoch = p.epoch;
  const campaigns = Array.isArray(p.campaigns) ? p.campaigns : [];
  const settings = (p.settings as Settings) ?? DEFAULT_SETTINGS;

  const count = cols.d?.length ?? 0;
  const entries: DailyEntry[] = new Array(count);
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const dayOffset = cols.d?.[i] ?? 0;
    const date = addDays(epoch, dayOffset);
    const campIdx = cols.c?.[i] ?? 0;
    const campaignId = campaigns[campIdx]?.id ?? 'default';
    const id = `${campaignId}|${date}`;
    const sourceIdx = cols.src?.[i] ?? 0;
    const source = NUM_TO_SOURCE[sourceIdx] ?? 'manual';

    entries[i] = {
      id,
      date,
      campaignId,
      reach: cols.r?.[i] ?? 0,
      clicks: cols.k?.[i] ?? 0,
      cost: cols.s?.[i] ?? 0,
      orders: cols.o?.[i] ?? 0,
      source,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    v: CONTRACT_VERSION,
    campaigns,
    entries,
    settings,
  };
}
