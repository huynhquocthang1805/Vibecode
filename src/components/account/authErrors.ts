// Owner: data-engineer (Huy) — ACC-05: Ánh xạ lỗi xác thực sang tiếng Việt (R-03)
export function mapAuthError(codeOrMsg?: string | null): string {
  if (!codeOrMsg) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  const lower = codeOrMsg.toLowerCase();
  if (lower.includes('invalid_email_or_password') || lower.includes('invalid email or password')) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  if (lower.includes('password_too_short') || lower.includes('password is too short')) {
    return 'Mật khẩu phải có ít nhất 8 ký tự.';
  }
  if (lower.includes('user_already_exists') || lower.includes('user already exists')) {
    return 'Email này đã được sử dụng. Vui lòng chọn email khác.';
  }
  if (lower.includes('rate_limited') || lower.includes('too many requests')) {
    return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 1 phút.';
  }
  // ACC-08: mã xác nhận email
  if (lower.includes('email_not_verified') || lower.includes('email not verified')) {
    return 'Email chưa được xác nhận. Mã mới đã được gửi tới hộp thư của bạn.';
  }
  if (lower.includes('invalid_otp') || lower.includes('invalid otp')) {
    return 'Mã xác nhận không đúng. Kiểm tra lại 6 số trong email.';
  }
  if (lower.includes('otp_expired') || lower.includes('otp expired')) {
    return 'Mã đã hết hạn. Bấm "Gửi lại mã" để nhận mã mới.';
  }
  if (lower.includes('too_many_attempts') || lower.includes('too many attempts')) {
    return 'Nhập sai quá nhiều lần. Bấm "Gửi lại mã" để nhận mã mới.';
  }
  if (lower.includes('not_configured')) {
    return 'Tài khoản chưa được bật trên máy chủ.';
  }
  return codeOrMsg;
}
