/* =========================================================
   Resend e-mail integration for transactional e-mails
   (used by the password-reset OTP flow).

   The Resend API key and sender address are read ONLY from
   environment variables — never hardcoded. If no key is set
   the module starts in a safe "unconfigured" state and
   sendOtpEmail() returns a descriptive failure instead of
   throwing. The domain must be verified in Resend before
   real delivery works; we surface that error to the caller
   without pretending the e-mail was sent.
   ========================================================= */
import { Resend } from 'resend';

const API_KEY = process.env.RESEND_API_KEY || '';
const FROM_ADDR = process.env.EMAIL_FROM || process.env.RESEND_FROM || '';
const OTP_SENDER_NAME = process.env.EMAIL_FROM_NAME || 'حلاقي';

let _resend: Resend | null = null;

function getClient(): Resend | null {
  if (!API_KEY) return null;
  if (!_resend) _resend = new Resend(API_KEY);
  return _resend;
}

export function isEmailConfigured(): boolean {
  return Boolean(API_KEY && FROM_ADDR);
}

export type SendOtpResult = {
  ok: boolean;
  sent: boolean;
  id?: string;
  reason?: 'unconfigured' | 'unverified_domain' | 'error';
  detail?: string;
};

/** Send a password-reset OTP to the user's e-mail. */
export async function sendOtpEmail(to: string, otp: string): Promise<SendOtpResult> {
  if (!isEmailConfigured()) {
    return { ok: true, sent: false, reason: 'unconfigured' };
  }

  const client = getClient();
  if (!client) {
    return { ok: true, sent: false, reason: 'unconfigured' };
  }

  const subject = 'رمز التحقق لإعادة تعيين كلمة المرور — حلاقي';
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;max-width:480px;margin:0 auto;padding:24px;background:#141414;color:#fff;border-radius:16px;">',
    '<div style="text-align:center;font-size:32px;font-weight:900;color:#D4AF37;letter-spacing:2px;">حلاقي</div>',
    '<h2 style="color:#fff;margin:16px 0 4px;">رمز التحقق لإعادة تعيين كلمة المرور</h2>',
    '<p style="color:#999;font-size:14px;">استخدم الرمز التالي لإكمال إعادة تعيين كلمة مرورك. الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط.</p>',
    `<div style="display:inline-block;margin:16px 0;padding:16px 24px;background:#1A1A1A;border:1px solid #333;border-radius:12px;font-size:28px;font-weight:700;letter-spacing:8px;color:#D4AF37;direction:ltr;text-align:center;">${otp}</div>`,
    '<p style="color:#777;font-size:12px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.</p>',
    '</div>',
  ].join('');

  try {
    const { data, error } = await client.emails.send({
      from: `${OTP_SENDER_NAME} <${FROM_ADDR}>`,
      to,
      subject,
      html,
    });

    if (error) {
      const message = (error.message || '').toLowerCase();
      const isDomainIssue =
        message.includes('domain') ||
        message.includes('from') ||
        message.includes('verified') ||
        message.includes('sender') ||
        message.includes('invalid');

      return {
        ok: true,
        sent: false,
        reason: isDomainIssue ? 'unverified_domain' : 'error',
        detail: error.message,
      };
    }

    return { ok: true, sent: true, id: data?.id };
  } catch (err: any) {
    // We still return ok:true (a "generic" response for the client) but
    // mark that no e-mail was physically delivered so the flow is not
    // reported as a success when the provider is unreachable/unverified.
    return {
      ok: true,
      sent: false,
      reason: 'error',
      detail: err?.message || String(err),
    };
  }
}
