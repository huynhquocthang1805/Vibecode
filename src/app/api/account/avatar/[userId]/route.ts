// Owner: data-engineer (Huy) — ACC-03: GET avatar by userId (chỉ chủ tài khoản xem được)
import { eq } from 'drizzle-orm';

import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, getDb } from '@/lib/server/db/client';
import { profile } from '@/lib/server/db/schema';
import type { AccountError } from '@/types/domain';

export async function GET(
  req: Request,
  props: { params: Promise<{ userId: string }> },
): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  const { userId } = await props.params;

  // A8: Chỉ chủ tài khoản mới được xem avatar của mình
  if (userOrRes.id !== userId) {
    const error: AccountError = {
      code: 'UNAUTHORIZED',
      message: 'Bạn không có quyền xem ảnh này.',
    };
    return Response.json(error, { status: 404 });
  }

  await ensureMigrated();
  const db = getDb();

  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId));

  if (!prof || !prof.avatar) {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Ảnh đại diện không tồn tại.',
    };
    return Response.json(error, { status: 404 });
  }

  const avatarBuffer = Buffer.from(prof.avatar as Buffer);

  return new Response(avatarBuffer, {
    status: 200,
    headers: {
      'Content-Type': prof.avatarType || 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
