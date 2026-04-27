export const AUSTRALIAN_MOBILE_REGEX = /^(?:\+61|0)4\d{8}$/;
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const AUSTRALIA_TIME_ZONE = 'Australia/Sydney';
export const MAX_APPLICATION_UPLOAD_BYTES = 7 * 1024 * 1024;
export const APPLICATION_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
export const APPLICATION_IMAGE_UPLOAD_FIELDS = 2;
export const APPLICATION_SUBMISSION_JSON_LIMIT_BYTES =
  Math.ceil(
    MAX_APPLICATION_UPLOAD_BYTES *
      APPLICATION_IMAGE_UPLOAD_FIELDS *
      (4 / 3)
  ) +
  1024 * 1024;

export const normalizeApplicationEmail = (value: string) => value.trim().toLowerCase();
export const normalizeAustralianMobile = (value: string) => {
  const compact = value.replace(/[\s()-]+/g, '').trim();

  if (compact.startsWith('+61')) {
    return `0${compact.slice(3)}`;
  }

  return compact;
};

export const isValidDateOnly = (value: string) => {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const getTodayInAustralia = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: AUSTRALIA_TIME_ZONE,
  }).format(new Date());

export const isFutureAustraliaDate = (
  value: string,
  today = getTodayInAustralia()
) => isValidDateOnly(value) && value > today;

export const isTodayOrFutureAustraliaDate = (
  value: string,
  today = getTodayInAustralia()
) => isValidDateOnly(value) && value >= today;
