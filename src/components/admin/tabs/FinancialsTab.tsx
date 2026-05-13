import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, DollarSign, TrendingUp, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { WeeklyFinancials } from '../../../lib/api';
import DateRangePicker, { type DateRangeValue } from '../DateRangePicker';
import EmptyState from '../EmptyState';
import MetricCard from '../MetricCard';

interface FinancialsTabProps {
  dateRange: DateRangeValue;
  isLoadingWeeklyFinancials: boolean;
  weeklyFinancials?: WeeklyFinancials;
  onDateRangeChange: (value: DateRangeValue) => void;
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
  dateRange,
  isLoadingWeeklyFinancials,
  weeklyFinancials,
  onDateRangeChange,
  onRefresh,
  formatCurrency,
}: FinancialsTabProps) {
  const payoutSparkline = (weeklyFinancials?.recent_payouts || [])
    .slice()
    .reverse()
    .map((payout) => ({
      label: payout.arrival_date,
      value: payout.amount,
    }));

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
        <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          <button
            type="button"
            onClick={onRefresh}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#1e3a5f] bg-[#061425] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:border-[#dfb125]/60 md:w-auto"
          >
            <RefreshCw className="w-4 h-4 text-[#dfb125]" /> Refresh Data
          </button>
        </div>
      </div>

      {isLoadingWeeklyFinancials ? (
        renderLoadingPanel('Loading weekly financials...')
      ) : (
        <>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper="Total billed weekly"
              icon={DollarSign}
              label="Projected Gross"
              numericValue={weeklyFinancials?.projected_gross_weekly}
              value={formatCurrency(weeklyFinancials?.projected_gross_weekly)}
            />
            <MetricCard
              helper="After estimated fees"
              icon={TrendingUp}
              label="Projected Net"
              numericValue={weeklyFinancials?.projected_net_weekly}
              value={formatCurrency(weeklyFinancials?.projected_net_weekly)}
            />
            <MetricCard
              helper="Estimated weekly costs"
              icon={AlertCircle}
              label="Platform Fees"
              numericValue={weeklyFinancials?.estimated_platform_fees}
              value={formatCurrency(weeklyFinancials?.estimated_platform_fees)}
            />
            <MetricCard
              helper="Paid out for the selected payout range"
              icon={ShieldCheck}
              label="Recent Payouts"
              numericValue={weeklyFinancials?.actual_payouts_weekly}
              sparklineData={payoutSparkline}
              value={formatCurrency(weeklyFinancials?.actual_payouts_weekly)}
            />
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
                    <td colSpan={4}>
                      <EmptyState
                        description="Stripe has not returned any payouts for the selected date range."
                        icon={ShieldCheck}
                        title="No payout data"
                      />
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
