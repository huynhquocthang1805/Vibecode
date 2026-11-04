// Owner: data-engineer (Huy) — ACC-03: GET profile & PUT profile patch
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, getDb } from '@/lib/server/db/client';
import { profile, user as userTable } from '@/lib/server/db/schema';
import { LIMITS_ACCOUNT, type AccountError, type UserProfile } from '@/types/domain';

function stripControlChars(val: string): string {
  // Loại bỏ ký tự điều khiển ngoại trừ khoảng trắng thông thường
  return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const profilePatchSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Tên không được để trống.')
      .max(LIMITS_ACCOUNT.MAX_DISPLAY_NAME, `Tên tối đa ${LIMITS_ACCOUNT.MAX_DISPLAY_NAME} ký tự.`)
      .optional(),
    company: z
      .string()
      .trim()
      .max(LIMITS_ACCOUNT.MAX_COMPANY, `Tên công ty tối đa ${LIMITS_ACCOUNT.MAX_COMPANY} ký tự.`)
      .nullable()
      .optional(),
    jobTitle: z
      .string()
      .trim()
      .max(LIMITS_ACCOUNT.MAX_JOB_TITLE, `Chức danh tối đa ${LIMITS_ACCOUNT.MAX_JOB_TITLE} ký tự.`)
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Không có dữ liệu cập nhật.',
  });

export async function GET(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  await ensureMigrated();
  const db = getDb();

  const [u] = await db.select().from(userTable).where(eq(userTable.id, userOrRes.id));
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));

  const result: UserProfile = {
    id: userOrRes.id,
    email: userOrRes.email,
    displayName: prof?.displayName ?? u?.name ?? userOrRes.email.split('@')[0] ?? '',
    company: prof?.company ?? null,
    jobTitle: prof?.jobTitle ?? null,
    avatarUrl:
      prof?.avatar && prof.avatarVersion
        ? `/api/account/avatar/${userOrRes.id}?v=${prof.avatarVersion}`
        : null,
    createdAt: u ? u.createdAt.getTime() : Date.now(),
  };

  return Response.json(result, { status: 200 });
}

export async function PUT(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    const error: AccountError = { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ.' };
    return Response.json(error, { status: 400 });
  }

  // Tiền xử lý: loại bỏ control chars
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      sanitized[k] = stripControlChars(v);
    } else {
      sanitized[k] = v;
    }
  }

  const parsed = profilePatchSchema.safeParse(sanitized);
  if (!parsed.success) {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.',
    };
    return Response.json(error, { status: 400 });
  }

  await ensureMigrated();
  const db = getDb();

  const [u] = await db.select().from(userTable).where(eq(userTable.id, userOrRes.id));
  const [existing] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));
  const now = new Date();

  const newDisplayName =
    parsed.data.displayName ?? existing?.displayName ?? u?.name ?? userOrRes.email.split('@')[0] ?? '';
  const newCompany =
    parsed.data.company !== undefined ? parsed.data.company : (existing?.company ?? null);
  const newJobTitle =
    parsed.data.jobTitle !== undefined ? parsed.data.jobTitle : (existing?.jobTitle ?? null);

  if (existing) {
    await db
      .update(profile)
      .set({
        displayName: newDisplayName,
        company: newCompany,
        jobTitle: newJobTitle,
        updatedAt: now,
      })
      .where(eq(profile.userId, userOrRes.id));
  } else {
    await db.insert(profile).values({
      userId: userOrRes.id,
      displayName: newDisplayName,
      company: newCompany,
      jobTitle: newJobTitle,
      avatar: null,
      avatarType: null,
      avatarVersion: 0,
      updatedAt: now,
    });
  }

  if (parsed.data.displayName) {
    await db
      .update(userTable)
      .set({ name: parsed.data.displayName, updatedAt: now })
      .where(eq(userTable.id, userOrRes.id));
  }

  const [updatedProf] = await db.select().from(profile).where(eq(profile.userId, userOrRes.id));

  const result: UserProfile = {
    id: userOrRes.id,
    email: userOrRes.email,
    displayName: updatedProf?.displayName ?? newDisplayName,
    company: updatedProf?.company ?? null,
    jobTitle: updatedProf?.jobTitle ?? null,
    avatarUrl:
      updatedProf?.avatar && updatedProf.avatarVersion
        ? `/api/account/avatar/${userOrRes.id}?v=${updatedProf.avatarVersion}`
        : null,
    createdAt: u ? u.createdAt.getTime() : Date.now(),
  };

  return Response.json(result, { status: 200 });
}
