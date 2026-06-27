import {
  emailSenderConfig,
  formatEmailSender,
  publicContactEmail,
} from '../shared/contactConfig.js';

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sanitizeEmailHeaderValue = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

const readTrimmedEnv = (key: string) => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

export const getContactEmailConfig = ({
  senderName = emailSenderConfig.defaultName,
}: { senderName?: string } = {}) => ({
  from: sanitizeEmailHeaderValue(
    readTrimmedEnv('CONTACT_FROM_EMAIL') || formatEmailSender(senderName)
  ),
  to: sanitizeEmailHeaderValue(
    readTrimmedEnv('CONTACT_TO_EMAIL') ||
      readTrimmedEnv('ADMIN_EMAIL') ||
      publicContactEmail
  ),
});

let resendInstance: import('resend').Resend | null = null;

export const getResend = async () => {
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }

  return resendInstance;
};

export const sendResendEmail = async (
  resend: import('resend').Resend,
  payload: Parameters<import('resend').Resend['emails']['send']>[0]
) => {
  const result = await resend.emails.send(payload);

  if (result.error) {
    throw new Error(`Resend email delivery failed: ${result.error.message}`);
  }

  return result.data;
};
