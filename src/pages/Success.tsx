import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Home, Loader2 } from 'lucide-react';
import { fetchCheckoutSessionStatus } from '../lib/api';
import { clearPendingApplicationCheckout } from '../lib/checkoutStorage';

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const applicationId = Number(searchParams.get('application_id') || 0);
  const checkoutToken = searchParams.get('checkout_token') || searchParams.get('token') || '';
  const carId = Number(searchParams.get('car_id') || 0);
  const hasVerificationContext = Boolean(sessionId && applicationId && checkoutToken);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stripe-checkout-session', sessionId],
    queryFn: () =>
      fetchCheckoutSessionStatus(sessionId, {
        application_id: applicationId,
        car_id: carId || undefined,
        checkout_token: checkoutToken,
      }),
    enabled: hasVerificationContext,
    retry: false,
  });

  const isSuccess = data?.status === 'complete' && data?.payment_status === 'paid';
  const checkoutKind =
    data?.checkout_kind || (carId ? 'vehicle' : 'application');
  const retryHref =
    checkoutKind === 'vehicle' && carId
      ? `/checkout/${carId}?application_id=${applicationId}&token=${encodeURIComponent(
          checkoutToken
        )}`
      : hasVerificationContext
        ? `/apply?application_id=${applicationId}&checkout_token=${encodeURIComponent(
            checkoutToken
          )}`
        : '/apply';

  useEffect(() => {
    if (isSuccess) {
      clearPendingApplicationCheckout();
    }
  }, [isSuccess]);

  return (
    <div className="min-h-screen bg-brand-charcoal flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-gold selection:text-brand-charcoal">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-charcoal border border-white/5 py-12 px-6 shadow-2xl rounded-2xl text-center">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-12 w-12 text-brand-gold animate-spin" />
            </div>
          )}

          {!isLoading && isSuccess && (
            <>
              <CheckCircle className="mx-auto h-20 w-20 text-brand-gold mb-8" />
              <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
                Payment Successful
              </h2>
              <p className="text-brand-grey font-light leading-relaxed mb-10">
                {checkoutKind === 'vehicle'
                  ? 'Your vehicle payment has been confirmed. The rental is being activated and the team will contact you with collection details.'
                  : 'Your application payment has been confirmed. The team will review your documents and contact you with the next steps.'}
              </p>
              <Link
                to="/"
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                <Home className="mr-2 h-5 w-5" /> Return Home
              </Link>
            </>
          )}

          {!isLoading && !isSuccess && (
            <>
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-900/20 mb-8 border border-red-500/30">
                <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
                Payment Issue
              </h2>
              <p className="text-brand-grey font-light leading-relaxed mb-10">
                {isError || !hasVerificationContext
                  ? 'We could not verify the Stripe session from this link. Retry from the secure checkout link or contact support if the amount has already been deducted.'
                  : 'Stripe did not report a completed paid session. Retry from the original secure link or contact support.'}
              </p>
              <Link
                to={retryHref}
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                {checkoutKind === 'vehicle' ? 'Return to Vehicle Checkout' : 'Return to Application'}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
