// Owner: data-engineer (Huy) — ACC-02 & ACC-FIX-01: better-auth server configuration (lazy init) & requireUser helper
import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';

import { LIMITS_ACCOUNT, type AccountError } from '@/types/domain';

import { accountConfigured, authTrustedOrigins, notConfiguredResponse } from './accountConfig';
import { getDb, type Database } from './db/client';
import { buildOtpEmail, describeMailError, emailVerificationEnabled, sendMail } from './mailer';
import { schema } from './db/schema';

const OTP_TTL_SECONDS = 600; // 10 phút

function createAuthInstance(db: Database, secret: string, verifyEmail: boolean) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    secret,
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    // ACC-FIX-03: cho phép cả địa chỉ deploy/preview của chính project trên Vercel (không wildcard)
    trustedOrigins: authTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: LIMITS_ACCOUNT.PASSWORD_MIN,
      // Chưa nhập mã → không đăng nhập được (403 EMAIL_NOT_VERIFIED), đăng nhập lại sẽ gửi mã mới
      requireEmailVerification: verifyEmail,
    },
    emailVerification: {
      sendOnSignIn: verifyEmail,
      autoSignInAfterVerification: true, // nhập đúng mã → vào luôn, không phải đăng nhập lại
    },
    plugins: verifyEmail
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
}

type AuthInstance = ReturnType<typeof createAuthInstance>;

let _auth: AuthInstance | null = null;
let _authDb: Database | null = null;
let _authSecret: string | undefined;
let _authVerifyEmail: boolean | undefined;

/**
 * ACC-FIX-01: Khởi tạo lười betterAuth() chỉ khi accountConfigured() === true.
 * Tránh gọi betterAuth() lúc import khiến `npm run build` in BetterAuthError + cảnh báo baseURL
 * khi môi trường không cấu hình tài khoản (docs/14 §1.2).
 */
function getAuth(): AuthInstance {
  if (!accountConfigured()) {
    throw new Error('ACCOUNT_NOT_CONFIGURED');
  }

  const db = getDb();
  const secret = process.env.BETTER_AUTH_SECRET!;
  /** ACC-08: mã xác nhận đăng ký qua email — chỉ bật khi có SMTP (mailer.ts), không thì đăng ký như cũ */
  const verifyEmail = emailVerificationEnabled();

  if (
    _auth &&
    _authDb === db &&
    _authSecret === secret &&
    _authVerifyEmail === verifyEmail
  ) {
    return _auth;
  }

  _authDb = db;
  _authSecret = secret;
  _authVerifyEmail = verifyEmail;
  _auth = createAuthInstance(db, secret, verifyEmail);
  return _auth;
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
  get(_target, prop, receiver) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
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
