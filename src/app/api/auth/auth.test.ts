vi.mock('server-only', () => ({}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth, requireUser } from '@/lib/server/auth';
import { ensureMigrated, resetDb } from '@/lib/server/db/client';

import { GET, POST } from './[...all]/route';

describe('ACC-02 · better-auth integration & requireUser on PGlite', () => {
  const originalEnv = { ...process.env };
  const TEST_SECRET = 'secret-for-test-suite-must-be-at-least-32-chars-long';

  beforeEach(async () => {
    process.env.DATABASE_URL = 'pglite://memory';
    process.env.BETTER_AUTH_SECRET = TEST_SECRET;
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    await resetDb();
    await ensureMigrated();
  });

  afterEach(async () => {
    await resetDb();
    process.env = { ...originalEnv };
  });

  it('A1: khi thiếu cấu hình env → trả 503 NOT_CONFIGURED', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;

    const req = new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'NOT_CONFIGURED' });

    // requireUser cũng trả 503
    const userRes = await requireUser(req);
    expect(userRes).toBeInstanceOf(Response);
    expect((userRes as Response).status).toBe(503);
  });

  it('A2: đăng ký email mới → nhận cookie phiên → requireUser xác thực thành công', async () => {
    const signupReq = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Nguyen Van A',
        email: 'vana@example.com',
        password: 'password123',
      }),
    });

    const signupRes = await POST(signupReq);
    expect(signupRes.status).toBe(200);
    const signupBody = await signupRes.json();
    expect(signupBody.user.email).toBe('vana@example.com');
    expect(signupBody.user.name).toBe('Nguyen Van A');

    const setCookie = signupRes.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();

    // Dùng GET /api/auth/get-session để kiểm tra phiên
    const getSessionReq = new Request('http://localhost:3000/api/auth/get-session', {
      method: 'GET',
      headers: {
        cookie: setCookie ?? '',
      },
    });
    const sessionRes = await GET(getSessionReq);
    expect(sessionRes.status).toBe(200);
    const sessionData = await sessionRes.json();
    expect(sessionData.user.email).toBe('vana@example.com');

    // Dùng cookie để gọi requireUser
    const authReq = new Request('http://localhost:3000/api/account/profile', {
      method: 'GET',
      headers: {
        cookie: setCookie ?? '',
      },
    });

    const user = await requireUser(authReq);
    expect(user).not.toBeInstanceOf(Response);
    if (!(user instanceof Response)) {
      expect(user.email).toBe('vana@example.com');
      expect(user.id).toBe(signupBody.user.id);
    }
  });

  it('A3: kiểm tra mật khẩu ngắn, email sai định dạng, email trùng và không lộ email khi sai mật khẩu', async () => {
    // 1. Mật khẩu < 8 ký tự
    const shortPassReq = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'User Short',
        email: 'short@example.com',
        password: '12345',
      }),
    });
    const shortPassRes = await POST(shortPassReq);
    expect(shortPassRes.status).toBe(400);

    // 2. Email sai định dạng
    const badEmailReq = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'User Bad Email',
        email: 'not-an-email',
        password: 'password123',
      }),
    });
    const badEmailRes = await POST(badEmailReq);
    expect(badEmailRes.status).toBe(400);

    // 3. Đăng ký email hợp lệ lần 1
    const validSignup = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'User Exists',
        email: 'exists@example.com',
        password: 'password123',
      }),
    });
    const validRes = await POST(validSignup);
    expect(validRes.status).toBe(200);

    // 4. Đăng ký lại cùng email → 422 (User already exists)
    const dupSignup = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'User Exists 2',
        email: 'exists@example.com',
        password: 'password123',
      }),
    });
    const dupRes = await POST(dupSignup);
    expect(dupRes.status).toBe(422);

    // 5. Đăng nhập sai mật khẩu với email đã tồn tại
    const wrongPassReq = new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'exists@example.com',
        password: 'wrong-password-999',
      }),
    });
    const wrongPassRes = await POST(wrongPassReq);
    expect(wrongPassRes.status).toBe(401);
    const wrongPassBody = await wrongPassRes.json();

    // 6. Đăng nhập với email không tồn tại
    const nonExistentReq = new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'unknown-user-123456@example.com',
        password: 'wrong-password-999',
      }),
    });
    const nonExistentRes = await POST(nonExistentReq);
    expect(nonExistentRes.status).toBe(401);
    const nonExistentBody = await nonExistentRes.json();

    // Cả 2 đều trả cùng mã lỗi, không lộ email có tồn tại hay không
    expect(wrongPassBody.code).toBe(nonExistentBody.code);
    expect(wrongPassBody.message).toBe(nonExistentBody.message);
  });

  it('A4: 11 lần đăng nhập sai / phút từ cùng IP → 429 RATE_LIMITED', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const req = new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({
          email: 'ratelimit@example.com',
          password: 'wrongpassword',
        }),
      });
      const res = await POST(req);
      statuses.push(res.status);
    }

    // 10 lần đầu bị từ chối 401 vì sai mật khẩu, lần 11 bị chặn 429
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });

  it('A5: đăng xuất → phiên bị huỷ, requireUser trả 401', async () => {
    // Đăng ký
    const signupReq = new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Nguyen Van Logout',
        email: 'logout@example.com',
        password: 'password123',
      }),
    });
    const signupRes = await POST(signupReq);
    const cookie = signupRes.headers.get('set-cookie');
    expect(cookie).toBeTruthy();

    // Xác nhận đăng nhập thành công
    const authReq1 = new Request('http://localhost:3000/api/account/profile', {
      headers: { cookie: cookie ?? '' },
    });
    const u1 = await requireUser(authReq1);
    expect(u1).not.toBeInstanceOf(Response);

    // Đăng xuất
    const signoutReq = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookie ?? '',
      },
    });
    const signoutRes = await POST(signoutReq);
    expect(signoutRes.status).toBe(200);

    // Thử truy cập lại bằng cookie cũ → 401
    const authReq2 = new Request('http://localhost:3000/api/account/profile', {
      headers: { cookie: cookie ?? '' },
    });
    const u2 = await requireUser(authReq2);
    expect(u2).toBeInstanceOf(Response);
    expect((u2 as Response).status).toBe(401);
  });

  it('ACC-FIX-01: auth được khởi tạo lười qua Proxy, không gọi betterAuth khi chưa cấu hình', () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => auth.handler).toThrow('ACCOUNT_NOT_CONFIGURED');
  });
});
