export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sanitizeEmailHeaderValue = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

let resendInstance: import('resend').Resend | null = null;

export const getResend = async () => {
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }

  return resendInstance;
};
