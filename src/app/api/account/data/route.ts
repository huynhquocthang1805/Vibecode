// Owner: data-engineer (Huy) — ACC-04: GET cloud data & PUT cloud data (revision check & 409 conflict)
import { and, eq } from 'drizzle-orm';

import { decodeState } from '@/lib/data/storage/codec';
import { accountConfigured, notConfiguredResponse } from '@/lib/server/accountConfig';
import { requireUser } from '@/lib/server/auth';
import { ensureMigrated, getDb } from '@/lib/server/db/client';
import { userData } from '@/lib/server/db/schema';
import {
  LIMITS_ACCOUNT,
  type AccountError,
  type CloudSnapshotMeta,
  type PersistedState,
} from '@/types/domain';

export async function GET(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  await ensureMigrated();
  const db = getDb();

  const [row] = await db.select().from(userData).where(eq(userData.userId, userOrRes.id));

  // A9: Chưa có dữ liệu trên cloud → 204 No Content
  if (!row) {
    return new Response(null, { status: 204 });
  }

  const meta: CloudSnapshotMeta = {
    revision: row.revision,
    updatedAt: row.updatedAt.getTime(),
    rows: row.rows,
    bytes: row.bytes,
  };

  return Response.json({ meta, state: row.state }, { status: 200 });
}

export async function PUT(req: Request): Promise<Response> {
  if (!accountConfigured()) return notConfiguredResponse();
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  const body = (await req.json().catch(() => null)) as {
    state?: unknown;
    baseRevision?: unknown;
  } | null;

  if (!body || typeof body.state !== 'string' || typeof body.baseRevision !== 'number') {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Yêu cầu không hợp lệ. Cần truyền state và baseRevision.',
    };
    return Response.json(error, { status: 400 });
  }

  const { state, baseRevision } = body;

  // A10: Kiểm tra kích thước payload (≤ 4 MB)
  if (state.length > LIMITS_ACCOUNT.CLOUD_MAX_BYTES) {
    const error: AccountError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: `Dung lượng dữ liệu vượt quá giới hạn ${LIMITS_ACCOUNT.CLOUD_MAX_BYTES / (1024 * 1024)} MB.`,
    };
    return Response.json(error, { status: 413 });
  }

  // A10: Server giải mã kiểm tra tính hợp lệ của state (không tin client)
  let decoded: PersistedState;
  try {
    decoded = decodeState(state);
  } catch {
    const error: AccountError = {
      code: 'BAD_REQUEST',
      message: 'Dữ liệu state bị hỏng hoặc không đúng định dạng codec.',
    };
    return Response.json(error, { status: 400 });
  }

  const rows = decoded.entries.length;
  const bytes = Buffer.byteLength(state, 'utf8');

  await ensureMigrated();
  const db = getDb();

  const [existing] = await db.select().from(userData).where(eq(userData.userId, userOrRes.id));
  const currentRevision = existing ? existing.revision : 0;

  // A9: Phát hiện xung đột revision (baseRevision khác revision hiện tại trên server)
  if (baseRevision !== currentRevision) {
    const error: AccountError = {
      code: 'CONFLICT',
      message: 'Xung đột dữ liệu: Dữ liệu trên máy chủ đã có bản cập nhật mới hơn.',
      server: existing
        ? {
            revision: existing.revision,
            updatedAt: existing.updatedAt.getTime(),
            rows: existing.rows,
            bytes: existing.bytes,
          }
        : undefined,
    };
    return Response.json(error, { status: 409 });
  }

  const now = new Date();
  const nextRevision = currentRevision + 1;

  if (existing) {
    // R-01 (Atomic update): Dùng optimistic locking với condition revision = baseRevision
    const updated = await db
      .update(userData)
      .set({
        state,
        revision: nextRevision,
        rows,
        bytes,
        updatedAt: now,
      })
      .where(and(eq(userData.userId, userOrRes.id), eq(userData.revision, baseRevision)))
      .returning();

    if (updated.length === 0) {
      // Race condition: request đồng thời khác đã commit trước
      const [latest] = await db.select().from(userData).where(eq(userData.userId, userOrRes.id));
      const error: AccountError = {
        code: 'CONFLICT',
        message: 'Xung đột dữ liệu: Dữ liệu trên máy chủ đã có bản cập nhật mới hơn.',
        server: latest
          ? {
              revision: latest.revision,
              updatedAt: latest.updatedAt.getTime(),
              rows: latest.rows,
              bytes: latest.bytes,
            }
          : undefined,
      };
      return Response.json(error, { status: 409 });
    }
  } else {
    // Tạo mới lần đầu (baseRevision === 0): bắt race condition nếu 2 request insert đồng thời
    try {
      await db.insert(userData).values({
        userId: userOrRes.id,
        state,
        revision: nextRevision,
        rows,
        bytes,
        updatedAt: now,
      });
    } catch {
      const [latest] = await db.select().from(userData).where(eq(userData.userId, userOrRes.id));
      const error: AccountError = {
        code: 'CONFLICT',
        message: 'Xung đột dữ liệu: Dữ liệu trên máy chủ đã có bản cập nhật mới hơn.',
        server: latest
          ? {
              revision: latest.revision,
              updatedAt: latest.updatedAt.getTime(),
              rows: latest.rows,
              bytes: latest.bytes,
            }
          : undefined,
      };
      return Response.json(error, { status: 409 });
    }
  }

  const meta: CloudSnapshotMeta = {
    revision: nextRevision,
    updatedAt: now.getTime(),
    rows,
    bytes,
  };

  return Response.json(meta, { status: 200 });
}
