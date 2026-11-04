vi.mock('server-only', () => ({}));

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureMigrated, getDb, resetDb } from './client';
import { account, profile, schema, session, user, userData } from './schema';

describe('ACC-01 · Database Client & Drizzle Schema (PGlite)', () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'pglite://memory';
    await resetDb();
    await ensureMigrated();
  });

  afterEach(async () => {
    await resetDb();
    if (originalUrl !== undefined) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it('khởi tạo thành công getDb() và nạp đủ 6 bảng', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(schema.user).toBeDefined();
    expect(schema.session).toBeDefined();
    expect(schema.account).toBeDefined();
    expect(schema.verification).toBeDefined();
    expect(schema.profile).toBeDefined();
    expect(schema.userData).toBeDefined();
  });

  it('thực hiện CRUD trên bảng user và profile', async () => {
    const db = getDb();
    const userId = 'user_test_1';
    const now = new Date();

    // Insert user
    await db.insert(user).values({
      id: userId,
      name: 'Nguyen Van A',
      email: 'a@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    const userRows = await db.select().from(user).where(eq(user.id, userId));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.email).toBe('a@example.com');

    // Insert profile with avatar bytea
    const fakeAvatar = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes
    await db.insert(profile).values({
      userId,
      displayName: 'Van A',
      company: 'Tech Corp',
      jobTitle: 'Data Engineer',
      avatar: fakeAvatar,
      avatarType: 'image/png',
      avatarVersion: 1,
      updatedAt: now,
    });

    const profileRows = await db.select().from(profile).where(eq(profile.userId, userId));
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0]?.displayName).toBe('Van A');
    expect(profileRows[0]?.avatarVersion).toBe(1);
    expect(Buffer.from(profileRows[0]?.avatar as Buffer)).toEqual(fakeAvatar);

    // Insert userData
    await db.insert(userData).values({
      userId,
      state: 'eJwzNTA0AwAClAFB',
      revision: 1,
      rows: 10,
      bytes: 100,
      updatedAt: now,
    });

    const dataRows = await db.select().from(userData).where(eq(userData.userId, userId));
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0]?.rows).toBe(10);
  });

  it('A11: xoá user → cascade tự động xoá profile, user_data, session, account', async () => {
    const db = getDb();
    const userId = 'user_cascade_test';
    const now = new Date();

    await db.insert(user).values({
      id: userId,
      name: 'User Cascade',
      email: 'cascade@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(profile).values({
      userId,
      displayName: 'Cascade User',
      updatedAt: now,
    });

    await db.insert(userData).values({
      userId,
      state: 'state_payload',
      revision: 1,
      rows: 5,
      bytes: 50,
      updatedAt: now,
    });

    await db.insert(session).values({
      id: 'sess_1',
      token: 'tok_1',
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(account).values({
      id: 'acc_1',
      accountId: 'acc_id_1',
      providerId: 'credential',
      userId,
      createdAt: now,
      updatedAt: now,
    });

    // Delete user
    await db.delete(user).where(eq(user.id, userId));

    // Verify cascade deleted everywhere
    const users = await db.select().from(user).where(eq(user.id, userId));
    const profiles = await db.select().from(profile).where(eq(profile.userId, userId));
    const datas = await db.select().from(userData).where(eq(userData.userId, userId));
    const sessions = await db.select().from(session).where(eq(session.userId, userId));
    const accounts = await db.select().from(account).where(eq(account.userId, userId));

    expect(users).toHaveLength(0);
    expect(profiles).toHaveLength(0);
    expect(datas).toHaveLength(0);
    expect(sessions).toHaveLength(0);
    expect(accounts).toHaveLength(0);
  });
});
