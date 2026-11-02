import { z } from 'zod';

import { LIMITS } from '@/types/domain';
import type {
  EntryInput,
  EntrySource,
  ImportReport,
  ISODate,
  IssueLevel,
  ValidationCode,
  ValidationIssue,
  ValidationResult,
} from '@/types/domain';

export interface ValidationContext {
  today: ISODate;
  /** khoá `${campaignId}|${date}` đã có — để cảnh báo DUPLICATE_DATE */
  existingKeys?: Set<string>;
}

export const VALIDATION_MESSAGES: Record<ValidationCode, (field?: string) => string> = {
  REQUIRED: (f) => (f ? `Vui lòng nhập ${f}` : 'Trường bắt buộc'),
  INVALID_DATE: () => 'Ngày không hợp lệ',
  FUTURE_DATE: () => 'Không nhập số liệu cho ngày trong tương lai',
  DATE_TOO_OLD: () => 'Ngày quá xa trong quá khứ, kiểm tra lại năm',
  NOT_NUMBER: (f) => (f ? `${f} phải là số` : 'Giá trị phải là số'),
  NEGATIVE: (f) => (f ? `${f} không được âm` : 'Giá trị không được âm'),
  NOT_INTEGER: (f) => (f ? `${f} phải là số nguyên` : 'Giá trị phải là số nguyên'),
  TOO_LARGE: () => 'Giá trị quá lớn, kiểm tra lại',
  CLICKS_GT_REACH: () => 'Số click không thể lớn hơn reach',
  ORDERS_GT_CLICKS: () => 'Số đơn lớn hơn số click — có thể do đơn từ kênh khác, kiểm tra lại',
  COST_WITHOUT_ACTIVITY: () => 'Có chi phí nhưng không có reach',
  DUPLICATE_DATE: () => 'Ngày này đã có số liệu',
  SUMMARY_ROW: () => 'Đã bỏ qua hàng tổng cộng để tránh cộng hai lần',
  LIMIT_EXCEEDED: () => 'Vượt quá giới hạn nhập liệu',
};

const VALID_SOURCES = new Set<EntrySource>(['manual', 'paste', 'csv', 'live', 'mock']);

function createIssue(
  field: keyof EntryInput | 'row',
  code: ValidationCode,
  level: IssueLevel = 'error',
): ValidationIssue {
  return {
    field,
    code,
    level,
    message: VALIDATION_MESSAGES[code](field === 'row' ? undefined : field),
  };
}

/** Kiểm tra và chuẩn hoá ngày tháng, trả về ISODate hoặc null */
function parseAndValidateDate(rawDate: unknown): { isoDate?: ISODate; issueCode?: ValidationCode } {
  if (rawDate === undefined || rawDate === null) {
    return { issueCode: 'REQUIRED' };
  }
  if (typeof rawDate !== 'string') {
    return { issueCode: 'INVALID_DATE' };
  }
  const trimmed = rawDate.trim();
  if (trimmed === '') {
    return { issueCode: 'REQUIRED' };
  }

  let year: number;
  let month: number;
  let day: number;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    day = Number(dmyMatch[1]);
    month = Number(dmyMatch[2]);
    year = Number(dmyMatch[3]);
  } else {
    return { issueCode: 'INVALID_DATE' };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { issueCode: 'INVALID_DATE' };
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { issueCode: 'INVALID_DATE' };
  }

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { isoDate };
}

type ParsedFieldResult =
  | { success: true; value: number }
  | { success: false; issueCode: ValidationCode };

/** Parse và chuẩn hoá số kiểu Việt Nam & khoa học (R-04: chỉ bỏ hậu tố tiền tệ, cấm parse một phần) */
function parseNumberField(
  raw: unknown,
  isCost: boolean,
): ParsedFieldResult {
  if (raw === undefined || raw === null) {
    return { success: false, issueCode: 'REQUIRED' };
  }
  if (typeof raw === 'boolean') {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { success: false, issueCode: 'NOT_NUMBER' };
    }
    if (raw < 0) {
      return { success: false, issueCode: 'NEGATIVE' };
    }
    if (!isCost && !Number.isInteger(raw)) {
      return { success: false, issueCode: 'NOT_INTEGER' };
    }
    const val = isCost ? Math.round(raw) : raw;
    return { success: true, value: val };
  }

  if (typeof raw !== 'string') {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { success: false, issueCode: 'REQUIRED' };
  }
  if (trimmed === 'NaN' || trimmed === 'Infinity' || trimmed === '-Infinity') {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }

  // Dạng khoa học E.g. "1.2E+06", "1.2e+06", "1e6"
  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return { success: false, issueCode: 'NOT_NUMBER' };
    if (num < 0) return { success: false, issueCode: 'NEGATIVE' };
    if (!isCost && !Number.isInteger(num)) return { success: false, issueCode: 'NOT_INTEGER' };
    return { success: true, value: isCost ? Math.round(num) : num };
  }

  // R-04: Chỉ loại bỏ hậu tố tiền tệ ở cuối chuỗi (/ \s*(₫|đ|vnd)$/i), không xoá ký tự đ/v ở giữa số
  const withoutCurrency = trimmed.replace(/\s*(₫|đ|vnd)$/i, '');
  const cleaned = withoutCurrency.replace(/\s+/g, '');
  if (cleaned === '') {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }

  // Kiểm tra ký tự không hợp lệ
  if (!/^[+-]?[\d.,]+$/.test(cleaned)) {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  let normalizedStr = cleaned;
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // 1.234,56 -> dot là thousand, comma là decimal
      const intParts = cleaned.slice(0, lastComma).split('.');
      for (let i = 1; i < intParts.length; i++) {
        const part = intParts[i];
        if (!part || part.length !== 3) return { success: false, issueCode: 'NOT_NUMBER' };
      }
      normalizedStr = cleaned.slice(0, lastComma).replace(/\./g, '') + '.' + cleaned.slice(lastComma + 1);
    } else {
      // 1,234.56 -> comma là thousand, dot là decimal
      const intParts = cleaned.slice(0, lastDot).split(',');
      for (let i = 1; i < intParts.length; i++) {
        const part = intParts[i];
        if (!part || part.length !== 3) return { success: false, issueCode: 'NOT_NUMBER' };
      }
      normalizedStr = cleaned.slice(0, lastDot).replace(/,/g, '') + '.' + cleaned.slice(lastDot + 1);
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      // Nhiều dấu chấm -> phân cách nghìn
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part || part.length !== 3) return { success: false, issueCode: 'NOT_NUMBER' };
      }
      normalizedStr = cleaned.replace(/\./g, '');
    } else {
      // 1 dấu chấm: nếu phần sau dài 3 và isCost không phải thập phân có thể là nghìn
      const frac = parts[1] ?? '';
      if (frac.length === 3) {
        normalizedStr = cleaned.replace(/\./g, '');
      } else {
        normalizedStr = cleaned;
      }
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      // Nhiều dấu phẩy -> phân cách nghìn
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part || part.length !== 3) return { success: false, issueCode: 'NOT_NUMBER' };
      }
      normalizedStr = cleaned.replace(/,/g, '');
    } else {
      const frac = parts[1] ?? '';
      if (frac.length === 3) {
        normalizedStr = cleaned.replace(/,/g, '');
      } else {
        // Dấu phẩy thập phân: "1,5" -> "1.5"
        normalizedStr = cleaned.replace(',', '.');
      }
    }
  }

  const num = Number(normalizedStr);
  if (!Number.isFinite(num)) {
    return { success: false, issueCode: 'NOT_NUMBER' };
  }
  if (num < 0) {
    return { success: false, issueCode: 'NEGATIVE' };
  }
  if (!isCost && !Number.isInteger(num)) {
    return { success: false, issueCode: 'NOT_INTEGER' };
  }

  return { success: true, value: isCost ? Math.round(num) : num };
}

export const entryInputSchema: z.ZodType<EntryInput> = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignId: z.string().min(1),
  reach: z.number().int().min(0).max(LIMITS.MAX_VALUE.reach),
  clicks: z.number().int().min(0).max(LIMITS.MAX_VALUE.clicks),
  cost: z.number().int().min(0).max(LIMITS.MAX_VALUE.cost),
  orders: z.number().int().min(0).max(LIMITS.MAX_VALUE.orders),
  source: z.enum(['manual', 'paste', 'csv', 'live', 'mock']).optional(),
});

export function validateEntry(raw: unknown, ctx: ValidationContext): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return {
      ok: false,
      issues: [createIssue('row', 'REQUIRED')],
    };
  }

  const row = raw as Record<string, unknown>;

  // 1. Kiểm tra date
  let validDate: ISODate | undefined;
  const dateRes = parseAndValidateDate(row.date);
  if (dateRes.issueCode) {
    issues.push(createIssue('date', dateRes.issueCode));
  } else if (dateRes.isoDate) {
    validDate = dateRes.isoDate;
    if (validDate < LIMITS.MIN_DATE) {
      issues.push(createIssue('date', 'DATE_TOO_OLD'));
    } else if (validDate > ctx.today) {
      issues.push(createIssue('date', 'FUTURE_DATE'));
    }
  }

  // 2. Kiểm tra campaignId
  const rawCampaignId = row.campaignId;
  let campaignId = 'default';
  if (rawCampaignId === undefined || rawCampaignId === null || (typeof rawCampaignId === 'string' && rawCampaignId.trim() === '')) {
    issues.push(createIssue('campaignId', 'REQUIRED'));
  } else {
    campaignId = String(rawCampaignId).trim();
  }

  // 3. Parse các trường số
  let reach: number | undefined;
  let clicks: number | undefined;
  let cost: number | undefined;
  let orders: number | undefined;

  const reachRes = parseNumberField(row.reach, false);
  if (!reachRes.success) {
    issues.push(createIssue('reach', reachRes.issueCode));
  } else {
    reach = reachRes.value;
    if (reach > LIMITS.MAX_VALUE.reach) {
      issues.push(createIssue('reach', 'TOO_LARGE'));
      reach = undefined;
    }
  }

  const clicksRes = parseNumberField(row.clicks, false);
  if (!clicksRes.success) {
    issues.push(createIssue('clicks', clicksRes.issueCode));
  } else {
    clicks = clicksRes.value;
    if (clicks > LIMITS.MAX_VALUE.clicks) {
      issues.push(createIssue('clicks', 'TOO_LARGE'));
      clicks = undefined;
    }
  }

  const costRes = parseNumberField(row.cost, true);
  if (!costRes.success) {
    issues.push(createIssue('cost', costRes.issueCode));
  } else {
    cost = costRes.value;
    if (cost > LIMITS.MAX_VALUE.cost) {
      issues.push(createIssue('cost', 'TOO_LARGE'));
      cost = undefined;
    }
  }

  const ordersRes = parseNumberField(row.orders, false);
  if (!ordersRes.success) {
    issues.push(createIssue('orders', ordersRes.issueCode));
  } else {
    orders = ordersRes.value;
    if (orders > LIMITS.MAX_VALUE.orders) {
      issues.push(createIssue('orders', 'TOO_LARGE'));
      orders = undefined;
    }
  }

  // 4. Quan hệ tương quan giữa các trường (chỉ kiểm khi cả 2 trường liên quan đã hợp lệ)
  if (clicks !== undefined && reach !== undefined) {
    if (clicks > reach) {
      issues.push(createIssue('clicks', 'CLICKS_GT_REACH'));
    }
  }

  if (orders !== undefined && clicks !== undefined) {
    if (orders > clicks) {
      issues.push(createIssue('orders', 'ORDERS_GT_CLICKS', 'warning'));
    }
  }

  if (cost !== undefined && reach !== undefined) {
    if (cost > 0 && reach === 0) {
      issues.push(createIssue('cost', 'COST_WITHOUT_ACTIVITY', 'warning'));
    }
  }

  // 5. Kiểm tra duplicate date
  if (validDate) {
    const key = `${campaignId}|${validDate}`;
    if (ctx.existingKeys?.has(key)) {
      issues.push(createIssue('date', 'DUPLICATE_DATE', 'warning'));
    }
  }

  const hasError = issues.some((i) => i.level === 'error');
  const ok = !hasError;

  if (ok && validDate !== undefined && reach !== undefined && clicks !== undefined && cost !== undefined && orders !== undefined) {
    // R-03: Kiểm tra source theo enum, không để chuỗi bất kỳ lọt vào
    let source: EntrySource | undefined;
    if (typeof row.source === 'string' && VALID_SOURCES.has(row.source as EntrySource)) {
      source = row.source as EntrySource;
    }

    const value: EntryInput = {
      date: validDate,
      campaignId,
      reach,
      clicks,
      cost,
      orders,
      source,
    };
    return { ok: true, value, issues };
  }

  return { ok: false, issues };
}

export function validateBatch(
  rows: unknown[],
  ctx: ValidationContext,
): { valid: EntryInput[]; report: ImportReport } {
  const start = Date.now();
  const valid: EntryInput[] = [];
  const rejected: ImportReport['rejected'] = [];
  const warnings: ImportReport['warnings'] = [];

  let warningTotal = 0;
  let rejectedTotal = 0;
  const seenKeys = new Map<string, number>();
  let mergedInFile = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const rawRow = rows[idx];
    const rowNum = idx + 1;
    const res = validateEntry(rawRow, ctx);

    if (res.issues.some((i) => i.level === 'warning')) {
      warningTotal++;
      if (warnings.length < LIMITS.MAX_REPORT_ISSUES) {
        warnings.push({
          row: rowNum,
          issues: res.issues.filter((i) => i.level === 'warning'),
        });
      }
    }

    if (res.ok && res.value) {
      const entryKey = `${res.value.campaignId}|${res.value.date}`;
      if (seenKeys.has(entryKey)) {
        mergedInFile++;
        // Gộp sum vào dòng trước
        const existingIdx = seenKeys.get(entryKey);
        if (existingIdx !== undefined) {
          const target = valid[existingIdx];
          if (target) {
            target.reach += res.value.reach;
            target.clicks += res.value.clicks;
            target.cost += res.value.cost;
            target.orders += res.value.orders;
          }
        }
      } else {
        seenKeys.set(entryKey, valid.length);
        valid.push(res.value);
      }
    } else {
      rejectedTotal++;
      if (rejected.length < LIMITS.MAX_REPORT_ISSUES) {
        const rawObj: Record<string, string> = {};
        if (typeof rawRow === 'object' && rawRow !== null) {
          for (const [k, v] of Object.entries(rawRow as Record<string, unknown>)) {
            rawObj[k] = String(v ?? '');
          }
        }
        rejected.push({
          row: rowNum,
          raw: rawObj,
          issues: res.issues.filter((i) => i.level === 'error'),
        });
      }
    }
  }

  const report: ImportReport = {
    totalRows: rows.length,
    accepted: valid.length,
    rejected,
    warnings,
    rejectedTotal,
    warningTotal,
    mergedInFile,
    detailsTruncated: rejectedTotal > LIMITS.MAX_REPORT_ISSUES || warningTotal > LIMITS.MAX_REPORT_ISSUES,
    aborted: false,
    durationMs: Date.now() - start,
  };

  return { valid, report };
}
