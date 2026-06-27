export const publicContactEmail = 'admin@galarentals.com.au';

export const publicContactMailto = `mailto:${publicContactEmail}`;

export const emailSenderConfig = {
  defaultName: 'Galarentals',
  notificationName: 'Galarentals Notifications',
  supportEmail: publicContactEmail,
} as const;

export const formatEmailSender = (name: string = emailSenderConfig.defaultName) =>
  `${name} <${emailSenderConfig.supportEmail}>`;
