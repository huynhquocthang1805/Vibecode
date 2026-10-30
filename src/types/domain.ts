/**
 * HỢP ĐỒNG DỮ LIỆU v1 — Dashboard KPI Chiến dịch Mini
 * Owner: techlead. ĐÓNG BĂNG sau TL-02. Agent khác KHÔNG sửa file này.
 * Muốn thay đổi → ghi handoffs/CHANGE_REQUESTS.md, techlead duyệt và tăng CONTRACT_VERSION.
 */
export const CONTRACT_VERSION = 1 as const;

/* ───────────────────────── Cơ bản ───────────────────────── */
/** 'YYYY-MM-DD' theo giờ Asia/Ho_Chi_Minh */
export type ISODate = string;
export type Grain = 'day' | 'week' | 'month' | 'quarter';
export type BaseMetric = 'reach' | 'clicks' | 'cost' | 'orders';
/** ctr = clicks/reach · cpc = cost/clicks · cpa = cost/orders · cvr = orders/clicks */
export type RatioMetric = 'ctr' | 'cpc' | 'cpa' | 'cvr';
export type Metric = BaseMetric | RatioMetric;
export type EntrySource = 'manual' | 'paste' | 'csv' | 'live' | 'mock';
export const ALL_CAMPAIGNS = 'all' as const;
export type CampaignFilter = string | typeof ALL_CAMPAIGNS;

export interface Totals {
  reach: number;
  clicks: number;
  cost: number; // VND, số nguyên
  orders: number;
}

/** Tỉ số; null khi mẫu số = 0 (UI hiển thị "—") */
export interface Kpis {
  ctr: number | null; // 0..1
  cpc: number | null; // VND
  cpa: number | null; // VND
  cvr: number | null; // 0..1
}

/* ───────────────────────── Dữ liệu nhập ───────────────────────── */
export interface DailyEntry extends Totals {
  id: string; // nanoid
  date: ISODate;
  campaignId: string; // 'default' nếu người dùng không tạo chiến dịch
  source: EntrySource;
  createdAt: number; // epoch ms
  updatedAt: number;
}

export type EntryInput = Pick<DailyEntry, 'date' | 'campaignId' | keyof Totals> & {
  source?: EntrySource;
};

export interface Campaign {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

/* ───────────────────────── Validation ───────────────────────── */
export type IssueLevel = 'error' | 'warning';
export type ValidationCode =
  | 'REQUIRED'
  | 'INVALID_DATE'
  | 'FUTURE_DATE'
  | 'NOT_NUMBER'
  | 'NEGATIVE'
  | 'NOT_INTEGER'
  | 'TOO_LARGE'
  | 'CLICKS_GT_REACH'
  | 'ORDERS_GT_CLICKS'
  | 'COST_WITHOUT_ACTIVITY'
  | 'DUPLICATE_DATE';

export interface ValidationIssue {
  field: keyof EntryInput | 'row';
  code: ValidationCode;
  level: IssueLevel; // error = chặn lưu; warning = cho lưu nhưng nhắc
  message: string; // tiếng Việt, hiển thị trực tiếp
}

export interface ValidationResult {
  ok: boolean; // true khi không có issue level 'error'
  value?: EntryInput; // đã chuẩn hoá (trim, ép số, làm tròn VND)
  issues: ValidationIssue[];
}

export type DuplicatePolicy = 'ask' | 'overwrite' | 'sum' | 'skip';

export interface ImportReport {
  totalRows: number;
  accepted: number;
  rejected: { row: number; raw: Record<string, string>; issues: ValidationIssue[] }[];
  warnings: { row: number; issues: ValidationIssue[] }[];
  durationMs: number;
}

/* ───────────────────────── Tổng hợp (rollup) ───────────────────────── */
export interface Bucket extends Totals {
  /** '2026-10-29' | '2026-W44' | '2026-10' | '2026-Q4' */
  key: string;
  grain: Grain;
  start: ISODate;
  end: ISODate;
  daysWithData: number;
  daysInPeriod: number;
  isPartial: boolean; // kỳ chưa kết thúc hoặc thiếu ngày
  kpis: Kpis;
}

export interface Series {
  grain: Grain;
  campaignId: CampaignFilter;
  buckets: Bucket[]; // sắp xếp tăng dần theo start
}

export interface PeriodComparison {
  current: Bucket;
  previous: Bucket | null;
  /** true: so sánh cùng số ngày (VD 29 ngày đầu T10 vs 29 ngày đầu T9) */
  likeForLike: boolean;
  deltaPct: Record<Metric, number | null>;
}

/* ───────────────────────── Phân tích & dự báo ───────────────────────── */
export type TrendDirection = 'up' | 'down' | 'flat' | 'volatile';
export type Assessment = 'good' | 'bad' | 'neutral';

export interface MetricTrend {
  metric: Metric;
  direction: TrendDirection;
  changePct: number | null; // so với kỳ trước, đơn vị % (12.5 = +12,5%)
  slopePerPeriod: number | null; // hồi quy OLS trên N kỳ gần nhất
  r2: number | null;
  cv: number | null; // hệ số biến thiên
  assessment: Assessment; // CPA tăng = bad, orders tăng = good...
}

export interface TrendSummary {
  grain: Grain;
  periods: number;
  overall: TrendDirection;
  metrics: MetricTrend[];
  comparison: PeriodComparison | null;
  dataQuality: { days: number; missingDays: number; sufficient: boolean };
}

export type ForecastModel = 'naive' | 'seasonal_naive' | 'moving_avg' | 'holt' | 'holt_winters';

export interface ForecastPoint {
  date: ISODate;
  mean: number;
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
}

export interface MetricForecast {
  metric: BaseMetric;
  model: ForecastModel;
  params: Record<string, number>;
  horizonDays: number;
  points: ForecastPoint[];
  backtest: { smape: number | null; mae: number | null; baselineSmape: number | null };
  confidence: 'high' | 'medium' | 'low';
}

export interface Nowcast {
  periodKey: string; // '2026-10' | '2026-Q4'
  grain: 'month' | 'quarter';
  daysElapsed: number;
  daysTotal: number;
  actualToDate: Totals;
  projected: Record<BaseMetric, { mean: number; lo80: number; hi80: number }>;
  projectedKpis: Kpis;
  target?: Partial<Totals>;
  /** % dự kiến đạt so với target (100 = đạt đúng) */
  pacing?: Partial<Record<BaseMetric, number>>;
}

export interface Anomaly {
  date: ISODate;
  metric: Metric;
  value: number;
  expected: number;
  score: number; // robust z-score
  direction: 'spike' | 'drop';
  severity: 'info' | 'warning' | 'critical';
}

export interface AnalyticsQuery {
  campaignId: CampaignFilter;
  grain: Grain;
  range?: { from: ISODate; to: ISODate };
  horizonDays: number; // mặc định 30
  targets?: Record<string, Partial<Totals>>; // key 'campaignId:YYYY-MM'
  today: ISODate; // truyền vào để test được (không đọc đồng hồ trong pure fn)
}

export interface AnalyticsSnapshot {
  computedAt: number;
  revision: number; // tăng mỗi lần dữ liệu đổi — UI bỏ kết quả cũ
  query: AnalyticsQuery;
  series: Series; // theo grain đang chọn
  daily: Series; // luôn có, cho biểu đồ ngày + forecast
  totals: Totals & { kpis: Kpis }; // trong range
  trend: TrendSummary | null;
  forecasts: MetricForecast[];
  nowcasts: Nowcast[]; // tháng hiện tại + quý hiện tại
  anomalies: Anomaly[];
  timings: Record<string, number>; // ms từng bước — hiển thị ở panel debug/perf
}

/** Cập nhật tăng dần: sửa 1 dòng = removed[old] + added[new] */
export interface EntryDelta {
  added: DailyEntry[];
  removed: DailyEntry[];
}

/* ───────────────────────── Lưu trữ ───────────────────────── */
export interface Settings {
  activeCampaignId: CampaignFilter;
  grain: Grain;
  range: { from: ISODate; to: ISODate } | null; // null = toàn bộ
  liveMode: boolean;
  liveSpeed: 1 | 10 | 60;
  targets: Record<string, Partial<Totals>>;
  reportFormat: 'short' | 'full';
  duplicatePolicy: DuplicatePolicy;
}

export interface PersistedState {
  v: typeof CONTRACT_VERSION;
  campaigns: Campaign[];
  entries: DailyEntry[];
  settings: Settings;
}

export interface StorageAdapter {
  readonly kind: 'localStorage' | 'indexedDB' | 'memory';
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
  usage(): Promise<{ usedBytes: number; quotaBytes: number }>;
}

/* ───────────────────────── Realtime ───────────────────────── */
export type DomainEvent =
  | { type: 'entries/changed'; delta: EntryDelta; origin: 'local' | 'remote' | 'live'; revision: number }
  | { type: 'settings/changed'; patch: Partial<Settings> }
  | { type: 'storage/warning'; usedBytes: number; quotaBytes: number }
  | { type: 'anomaly/detected'; anomaly: Anomaly };

/* ───────────────────────── AI ───────────────────────── */
export interface InsightRequest {
  locale: 'vi';
  campaignName: string; // đã sanitize, ≤ 80 ký tự
  grain: Grain;
  range: { from: ISODate; to: ISODate };
  totals: Totals & { kpis: Kpis };
  trend: TrendSummary;
  /** Tối đa 90 kỳ gần nhất, đã làm tròn — KHÔNG gửi raw rows */
  recent: Array<Pick<Bucket, 'key' | 'isPartial' | keyof Totals | 'kpis'>>;
  nowcasts: Nowcast[];
  anomalies: Anomaly[]; // tối đa 10
  context?: { industry?: string; goal?: 'sales' | 'leads' | 'awareness'; monthlyBudget?: number };
}

export interface InsightSuggestion {
  title: string; // ≤ 60 ký tự
  action: string; // hành động cụ thể, đo được
  rationale: string; // dựa trên số liệu nào
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
  relatedMetrics: Metric[]; // ≥ 1
}

export interface InsightResponse {
  source: 'ai' | 'fallback';
  model: string;
  generatedAt: number;
  overall: TrendDirection;
  headline: string; // ≤ 140 ký tự
  metricComments: Array<{ metric: Metric; direction: TrendDirection; changePct: number | null; comment: string }>;
  forecastComment: string | null;
  suggestions: [InsightSuggestion, InsightSuggestion, InsightSuggestion]; // ĐÚNG 3
  riskFlags: string[];
  corrected: boolean; // guardrail đã sửa số/hướng do AI nói sai
  warnings: string[];
}

export type InsightErrorCode =
  | 'INSUFFICIENT_DATA'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT';

export interface InsightError {
  code: InsightErrorCode;
  message: string; // tiếng Việt
  fallback?: InsightResponse; // server luôn cố gửi kèm bản dự phòng
}

/* ───────────────────────── Báo cáo ───────────────────────── */
export interface ReportInput {
  campaignName: string;
  snapshot: AnalyticsSnapshot;
  insight: InsightResponse | null;
  format: 'short' | 'full';
  generatedAt: Date;
}
