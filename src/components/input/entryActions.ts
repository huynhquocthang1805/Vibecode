import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { sumTotals } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import { LIMITS, type DuplicatePolicy, type EntryInput } from '@/types/domain';

/** Kiểm tra sức chứa và giới hạn trước khi gọi hành động của store. */
export function assertEntriesCanBeSaved(inputs: EntryInput[], policy: DuplicatePolicy) {
  const store = useDataStore.getState();
  if (!store.hydrated) throw new Error('Dữ liệu đang tải, vui lòng đợi.');
  const existing = new Map(store.entries.map((row) => [row.id, row]));
  const keys = new Set(inputs.map((row) => `${row.campaignId}|${row.date}`));
  if (keys.size !== inputs.length) throw new Error('Có ngày trùng trong bản nháp. Hãy sửa ngày hoặc xoá dòng trùng.');
  const newKeys = [...keys].filter((key) => !existing.has(key));
  if (store.entries.length + newKeys.length > LIMITS.MAX_ROWS_TOTAL)
    throw new Error('Đã đạt giới hạn dữ liệu. Hãy xuất và lưu trữ dữ liệu cũ.');
  if (policy === 'sum') {
    for (const input of inputs) {
      const old = existing.get(`${input.campaignId}|${input.date}`);
      if (old) {
        const result = validateEntry({ ...input, ...sumTotals([old, input]) }, { today: todayVN() });
        if (!result.ok)
          throw new Error(result.issues.find((i) => i.level === 'error')?.message ?? 'Không thể cộng dồn dòng này.');
      }
    }
  }
}

export function saveValidatedEntries(inputs: EntryInput[], policy: DuplicatePolicy) {
  assertEntriesCanBeSaved(inputs, policy);
  return useDataStore.getState().addEntries(inputs, policy);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
