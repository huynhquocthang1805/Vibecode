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
  if (lower.includes('not_configured')) {
    return 'Tài khoản chưa được bật trên máy chủ.';
  }
  return codeOrMsg;
}
