/**
 * HỢP ĐỒNG DỮ LIỆU v1 — Dashboard KPI Chiến dịch Mini
 * FROZEN v1 – 2026-10-30 (TL-02). Mọi thay đổi sau mốc này phải qua CHANGE_REQUESTS.
 * Owner: techlead. Agent khác KHÔNG sửa file này.
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

/**
 * Giới hạn chống phình dữ liệu & mốc kỹ thuật — MỘT nguồn sự thật (docs/13_SCALE_RESILIENCE.md).
 * MAX_VALUE.cost × MAX_ROWS_TOTAL < 2^53 → mọi tổng cộng dồn là số nguyên chính xác.
 */
export const LIMITS = {
  MIN_DATE: '2015-01-01',
  MAX_ROWS_TOTAL: 200_000,
  LOCAL_STORAGE_SOFT_ROWS: 40_000, // vượt → cảnh báo / IndexedDB (P2)
  MAX_CAMPAIGNS: 100,
  MAX_CAMPAIGN_NAME: 80,
  MAX_VALUE: { reach: 1_000_000_000, clicks: 1_000_000_000, cost: 40_000_000_000, orders: 10_000_000 },
  MAX_IMPORT_FILE_BYTES: 20 * 1024 * 1024,
  MAX_BACKUP_BYTES: 50 * 1024 * 1024,
  MAX_REPORT_ISSUES: 1_000, // chi tiết dòng lỗi giữ lại trong ImportReport
  MAX_DRAFT_ROWS: 100, // form nhập nhiều dòng
  PASTE_INLINE_MAX_ROWS: 100, // dán nhiều hơn → mở PasteImportDialog
  UNDO_TTL_MS: 10_000,
  PERSIST_DEBOUNCE_MS: 300,
  PERSIST_MAX_WAIT_MS: 2_000, // chống "đói ghi" khi live x60
  SNAPSHOT_TIMEOUT_MS: 8_000,
  WORKER_MAX_RESTARTS: 2,
  FORECAST_WINDOW_DAYS: 365,
  STALE_DATA_DAYS: 14, // dữ liệu cuối cũ hơn → không dự báo/nowcast
  DEFAULT_RANGE_DAYS: 90, // khi dữ liệu trải > 180 ngày
} as const;
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
  cvr: number | null; // thường 0..1; có thể > 1 khi orders > clicks (cảnh báo ORDERS_GT_CLICKS) — không kẹp (CR-002)
}

/* ───────────────────────── Dữ liệu nhập ───────────────────────── */
export interface DailyEntry extends Totals {
  id: string; // khoá xác định `${campaignId}|${date}` — không lưu xuống storage, dựng lại khi decode
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
  | 'DATE_TOO_OLD' // < LIMITS.MIN_DATE
  | 'NOT_NUMBER'
  | 'NEGATIVE'
  | 'NOT_INTEGER'
  | 'TOO_LARGE'
  | 'CLICKS_GT_REACH'
  | 'ORDERS_GT_CLICKS'
  | 'COST_WITHOUT_ACTIVITY'
  | 'DUPLICATE_DATE'
  | 'SUMMARY_ROW' // hàng "Tổng cộng/Total" trong file import → bỏ qua
  | 'LIMIT_EXCEEDED'; // vượt LIMITS (số dòng, số chiến dịch, kích thước file)

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
  /** chỉ giữ tối đa LIMITS.MAX_REPORT_ISSUES chi tiết đầu tiên */
  rejected: { row: number; raw: Record<string, string>; issues: ValidationIssue[] }[];
  warnings: { row: number; issues: ValidationIssue[] }[];
  rejectedTotal: number;
  warningTotal: number;
  mergedInFile: number; // dòng trùng ngày+chiến dịch trong cùng file đã gộp
  detailsTruncated: boolean;
  aborted: boolean; // người dùng huỷ hoặc vượt LIMITS → không ghi gì
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

/** Tổng kiểm tra để phát hiện rollup lệch (docs/13 §3) */
export interface Checksum extends Totals {
  rows: number;
}

export type ForecastStatus = 'ok' | 'insufficient' | 'stale' | 'disabled';

export interface AnalyticsSnapshot {
  computedAt: number;
  revision: number; // tăng mỗi lần dữ liệu đổi — UI bỏ kết quả cũ
  checksum: Checksum; // so với store; lệch → init lại worker
  dataSpan: { first: ISODate | null; last: ISODate | null }; // của chiến dịch đang xem
  forecastStatus: ForecastStatus;
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

/* ───────────────────────── Realtime & sức khoẻ hệ thống ───────────────────────── */
export type HealthArea = 'storage' | 'worker' | 'sync' | 'rollup';
export type HealthStatus = 'ok' | 'degraded' | 'recovered';

export type DomainEvent =
  | { type: 'entries/changed'; delta: EntryDelta; origin: 'local' | 'remote' | 'live'; revision: number }
  | { type: 'settings/changed'; patch: Partial<Settings> }
  | { type: 'storage/warning'; usedBytes: number; quotaBytes: number }
  | { type: 'anomaly/detected'; anomaly: Anomaly }
  | { type: 'system/health'; area: HealthArea; status: HealthStatus; message: string; detail?: string };

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

/* ───────────────────────── Cấu hình nghiệp vụ (giá trị ở src/config — ba-analyst) ───────────────────────── */
/** docs/03 §3, docs/04 §2 */
export interface TrendConfig {
  periods: Record<Grain, number>; // số kỳ xét xu hướng: ngày 14, tuần 8, tháng 6, quý 4
  flatPct: number; // |Δ%| dưới ngưỡng → 'flat' (5)
  slopePct: number; // độ dốc chuẩn hoá %/kỳ để coi là xu hướng (2)
  minR2: number; // (0.5)
  volatileCv: number; // CV vượt ngưỡng → 'volatile' (0.5)
  volatileMinPeriods: number; // (7)
}

/** docs/04 §5 */
export interface AnomalyConfig {
  windowDays: number; // 14
  warnZ: number; // 2.5
  criticalZ: number; // 3.5
  metrics: Metric[];
  minWeeksForWeekday: number; // 8 — đủ tuần thì tách theo thứ trong tuần
}

/** Nhãn, đơn vị, chiều tốt/xấu của chỉ số — UI, báo cáo, guardrail dùng chung */
export interface MetricMeta {
  label: string; // "Chi phí / đơn hàng"
  short: string; // "CPA"
  unit: 'count' | 'vnd' | 'ratio';
  higherIsBetter: boolean | null; // null = trung tính (cost)
  formula?: string; // tooltip: "Chi phí ÷ Số đơn"
}

/* ───────────────────────── Báo cáo ───────────────────────── */
/** docs/07 — body chứa placeholder `{campaignName}`, `{reach}`, `{s1.title}`… do buildReport điền */
export interface ReportTemplate {
  id: 'short' | 'full';
  label: string; // "Ngắn (Zalo/Messenger)"
  maxChars?: number;
  body: string;
}

export interface ReportInput {
  campaignName: string;
  snapshot: AnalyticsSnapshot;
  insight: InsightResponse | null;
  format: 'short' | 'full';
  generatedAt: Date;
}
