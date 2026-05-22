import { Suspense, lazy, startTransition, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const InquiryForm = lazy(() => import('./InquiryForm'));

const inquiryFallback = (
  <div className="bg-brand-navy-light p-8 md:p-12 border border-white/10 shadow-2xl">
    <div className="flex items-center gap-3 text-sm font-light text-brand-grey">
      <Loader2 className="w-4 h-4 animate-spin text-brand-gold" />
      Preparing quote form...
    </div>
  </div>
);

export default function DeferredInquiryForm() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        startTransition(() => setShouldLoad(true));
        observer.disconnect();
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={hostRef}>
      {shouldLoad ? <Suspense fallback={inquiryFallback}><InquiryForm /></Suspense> : inquiryFallback}
    </div>
  );
}
