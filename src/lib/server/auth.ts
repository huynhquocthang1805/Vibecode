// Owner: data-engineer (Huy) — ACC-02: better-auth server configuration & requireUser helper
import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';

import { LIMITS_ACCOUNT, type AccountError } from '@/types/domain';

import { accountConfigured, authTrustedOrigins, notConfiguredResponse } from './accountConfig';
import { getDb } from './db/client';
import { buildOtpEmail, describeMailError, emailVerificationEnabled, sendMail } from './mailer';
import { schema } from './db/schema';

// R-01: Chỉ dùng fallback secret cho môi trường test/build không phải production
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV !== 'production'
    ? 'fallback-secret-for-build-environment-32chars'
    : '');

/** ACC-08: mã xác nhận đăng ký qua email — chỉ bật khi có SMTP (mailer.ts), không thì đăng ký như cũ */
const VERIFY_EMAIL = emailVerificationEnabled();
const OTP_TTL_SECONDS = 600; // 10 phút

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema,
  }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL,
  // ACC-FIX-03: cho phép cả địa chỉ deploy/preview của chính project trên Vercel (không wildcard)
  trustedOrigins: authTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: LIMITS_ACCOUNT.PASSWORD_MIN,
    // Chưa nhập mã → không đăng nhập được (403 EMAIL_NOT_VERIFIED), đăng nhập lại sẽ gửi mã mới
    requireEmailVerification: VERIFY_EMAIL,
  },
  emailVerification: {
    sendOnSignIn: VERIFY_EMAIL,
    autoSignInAfterVerification: true, // nhập đúng mã → vào luôn, không phải đăng nhập lại
  },
  plugins: VERIFY_EMAIL
    ? [
        emailOTP({
          overrideDefaultEmailVerification: true, // gửi mã 6 số thay cho link
          sendVerificationOnSignUp: true,
          otpLength: 6,
          expiresIn: OTP_TTL_SECONDS,
          allowedAttempts: 5,
          storeOTP: 'hashed', // DB chỉ giữ bản băm của mã
          async sendVerificationOTP({ email, otp, type }) {
            try {
              await sendMail(buildOtpEmail(email, otp, type, OTP_TTL_SECONDS / 60));
            } catch (err) {
              // better-auth nuốt lỗi gửi thư (vẫn trả 200) → ghi rõ nguyên nhân cho Vercel Logs. KHÔNG ghi mã/mật khẩu.
              console.error(`[mailer] Gửi mã ${type} thất bại: ${describeMailError(err)}`);
              throw err;
            }
          },
        }),
      ]
    : [],
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
