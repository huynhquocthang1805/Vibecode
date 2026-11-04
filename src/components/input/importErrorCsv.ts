import type { ImportReport } from '@/types/domain';

/** Quote every cell and neutralize spreadsheet formula prefixes, including control characters. */
export function encodeCsvCell(value: string): string {
  return `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
}

export function importErrorCsv(report: ImportReport): string {
  return (
    '\uFEFF' +
    [
      'Dòng,Lỗi,Dữ liệu',
      ...report.rejected.map((row) =>
        [String(row.row), row.issues.map((issue) => issue.message).join('; '), JSON.stringify(row.raw)]
          .map(encodeCsvCell)
          .join(','),
      ),
    ].join('\r\n')
  );
}
