/**
 * STORE TẠM (TL-03) — in-memory, nạp 30 ngày demo sinh tại chỗ để frontend dựng UI ngay.
 * data-engineer thay toàn bộ file này ở DATA-04 (giữ nguyên interface DataState).
 */
import { create } from 'zustand';

import { notImplemented } from '@/lib/notImplemented';
import type {
  Campaign,
  Checksum,
  DailyEntry,
  DuplicatePolicy,
  EntryInput,
  EntrySource,
  HealthArea,
  HealthStatus,
  ImportReport,
  Settings,
  StorageAdapter,
  ValidationResult,
} from '@/types/domain';
import { ALL_CAMPAIGNS } from '@/types/domain';

export interface DataState {
  hydrated: boolean;
  campaigns: Campaign[];
  entries: DailyEntry[];
  settings: Settings;
  revision: number;
  checksum: Checksum;
  health: Record<HealthArea, HealthStatus>;
  storage: { kind: StorageAdapter['kind']; usedBytes: number; quotaBytes: number };
  addEntries(inputs: EntryInput[], policy?: DuplicatePolicy): { added: number; conflicts: EntryInput[] };
  updateEntry(id: string, patch: Partial<EntryInput>): ValidationResult;
  removeEntries(ids: string[]): DailyEntry[];
  restoreEntries(entries: DailyEntry[]): void;
  undoLast(): boolean;
  importBatch(inputs: EntryInput[], source: EntrySource, policy: DuplicatePolicy): ImportReport;
  upsertCampaign(c: Pick<Campaign, 'name'> & { id?: string }): Campaign;
  setSettings(patch: Partial<Settings>): void;
  loadMock(name: 'demo-30d' | 'campaign-2y' | 'edge-cases'): Promise<void>;
  clearAll(): Promise<void>;
  exportBackup(filter?: { years?: number[] }): string;
  importBackup(json: string): ImportReport;
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

const DEMO_CAMPAIGN: Campaign = { id: 'default', name: 'Chiến dịch chính', createdAt: 0 };

/** 30 ngày demo cố định (kết thúc 2026-10-29), có mùa vụ cuối tuần — chỉ để dựng UI. */
function makeTempDemo(): DailyEntry[] {
  const out: DailyEntry[] = [];
  const end = Date.UTC(2026, 9, 29);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000);
    const date = d.toISOString().slice(0, 10); // an toàn: mốc UTC tự dựng, không phải ngày người dùng
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 1.25 : 1;
    const t = 29 - i;
    const reach = Math.round((12_000 + t * 150) * weekend);
    const clicks = Math.round(reach * 0.021);
    const cost = Math.round(clicks * 5_800);
    const orders = Math.round(clicks * 0.032);
    out.push({
      id: `${DEMO_CAMPAIGN.id}|${date}`,
      date,
      campaignId: DEMO_CAMPAIGN.id,
      reach,
      clicks,
      cost,
      orders,
      source: 'mock',
      createdAt: 0,
      updatedAt: 0,
    });
  }
  return out;
}

function checksumOf(entries: DailyEntry[]): Checksum {
  const c: Checksum = { rows: entries.length, reach: 0, clicks: 0, cost: 0, orders: 0 };
  for (const e of entries) {
    c.reach += e.reach;
    c.clicks += e.clicks;
    c.cost += e.cost;
    c.orders += e.orders;
  }
  return c;
}

const demo = makeTempDemo();

export const useDataStore = create<DataState>()((set) => ({
  hydrated: true,
  campaigns: [DEMO_CAMPAIGN],
  entries: demo,
  settings: DEFAULT_SETTINGS,
  revision: 1,
  checksum: checksumOf(demo),
  health: { storage: 'ok', worker: 'ok', sync: 'ok', rollup: 'ok' },
  storage: { kind: 'memory', usedBytes: 0, quotaBytes: 0 },
  addEntries: () => notImplemented('DATA-04'),
  updateEntry: () => notImplemented('DATA-04'),
  removeEntries: () => notImplemented('DATA-04'),
  restoreEntries: () => notImplemented('DATA-04'),
  undoLast: () => notImplemented('DATA-04'),
  importBatch: () => notImplemented('DATA-07'),
  upsertCampaign: () => notImplemented('FI-04'),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  loadMock: () => notImplemented('DATA-04'),
  clearAll: () => notImplemented('DATA-04'),
  exportBackup: () => notImplemented('DATA-04'),
  importBackup: () => notImplemented('DATA-04'),
}));
