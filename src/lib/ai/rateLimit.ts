/**
 * Quản lý Rate Limit trong bộ nhớ cho API Insights (AI-02 / docs/13 §7).
 * - Cửa sổ: 60 giây (1 phút)
 * - Tối đa: 10 requests / phút / IP
 * - Giới hạn bộ nhớ: Tự động dọn dẹp các bucket hết hạn và chặn phình bộ nhớ với dung lượng tối đa.
 */

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  maxEntries?: number;
}

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class MemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private readonly map: Map<string, RateLimitBucket>;

  constructor(opts?: RateLimitOptions) {
    this.windowMs = opts?.windowMs ?? 60 * 1000;
    this.maxRequests = opts?.maxRequests ?? 10;
    this.maxEntries = opts?.maxEntries ?? 500;
    this.map = new Map();
  }

  /**
   * Kiểm tra và tiêu thụ 1 token cho IP. Trả về true nếu được phép, false nếu bị chặn.
   */
  check(ip: string, now: number = Date.now()): boolean {
    if (this.map.size >= this.maxEntries) {
      this.cleanup(now);
    }

    const bucket = this.map.get(ip) ?? { tokens: this.maxRequests, lastRefill: now };

    const elapsed = now - bucket.lastRefill;
    if (elapsed > this.windowMs) {
      bucket.tokens = this.maxRequests;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      // Cập nhật vị trí LRU: xóa và set lại để IP gần nhất nằm ở cuối Map
      this.map.delete(ip);
      this.map.set(ip, bucket);
      return true;
    }

    return false;
  }

  /**
   * Dọn dẹp các mục hết hạn (> windowMs) và cắt tỉa theo maxEntries nếu vẫn đầy (LRU eviction).
   */
  cleanup(now: number = Date.now()): number {
    let evicted = 0;
    for (const [ip, bucket] of this.map.entries()) {
      if (now - bucket.lastRefill > this.windowMs) {
        this.map.delete(ip);
        evicted += 1;
      }
    }

    // Nếu vẫn vượt quá dung lượng tối đa, loại bỏ các mục cũ nhất ở đầu Map
    while (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
        evicted += 1;
      } else {
        break;
      }
    }

    return evicted;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// Singleton mặc định cho route /api/insights
export const defaultRateLimiter = new MemoryRateLimiter();

