import { notImplemented } from '@/lib/notImplemented';

export interface ParsedCsv {
  rows: Record<string, string>[];
  headers: string[];
  encoding: string;
  delimiter: string;
}

/** Papaparse worker + chunk; nhận mã hoá/phân cách (docs/13 §6) */
export function parseCsv(_file: File, _onProgress?: (p: number) => void, _signal?: AbortSignal): Promise<ParsedCsv> {
  return notImplemented('DATA-07');
}
