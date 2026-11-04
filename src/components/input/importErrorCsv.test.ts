import { describe, expect, it } from 'vitest';

import { encodeCsvCell, importErrorCsv } from './importErrorCsv';

describe('FI-03 R-02/R-03 — CSV lỗi an toàn', () => {
  it.each(['=SUM(A1)', '+1', '@cmd', '-1', '\t=1', '\r=1'])('chặn công thức %j', (value) => {
    expect(encodeCsvCell(value)).toBe(`"'${value}"`);
  });
  it('quote dấu phẩy, xuống dòng và nhân đôi dấu nháy', () => {
    expect(encodeCsvCell('nói "xin chào",\nđược')).toBe('"nói ""xin chào"",\nđược"');
    expect(encodeCsvCell('Ngày')).toBe('"Ngày"');
  });
  it('tạo file UTF-8 BOM và CRLF với dữ liệu gốc đã quote', () => {
    const csv = importErrorCsv({
      totalRows: 1,
      accepted: 0,
      rejected: [
        {
          row: 1,
          raw: { reach: '=1' },
          issues: [{ field: 'reach', code: 'NOT_NUMBER', level: 'error', message: '\t=1' }],
        },
      ],
      rejectedTotal: 1,
      warnings: [],
      warningTotal: 0,
      mergedInFile: 0,
      detailsTruncated: false,
      aborted: false,
      durationMs: 0,
    });
    expect(csv).toBe('\uFEFFDòng,Lỗi,Dữ liệu\r\n"1","\'\t=1","{""reach"":""=1""}"');
  });
});
