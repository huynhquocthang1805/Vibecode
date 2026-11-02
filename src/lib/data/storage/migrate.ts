import type { DailyEntry, PersistedState } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { decodeState, DEFAULT_SETTINGS } from './codec';

export function migrate(raw: unknown): PersistedState {
  if (!raw) {
    throw new Error('MIGRATION_FAILED: Empty raw input');
  }

  // Nếu là chuỗi JSON
  if (typeof raw === 'string') {
    try {
      return decodeState(raw);
    } catch {
      try {
        const parsed = JSON.parse(raw);
        return migrate(parsed);
      } catch {
        throw new Error('MIGRATION_FAILED: Cannot parse string');
      }
    }
  }

  // Nếu là mảng (v0 prototype data)
  if (Array.isArray(raw)) {
    const now = Date.now();
    const entries: DailyEntry[] = raw.map((item: Record<string, unknown>) => {
      const date = String(item.date ?? '2026-01-01');
      const campaignId = String(item.campaignId ?? 'default');
      return {
        id: `${campaignId}|${date}`,
        date,
        campaignId,
        reach: Number(item.reach ?? 0),
        clicks: Number(item.clicks ?? 0),
        cost: Number(item.cost ?? 0),
        orders: Number(item.orders ?? 0),
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      };
    });

    return {
      v: CONTRACT_VERSION,
      campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: now }],
      entries,
      settings: DEFAULT_SETTINGS,
    };
  }

  // Nếu là object PersistedState đã có sẵn
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Partial<PersistedState>;
    if (Array.isArray(obj.entries)) {
      return {
        v: CONTRACT_VERSION,
        campaigns: Array.isArray(obj.campaigns) && obj.campaigns.length > 0
          ? obj.campaigns
          : [{ id: 'default', name: 'Chiến dịch chính', createdAt: Date.now() }],
        entries: obj.entries,
        settings: obj.settings ?? DEFAULT_SETTINGS,
      };
    }
  }

  throw new Error('MIGRATION_FAILED: Unknown raw format');
}
