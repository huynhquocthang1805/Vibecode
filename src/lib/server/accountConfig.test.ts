import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { accountConfigured, accountStub } from './accountConfig';

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
