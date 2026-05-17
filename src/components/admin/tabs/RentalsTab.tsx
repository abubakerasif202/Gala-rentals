import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Search,
  XCircle,
  Car as CarIcon,
} from 'lucide-react';
import { Rental } from '../../../types';
import DataTable, { type DataTableColumn } from '../DataTable';
import type { CancelSubscriptionResponse } from '../../../lib/api';

interface RentalsTabProps {
  rentalSearch: string;
  setRentalSearch: (val: string) => void;
  filteredRentals: Rental[];
  onCancelSubscription?: (payload: {
    cancelAtPeriodEnd: boolean;
    confirm: 'CANCEL SUBSCRIPTION';
    reason?: string;
    rentalId: number;
  }) => Promise<CancelSubscriptionResponse>;
  onCreateTollNotice?: (rental: Rental) => void;
}

export default function RentalsTab({
  rentalSearch,
  setRentalSearch,
  filteredRentals,
  onCancelSubscription,
  onCreateTollNotice,
}: RentalsTabProps) {
  const [cancelTarget, setCancelTarget] = useState<Rental | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelResult, setCancelResult] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);

  const closeCancelModal = () => {
    if (isCancellingSubscription) {
      return;
    }

    setCancelTarget(null);
    setConfirmText('');
    setCancelAtPeriodEnd(true);
    setCancelReason('');
    setCancelResult(null);
    setCancelError(null);
  };

  const submitCancelSubscription = async () => {
    if (!cancelTarget || !onCancelSubscription || confirmText !== 'CANCEL SUBSCRIPTION') {
      return;
    }

    setIsCancellingSubscription(true);
    setCancelError(null);
    setCancelResult(null);
    try {
      const response = await onCancelSubscription({
        cancelAtPeriodEnd,
        confirm: 'CANCEL SUBSCRIPTION',
        reason: cancelReason.trim() || undefined,
        rentalId: cancelTarget.id,
      });
      setCancelResult(`${response.message} Stripe status: ${response.stripeStatus}.`);
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? String((error as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      setCancelError(message || 'Failed to cancel Stripe subscription.');
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const exportRentals = (rentals: Rental[]) => {
    const headers = ['Driver', 'Vehicle', 'Start Date', 'Weekly Rate', 'Status', 'Subscription ID'];
    const rows = rentals.map((rental) => [
      rental.applicant_name || '',
      rental.car_name || '',
      new Date(rental.start_date).toLocaleDateString(),
      rental.weekly_price,
      rental.status,
      rental.stripe_subscription_id || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'maple-rentals.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<Array<DataTableColumn<Rental>>>(
    () => [
      {
        header: 'Driver',
        id: 'driver',
        minWidth: '220px',
        sortValue: (rental) => rental.applicant_name || '',
        cell: (rental) => (
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#dfb125]/10 text-[#dfb125]">
              <CarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {rental.applicant_name || 'Unknown driver'}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                Rental #{rental.id}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: 'Vehicle',
        id: 'vehicle',
        minWidth: '180px',
        sortValue: (rental) => rental.car_name || '',
        cell: (rental) => (
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {rental.car_name || 'No vehicle linked'}
          </span>
        ),
      },
      {
        header: 'Start Date',
        id: 'start_date',
        minWidth: '130px',
        sortValue: (rental) => new Date(rental.start_date),
        cell: (rental) => (
          <span className="text-xs text-slate-400">
            {new Date(rental.start_date).toLocaleDateString()}
          </span>
        ),
      },
      {
        align: 'right',
        header: 'Weekly Rate',
        id: 'weekly_price',
        minWidth: '140px',
        sortValue: (rental) => rental.weekly_price,
        cell: (rental) => (
          <div>
            <p className="text-sm font-bold text-white">${rental.weekly_price}/wk</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              Incl. Insurance
            </p>
          </div>
        ),
      },
      {
        header: 'Status',
        id: 'status',
        minWidth: '140px',
        sortValue: (rental) => rental.status,
        cell: (rental) => (
          <span
            className={`rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
              rental.status === 'Active'
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}
          >
            {rental.status}
          </span>
        ),
      },
      {
        header: 'Stripe IDs',
        id: 'stripe',
        minWidth: '260px',
        sortable: false,
        cell: (rental) => (
          <div className="space-y-1">
            <p className="break-all font-mono text-[10px] text-slate-400">
              sub: {rental.stripe_subscription_id || 'Not linked'}
            </p>
            <p className="break-all font-mono text-[10px] text-slate-400">
              cus: {rental.stripe_customer_id || 'Not linked'}
            </p>
          </div>
        ),
      },
      {
        header: 'Actions',
        id: 'actions',
        minWidth: '220px',
        sortable: false,
        cell: (rental) => (
          <div className="flex flex-wrap gap-2">
            {onCreateTollNotice && (
              <button
                type="button"
                onClick={() => onCreateTollNotice(rental)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1e3a5f] bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:border-[#dfb125]/50 hover:bg-white/10"
              >
                <FileText className="h-4 w-4 text-[#dfb125]" />
                Create Toll Notice
              </button>
            )}
            <button
              type="button"
              disabled={!onCancelSubscription || !rental.stripe_subscription_id}
              onClick={() => {
                setCancelTarget(rental);
                setConfirmText('');
                setCancelAtPeriodEnd(true);
                setCancelReason('');
                setCancelResult(null);
                setCancelError(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <AlertTriangle className="h-4 w-4" />
              Cancel Stripe Subscription
            </button>
          </div>
        ),
      },
    ],
    [onCancelSubscription, onCreateTollNotice]
  );

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
          <h2 className="mb-2 text-3xl font-bold uppercase tracking-tighter text-white sm:text-4xl">
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

      <DataTable
        rows={filteredRentals}
        columns={columns}
        getRowId={(rental) => String(rental.id)}
        minWidth="1180px"
        filters={[
          {
            id: 'status',
            label: 'Status',
            getValue: (rental) => rental.status,
            options: ['Active', 'Completed', 'Cancelled', 'Overdue'].map((status) => ({
              label: status,
              value: status,
            })),
          },
        ]}
        bulkActions={[
          ...(onCreateTollNotice
            ? [
                {
                  icon: FileText,
                  label: 'Create Toll Notice',
                  onClick: (rows: Rental[]) => rows[0] && onCreateTollNotice(rows[0]),
                },
              ]
            : []),
          {
            icon: Download,
            label: 'Export Selected',
            onClick: exportRentals,
          },
        ]}
        emptyState={{
          actionLabel: rentalSearch ? 'Clear Search' : undefined,
          description: rentalSearch
            ? 'No active rentals match the current search and status filters.'
            : 'Active rentals will appear here after a paid application is finalized.',
          icon: CarIcon,
          onAction: rentalSearch ? () => setRentalSearch('') : undefined,
          title: rentalSearch ? 'No matching rentals' : 'No active rentals yet',
        }}
      />

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/70 backdrop-blur-xl sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-5">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Cancel Stripe Subscription
                </h3>
                <p className="mt-1 font-mono text-[10px] text-brand-grey">
                  {cancelTarget.stripe_subscription_id || 'No subscription linked'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-full bg-white/5 p-2 text-brand-grey hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-50">
                This only cancels the Stripe subscription. It does not delete the
                customer, vehicle, payment history, or rental record.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
                  <input
                    type="radio"
                    checked={cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(true)}
                  />
                  Cancel at period end
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
                  <input
                    type="radio"
                    checked={!cancelAtPeriodEnd}
                    onChange={() => setCancelAtPeriodEnd(false)}
                  />
                  Cancel immediately
                </label>
              </div>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none focus:border-brand-gold"
                placeholder="Optional admin note"
              />
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-mono text-sm text-white outline-none focus:border-brand-gold"
                placeholder="Type CANCEL SUBSCRIPTION"
              />
              {cancelError && <p className="text-sm text-red-300">{cancelError}</p>}
              {cancelResult && <p className="text-sm text-green-300">{cancelResult}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-white/5 p-5 sm:flex-row">
              <button
                type="button"
                onClick={closeCancelModal}
                className="w-full rounded-full border border-white/10 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitCancelSubscription}
                disabled={
                  isCancellingSubscription || confirmText !== 'CANCEL SUBSCRIPTION'
                }
                className="flex w-full items-center justify-center gap-3 rounded-full bg-red-500 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-400 disabled:opacity-50"
              >
                {isCancellingSubscription && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
