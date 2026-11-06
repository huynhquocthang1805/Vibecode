import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { accountConfigured, accountStub, authTrustedOrigins } from './accountConfig';

describe('accountConfig (ACC-00)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('thiếu DATABASE_URL hoặc BETTER_AUTH_SECRET → chưa bật, API trả 503 NOT_CONFIGURED (docs/14 A1)', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
    expect(accountConfigured()).toBe(false);
    const r = accountStub('ACC-03');
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('đủ cấu hình nhưng task chưa làm → 501', () => {
    vi.stubEnv('DATABASE_URL', 'pglite://memory');
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
    expect(accountConfigured()).toBe(true);
    expect(accountStub('ACC-03').status).toBe(501);
  });
});

describe('ACC-FIX-03 · authTrustedOrigins', () => {
  it('chỉ có BETTER_AUTH_URL (máy dev) → đúng 1 origin, bỏ "/" cuối và path', () => {
    expect(authTrustedOrigins({ BETTER_AUTH_URL: 'https://vibecode-three-xi.vercel.app/' })).toEqual([
      'https://vibecode-three-xi.vercel.app',
    ]);
  });

  it('trên Vercel: thêm địa chỉ deploy, nhánh, production (biến hệ thống không có https://), không trùng', () => {
    expect(
      authTrustedOrigins({
        BETTER_AUTH_URL: 'https://vibecode-three-xi.vercel.app',
        VERCEL_URL: 'vibecode-cbcr1e01c-dashboard-data.vercel.app',
        VERCEL_BRANCH_URL: 'vibecode-git-main-dashboard-data.vercel.app',
        VERCEL_PROJECT_PRODUCTION_URL: 'vibecode-three-xi.vercel.app',
      }),
    ).toEqual([
      'https://vibecode-three-xi.vercel.app',
      'https://vibecode-cbcr1e01c-dashboard-data.vercel.app',
      'https://vibecode-git-main-dashboard-data.vercel.app',
    ]);
  });

  it('không bao giờ có wildcard; thiếu/rỗng/hỏng → bỏ qua, không ném', () => {
    expect(authTrustedOrigins({})).toEqual([]);
    expect(authTrustedOrigins({ BETTER_AUTH_URL: '  ', VERCEL_URL: '' })).toEqual([]);
    expect(authTrustedOrigins({ BETTER_AUTH_URL: 'not a url' })).toEqual([]);
    const all = authTrustedOrigins({ VERCEL_URL: 'a.vercel.app', BETTER_AUTH_URL: 'http://localhost:3000' });
    expect(all.some((o) => o.includes('*'))).toBe(false);
    expect(all).toEqual(['http://localhost:3000', 'https://a.vercel.app']);
  });
});
