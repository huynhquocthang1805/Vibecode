import { notImplemented } from '@/lib/notImplemented';

/** Dán TSV từ Excel/Google Sheets, có hoặc không có header */
export function parsePastedTable(_text: string): { rows: Record<string, string>[]; headers: string[] } {
  return notImplemented('DATA-07');
}
