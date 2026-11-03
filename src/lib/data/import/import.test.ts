import { describe, expect, it } from 'vitest';

import { useDataStore } from '@/lib/data/store';
import { LIMITS } from '@/types/domain';

import { parseCsv } from './csv';
import { autoMapHeaders } from './headers';
import { parsePastedTable } from './paste';

describe('DATA-07 · autoMapHeaders', () => {
  it('E34: nhận diện header Ngày có BOM UTF-8', () => {
    const headers = ['\uFEFFNgày', 'Chiến dịch', 'Tiếp cận', 'Click', 'Chi phí', 'Đơn hàng'];
    const mapped = autoMapHeaders(headers);

    expect(mapped.date).toBe('\uFEFFNgày');
    expect(mapped.campaign).toBe('Chiến dịch');
    expect(mapped.reach).toBe('Tiếp cận');
    expect(mapped.clicks).toBe('Click');
    expect(mapped.cost).toBe('Chi phí');
    expect(mapped.orders).toBe('Đơn hàng');
  });

  it('E35: nhận diện các biến thể tiếng Việt không dấu và Ads Manager', () => {
    const headers = [
      'thoi gian',
      'ten chien dich',
      'luot tiep can',
      'nhap',
      'so tien da chi tieu',
      'chuyen doi',
    ];
    const mapped = autoMapHeaders(headers);

    expect(mapped.date).toBe('thoi gian');
    expect(mapped.campaign).toBe('ten chien dich');
    expect(mapped.reach).toBe('luot tiep can');
    expect(mapped.clicks).toBe('nhap');
    expect(mapped.cost).toBe('so tien da chi tieu');
    expect(mapped.orders).toBe('chuyen doi');
  });
});

describe('DATA-07 · parsePastedTable', () => {
  it('parse bảng TSV có dòng header', () => {
    const text = 'Ngày\tChiến dịch\tReach\tClicks\tCost\tOrders\n2026-10-15\tdefault\t1000\t50\t100000\t5';
    const result = parsePastedTable(text);

    expect(result.headers).toEqual(['Ngày', 'Chiến dịch', 'Reach', 'Clicks', 'Cost', 'Orders']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      Ngày: '2026-10-15',
      'Chiến dịch': 'default',
      Reach: '1000',
      Clicks: '50',
      Cost: '100000',
      Orders: '5',
    });
  });

  it('parse bảng TSV không có header (tự gán cột)', () => {
    const text = '2026-10-15\t1000\t50\t100000\t5';
    const result = parsePastedTable(text);

    expect(result.headers).toEqual(['date', 'reach', 'clicks', 'cost', 'orders']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      date: '2026-10-15',
      reach: '1000',
      clicks: '50',
      cost: '100000',
      orders: '5',
    });
  });
});

describe('DATA-07 · parseCsv', () => {
  it('E36: CSV phân cách dấu chấm phẩy ;', async () => {
    const csvContent = 'Ngày;Chiến dịch;Tiếp cận;Nhấp;Chi phí;Đơn hàng\n2026-10-15;default;1000;50;100000;5';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await parseCsv(file);
    expect(result.delimiter).toBe(';');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.['Ngày']).toBe('2026-10-15');
    expect(result.rows[0]?.['Chi phí']).toBe('100000');
  });

  it('E37: CSV có 3 dòng tiêu đề trước header', async () => {
    const csvContent = [
      'BÁO CÁO CHIẾN DỊCH QUẢNG CÁO',
      'Thời gian xuất: 2026-10-20',
      'Đơn vị tiền tệ: VND',
      'Ngày,Chiến dịch,Tiếp cận,Nhấp,Chi phí,Đơn hàng',
      '2026-10-15,default,1000,50,100000,5',
    ].join('\n');

    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    const result = await parseCsv(file);

    expect(result.headers).toEqual(['Ngày', 'Chiến dịch', 'Tiếp cận', 'Nhấp', 'Chi phí', 'Đơn hàng']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.['Ngày']).toBe('2026-10-15');
  });

  it('hỗ trợ AbortSignal khi người dùng huỷ', async () => {
    const csvContent = 'Ngày,Chiến dịch,Tiếp cận,Nhấp,Chi phí,Đơn hàng\n2026-10-15,default,1000,50,100000,5';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    const controller = new AbortController();
    controller.abort();

    await expect(parseCsv(file, undefined, controller.signal)).rejects.toThrow('ABORTED');
  });
});

describe('DATA-07 · store importBatch', () => {
  it('E38: bỏ qua hàng tổng cộng với cảnh báo SUMMARY_ROW', async () => {
    const store = useDataStore.getState();
    await store.clearAll();

    const inputs = [
      { date: '2026-10-15', campaignId: 'default', reach: 1000, clicks: 50, cost: 100000, orders: 5 },
      { date: 'Tổng cộng', campaignId: 'default', reach: 1000, clicks: 50, cost: 100000, orders: 5 },
    ];

    const report = store.importBatch(inputs, 'csv', 'overwrite');

    expect(report.accepted).toBe(1);
    expect(report.warnings.some((w) => w.issues.some((i) => i.code === 'SUMMARY_ROW'))).toBe(true);
    expect(useDataStore.getState().entries).toHaveLength(1);
  });

  it('E39: 3 dòng cùng ngày + chiến dịch trong 1 file gộp sum thành 1, mergedInFile = 2', async () => {
    const store = useDataStore.getState();
    await store.clearAll();

    const inputs = [
      { date: '2026-10-15', campaignId: 'default', reach: 100, clicks: 10, cost: 1000, orders: 1 },
      { date: '2026-10-15', campaignId: 'default', reach: 200, clicks: 20, cost: 2000, orders: 2 },
      { date: '2026-10-15', campaignId: 'default', reach: 300, clicks: 30, cost: 3000, orders: 3 },
    ];

    const report = store.importBatch(inputs, 'csv', 'overwrite');

    expect(report.mergedInFile).toBe(2);
    expect(report.accepted).toBe(1);

    const saved = useDataStore.getState().entries;
    expect(saved).toHaveLength(1);
    expect(saved[0]?.reach).toBe(600);
    expect(saved[0]?.clicks).toBe(60);
    expect(saved[0]?.cost).toBe(6000);
    expect(saved[0]?.orders).toBe(6);
  });

  it('E40: từ chối import khi vượt MAX_ROWS_TOTAL (aborted: true, dữ liệu không đổi)', async () => {
    const store = useDataStore.getState();
    await store.clearAll();

    // Giả lập vượt sức chứa
    const bigBatch = new Array(LIMITS.MAX_ROWS_TOTAL + 1).fill(null).map((_, i) => ({
      date: '2026-10-15',
      campaignId: `camp_${i}`,
      reach: 100,
      clicks: 10,
      cost: 1000,
      orders: 1,
    }));

    const report = store.importBatch(bigBatch, 'csv', 'overwrite');

    expect(report.aborted).toBe(true);
    expect(report.accepted).toBe(0);
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
});
