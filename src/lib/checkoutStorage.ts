export const PENDING_APPLICATION_CHECKOUT_KEY = 'maple-rental.pending-application-checkout';

export interface PendingApplicationCheckout {
  applicationId: number;
  checkoutToken: string;
  checkoutTokenExpiresAt: string;
  selectedPlanId: string;
}

export const loadPendingApplicationCheckout = (): PendingApplicationCheckout | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(PENDING_APPLICATION_CHECKOUT_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingApplicationCheckout;
  } catch {
    window.sessionStorage.removeItem(PENDING_APPLICATION_CHECKOUT_KEY);
    return null;
  }
};

export const persistPendingApplicationCheckout = (
  value: PendingApplicationCheckout | null
) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!value) {
    window.sessionStorage.removeItem(PENDING_APPLICATION_CHECKOUT_KEY);
    return;
  }

  window.sessionStorage.setItem(
    PENDING_APPLICATION_CHECKOUT_KEY,
    JSON.stringify(value)
  );
};

export const clearPendingApplicationCheckout = () => {
  persistPendingApplicationCheckout(null);
};
