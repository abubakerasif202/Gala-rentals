import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerlessApp } from './index.js';

afterEach(() => vi.unstubAllEnvs());
describe('serverless preview safety', () => {
  it('serves liveness without credentials or a persistent listener', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const response = await request(createServerlessApp()).get('/api/live');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
  });
  it('blocks both financial writes and private reads in an unconfigured preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('GALA_PREVIEW_WRITES_ENABLED', 'false');
    const app = createServerlessApp();
    const webhook = await request(app).post('/api/stripe/webhook').send({ type: 'checkout.session.completed' });
    expect(webhook.status).toBe(503);
    const applications = await request(app).get('/api/applications');
    expect(applications.status).toBe(503);
  });
  it('rejects live Stripe even when someone enables preview writes', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('GALA_PREVIEW_WRITES_ENABLED', 'true');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_invalid_unit_test');
    const response = await request(createServerlessApp()).post('/api/stripe/webhook').send('{}');
    expect(response.status).toBe(503);
  });
});
