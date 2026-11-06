import type {
  InsightRequest,
  InsightResponse,
  InsightSuggestion,
  Metric,
  TrendDirection,
} from '@/types/domain';
import { BANNED_PHRASES } from '@/config/bannedPhrases';
import { METRIC_META } from '@/config/metricMeta';

import { fallbackInsight } from './fallback';
import { insightSuggestionSchema, rawInsightOutputSchema } from './schemas';

// Câu cảnh báo cho người đọc (marketer): tên chỉ số tiếng Việt, hướng tăng/giảm, số làm tròn kiểu vi-VN
const DIRECTION_LABEL: Record<TrendDirection, string> = { up: 'tăng', down: 'giảm', flat: 'đi ngang', volatile: 'biến động' };
const metricLabel = (m: Metric) => METRIC_META[m]?.short ?? m;
const pctLabel = (n: number) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n)}%`;

// Cụm chung chung do BA soạn (config/bannedPhrases.ts), so khớp sau khi bỏ dấu + chữ thường
const BANNED_PATTERNS = BANNED_PHRASES.map((p) => removeVietnameseDiacritics(p.toLowerCase()));

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * 7 bước kiểm soát đầu ra (docs/05 §6 & REVIEW-BA-03):
 * 1. Parse JSON
 * 2. Zod validation & chuẩn hoá 3 gợi ý
 * 3. Đối chiếu số liệu changePct (±0.5%)
 * 4. Đối chiếu hướng direction & overall
 * 5. Bắt số % lạ không có trong dữ liệu
 * 6. Kiểm tra chất lượng gợi ý & lọc cụm cấm
 * 7. Làm sạch HTML, cắt độ dài chuỗi
 */
export function enforceGuardrails(
  raw: unknown,
  req: InsightRequest,
  opts?: { modelName?: string },
): { ok: true; value: InsightResponse } | { ok: false; reason: string } {
  const warnings: string[] = [];
  let corrected = false;

  // Bước 1: Parse JSON (nếu là string có markdown code block)
  let parsedJson: unknown = raw;
  if (typeof raw === 'string') {
    let cleanStr = raw.trim();
    if (cleanStr.startsWith('```')) {
      cleanStr = cleanStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }
    try {
      parsedJson = JSON.parse(cleanStr);
    } catch (err) {
      return {
        ok: false,
        reason: `JSON_PARSE_ERROR: Không thể parse JSON từ đầu ra model (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }

  // Bước 2: Validate cấu trúc cơ bản qua rawInsightOutputSchema
  const rawParseResult = rawInsightOutputSchema.safeParse(parsedJson);
  if (!rawParseResult.success) {
    return {
      ok: false,
      reason: `SCHEMA_VALIDATION_ERROR: ${rawParseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    };
  }

  const data = rawParseResult.data;

  // Bước 4 (phần 1): Đối chiếu hướng overall với req.trend.overall
  let overall: TrendDirection = data.overall;
  if (overall !== req.trend.overall) {
    overall = req.trend.overall;
    corrected = true;
    warnings.push(`Xu hướng chung: AI ghi "${DIRECTION_LABEL[data.overall]}", đã sửa thành "${DIRECTION_LABEL[overall]}" theo số liệu.`);
  }

  // Bước 3 & 4 (phần 2): Đối chiếu số liệu changePct và direction từng metric
  const trendMetricsMap = new Map(req.trend.metrics.map((m) => [m.metric, m]));

  const metricComments = (data.metricComments ?? []).map((mc) => {
    const trendMetric = trendMetricsMap.get(mc.metric);
    let finalChangePct = mc.changePct;
    let finalDirection = mc.direction;

    if (trendMetric) {
      // Đối chiếu direction
      if (mc.direction !== trendMetric.direction) {
        finalDirection = trendMetric.direction;
        corrected = true;
        warnings.push(`${metricLabel(mc.metric)}: AI ghi "${DIRECTION_LABEL[mc.direction]}", đã sửa thành "${DIRECTION_LABEL[finalDirection]}".`);
      }

      // Đối chiếu changePct (sai số ±0.5 điểm %)
      if (trendMetric.changePct !== null && mc.changePct !== null) {
        if (Math.abs(mc.changePct - trendMetric.changePct) > 0.5) {
          finalChangePct = trendMetric.changePct;
          corrected = true;
          warnings.push(`${metricLabel(mc.metric)}: AI ghi ${pctLabel(mc.changePct)}, đã sửa thành ${pctLabel(finalChangePct)}.`);
        }
      } else if (trendMetric.changePct !== mc.changePct) {
        finalChangePct = trendMetric.changePct;
        corrected = true;
      }
    }

    return {
      metric: mc.metric,
      direction: finalDirection,
      changePct: finalChangePct,
      comment: stripHtml(mc.comment).slice(0, 200),
    };
  });

  // Bước 5: Bắt số % lạ trong văn bản (headline, comments)
  const fullTextToInspect = [
    data.headline,
    ...metricComments.map((m) => m.comment),
    data.forecastComment ?? '',
  ].join(' ');

  const percentRegex = /([+-]?\d+(?:[.,]\d+)?)\s*%/g;
  const foundPercentages: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = percentRegex.exec(fullTextToInspect)) !== null) {
    if (match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(num)) {
        foundPercentages.push(num);
      }
    }
  }

  // Thu thập các số % có trong req
  const knownPercentages = new Set<number>();
  for (const m of req.trend.metrics) {
    if (m.changePct !== null) {
      knownPercentages.add(Math.abs(m.changePct));
    }
  }
  for (const r of req.recent) {
    if (r.kpis.ctr !== null) knownPercentages.add(Math.abs(r.kpis.ctr * 100));
    if (r.kpis.cvr !== null) knownPercentages.add(Math.abs(r.kpis.cvr * 100));
  }
  if (req.totals.kpis.ctr !== null) knownPercentages.add(Math.abs(req.totals.kpis.ctr * 100));
  if (req.totals.kpis.cvr !== null) knownPercentages.add(Math.abs(req.totals.kpis.cvr * 100));

  for (const pct of foundPercentages) {
    const absPct = Math.abs(pct);
    let matched = false;
    for (const kp of knownPercentages) {
      if (Math.abs(absPct - kp) <= 0.5) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      warnings.push(`AI nhắc ${pctLabel(pct)} — con số này không có trong dữ liệu.`);
    }
  }

  // Bước 6: Kiểm tra chất lượng gợi ý & xử lý số lượng đúng 3
  const fallback = fallbackInsight(req);
  const validatedSuggestions: InsightSuggestion[] = [];

  for (const sug of data.suggestions) {
    const titleClean = stripHtml(sug.title).slice(0, 60);
    const actionClean = stripHtml(sug.action).slice(0, 240);
    const rationaleClean = stripHtml(sug.rationale).slice(0, 240);
    const impactClean = stripHtml(sug.expectedImpact).slice(0, 160);

    const normalizedAction = removeVietnameseDiacritics(actionClean.toLowerCase());
    const normalizedTitle = removeVietnameseDiacritics(titleClean.toLowerCase());

    // Kiểm tra cụm cấm
    const hasBannedPhrase = BANNED_PATTERNS.some(
      (bp) => normalizedAction.includes(bp) || normalizedTitle.includes(bp),
    );

    // Tiêu chí: action < 25 ký tự, hoặc chứa cụm cấm khi action < 40 ký tự hoặc không có số/chỉ số
    const hasNumber = /\d/.test(actionClean);
    const isGenericBanned = hasBannedPhrase && (actionClean.length < 40 || !hasNumber);
    const isTooShort = actionClean.length < 25;
    const hasMetrics = sug.relatedMetrics && sug.relatedMetrics.length >= 1;

    if (isTooShort || isGenericBanned || !hasMetrics) {
      warnings.push(`Gợi ý "${titleClean}" bị thay thế bằng gợi ý dự phòng do vi phạm tiêu chuẩn hành động cụ thể.`);
      corrected = true;
      // Tìm 1 gợi ý fallback thay thế
      const fallbackSug = fallback.suggestions.find((fs) =>
        sug.relatedMetrics?.some((rm: Metric) => fs.relatedMetrics.includes(rm)),
      ) ?? fallback.suggestions[0];

      if (fallbackSug && !validatedSuggestions.some((s) => s.title === fallbackSug.title)) {
        validatedSuggestions.push(fallbackSug);
      }
    } else {
      validatedSuggestions.push({
        title: titleClean,
        action: actionClean,
        rationale: rationaleClean,
        expectedImpact: impactClean,
        priority: sug.priority,
        relatedMetrics: sug.relatedMetrics as Metric[],
      });
    }
  }

  // Điều chỉnh số lượng suggestions để đúng 3
  let finalSuggestions: [InsightSuggestion, InsightSuggestion, InsightSuggestion];
  if (validatedSuggestions.length > 3) {
    // Sắp xếp theo priority rồi lấy 3
    const priorityWeight: Record<'high' | 'medium' | 'low', number> = { high: 1, medium: 2, low: 3 };
    validatedSuggestions.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
    finalSuggestions = [validatedSuggestions[0]!, validatedSuggestions[1]!, validatedSuggestions[2]!];
    warnings.push('Đã rút gọn danh sách gợi ý còn đúng 3 theo mức ưu tiên cao nhất.');
  } else if (validatedSuggestions.length < 3) {
    warnings.push('Bổ sung thêm gợi ý dự phòng để đảm bảo đủ 3 gợi ý cải thiện.');
    corrected = true;
    for (const fs of fallback.suggestions) {
      if (validatedSuggestions.length >= 3) break;
      if (!validatedSuggestions.some((vs) => vs.title === fs.title)) {
        validatedSuggestions.push(fs);
      }
    }
    finalSuggestions = [
      validatedSuggestions[0] ?? fallback.suggestions[0],
      validatedSuggestions[1] ?? fallback.suggestions[1],
      validatedSuggestions[2] ?? fallback.suggestions[2],
    ];
  } else {
    finalSuggestions = [validatedSuggestions[0]!, validatedSuggestions[1]!, validatedSuggestions[2]!];
  }

  // Đảm bảo từng suggestion đúng schema
  for (let i = 0; i < 3; i++) {
    const s = finalSuggestions[i];
    if (s) {
      const parsed = insightSuggestionSchema.safeParse(s);
      if (!parsed.success) {
        finalSuggestions[i] = fallback.suggestions[i] ?? fallback.suggestions[0];
      }
    }
  }

  // Bước 7: Làm sạch headline và forecastComment
  const cleanHeadline = stripHtml(data.headline).slice(0, 140);
  const cleanForecastComment = data.forecastComment ? stripHtml(data.forecastComment).slice(0, 240) : null;
  const cleanRiskFlags = (data.riskFlags ?? []).map((rf) => stripHtml(rf).slice(0, 120)).slice(0, 5);

  const response: InsightResponse = {
    source: 'ai',
    model: opts?.modelName ?? 'gemini-1.5-flash@v1.0',
    generatedAt: Date.now(),
    overall,
    headline: cleanHeadline,
    metricComments,
    forecastComment: cleanForecastComment,
    suggestions: finalSuggestions,
    riskFlags: cleanRiskFlags,
    corrected,
    warnings,
  };

  return { ok: true, value: response };
}
