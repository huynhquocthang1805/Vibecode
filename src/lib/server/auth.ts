// Owner: data-engineer (Huy) — ACC-02: better-auth server configuration & requireUser helper
import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { LIMITS_ACCOUNT, type AccountError } from '@/types/domain';

import { accountConfigured, notConfiguredResponse } from './accountConfig';
import { getDb } from './db/client';
import { schema } from './db/schema';

// R-01: Chỉ dùng fallback secret cho môi trường test/build không phải production
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV !== 'production'
    ? 'fallback-secret-for-build-environment-32chars'
    : '');

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema,
  }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: LIMITS_ACCOUNT.PASSWORD_MIN,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: LIMITS_ACCOUNT.LOGIN_RATE_PER_MIN,
    storage: 'memory',
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: LIMITS_ACCOUNT.LOGIN_RATE_PER_MIN,
      },
      '/sign-up/email': {
        window: 60,
        max: LIMITS_ACCOUNT.LOGIN_RATE_PER_MIN,
      },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
});

/**
 * Xác thực phiên người dùng từ Request headers.
 * Trả về thông tin người dùng { id, email } hoặc Response 401 nếu chưa đăng nhập, 503 nếu chưa cấu hình.
 */
export async function requireUser(
  req: Request,
): Promise<{ id: string; email: string } | Response> {
  if (!accountConfigured()) {
    return notConfiguredResponse();
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    const error: AccountError = {
      code: 'UNAUTHORIZED',
      message: 'Vui lòng đăng nhập.',
    };
    return Response.json(error, { status: 401 });
  }

  return {
    id: session.user.id,
    email: session.user.email,
  };
}
