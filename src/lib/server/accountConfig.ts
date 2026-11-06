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

/**
 * ACC-FIX-03 (techlead): origin được phép gọi /api/auth (chống CSRF của better-auth).
 * Trước đây chỉ có BETTER_AUTH_URL → mở trang qua địa chỉ riêng của một lần deploy Vercel
 * (vd `vibecode-abc123-<team>.vercel.app`) thì đăng ký/đăng nhập bị 403 "Invalid origin".
 * Chỉ thêm ĐÚNG các host của project do Vercel cấp (biến hệ thống) — KHÔNG dùng wildcard
 * `*.vercel.app` vì sẽ tin cả app của người khác trên Vercel.
 */
export function authTrustedOrigins(env: Readonly<Record<string, string | undefined>> = process.env): string[] {
  const out = new Set<string>();
  const add = (raw: string | undefined, withScheme: boolean) => {
    const v = raw?.trim();
    if (!v) return;
    try {
      out.add(new URL(withScheme ? v : `https://${v}`).origin);
    } catch {
      // giá trị hỏng → bỏ qua, không làm crash server
    }
  };
  add(env.BETTER_AUTH_URL, true);
  add(env.VERCEL_URL, false); // địa chỉ riêng của lần deploy đang chạy
  add(env.VERCEL_BRANCH_URL, false); // địa chỉ theo nhánh (preview)
  add(env.VERCEL_PROJECT_PRODUCTION_URL, false); // tên miền production
  return [...out];
}
