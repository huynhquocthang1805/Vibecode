import { autoMapHeaders } from './headers';

/** Dán TSV từ Excel/Google Sheets, có hoặc không có header */
export function parsePastedTable(text: string): { rows: Record<string, string>[]; headers: string[] } {
  if (!text || typeof text !== 'string') {
    return { rows: [], headers: [] };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], headers: [] };
  }

  const rawFirstRow = lines[0]!.split('\t').map((c) => c.trim());
  const mapped = autoMapHeaders(rawFirstRow);
  const matchedFieldCount = Object.keys(mapped).length;

  let headers: string[];
  let startLine = 0;

  if (matchedFieldCount >= 2) {
    // Dòng đầu tiên là header
    headers = rawFirstRow;
    startLine = 1;
  } else {
    // Không có header trong bảng dán: suy luận tên cột mặc định
    if (rawFirstRow.length === 6) {
      headers = ['date', 'campaign', 'reach', 'clicks', 'cost', 'orders'];
    } else if (rawFirstRow.length === 5) {
      headers = ['date', 'reach', 'clicks', 'cost', 'orders'];
    } else {
      headers = rawFirstRow.map((_, idx) => `col_${idx + 1}`);
    }
    startLine = 0;
  }

  const rows: Record<string, string>[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!;
    const cells = line.split('\t').map((c) => c.trim());
    if (cells.every((c) => c === '')) {
      continue;
    }

    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c]!;
      row[headerName] = cells[c] ?? '';
    }
    rows.push(row);
  }

  return { rows, headers };
}
