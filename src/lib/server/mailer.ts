// Owner: data-engineer (Huy) — ACC-08 (techlead làm, 2026-11-06): gửi mã xác nhận đăng ký qua Gmail SMTP.
// Bật khi có SMTP_USER + SMTP_PASS (Gmail: "Mật khẩu ứng dụng" 16 ký tự, KHÔNG phải mật khẩu Gmail).
// Thiếu → xác nhận email tắt, đăng ký như cũ (local-first, docs/14 §1.2). Không log mã, mật khẩu.
import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

export type OtpPurpose = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Có đủ cấu hình SMTP để bật xác nhận email */
export function emailVerificationEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return Boolean(env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());
}

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  'email-verification': 'xác nhận đăng ký',
  'sign-in': 'đăng nhập',
  'forget-password': 'đặt lại mật khẩu',
  'change-email': 'đổi email',
};

/** Nội dung thư (pure, để test). Mã hiện to + có hạn dùng; không chứa link để tránh bị coi là phishing. */
export function buildOtpEmail(to: string, otp: string, purpose: OtpPurpose, minutes: number): MailMessage {
  const label = PURPOSE_LABEL[purpose];
  const subject = `${otp} là mã ${label} KPI Mini`;
  const text = [
    `Xin chào,`,
    ``,
    `Mã ${label} tài khoản KPI Mini của bạn là: ${otp}`,
    `Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với ai.`,
    ``,
    `Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    `— KPI Mini Dashboard`,
  ].join('\n');
  const html = `<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#111;max-width:480px;margin:auto;padding:24px">
<p>Xin chào,</p>
<p>Mã ${label} tài khoản <b>KPI Mini</b> của bạn là:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${otp}</p>
<p>Mã có hiệu lực trong <b>${minutes} phút</b>. Không chia sẻ mã này với ai.</p>
<p style="color:#666;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
</body></html>`;
  return { to, subject, text, html };
}

let transporter: Transporter | null = null;

/** Thay transport khi test (không gửi thật). Truyền null để quay về SMTP. */
export function setMailTransportForTest(t: Pick<Transporter, 'sendMail'> | null): void {
  transporter = t as Transporter | null;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = SSL; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s+/g, '') },
  });
  return transporter;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const user = process.env.SMTP_USER?.trim() ?? '';
  const from = process.env.EMAIL_FROM?.trim() || `KPI Mini <${user}>`;
  await getTransporter().sendMail({ from, ...msg });
}

/** Lỗi SMTP → câu ngắn tiếng Việt có gợi ý sửa (dùng cho log; không chứa mã/mật khẩu) */
export function describeMailError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number } | null;
  const code = e?.code ?? '';
  if (code === 'EAUTH' || e?.responseCode === 535)
    return 'EAUTH — Gmail từ chối đăng nhập: kiểm tra SMTP_USER và SMTP_PASS (phải là Mật khẩu ứng dụng 16 ký tự, tài khoản bật Xác minh 2 bước)';
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION')
    return `${code} — không kết nối được máy chủ SMTP (kiểm tra SMTP_HOST/SMTP_PORT)`;
  if (code === 'EENVELOPE') return 'EENVELOPE — địa chỉ người nhận/người gửi không hợp lệ';
  return code || (err instanceof Error ? err.name : 'lỗi không xác định');
}
