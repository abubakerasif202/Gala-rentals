import React from 'react';
import { motion } from 'motion/react';
import { Search, Car as CarIcon } from 'lucide-react';
import { Rental } from '../../../types';

interface RentalsTabProps {
  rentalSearch: string;
  setRentalSearch: (val: string) => void;
  filteredRentals: Rental[];
}

export default function RentalsTab({
  rentalSearch,
  setRentalSearch,
  filteredRentals,
}: RentalsTabProps) {
  return (
    <motion.div
      key="rentals"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Active <span className="text-brand-gold italic">Rentals</span>
          </h2>
          <p className="text-brand-grey font-light">
            Monitor current driver subscriptions and vehicle usage.
          </p>
        </div>
        <div className="flex w-full gap-4 md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={rentalSearch}
              onChange={(event) => setRentalSearch(event.target.value)}
              placeholder="Search rentals..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-6 text-sm text-white outline-none transition-all focus:border-brand-gold md:w-64"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Driver & Vehicle
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Start Date
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Rate
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRentals.map((rental) => (
              <tr key={rental.id} className="hover:bg-white/5 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center text-brand-gold font-bold text-xs">
                      <CarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {rental.applicant_name}
                      </p>
                      <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                        {rental.car_name}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-xs text-brand-grey">
                  {new Date(rental.start_date).toLocaleDateString()}
                </td>
                <td className="px-8 py-6">
                  <div className="text-sm font-bold text-white">
                    ${rental.weekly_price}/wk
                  </div>
                  <div className="text-[8px] text-brand-grey uppercase tracking-widest">
                    Incl. Insurance
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                      rental.status === 'Active'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}
                  >
                    {rental.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRentals.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                >
                  No rentals matched the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
