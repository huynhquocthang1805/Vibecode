// Owner: data-engineer (Huy) — ACC-02: better-auth client for React
// ACC-08: thêm emailOTPClient → authClient.emailOtp.verifyEmail / sendVerificationOtp (mã xác nhận đăng ký)
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
