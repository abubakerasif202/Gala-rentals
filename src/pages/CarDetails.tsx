import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Car as CarIcon,
  Calendar,
  Gauge,
  Shield,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Info,
} from 'lucide-react';
import Seo from '../components/Seo';
import { fetchCar } from '../lib/api';
import { getPublicVehicleImage, hasVehicleImage } from '../lib/publicVehicleImages';
import type { Car } from '../types';

const statusStyles: Record<Car['status'], string> = {
  Available: 'border-green-200 bg-green-50 text-green-700',
  Rented: 'border-orange-200 bg-orange-50 text-orange-700',
  Maintenance: 'border-slate-200 bg-slate-100 text-slate-600',
};

const VehicleHeroPlaceholder = ({ name }: { name: string }) => (
  <div className="flex h-full min-h-[320px] w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(223,177,37,0.28),transparent_34%),linear-gradient(135deg,#0b1f36_0%,#123152_54%,#061425_100%)] p-8 text-center sm:min-h-[420px]">
    <div>
      <CarIcon className="mx-auto mb-5 h-16 w-16 text-brand-gold" />
      <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">
        Image coming soon
      </p>
      <p className="mt-4 text-lg font-semibold leading-7 text-white/85">{name}</p>
    </div>
  </div>
);

export default function CarDetails() {
  const { id } = useParams();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCar = async () => {
      if (!id) return;
      try {
        const data = await fetchCar(id);
        setCar(data);
      } catch {
        setError('Failed to load vehicle details.');
      } finally {
        setLoading(false);
      }
    };
    void loadCar();
  }, [id]);

  const pageSeo = (
    <Seo
      title={
        car
          ? `${car.name} Car Rental Sydney | Gala Rentals`
          : 'Fleet Vehicle Details Sydney | Gala Rentals'
      }
      description={
        car
          ? `Review Gala Rentals vehicle details and application requirements for the ${car.name} available for Sydney drivers.`
          : 'Review Gala Rentals vehicle details and application-ready fleet information for Sydney drivers.'
      }
      canonicalPath={id ? `/cars/${id}` : '/cars'}
      keywords={
        car
          ? [
              `${car.name.toLowerCase()} car rental sydney`,
              `${car.name.toLowerCase()} uber rental`,
              'uber-ready car rental sydney',
            ]
          : ['fleet vehicle details sydney', 'uber car rental sydney']
      }
    />
  );

  if (loading) {
    return (
      <>
        {pageSeo}
        <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-brand-gold animate-spin" />
        </div>
      </>
    );
  }

  if (error || !car) {
    return (
      <>
        {pageSeo}
        <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-red-500 font-bold uppercase tracking-widest mb-6">
              {error || 'Vehicle not found'}
            </p>
            <Link
              to="/cars"
              className="text-brand-gold hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Fleet
            </Link>
          </div>
        </div>
      </>
    );
  }

  const hasImage = hasVehicleImage(car.image);
  const vehicleImage = getPublicVehicleImage({ id: car.id, image: car.image });

  return (
    <>
      {pageSeo}
      <div className="min-h-screen bg-[#eef1f5] bg-[radial-gradient(circle_at_top_left,rgba(223,177,37,0.14),transparent_34%)] pb-20 pt-24 md:pb-24 md:pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/cars"
            className="mb-12 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-brand-gold-dark"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Fleet
          </Link>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(11,31,54,0.12)]"
          >
            <div className="relative aspect-[16/10] min-h-[320px] overflow-hidden bg-slate-100 sm:min-h-[420px] lg:aspect-[16/7]">
              {hasImage ? (
                <img
                  src={vehicleImage}
                  alt={`${car.name} rental vehicle`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <VehicleHeroPlaceholder name={car.name} />
              )}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-brand-navy/85 via-brand-navy/35 to-transparent" />
              <span className={`absolute left-5 top-5 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${statusStyles[car.status]}`}>
                {car.status}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-brand-gold">
                  Public vehicle preview
                </p>
                <h1 className="max-w-4xl font-serif text-4xl font-bold leading-none tracking-tight text-white md:text-6xl">
                  {car.name}
                </h1>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(11,31,54,0.08)] sm:p-8"
            >
              <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-brand-gold-dark">
                Approval-first rental
              </p>
              <p className="text-base leading-8 text-slate-600 sm:text-lg">
                Gala Rentals keeps public vehicle pricing, number plates, and final handover
                details private until your application is reviewed and approved.
              </p>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {[
                    { icon: Calendar, label: 'Model Year', value: car.model_year },
                    { icon: Gauge, label: 'Transmission', value: 'Automatic' },
                    { icon: Shield, label: 'Insurance', value: 'Included' },
                  ].map((spec) => (
                    <div
                      key={spec.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
                    >
                      <spec.icon className="mx-auto mb-3 h-6 w-6 text-brand-gold" />
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
                        {spec.label}
                      </p>
                      <p className="text-sm font-bold text-brand-navy">{spec.value}</p>
                    </div>
                  ))}
                </div>

              <div className="mt-8 rounded-3xl border border-brand-gold/25 bg-brand-gold/10 p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-gold-dark">
                    Approval note
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Once approved, Gala Rentals confirms the selected vehicle, registration details,
                    and the payment handoff directly with you.
                  </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="rounded-3xl border border-brand-gold/30 bg-white p-7 shadow-[0_24px_60px_rgba(11,31,54,0.12)] sm:p-8">
                <h2 className="mb-6 flex items-center gap-3 text-sm font-black uppercase tracking-widest text-brand-navy">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold-dark">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  Included Features
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    'Full maintenance and servicing',
                    'Comprehensive rideshare insurance',
                    '24/7 roadside assistance',
                    'Unlimited kilometres',
                    'Rego and CTP insurance',
                    'Tyres and brake replacement',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 text-slate-600 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-brand-gold/50" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to="/apply"
                className={`flex min-h-16 w-full items-center justify-center gap-3 py-5 text-sm font-bold uppercase tracking-widest shadow-2xl transition-all ${
                  car.status === 'Available'
                    ? 'rounded-full bg-brand-gold hover:bg-brand-gold-light text-brand-navy'
                    : 'rounded-full bg-white text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                onClick={(event) => car.status !== 'Available' && event.preventDefault()}
              >
                {car.status === 'Available' ? (
                  <>
                    Apply for Approval
                    <ChevronRight className="w-5 h-5" />
                  </>
                ) : 'Currently Rented'}
              </Link>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex gap-4">
                  <div className="h-fit rounded-xl bg-slate-100 p-3 text-slate-500">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-brand-navy font-bold uppercase tracking-widest text-xs mb-2">
                      Driver Requirements
                    </h3>
                    <ul className="text-slate-600 text-sm space-y-2">
                      <li>Valid Australian driver&apos;s license</li>
                      <li>Clean driving record for the last 3 years</li>
                      <li>Proof of address and identity</li>
                      <li>Approved Uber or rideshare account</li>
                      <li>Payment handoff completed after approval</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
