import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Seo from '../components/Seo';
import { featuredRentalImages } from '../lib/genericRentalImages';
import { buildCanonicalUrl } from '../lib/seo';

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Gala Rentals',
  url: buildCanonicalUrl('/'),
  description:
    'Premium subscription rental applications in Sydney with easy approvals, secure payments, and professional handover support.',
  telephone: '+61 1300 555 828',
  email: 'hello@gala-rentals.com.au',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Sydney',
    addressRegion: 'NSW',
    addressCountry: 'AU',
  },
  areaServed: [{ '@type': 'City', name: 'Sydney' }],
};

const rentalSupportCards = [
  {
    badge: 'Application Support',
    title: 'Fast rental approval',
    image: featuredRentalImages[1],
    note: 'Submit your details online and let Gala review the right rental setup before payment.',
  },
  {
    badge: 'Secure Checkout',
    title: 'Subscription billing',
    image: featuredRentalImages[4],
    note: 'Stripe-hosted checkout opens only after your quote and start date are approved.',
  },
  {
    badge: 'Handover Ready',
    title: 'Customer onboarding',
    image: featuredRentalImages[2],
    note: 'The team confirms handover details after payment so the rental can start cleanly.',
  },
];

const reasons = [
  { icon: CalendarClock, title: 'Flexible Weekly Rentals', body: 'Clear subscription rental plans designed around practical Sydney needs.' },
  { icon: ClipboardCheck, title: 'Fast Application Process', body: 'Apply online with a calm approval process before payment is requested.' },
  { icon: Sparkles, title: 'Premium Rental Support', body: 'Professional onboarding, clean paperwork, and handover support after approval.' },
  { icon: Headphones, title: 'Local Support', body: 'Sydney-based support for applications, onboarding, payments, and follow-up.' },
];

const steps = [
  { icon: ClipboardCheck, title: 'Confirm rental needs' },
  { icon: ClipboardCheck, title: 'Submit your application' },
  { icon: BadgeCheck, title: 'Get approved' },
  { icon: KeyRound, title: 'Complete handover' },
];

const navLinks = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'How It Works', to: '#how-it-works' },
  { label: 'About', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(223,177,37,0.16),transparent_34%)] px-3 py-4 text-brand-navy selection:bg-brand-gold selection:text-brand-navy sm:px-6 sm:py-8">
      <Seo
        title="Gala Rentals | Premium Subscription Rentals Sydney"
        description="Premium subscription rental applications in Sydney with easy approvals, secure payments, and professional handover support."
        canonicalPath="/"
        keywords={[
          'gala rentals',
          'subscription rental sydney',
          'weekly rental applications sydney',
          'secure rental approval sydney',
          'galarentals.com.au',
        ]}
        jsonLd={homeJsonLd}
      />

      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/80">
        <nav className="border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-8 lg:px-10" aria-label="Home page navigation">
          <div className="flex items-center justify-between gap-3">
          <Link to="/" className="focus-ring-light flex min-w-0 items-center">
	            <img
	              src="/logo/gala-logo-navbar.png"
	              alt="Gala Rentals logo"
                  width="180"
                  height="48"
	              className="h-9 w-auto max-w-[116px] object-contain sm:h-12 sm:max-w-[180px]"
	            />
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) =>
              link.to.startsWith('#') ? (
                <a key={link.label} href={link.to} className="focus-ring-light rounded text-sm font-semibold text-slate-600 transition-colors hover:text-brand-navy">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className="focus-ring-light rounded text-sm font-semibold text-slate-600 transition-colors hover:text-brand-navy">
                  {link.label}
                </Link>
              ),
            )}
          </div>

          <Link
            to="/apply"
            className="focus-ring-light hidden shrink-0 items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-brand-navy-light sm:inline-flex"
          >
            Apply Now
          </Link>
          </div>

          <div className="home-mobile-links mt-4 w-full max-w-[320px] gap-2 border-t border-slate-100 pt-4">
            {navLinks.map((link) =>
              link.to.startsWith('#') ? (
                <a
                  key={link.label}
                  href={link.to}
                  className="focus-ring-light min-w-0 rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs font-bold text-slate-700 transition-colors hover:text-brand-navy"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.to}
                  className="focus-ring-light min-w-0 rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs font-bold text-slate-700 transition-colors hover:text-brand-navy"
                >
                  {link.label}
                </Link>
              ),
            )}
            <Link
              to="/apply"
              className="focus-ring-light min-w-0 rounded-2xl bg-brand-navy px-3 py-3 text-center text-xs font-black text-white transition-colors hover:bg-brand-navy-light"
            >
              Apply Now
            </Link>
          </div>
        </nav>

        <main>
          <section className="px-4 pb-10 pt-5 sm:px-8 sm:pb-12 lg:px-10">
            <div className="relative min-h-[620px] overflow-hidden rounded-3xl bg-slate-200 shadow-inner lg:min-h-[560px]">
              <img
	                src={featuredRentalImages[0]}
	                alt="Secure rental approval process"
                    width="1440"
                    height="900"
                    fetchPriority="high"
	                className="absolute inset-0 h-full w-full object-cover"
	              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.9)_46%,rgba(255,255,255,0.2)_100%)] lg:bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.84)_38%,rgba(255,255,255,0.16)_68%,rgba(255,255,255,0)_100%)]" />
              <div className="absolute bottom-5 right-5 hidden max-w-[360px] gap-3 lg:grid lg:grid-cols-2">
                {featuredRentalImages.slice(1, 5).map((image, index) => (
                  <div key={image} className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-1 shadow-[0_16px_38px_rgba(11,31,54,0.18)] backdrop-blur">
                    <img
	                      src={image}
	                      alt={`Gala Rentals rental support preview ${index + 1}`}
                          width="360"
                          height="270"
	                      className="aspect-[4/3] h-full w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              <div className="relative flex min-h-[620px] min-w-0 max-w-full flex-col justify-start overflow-hidden px-5 py-10 sm:max-w-2xl sm:px-10 sm:py-14 lg:min-h-[560px] lg:justify-center lg:px-14">
                <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-brand-gold/20 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-brand-gold-dark shadow-sm sm:text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  Premium Sydney rentals
                </p>
	                <h1 className="max-w-[14ch] text-balance font-serif text-3xl font-bold leading-tight text-brand-navy sm:max-w-full sm:text-6xl lg:text-7xl">
                  Subscription Rentals Made Simple
                </h1>
                <p className="mt-6 max-w-[30ch] text-base leading-8 text-slate-600 sm:max-w-xl sm:text-lg">
                  Start with a secure application, get a reviewed quote, and complete subscription checkout only when your rental is approved.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/apply"
                    className="focus-ring-light inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-sm font-black text-brand-navy shadow-lg transition-colors hover:bg-brand-gold-light sm:w-auto"
                  >
                    Start Application <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="focus-ring-light inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-full border border-brand-navy/15 bg-white/85 px-7 py-4 text-sm font-black text-brand-navy transition-colors hover:border-brand-gold sm:w-auto"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-12 sm:px-8 lg:px-10">
            <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">Rental Support</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">Application-first rental support</h2>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {rentalSupportCards.map((item) => (
	                <article key={item.badge} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg transition-[box-shadow,transform] duration-300 motion-reduce:transform-none motion-reduce:transition-none hover:-translate-y-1 hover:shadow-2xl">
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
	                    <img src={item.image} alt={item.title} width="640" height="480" className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transform-none motion-reduce:transition-none group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-6">
                    <p className="inline-flex rounded-full bg-brand-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold-dark">
                      {item.badge}
                    </p>
                    <h3 className="mt-4 text-2xl font-black text-brand-navy">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-slate-50 px-4 py-14 sm:px-8 lg:px-10">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">Why Choose Gala Rentals</p>
              <h2 className="mt-3 text-3xl font-black text-brand-navy sm:text-4xl">Simple, premium, and professionally managed.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((item) => (
                <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(11,31,54,0.06)]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy text-brand-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black text-brand-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="px-4 py-14 sm:px-8 lg:px-10">
            <div className="mb-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">How It Works</p>
              <h2 className="mt-3 text-3xl font-black text-brand-navy sm:text-4xl">Four steps from application to handover.</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-4">
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_14px_36px_rgba(11,31,54,0.06)]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-brand-navy">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-black text-brand-navy">{step.title}</h3>
                  {index < steps.length - 1 && (
                    <ChevronRight className="absolute -right-5 top-1/2 hidden h-7 w-7 -translate-y-1/2 text-brand-gold-dark lg:block" />
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="px-4 py-10 sm:px-8 lg:px-10">
            <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-navy px-7 py-9 text-white shadow-2xl sm:px-10 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-3xl font-black">Ready to Get Started?</h2>
                <p className="mt-3 text-base text-slate-300">Start your rental application online and let Gala confirm the right plan.</p>
              </div>
              <Link
                to="/apply"
                className="focus-ring-dark inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-sm font-black text-brand-navy transition-colors hover:bg-brand-gold-light"
              >
                Start Your Application <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-100 bg-white px-4 py-10 sm:px-8 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <img
	                src="/logo/gala-logo-navbar.png"
	                alt="Gala Rentals logo"
                    width="180"
                    height="48"
	                className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[180px]"
                loading="lazy"
              />
              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">Apply confidently. Rent easier.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600">
              <Link className="focus-ring-light rounded" to="/pricing">Pricing</Link>
              <Link className="focus-ring-light rounded" to="/faq">About</Link>
              <Link className="focus-ring-light rounded" to="/contact">Contact</Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600 md:justify-end">
              <a className="focus-ring-light rounded" href="tel:1300555828">1300 555 828</a>
              <a className="focus-ring-light rounded" href="mailto:hello@gala-rentals.com.au">Email us</a>
            </div>
          </div>
          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© 2026 Gala Rentals, www.galarentals.com.au. All rights reserved.</p>
            <p>Apply confidently. Rent easier.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
