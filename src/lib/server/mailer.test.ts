import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildOtpEmail, describeMailError, emailVerificationEnabled } from './mailer';

describe('ACC-08 · mailer', () => {
  it('chỉ bật xác nhận email khi có đủ SMTP_USER + SMTP_PASS (thiếu → đăng ký như cũ)', () => {
    expect(emailVerificationEnabled({})).toBe(false);
    expect(emailVerificationEnabled({ SMTP_USER: 'a@gmail.com' })).toBe(false);
    expect(emailVerificationEnabled({ SMTP_USER: 'a@gmail.com', SMTP_PASS: '   ' })).toBe(false);
    expect(emailVerificationEnabled({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' })).toBe(true);
  });

  it('thư xác nhận: tiêu đề có mã, nội dung tiếng Việt có hạn dùng, không chứa link', () => {
    const m = buildOtpEmail('u@example.com', '482913', 'email-verification', 10);
    expect(m.to).toBe('u@example.com');
    expect(m.subject).toBe('482913 là mã xác nhận đăng ký KPI Mini');
    expect(m.text).toContain('482913');
    expect(m.text).toContain('10 phút');
    expect(m.html).toContain('482913');
    expect(m.html).not.toMatch(/<a\s|https?:\/\//);
  });

  it('nhãn theo mục đích (đặt lại mật khẩu)', () => {
    expect(buildOtpEmail('u@example.com', '111222', 'forget-password', 10).subject).toContain('đặt lại mật khẩu');
  });

  it('lỗi SMTP → câu gợi ý tiếng Việt, không lộ chi tiết nhạy cảm', () => {
    expect(describeMailError({ code: 'EAUTH', responseCode: 535 })).toMatch(/Mật khẩu ứng dụng/);
    expect(describeMailError({ code: 'ECONNREFUSED' })).toMatch(/không kết nối được/);
    expect(describeMailError(new Error('x'))).toBe('Error');
    expect(describeMailError(null)).toBe('lỗi không xác định');
  });
});
