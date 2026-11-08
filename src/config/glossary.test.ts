import { describe, expect, it } from 'vitest';

import { GLOSSARY, UI_MICROCOPY, glossaryFor } from './glossary';
import { DEGRADED_COPY, UI_COPY } from './microcopy';

describe('BA-07 · giải thích ngắn và không gây hiểu sai', () => {
  it('đủ chỉ số và khái niệm yêu cầu, mỗi mục không quá hai câu', () => {
    for (const key of [
      'reach',
      'clicks',
      'cost',
      'orders',
      'ctr',
      'cpc',
      'cpa',
      'cvr',
      'nowcast',
      'forecastInterval',
      'anomaly',
    ]) {
      expect(GLOSSARY[key]?.trim().length, key).toBeGreaterThan(20);
    }
    for (const [key, text] of Object.entries(GLOSSARY)) {
      expect(text.split(/[.!?]+/u).filter((s) => s.trim()).length, key).toBeLessThanOrEqual(2);
      expect(text, key).not.toMatch(/<[^>]+>/u);
    }
  });
  it('KPI nhiều ngày dùng tổng và giải thích mẫu số bằng không', () => {
    for (const key of ['ctr', 'cpc', 'cpa', 'cvr']) {
      expect(GLOSSARY[key]).toMatch(/Tổng .+ ÷ Tổng /u);
      expect(GLOSSARY[key]).toContain('—');
    }
    expect(GLOSSARY.missingValue).toContain('không phải bằng 0');
  });
  it('CVR trên 100% và reach cộng ngày không bị mô tả thành số người duy nhất', () => {
    expect(GLOSSARY.cvr).toContain('vượt 100%');
    expect(GLOSSARY.cvr).toContain('kiểm tra');
    expect(GLOSSARY.reach).toContain('không phải số người duy nhất');
  });
  it('dự báo không cam kết kết quả và bất thường không khẳng định nguyên nhân', () => {
    expect(GLOSSARY.forecastInterval).toContain('không phải cam kết');
    expect(GLOSSARY.nowcast).toContain('có thể thay đổi');
    expect(GLOSSARY.anomaly).toContain('trước khi kết luận');
  });
  it('mỗi khu có hướng dẫn khi rỗng, trạng thái tải và đường thử lại khi lỗi', () => {
    for (const states of Object.values(UI_COPY)) {
      expect(states.empty.action.length).toBeGreaterThan(0);
      expect(states.loading.title).toMatch(/^Đang|^AI đang/u);
      expect(states.error.action).toBe('Thử lại');
      expect(states.error.description.length).toBeGreaterThan(20);
    }
    expect(UI_COPY.ai.empty.title).toContain('3 ngày');
    expect(UI_COPY.forecast.empty.title).toContain('7 ngày');
  });
  it('lỗi AI phân biệt fallback, lỗi lưu tạm nhắc sao lưu trước khi rời trang', () => {
    expect(UI_COPY.ai.error.description).toContain('không phải phản hồi AI');
    expect(DEGRADED_COPY.storage.description).toContain('trước khi đóng hoặc tải lại');
    expect(DEGRADED_COPY.storage.action).toBe('Xuất bản sao lưu');
    expect(DEGRADED_COPY.sync.description).toContain('Tránh sửa cùng dữ liệu');
  });
});

describe('BA-07 — thuật ngữ dễ hiểu và microcopy', () => {
  it('có đúng các khái niệm nghiệp vụ bắt buộc', () => {
    for (const key of ['CTR', 'CPC', 'CPA', 'CVR', 'reach', 'nowcast', 'khoảng tin cậy', 'bất thường']) {
      expect(GLOSSARY[key], key).toBeTruthy();
    }
  });
  it('mỗi định nghĩa bổ sung trong BA-07 ngắn, không quá 2 câu', () => {
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
    for (const key of [
      'reach',
      'clicks',
      'cost',
      'orders',
      'ctr',
      'cpc',
      'cpa',
      'cvr',
      'nowcast',
      'likeForLike',
      'forecastInterval',
    ]) {
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

it('không trả thuộc tính prototype hoặc định nghĩa cho chuỗi trống', () => {
  for (const term of ['', '  ', 'constructor', '__proto__', 'toString']) expect(glossaryFor(term)).toBeNull();
});
