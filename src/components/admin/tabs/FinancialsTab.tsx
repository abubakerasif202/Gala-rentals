import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

type PayoutStatusFilter = 'all' | 'paid' | 'in_transit' | 'pending' | 'failed';

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  currency: 'AUD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const chartCurrencyFormatter = (value: number) => currencyFormatter.format(value || 0);

const renderLoadingPanel = (message: string) => (
  <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-10 text-sm text-brand-grey">
    <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
    <span>{message}</span>
  </div>
);

const metricDefinitions = [
  {
    label: 'Projected Gross',
    definition:
      'Sum of weekly_price for real rentals where rental status is Active. Imported legacy applications and linked rentals are excluded by the financials API.',
  },
  {
    label: 'Projected Net',
    definition:
      'Projected Gross minus the configured weekly account management fee multiplied by active real rentals.',
  },
  {
    label: 'Recent Payouts',
    definition:
      'Stripe payouts returned for the selected created-date range. The headline total includes paid and in_transit payouts only.',
  },
  {
    label: 'Payout Gap',
    definition:
      'Projected Net minus paid and in_transit Stripe payouts for the selected date range. This is a monitoring signal, not an accounting reconciliation.',
  },
];

const statusOptions: Array<{ label: string; value: PayoutStatusFilter }> = [
  { label: 'All payouts', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'In transit', value: 'in_transit' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
];

export default function FinancialsTab({
  dateRange,
  isLoadingWeeklyFinancials,
  weeklyFinancials,
  onDateRangeChange,
  onRefresh,
  formatCurrency,
}: FinancialsTabProps) {
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<PayoutStatusFilter>('all');

  const payouts = weeklyFinancials?.recent_payouts || [];
  const filteredPayouts = useMemo(
    () =>
      payoutStatusFilter === 'all'
        ? payouts
        : payouts.filter((payout) => payout.status === payoutStatusFilter),
    [payoutStatusFilter, payouts]
  );

  const headlinePayouts = payouts.filter(
    (payout) => payout.status === 'paid' || payout.status === 'in_transit'
  );
  const payoutSparkline = headlinePayouts
    .slice()
    .reverse()
    .map((payout) => ({
      label: payout.arrival_date,
      value: payout.amount,
    }));

  const projectedGross = Number(weeklyFinancials?.projected_gross_weekly || 0);
  const projectedNet = Number(weeklyFinancials?.projected_net_weekly || 0);
  const estimatedFees = Number(weeklyFinancials?.estimated_platform_fees || 0);
  const actualPayouts = Number(weeklyFinancials?.actual_payouts_weekly || 0);
  const payoutGap = projectedNet - actualPayouts;
  const netMargin = projectedGross > 0 ? projectedNet / projectedGross : 0;
  const hasRevenue = Boolean(projectedGross || actualPayouts);
  const grossReconciles = Math.abs(projectedGross - estimatedFees - projectedNet) < 0.01;
  const filteredPayoutTotal = filteredPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);

  const revenueBridgeData = [
    { label: 'Projected gross', value: projectedGross },
    { label: 'Platform fees', value: -estimatedFees },
    { label: 'Projected net', value: projectedNet },
    { label: 'Stripe payouts', value: actualPayouts },
  ];

  const payoutTrendData = filteredPayouts
    .slice()
    .reverse()
    .map((payout) => ({
      amount: Number(payout.amount || 0),
      date: new Date(payout.arrival_date).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
      }),
      id: payout.id,
      status: payout.status,
    }));

  const payoutStatusData = Object.entries(
    payouts.reduce<Record<string, number>>((counts, payout) => {
      counts[payout.status] = (counts[payout.status] || 0) + 1;
      return counts;
    }, {})
  ).map(([status, count]) => ({ status, count }));

  const validationRows = [
    {
      label: 'Source freshness',
      value: 'Live admin API read',
      status: 'pass',
      detail: 'Dashboard renders from /api/financials/weekly for the selected range.',
    },
    {
      label: 'Revenue reconciliation',
      value: grossReconciles ? 'Pass' : 'Check required',
      status: grossReconciles ? 'pass' : 'warning',
      detail: 'Projected Gross - Platform Fees should equal Projected Net.',
    },
    {
      label: 'Accounting scope',
      value: 'Operational monitor',
      status: 'info',
      detail: 'Stripe payouts are compared to projected weekly rent, not recognized revenue.',
    },
  ];

  return (
    <motion.div
      key="financials"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10"
    >
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1f36] shadow-[0_30px_100px_rgba(0,0,0,0.24)]">
        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1fr_0.8fr] xl:p-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.36em] text-brand-gold">
              Financial Intelligence
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-serif font-bold leading-tight text-white sm:text-5xl">
              Revenue, payouts, and margin health in one dashboard.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
              Monitor projected weekly rental revenue against Stripe payout activity. The definitions and validation notes below make clear what is counted, what is filtered, and what still requires accounting review.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 text-brand-navy">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-gold-dark">
                Dashboard Filters
              </p>
              <BarChart3 className="h-5 w-5 text-brand-gold-dark" />
            </div>
            <div className="mt-5 space-y-4">
              <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Payout Status
                </span>
                <select
                  value={payoutStatusFilter}
                  onChange={(event) =>
                    setPayoutStatusFilter(event.target.value as PayoutStatusFilter)
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase tracking-widest text-brand-navy outline-none focus:border-brand-gold"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onRefresh}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand-navy px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-brand-navy-light"
              >
                <RefreshCw className="h-4 w-4 text-brand-gold" /> Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoadingWeeklyFinancials ? (
        renderLoadingPanel('Loading weekly financials...')
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              helper="Active real rental weekly_price total"
              icon={DollarSign}
              label="Projected Gross"
              numericValue={projectedGross}
              value={formatCurrency(projectedGross)}
            />
            <MetricCard
              helper={`${(netMargin * 100).toFixed(1)}% projected margin after configured fees`}
              icon={TrendingUp}
              label="Projected Net"
              numericValue={projectedNet}
              value={formatCurrency(projectedNet)}
            />
            <MetricCard
              helper="Configured weekly platform fee estimate"
              icon={AlertCircle}
              label="Platform Fees"
              numericValue={estimatedFees}
              value={formatCurrency(estimatedFees)}
            />
            <MetricCard
              helper="Paid and in-transit payouts from the selected date range"
              icon={ShieldCheck}
              label="Recent Payouts"
              numericValue={actualPayouts}
              sparklineData={payoutSparkline}
              value={formatCurrency(actualPayouts)}
            />
            <MetricCard
              helper="Projected net less paid and in-transit payouts"
              icon={BarChart3}
              label="Payout Gap"
              numericValue={payoutGap}
              value={formatCurrency(payoutGap)}
            />
          </div>

          {!hasRevenue && (
            <EmptyState
              description="Projected rental revenue and Stripe payouts are zero for the selected period."
              icon={DollarSign}
              title="No revenue for selected period"
            />
          )}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                    Revenue Bridge
                  </h3>
                  <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                    Gross rent, platform fees, projected net, and selected-range payouts.
                  </p>
                </div>
                <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                  AUD
                </span>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueBridgeData} margin={{ bottom: 24, left: 8, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      tickFormatter={(value) => chartCurrencyFormatter(Number(value))}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                      labelStyle={{ color: '#0b1f36', fontWeight: 700 }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {revenueBridgeData.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={entry.value < 0 ? '#E31B23' : entry.label === 'Stripe payouts' ? '#38bdf8' : '#dfb125'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                    Payout Trend
                  </h3>
                  <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                    Arrival-date trend for payouts matching the selected status filter.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                  {filteredPayouts.length} rows
                </span>
              </div>
              <div className="h-[320px]">
                {payoutTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={payoutTrendData} margin={{ bottom: 24, left: 8, right: 16, top: 8 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                        tickFormatter={(value) => chartCurrencyFormatter(Number(value))}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), 'Payout']}
                        labelStyle={{ color: '#0b1f36', fontWeight: 700 }}
                      />
                      <Line
                        dataKey="amount"
                        dot={{ fill: '#dfb125', r: 4 }}
                        isAnimationActive={false}
                        stroke="#dfb125"
                        strokeWidth={3}
                        type="monotone"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    description="No Stripe payouts matched the selected date and status filters."
                    icon={ShieldCheck}
                    title="No payout data"
                  />
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.75fr_1.25fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                Payout Status Mix
              </h3>
              <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                Count of Stripe payouts returned for the selected date range.
              </p>
              <div className="mt-6 h-[260px]">
                {payoutStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payoutStatusData}
                        dataKey="count"
                        innerRadius={58}
                        isAnimationActive={false}
                        nameKey="status"
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {payoutStatusData.map((entry, index) => (
                          <Cell
                            key={entry.status}
                            fill={['#dfb125', '#38bdf8', '#22c55e', '#f97316', '#E31B23'][index % 5]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    description="Stripe returned no payout records for the selected date range."
                    icon={ShieldCheck}
                    title="No status mix"
                  />
                )}
              </div>
              <div className="mt-4 grid gap-2">
                {payoutStatusData.map((item) => (
                  <div key={item.status} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-grey">
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-black text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                    Recent Stripe Payouts
                  </h3>
                  <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                    Filtered table for payout follow-up and handoff. Current filtered total: {formatCurrency(filteredPayoutTotal)}.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                  {payoutStatusFilter === 'all' ? 'All statuses' : payoutStatusFilter.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {filteredPayouts.map((payout) => (
                  <article
                    key={payout.id}
                    className="rounded-lg border border-white/10 bg-brand-navy/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all text-xs font-bold text-brand-gold">{payout.id}</p>
                        <p className="mt-1 text-xs text-brand-grey">
                          {new Date(payout.arrival_date).toLocaleDateString('en-AU')}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                        {payout.status}
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-bold text-white">
                      {formatCurrency(payout.amount)}
                    </p>
                  </article>
                ))}
                {filteredPayouts.length === 0 && (
                  <EmptyState
                    description="Stripe has not returned payouts matching the selected filters."
                    icon={ShieldCheck}
                    title="No payout data"
                  />
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                        Payout ID
                      </th>
                      <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                        Arrival Date
                      </th>
                      <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                        Amount
                      </th>
                      <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPayouts.map((payout) => (
                      <tr key={payout.id} className="transition-all hover:bg-white/5">
                        <td className="break-all px-8 py-6 text-xs font-bold text-brand-gold">
                          {payout.id}
                        </td>
                        <td className="px-8 py-6 text-xs text-brand-grey">
                          {new Date(payout.arrival_date).toLocaleDateString('en-AU')}
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-white">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="px-8 py-6">
                          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                            {payout.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredPayouts.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState
                            description="Stripe has not returned payouts matching the selected filters."
                            icon={ShieldCheck}
                            title="No payout data"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-brand-gold" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                  Metric Definitions
                </h3>
              </div>
              <div className="mt-6 grid gap-4">
                {metricDefinitions.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                      {metric.definition}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-brand-gold" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                  Validation And Handoff
                </h3>
              </div>
              <div className="mt-6 grid gap-4">
                {validationRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-white">
                        {row.label}
                      </p>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          row.status === 'pass'
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                            : row.status === 'warning'
                              ? 'border-brand-red/20 bg-brand-red/10 text-red-300'
                              : 'border-brand-gold/20 bg-brand-gold/10 text-brand-gold'
                        }`}
                      >
                        {row.value}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-light leading-6 text-brand-grey">
                      {row.detail}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                  Handoff
                </p>
                <p className="mt-2 text-xs font-light leading-6 text-slate-200">
                  Use this dashboard for weekly operating review. For month-end reporting, reconcile Stripe payouts against Stripe balance transactions and accounting exports before treating the payout gap as final revenue variance.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
}
