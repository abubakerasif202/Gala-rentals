import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Car,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Seo from '../components/Seo';
import { featuredVehicleImages } from '../lib/publicVehicleImages';
import { buildCanonicalUrl } from '../lib/seo';

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Gala Rentals',
  url: buildCanonicalUrl('/'),
  description:
    'Premium weekly car rentals in Sydney with easy approvals, secure payments, and modern Toyota Camry options.',
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

const fleetCards = [
  {
    badge: 'Popular Choice',
    title: '2026 Toyota Camry',
    image: featuredVehicleImages[0],
    note: 'Refined hybrid-style comfort for weekly rental plans.',
  },
  {
    badge: 'Executive Option',
    title: '2026 Toyota Camry',
    image: featuredVehicleImages[3],
    note: 'Premium presentation for business and everyday driving.',
  },
  {
    badge: 'Flexible Rental',
    title: '2026 Toyota Camry',
    image: featuredVehicleImages[5],
    note: 'Simple application, approval, and secure checkout flow.',
  },
];

const reasons = [
  { icon: CalendarClock, title: 'Flexible Weekly Rentals', body: 'Clear weekly rental plans designed around practical Sydney driving needs.' },
  { icon: ClipboardCheck, title: 'Fast Application Process', body: 'Apply online with a calm approval process before payment is requested.' },
  { icon: Sparkles, title: 'Premium Vehicles', body: 'Modern Toyota Camry options with clean presentation and professional handover.' },
  { icon: Headphones, title: 'Local Support', body: 'Sydney-based support for applications, onboarding, payments, and follow-up.' },
];

const steps = [
  { icon: Car, title: 'Choose your vehicle' },
  { icon: ClipboardCheck, title: 'Submit your application' },
  { icon: BadgeCheck, title: 'Get approved' },
  { icon: KeyRound, title: 'Start driving' },
];

const navLinks = [
  { label: 'Fleet', to: '/fleet' },
  { label: 'Subscriptions', to: '/pricing' },
  { label: 'How It Works', to: '#how-it-works' },
  { label: 'About', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#eef1f5] bg-[radial-gradient(circle_at_top_left,rgba(223,177,37,0.16),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef1f5_52%,#e6ebf1_100%)] px-3 py-4 text-[#0b1f36] selection:bg-brand-gold selection:text-brand-navy sm:px-6 sm:py-8">
      <Seo
        title="Gala Rentals | Premium Car Rentals Sydney"
        description="Premium weekly car rentals in Sydney with easy approvals, secure payments, and modern Toyota Camry options."
        canonicalPath="/"
        keywords={[
          'gala rentals',
          'premium car rentals sydney',
          'toyota camry rental sydney',
          'weekly car rentals sydney',
          'gala-rentals.com.au',
        ]}
        jsonLd={homeJsonLd}
      />

      <div className="mx-auto max-w-7xl overflow-hidden rounded-[1.5rem] bg-white shadow-[0_28px_90px_rgba(11,31,54,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]">
        <nav className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-4 py-4 sm:px-8 lg:px-10">
          <Link to="/" className="flex min-w-0 items-center">
            <img
              src="/logo/gala-logo-navbar.png"
              alt="Gala Rentals logo"
              className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[180px]"
            />
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) =>
              link.to.startsWith('#') ? (
                <a key={link.label} href={link.to} className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0b1f36]">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0b1f36]">
                  {link.label}
                </Link>
              ),
            )}
          </div>

          <Link
            to="/apply"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#0b1f36] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(11,31,54,0.18)] transition-colors hover:bg-[#12385e]"
          >
            Book Now
          </Link>
        </nav>

        <main>
          <section className="px-4 pb-10 pt-5 sm:px-8 sm:pb-12 lg:px-10">
            <div className="relative min-h-[620px] overflow-hidden rounded-[1.35rem] bg-[#dfe5ec] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.52)] sm:rounded-[1.6rem] lg:min-h-[560px]">
              <img
                src="/car-images/ai-gala-navy-sedan-hero.png"
                alt="2026 Toyota Camry premium rental vehicle"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.9)_46%,rgba(255,255,255,0.2)_100%)] lg:bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.84)_38%,rgba(255,255,255,0.16)_68%,rgba(255,255,255,0)_100%)]" />
              <div className="absolute bottom-5 right-5 hidden max-w-[360px] gap-3 lg:grid lg:grid-cols-2">
                {featuredVehicleImages.slice(1, 5).map((image, index) => (
                  <div key={image} className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-1 shadow-[0_16px_38px_rgba(11,31,54,0.18)] backdrop-blur">
                    <img
                      src={image}
                      alt={`Gala Rentals fleet vehicle preview ${index + 1}`}
                      className="aspect-[4/3] h-full w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              <div className="relative flex min-h-[620px] max-w-2xl flex-col justify-start px-5 py-10 sm:px-10 sm:py-14 lg:min-h-[560px] lg:justify-center lg:px-14">
                <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-brand-gold/20 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-brand-gold-dark shadow-sm sm:text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  Premium Sydney rentals
                </p>
                <h1 className="font-serif text-4xl font-bold leading-[1.04] text-[#0b1f36] sm:text-6xl lg:text-7xl">
                  Premium Car Rentals Made Simple
                </h1>
                <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                  Book quality rental vehicles with flexible weekly plans, easy approvals, and professional service across Sydney.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/fleet"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-sm font-black text-[#0b1f36] shadow-[0_14px_34px_rgba(185,146,24,0.22)] transition-colors hover:bg-brand-gold-light"
                  >
                    Browse Fleet <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/apply"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#0b1f36]/15 bg-white/85 px-7 py-4 text-sm font-black text-[#0b1f36] transition-colors hover:border-brand-gold"
                  >
                    Apply Now
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-12 sm:px-8 lg:px-10">
            <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">Featured Fleet Preview</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0b1f36] sm:text-4xl">Popular Fleet Options</h2>
              </div>
              <Link to="/fleet" className="hidden items-center gap-2 text-sm font-black text-[#0b1f36] sm:inline-flex">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {fleetCards.map((vehicle) => (
                <article key={vehicle.badge} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(11,31,54,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(11,31,54,0.13)]">
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <img src={vehicle.image} alt={vehicle.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-6">
                    <p className="inline-flex rounded-full bg-brand-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold-dark">
                      {vehicle.badge}
                    </p>
                    <h3 className="mt-4 text-2xl font-black text-[#0b1f36]">{vehicle.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{vehicle.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-[#f8fafc] px-4 py-14 sm:px-8 lg:px-10">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">Why Choose Gala Rentals</p>
              <h2 className="mt-3 text-3xl font-black text-[#0b1f36] sm:text-4xl">Simple, premium, and professionally managed.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((item) => (
                <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(11,31,54,0.06)]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b1f36] text-brand-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black text-[#0b1f36]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="px-4 py-14 sm:px-8 lg:px-10">
            <div className="mb-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-dark">How It Works</p>
              <h2 className="mt-3 text-3xl font-black text-[#0b1f36] sm:text-4xl">Four steps from browsing to driving.</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-4">
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_14px_36px_rgba(11,31,54,0.06)]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-[#0b1f36]">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-black text-[#0b1f36]">{step.title}</h3>
                  {index < steps.length - 1 && (
                    <ChevronRight className="absolute -right-5 top-1/2 hidden h-7 w-7 -translate-y-1/2 text-brand-gold-dark lg:block" />
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="px-4 py-10 sm:px-8 lg:px-10">
            <div className="flex flex-col items-start justify-between gap-6 rounded-[1.6rem] bg-[#0b1f36] bg-[radial-gradient(circle_at_top_right,rgba(223,177,37,0.22),transparent_38%)] px-7 py-9 text-white shadow-[0_24px_70px_rgba(11,31,54,0.2)] sm:px-10 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-3xl font-black">Ready to Get Started?</h2>
                <p className="mt-3 text-base text-slate-300">Browse our premium rental vehicles and apply online today.</p>
              </div>
              <Link
                to="/apply"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-sm font-black text-[#0b1f36] transition-colors hover:bg-brand-gold-light"
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
                className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[180px]"
                loading="lazy"
              />
              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">Drive smarter. Rent easier.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600">
              <Link to="/fleet">Fleet</Link>
              <Link to="/pricing">Subscriptions</Link>
              <Link to="/faq">About</Link>
              <Link to="/contact">Contact</Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600 md:justify-end">
              <Link to="/terms">Terms of Service</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© 2026 Gala Rentals, gala-rentals.com.au. All rights reserved.</p>
            <p>Drive smarter. Rent easier.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
