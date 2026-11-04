import type { Totals } from '@/types/domain';

export type MappableField = keyof Totals | 'date' | 'campaign';

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FIELD_PATTERNS: Record<MappableField, string[]> = {
  date: ['ngay', 'date', 'day', 'thoi gian'],
  campaign: ['ten chien dich', 'chien dich', 'campaign'],
  reach: ['luot tiep can', 'tiep can', 'reach'],
  clicks: ['luot click', 'click', 'clicks', 'nhap'],
  cost: ['so tien da chi tieu', 'so tien chi tieu', 'chi phi', 'spend', 'cost'],
  orders: ['don hang', 'don', 'orders', 'purchases', 'chuyen doi'],
};

/** Bảng header docs/02 §6 — bỏ dấu tiếng Việt khi so khớp */
export function autoMapHeaders(headers: string[]): Partial<Record<MappableField, string>> {
  const result: Partial<Record<MappableField, string>> = {};
  const mappedFields = new Set<MappableField>();

  for (const originalHeader of headers) {
    const normalized = normalizeHeader(originalHeader);
    if (!normalized) continue;

    // Tìm trường khớp nhất
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [MappableField, string[]][]) {
      if (mappedFields.has(field)) continue;

      // Ưu tiên khớp chính xác hoặc bắt đầu/kết thúc bằng keyword
      const matched = patterns.some((p) => {
        if (normalized === p) return true;
        const words = normalized.split(' ');
        const pWords = p.split(' ');
        if (pWords.length === 1 && words.includes(p)) return true;
        if (normalized.includes(p)) return true;
        return false;
      });

      if (matched) {
        result[field] = originalHeader;
        mappedFields.add(field);
        break;
      }
    }
  }

  return result;
}
