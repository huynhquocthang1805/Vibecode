// Owner: ai-engineer — AI-FIX-03 (techlead làm thay, 2026-11-08).
/** Gợi ý khắc phục theo mã lỗi upstream (AI-FIX-03) — chỉ mã/trạng thái công khai, không lộ key hay prompt */
export function providerHint(detail: string): string {
  const code = /mã lỗi (\d{3})/.exec(detail)?.[1];
  if (/Thiếu API key/.test(detail)) return ' — server chưa có AI_API_KEY';
  if (code === '429' || /RESOURCE_EXHAUSTED/.test(detail)) return ' (429) — hết hạn mức gọi của key/model, thử lại sau hoặc đổi AI_MODEL';
  if (code === '400' && /API_KEY_INVALID|API key not valid/i.test(detail)) return ' (400) — AI_API_KEY không hợp lệ';
  if (code === '403') return ' (403) — key không có quyền hoặc chưa bật Generative Language API';
  if (code === '404') return ' (404) — AI_MODEL không tồn tại hoặc không hỗ trợ generateContent';
  if (code === '503' || code === '500') return ` (${code}) — nhà cung cấp đang quá tải, thử lại sau`;
  if (code) return ` (${code})`;
  return '';
}
