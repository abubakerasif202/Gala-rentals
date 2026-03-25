import { useEffect } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Home, Loader2 } from 'lucide-react';
import Seo from '../components/Seo';
import { fetchCheckoutSessionStatus } from '../lib/api';
import {
  parseHashCheckoutToken,
  scrubCheckoutTokenFromUrl,
} from '../lib/checkoutTokenUrl';
import { isUuid } from '../../shared/uuid';

export default function Success() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const applicationIdParam = searchParams.get('application_id') || '';
  const applicationId = isUuid(applicationIdParam) ? applicationIdParam : '';
  const checkoutToken =
    searchParams.get('checkout_token') ||
    searchParams.get('token') ||
    parseHashCheckoutToken(window.location.hash) ||
    '';
  const carId = Number(searchParams.get('car_id') || 0);
  const hasVerificationContext = Boolean(sessionId && applicationId && checkoutToken && carId);

  useEffect(() => {
    if (searchParams.get('checkout_token')) {
      return;
    }

    const hashToken = parseHashCheckoutToken(window.location.hash);
    if (!hashToken) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('checkout_token', hashToken);
    nextParams.delete('token');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!checkoutToken) {
      return;
    }

    const scrubbedUrl = scrubCheckoutTokenFromUrl(new URL(window.location.href));
    window.history.replaceState(window.history.state, '', scrubbedUrl.toString());
  }, [checkoutToken]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stripe-checkout-session', sessionId, applicationId, carId, checkoutToken],
    queryFn: () =>
      fetchCheckoutSessionStatus(sessionId, {
        application_id: applicationId,
        car_id: carId,
        checkout_token: checkoutToken,
      }),
    enabled: hasVerificationContext,
    retry: (failureCount, error) =>
      failureCount < 2 &&
      (!axios.isAxiosError(error) ||
        !error.response ||
        error.response.status >= 500),
    retryDelay: (attempt) => attempt * 1500,
    refetchInterval: (query) =>
      query.state.data &&
      ['pending', 'manual_review'].includes(query.state.data.internal_status)
        ? 3000
        : false,
    refetchOnWindowFocus: true,
  });

  const isFullySuccessful = data?.internal_status === 'complete';
  const requiresActivationReview = data?.internal_status === 'manual_review';
  const isAwaitingFinalization =
    data?.status === 'complete' &&
    data?.payment_status === 'paid' &&
    data?.internal_status === 'pending';
  const retryHref =
    hasVerificationContext
      ? `/checkout/${carId}?application_id=${applicationId}&checkout_token=${encodeURIComponent(checkoutToken)}`
      : '/apply';

  return (
    <div className="min-h-screen bg-brand-charcoal flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-gold selection:text-brand-charcoal">
      <Seo
        title="Payment Status | Maple Rentals"
        description="Secure payment status page for Maple Rentals checkout sessions."
        canonicalPath="/success"
        robots="noindex,nofollow"
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-charcoal border border-white/5 py-12 px-6 shadow-2xl rounded-2xl text-center">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-12 w-12 text-brand-gold animate-spin" />
            </div>
          )}

          {!isLoading && isFullySuccessful && (
            <>
              <CheckCircle className="mx-auto h-20 w-20 text-brand-gold mb-8" />
              <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
                Payment Successful
              </h2>
              <p className="text-brand-grey font-light leading-relaxed mb-10">
                Your payment has been confirmed and the rental is now active. Weekly payments will now be charged automatically through Stripe, and the team will contact you with collection details.
              </p>
              <Link
                to="/"
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                <Home className="mr-2 h-5 w-5" /> Return Home
              </Link>
            </>
          )}

          {!isLoading && isAwaitingFinalization && (
            <>
              <div className="flex justify-center py-6">
                <Loader2 className="h-12 w-12 text-brand-gold animate-spin" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
                Payment Received
              </h2>
              <p className="text-brand-grey font-light leading-relaxed mb-10">
                Stripe has confirmed your payment. We are finalizing the rental activation now and
                this page refreshes automatically while that completes.
              </p>
              <Link
                to="/"
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                <Home className="mr-2 h-5 w-5" /> Return Home
              </Link>
            </>
          )}

          {!isLoading && requiresActivationReview && (
            <>
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-500/10 mb-8 border border-amber-500/30">
                <svg className="h-10 w-10 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
              </div>
              <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
                Activation Pending
              </h2>
              <p className="text-brand-grey font-light leading-relaxed mb-10">
                Stripe has already confirmed your payment. We are waiting for the rental
                activation checks to clear, and this page will keep checking automatically while
                that finishes. Maple Rentals will contact you if any manual action is still needed.
              </p>
              <Link
                to="/"
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                <Home className="mr-2 h-5 w-5" /> Return Home
              </Link>
            </>
          )}

          {!isLoading && !isFullySuccessful && !isAwaitingFinalization && !requiresActivationReview && (
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
                  ? 'We could not verify this secure checkout session. Request a fresh checkout link if the amount has not been charged.'
                  : 'Stripe did not report a completed paid session for this checkout link. Retry from the original secure link or contact support.'}
              </p>
              <Link
                to={retryHref}
                className="w-full flex justify-center items-center py-4 px-4 bg-brand-gold text-brand-charcoal font-bold text-sm uppercase tracking-widest hover:bg-white transition-colors shadow-[0_0_20px_rgba(198,169,79,0.1)]"
              >
                Return to Secure Payment
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
