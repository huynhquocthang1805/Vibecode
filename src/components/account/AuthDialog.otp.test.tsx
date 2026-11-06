import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthDialog } from './AuthDialog';

const signUpEmail = vi.fn();
const signInEmail = vi.fn();
const verifyEmail = vi.fn();
const sendVerificationOtp = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: { email: (...a: unknown[]) => signUpEmail(...a) },
    signIn: { email: (...a: unknown[]) => signInEmail(...a) },
    emailOtp: {
      verifyEmail: (...a: unknown[]) => verifyEmail(...a),
      sendVerificationOtp: (...a: unknown[]) => sendVerificationOtp(...a),
    },
  },
}));
vi.mock('@/lib/data/storage/userStorage', () => ({
  getGuestDataStats: () => ({ exists: false }),
  migrateGuestDataToUser: vi.fn(),
}));

function fillSignup() {
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Huỳnh Quốc Thắng' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'quocthanghuynh180504@gmail.com' } });
  fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: 'matkhau123' } });
  fireEvent.click(screen.getByRole('button', { name: /Tạo tài khoản/ }));
}

describe('ACC-08 · AuthDialog bước nhập mã xác nhận email', () => {
  beforeEach(() => {
    [signUpEmail, signInEmail, verifyEmail, sendVerificationOtp].forEach((f) => f.mockReset());
  });

  it('đăng ký khi server bật xác nhận (token null) → hiện ô nhập mã, báo đã gửi tới email', async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: 'u1' } }, error: null });
    render(<AuthDialog isOpen onClose={() => {}} />);
    fillSignup();
    expect(await screen.findByTestId('verify-email-form')).toBeInTheDocument();
    expect(screen.getByText(/Đã gửi mã xác nhận 6 số tới quocthanghuynh180504@gmail.com/)).toBeInTheDocument();
    const input = screen.getByLabelText(/Mã xác nhận/);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByRole('button', { name: /Gửi lại mã \(\d+s\)/ })).toBeDisabled();
  });

  it('chỉ nhận số, tối đa 6; nhập đúng → gọi verifyEmail và đóng hộp thoại', async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: 'u1' } }, error: null });
    verifyEmail.mockResolvedValue({ data: { token: 'tok', user: { id: 'u1' } }, error: null });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AuthDialog isOpen onClose={onClose} onSuccess={onSuccess} />);
    fillSignup();
    const input = await screen.findByLabelText(/Mã xác nhận/);
    fireEvent.change(input, { target: { value: '48-29 13 99' } });
    expect(input).toHaveValue('482913');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(verifyEmail).toHaveBeenCalledWith({ email: 'quocthanghuynh180504@gmail.com', otp: '482913' });
    expect(onClose).toHaveBeenCalled();
  });

  it('mã sai → báo lỗi tiếng Việt, vẫn ở bước nhập mã', async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: 'u1' } }, error: null });
    verifyEmail.mockResolvedValue({ data: null, error: { code: 'INVALID_OTP', message: 'Invalid OTP' } });
    render(<AuthDialog isOpen onClose={() => {}} />);
    fillSignup();
    fireEvent.change(await screen.findByLabelText(/Mã xác nhận/), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã xác nhận không đúng');
    expect(screen.getByTestId('verify-email-form')).toBeInTheDocument();
  });

  it('đăng nhập tài khoản chưa xác nhận (EMAIL_NOT_VERIFIED) → chuyển sang nhập mã', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' } });
    render(<AuthDialog isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: 'matkhau123' } });
    // tab và nút gửi cùng tên "Đăng nhập" → bấm nút submit của form
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    expect(await screen.findByTestId('verify-email-form')).toBeInTheDocument();
    expect(screen.getByText(/Đã gửi mã mới tới a@example.com/)).toBeInTheDocument();
  });

  it('server chưa bật xác nhận (có token) → đăng ký vào thẳng như cũ', async () => {
    signUpEmail.mockResolvedValue({ data: { token: 'tok', user: { id: 'u1' } }, error: null });
    const onSuccess = vi.fn();
    render(<AuthDialog isOpen onClose={() => {}} onSuccess={onSuccess} />);
    fillSignup();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByTestId('verify-email-form')).toBeNull();
  });

  it('Gửi lại mã bị lỗi mạng → báo lỗi, không ném ra ngoài (review PR #36)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      signUpEmail.mockResolvedValue({ data: { token: null, user: { id: 'u1' } }, error: null });
      sendVerificationOtp.mockRejectedValue(new TypeError('Failed to fetch'));
      render(<AuthDialog isOpen onClose={() => {}} />);
      fillSignup();
      await screen.findByTestId('verify-email-form');
      // đếm ngược 60 s tạo timer mới mỗi giây → tua từng giây trong act()
      for (let i = 0; i < 61; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      fireEvent.click(await screen.findByRole('button', { name: 'Gửi lại mã' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
      expect(sendVerificationOtp).toHaveBeenCalledWith({
        email: 'quocthanghuynh180504@gmail.com',
        type: 'email-verification',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
