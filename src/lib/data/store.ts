import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { bus } from '@/lib/data/realtime/bus';
import { createLocalStorageAdapter } from '@/lib/data/storage/localStorageAdapter';
import { todayVN } from '@/lib/domain/dates';
import { validateBatch, validateEntry } from '@/lib/domain/validation';
import type {
  Campaign,
  Checksum,
  DailyEntry,
  DuplicatePolicy,
  EntryDelta,
  EntryInput,
  EntrySource,
  HealthArea,
  HealthStatus,
  ImportReport,
  PersistedState,
  Settings,
  StorageAdapter,
  ValidationResult,
} from '@/types/domain';
import { ALL_CAMPAIGNS, CONTRACT_VERSION, LIMITS } from '@/types/domain';

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

const DEFAULT_CAMPAIGN: Campaign = {
  id: 'default',
  name: 'Chiến dịch chính',
  createdAt: 0,
};

function computeChecksum(entries: DailyEntry[]): Checksum {
  const c: Checksum = { rows: entries.length, reach: 0, clicks: 0, cost: 0, orders: 0 };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    c.reach += e.reach;
    c.clicks += e.clicks;
    c.cost += e.cost;
    c.orders += e.orders;
  }
  return c;
}

function updateChecksumWithDelta(c: Checksum, delta: EntryDelta): Checksum {
  const next: Checksum = {
    rows: c.rows + delta.added.length - delta.removed.length,
    reach: c.reach,
    clicks: c.clicks,
    cost: c.cost,
    orders: c.orders,
  };
  for (const a of delta.added) {
    next.reach += a.reach;
    next.clicks += a.clicks;
    next.cost += a.cost;
    next.orders += a.orders;
  }
  for (const r of delta.removed) {
    next.reach -= r.reach;
    next.clicks -= r.clicks;
    next.cost -= r.cost;
    next.orders -= r.orders;
  }
  return next;
}

interface UndoOperation {
  timestamp: number;
  delta: EntryDelta; // delta đã xảy ra: undo sẽ làm ngược lại
}

const undoStack: UndoOperation[] = [];

// Storage Adapter & Debounced persistence
const storageAdapter = createLocalStorageAdapter();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let firstPersistRequestTime = 0;

function schedulePersist(getState: () => DataState): void {
  const now = Date.now();
  if (firstPersistRequestTime === 0) {
    firstPersistRequestTime = now;
  }

  const flush = () => {
    persistTimer = null;
    firstPersistRequestTime = 0;
    const s = getState();
    const persisted: PersistedState = {
      v: CONTRACT_VERSION,
      campaigns: s.campaigns,
      entries: s.entries,
      settings: s.settings,
    };
    void storageAdapter.save(persisted).then(() => {
      void storageAdapter.usage().then((u) => {
        useDataStore.setState((prev) => ({
          storage: { ...prev.storage, usedBytes: u.usedBytes, quotaBytes: u.quotaBytes },
        }));
      });
    });
  };

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  // Chống đói ghi nếu nhiều thao tác liên tục vượt quá PERSIST_MAX_WAIT_MS
  if (now - firstPersistRequestTime >= LIMITS.PERSIST_MAX_WAIT_MS) {
    flush();
  } else {
    persistTimer = setTimeout(flush, LIMITS.PERSIST_DEBOUNCE_MS);
  }
}

// Lắng nghe sự kiện pagehide / beforeunload để ghi ngay lập tức
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
      firstPersistRequestTime = 0;
      const s = useDataStore.getState();
      void storageAdapter.save({
        v: CONTRACT_VERSION,
        campaigns: s.campaigns,
        entries: s.entries,
        settings: s.settings,
      });
    }
  });
}

export const useDataStore = create<DataState>()(
  subscribeWithSelector((set, get) => ({
    hydrated: false,
    campaigns: [DEFAULT_CAMPAIGN],
    entries: [],
    settings: DEFAULT_SETTINGS,
    revision: 1,
    checksum: computeChecksum([]),
    health: { storage: 'ok', worker: 'ok', sync: 'ok', rollup: 'ok' },
    storage: { kind: storageAdapter.kind, usedBytes: 0, quotaBytes: 5 * 1024 * 1024 },

    addEntries(inputs: EntryInput[], policy?: DuplicatePolicy): { added: number; conflicts: EntryInput[] } {
      const state = get();
      const currentPolicy = policy ?? state.settings.duplicatePolicy;
      const conflicts: EntryInput[] = [];

      // Tra cứu O(1)
      const entryMap = new Map<string, number>();
      for (let i = 0; i < state.entries.length; i++) {
        const e = state.entries[i];
        if (e) entryMap.set(e.id, i);
      }

      const nextEntries = [...state.entries];
      const addedList: DailyEntry[] = [];
      const removedList: DailyEntry[] = [];
      const now = Date.now();

      for (const input of inputs) {
        const campaignId = input.campaignId || 'default';
        const id = `${campaignId}|${input.date}`;
        const existingIdx = entryMap.get(id);

        if (existingIdx !== undefined) {
          if (currentPolicy === 'ask') {
            conflicts.push(input);
            continue;
          }
          if (currentPolicy === 'skip') {
            continue;
          }
          const oldEntry = nextEntries[existingIdx];
          if (!oldEntry) continue;

          removedList.push(oldEntry);

          if (currentPolicy === 'overwrite') {
            const updated: DailyEntry = {
              ...oldEntry,
              reach: input.reach,
              clicks: input.clicks,
              cost: input.cost,
              orders: input.orders,
              source: input.source ?? oldEntry.source,
              updatedAt: now,
            };
            nextEntries[existingIdx] = updated;
            addedList.push(updated);
          } else if (currentPolicy === 'sum') {
            const updated: DailyEntry = {
              ...oldEntry,
              reach: oldEntry.reach + input.reach,
              clicks: oldEntry.clicks + input.clicks,
              cost: oldEntry.cost + input.cost,
              orders: oldEntry.orders + input.orders,
              source: input.source ?? oldEntry.source,
              updatedAt: now,
            };
            nextEntries[existingIdx] = updated;
            addedList.push(updated);
          }
        } else {
          const newEntry: DailyEntry = {
            id,
            date: input.date,
            campaignId,
            reach: input.reach,
            clicks: input.clicks,
            cost: input.cost,
            orders: input.orders,
            source: input.source ?? 'manual',
            createdAt: now,
            updatedAt: now,
          };
          entryMap.set(id, nextEntries.length);
          nextEntries.push(newEntry);
          addedList.push(newEntry);
        }
      }

      if (addedList.length > 0 || removedList.length > 0) {
        const delta: EntryDelta = { added: addedList, removed: removedList };
        const nextRevision = state.revision + 1;
        const nextChecksum = updateChecksumWithDelta(state.checksum, delta);

        undoStack.push({ timestamp: now, delta });

        set({
          entries: nextEntries,
          revision: nextRevision,
          checksum: nextChecksum,
        });

        bus.emit({
          type: 'entries/changed',
          delta,
          origin: 'local',
          revision: nextRevision,
        });

        schedulePersist(get);
      }

      return { added: addedList.length, conflicts };
    },

    updateEntry(id: string, patch: Partial<EntryInput>): ValidationResult {
      const state = get();
      const existingIdx = state.entries.findIndex((e) => e.id === id);
      if (existingIdx === -1) {
        return {
          ok: false,
          issues: [{ field: 'row', code: 'REQUIRED', level: 'error', message: 'Không tìm thấy dòng cần sửa' }],
        };
      }

      const oldEntry = state.entries[existingIdx];
      if (!oldEntry) {
        return {
          ok: false,
          issues: [{ field: 'row', code: 'REQUIRED', level: 'error', message: 'Dữ liệu không hợp lệ' }],
        };
      }

      const merged: EntryInput = {
        date: patch.date ?? oldEntry.date,
        campaignId: patch.campaignId ?? oldEntry.campaignId,
        reach: patch.reach ?? oldEntry.reach,
        clicks: patch.clicks ?? oldEntry.clicks,
        cost: patch.cost ?? oldEntry.cost,
        orders: patch.orders ?? oldEntry.orders,
        source: patch.source ?? oldEntry.source,
      };

      const validation = validateEntry(merged, { today: todayVN() });
      if (!validation.ok || !validation.value) {
        return validation;
      }

      const validVal = validation.value;
      const nextId = `${validVal.campaignId}|${validVal.date}`;
      const now = Date.now();

      // Nếu đổi ngày/chiến dịch trùng khoá với một dòng khác
      if (nextId !== id) {
        const conflictIdx = state.entries.findIndex((e) => e.id === nextId);
        if (conflictIdx !== -1) {
          // Trùng khoá khi sửa -> áp duplicate policy
          if (state.settings.duplicatePolicy === 'ask') {
            return {
              ok: false,
              issues: [{ field: 'date', code: 'DUPLICATE_DATE', level: 'error', message: 'Ngày này đã có số liệu' }],
            };
          }
        }
      }

      const updatedEntry: DailyEntry = {
        ...oldEntry,
        id: nextId,
        date: validVal.date,
        campaignId: validVal.campaignId,
        reach: validVal.reach,
        clicks: validVal.clicks,
        cost: validVal.cost,
        orders: validVal.orders,
        updatedAt: now,
      };

      const nextEntries = [...state.entries];
      nextEntries[existingIdx] = updatedEntry;

      const delta: EntryDelta = { added: [updatedEntry], removed: [oldEntry] };
      const nextRevision = state.revision + 1;
      const nextChecksum = updateChecksumWithDelta(state.checksum, delta);

      undoStack.push({ timestamp: now, delta });

      set({
        entries: nextEntries,
        revision: nextRevision,
        checksum: nextChecksum,
      });

      bus.emit({
        type: 'entries/changed',
        delta,
        origin: 'local',
        revision: nextRevision,
      });

      schedulePersist(get);

      return validation;
    },

    removeEntries(ids: string[]): DailyEntry[] {
      const state = get();
      const idSet = new Set(ids);
      const remaining: DailyEntry[] = [];
      const removed: DailyEntry[] = [];

      for (const e of state.entries) {
        if (idSet.has(e.id)) {
          removed.push(e);
        } else {
          remaining.push(e);
        }
      }

      if (removed.length > 0) {
        const delta: EntryDelta = { added: [], removed };
        const nextRevision = state.revision + 1;
        const nextChecksum = updateChecksumWithDelta(state.checksum, delta);

        undoStack.push({ timestamp: Date.now(), delta });

        set({
          entries: remaining,
          revision: nextRevision,
          checksum: nextChecksum,
        });

        bus.emit({
          type: 'entries/changed',
          delta,
          origin: 'local',
          revision: nextRevision,
        });

        schedulePersist(get);
      }

      return removed;
    },

    restoreEntries(entriesToRestore: DailyEntry[]): void {
      get().addEntries(entriesToRestore, 'overwrite');
    },

    undoLast(): boolean {
      const op = undoStack.pop();
      if (!op) return false;

      const now = Date.now();
      if (now - op.timestamp > LIMITS.UNDO_TTL_MS) {
        return false;
      }

      const state = get();
      // Đảo ngược delta: thêm lại những gì đã remove, xoá những gì đã add
      const idToRemoved = new Set(op.delta.added.map((e) => e.id));
      const kept = state.entries.filter((e) => !idToRemoved.has(e.id));
      const nextEntries = kept.concat(op.delta.removed);

      const reverseDelta: EntryDelta = {
        added: op.delta.removed,
        removed: op.delta.added,
      };

      const nextRevision = state.revision + 1;
      const nextChecksum = updateChecksumWithDelta(state.checksum, reverseDelta);

      set({
        entries: nextEntries,
        revision: nextRevision,
        checksum: nextChecksum,
      });

      bus.emit({
        type: 'entries/changed',
        delta: reverseDelta,
        origin: 'local',
        revision: nextRevision,
      });

      schedulePersist(get);
      return true;
    },

    importBatch(inputs: EntryInput[], source: EntrySource, policy: DuplicatePolicy): ImportReport {
      const start = Date.now();
      const withSource = inputs.map((i) => ({ ...i, source }));
      const { valid, report } = validateBatch(withSource, { today: todayVN() });

      const { added } = get().addEntries(valid, policy);

      return {
        ...report,
        accepted: added,
        durationMs: Date.now() - start,
      };
    },

    upsertCampaign(c: Pick<Campaign, 'name'> & { id?: string }): Campaign {
      const state = get();
      const sanitizedName = c.name.trim().slice(0, LIMITS.MAX_CAMPAIGN_NAME);
      const now = Date.now();

      if (c.id) {
        const idx = state.campaigns.findIndex((item) => item.id === c.id);
        if (idx !== -1) {
          const updated: Campaign = {
            ...state.campaigns[idx]!,
            name: sanitizedName,
          };
          const nextCampaigns = [...state.campaigns];
          nextCampaigns[idx] = updated;
          set({ campaigns: nextCampaigns });
          schedulePersist(get);
          return updated;
        }
      }

      if (state.campaigns.length >= LIMITS.MAX_CAMPAIGNS) {
        return state.campaigns[0] ?? DEFAULT_CAMPAIGN;
      }

      const newId = c.id ?? `c_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const newCamp: Campaign = {
        id: newId,
        name: sanitizedName,
        createdAt: now,
      };

      set({ campaigns: [...state.campaigns, newCamp] });
      schedulePersist(get);
      return newCamp;
    },

    setSettings(patch: Partial<Settings>): void {
      set((s) => {
        const next = { ...s.settings, ...patch };
        bus.emit({ type: 'settings/changed', patch });
        return { settings: next };
      });
      schedulePersist(get);
    },

    async loadMock(name: 'demo-30d' | 'campaign-2y' | 'edge-cases'): Promise<void> {
      const entries: DailyEntry[] = [];
      const now = Date.now();

      if (name === 'demo-30d') {
        const end = Date.UTC(2026, 9, 29);
        for (let i = 29; i >= 0; i--) {
          const d = new Date(end - i * 86_400_000);
          const date = d.toISOString().slice(0, 10);
          const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 1.25 : 1;
          const t = 29 - i;
          const reach = Math.round((12_000 + t * 150) * weekend);
          const clicks = Math.round(reach * 0.021);
          const cost = Math.round(clicks * 5_800);
          const orders = Math.round(clicks * 0.032);
          entries.push({
            id: `default|${date}`,
            date,
            campaignId: 'default',
            reach,
            clicks,
            cost,
            orders,
            source: 'mock',
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        // Sinh tối thiểu 14 ngày dữ liệu mẫu
        for (let i = 14; i >= 0; i--) {
          const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
          entries.push({
            id: `default|${date}`,
            date,
            campaignId: 'default',
            reach: 5000 + i * 200,
            clicks: 150 + i * 5,
            cost: 800000 + i * 20000,
            orders: 10 + i,
            source: 'mock',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      const delta: EntryDelta = { added: entries, removed: get().entries };
      const nextRevision = get().revision + 1;
      const nextChecksum = computeChecksum(entries);

      set({
        entries,
        revision: nextRevision,
        checksum: nextChecksum,
      });

      bus.emit({
        type: 'entries/changed',
        delta,
        origin: 'local',
        revision: nextRevision,
      });

      schedulePersist(get);
    },

    async clearAll(): Promise<void> {
      const oldEntries = get().entries;
      const delta: EntryDelta = { added: [], removed: oldEntries };
      const nextRevision = get().revision + 1;

      set({
        entries: [],
        campaigns: [DEFAULT_CAMPAIGN],
        revision: nextRevision,
        checksum: computeChecksum([]),
      });

      bus.emit({
        type: 'entries/changed',
        delta,
        origin: 'local',
        revision: nextRevision,
      });

      await storageAdapter.clear();
    },

    exportBackup(filter?: { years?: number[] }): string {
      const state = get();
      let entries = state.entries;
      if (filter?.years && filter.years.length > 0) {
        const yearSet = new Set(filter.years);
        entries = entries.filter((e) => yearSet.has(Number(e.date.slice(0, 4))));
      }

      const payload: PersistedState = {
        v: CONTRACT_VERSION,
        campaigns: state.campaigns,
        entries,
        settings: state.settings,
      };

      return JSON.stringify(payload, null, 2);
    },

    importBackup(json: string): ImportReport {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return {
          totalRows: 0,
          accepted: 0,
          rejected: [],
          warnings: [],
          rejectedTotal: 0,
          warningTotal: 0,
          mergedInFile: 0,
          detailsTruncated: false,
          aborted: true,
          durationMs: 0,
        };
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return {
          totalRows: 0,
          accepted: 0,
          rejected: [],
          warnings: [],
          rejectedTotal: 0,
          warningTotal: 0,
          mergedInFile: 0,
          detailsTruncated: false,
          aborted: true,
          durationMs: 0,
        };
      }

      const p = parsed as Partial<PersistedState>;
      const entriesToImport = Array.isArray(p.entries) ? p.entries : [];
      return get().importBatch(entriesToImport, 'manual', 'overwrite');
    },
  })),
);

// Tự động nạp dữ liệu từ storage (hydration) khi khởi tạo
if (typeof window !== 'undefined') {
  void storageAdapter.load().then((loaded) => {
    if (loaded) {
      useDataStore.setState({
        hydrated: true,
        campaigns: loaded.campaigns?.length > 0 ? loaded.campaigns : [DEFAULT_CAMPAIGN],
        entries: loaded.entries ?? [],
        settings: loaded.settings ?? DEFAULT_SETTINGS,
        checksum: computeChecksum(loaded.entries ?? []),
      });
    } else {
      useDataStore.setState({ hydrated: true });
    }
  });
}
