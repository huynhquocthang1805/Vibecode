// Owner: data-engineer (Huy) — ACC-03: POST avatar (magic bytes, ≤ 200 KB, cấm SVG) & DELETE avatar
import { eq } from 'drizzle-orm';

import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { checkAvatarRateLimit, detectImageType } from '@/lib/server/accountHelper';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, getDb } from '@/lib/server/db/client';
import { profile, user as userTable } from '@/lib/server/db/schema';
import { LIMITS_ACCOUNT, type AccountError, type UserProfile } from '@/types/domain';

export async function POST(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  // Rate limit: 10 upload/phút
  const allowed = checkAvatarRateLimit(userOrRes.id, 10, 60000);
  if (!allowed) {
    const error: AccountError = {
      code: 'RATE_LIMITED',
      message: 'Bạn đã tải lên ảnh quá nhiều lần. Vui lòng thử lại sau 1 phút.',
    };
    return Response.json(error, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Không tìm thấy dữ liệu form.',
    };
    return Response.json(error, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Vui lòng chọn file ảnh để tải lên.',
    };
    return Response.json(error, { status: 400 });
  }

  // Kiểm tra kích thước file (≤ 200 KB)
  if (file.size > LIMITS_ACCOUNT.AVATAR_MAX_BYTES) {
    const error: AccountError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: `Dung lượng ảnh vượt quá giới hạn ${LIMITS_ACCOUNT.AVATAR_MAX_BYTES / 1024} KB.`,
    };
    return Response.json(error, { status: 413 });
  }

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // Kiểm tra magic bytes (PNG, JPEG, WebP; cấm SVG và file giả)
  const mimeType = detectImageType(buf);
  if (!mimeType) {
    const error: AccountError = {
      code: 'UNSUPPORTED_MEDIA',
      message: 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP (cấm SVG).',
    };
    return Response.json(error, { status: 415 });
  }

  await ensureMigrated();
  const db = getDb();
  const now = new Date();

  const [u] = await db.select().from(userTable).where(eq(userTable.id, userOrRes.id));
  const [existing] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));
  const nextVersion = (existing?.avatarVersion ?? 0) + 1;

  if (existing) {
    await db
      .update(profile)
      .set({
        avatar: buf,
        avatarType: mimeType,
        avatarVersion: nextVersion,
        updatedAt: now,
      })
      .where(eq(profile.userId, userOrRes.id));
  } else {
    await db.insert(profile).values({
      userId: userOrRes.id,
      displayName: u?.name ?? userOrRes.email.split('@')[0] ?? '',
      company: null,
      jobTitle: null,
      avatar: buf,
      avatarType: mimeType,
      avatarVersion: nextVersion,
      updatedAt: now,
    });
  }

  const [updatedProf] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));

  const result: UserProfile = {
    id: userOrRes.id,
    email: userOrRes.email,
    displayName: updatedProf?.displayName ?? u?.name ?? userOrRes.email.split('@')[0] ?? '',
    company: updatedProf?.company ?? null,
    jobTitle: updatedProf?.jobTitle ?? null,
    avatarUrl: `/api/account/avatar/${userOrRes.id}?v=${nextVersion}`,
    createdAt: u ? u.createdAt.getTime() : Date.now(),
  };

  return Response.json(result, { status: 200 });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  await ensureMigrated();
  const db = getDb();
  const now = new Date();

  const [u] = await db.select().from(userTable).where(eq(userTable.id, userOrRes.id));
  const [existing] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));
  const nextVersion = (existing?.avatarVersion ?? 0) + 1;

  if (existing) {
    await db
      .update(profile)
      .set({
        avatar: null,
        avatarType: null,
        avatarVersion: nextVersion,
        updatedAt: now,
      })
      .where(eq(profile.userId, userOrRes.id));
  }

  const [updatedProf] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));

  const result: UserProfile = {
    id: userOrRes.id,
    email: userOrRes.email,
    displayName: updatedProf?.displayName ?? u?.name ?? userOrRes.email.split('@')[0] ?? '',
    company: updatedProf?.company ?? null,
    jobTitle: updatedProf?.jobTitle ?? null,
    avatarUrl: null,
    createdAt: u ? u.createdAt.getTime() : Date.now(),
  };

  return Response.json(result, { status: 200 });
}
