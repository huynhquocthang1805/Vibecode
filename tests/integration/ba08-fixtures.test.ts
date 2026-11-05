import { mkdtemp, readFile, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import cases from '@/fixtures/edge-cases.json';
import { daysBetween } from '@/lib/domain/dates';
import { LIMITS } from '@/types/domain';

import { encodeAdsCsv, generate, generateAdsCsv, generateSparse, main } from '../../scripts/gen-mock';

const fixed = { seed: 20261106, today: '2026-11-06' };

describe('BA-08 · fixtures và generator', () => {
  it('E31–E50 đủ, ID duy nhất và có kỳ vọng máy đọc được', () => {
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
    for (let number = 31; number <= 50; number++) {
      const item = cases.find((entry) => entry.id === `E${number}`);
      expect(item).toBeDefined();
      expect(item?.input).toBeDefined();
      expect(Object.keys(item?.expect ?? {}).length).toBeGreaterThan(0);
    }
  });
  it('200k dòng trên 100 chiến dịch, khoảng 5,5 năm, khóa duy nhất', () => {
    const rows = generate(LIMITS.MAX_ROWS_TOTAL, { ...fixed, campaignCount: LIMITS.MAX_CAMPAIGNS });
    expect(rows).toHaveLength(200000);
    expect(new Set(rows.map((row) => row.id)).size).toBe(200000);
    expect(new Set(rows.map((row) => row.campaignId)).size).toBe(100);
    expect(daysBetween(rows[0]!.date, rows.at(-1)!.date)).toBe(1999);
  }, 30000);
  it('cùng seed cho cùng dữ liệu; vượt giới hạn bị từ chối', () => {
    expect(generate(200, fixed)).toEqual(generate(200, fixed));
    expect(() => generate(LIMITS.MAX_ROWS_TOTAL + 1, fixed)).toThrow();
    expect(() => generate(200, { ...fixed, campaignCount: LIMITS.MAX_CAMPAIGNS + 1 })).toThrow();
  });
  it('sparse chỉ chứa 62 ngày quan sát thuộc 2015 và 2026', () => {
    const rows = generateSparse(fixed);
    expect(rows).toHaveLength(62);
    expect(rows[0]?.date).toBe('2015-01-01');
    expect(rows.at(-1)?.date).toBe('2026-10-31');
    expect(new Set(rows.map((row) => row.date.slice(0, 4)))).toEqual(new Set(['2015', '2026']));
    expect(() => generateSparse({ ...fixed, today: '2026-10-01' })).toThrow('INVALID_DATE_RANGE');
  });
  it.each(['utf-8-bom', 'utf-16le', 'windows-1258'] as const)(
    'CSV %s giải mã về cùng nội dung tiếng Việt',
    (encoding) => {
      const text = generateAdsCsv();
      const bytes = encodeAdsCsv(text, encoding);
      const decoded = new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding).decode(bytes).normalize('NFC');
      expect(decoded).toBe(text);
      expect(decoded.split('\r\n')[3]).toBe('Ngày;Tên chiến dịch;Lượt tiếp cận;Lượt click;Chi phí;Đơn hàng');
      expect(decoded.split('\r\n').filter((line) => line.startsWith('20/10/2026;'))).toHaveLength(3);
      expect(decoded).toContain('Tổng cộng;;6.000;120;600.000;6');
    },
  );
  it('CP1258 có byte chuẩn cho dấu tiếng Việt và từ chối emoji không biểu diễn được', () => {
    expect(Array.from(encodeAdsCsv('Đế', 'windows-1258'))).toEqual([0xd0, 0xea, 0xec]);
    expect(() => encodeAdsCsv('💡', 'windows-1258')).toThrow('UNENCODABLE_WINDOWS_1258');
  });
  it('CLI ghi ba CSV đúng encoding trong thư mục được chọn', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kpi-ba08-'));
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      await main(['--dataset', 'ads-csv', '--out', dir, '--today', fixed.today]);
      expect(await readdir(dir)).toHaveLength(3);
      expect((await readFile(join(dir, 'ads-utf-16le.csv'))).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]));
      await expect(main(['--dataset', 'sparse', '--rows', '500', '--out', dir])).rejects.toThrow(
        'CUSTOM_SIZE_REQUIRES_STRESS',
      );
    } finally {
      output.mockRestore();
      for (const name of await readdir(dir)) await unlink(join(dir, name));
      await rmdir(dir);
    }
  });
});
