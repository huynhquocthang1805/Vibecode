import { CONTRACT_VERSION, LIMITS } from './domain';

describe('hợp đồng domain v1', () => {
  it('CONTRACT_VERSION = 1', () => {
    expect(CONTRACT_VERSION).toBe(1);
  });

  it('tổng cộng dồn tối đa luôn là số nguyên an toàn (docs/13 G3)', () => {
    for (const max of Object.values(LIMITS.MAX_VALUE)) {
      expect(Number.isSafeInteger(max * LIMITS.MAX_ROWS_TOTAL)).toBe(true);
    }
  });

  it('MIN_DATE đúng định dạng YYYY-MM-DD', () => {
    expect(LIMITS.MIN_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('nhịp ghi: max-wait lớn hơn debounce (chống đói ghi khi live)', () => {
    expect(LIMITS.PERSIST_MAX_WAIT_MS).toBeGreaterThan(LIMITS.PERSIST_DEBOUNCE_MS);
  });

  it('ngưỡng chuyển IndexedDB nhỏ hơn trần tuyệt đối', () => {
    expect(LIMITS.LOCAL_STORAGE_SOFT_ROWS).toBeLessThan(LIMITS.MAX_ROWS_TOTAL);
  });
});
