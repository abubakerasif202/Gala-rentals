export type RentalPlanInterval = 'week' | 'month';

import {
  calculateBondFromWeeklyRent,
  calculateUpfrontDueFromWeeklyRent,
} from '../../shared/rentalPricing.js';

export interface RentalPlan {
  id: string;
  name: string;
  description: string;
  priceAud: number;
  cadence: string;
  highlight?: string;
  popular?: boolean;
  features: string[];
  billingInterval: RentalPlanInterval;
  billingIntervalCount: number;
  bondAud: number;
}

export interface RentalFeeSettings {
  account_management_weekly: number;
  new_account_setup: number;
  direct_debit_account_setup: number;
}

export interface RentalPlanPricing {
  currency: 'AUD';
  bondAud: number;
  comparisonWeeklyAud: number;
  initialRentalAud: number;
  setupFeesAud: number;
  serviceFeeAud: number;
  upfrontDueAud: number;
  recurringDueAud: number;
  recurringLabel: string;
  recurringInterval: RentalPlanInterval;
  recurringIntervalCount: number;
}

export interface RentalPlanWithPricing extends RentalPlan {
  pricing: RentalPlanPricing;
}

export interface PublicRentalPlan {
  id: string;
  name: string;
  description: string;
  highlight?: string;
  popular?: boolean;
  features: string[];
  cadenceLabel: string;
}

const MONTHLY_PLAN_COMPARISON_WEEKS = 4;

const getPlanBillingCycleWeeks = (
  plan: Pick<RentalPlan, 'billingInterval' | 'billingIntervalCount'>
) => {
  if (plan.billingInterval === 'month') {
    return plan.billingIntervalCount * MONTHLY_PLAN_COMPARISON_WEEKS;
  }

  return plan.billingIntervalCount;
};

export const getRentalPlanWeeklyEquivalentAud = (
  plan: Pick<RentalPlan, 'priceAud' | 'billingInterval' | 'billingIntervalCount'>
) =>
  Number(
    (
      plan.priceAud / getPlanBillingCycleWeeks(plan)
    ).toFixed(2)
  );

export const rentalPlans: RentalPlan[] = [
  {
    id: 'weekly',
    name: 'Weekly Rental',
    description: 'Fastest path to getting on the road with a low-commitment weekly cadence.',
    priceAud: 450,
    cadence: 'per week',
    highlight: 'Best for trial runs',
    billingInterval: 'week',
    billingIntervalCount: 1,
    bondAud: calculateBondFromWeeklyRent(
      getRentalPlanWeeklyEquivalentAud({
        priceAud: 450,
        billingInterval: 'week',
        billingIntervalCount: 1,
      })
    ),
    features: [
      'Toyota Camry Hybrid',
      'Full insurance coverage',
      '24/7 roadside assistance',
      'Weekly vehicle inspection',
    ],
  },
  {
    id: 'fortnightly',
    name: 'Fortnightly Rental',
    description: 'Balanced pricing for active drivers who want stronger weekly economics.',
    priceAud: 800,
    cadence: 'per fortnight',
    highlight: 'Most popular',
    popular: true,
    billingInterval: 'week',
    billingIntervalCount: 2,
    bondAud: calculateBondFromWeeklyRent(
      getRentalPlanWeeklyEquivalentAud({
        priceAud: 800,
        billingInterval: 'week',
        billingIntervalCount: 2,
      })
    ),
    features: [
      'Toyota Camry Hybrid',
      'Full insurance coverage',
      '24/7 roadside assistance',
      'Bi-weekly vehicle inspection',
      'Priority support',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly Rental',
    description: 'Lowest blended rate for committed drivers who want predictable fleet access.',
    priceAud: 1500,
    cadence: 'per month',
    highlight: 'Best value',
    billingInterval: 'month',
    billingIntervalCount: 1,
    bondAud: calculateBondFromWeeklyRent(
      getRentalPlanWeeklyEquivalentAud({
        priceAud: 1500,
        billingInterval: 'month',
        billingIntervalCount: 1,
      })
    ),
    features: [
      'Toyota Camry Hybrid',
      'Full insurance coverage',
      '24/7 roadside assistance',
      'Monthly vehicle inspection',
      'Priority support',
      'Free vehicle swap',
    ],
  },
];

export function getRentalPlanById(id?: string | null): RentalPlan | undefined {
  if (!id) return undefined;
  return rentalPlans.find((plan) => plan.id === id);
}

export function buildRentalPlanWithPricing(
  plan: RentalPlan,
  fees: RentalFeeSettings
): RentalPlanWithPricing {
  const comparisonWeeklyAud = getRentalPlanWeeklyEquivalentAud(plan);
  const setupFeesAud = Number(
    (fees.new_account_setup + fees.direct_debit_account_setup).toFixed(2)
  );
  const serviceFeeAud = Number(
    (
      fees.account_management_weekly * getPlanBillingCycleWeeks(plan)
    ).toFixed(2)
  );
  const bondAud = calculateBondFromWeeklyRent(comparisonWeeklyAud);
  const initialRentalAud = comparisonWeeklyAud;
  const upfrontDueAud = Number(
    (
      calculateUpfrontDueFromWeeklyRent(comparisonWeeklyAud) + setupFeesAud
    ).toFixed(2)
  );
  const recurringDueAud = Number(plan.priceAud.toFixed(2));

  return {
    ...plan,
    bondAud,
    pricing: {
      currency: 'AUD',
      bondAud,
      comparisonWeeklyAud,
      initialRentalAud,
      setupFeesAud,
      serviceFeeAud,
      upfrontDueAud,
      recurringDueAud,
      recurringLabel: plan.cadence,
      recurringInterval: plan.billingInterval,
      recurringIntervalCount: plan.billingIntervalCount,
    },
  };
}

export function buildPublicRentalPlan(plan: RentalPlan): PublicRentalPlan {
  const cadenceLabel =
    plan.billingInterval === 'month'
      ? plan.billingIntervalCount === 1
        ? 'Monthly billing'
        : `Every ${plan.billingIntervalCount} months`
      : plan.billingIntervalCount === 1
        ? 'Weekly billing'
        : `Every ${plan.billingIntervalCount} weeks`;

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    highlight: plan.highlight,
    popular: plan.popular,
    features: plan.features,
    cadenceLabel,
  };
}
