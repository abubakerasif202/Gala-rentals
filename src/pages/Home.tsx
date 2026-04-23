import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Check,
  Wrench,
  Fuel,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, Variants } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import DeferredInquiryForm from '../components/DeferredInquiryForm';
import Seo from '../components/Seo';
import { fetchRentalPlans } from '../lib/api';
import { buildCanonicalUrl } from '../lib/seo';

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Maple Rentals',
  url: buildCanonicalUrl('/'),
  description:
    'Maple Rentals offers weekly car rentals and Uber car rentals for professional drivers across Sydney, Merrylands, and Parramatta.',
  telephone: '+61 420 550 556',
  email: 'admin@maplerentals.com.au',
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
    { '@type': 'City', name: 'Lidcombe' },
  ],
};

const featuredVehicles = [
  {
    image: '/car-images/CNO40S.jpeg',
    title: 'Uber-ready hybrid sedan',
    description: 'Clean, professional presentation for airport runs, city shifts, and daily rideshare work.',
  },
  {
    image: '/car-images/YNU55M.jpeg',
    title: 'Driver-focused weekly rental',
    description: 'Prepared for drivers who want consistent support, reliable handover, and fast onboarding.',
  },
  {
    image: '/car-images/YPB83A.jpeg',
    title: 'Maple approval program',
    description: 'Vehicle availability, private handover details, and final payment steps stay managed after review.',
  },
];

export default function Home() {
  const {
    data: rentalPlans = [],
    isLoading: isLoadingRentalPlans,
    isError: hasRentalPlanError,
  } = useQuery({
    queryKey: ['rental-plans'],
    queryFn: fetchRentalPlans,
  });

  return (
    <div className="bg-white text-brand-navy min-h-screen font-sans selection:bg-brand-gold selection:text-black">
      <Seo
        title="Car Rentals Sydney | Uber Car Rentals Parramatta & Merrylands | Maple Rentals"
        description="Maple Rentals provides fully insured weekly car rentals and Uber car rentals in Sydney, with convenient service for drivers in Merrylands, Parramatta, and nearby suburbs."
        canonicalPath="/"
        keywords={[
          'car rentals sydney',
          'uber car rentals sydney',
          'merrylands car rentals',
          'parramatta car rentals',
          'rideshare car rental sydney',
        ]}
        jsonLd={homeJsonLd}
      />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-[#F8F9FA]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,40,0.18),transparent_32%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="text-left"
            >
              <motion.p variants={fadeIn} className="text-[10px] font-bold tracking-[0.4em] uppercase text-brand-gold mb-4">
                Sydney Car Rentals
              </motion.p>
              <motion.h1 variants={fadeIn} className="text-5xl lg:text-7xl font-serif font-bold tracking-tight mb-8 leading-[1.05] text-brand-navy">
                Car Rentals in Sydney for Uber Drivers.
              </motion.h1>
              <motion.p variants={fadeIn} className="text-lg text-slate-600 mb-10 max-w-lg font-light leading-relaxed">
                Maple Rentals provides fully insured weekly car rentals and Uber car rentals
                for professional drivers across Sydney, including Merrylands, Parramatta, and
                nearby suburbs. Choose reliable hybrid vehicles designed to keep you earning.
              </motion.p>

              <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 mb-10">
                <Link
                  to="/apply"
                  className="bg-brand-gold hover:bg-brand-gold-light text-brand-navy px-10 py-4 font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                >
                  Apply Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/pricing"
                  className="border border-brand-navy/15 hover:border-brand-navy bg-white text-brand-navy px-10 py-4 font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  View Plans
                </Link>
              </motion.div>

              <motion.div variants={fadeIn} className="flex flex-wrap items-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-gold" /> Fully insured</span>
                <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-gold" /> Professionally detailed</span>
                <span className="inline-flex items-center gap-2"><Fuel className="w-4 h-4 text-brand-gold" /> Serving Merrylands & Parramatta</span>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="absolute -inset-6 bg-brand-gold/10 blur-3xl" />
              <div className="relative z-10 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(0,35,71,0.12)]">
                <p className="text-[10px] font-bold tracking-[0.38em] uppercase text-brand-gold mb-4">
                  Approval-First Access
                </p>
                <div className="space-y-4">
                  {[
                    {
                      icon: ShieldCheck,
                      title: 'Private vehicle details',
                      body: 'Car registration and final pricing are confirmed directly by Maple Rentals after approval.',
                    },
                    {
                      icon: Wrench,
                      title: 'Managed fleet support',
                      body: 'Maintenance, servicing, and support expectations stay handled by the Maple team.',
                    },
                    {
                      icon: Fuel,
                      title: 'Hybrid-ready program',
                      body: 'Designed for Sydney rideshare drivers who want reliable, efficient vehicles.',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-3xl border border-slate-200 bg-[#F8F9FA] p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-brand-gold/10 p-3">
                          <item.icon className="w-5 h-5 text-brand-gold" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-brand-navy">{item.title}</h2>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28 border-y border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="max-w-3xl mb-14"
          >
            <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-brand-gold mb-4">
              Vehicle Gallery
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-navy mb-5">
              See the kind of vehicles drivers apply for with Maple Rentals.
            </h2>
            <p className="text-slate-600 text-lg font-light leading-relaxed">
              The public site now keeps the focus on driver onboarding. You can still see the quality
              of the vehicles here, while final assignment, pricing, and plate confirmation stay private
              during review.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredVehicles.map((vehicle, index) => (
              <motion.article
                key={vehicle.image}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#F8F9FA] shadow-sm"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={vehicle.image}
                    alt={vehicle.title}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-gold mb-3">
                    Maple Rentals
                  </p>
                  <h3 className="text-2xl font-serif font-bold text-brand-navy mb-3">{vehicle.title}</h3>
                  <p className="text-sm leading-7 text-slate-600">{vehicle.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-32 bg-[#F8F9FA] relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <DeferredInquiryForm />
        </div>
      </section>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="border-y border-white/10 bg-brand-navy-light"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-[10px] md:text-xs font-bold text-brand-gold uppercase tracking-[0.4em]">
            Uber Car Rentals Across Sydney, Parramatta, and Merrylands
          </p>
        </div>
      </motion.div>

      <section className="py-32 bg-brand-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={slideInLeft}>
              <h2 className="text-4xl md:text-6xl font-serif font-bold mb-10 tracking-tight leading-tight text-white">
                Uber Car Rentals Built for Professional Drivers.
              </h2>
              <div className="space-y-6 text-slate-400 text-lg font-light leading-relaxed max-w-xl">
                <p>
                  Maple Rentals provides weekly car rentals for rideshare drivers who need
                  reliable hybrid vehicles, lower fuel costs, and strong uptime across Sydney.
                </p>
                <p>
                  Drivers from Parramatta, Merrylands, and surrounding suburbs choose our Uber
                  car rentals because maintenance, compliance, and support are built into every
                  plan.
                </p>
              </div>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="space-y-6">
              {[
                {
                  icon: Wrench,
                  title: 'Professional Maintenance',
                  body: 'Every vehicle is serviced and inspected to keep you earning consistently.',
                },
                {
                  icon: Fuel,
                  title: 'Hybrid Efficiency',
                  body: 'Lower your weekly fuel costs with a fleet optimized for long shifts across Sydney.',
                },
              ].map((item) => (
                <motion.div key={item.title} variants={fadeIn} className="bg-brand-navy-light p-8 border border-brand-gold/30 flex items-start gap-6 group hover:bg-brand-navy transition-colors">
                  <div className="bg-brand-gold/10 p-4 rounded-lg">
                    <item.icon className="w-8 h-8 text-brand-gold" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 tracking-wide">{item.title}</h3>
                    <p className="text-slate-400 text-sm font-light leading-relaxed">{item.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="mb-20">
            <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-brand-navy mb-6">Start Driving in 3 Steps</h2>
            <p className="text-slate-600 text-lg font-light">Apply once, get reviewed quickly, and move into a managed rental with clear next steps.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Apply Online', desc: 'Upload your driver details and required documents through our secure portal.' },
              { step: '02', title: 'Review & Approval', desc: 'Maple Rentals confirms vehicle availability, private registration details, and the approved payment terms after review.' },
              { step: '03', title: 'Collect & Start Earning', desc: 'Pick up your keys, connect to the Uber app, and start earning immediately.' },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeIn} className="flex flex-col items-center">
                <div className="w-16 h-16 bg-brand-navy text-brand-gold flex items-center justify-center text-xl font-bold mb-8 rounded-full">
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-brand-navy mb-4">{item.title}</h3>
                <p className="text-slate-600 font-light text-sm leading-relaxed max-w-xs">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-28 bg-[#F4F6F8] border-y border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14">
            <div>
              <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-brand-gold mb-4">Flexible Plans</p>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-navy mb-4">Choose a rental plan that fits your driving schedule.</h2>
              <p className="text-slate-600 max-w-2xl text-lg font-light leading-relaxed">
                Compare billing cadence, support level, and plan inclusions before you start an application. Final pricing is confirmed by Maple Rentals during approval.
              </p>
            </div>
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-navy hover:text-brand-gold transition-colors">
              Explore all plans <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {isLoadingRentalPlans &&
              Array.from({ length: 3 }, (_, index) => (
                <div
                  key={`rental-plan-skeleton-${index}`}
                  className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
                >
                  <Loader2 className="w-6 h-6 animate-spin text-brand-gold mb-6" />
                  <div className="space-y-4">
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-8 w-40 rounded bg-slate-200" />
                    <div className="h-20 rounded bg-slate-100" />
                  </div>
                </div>
              ))}

            {!isLoadingRentalPlans &&
              !hasRentalPlanError &&
              rentalPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className={`rounded-3xl border p-8 shadow-sm ${plan.popular ? 'bg-brand-navy text-white border-brand-gold/50 shadow-[0_25px_60px_rgba(0,35,71,0.2)]' : 'bg-white text-brand-navy border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mb-3 ${plan.popular ? 'text-brand-gold' : 'text-slate-400'}`}>
                        {plan.highlight}
                      </p>
                      <h3 className="text-2xl font-serif font-bold mb-2">{plan.name}</h3>
                      <p className={`text-sm leading-relaxed ${plan.popular ? 'text-slate-300' : 'text-slate-500'}`}>{plan.description}</p>
                    </div>
                    {plan.popular && <span className="rounded-full border border-brand-gold/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Popular</span>}
                  </div>

                  <div className="mb-8">
                    <p className={`text-xs uppercase tracking-[0.22em] ${plan.popular ? 'text-brand-gold' : 'text-slate-500'}`}>
                      {plan.cadenceLabel}
                    </p>
                    <p className={`mt-3 text-sm leading-7 ${plan.popular ? 'text-slate-300' : 'text-slate-500'}`}>
                      Maple Rentals shares the approved vehicle, registration details, and final billing amount after your application is reviewed.
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 ${plan.popular ? 'text-brand-gold' : 'text-brand-navy'}`} />
                        <span className={plan.popular ? 'text-slate-200' : 'text-slate-600'}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}

            {!isLoadingRentalPlans && hasRentalPlanError && (
              <div className="md:col-span-3 rounded-3xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                <p className="text-sm uppercase tracking-[0.2em] font-bold text-red-500 mb-3">
                  Plan details unavailable
                </p>
                <p className="text-slate-600 mb-6">
                  We could not load the current plan summaries on the homepage. Open the full plans
                  page or continue with the application flow.
                </p>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-brand-navy-light"
                >
                  View Plans <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-28 bg-white border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="max-w-3xl mb-14"
          >
            <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-brand-gold mb-4">
              Service Areas
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-navy mb-5">
              Car Rentals Serving Parramatta, Merrylands, and Greater Sydney.
            </h2>
            <p className="text-slate-600 text-lg font-light leading-relaxed">
              We support professional drivers looking for affordable car rentals close to
              Merrylands, Parramatta, Lidcombe, and surrounding Sydney suburbs. Apply online,
              compare plan options, and secure an Uber-ready hybrid backed by Maple Rentals.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Merrylands Pickup',
                body: 'Collect from our Merrylands location and start driving with a vehicle prepared for daily rideshare work.',
              },
              {
                title: 'Parramatta Access',
                body: 'A convenient option for drivers based around Parramatta who need a dependable weekly car rental plan.',
              },
              {
                title: 'Greater Sydney Coverage',
                body: 'Our fleet supports drivers working airport runs, CBD shifts, and suburban trips across Sydney.',
              },
            ].map((area) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="rounded-3xl border border-slate-200 bg-[#F8F9FA] p-8 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-4">
                  Local SEO
                </p>
                <h3 className="text-2xl font-serif font-bold text-brand-navy mb-4">{area.title}</h3>
                <p className="text-slate-600 font-light leading-relaxed">{area.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 bg-brand-navy relative overflow-hidden border-t border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="text-left">
              <h2 className="text-4xl md:text-6xl font-serif font-bold mb-8 leading-tight text-white">Ready for a reliable Sydney car rental?</h2>
              <p className="text-xl text-slate-400 mb-12 font-light">Join drivers who use Maple Rentals for weekly car rentals and Uber car rentals across Merrylands, Parramatta, and greater Sydney.</p>
              <div className="flex flex-col sm:flex-row items-center justify-start gap-6">
                <Link
                  to="/apply"
                  className="w-full sm:w-auto px-12 py-5 bg-brand-gold text-brand-navy font-bold tracking-widest uppercase text-sm hover:bg-brand-gold-light transition-all duration-300 shadow-xl"
                >
                  Apply Now
                </Link>
                <Link
                  to="/pricing"
                  className="w-full sm:w-auto px-12 py-5 border border-white/20 text-white font-bold tracking-widest uppercase text-sm hover:border-brand-gold hover:text-brand-gold transition-all duration-300"
                >
                  View Plans
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="relative hidden lg:block"
            >
              <div className="rounded-[2rem] border border-white/10 bg-brand-navy-light p-8 shadow-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">
                  What stays private
                </p>
                <div className="mt-6 space-y-4">
                  {[
                    'Vehicle number plates are shared only by Maple Rentals after approval.',
                    'Exact car pricing is confirmed by staff during review, not on the public site.',
                    'Collection and payment handoff details are sent once your application is approved.',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm leading-7 text-slate-300"
                    >
                      <div className="flex items-start gap-3">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-brand-gold" />
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

