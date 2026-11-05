// Owner: ai-engineer — AI-TIMEOUT-01 (techlead, 2026-11-05). Đọc cấu hình gọi AI từ biến môi trường (docs/05 §2).
// Trước đây route viết cứng 15 s / 0.3 → AI_TIMEOUT_MS, AI_TEMPERATURE trong .env.example không có tác dụng.
// Model chậm (gemini-pro-*) cần > 15 s → đặt AI_TIMEOUT_MS=30000 trên Vercel.

export const AI_TIMEOUT_DEFAULT_MS = 15_000;
export const AI_TIMEOUT_MIN_MS = 5_000;
/** Tổng (timeout + dự trữ retry) phải < maxDuration 60 s của route */
export const AI_TIMEOUT_MAX_MS = 50_000;
/** Thời gian dành thêm cho 1 lần thử lại sau lần gọi đầu lỗi/quá giờ */
export const AI_RETRY_RESERVE_MS = 5_000;
export const AI_TEMPERATURE_DEFAULT = 0.3;

export interface AiRuntimeConfig {
  /** Thời gian chờ lần gọi đầu */
  timeoutMs: number;
  /** Tổng ngân sách cả lần thử lại (route chỉ retry khi còn ≥ AI_RETRY_RESERVE_MS) */
  totalBudgetMs: number;
  temperature: number;
}

function clampNumber(raw: string | undefined, min: number, max: number, fallback: number, integer: boolean): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return fallback;
  const v = integer ? Math.round(n) : n;
  return Math.min(max, Math.max(min, v));
}

/** Pure — truyền env để test; giá trị sai/thiếu → mặc định, ngoài khoảng → kẹp */
export function readAiRuntimeConfig(env: Readonly<Record<string, string | undefined>> = process.env): AiRuntimeConfig {
  const timeoutMs = clampNumber(env.AI_TIMEOUT_MS, AI_TIMEOUT_MIN_MS, AI_TIMEOUT_MAX_MS, AI_TIMEOUT_DEFAULT_MS, true);
  const temperature = clampNumber(env.AI_TEMPERATURE, 0, 1, AI_TEMPERATURE_DEFAULT, false);
  return { timeoutMs, totalBudgetMs: timeoutMs + AI_RETRY_RESERVE_MS, temperature };
}
