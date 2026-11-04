// Owner: data-engineer (Huy) — ACC-03: Magic bytes detection & avatar rate limiting
import 'server-only';

/**
 * Kiểm tra magic bytes của ảnh nhị phân:
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 * Cấm SVG và các định dạng khác.
 */
export function detectImageType(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length < 12) return null;

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

// In-memory rate limiter cho avatar upload (10 lần / phút)
const avatarUploadBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkAvatarRateLimit(identifier: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const bucket = avatarUploadBuckets.get(identifier);

  if (!bucket || now >= bucket.resetAt) {
    avatarUploadBuckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count++;
  return true;
}

/** Dùng cho test harness để reset rate limit */
export function resetAvatarRateLimit(): void {
  avatarUploadBuckets.clear();
}
