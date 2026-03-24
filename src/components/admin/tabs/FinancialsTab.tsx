import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, DollarSign, TrendingUp, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { WeeklyFinancials } from '../../../lib/api';

interface FinancialsTabProps {
  isLoadingWeeklyFinancials: boolean;
  weeklyFinancials?: WeeklyFinancials;
  onRefresh: () => void;
  formatCurrency: (value?: number | string | null) => string;
}

const renderLoadingPanel = (message: string) => (
  <div className="bg-white/5 border border-white/10 rounded-3xl p-10 flex items-center gap-4 text-sm text-brand-grey">
    <Loader2 className="w-5 h-5 animate-spin text-brand-gold" />
    <span>{message}</span>
  </div>
);

export default function FinancialsTab({
  isLoadingWeeklyFinancials,
  weeklyFinancials,
  onRefresh,
  formatCurrency,
}: FinancialsTabProps) {
  return (
    <motion.div
      key="financials"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Weekly <span className="text-brand-gold italic">Financials</span>
          </h2>
          <p className="text-brand-grey font-light">
            Projected revenue, payout performance, and recent transfers.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex w-full items-center justify-center gap-3 border border-white/10 bg-white/5 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 md:w-auto"
        >
          <RefreshCw className="w-4 h-4 text-brand-gold" /> Refresh Data
        </button>
      </div>

      {isLoadingWeeklyFinancials ? (
        renderLoadingPanel('Loading weekly financials...')
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {[
              {
                label: 'Projected Gross',
                value: formatCurrency(weeklyFinancials?.projected_gross_weekly),
                helper: 'Total billed weekly',
                icon: DollarSign,
              },
              {
                label: 'Projected Net',
                value: formatCurrency(weeklyFinancials?.projected_net_weekly),
                helper: 'After estimated fees',
                icon: TrendingUp,
              },
              {
                label: 'Platform Fees',
                value: formatCurrency(
                  weeklyFinancials?.estimated_platform_fees
                ),
                helper: 'Estimated weekly costs',
                icon: AlertCircle,
              },
              {
                label: 'Recent Payouts',
                value: formatCurrency(weeklyFinancials?.actual_payouts_weekly),
                helper: 'Paid out this week',
                icon: ShieldCheck,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white/5 border border-white/10 p-8 rounded-3xl"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[10px] text-brand-grey font-bold uppercase tracking-[0.2em] mb-3">
                      {card.label}
                    </p>
                    <h3 className="text-3xl font-bold text-white tracking-tighter">
                      {card.value}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
                    <card.icon className="w-5 h-5 text-brand-gold" />
                  </div>
                </div>
                <p className="text-xs text-brand-grey font-light">
                  {card.helper}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
            <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold uppercase tracking-widest text-xs">
                  Recent Stripe Payouts
                </h3>
                <p className="text-brand-grey text-xs font-light mt-2">
                  Latest payout activity reported by the financials API.
                </p>
              </div>
            </div>

            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Payout ID
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Arrival Date
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(weeklyFinancials?.recent_payouts || []).map((payout) => (
                  <tr
                    key={payout.id}
                    className="hover:bg-white/5 transition-all"
                  >
                    <td className="px-8 py-6 text-xs text-brand-gold font-bold">
                      {payout.id}
                    </td>
                    <td className="px-8 py-6 text-xs text-brand-grey">
                      {new Date(payout.arrival_date).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6 text-sm text-white font-bold">
                      {formatCurrency(payout.amount)}
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-white/5 text-brand-grey border-white/10">
                        {payout.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!weeklyFinancials?.recent_payouts ||
                  weeklyFinancials.recent_payouts.length === 0) && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                    >
                      No payout data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  );
}
