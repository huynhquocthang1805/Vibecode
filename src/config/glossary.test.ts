import { describe, expect, it } from 'vitest';

import { GLOSSARY, UI_MICROCOPY, glossaryFor } from './glossary';

describe('BA-07 — thuật ngữ dễ hiểu và microcopy', () => {
  it('có đúng các khái niệm nghiệp vụ bắt buộc', () => {
    for (const key of ['CTR', 'CPC', 'CPA', 'CVR', 'reach', 'nowcast', 'khoảng tin cậy', 'bất thường']) {
      expect(GLOSSARY[key], key).toBeTruthy();
    }
  });
  it('mỗi định nghĩa bổ sung trong BA-07 ngắn, không quá 2 câu', () => {
    // Không áp hạn mức BA-07 hồi tố lên mô tả của BA-02 đã được main sử dụng.
    // Ví dụ cpa lowercase trên main có 3 câu; đó là nội dung có chủ đích.
    for (const key of ['CTR', 'CPC', 'CPA', 'CVR', 'khoảng tin cậy', 'bất thường']) {
      const value = GLOSSARY[key];
      expect(value, key).toBeDefined();
      if (typeof value !== 'string') {
        throw new Error(`Thiếu định nghĩa glossary BA-07: ${key}`);
      }
      expect(value.trim().length, key).toBeGreaterThan(20);
      expect(value.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length, key).toBeLessThanOrEqual(2);
    }
  });
  it('không làm mất các thuật ngữ BA-02 đang dùng trong dashboard', () => {
    for (const key of ['reach', 'clicks', 'cost', 'orders', 'ctr', 'cpc', 'cpa', 'cvr', 'nowcast', 'likeForLike', 'forecastInterval']) {
      expect(GLOSSARY[key], key).toBeTruthy();
    }
  });
  it('tra cứu không phân biệt hoa thường và không đoán thuật ngữ lạ', () => {
    expect(glossaryFor(' cPa ')).toBe(GLOSSARY.CPA);
    expect(glossaryFor('không tồn tại')).toBeNull();
  });
  it('không gọi CPA=0 khi chưa có đơn và không biến dự báo thành thực tế', () => {
    expect(UI_MICROCOPY.empty.noOrders).toContain('—');
    expect(UI_MICROCOPY.empty.noForecast.detail).toContain('không có nghĩa');
    expect(GLOSSARY.nowcast).toContain('không phải số thực tế');
  });
  it('có thông điệp empty/loading/error và hành động xử lý', () => {
    expect(Object.keys(UI_MICROCOPY.empty).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(UI_MICROCOPY.loading).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(UI_MICROCOPY.error).length).toBeGreaterThanOrEqual(3);
    expect(UI_MICROCOPY.empty.noEntries.action.length).toBeGreaterThan(0);
  });
});
