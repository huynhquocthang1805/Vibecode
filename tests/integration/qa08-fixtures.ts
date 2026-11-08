import { DEFAULT_SETTINGS } from '@/lib/data/storage/codec';
import { addDays } from '@/lib/domain/dates';
import { CONTRACT_VERSION, type DailyEntry, type PersistedState } from '@/types/domain';

export const QA_TODAY = '2026-11-07';
export function row(day = 0, campaign = 0, reach = 1000, year = '2026'): DailyEntry {
  const date = addDays(`${year}-11-01`, day),
    campaignId = `camp-${campaign}`;
  return {
    id: `${campaignId}|${date}`,
    date,
    campaignId,
    reach,
    clicks: Math.min(20, reach),
    cost: 100000,
    orders: 2,
    source: 'mock',
    createdAt: 1,
    updatedAt: 1,
  };
}
export function persisted(entries: DailyEntry[]): PersistedState {
  return {
    v: CONTRACT_VERSION,
    entries,
    campaigns: Array.from({ length: 6 }, (_, i) => ({ id: `camp-${i}`, name: `Chiến dịch ${i}`, createdAt: 1 })),
    settings: { ...DEFAULT_SETTINGS },
  };
}
export const business = (entries: DailyEntry[]) =>
  entries.map(({ createdAt: _c, updatedAt: _u, ...entry }) => entry).sort((a, b) => a.id.localeCompare(b.id));
export const checksum = (entries: DailyEntry[]) =>
  entries.reduce(
    (sum, entry) => ({
      rows: sum.rows + 1,
      reach: sum.reach + entry.reach,
      clicks: sum.clicks + entry.clicks,
      cost: sum.cost + entry.cost,
      orders: sum.orders + entry.orders,
    }),
    { rows: 0, reach: 0, clicks: 0, cost: 0, orders: 0 },
  );
