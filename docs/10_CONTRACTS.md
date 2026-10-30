# 10 — Hợp đồng giữa các module (Contracts v1)

Owner: `techlead`. Kiểu dữ liệu nằm ở `src/types/domain.ts`. File này quy định **chữ ký hàm public** của từng module để các agent làm song song mà không chờ nhau.
Quy tắc: trong Phase 0, techlead tạo stub cho mọi hàm dưới đây (`throw new Error('NOT_IMPLEMENTED: <TASK-ID>')`). Owner thay stub bằng code thật, **không đổi chữ ký**.

## A. `lib/domain` — owner: data-engineer
```ts
// kpi.ts
export function safeDiv(a: number, b: number): number | null;          // b === 0 → null
export function computeKpis(t: Totals): Kpis;
export function sumTotals(items: Totals[]): Totals;
export function pctChange(curr: number | null, prev: number | null): number | null; // prev 0/null → null

// validation.ts (Zod)
export const entryInputSchema: z.ZodType<EntryInput>;
export function validateEntry(raw: unknown, ctx: { today: ISODate; existingKeys?: Set<string> }): ValidationResult;
export function validateBatch(rows: unknown[], ctx: {...}): { valid: EntryInput[]; report: ImportReport };

// format.ts
export function fmtInt(n: number | null): string;      // 125400 → "125.400"; null → "—"
export function fmtVnd(n: number | null): string;      // → "18.500.000 ₫"
export function fmtVndShort(n: number | null): string; // → "18,5tr"
export function fmtPct(ratio: number | null, digits?: 2): string; // 0.0256 → "2,56%"
export function fmtDelta(pct: number | null): string;  // 12.3 → "▲ 12,3%"

// dates.ts
export function todayVN(now?: Date): ISODate;
export function parseISODate(s: string): ISODate | null; // nhận 'YYYY-MM-DD', 'DD/MM/YYYY'
export function bucketKey(d: ISODate, g: Grain): string;  // ISO week, quarter
export function bucketRange(key: string, g: Grain): { start: ISODate; end: ISODate; days: number };
export function addDays(d: ISODate, n: number): ISODate;
export function daysBetween(a: ISODate, b: ISODate): number;
```

## B. `lib/data` — owner: data-engineer
```ts
// store.ts (Zustand)
interface DataState {
  hydrated: boolean;
  campaigns: Campaign[]; entries: DailyEntry[]; settings: Settings; revision: number;
  addEntries(inputs: EntryInput[], policy?: DuplicatePolicy): { added: number; conflicts: EntryInput[] };
  updateEntry(id: string, patch: Partial<EntryInput>): ValidationResult;
  removeEntries(ids: string[]): DailyEntry[];   // trả về để undo
  restoreEntries(entries: DailyEntry[]): void;
  importBatch(inputs: EntryInput[], source: EntrySource, policy: DuplicatePolicy): ImportReport;
  upsertCampaign(c: Pick<Campaign,'name'> & { id?: string }): Campaign;
  setSettings(patch: Partial<Settings>): void;
  loadMock(name: 'demo-30d' | 'campaign-2y' | 'edge-cases'): Promise<void>;
  clearAll(): Promise<void>;
  exportBackup(): string; importBackup(json: string): ImportReport;
}
export const useDataStore: UseBoundStore<StoreApi<DataState>>;

// storage/
export function createLocalStorageAdapter(key?: string): StorageAdapter; // key mặc định 'kpi-dash:v1'
export function createIndexedDbAdapter(): StorageAdapter;                 // P2
export function encodeState(s: PersistedState): string;   // codec cột (columnar) + delta ngày
export function decodeState(raw: string): PersistedState; // ném lỗi có mã nếu hỏng
export function migrate(raw: unknown): PersistedState;

// aggregate/
export function buildRollups(entries: DailyEntry[]): RollupIndex;            // O(n)
export function applyDelta(index: RollupIndex, delta: EntryDelta): RollupIndex; // O(|delta|)
export function getSeries(index: RollupIndex, q: Pick<AnalyticsQuery,'campaignId'|'grain'|'range'|'today'>): Series;
export function comparePeriods(series: Series, today: ISODate): PeriodComparison | null;

// realtime/
export const bus: { emit(e: DomainEvent): void; on<T extends DomainEvent['type']>(t: T, fn: (e: Extract<DomainEvent,{type:T}>) => void): () => void };
export function startCrossTabSync(): () => void;           // BroadcastChannel + fallback 'storage' event
export function startLiveSimulator(opts: { speed: 1|10|60; campaignId: string; seed?: number }): () => void;

// import/
export function parseCsv(file: File, onProgress?: (p: number) => void): Promise<{ rows: Record<string,string>[]; headers: string[] }>;
export function parsePastedTable(text: string): { rows: Record<string,string>[]; headers: string[] }; // dán TSV từ Excel/Sheets
export function autoMapHeaders(headers: string[]): Partial<Record<keyof Totals | 'date' | 'campaign', string>>;
```

## C. `lib/workers` — owner: data-engineer (host), forecast-engineer (hàm phân tích)
```ts
export interface AnalyticsWorkerApi {
  init(entries: DailyEntry[]): Promise<number>;                 // trả revision
  applyDelta(delta: EntryDelta, revision: number): Promise<number>;
  snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot>;
}
export function getAnalyticsClient(): AnalyticsWorkerApi;     // Comlink; fallback chạy main thread nếu không có Worker
export function useAnalytics(q: AnalyticsQuery): { data: AnalyticsSnapshot | null; loading: boolean; error: Error | null };
```

## D. `lib/analytics` — owner: forecast-engineer (pure, không I/O)
```ts
export function analyzeTrend(series: Series, cmp: PeriodComparison | null, cfg: TrendConfig): TrendSummary;
export function forecastMetric(daily: number[], dates: ISODate[], metric: BaseMetric, horizon: number): MetricForecast;
export function forecastAll(daily: Series, horizon: number): MetricForecast[];
export function nowcast(daily: Series, forecasts: MetricForecast[], periodKey: string, grain: 'month'|'quarter', today: ISODate, target?: Partial<Totals>): Nowcast;
export function detectAnomalies(daily: Series, cfg: AnomalyConfig): Anomaly[];
export function detectLiveAnomaly(todaySoFar: Totals, hourFraction: number, history: Series, cfg: AnomalyConfig): Anomaly | null;
// models/
export function holt(y: number[], alpha: number, beta: number, h: number): { fitted: number[]; forecast: number[] };
export function holtWinters(y: number[], m: number, alpha: number, beta: number, gamma: number, h: number): {...};
export function fitBest(y: number[], m: number): { model: ForecastModel; params: Record<string,number>; residualSd: number };
export function backtest(y: number[], model: ForecastModel, horizon: number, folds: number): { smape: number; mae: number };
```

## E. `lib/ai` + `app/api/insights` — owner: ai-engineer
```ts
export const insightRequestSchema: z.ZodType<InsightRequest>;
export const insightResponseSchema: z.ZodType<InsightResponse>;
export function buildInsightRequest(snap: AnalyticsSnapshot, campaignName: string, ctx?: InsightRequest['context']): InsightRequest;
export function enforceGuardrails(raw: unknown, req: InsightRequest): { ok: true; value: InsightResponse } | { ok: false; reason: string };
export function fallbackInsight(req: InsightRequest): InsightResponse;   // rule-based, deterministic
export interface LlmProvider { name: string; generateJson(system: string, user: string, jsonSchema: object, opts: { timeoutMs: number; temperature: number }): Promise<unknown> }
export function useInsights(snap: AnalyticsSnapshot | null): { data: InsightResponse | null; status: 'idle'|'loading'|'success'|'fallback'|'error'; error?: InsightError; refresh(): void };
// POST /api/insights  body: InsightRequest → 200 InsightResponse | 4xx/5xx InsightError
```

## F. `lib/ai/prompts` — owner: ba-analyst
```ts
export const SYSTEM_PROMPT_VI: string;
export function buildUserPrompt(req: InsightRequest): string;
export const FEW_SHOT: Array<{ user: string; assistant: string }>;
export const PROMPT_VERSION: string; // 'v1.0' — in ra trong InsightResponse.model
```

## G. `lib/report` — buildReport: ai-engineer · templates: ba-analyst
```ts
export function buildReport(input: ReportInput): string;
export async function copyText(text: string): Promise<boolean>; // Clipboard API + fallback textarea
export const TEMPLATES: Record<'short'|'full', ReportTemplate>;
```

## H. Component (UI) — props tối thiểu
```ts
// frontend-input
<EntryForm onSubmitted?(n: number) />  <EntryTable />  <CsvImportDialog />  <PasteImportDialog />  <DataManager />
// frontend-dashboard
<DashboardShell />  <KpiCards snapshot />  <TrendChart snapshot showForecast />  <KpiRatioChart snapshot />
<GrainSwitcher />  <ForecastPanel nowcasts forecasts />  <AiInsightCard snapshot />  <ExportReportButton snapshot insight />
<LiveModeToggle />  <AnomalyFeed anomalies />
```
