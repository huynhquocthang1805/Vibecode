// Owner: ba-analyst (Nhân) — BA-04. Nội dung theo docs/07.
import type { ReportTemplate } from '@/types/domain';

export const TEMPLATES: Record<'short' | 'full', ReportTemplate> = {
  short: { id: 'short', label: 'Ngắn (Zalo/Messenger)', maxChars: 900, body: 'TODO(BA-04)' },
  full: { id: 'full', label: 'Đầy đủ (Email)', body: 'TODO(BA-04)' },
};
