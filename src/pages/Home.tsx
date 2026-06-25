import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Headphones,
  LockKeyhole,
  KeyRound,
  MapPin,
  ShieldCheck,
  Star,
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
    badge: 'Application First',
    title: 'Approved quote before payment',
    image: featuredRentalImages[1],
    note: 'Submit your details online and let Gala confirm the right weekly rental setup before any checkout link is issued.',
  },
  {
    badge: 'Secure Checkout',
    title: 'Subscription payment, only after approval',
    image: featuredRentalImages[4],
    note: 'Secure subscription checkout opens only once your quote, rental start date, and onboarding details are reviewed.',
  },
  {
    badge: 'Handover Ready',
    title: 'Simple Sydney handover',
    image: featuredRentalImages[2],
    note: 'Clean vehicle presentation, key handover, and clear next-step support keep the start of your rental straightforward.',
  },
];

const reasons = [
  { icon: CalendarClock, title: 'Weekly rental plans', body: 'Clear weekly plans built for practical Sydney driving, without generic SaaS-style filler.' },
  { icon: ClipboardCheck, title: 'Application-first approval', body: 'Your details are reviewed first so the approved quote and start date are confirmed before payment.' },
  { icon: LockKeyhole, title: 'Secure subscription checkout', body: 'Hosted checkout is issued only after approval, keeping billing clear and controlled.' },
  { icon: Headphones, title: 'Sydney-based rental support', body: 'Local support for applications, onboarding, payment questions, and handover follow-up.' },
];

const steps = [
  { icon: CalendarClock, title: 'Confirm car rental needs', body: 'Choose the weekly plan, timing, and vehicle setup that fits your driving needs.' },
  { icon: ClipboardCheck, title: 'Submit your application', body: 'Send your details and documents through the application flow in a few clear steps.' },
  { icon: BadgeCheck, title: 'Get approved and quoted', body: 'Gala reviews the application, confirms pricing, and issues the payment link only after approval.' },
  { icon: KeyRound, title: 'Complete payment and handover', body: 'Finalize secure checkout, receive handover details, and collect your vehicle with confidence.' },
];

const navLinks = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'How It Works', to: '#how-it-works' },
  { label: 'About', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#e9edf2] text-brand-navy selection:bg-brand-gold selection:text-brand-navy">
      <Seo
        title="Gala Rentals | Premium Weekly Car Rentals Sydney"
        description="Premium weekly car rentals in Sydney with application-first approval, approved quotes before payment, and a clean handover process."
        canonicalPath="/"
        keywords={[
          'gala rentals',
          'weekly car rentals sydney',
          'subscription car rental sydney',
          'secure rental approval sydney',
          'galarentals.com.au',
        ]}
        jsonLd={homeJsonLd}
      />

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <div className="mx-auto min-h-screen max-w-[1440px] overflow-hidden bg-[#e9edf2]">
        <nav className="bg-[#fbf9f4]/95 px-4 py-4 shadow-sm shadow-brand-navy/5 backdrop-blur-xl sm:px-8 lg:px-10" aria-label="Home page navigation">
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
                <a key={link.label} href={link.to} className="focus-ring-light rounded text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 transition-colors hover:text-brand-navy">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className="focus-ring-light rounded text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 transition-colors hover:text-brand-navy">
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

        <main id="main-content">
          <section className="px-4 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-14">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="max-w-xl">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-[#fbf9f4] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold-dark shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Premium Car Rentals Made Simple
                </p>
                <h1 className="font-serif text-4xl font-bold leading-tight text-brand-navy sm:text-6xl">
                  Premium weekly car rentals in Sydney
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                  Drive smarter. Rent easier. Apply online, get approved and quoted, then complete secure subscription checkout before a simple Sydney handover.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/apply"
                    className="focus-ring-light inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-navy px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-colors hover:bg-brand-navy-light"
                  >
                    Apply Now <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="focus-ring-light inline-flex min-h-12 items-center justify-center rounded-full border border-brand-navy/20 bg-transparent px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-brand-navy transition-colors hover:bg-white/70"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_top_left,rgba(214,178,94,0.28),transparent_44%)] blur-2xl" />
                <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[#fbf9f4] p-2 ambient-shadow">
                  <img
                    src={featuredRentalImages[0]}
                    alt="Front profile of a premium silver rental sedan parked in Sydney"
                    width="1200"
                    height="800"
                    fetchPriority="high"
                    className="aspect-[16/10] w-full rounded-[1.5rem] object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 pb-18 sm:px-8 lg:px-10">
            <div className="rounded-[1.75rem] border border-white/70 bg-[#fbf9f4] px-4 py-6 ambient-shadow sm:px-8">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:divide-x md:divide-stone-200">
                {[
                  { icon: CalendarClock, label: 'Weekly Rentals' },
                  { icon: LockKeyhole, label: 'Secure Payments' },
                  { icon: MapPin, label: 'Sydney Based' },
                  { icon: Star, label: 'Fast Approval' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center justify-center gap-3 px-4 text-center">
                    <item.icon className="h-6 w-6 text-brand-gold-dark" aria-hidden="true" />
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-navy">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[#f7f4ed] px-4 py-18 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-black text-brand-navy sm:text-4xl">Featured Fleet</h2>
                <p className="mt-3 text-base text-slate-500">Premium vehicles ready for Sydney roads.</p>
              </div>

              <div className="grid gap-10 rounded-[2.5rem] border border-stone-200 bg-[#fbf9f4] p-6 ambient-shadow lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:p-10">
                <div className="overflow-hidden rounded-[1.5rem] bg-white">
                  <img
                    src={featuredRentalImages[5]}
                    alt="Front profile of a white premium rental sedan"
                    width="1100"
                    height="900"
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <p className="inline-flex w-fit rounded-full bg-brand-navy px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">
                    Available Now
                  </p>
                  <h3 className="mt-5 text-3xl font-black text-brand-navy">Toyota Camry 2026</h3>
                  <p className="mt-2 text-base text-slate-500">Hybrid Sedan</p>
                  <div className="mt-6 flex items-end gap-2 border-b border-stone-200 pb-6">
                    <span className="text-3xl font-black text-brand-navy">$250</span>
                    <span className="pb-1 text-sm text-slate-500">/ week</span>
                  </div>
                  <ul className="mt-6 space-y-4 text-sm text-slate-600">
                    <li className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-brand-gold-dark" aria-hidden="true" />
                      Exceptional hybrid fuel economy
                    </li>
                    <li className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-brand-gold-dark" aria-hidden="true" />
                      Premium leather interior
                    </li>
                    <li className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-brand-gold-dark" aria-hidden="true" />
                      Advanced safety sensing
                    </li>
                  </ul>
                  <div className="mt-8">
                    <Link
                      to="/apply"
                      className="focus-ring-light inline-flex min-h-11 items-center justify-center rounded-full border border-brand-navy/20 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-brand-navy transition-colors hover:bg-white"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-18 sm:px-8 lg:px-10">
            <div className="mb-10">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">Why Choose Gala Rentals</p>
              <h2 className="mt-3 text-3xl font-black text-brand-navy sm:text-4xl">Subscription car rentals made simple.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((item) => (
                <article key={item.title} className="rounded-3xl border border-stone-200 bg-[#fbf9f4] p-6 ambient-shadow">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy text-brand-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black text-brand-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="px-4 pb-18 sm:px-8 lg:px-10">
            <div className="grid gap-6 md:grid-cols-3">
              {rentalSupportCards.map((item) => (
                <article key={item.badge} className="group overflow-hidden rounded-3xl border border-stone-200 bg-[#fbf9f4] ambient-shadow">
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <img src={item.image} alt={item.title} width="640" height="480" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transform-none" loading="lazy" />
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

          <section id="how-it-works" className="bg-[#e9edf2] px-4 py-18 sm:px-8 lg:px-10">
            <div className="mb-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">How It Works</p>
              <h2 className="mt-3 text-3xl font-black text-brand-navy sm:text-4xl">Simple, transparent process</h2>
              <p className="mt-3 text-sm text-slate-500">Four steps from application to handover.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-4">
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-3xl border border-stone-200 bg-[#fbf9f4] p-6 text-center ambient-shadow">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-brand-navy">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-black text-brand-navy">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="px-4 py-14 sm:px-8 lg:px-10">
            <div className="rounded-[2rem] bg-[#020916] px-7 py-10 text-center text-white shadow-[0_20px_40px_rgba(0,5,17,0.3)] sm:px-10 lg:px-16 lg:py-16">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-4xl font-serif font-bold sm:text-5xl">Ready to elevate your drive?</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  Join Gala Rentals for premium weekly car rentals, approved quotes before payment, and a handover process built for real Sydney drivers.
                </p>
              </div>
              <Link
                to="/apply"
                className="focus-ring-dark mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-brand-navy transition-colors hover:bg-brand-gold-light"
              >
                Apply Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>

        <footer className="mt-10 rounded-t-[2rem] bg-[#020916] px-4 py-12 text-white sm:px-8 lg:px-10">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <img
	                src="/logo/gala-logo-footer.png"
	                alt="Gala Rentals logo"
                    width="180"
                    height="48"
	                className="h-12 w-auto max-w-[180px] object-contain"
                loading="lazy"
              />
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">Premium weekly car rentals in Sydney with approved quotes, secure subscription checkout, and a simple handover process.</p>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white">Fleet</p>
              <Link className="focus-ring-dark rounded block w-fit" to="/apply">Toyota Camry</Link>
              <Link className="focus-ring-dark rounded block w-fit" to="/apply">View All</Link>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white">Company</p>
              <Link className="focus-ring-dark rounded block w-fit" to="/pricing">Pricing</Link>
              <Link className="focus-ring-dark rounded block w-fit" to="/faq">About</Link>
              <Link className="focus-ring-dark rounded block w-fit" to="/contact">Contact</Link>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white">Legal</p>
              <a className="focus-ring-dark rounded block w-fit" href="tel:1300555828">1300 555 828</a>
              <a className="focus-ring-dark rounded block w-fit" href="mailto:hello@gala-rentals.com.au">hello@gala-rentals.com.au</a>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">
            © 2026 Gala Rentals Sydney. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}
