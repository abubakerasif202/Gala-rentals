import { describe, expect, it } from 'vitest';
import { inquirySchema } from './inquiry.js';

describe('inquirySchema', () => {
  it('normalizes email and phone while accepting valid dates', () => {
    const parsed = inquirySchema.parse({
      name: 'Jordan Prospect',
      email: ' Jordan.Prospect@Example.com ',
      phone: '0400 000 111',
      startDate: '2026-03-20',
      endDate: '2026-03-27',
      message: 'Interested in a Camry Hybrid.',
    });

    expect(parsed.email).toBe('jordan.prospect@example.com');
    expect(parsed.phone).toBe('0400000111');
  });

  it('rejects end dates earlier than the start date', () => {
    const result = inquirySchema.safeParse({
      name: 'Jordan Prospect',
      email: 'jordan.prospect@example.com',
      phone: '0400000111',
      startDate: '2026-03-27',
      endDate: '2026-03-20',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['endDate']);
    }
  });
});
