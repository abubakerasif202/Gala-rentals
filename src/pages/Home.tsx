import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brush,
  Building2,
  CheckCircle2,
  Hammer,
  Home as HomeIcon,
  PaintBucket,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import DeferredInquiryForm from '../components/DeferredInquiryForm';
import Seo from '../components/Seo';
import { buildCanonicalUrl } from '../lib/seo';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HousePainter',
  name: 'Maple Painting',
  url: buildCanonicalUrl('/'),
  description:
    'Maple Painting provides residential painting, commercial painting, interior painting, exterior painting, repainting, and property painting services across Sydney.',
  telephone: '+61 420 550 556',
  email: 'hello@maplerentals.com.au',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '13/27-33 Addlestone Rd',
    addressLocality: 'Merrylands',
    addressRegion: 'NSW',
    postalCode: '2160',
    addressCountry: 'AU',
  },
  areaServed: [
    { '@type': 'City', name: 'Sydney' },
    { '@type': 'City', name: 'Parramatta' },
    { '@type': 'City', name: 'Merrylands' },
  ],
};

const services = [
  {
    icon: Brush,
    title: 'Interior painting',
    body: 'Clean, careful interior painting for bedrooms, living areas, hallways, kitchens, offices, and detailed trim work.',
  },
  {
    icon: PaintBucket,
    title: 'Exterior painting',
    body: 'Durable exterior painting for homes, facades, garages, fences, decks, and weather-exposed surfaces.',
  },
  {
    icon: HomeIcon,
    title: 'Residential painting',
    body: 'Whole-home repainting, colour refreshes, feature walls, move-in updates, and family-home maintenance.',
  },
  {
    icon: Building2,
    title: 'Commercial painting',
    body: 'Professional painting for offices, shops, strata spaces, rental properties, and commercial maintenance works.',
  },
  {
    icon: Sparkles,
    title: 'Rental property repainting',
    body: 'Fast property repainting, end-of-lease touch-ups, scuff repairs, and presentation work between tenancies.',
  },
  {
    icon: Hammer,
    title: 'Paint repairs',
    body: 'Wall patching, surface preparation, peeling paint repair, minor plaster touch-ups, and final finish corrections.',
  },
];

const proofPoints = [
  'Residential and commercial painting',
  'Interior, exterior, and repainting work',
  'Clear quoting before work begins',
  'Neat preparation and tidy site handover',
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-[#1f2933] selection:bg-brand-gold selection:text-black">
      <Seo
        title="Maple Painting | Residential & Commercial Painting Sydney"
        description="Maple Painting provides residential painting, commercial painting, interior painting, exterior painting, repainting, rental property touch-ups, and paint repairs across Sydney."
        canonicalPath="/"
        imagePath="/painting-hero.png"
        keywords={[
          'maple painting',
          'residential painting sydney',
          'commercial painting sydney',
          'interior painting sydney',
          'exterior painting sydney',
          'property repainting sydney',
        ]}
        jsonLd={homeJsonLd}
      />

      <section className="relative overflow-hidden bg-[#24352f] text-white">
        <div className="absolute inset-0">
          <img
            src="/painting-hero.png"
            alt="Professional painter applying fresh paint to an interior wall"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#17231f] via-[#17231f]/85 to-[#17231f]/35" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-24 sm:pb-20 sm:pt-28 lg:grid-cols-[1fr_0.8fr] lg:px-8 lg:pb-24">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.p variants={fadeUp} className="mb-5 text-[10px] font-bold uppercase tracking-[0.42em] text-brand-gold">
              Sydney Painting Services
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-5xl font-serif font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Maple Painting
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-7 max-w-2xl text-lg font-light leading-8 text-stone-100">
              Professional residential painting, commercial painting, interior painting,
              exterior painting, repainting, and property painting services delivered with
              careful preparation and a clean finish.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="#quote"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand-gold px-8 py-4 text-sm font-bold uppercase tracking-[0.18em] text-brand-navy transition-colors hover:bg-brand-gold-light"
              >
                Request a Free Quote <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="tel:0420550556"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/35 px-8 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition-colors hover:border-brand-gold hover:text-brand-gold"
              >
                <Phone className="h-4 w-4" /> Call Maple Painting
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-10 grid gap-3 sm:grid-cols-2">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3 text-sm text-stone-100 backdrop-blur">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-gold" />
                  {point}
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="self-end rounded-[1.5rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">
              What We Paint
            </p>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-stone-100">
              <p>Homes, units, offices, shops, rental properties, fences, decks, exterior walls, interior rooms, trims, and touch-up areas.</p>
              <p>Quotes are scoped around preparation, surface condition, access, coatings, and the finish you need.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="services" className="bg-[#fffaf2] py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#8a6a18]">Services</p>
            <h2 className="mt-4 text-4xl font-serif font-bold text-[#1f2933] sm:text-5xl">
              Painting services for homes, businesses, and managed properties.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <motion.article
                key={service.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="rounded-lg border border-[#e6dccb] bg-white p-7 shadow-sm"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#24352f] text-brand-gold">
                  <service.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#1f2933]">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#59636e]">{service.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="bg-[#eef2ec] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:px-8">
          <div className="overflow-hidden rounded-lg">
            <img
              src="/painting-interior.png"
              alt="Freshly painted modern interior room"
              className="aspect-[4/3] h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#8a6a18]">About Maple Painting</p>
            <h2 className="mt-4 text-4xl font-serif font-bold text-[#1f2933] sm:text-5xl">
              Careful prep, clean lines, and practical advice before the first coat.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#4f5963]">
              Maple Painting helps homeowners, landlords, property managers, and business
              owners refresh spaces without unnecessary complication. We focus on surface
              preparation, suitable coatings, tidy work areas, and finishes that suit daily use.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {['Colour refreshes', 'Full repaints', 'Lease-ready touch-ups', 'Surface repairs'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-semibold text-[#1f2933]">
                  <ShieldCheck className="h-4 w-4 text-[#8a6a18]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fffaf2] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#8a6a18]">Exterior Work</p>
            <h2 className="mt-4 text-4xl font-serif font-bold text-[#1f2933] sm:text-5xl">
              Exterior painting and repainting for street appeal and long-term protection.
            </h2>
            <p className="mt-6 text-base leading-8 text-[#4f5963]">
              From weathered facades to fences, decks, and investment properties, exterior
              work is scoped around preparation, access, coating choice, and a finish that
              can handle Sydney conditions.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg">
            <img
              src="/painting-exterior.png"
              alt="Freshly painted modern house exterior"
              className="aspect-[16/10] h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section id="quote" className="bg-[#24352f] py-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-gold">Contact</p>
            <h2 className="mt-4 text-4xl font-serif font-bold sm:text-5xl">
              Book a painting estimate.
            </h2>
            <p className="mt-6 text-base leading-8 text-stone-200">
              Tell us what needs painting, the property type, location, approximate timing,
              and whether you need interior painting, exterior painting, repainting, touch-ups,
              or paint repairs.
            </p>
            <div className="mt-8 flex flex-col gap-4">
              <a href="tel:0420550556" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-sm font-bold uppercase tracking-[0.18em] text-brand-navy hover:bg-brand-gold-light sm:w-fit">
                <Phone className="h-4 w-4" /> 0420 550 556
              </a>
              <Link to="/" className="text-sm text-stone-300">
                Maple Painting serves Merrylands, Parramatta, Lidcombe, and Greater Sydney.
              </Link>
            </div>
          </div>
          <DeferredInquiryForm />
        </div>
      </section>
    </div>
  );
}
