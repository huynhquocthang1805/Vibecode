import { z } from 'zod';

import { notImplemented } from '@/lib/notImplemented';
import type { EntryInput, ImportReport, ISODate, ValidationResult } from '@/types/domain';

export interface ValidationContext {
  today: ISODate;
  /** khoá `${campaignId}|${date}` đã có — để cảnh báo DUPLICATE_DATE */
  existingKeys?: Set<string>;
}

export const entryInputSchema: z.ZodType<EntryInput> = z.custom<EntryInput>(() => notImplemented('DATA-01'));

export function validateEntry(_raw: unknown, _ctx: ValidationContext): ValidationResult {
  return notImplemented('DATA-01');
}

export function validateBatch(
  _rows: unknown[],
  _ctx: ValidationContext,
): { valid: EntryInput[]; report: ImportReport } {
  return notImplemented('DATA-01');
}
