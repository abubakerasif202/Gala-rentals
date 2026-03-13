import { escapeHtml } from './email.js';

const DEFAULT_APP_URL = 'http://localhost:5173';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export const getAppBaseUrl = () => {
  const configuredUrl = (process.env.APP_URL || process.env.FRONTEND_URL || '').trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL is required in production for secure payment links.');
  }

  return DEFAULT_APP_URL;
};

export const buildDriverPaymentLink = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: number;
  carId: number;
  token: string;
}) => {
  const checkoutUrl = new URL(`/checkout/${carId}`, getAppBaseUrl());
  checkoutUrl.searchParams.set('application_id', String(applicationId));
  checkoutUrl.searchParams.set('token', token);
  return checkoutUrl.toString();
};

export const sendDriverPaymentLinkEmail = async ({
  applicantEmail,
  applicantName,
  approvedBond,
  approvedWeeklyPrice,
  carName,
  checkoutUrl,
  setupFees,
  agreement,
}: {
  applicantEmail: string;
  applicantName: string;
  approvedBond: number;
  approvedWeeklyPrice: number;
  carName: string;
  checkoutUrl: string;
  setupFees: number;
  agreement?: string;
}) => {
  if (!process.env.RESEND_API_KEY) {
    return {
      delivered: false,
      reason: 'RESEND_API_KEY is not configured.',
    };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const upfrontDue = approvedBond + approvedWeeklyPrice + setupFees;
  const safeApplicantName = escapeHtml(applicantName);
  const safeCarName = escapeHtml(carName);
  const safeCheckoutUrl = escapeHtml(checkoutUrl);
  const safeAgreement = agreement ? escapeHtml(agreement) : null;

  await resend.emails.send({
    from: 'Maple Rentals <noreply@maplerentals.com.au>',
    to: applicantEmail,
    subject: 'Your Maple Rentals payment link is ready',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
        <h2 style="color: #D4AF37;">Application Approved</h2>
        <p>Hi ${safeApplicantName},</p>
        <p>Your application has been approved and your secure payment link is now ready.</p>
        <p><strong>Assigned vehicle:</strong> ${safeCarName}</p>
        <p><strong>Bond:</strong> ${formatCurrency(approvedBond)}</p>
        <p><strong>Weekly payment:</strong> ${formatCurrency(approvedWeeklyPrice)}</p>
        <p><strong>Setup fees:</strong> ${formatCurrency(setupFees)}</p>
        <p><strong>Total due now:</strong> ${formatCurrency(upfrontDue)}</p>
        <p>
          <a
            href="${safeCheckoutUrl}"
            style="display:inline-block;padding:14px 22px;background:#D4AF37;color:#111827;text-decoration:none;font-weight:700;border-radius:8px;"
          >
            Open secure payment link
          </a>
        </p>
        <p>This link is time-limited for security. If it expires, reply to this email and we will issue a fresh one.</p>
        ${
          safeAgreement
            ? `
        <h3 style="color: #0f172a;">Lease Agreement</h3>
        <pre style="white-space: pre-wrap;padding:10px;background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;">${safeAgreement}</pre>`
            : ''
        }
        <p>Best regards,<br /><strong>The Maple Rentals Team</strong></p>
      </div>
    `,
  });

  return {
    delivered: true,
    reason: null,
  };
};
