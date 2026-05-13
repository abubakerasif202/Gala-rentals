import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Download, FileText, Search, Car as CarIcon } from 'lucide-react';
import { Rental } from '../../../types';
import DataTable, { type DataTableColumn } from '../DataTable';

interface RentalsTabProps {
  rentalSearch: string;
  setRentalSearch: (val: string) => void;
  filteredRentals: Rental[];
  onCreateTollNotice?: (rental: Rental) => void;
}

export default function RentalsTab({
  rentalSearch,
  setRentalSearch,
  filteredRentals,
  onCreateTollNotice,
}: RentalsTabProps) {
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
        cell: (rental) =>
          onCreateTollNotice ? (
            <button
              type="button"
              onClick={() => onCreateTollNotice(rental)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1e3a5f] bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:border-[#dfb125]/50 hover:bg-white/10"
            >
              <FileText className="h-4 w-4 text-[#dfb125]" />
              Create Toll Notice
            </button>
          ) : null,
      },
    ],
    [onCreateTollNotice]
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
          title: rentalSearch ? 'No matching rentals' : 'No rentals yet',
        }}
      />
    </motion.div>
  );
}
