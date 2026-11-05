// Owner: ai-engineer — TL-06c (techlead làm thay Hoàng Anh, 2026-11-05).
// MỘT nguồn cho phần gửi model: route /api/insights và scripts/eval-ai.ts dùng chung,
// để eval đo đúng thứ production gửi (trước đây eval thiếu few-shot, temperature khác).
import { FEW_SHOT, PROMPT_VERSION, SYSTEM_PROMPT_VI } from './prompts';
import type { LlmProvider } from './provider/types';

/** Temperature lần gọi đầu (docs/05 §2 AI_TEMPERATURE=0.3); lần repair dùng 0 */
export const AI_TEMPERATURE = 0.3;

/**
 * System prompt + few-shot (docs/05 §4). Provider chỉ nhận 1 system + 1 user, nên ví dụ của BA
 * đặt cuối system prompt, ghi rõ chỉ minh hoạ định dạng — model không được lấy số của ví dụ.
 */
export function buildSystemPrompt(): string {
  return [
    SYSTEM_PROMPT_VI,
    ...FEW_SHOT.map(
      (ex, i) =>
        `VÍ DỤ ${i + 1} — chỉ minh hoạ cách trả lời, KHÔNG dùng số liệu của ví dụ cho chiến dịch thật.\nĐầu vào:\n${ex.user}\nĐầu ra:\n${ex.assistant}`,
    ),
  ].join('\n\n');
}

/**
 * Nhãn `InsightResponse.model` = `<model thật>@<PROMPT_VERSION>` (docs/05 §5).
 * Lấy tên model provider đang gọi (kể cả mặc định khi thiếu AI_MODEL), không phải tên provider.
 */
export function modelLabel(provider: Pick<LlmProvider, 'name'> & { model?: unknown }): string {
  const model = typeof provider.model === 'string' && provider.model.trim() !== '' ? provider.model : provider.name;
  return `${model}@${PROMPT_VERSION}`;
}
