import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readApiFile = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('public write route rate limits', () => {
  it('limits public application submissions to 5 per IP per hour', () => {
    const source = readApiFile('api/routes/applications.ts');

    expect(source).toContain('const applicationSubmissionLimiter = rateLimit');
    expect(source).toContain('windowMs: 60 * 60 * 1000');
    expect(source).toContain('max: 5');
    expect(source).toContain('router.post(\n  "/",\n  applicationSubmissionLimiter');
  });

  it('limits public contact inquiries to 5 per IP per hour', () => {
    const source = readApiFile('api/routes/inquiries.ts');

    expect(source).toContain('const inquirySubmissionLimiter = rateLimit');
    expect(source).toContain('windowMs: 60 * 60 * 1000');
    expect(source).toContain('max: 5');
    expect(source).toContain("router.post('/', inquirySubmissionLimiter");
  });

  it('limits admin login attempts to 10 per IP and email per 15 minutes', () => {
    const source = readApiFile('api/routes/auth.ts');

    expect(source).toContain('const loginRateLimiter = rateLimit');
    expect(source).toContain('windowMs: 15 * 60 * 1000');
    expect(source).toContain('max: 10');
    expect(source).toContain("router.post('/login', loginRateLimiter");
  });

  it('does not attach a route-specific limiter to Stripe webhooks', () => {
    const source = readApiFile('api/routes/webhooks.ts');

    expect(source).toContain("router.post('/', async");
    expect(source).not.toContain('rateLimit(');
  });
});
