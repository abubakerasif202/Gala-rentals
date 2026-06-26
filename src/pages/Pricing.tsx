import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck, Star, AlertCircle, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import Seo from '../components/Seo';
import { fetchRentalPlans } from '../lib/api';
import { featuredRentalImages } from '../lib/genericRentalImages';

export default function Pricing() {
  const shouldReduceMotion = useReducedMotion();
  const {
    data: rentalPlans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['rental-plans'],
    queryFn: fetchRentalPlans,
  });

  return (
    <div className="min-h-screen bg-[#e9edf2] text-brand-navy selection:bg-brand-gold selection:text-black">
      <Seo
        title="Pricing | Galarentals"
        description="Compare Galarentals weekly plans, bond requirements, and subscription structure before you apply."
        canonicalPath="/pricing"
        keywords={[
          'subscription rental plans sydney',
          'weekly rental application sydney',
          'secure rental checkout sydney',
          'merrylands rental plans',
          'parramatta rental plans',
        ]}
      />

      <section className="bg-[#fbf9f4] px-4 py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
              className="mb-4 text-[10px] font-bold uppercase tracking-[0.34em] text-brand-gold-dark"
            >
              Flexible Plans
            </motion.p>
            <motion.h1
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
              className="mb-6 max-w-3xl font-serif text-4xl font-bold tracking-tight text-brand-navy md:text-6xl"
            >
              Sydney rental plans built around approved applications.
            </motion.h1>
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
              className="max-w-2xl text-lg leading-8 text-slate-600"
            >
              Compare each plan&apos;s billing cadence, support level, and included services before
              you apply. Galarentals confirms the approved rental details, weekly amount, and payment
              step only after review.
            </motion.p>
          </div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.55 }}
            className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-2 ambient-shadow"
          >
            <img
              src={featuredRentalImages[4]}
              alt="Secure rental approval process"
              className="aspect-[16/10] w-full rounded-[1.5rem] object-cover"
            />
            <div className="grid gap-2 p-3 sm:grid-cols-3">
              {['Review first', 'Stripe secure', 'Weekly plans'].map((item) => (
                <div key={item} className="rounded-2xl border border-stone-200 bg-[#fbf9f4] px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-brand-navy">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="max-w-6xl mx-auto">
          {isLoading && (
            <div className="ambient-shadow rounded-3xl border border-stone-200 bg-[#fbf9f4] px-6 py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-gold mx-auto mb-4" />
              <p className="text-sm uppercase tracking-[0.2em] font-bold text-slate-500">
                Loading plan options
              </p>
            </div>
          )}

          {isError && (
            <div className="ambient-shadow rounded-3xl border border-red-200 bg-[#fbf9f4] px-6 py-16 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <p className="text-sm uppercase tracking-[0.2em] font-bold text-red-500 mb-3">
                Plans unavailable
              </p>
              <p className="text-slate-600 mb-6">
                We could not load the current rental plan summaries. Try again shortly or continue
                with the standard application flow.
              </p>
              <Link
                to="/apply"
                className="focus-ring-light inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-brand-navy-light"
              >
                Start Application <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {!isLoading && !isError && rentalPlans.length === 0 && (
            <div className="ambient-shadow rounded-3xl border border-stone-200 bg-[#fbf9f4] px-6 py-16 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Plans are being prepared
              </p>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Continue with the application and Galarentals will confirm current approved
                pricing during review.
              </p>
              <Link
                to="/apply"
                className="focus-ring-light mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-navy-light"
              >
                Start Application <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {!isLoading && !isError && rentalPlans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {rentalPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.45, delay: shouldReduceMotion ? 0 : index * 0.08 }}
                  className={`relative flex flex-col overflow-hidden rounded-[2rem] border ${plan.popular ? 'border-brand-gold/50 bg-brand-navy text-white shadow-[0_25px_70px_rgba(0,35,71,0.22)]' : 'ambient-shadow border-stone-200 bg-[#fbf9f4] text-brand-navy'}`}
                >
                  {plan.popular && (
                    <div className="absolute top-5 right-5 flex items-center gap-1 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-navy">
                      <Star className="w-3 h-3 fill-current" />
                      Most Popular
                    </div>
                  )}

                  <div className="p-8 flex-1">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.35em] mb-4 ${plan.popular ? 'text-brand-gold' : 'text-slate-400'}`}>
                      {plan.highlight}
                    </p>
                    <h2 className="text-3xl font-serif font-bold mb-3">{plan.name}</h2>
                    <p className={`text-sm leading-relaxed mb-8 ${plan.popular ? 'text-slate-300' : 'text-slate-500'}`}>
                      {plan.description}
                    </p>

                    <div className={`rounded-2xl border p-4 mb-8 ${plan.popular ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${plan.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                        Billing cadence
                      </p>
                      <p className="text-2xl font-bold">{plan.cadenceLabel}</p>
                      <p className={`mt-3 text-sm leading-7 ${plan.popular ? 'text-slate-300' : 'text-slate-600'}`}>
                        Exact pricing and rental details are shared privately by Galarentals
                        after your application is approved.
                      </p>
                    </div>

                    <ul className="space-y-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm">
                          <Check className={`w-4 h-4 mt-0.5 ${plan.popular ? 'text-brand-gold' : 'text-brand-navy'}`} />
                          <span className={plan.popular ? 'text-slate-200' : 'text-slate-600'}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-8 pt-0 space-y-3">
                    <Link
                      to="/apply"
                      className={`focus-ring-light inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${plan.popular ? 'bg-brand-gold text-brand-navy hover:bg-brand-gold-light' : 'bg-brand-navy text-white hover:bg-brand-navy-light'}`}
                    >
                      Start Application <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/"
                      className={`focus-ring-light inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${plan.popular ? 'border-white/15 text-white hover:border-white/40' : 'border-slate-200 text-brand-navy hover:border-brand-navy/25'}`}
                    >
                      Back to Home
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: 'Protected payments',
              body: 'Stripe checkout opens only after your application is reviewed and the approved quote is confirmed.',
            },
            {
              icon: Check,
              title: 'Review-first approval',
              body: 'Galarentals confirms the approved rental details, onboarding notes, and exact billing amount during review.',
            },
            {
              icon: Check,
              title: 'Designed for active drivers',
              body: 'Insurance, maintenance cadence, and support expectations are built into every tier.',
            },
          ].map((item) => (
            <div key={item.title} className="ambient-shadow rounded-3xl border border-stone-200 bg-[#fbf9f4] p-7">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-serif font-bold text-brand-navy mb-3">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
