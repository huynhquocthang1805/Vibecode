import { createHash } from 'node:crypto';

import { fallbackInsight } from '@/lib/ai/fallback';
import { enforceGuardrails } from '@/lib/ai/guardrails';
import { buildUserPrompt, FEW_SHOT, PROMPT_VERSION, SYSTEM_PROMPT_VI } from '@/lib/ai/prompts';
import { getProvider } from '@/lib/ai/provider';
import { defaultRateLimiter } from '@/lib/ai/rateLimit';
import { AI_RETRY_RESERVE_MS, readAiRuntimeConfig } from '@/lib/ai/runtimeConfig';
import { INSIGHT_JSON_SCHEMA, insightRequestSchema } from '@/lib/ai/schemas';
import type { InsightError, InsightRequest, InsightResponse } from '@/types/domain';

const MAX_BODY_BYTES = 32 * 1024; // 32KB
const CACHE_MAX_ITEMS = 100;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ
// AI-TIMEOUT-01: thời gian chờ + temperature đọc từ AI_TIMEOUT_MS / AI_TEMPERATURE (mặc định 15 s · tổng 20 s · 0.3)
// Vercel: cho phép hàm chạy tới 60 s (timeout tối đa 50 s + 5 s thử lại < 60 s)
export const maxDuration = 60;

/**
 * TL-06b: system prompt + few-shot (docs/05 §4). Provider chỉ nhận 1 system + 1 user, nên ví dụ của BA
 * đặt cuối system prompt, ghi rõ chỉ minh hoạ định dạng — model không được lấy số của ví dụ.
 */
const SYSTEM_PROMPT_WITH_EXAMPLES = [
  SYSTEM_PROMPT_VI,
  ...FEW_SHOT.map(
    (ex, i) =>
      `VÍ DỤ ${i + 1} — chỉ minh hoạ cách trả lời, KHÔNG dùng số liệu của ví dụ cho chiến dịch thật.\nĐầu vào:\n${ex.user}\nĐầu ra:\n${ex.assistant}`,
  ),
].join('\n\n');

/* ───────────────────────── Bộ nhớ tạm & Cache LRU ───────────────────────── */

interface CacheEntry {
  value: InsightResponse;
  expiresAt: number;
}
const lruCache = new Map<string, CacheEntry>();

function getFromCache(hash: string): InsightResponse | null {
  const entry = lruCache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    lruCache.delete(hash);
    return null;
  }
  // Đưa key lên đầu map
  lruCache.delete(hash);
  lruCache.set(hash, entry);
  return entry.value;
}

function setToCache(hash: string, value: InsightResponse): void {
  if (lruCache.size >= CACHE_MAX_ITEMS) {
    const oldestKey = lruCache.keys().next().value;
    if (oldestKey) lruCache.delete(oldestKey);
  }
  lruCache.set(hash, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function hashRequest(req: InsightRequest): string {
  return createHash('sha256').update(JSON.stringify(req)).digest('hex');
}

/* ───────────────────────── Route Handler ───────────────────────── */
export async function POST(request: Request): Promise<Response> {
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  // 1. Kiểm tra kích thước body (giới hạn 32KB)
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    const errorBody: InsightError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Kích thước dữ liệu gửi lên vượt quá giới hạn 32KB.',
    };
    return Response.json(errorBody, { status: 413 });
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    const errorBody: InsightError = {
      code: 'BAD_REQUEST',
      message: 'Không thể đọc nội dung yêu cầu.',
    };
    return Response.json(errorBody, { status: 400 });
  }

  if (Buffer.byteLength(rawBodyText, 'utf8') > MAX_BODY_BYTES) {
    const errorBody: InsightError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Kích thước dữ liệu gửi lên vượt quá giới hạn 32KB.',
    };
    return Response.json(errorBody, { status: 413 });
  }

  // 2. Parse JSON & Validate Zod schema
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBodyText);
  } catch {
    const errorBody: InsightError = {
      code: 'BAD_REQUEST',
      message: 'Định dạng JSON gửi lên không hợp lệ.',
    };
    return Response.json(errorBody, { status: 400 });
  }

  const parseResult = insightRequestSchema.safeParse(parsedJson);
  if (!parseResult.success) {
    const errorBody: InsightError = {
      code: 'BAD_REQUEST',
      message: `Dữ liệu không đúng schema: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    };
    return Response.json(errorBody, { status: 400 });
  }

  const req = parseResult.data;

  // 3. Kiểm tra số ngày dữ liệu (ít nhất 3 ngày) & dataQuality
  if (req.trend.dataQuality.days < 3 || !req.trend.dataQuality.sufficient) {
    const errorBody: InsightError = {
      code: 'INSUFFICIENT_DATA',
      message: 'Cần ít nhất 3 ngày số liệu để AI nhận xét xu hướng.',
      fallback: fallbackInsight(req),
    };
    return Response.json(errorBody, { status: 422 });
  }

  // 4. Rate Limiting (10 req/phút/IP)
  if (!defaultRateLimiter.check(clientIp)) {
    const errorBody: InsightError = {
      code: 'RATE_LIMITED',
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít giây.',
      fallback: fallbackInsight(req),
    };
    return Response.json(errorBody, { status: 429 });
  }

  // 5. Kiểm tra LRU cache server
  const reqHash = hashRequest(req);
  const cachedResponse = getFromCache(reqHash);
  if (cachedResponse) {
    return Response.json(cachedResponse, { status: 200 });
  }

  // 6. Chuẩn bị prompt & gọi Provider với retry
  // buildUserPrompt (BA-03) pure, escape dữ liệu người dùng — không còn đường dự phòng gửi JSON thô
  // (JSON thô không escape "</data>" → mở lại lỗ prompt injection E28)
  const userPrompt = buildUserPrompt(req);
  const systemPrompt = SYSTEM_PROMPT_WITH_EXAMPLES;

  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    const errorBody: InsightError = {
      code: 'PROVIDER_ERROR',
      message: err instanceof Error ? err.message : 'Lỗi khởi tạo nhà cung cấp AI.',
      fallback: fallbackInsight(req),
    };
    return Response.json(errorBody, { status: 502 });
  }

  let rawLlmOutput: unknown;
  let callError: unknown;

  const aiConfig = readAiRuntimeConfig();

  // Lần gọi 1
  try {
    rawLlmOutput = await provider.generateJson(systemPrompt, userPrompt, INSIGHT_JSON_SCHEMA, {
      timeoutMs: aiConfig.timeoutMs,
      temperature: aiConfig.temperature,
    });
  } catch (err) {
    callError = err;
    const elapsed = Date.now() - startTime;
    const remainingBudget = aiConfig.totalBudgetMs - elapsed;

    // Retry 1 lần nếu còn >= 5s
    if (remainingBudget >= AI_RETRY_RESERVE_MS) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        rawLlmOutput = await provider.generateJson(systemPrompt, userPrompt, INSIGHT_JSON_SCHEMA, {
          timeoutMs: remainingBudget - 1_000,
          temperature: 0,
        });
        callError = null;
      } catch (retryErr) {
        callError = retryErr;
      }
    }
  }

  if (callError || !rawLlmOutput) {
    const isTimeout =
      callError instanceof Error &&
      (callError.message.includes('TIMEOUT') || callError.name === 'AbortError');

    const errorBody: InsightError = {
      code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
      message: isTimeout
        ? 'Quá thời gian chờ phản hồi từ nhà cung cấp AI.'
        : 'Lỗi phản hồi từ nhà cung cấp AI hoặc chưa có API key.',
      fallback: fallbackInsight(req),
    };
    return Response.json(errorBody, { status: isTimeout ? 504 : 502 });
  }

  // 7. Thực thi Guardrails 7 bước
  const guardrailResult = enforceGuardrails(rawLlmOutput, req, {
    // docs/05 §5: model = `${AI_MODEL}@${PROMPT_VERSION}` — trước viết cứng "@v1.0"
    modelName: `${process.env.AI_MODEL || provider.name}@${PROMPT_VERSION}`,
  });

  if (!guardrailResult.ok) {
    const errorBody: InsightError = {
      code: 'INVALID_OUTPUT',
      message: `Đầu ra AI không hợp lệ sau kiểm định: ${guardrailResult.reason}`,
      fallback: fallbackInsight(req),
    };
    return Response.json(errorBody, { status: 502 });
  }

  const finalResponse = guardrailResult.value;

  // Lưu cache
  setToCache(reqHash, finalResponse);

  return Response.json(finalResponse, { status: 200 });
}
