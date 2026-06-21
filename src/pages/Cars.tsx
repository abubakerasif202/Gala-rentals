import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car as CarIcon, Calendar, Gauge, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import { fetchCars } from '../lib/api';
import { getPublicVehicleImage, hasVehicleImage } from '../lib/publicVehicleImages';
import type { Car } from '../types';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const statusStyles: Record<Car['status'], string> = {
  Available: 'border-green-200 bg-green-50 text-green-700',
  Rented: 'border-orange-200 bg-orange-50 text-orange-700',
  Maintenance: 'border-slate-200 bg-slate-100 text-slate-600',
};

const VehicleImagePlaceholder = ({ name }: { name: string }) => (
  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(223,177,37,0.24),transparent_34%),linear-gradient(135deg,#0b1f36_0%,#123152_55%,#061425_100%)] p-6 text-center">
    <div>
      <CarIcon className="mx-auto mb-4 h-12 w-12 text-brand-gold" />
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-gold">
        Image coming soon
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-white/85">{name}</p>
    </div>
  </div>
);

export default function Cars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const loadCars = async () => {
      try {
        const data = await fetchCars();
        setCars(data);
      } catch {
        setError('Failed to load vehicles. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    void loadCars();
  }, []);

  const filteredCars =
    activeFilter === 'All'
      ? cars
      : cars.filter((car) => car.status === activeFilter);

  const pageSeo = (
      <Seo
      title="Fleet | Gala Rentals"
      description="Browse the Gala Rentals fleet, compare premium vehicle categories, and start an application for approval."
      canonicalPath="/fleet"
      keywords={[
        'sydney car rental fleet',
        'uber car rentals sydney',
        'hybrid car rental sydney',
        'merrylands car rentals',
        'parramatta car rentals',
      ]}
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

  return (
    <>
      {pageSeo}
      <div className="min-h-screen bg-[#eef1f5] bg-[radial-gradient(circle_at_top_left,rgba(223,177,37,0.14),transparent_34%)] pb-20 pt-24 md:pb-24 md:pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(11,31,54,0.10)] sm:p-8 lg:grid-cols-[1fr_0.82fr] lg:items-end">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-brand-gold-dark">
                Gala Rentals fleet
              </p>
              <h1 className="mb-5 font-serif text-4xl font-bold tracking-tight text-brand-navy sm:text-5xl lg:text-6xl">
                Sydney-ready cars with a cleaner rental handoff.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Browse premium fleet options for drivers across Sydney. Pricing, approval, and
                start dates are confirmed by Gala Rentals after review.
              </p>
            </motion.div>

            <div className="flex gap-2 overflow-x-auto rounded-full border border-slate-200 bg-slate-50 p-1 shadow-inner">
              {['All', 'Available', 'Rented', 'Maintenance'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`min-h-11 shrink-0 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                    activeFilter === filter
                      ? 'bg-brand-gold text-brand-navy'
                      : 'text-slate-500 hover:text-brand-navy'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 p-8 text-center rounded-2xl">
              <p className="text-red-500 font-bold uppercase tracking-widest text-sm">{error}</p>
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                No vehicles match this filter
              </p>
              <p className="mt-3 text-slate-600">
                Try another status or contact Gala Rentals for the latest availability.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCars.map((car, index) => {
                const hasImage = hasVehicleImage(car.image);
                const vehicleImage = getPublicVehicleImage({ id: car.id, image: car.image });

                return (
                  <motion.div
                    key={car.id}
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { delay: index * 0.08 } }
                    }}
                    className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(11,31,54,0.08)] transition-all duration-500 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-[0_24px_60px_rgba(11,31,54,0.13)]"
                  >
                    <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
                      {hasImage ? (
                        <img
                          src={vehicleImage}
                          alt={`${car.name} rental vehicle`}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading={index < 3 ? 'eager' : 'lazy'}
                        />
                      ) : (
                        <VehicleImagePlaceholder name={car.name} />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-brand-navy/70 to-transparent" />
                      <span className={`absolute left-4 top-4 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${statusStyles[car.status]}`}>
                        {car.status}
                      </span>
                    </div>

                    <div className="p-6 sm:p-7">
                      <div className="mb-6 flex items-start gap-4">
                        <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-4">
                          <CarIcon className="h-6 w-6 text-brand-gold" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-black text-brand-navy transition-colors group-hover:text-brand-gold-dark">
                            {car.name}
                          </h3>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            {car.model_year} model
                          </p>
                        </div>
                      </div>

                      <div className="mb-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold-dark">
                          Approval-first rental
                        </p>
                        <p className="text-sm leading-7 text-slate-600">
                          Pricing, number plate, and handover details are confirmed directly by
                          Gala Rentals after review.
                        </p>
                      </div>

                      <div className="mb-7 grid grid-cols-3 gap-3">
                        {[
                          { icon: Calendar, label: 'Weekly' },
                          { icon: Gauge, label: 'Auto' },
                          { icon: Shield, label: 'Insured' },
                        ].map((spec) => (
                          <div key={spec.label} className="flex min-h-20 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm transition-colors group-hover:bg-brand-gold/10">
                            <spec.icon className="mb-2 h-4 w-4 text-brand-gold" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              {spec.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Link
                        to={`/cars/${car.id}`}
                        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-brand-navy/10 bg-brand-navy py-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:border-brand-gold hover:bg-brand-gold hover:text-brand-navy group-hover:shadow-lg group-hover:shadow-brand-gold/10"
                      >
                        View Details
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
