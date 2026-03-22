import { describe, expect, it } from 'vitest';
import { getTodayInAustralia } from './applicationSubmission.js';
import { inquirySchema } from './inquiry.js';

const addDaysToDateOnly = (dateOnly: string, days: number) => {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

describe('inquirySchema', () => {
  it('normalizes email and phone while accepting valid dates', () => {
    const startDate = addDaysToDateOnly(getTodayInAustralia(), 7);
    const endDate = addDaysToDateOnly(startDate, 7);

    const parsed = inquirySchema.parse({
      name: 'Jordan Prospect',
      email: ' Jordan.Prospect@Example.com ',
      phone: '0400 000 111',
      startDate,
      endDate,
      message: 'Interested in a Camry Hybrid.',
    });

    expect(parsed.email).toBe('jordan.prospect@example.com');
    expect(parsed.phone).toBe('0400000111');
  });

  it('rejects end dates earlier than the start date', () => {
    const endDate = addDaysToDateOnly(getTodayInAustralia(), 7);
    const startDate = addDaysToDateOnly(endDate, 7);

    const result = inquirySchema.safeParse({
      name: 'Jordan Prospect',
      email: 'jordan.prospect@example.com',
      phone: '0400000111',
      startDate,
      endDate,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['endDate']);
    }
  });
});
