import { z } from 'zod';

import { notImplemented } from '@/lib/notImplemented';
import type { InsightRequest, InsightResponse } from '@/types/domain';

export const insightRequestSchema: z.ZodType<InsightRequest> = z.custom<InsightRequest>(() => notImplemented('AI-01'));

/** suggestions: ĐÚNG 3 phần tử */
export const insightResponseSchema: z.ZodType<InsightResponse> = z.custom<InsightResponse>(() =>
  notImplemented('AI-01'),
);
