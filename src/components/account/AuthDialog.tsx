'use client';

// Owner: data-engineer (Huy) — ACC-05: Modal đăng nhập / đăng ký tài khoản (A12)
// ACC-08 (techlead): bước 'verify' — nhập mã 6 số gửi qua email khi server bật xác nhận email
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, MailCheck, UserPlus } from 'lucide-react';

import { authClient } from '@/lib/auth-client';
import { getGuestDataStats, migrateGuestDataToUser } from '@/lib/data/storage/userStorage';

import { mapAuthError } from './authErrors';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Đếm ngược cho nút "Gửi lại mã" (server giới hạn 3 lần/phút)
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (!isOpen) return null;

  const finishSignedIn = (userId: string | undefined) => {
    // Chuyển dữ liệu khách sang tài khoản nếu có
    const guestStats = getGuestDataStats();
    if (guestStats.exists && userId) migrateGuestDataToUser(userId);
    setIsLoading(false);
    onSuccess?.();
    onClose();
  };

  /** Server đã gửi mã (đăng ký mới / đăng nhập khi chưa xác nhận) → chuyển sang bước nhập mã */
  const startVerify = (message: string) => {
    setMode('verify');
    setOtp('');
    setErrorMessage(null);
    setInfoMessage(message);
    setResendIn(60);
    setIsLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await authClient.emailOtp.verifyEmail({ email, otp: otp.trim() });
      if (res.error) {
        setErrorMessage(mapAuthError(res.error.code || res.error.message));
        setIsLoading(false);
        return;
      }
      // autoSignInAfterVerification bật ở server → đã có phiên; phòng khi tắt thì đăng nhập lại bằng mật khẩu
      if (!res.data?.token && password) {
        const signIn = await authClient.signIn.email({ email, password });
        if (signIn.error) {
          setErrorMessage(mapAuthError(signIn.error.code || signIn.error.message));
          setIsLoading(false);
          return;
        }
        finishSignedIn(signIn.data?.user?.id);
        return;
      }
      finishSignedIn(res.data?.user?.id);
    } catch (err) {
      setErrorMessage(mapAuthError(String(err)));
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      if (res.error) {
        setErrorMessage(mapAuthError(res.error.code || res.error.message));
        return;
      }
      setInfoMessage(`Đã gửi mã mới tới ${email}.`);
      setResendIn(60);
    } catch (err) {
      // mạng đứt / server lỗi → báo lỗi, không để promise rejection chưa bắt (review PR #36 #1)
      setErrorMessage(mapAuthError(String(err)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (mode === 'signup') {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split('@')[0] || 'User',
        });

        if (res.error) {
          setErrorMessage(mapAuthError(res.error.message || res.error.code));
          setIsLoading(false);
          return;
        }

        // Server bật xác nhận email → chưa có phiên (token null), mã đã gửi tới hộp thư
        if (!res.data?.token) {
          startVerify(`Đã gửi mã xác nhận 6 số tới ${email}. Mở Gmail và dán mã vào đây.`);
          return;
        }
        finishSignedIn(res.data.user?.id);
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
        });

        if (res.error) {
          // Tài khoản chưa xác nhận: server đã gửi mã mới (sendOnSignIn) → nhập mã
          if (res.error.code === 'EMAIL_NOT_VERIFIED') {
            startVerify(`Email chưa được xác nhận. Đã gửi mã mới tới ${email}.`);
            return;
          }
          setErrorMessage(mapAuthError(res.error.message || res.error.code));
          setIsLoading(false);
          return;
        }
        finishSignedIn(res.data?.user?.id);
      }
    } catch (err) {
      setErrorMessage(mapAuthError(String(err)));
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-[375px] sm:max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 id="auth-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {mode === 'signin' ? 'Đăng nhập tài khoản' : mode === 'signup' ? 'Tạo tài khoản mới' : 'Xác nhận email'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 touch-manipulation"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {mode === 'verify' ? (
          <form onSubmit={handleVerify} className="mt-5 space-y-4" data-testid="verify-email-form">
            {infoMessage && (
              <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                <MailCheck className="h-4 w-4 shrink-0" aria-hidden /> <span>{infoMessage}</span>
              </div>
            )}
            <div>
              <label htmlFor="auth-otp" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Mã xác nhận (6 số, hiệu lực 10 phút)
              </label>
              <input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
              />
            </div>
            {errorMessage && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {errorMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 min-h-[44px] touch-manipulation cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Xác nhận'}
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Không thấy thư? Kiểm tra mục Spam / Quảng cáo trong Gmail, hoặc bấm &quot;Gửi lại mã&quot;. Email đã đăng ký
              trước đó nhưng chưa xác nhận cũng bấm &quot;Gửi lại mã&quot; để nhận mã mới.
            </p>
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className="min-h-[44px] px-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                ← Đổi email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0}
                className="min-h-[44px] px-2 font-medium text-blue-600 hover:text-blue-700 disabled:text-zinc-400 dark:text-blue-400"
              >
                {resendIn > 0 ? `Gửi lại mã (${resendIn}s)` : 'Gửi lại mã'}
              </button>
            </div>
          </form>
        ) : (
        <>
        {/* Tab chuyển đổi */}
        <div className="mt-4 flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              mode === 'signin'
                ? 'bg-white shadow-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              mode === 'signup'
                ? 'bg-white shadow-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            Đăng ký
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Họ và tên
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Mật khẩu (tối thiểu 8 ký tự)
            </label>
            <div className="relative mt-1">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2.5 pr-11 text-sm shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex h-full w-11 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Lỗi tiếng Việt inline */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 min-h-[44px] touch-manipulation cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'signin' ? (
              <>
                <LogIn className="mr-2 h-4 w-4" /> Đăng nhập
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" /> Tạo tài khoản
              </>
            )}
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
