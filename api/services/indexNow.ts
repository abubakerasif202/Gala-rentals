import axios from 'axios';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_INDEXNOW_KEY = 'f7e10bffeed6463d9a7ba45aec9f82b6';
const INDEXNOW_TIMEOUT_MS = Number(process.env.INDEXNOW_TIMEOUT_MS || 7000);
const INDEXNOW_DEBOUNCE_MS = Number(process.env.INDEXNOW_DEBOUNCE_MS || 2000);
const MAX_URLS_PER_BATCH = 10_000;

const parseBoolean = (value?: string) => value?.toLowerCase() === 'true';

const normalizeBaseUrl = (value?: string) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const siteUrl = normalizeBaseUrl(process.env.SITE_URL || process.env.APP_URL);
const indexNowEnabled = parseBoolean(process.env.INDEXNOW_ENABLED);
const indexNowKey = (process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY).trim();
const keyLocation = siteUrl ? `${siteUrl.origin}/${indexNowKey}.txt` : null;

type SubmitResult = {
  enabled: boolean;
  acceptedCount: number;
  rejectedCount: number;
  skippedReason?: string;
  status?: number;
};

const isAllowedHostUrl = (candidate: string): boolean => {
  if (!siteUrl) {
    return false;
  }

  try {
    const parsed = new URL(candidate);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return isHttp && parsed.host === siteUrl.host;
  } catch {
    return false;
  }
};

const sanitizeUrls = (urls: string[]): { accepted: string[]; rejectedCount: number } => {
  const unique = new Set(urls.map((url) => url.trim()).filter(Boolean));
  const accepted: string[] = [];
  let rejectedCount = 0;

  for (const url of unique) {
    if (!isAllowedHostUrl(url)) {
      rejectedCount += 1;
      continue;
    }
    accepted.push(url);
  }

  return { accepted, rejectedCount };
};

const postJson = async (payload: Record<string, unknown>) => {
  if (typeof fetch === 'function') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INDEXNOW_TIMEOUT_MS);

    try {
      return await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return axios.post(INDEXNOW_ENDPOINT, payload, {
    headers: { 'content-type': 'application/json' },
    timeout: INDEXNOW_TIMEOUT_MS,
    validateStatus: () => true,
  });
};

const submitUrls = async (urls: string[]): Promise<SubmitResult> => {
  if (!indexNowEnabled) {
    return { enabled: false, acceptedCount: 0, rejectedCount: 0, skippedReason: 'INDEXNOW_ENABLED is not true' };
  }

  if (!siteUrl || !keyLocation) {
    console.warn('[IndexNow] Skipping submission: SITE_URL (or APP_URL) is missing or invalid.');
    return { enabled: true, acceptedCount: 0, rejectedCount: urls.length, skippedReason: 'Invalid SITE_URL' };
  }

  if (!indexNowKey) {
    console.warn('[IndexNow] Skipping submission: INDEXNOW_KEY is empty.');
    return { enabled: true, acceptedCount: 0, rejectedCount: urls.length, skippedReason: 'Missing INDEXNOW_KEY' };
  }

  const { accepted, rejectedCount } = sanitizeUrls(urls);

  if (accepted.length === 0) {
    return { enabled: true, acceptedCount: 0, rejectedCount, skippedReason: 'No valid same-host URLs to submit' };
  }

  const payload = {
    host: siteUrl.host,
    key: indexNowKey,
    keyLocation,
    urlList: accepted.slice(0, MAX_URLS_PER_BATCH),
  };

  try {
    const response = await postJson(payload);
    const status = 'status' in response ? response.status : 200;

    if (status >= 200 && status < 300) {
      console.info(`[IndexNow] Submitted ${payload.urlList.length} URL(s) successfully.`);
    } else {
      console.warn(`[IndexNow] Submission returned status ${status}.`);
    }

    return {
      enabled: true,
      acceptedCount: payload.urlList.length,
      rejectedCount,
      status,
    };
  } catch (error) {
    console.error('[IndexNow] Submission failed:', error);
    return {
      enabled: true,
      acceptedCount: accepted.length,
      rejectedCount,
      skippedReason: 'Network/request failure',
    };
  }
};

const pendingUrls = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;

const flushQueue = async () => {
  flushTimer = null;

  if (pendingUrls.size === 0) {
    return;
  }

  const urls = Array.from(pendingUrls);
  pendingUrls.clear();
  await submitUrls(urls);
};

export const enqueueIndexNowUrls = (urls: string[]) => {
  for (const url of urls) {
    pendingUrls.add(url);
  }

  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    void flushQueue();
  }, INDEXNOW_DEBOUNCE_MS);
};

export const enqueueIndexNowUrl = (url: string) => {
  enqueueIndexNowUrls([url]);
};

export const submitIndexNowUrl = async (url: string) => {
  return submitUrls([url]);
};

export const submitIndexNowUrls = async (urls: string[]) => {
  return submitUrls(urls);
};

export const indexNowConfig = {
  enabled: indexNowEnabled,
  key: indexNowKey,
  keyLocation,
  siteHost: siteUrl?.host || null,
};
