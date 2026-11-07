import { expose } from 'comlink';

import { parseCsv } from '@/lib/data/import/csv';

import { prepareImport, type ImportMapping } from './importPreparation';

let rows: Record<string, string>[] = [];

const api = {
  async read(file: File, progress: (percent: number) => void) {
    const parsed = await parseCsv(file, progress);
    rows = parsed.rows;
    return { ...parsed, rows: rows.slice(0, 20), rowCount: rows.length };
  },
  prepare(mapping: ImportMapping, campaignId: string, today: string) {
    return prepareImport(rows, mapping, campaignId, 'csv', today);
  },
};

export type CsvImportWorkerApi = typeof api;
expose(api);
