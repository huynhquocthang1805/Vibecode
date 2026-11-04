import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';
import { LIMITS, type EntryInput } from '@/types/domain';

import { saveValidatedEntries } from './entryActions';

const input: EntryInput = { date: '2026-11-01', campaignId: 'default', reach: 100, clicks: 10, cost: 1000, orders: 1 };
beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
  useDataStore.setState({
    hydrated: true,
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    checksum: { rows: 0, reach: 0, clicks: 0, cost: 0, orders: 0 },
  });
});

describe('Rào chắn trước khi lưu form', () => {
  it('từ chối khi chưa hydrate', () => {
    useDataStore.setState({ hydrated: false });
    expect(() => saveValidatedEntries([input], 'ask')).toThrow(/đang tải/);
  });
  it('không ghi một phần khi bản nháp chứa khoá trùng', () => {
    expect(() => saveValidatedEntries([input, input], 'overwrite')).toThrow(/trùng trong bản nháp/);
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
  it('từ chối cộng dồn vượt MAX_VALUE trước khi thay đổi dữ liệu', () => {
    useDataStore.getState().addEntries([{ ...input, cost: LIMITS.MAX_VALUE.cost }]);
    expect(() => saveValidatedEntries([input], 'sum')).toThrow(/quá lớn/);
    expect(useDataStore.getState().entries[0]?.cost).toBe(LIMITS.MAX_VALUE.cost);
  });
  it('cho ghi đè đúng ngày khi đã xác nhận', () => {
    useDataStore.getState().addEntries([input]);
    expect(saveValidatedEntries([{ ...input, cost: 2000 }], 'overwrite').added).toBe(1);
    expect(useDataStore.getState().entries[0]?.cost).toBe(2000);
  });
});
