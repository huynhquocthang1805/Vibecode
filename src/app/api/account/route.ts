// Owner: data-engineer (Huy) — ACC-03: DELETE account (cascade xoá hết dữ liệu)
import { eq } from 'drizzle-orm';

import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, getDb } from '@/lib/server/db/client';
import { user as userTable } from '@/lib/server/db/schema';
import type { AccountError } from '@/types/domain';

export async function DELETE(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;

  // A11: Phải xác nhận gõ đúng từ "XOÁ"
  if (!body || body.confirm !== 'XOÁ') {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Vui lòng xác nhận xoá tài khoản bằng cách nhập chính xác "XOÁ".',
    };
    return Response.json(error, { status: 400 });
  }

  await ensureMigrated();
  const db = getDb();

  // Xoá user → ON DELETE cascade tự động xoá profile, user_data, session, account trong DB
  await db.delete(userTable).where(eq(userTable.id, userOrRes.id));

  return new Response(null, { status: 204 });
}
