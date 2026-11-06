/**
 * ACC-08 (techlead): xác nhận đăng ký bằng mã 6 số gửi email — chạy better-auth thật trên PGlite,
 * thư được bắt bằng transport giả (không gửi SMTP). auth.ts đọc SMTP_* lúc import → import động sau khi đặt env.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

interface Sent {
  to: string;
  subject: string;
  text: string;
}
const outbox: Sent[] = [];
const BASE = 'http://localhost:3000';
const EMAIL = 'quocthang.test@example.com';
const PASSWORD = 'matkhau123';

let POST: (req: Request) => Promise<Response>;
let requireUser: (req: Request) => Promise<{ id: string; email: string } | Response>;
let resetDb: () => Promise<void>;

const codeOf = (m: Sent | undefined) => m?.text.match(/\b(\d{6})\b/)?.[1] ?? '';
const post = (path: string, body: unknown, cookie?: string) =>
  POST(
    new Request(`${BASE}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  vi.resetModules();
  process.env.DATABASE_URL = 'pglite://memory';
  process.env.BETTER_AUTH_SECRET = 'secret-for-email-otp-suite-at-least-32-chars';
  process.env.BETTER_AUTH_URL = BASE;
  process.env.SMTP_USER = 'quocthanghuynh180504@gmail.com';
  process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
  const mailer = await import('@/lib/server/mailer');
  mailer.setMailTransportForTest({
    sendMail: async (m: { to: string; subject: string; text: string }) => {
      outbox.push({ to: m.to, subject: m.subject, text: m.text });
      return {} as never;
    },
  } as never);
  const db = await import('@/lib/server/db/client');
  resetDb = db.resetDb;
  await db.resetDb();
  await db.ensureMigrated();
  ({ POST } = await import('./[...all]/route'));
  ({ requireUser } = await import('@/lib/server/auth'));
});

afterAll(async () => {
  await resetDb();
  for (const k of ['SMTP_USER', 'SMTP_PASS', 'DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL']) delete process.env[k];
});

describe('ACC-08 · xác nhận đăng ký bằng mã email (SMTP bật)', () => {
  it('đăng ký → KHÔNG có phiên ngay, thư tiếng Việt chứa mã 6 số gửi đúng email', async () => {
    const res = await post('/sign-up/email', { email: EMAIL, password: PASSWORD, name: 'Thắng' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string | null };
    expect(body.token).toBeNull();
    expect(res.headers.get('set-cookie') ?? '').not.toMatch(/session_token=[^;]+/);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(EMAIL);
    expect(outbox[0]!.subject).toMatch(/^\d{6} là mã xác nhận đăng ký KPI Mini$/);
    expect(outbox[0]!.text).toContain('10 phút');
    expect(codeOf(outbox[0])).toMatch(/^\d{6}$/);
  });

  it('đăng nhập khi chưa xác nhận → 403 EMAIL_NOT_VERIFIED và gửi mã mới', async () => {
    const res = await post('/sign-in/email', { email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');
    expect(outbox).toHaveLength(2);
    expect(outbox[1]!.to).toBe(EMAIL);
  });

  it('nhập sai mã → 400 INVALID_OTP, chưa đăng nhập được', async () => {
    const latest = codeOf(outbox.at(-1));
    const wrong = latest === '000000' ? '111111' : '000000';
    const res = await post('/email-otp/verify-email', { email: EMAIL, otp: wrong });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_OTP');
  });

  it('nhập đúng mã mới nhất → 200, có phiên ngay (không phải đăng nhập lại), requireUser nhận ra user', async () => {
    const res = await post('/email-otp/verify-email', { email: EMAIL, otp: codeOf(outbox.at(-1)) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string | null; user: { emailVerified: boolean } };
    expect(body.token).toBeTruthy();
    expect(body.user.emailVerified).toBe(true);
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    const me = await requireUser(new Request(`${BASE}/api/account/profile`, { headers: { cookie } }));
    expect(me).not.toBeInstanceOf(Response);
    expect((me as { email: string }).email).toBe(EMAIL);
  });

  it('sau khi xác nhận: đăng nhập bằng mật khẩu bình thường, không gửi thêm thư', async () => {
    const before = outbox.length;
    const res = await post('/sign-in/email', { email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(outbox.length).toBe(before);
  });
});
