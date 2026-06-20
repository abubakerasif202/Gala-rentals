import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car as CarIcon, Calendar, Gauge, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import { fetchCars } from '../lib/api';
import type { Car } from '../types';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

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
      <div className="min-h-screen bg-[#eef1f5] bg-[radial-gradient(circle_at_top_left,rgba(223,177,37,0.14),transparent_34%)] pt-28 pb-20 md:pt-32 md:pb-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <h1 className="text-4xl md:text-7xl font-bold text-brand-navy mb-6 uppercase tracking-tighter">
                Sydney <span className="text-brand-gold italic">Fleet</span>
              </h1>
              <p className="text-slate-600 text-lg max-w-xl font-light leading-relaxed">
                Browse premium fleet options for drivers across Sydney. Pricing, approval, and
                start dates are confirmed by Gala Rentals after review.
              </p>
            </motion.div>

            <div className="flex gap-2 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 shadow-[0_14px_36px_rgba(11,31,54,0.08)]">
              {['All', 'Available', 'Rented'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCars.map((car, index) => (
                <motion.div
                  key={car.id}
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { delay: index * 0.1 } }
                  }}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(11,31,54,0.08)] transition-all duration-500 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-[0_24px_60px_rgba(11,31,54,0.13)]"
                >
                  <div className="p-8">
                    <div className="flex justify-between items-start gap-4 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-4">
                          <CarIcon className="w-6 h-6 text-brand-gold" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-brand-navy mb-1 group-hover:text-brand-gold-dark transition-colors">
                            {car.name}
                          </h3>
                          <p className="text-slate-500 text-xs uppercase tracking-widest">
                            {car.model_year} Model
                          </p>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        car.status === 'Available'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      }`}>
                        {car.status}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold mb-3">
                        Fleet visibility after approval
                      </p>
                      <p className="text-sm leading-7 text-slate-600">
                        Vehicle pricing, number plates, and final handover details are confirmed
                        directly by Gala Rentals during review.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors group-hover:bg-brand-gold/10">
                        <Calendar className="w-4 h-4 text-brand-gold mb-2" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                          Automatic
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors group-hover:bg-brand-gold/10">
                        <Gauge className="w-4 h-4 text-brand-gold mb-2" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                          Hybrid
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors group-hover:bg-brand-gold/10">
                        <Shield className="w-4 h-4 text-brand-gold mb-2" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                          Insured
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/cars/${car.id}`}
                      className="flex min-h-12 items-center justify-center gap-3 w-full rounded-full border border-brand-navy/10 bg-brand-navy py-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:border-brand-gold hover:bg-brand-gold hover:text-brand-navy group-hover:shadow-lg group-hover:shadow-brand-gold/10"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
