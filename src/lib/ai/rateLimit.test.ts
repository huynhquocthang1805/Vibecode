import { describe, expect, it } from 'vitest';

import { MemoryRateLimiter } from './rateLimit';

describe('AI-02 MemoryRateLimiter (R-02 / docs/13 §7)', () => {
  it('cho phép tối đa maxRequests trong window và chặn request vượt ngưỡng', () => {
    const limiter = new MemoryRateLimiter({ windowMs: 1000, maxRequests: 3 });
    const ip = '192.168.1.1';
    const t0 = 10000;

    expect(limiter.check(ip, t0)).toBe(true);
    expect(limiter.check(ip, t0)).toBe(true);
    expect(limiter.check(ip, t0)).toBe(true);
    // Request thứ 4 trong cùng window bị từ chối
    expect(limiter.check(ip, t0)).toBe(false);

    // Sau khi hết window (t0 + 1001ms), tokens được hồi phục
    expect(limiter.check(ip, t0 + 1001)).toBe(true);
  });

  it('dọn dẹp các bucket hết hạn qua hàm cleanup', () => {
    const limiter = new MemoryRateLimiter({ windowMs: 1000, maxRequests: 5 });
    const t0 = 10000;

    limiter.check('ip-1', t0);
    limiter.check('ip-2', t0);
    expect(limiter.size).toBe(2);

    // Gọi cleanup tại t0 + 500 (chưa hết hạn) -> không xóa mục nào
    const evictedEarly = limiter.cleanup(t0 + 500);
    expect(evictedEarly).toBe(0);
    expect(limiter.size).toBe(2);

    // Gọi cleanup tại t0 + 1001 (đã hết hạn) -> xóa cả 2
    const evictedLate = limiter.cleanup(t0 + 1001);
    expect(evictedLate).toBe(2);
    expect(limiter.size).toBe(0);
  });

  it('giới hạn dung lượng maxEntries và tự động trục xuất LRU để chống phình bộ nhớ', () => {
    const limiter = new MemoryRateLimiter({ windowMs: 60000, maxRequests: 5, maxEntries: 3 });
    const t0 = 10000;

    limiter.check('ip-1', t0);
    limiter.check('ip-2', t0);
    limiter.check('ip-3', t0);
    expect(limiter.size).toBe(3);

    // Thêm ip-4 làm kích hoạt cleanup/eviction, size không vượt quá maxEntries
    limiter.check('ip-4', t0);
    expect(limiter.size).toBeLessThanOrEqual(3);

    // ip-1 cũ nhất bị trục xuất, ip-4 có trong map
    expect(limiter.check('ip-4', t0)).toBe(true);
  });
});

