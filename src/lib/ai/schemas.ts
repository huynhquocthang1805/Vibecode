import { z } from 'zod';

import type {
  Anomaly,
  Assessment,
  BaseMetric,
  Bucket,
  Grain,
  InsightRequest,
  InsightResponse,
  InsightSuggestion,
  ISODate,
  Metric,
  MetricTrend,
  Nowcast,
  PeriodComparison,
  RatioMetric,
  Totals,
  TrendDirection,
  TrendSummary,
} from '@/types/domain';

/* ───────────────────────── Basic Primitive Schemas ───────────────────────── */
export const baseMetricSchema: z.ZodType<BaseMetric> = z.enum(['reach', 'clicks', 'cost', 'orders']);
export const ratioMetricSchema: z.ZodType<RatioMetric> = z.enum(['ctr', 'cpc', 'cpa', 'cvr']);
export const metricSchema: z.ZodType<Metric> = z.enum([
  'reach',
  'clicks',
  'cost',
  'orders',
  'ctr',
  'cpc',
  'cpa',
  'cvr',
]);
export const grainSchema: z.ZodType<Grain> = z.enum(['day', 'week', 'month', 'quarter']);
export const trendDirectionSchema: z.ZodType<TrendDirection> = z.enum(['up', 'down', 'flat', 'volatile']);
export const assessmentSchema: z.ZodType<Assessment> = z.enum(['good', 'bad', 'neutral']);
export const isoDateSchema: z.ZodType<ISODate> = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const totalsSchema = z
  .object({
    reach: z.number(),
    clicks: z.number(),
    cost: z.number(),
    orders: z.number(),
  })
  .strict();

export const kpisSchema = z
  .object({
    ctr: z.number().nullable(),
    cpc: z.number().nullable(),
    cpa: z.number().nullable(),
    cvr: z.number().nullable(),
  })
  .strict();

export const bucketSchema: z.ZodType<Bucket> = totalsSchema
  .extend({
    key: z.string(),
    grain: grainSchema,
    start: isoDateSchema,
    end: isoDateSchema,
    daysWithData: z.number(),
    daysInPeriod: z.number(),
    isPartial: z.boolean(),
    kpis: kpisSchema,
  })
  .strict();

export const periodComparisonSchema: z.ZodType<PeriodComparison> = z
  .object({
    current: bucketSchema,
    previous: bucketSchema.nullable(),
    likeForLike: z.boolean(),
    deltaPct: z.record(metricSchema, z.number().nullable()) as unknown as z.ZodType<Record<Metric, number | null>>,
  })
  .strict();

export const metricTrendSchema: z.ZodType<MetricTrend> = z
  .object({
    metric: metricSchema,
    direction: trendDirectionSchema,
    changePct: z.number().nullable(),
    slopePerPeriod: z.number().nullable(),
    r2: z.number().nullable(),
    cv: z.number().nullable(),
    assessment: assessmentSchema,
  })
  .strict();

export const trendSummarySchema: z.ZodType<TrendSummary> = z
  .object({
    grain: grainSchema,
    periods: z.number(),
    overall: trendDirectionSchema,
    metrics: z.array(metricTrendSchema),
    comparison: periodComparisonSchema.nullable(),
    dataQuality: z
      .object({
        days: z.number(),
        missingDays: z.number(),
        sufficient: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const recentBucketSchema: z.ZodType<Pick<Bucket, 'key' | 'isPartial' | keyof Totals | 'kpis'>> = z
  .object({
    key: z.string(),
    isPartial: z.boolean(),
    reach: z.number(),
    clicks: z.number(),
    cost: z.number(),
    orders: z.number(),
    kpis: kpisSchema,
  })
  .strict();

export const nowcastSchema: z.ZodType<Nowcast> = z
  .object({
    periodKey: z.string(),
    grain: z.enum(['month', 'quarter']),
    daysElapsed: z.number(),
    daysTotal: z.number(),
    actualToDate: totalsSchema,
    projected: z.record(
      baseMetricSchema,
      z.object({ mean: z.number(), lo80: z.number(), hi80: z.number() }).strict(),
    ) as unknown as z.ZodType<Record<BaseMetric, { mean: number; lo80: number; hi80: number }>>,
    projectedKpis: kpisSchema,
    target: totalsSchema.partial().optional(),
    pacing: z.record(baseMetricSchema, z.number()).optional(),
  })
  .strict();

export const anomalySchema: z.ZodType<Anomaly> = z
  .object({
    date: isoDateSchema,
    metric: metricSchema,
    value: z.number(),
    expected: z.number(),
    score: z.number(),
    direction: z.enum(['spike', 'drop']),
    severity: z.enum(['info', 'warning', 'critical']),
  })
  .strict();

export const contextSchema = z
  .object({
    industry: z.string().optional(),
    goal: z.enum(['sales', 'leads', 'awareness']).optional(),
    monthlyBudget: z.number().optional(),
  })
  .strict();

/* ───────────────────────── Request & Response Schemas ───────────────────────── */
export const insightRequestSchema: z.ZodType<InsightRequest> = z
  .object({
    locale: z.literal('vi'),
    campaignName: z.string().min(1).max(80),
    grain: grainSchema,
    range: z.object({ from: isoDateSchema, to: isoDateSchema }).strict(),
    totals: totalsSchema.extend({ kpis: kpisSchema }).strict(),
    trend: trendSummarySchema,
    recent: z.array(recentBucketSchema).max(90),
    nowcasts: z.array(nowcastSchema),
    forecastConfidence: z.enum(['high', 'medium', 'low'] as const).optional(),
    anomalies: z.array(anomalySchema).max(10),
    context: contextSchema.optional(),
  })
  .strict();

export const insightSuggestionSchema: z.ZodType<InsightSuggestion> = z
  .object({
    title: z.string().min(1).max(60),
    action: z.string().min(1).max(240),
    rationale: z.string().min(1).max(240),
    expectedImpact: z.string().min(1).max(160),
    priority: z.enum(['high', 'medium', 'low']),
    relatedMetrics: z.array(metricSchema).min(1),
  })
  .strict();

export const metricCommentSchema = z
  .object({
    metric: metricSchema,
    direction: trendDirectionSchema,
    changePct: z.number().nullable(),
    comment: z.string().max(200),
  })
  .strict();

/** Schema kiểm tra phản hồi hoàn chỉnh từ server (sau guardrails) */
export const insightResponseSchema: z.ZodType<InsightResponse> = z
  .object({
    source: z.enum(['ai', 'fallback']),
    model: z.string().min(1),
    generatedAt: z.number(),
    overall: trendDirectionSchema,
    headline: z.string().min(1).max(140),
    metricComments: z.array(metricCommentSchema).max(8),
    forecastComment: z.string().max(240).nullable(),
    suggestions: z.tuple([insightSuggestionSchema, insightSuggestionSchema, insightSuggestionSchema]),
    riskFlags: z.array(z.string().max(120)).max(5),
    corrected: z.boolean(),
    warnings: z.array(z.string()),
  })
  .strict();

/** Schema raw từ LLM (trước khi server gắn metadata source, model, timestamp, v.v.) */
export const rawInsightOutputSchema = z
  .object({
    overall: trendDirectionSchema,
    headline: z.string().max(140),
    metricComments: z.array(metricCommentSchema).max(8),
    forecastComment: z.string().max(240).nullable(),
    suggestions: z.array(insightSuggestionSchema),
    riskFlags: z.array(z.string().max(120)).max(5),
  })
  .strict();

export type RawInsightOutput = z.infer<typeof rawInsightOutputSchema>;

/* ───────────────────────── JSON Schema Cho Provider ───────────────────────── */
export const INSIGHT_JSON_SCHEMA = {
  type: 'object',
  required: ['overall', 'headline', 'metricComments', 'suggestions', 'forecastComment', 'riskFlags'],
  properties: {
    overall: { type: 'string', enum: ['up', 'down', 'flat', 'volatile'] },
    headline: { type: 'string', maxLength: 140 },
    metricComments: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: ['metric', 'direction', 'changePct', 'comment'],
        properties: {
          metric: { type: 'string', enum: ['reach', 'clicks', 'cost', 'orders', 'ctr', 'cpc', 'cpa', 'cvr'] },
          direction: { type: 'string', enum: ['up', 'down', 'flat', 'volatile'] },
          changePct: { type: ['number', 'null'] },
          comment: { type: 'string', maxLength: 200 },
        },
      },
    },
    forecastComment: { type: ['string', 'null'], maxLength: 240 },
    suggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        required: ['title', 'action', 'rationale', 'expectedImpact', 'priority', 'relatedMetrics'],
        properties: {
          title: { type: 'string', maxLength: 60 },
          action: { type: 'string', maxLength: 240 },
          rationale: { type: 'string', maxLength: 240 },
          expectedImpact: { type: 'string', maxLength: 160 },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          relatedMetrics: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: ['reach', 'clicks', 'cost', 'orders', 'ctr', 'cpc', 'cpa', 'cvr'] },
          },
        },
      },
    },
    riskFlags: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 120 },
    },
  },
} as const;

/** Chuyển đổi JSON Schema chuẩn sang schema mà Gemini REST API chấp nhận */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(schema)) {
    if (key === 'type' && Array.isArray(val)) {
      const types = val as string[];
      if (types.includes('null')) {
        const nonNull = types.find((t) => t !== 'null') ?? 'string';
        result.type = nonNull;
        result.nullable = true;
      } else {
        result.type = types[0] ?? 'string';
      }
    } else if (key === 'properties' && typeof val === 'object' && val !== null) {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(val as Record<string, unknown>)) {
        if (typeof pv === 'object' && pv !== null) {
          props[pk] = toGeminiSchema(pv as Record<string, unknown>);
        } else {
          props[pk] = pv;
        }
      }
      result.properties = props;
    } else if (key === 'items' && typeof val === 'object' && val !== null) {
      result.items = toGeminiSchema(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }

  return result;
}
