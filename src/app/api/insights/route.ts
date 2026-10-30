// Owner: ai-engineer (Hoàng Anh) — AI-02. Stub trả 501 có dạng InsightError.
import type { InsightError } from '@/types/domain';

export async function POST(_request: Request): Promise<Response> {
  const body: InsightError = { code: 'PROVIDER_ERROR', message: 'Tính năng AI chưa được cài đặt (AI-02).' };
  return Response.json(body, { status: 501 });
}
