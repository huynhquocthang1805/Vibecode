import type { InsightRequest, Metric, TrendDirection } from '@/types/domain';

export interface AiEvalFixture {
  name: string;
  request: InsightRequest;
  expect: {
    overall: TrendDirection;
    mustMention: Metric[];
    forbidden: string[];
  };
}

export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Kiểm tra cụm cấm theo quy tắc BR-08 (docs/BA-06):
 * - Chuẩn hóa chữ thường + bỏ dấu tiếng Việt (kể cả đ->d).
 * - Tìm chuỗi con trong title + action.
 * - Cụm khớp bị xem là chung chung vi phạm khi:
 *   action < 40 ký tự HOẶC không có số liệu/tên chỉ số cụ thể nào.
 */
export function checkBannedPhrases(
  suggestions: Array<{ title?: string; action?: string }>,
  bannedList: string[],
): { violated: boolean; details: string[] } {
  if (!bannedList || bannedList.length === 0 || !suggestions || suggestions.length === 0) {
    return { violated: false, details: [] };
  }

  const normBanned = bannedList.map((p) => ({
    raw: p,
    norm: removeVietnameseDiacritics(p.toLowerCase()),
  }));
  const details: string[] = [];

  for (const s of suggestions) {
    const title = s.title ?? '';
    const action = s.action ?? '';
    const combined = removeVietnameseDiacritics(`${title} ${action}`.toLowerCase());

    for (const b of normBanned) {
      if (combined.includes(b.norm)) {
        const hasNumber = /\d+/.test(action);
        const hasMetric = /(reach|clicks|cost|orders|ctr|cpc|cpa|cvr|chi phi|luot nhap|don hang|chuyen doi)/i.test(
          action,
        );
        if (action.length < 40 || (!hasNumber && !hasMetric)) {
          details.push(`Gợi ý "${title}" chứa cụm chung chung "${b.raw}" mà không có số liệu/chỉ số cụ thể.`);
        }
      }
    }
  }

  return { violated: details.length > 0, details };
}

/**
 * Kiểm tra xem các metric bắt buộc (mustMention) có xuất hiện trong danh sách nhận xét không (BR-06).
 */
export function checkMustMention(
  finalComments: Array<{ metric: Metric }>,
  requiredMetrics: Metric[],
): { passed: boolean; missing: Metric[] } {
  const mentioned = new Set(finalComments.map((c) => c.metric));
  const missing = requiredMetrics.filter((m) => !mentioned.has(m));
  return { passed: missing.length === 0, missing };
}

/**
 * Tính phân vị percentile (nearest-rank) cho mảng số đo độ trễ.
 */
export function calculatePercentile(values: number[], p: number): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
}
