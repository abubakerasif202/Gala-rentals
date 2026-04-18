import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import { classifyAdminSessionFailure } from './adminSession';

const createAxiosError = (status: number) =>
  new AxiosError('request failed', undefined, undefined, undefined, {
    config: {} as never,
    data: { error: 'Request failed' },
    headers: {},
    status,
    statusText: String(status),
  });

describe('classifyAdminSessionFailure', () => {
  it('maps 401 responses to unauthorized', () => {
    expect(classifyAdminSessionFailure(createAxiosError(401))).toBe('unauthorized');
  });

  it('maps 403 responses to forbidden', () => {
    expect(classifyAdminSessionFailure(createAxiosError(403))).toBe('forbidden');
  });

  it('maps non-auth failures to a generic error state', () => {
    expect(classifyAdminSessionFailure(createAxiosError(500))).toBe('error');
    expect(classifyAdminSessionFailure(new Error('boom'))).toBe('error');
  });
});
