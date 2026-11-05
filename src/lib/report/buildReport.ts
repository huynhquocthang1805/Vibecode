import { METRIC_META } from '@/config/metricMeta';
import { bucketKey, parseISODate, todayVN } from '@/lib/domain/dates';
import { fmtDelta, fmtInt, fmtPct, fmtVnd, fmtVndShort } from '@/lib/domain/format';
import { computeKpis } from '@/lib/domain/kpi';
import { LIMITS, type AnalyticsSnapshot, type Metric, type ReportInput } from '@/types/domain';

import { CONFIDENCE_LABEL, fillTemplate, GRAIN_LABEL_REPORT, MODEL_LABEL, REPORT_COPY, TEMPLATES } from './templates';

const BASE_METRICS = ['reach', 'clicks', 'cost', 'orders'] as const;
const METRICS: Metric[] = [...BASE_METRICS, 'ctr', 'cpc', 'cpa', 'cvr'];
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });

function oneLine(text: string): string {
  return text
    .replace(/\s+/gu, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim();
}

/** Giới hạn theo UTF-16 (String.length), không cắt đôi emoji/dấu tiếng Việt. */
function shorten(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 0) return '';
  let out = '';
  for (const { segment } of segmenter.segment(text)) {
    if (out.length + segment.length > maxChars - 1) break;
    out += segment;
  }
  return `${out.trimEnd()}…`;
}

function displayDate(value: string | null | undefined): string {
  const date = value ? parseISODate(value) : null;
  return date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : REPORT_COPY.deltaNone;
}

function formatMetric(metric: Metric, value: number | null): string {
  const unit = METRIC_META[metric].unit;
  return unit === 'vnd' ? fmtVnd(value) : unit === 'ratio' ? fmtPct(value) : fmtInt(value);
}

function reportRange(snapshot: AnalyticsSnapshot) {
  const { query, daily, series } = snapshot;
  return (
    query.range ?? {
      from: daily.buckets[0]?.start ?? series.buckets[0]?.start ?? snapshot.dataSpan.first,
      to: daily.buckets.at(-1)?.end ?? series.buckets.at(-1)?.end ?? snapshot.dataSpan.last,
    }
  );
}

function reportComparison(snapshot: AnalyticsSnapshot, from: string | null, to: string | null) {
  const comparison = snapshot.trend?.comparison;
  if (!comparison || !from || !to) return null;
  const { current, previous } = comparison;
  // Trend thường chỉ so kỳ cuối; không gắn delta của kỳ cuối vào tổng nhiều kỳ.
  const end = to < snapshot.query.today ? to : snapshot.query.today;
  const currentEnd = current.end < snapshot.query.today ? current.end : snapshot.query.today;
  if (from !== current.start || end !== currentEnd) return null;
  if (!BASE_METRICS.every((metric) => snapshot.totals[metric] === current[metric])) return null;
  // Kỳ rỗng do rollup tạo ra không đồng nghĩa với một kỳ có số liệu bằng 0.
  return previous && previous.daysWithData > 0 ? comparison : null;
}

/** Điền mẫu BA-04 bằng snapshot, không gọi AI hoặc đọc đồng hồ máy. */
export function buildReport(input: ReportInput): string {
  const { snapshot, insight, format, generatedAt } = input;
  const { from, to } = reportRange(snapshot);
  const comparison = reportComparison(snapshot, from, to);
  const kpis = computeKpis(snapshot.totals);
  const values: Record<string, string> = {
    campaignName: shorten(oneLine(input.campaignName), LIMITS.MAX_CAMPAIGN_NAME) || REPORT_COPY.deltaNone,
    from: displayDate(from),
    to: displayDate(to),
    grainLabel: GRAIN_LABEL_REPORT[snapshot.query.grain],
    partialNote: snapshot.series.buckets.some((bucket) => bucket.isPartial) ? REPORT_COPY.partialNote : '',
    prevFrom: displayDate(comparison?.previous?.start),
    prevTo: displayDate(comparison?.previous?.end),
    costShort: fmtVndShort(snapshot.totals.cost),
    aiHeadline: oneLine(insight?.headline ?? ''),
    metricCommentLines: insight?.metricComments.map((item) => `   - ${oneLine(item.comment)}`).join('\n') ?? '',
    aiSourceNote: insight
      ? insight.source === 'fallback'
        ? REPORT_COPY.aiSourceFallback
        : REPORT_COPY.aiSourceReal(oneLine(insight.model))
      : '',
    generatedAt: Number.isFinite(generatedAt.getTime())
      ? `${timeFormatter.format(generatedAt)} ${displayDate(todayVN(generatedAt))}`
      : REPORT_COPY.deltaNone,
  };
  const currentValues: Record<Metric, number | null> = { ...snapshot.totals, ...kpis };
  const previousValues: Record<Metric, number | null> | null = comparison?.previous
    ? { ...comparison.previous, ...computeKpis(comparison.previous) }
    : null;
  for (const metric of METRICS) {
    const current = currentValues[metric];
    const previous = previousValues?.[metric] ?? null;
    values[metric] = formatMetric(metric, current);
    values[`${metric}Delta`] =
      previous === 0 && current !== null && Number.isFinite(current) && current > 0
        ? REPORT_COPY.deltaNew
        : fmtDelta(comparison?.deltaPct[metric] ?? null);
  }
  insight?.suggestions.forEach((suggestion, index) => {
    values[`s${index + 1}.title`] = oneLine(suggestion.title);
    values[`s${index + 1}.action`] = oneLine(suggestion.action);
    values[`s${index + 1}.expectedImpact`] = oneLine(suggestion.expectedImpact);
  });

  const today = parseISODate(snapshot.query.today);
  const forecasts =
    snapshot.forecastStatus === 'ok'
      ? snapshot.forecasts.filter((item) => item.metric === 'orders' || item.metric === 'cost')
      : [];
  const nowcasts = forecasts.length && today ? snapshot.nowcasts : [];
  const monthKey = today ? bucketKey(today, 'month') : null;
  const quarterKey = today ? bucketKey(today, 'quarter') : null;
  const month = nowcasts.find((item) => item.grain === 'month' && item.periodKey === monthKey);
  const quarter = nowcasts.find((item) => item.grain === 'quarter' && item.periodKey === quarterKey);
  values.monthLabel = month
    ? `tháng ${Number(month.periodKey.slice(5))}/${month.periodKey.slice(0, 4)}`
    : REPORT_COPY.deltaNone;
  values.quarterLabel = quarter
    ? `quý ${quarter.periodKey.slice(-1)}/${quarter.periodKey.slice(0, 4)}`
    : REPORT_COPY.deltaNone;
  values.projOrders = fmtInt(month?.projected.orders.mean ?? null);
  values.projOrdersLo = fmtInt(month?.projected.orders.lo80 ?? null);
  values.projOrdersHi = fmtInt(month?.projected.orders.hi80 ?? null);
  values.projCost = fmtVnd(month?.projected.cost.mean ?? null);
  values.projCostShort = fmtVndShort(month?.projected.cost.mean ?? null);
  values.projCpa = fmtVnd(
    month
      ? computeKpis({
          reach: month.projected.reach.mean,
          clicks: month.projected.clicks.mean,
          cost: month.projected.cost.mean,
          orders: month.projected.orders.mean,
        }).cpa
      : null,
  );
  values.projQOrders = fmtInt(quarter?.projected.orders.mean ?? null);
  values.projQCost = fmtVnd(quarter?.projected.cost.mean ?? null);
  values.modelLabel = [...new Set(forecasts.map((item) => MODEL_LABEL[item.model]))].join(' / ');
  const confidence = forecasts.some((item) => item.confidence === 'low')
    ? 'low'
    : forecasts.some((item) => item.confidence === 'medium')
      ? 'medium'
      : 'high';
  values.confidenceLabel = forecasts.length ? CONFIDENCE_LABEL[confidence] : REPORT_COPY.deltaNone;

  const alerts = snapshot.anomalies
    .filter(
      (item) =>
        item.severity !== 'info' && from && to && parseISODate(item.date) && item.date >= from && item.date <= to,
    )
    .sort(
      (a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || b.date.localeCompare(a.date),
    )
    .slice(0, REPORT_COPY.maxAlerts);
  values.alertsSection = alerts
    .map((item) =>
      REPORT_COPY.alertLine(
        displayDate(item.date).slice(0, 5),
        METRIC_META[item.metric].short,
        item.direction === 'spike',
        formatMetric(item.metric, item.value),
        formatMetric(item.metric, item.expected),
      ),
    )
    .join('\n');

  const template = TEMPLATES[format];
  // Có thể chỉ nowcast tháng thành công; không trình bày quý thiếu như một dự báo.
  const body = template.body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => (month || !line.includes('{projOrders}')) && (quarter || !line.includes('{projQOrders}')))
    .join('\n');
  const sections = {
    ai: insight !== null,
    noAi: insight === null,
    forecast: Boolean(month || (format === 'full' && quarter)),
    alerts: alerts.length > 0,
  };
  const render = () => fillTemplate(body, values, sections);
  let report = render();
  if (template.maxChars && report.length > template.maxChars) {
    // Rút gọn câu chữ trước, giữ nguyên số KPI và đủ ba gợi ý.
    const keys = ['aiHeadline', 's1.title', 's2.title', 's3.title', 'campaignName'];
    while (report.length > template.maxChars) {
      const key = keys.reduce((longest, candidate) =>
        (values[candidate]?.length ?? 0) > (values[longest]?.length ?? 0) ? candidate : longest,
      );
      const value = values[key] ?? '';
      if (value.length <= 1) break;
      values[key] = shorten(value, Math.max(1, value.length - (report.length - template.maxChars)));
      report = render();
    }
    report = shorten(report, template.maxChars);
  }
  return report.trimEnd();
}
