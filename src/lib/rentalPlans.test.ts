import { describe, expect, it } from 'vitest';

import { buildRentalPlanWithPricing, getRentalPlanById } from './rentalPlans.js';

const feeSettings = {
  account_management_weekly: 12.5,
  new_account_setup: 20,
  direct_debit_account_setup: 5,
};

describe('buildRentalPlanWithPricing', () => {
  it('keeps weekly pricing math aligned to weekly rent', () => {
    const weeklyPlan = getRentalPlanById('weekly');
    expect(weeklyPlan).toBeDefined();

    const plan = buildRentalPlanWithPricing(weeklyPlan!, feeSettings);

    expect(plan.pricing.comparisonWeeklyAud).toBe(450);
    expect(plan.pricing.bondAud).toBe(900);
    expect(plan.pricing.initialRentalAud).toBe(450);
    expect(plan.pricing.serviceFeeAud).toBe(12.5);
    expect(plan.pricing.upfrontDueAud).toBe(1375);
  });

  it('calculates fortnightly and monthly quotes from weekly equivalents instead of full interval totals', () => {
    const fortnightlyPlan = getRentalPlanById('fortnightly');
    const monthlyPlan = getRentalPlanById('monthly');

    expect(fortnightlyPlan).toBeDefined();
    expect(monthlyPlan).toBeDefined();

    const fortnightlyPricing = buildRentalPlanWithPricing(fortnightlyPlan!, feeSettings).pricing;
    const monthlyPricing = buildRentalPlanWithPricing(monthlyPlan!, feeSettings).pricing;

    expect(fortnightlyPricing.comparisonWeeklyAud).toBe(400);
    expect(fortnightlyPricing.bondAud).toBe(800);
    expect(fortnightlyPricing.initialRentalAud).toBe(400);
    expect(fortnightlyPricing.recurringDueAud).toBe(800);
    expect(fortnightlyPricing.serviceFeeAud).toBe(25);
    expect(fortnightlyPricing.upfrontDueAud).toBe(1225);

    expect(monthlyPricing.comparisonWeeklyAud).toBe(375);
    expect(monthlyPricing.bondAud).toBe(750);
    expect(monthlyPricing.initialRentalAud).toBe(375);
    expect(monthlyPricing.recurringDueAud).toBe(1500);
    expect(monthlyPricing.serviceFeeAud).toBe(50);
    expect(monthlyPricing.upfrontDueAud).toBe(1150);
  });
});
