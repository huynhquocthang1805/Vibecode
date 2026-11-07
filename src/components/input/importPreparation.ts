import { validateBatch } from '@/lib/domain/validation';

export const IMPORT_FIELDS = [
  ['date', 'Ngày'],
  ['reach', 'Reach'],
  ['clicks', 'Click'],
  ['cost', 'Chi phí'],
  ['orders', 'Đơn hàng'],
] as const;

export type ImportMapping = Partial<Record<(typeof IMPORT_FIELDS)[number][0], string>>;

export function prepareImport(
  rows: Record<string, string>[],
  mapping: ImportMapping,
  campaignId: string,
  source: 'csv' | 'paste',
  today: string,
) {
  const raw = rows.map((row) => ({
    date: row[mapping.date ?? ''],
    reach: row[mapping.reach ?? ''],
    clicks: row[mapping.clicks ?? ''],
    cost: row[mapping.cost ?? ''],
    orders: row[mapping.orders ?? ''],
    campaignId,
    source,
  }));
  return validateBatch(raw, { today });
}
