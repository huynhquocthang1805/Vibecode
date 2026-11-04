// Owner: data-engineer (Huy) — ACC-01..06. Khung do techlead tạo ở ACC-00.
import 'server-only';

import type { AccountError } from '@/types/domain';

/** Tài khoản chỉ bật khi server có đủ DATABASE_URL + BETTER_AUTH_SECRET (docs/14 §1.2) */
export function accountConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

export function notConfiguredResponse(): Response {
  const body: AccountError = { code: 'NOT_CONFIGURED', message: 'Tài khoản chưa được bật trên máy chủ.' };
  return Response.json(body, { status: 503 });
}

/** Stub giai đoạn khung: 503 khi chưa cấu hình, 501 khi đã cấu hình nhưng task chưa làm */
export function accountStub(taskId: string): Response {
  if (!accountConfigured()) return notConfiguredResponse();
  const body: AccountError = { code: 'INTERNAL', message: `Chức năng chưa được cài đặt (${taskId}).` };
  return Response.json(body, { status: 501 });
}
