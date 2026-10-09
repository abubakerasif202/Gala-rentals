import express from 'express';
import request from 'supertest';
import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const processEvent = vi.hoisted(() => vi.fn());
vi.mock('../services/stripeWebhookService.js', () => ({ processStripeWebhookEvent: processEvent }));
import webhookRoutes from './webhooks.js';
const secret = 'whsec_gala_local_signature_fixture';
const stripe = new Stripe('sk_test_gala_local_signature_fixture');
const payload = JSON.stringify({ id: 'evt_gala_signature_fixture', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_gala_signature_fixture' } } });
const app = express();
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), webhookRoutes);
app.use(express.json());
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_gala_local_signature_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  processEvent.mockResolvedValue({ status: 200, body: 'ok' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('real Stripe SDK raw-body signature verification', () => {
  it('verifies original bytes and passes their exact hash to the event ledger', async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const response = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    expect(response.status).toBe(200);
    expect(processEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt_gala_signature_fixture' }), createHash('sha256').update(payload).digest('hex'));
  });
  it('rejects tampered bytes and an incorrect signing secret before processing', async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload + ' ');
    expect(tampered.status).toBe(400);
    const wrong = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_wrong_fixture' })).send(payload);
    expect(wrong.status).toBe(400);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it('returns a retryable failure when verified event persistence fails', async () => {
    processEvent.mockRejectedValueOnce(new Error('local persistence fixture failure'));
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const failed = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    expect(failed.status).toBe(500);
    const retried = await request(app).post('/api/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    expect(retried.status).toBe(200);
  });
});
