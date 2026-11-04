// Owner: ba-analyst — BA-04 (techlead điền thay Nhân 2026-11-04). Nội dung theo docs/07.
// buildReport (AI-08, Thắng 2) tính số + định dạng, rồi gọi fillTemplate(TEMPLATES[format].body, values, sections).
//
// Cú pháp mẫu:
//   {key}           → values[key] (key có thể có dấu chấm: {s1.title}); thiếu → "—" (không bao giờ in "{x}"/"undefined")
//   {#name} … {/name} → khối chỉ giữ khi sections[name] = true. Đặt marker trên dòng riêng = khối nhiều dòng.
//                     Không lồng khối. Khối: ai · noAi · forecast · alerts (docs/07 §Quy tắc).
// Sau khi điền: bỏ khoảng trắng cuối dòng, gộp ≥ 2 dòng trống thành 1, không xuống dòng thừa ở cuối.
import type { ForecastModel, Grain, MetricForecast, ReportTemplate } from '@/types/domain';

export type ReportSection = 'ai' | 'noAi' | 'forecast' | 'alerts';

const SHORT_BODY = `📊 BÁO CÁO QUẢNG CÁO — {campaignName}
Kỳ: {from} – {to} ({grainLabel}{partialNote})

• Reach: {reach} ({reachDelta})
• Click: {clicks} ({clicksDelta}) · CTR {ctr}
• Chi phí: {costShort} ({costDelta}) · CPC {cpc}
• Đơn hàng: {orders} ({ordersDelta}) · CPA {cpa}

{#ai}
📈 {aiHeadline}
{/ai}
{#forecast}
🔮 Dự kiến cuối {monthLabel}: ~{projOrders} đơn, chi phí ~{projCostShort}
{/forecast}
{#noAi}
(Chưa chạy phân tích AI)
{/noAi}

{#ai}
✅ Đề xuất:
1. {s1.title}
2. {s2.title}
3. {s3.title}
{/ai}`;

const FULL_BODY = `BÁO CÁO HIỆU QUẢ QUẢNG CÁO
Chiến dịch: {campaignName}
Kỳ báo cáo: {from} – {to} ({grainLabel}{partialNote}) · So sánh với: {prevFrom} – {prevTo}

1. TỔNG QUAN
   Reach ............ {reach}   ({reachDelta})
   Click ............ {clicks}   ({clicksDelta})
   Chi phí .......... {cost}   ({costDelta})
   Đơn hàng ......... {orders}   ({ordersDelta})

2. CHỈ SỐ HIỆU QUẢ
   CTR (click/reach) ......... {ctr}   ({ctrDelta})
   CPC (chi phí/click) ....... {cpc}   ({cpcDelta})
   CPA (chi phí/đơn hàng) .... {cpa}   ({cpaDelta})

{#ai}
3. NHẬN XÉT XU HƯỚNG
   {aiHeadline}
{metricCommentLines}
{/ai}
{#noAi}
(Chưa chạy phân tích AI)
{/noAi}

{#forecast}
4. DỰ BÁO
   Cuối {monthLabel}: ~{projOrders} đơn ({projOrdersLo}–{projOrdersHi}), chi phí ~{projCost}, CPA dự kiến {projCpa}
   Cuối {quarterLabel}: ~{projQOrders} đơn, chi phí ~{projQCost}
   (Mô hình {modelLabel}, độ tin cậy {confidenceLabel})
{/forecast}

{#ai}
5. ĐỀ XUẤT HÀNH ĐỘNG
   1) {s1.title} — {s1.action} (Kỳ vọng: {s1.expectedImpact})
   2) {s2.title} — {s2.action} (Kỳ vọng: {s2.expectedImpact})
   3) {s3.title} — {s3.action} (Kỳ vọng: {s3.expectedImpact})
{/ai}

{#alerts}
{alertsSection}
{/alerts}

—
Tạo bởi KPI Mini Dashboard lúc {generatedAt}. {aiSourceNote}`;

export const TEMPLATES: Record<'short' | 'full', ReportTemplate> = {
  short: { id: 'short', label: 'Ngắn (Zalo/Messenger)', maxChars: 900, body: SHORT_BODY },
  full: { id: 'full', label: 'Đầy đủ (Email)', body: FULL_BODY },
};

/** Câu chữ cố định của báo cáo (docs/07 §Quy tắc) — buildReport dùng, không tự viết lại */
export const REPORT_COPY = {
  deltaNew: 'mới', // prev = 0, curr > 0 (docs/03 §3)
  deltaNone: '—', // thiếu dữ liệu
  partialNote: ', chưa hết kỳ', // kỳ cuối đang chạy dở → so like-for-like
  aiSourceFallback: 'Nhận xét tự động theo quy tắc (AI không khả dụng).',
  aiSourceReal: (model: string) => `Nhận xét do AI (${model}) tạo, đã đối chiếu với số liệu.`,
  maxAlerts: 3,
  /** "⚠ 27/10: CPC cao bất thường (9.800 ₫ so với ~5.900 ₫)" — số đã định dạng sẵn */
  alertLine: (dayMonth: string, metricShort: string, higher: boolean, actual: string, expected: string) =>
    `⚠ ${dayMonth}: ${metricShort} ${higher ? 'cao' : 'thấp'} bất thường (${actual} so với ~${expected})`,
} as const;

export const GRAIN_LABEL_REPORT: Record<Grain, string> = {
  day: 'theo ngày',
  week: 'theo tuần',
  month: 'theo tháng',
  quarter: 'theo quý',
};

export const CONFIDENCE_LABEL: Record<MetricForecast['confidence'], string> = {
  high: 'cao',
  medium: 'trung bình',
  low: 'thấp',
};

export const MODEL_LABEL: Record<ForecastModel, string> = {
  naive: 'giữ mức gần nhất',
  seasonal_naive: 'lặp theo tuần',
  moving_avg: 'trung bình trượt',
  holt: 'Holt (xu hướng)',
  holt_winters: 'Holt-Winters (xu hướng + mùa vụ tuần)',
};

/** Danh sách {key} trong mẫu (không gồm marker khối) — để buildReport/test kiểm đủ giá trị */
export function templatePlaceholders(body: string): string[] {
  const keys = new Set<string>();
  for (const m of body.matchAll(/\{([\w.]+)\}/g)) if (m[1]) keys.add(m[1]);
  return [...keys];
}

/** Điền mẫu — pure, deterministic. Xem cú pháp ở đầu file. */
export function fillTemplate(
  body: string,
  values: Readonly<Record<string, string>>,
  sections: Partial<Record<ReportSection, boolean>> = {},
): string {
  const on = (name: string) => sections[name as ReportSection] === true;
  const out = body
    // khối nhiều dòng: marker đứng riêng một dòng → bỏ luôn dòng marker
    .replace(/(^|\n)\{#(\w+)\}\n([\s\S]*?)\n\{\/\2\}(?=\n|$)/g, (_m, lead: string, name: string, inner: string) =>
      on(name) ? `${lead}${inner}` : '',
    )
    // khối trong dòng
    .replace(/\{#(\w+)\}([\s\S]*?)\{\/\1\}/g, (_m, name: string, inner: string) => (on(name) ? inner : ''))
    .replace(/\{([\w.]+)\}/g, (_m, key: string) => values[key] ?? REPORT_COPY.deltaNone);
  return out
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd();
}
