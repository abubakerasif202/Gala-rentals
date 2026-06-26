import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CalendarClock, CreditCard, Download, FileText, Search, ShieldCheck, Users } from 'lucide-react';
import { Application } from '../../../types';
import DataTable, { type DataTableColumn } from '../DataTable';

interface ApplicationsTabProps {
  applicationSearch: string;
  setApplicationSearch: (val: string) => void;
  filteredApplications: Application[];
  setSelectedApplication: (app: Application) => void;
}

export default function ApplicationsTab({
  applicationSearch,
  setApplicationSearch,
  filteredApplications,
  setSelectedApplication,
}: ApplicationsTabProps) {
  const statusCounts = useMemo(
    () => ({
      approved: filteredApplications.filter((app) => app.status === 'Approved').length,
      paid: filteredApplications.filter((app) => app.status === 'Paid').length,
      pending: filteredApplications.filter((app) => app.status === 'Pending').length,
      paymentReview: filteredApplications.filter((app) => app.status === 'Payment Review').length,
    }),
    [filteredApplications]
  );

  const exportApplications = (applications: Application[]) => {
    const headers = ['Driver', 'Email', 'Phone', 'Status', 'Experience', 'Date'];
    const rows = applications.map((app) => [
      app.name,
      app.email,
      app.phone,
      app.status,
      app.experience,
      new Date(app.created_at).toLocaleDateString(),
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
    link.download = 'gala-applications.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<Array<DataTableColumn<Application>>>(
    () => [
      {
        header: 'Driver',
        id: 'driver',
        minWidth: '240px',
        sortValue: (app) => app.name,
        cell: (app) => (
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfb125]/10 text-sm font-bold text-[#dfb125]">
              {app.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{app.name}</p>
              <p className="text-[10px] text-slate-400">{app.email}</p>
            </div>
          </div>
        ),
      },
      {
        header: 'Phone',
        id: 'phone',
        minWidth: '140px',
        sortValue: (app) => app.phone,
        cell: (app) => <span className="text-xs text-slate-400">{app.phone}</span>,
      },
      {
        header: 'Experience',
        id: 'experience',
        minWidth: '180px',
        sortValue: (app) => app.experience,
        cell: (app) => <span className="text-xs text-white">{app.experience}</span>,
      },
      {
        header: 'Uber Status',
        id: 'uber_status',
        minWidth: '180px',
        sortValue: (app) => app.uber_status,
        cell: (app) => (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {app.uber_status}
          </span>
        ),
      },
      {
        header: 'Approved Setup',
        id: 'approved_setup',
        minWidth: '220px',
        sortValue: (app) => app.approved_weekly_price ?? 0,
        cell: (app) => (
          <div>
            <p className="text-xs font-bold text-white">
              {app.approved_weekly_price != null
                ? `$${Number(app.approved_weekly_price).toFixed(2)} / week`
                : 'Quote pending'}
            </p>
            <p className="mt-1 max-w-[180px] truncate text-[10px] uppercase tracking-widest text-slate-400">
              {app.approved_vehicle || 'Rental details pending'}
            </p>
          </div>
        ),
      },
      {
        header: 'Start',
        id: 'start',
        minWidth: '150px',
        sortValue: (app) => app.rental_subscription_start_date || app.intended_start_date,
        cell: (app) => (
          <span className="text-xs text-slate-400">
            {app.rental_subscription_start_date || app.intended_start_date || 'Not set'}
          </span>
        ),
      },
      {
        header: 'Status',
        id: 'status',
        minWidth: '160px',
        sortValue: (app) => app.status,
        cell: (app) => (
          <span
            className={`rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
              app.status === 'Approved'
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : app.status === 'Paid'
                  ? 'border-[#dfb125]/20 bg-[#dfb125]/10 text-[#dfb125]'
                  : app.status === 'Payment Review'
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                    : app.status === 'Cancelled' || app.status === 'Rejected'
                      ? 'border-red-500/20 bg-red-500/10 text-red-300'
                      : 'border-[#1e3a5f] bg-[#061425] text-slate-400'
            }`}
          >
            {app.status}
          </span>
        ),
      },
      {
        header: 'Date',
        id: 'date',
        minWidth: '130px',
        sortValue: (app) => new Date(app.created_at),
        cell: (app) => (
          <span className="text-xs text-slate-400">
            {new Date(app.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        align: 'right',
        header: 'Actions',
        id: 'actions',
        sortable: false,
        cell: (app) => (
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-all hover:bg-[#dfb125] hover:text-[#061425]"
            title="Review Application"
            onClick={() => setSelectedApplication(app)}
          >
            <FileText className="h-4 w-4" />
          </button>
        ),
      },
    ],
    [setSelectedApplication]
  );

  return (
    <motion.div
      key="applications"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold uppercase tracking-tighter text-white sm:text-4xl">
            Driver <span className="text-brand-gold italic">Applications</span>
          </h2>
          <p className="text-brand-grey font-light">
            Review applications, lock approved pricing, and issue secure payment links from server-derived state.
          </p>
        </div>
        <div className="flex w-full gap-4 md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={applicationSearch}
              onChange={(event) => setApplicationSearch(event.target.value)}
              placeholder="Search drivers..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-6 text-sm text-white outline-none transition-all focus:border-brand-gold md:w-64"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Users, label: 'Pending review', value: statusCounts.pending },
          { icon: ShieldCheck, label: 'Approved quotes', value: statusCounts.approved },
          { icon: CreditCard, label: 'Paid applications', value: statusCounts.paid },
          { icon: CalendarClock, label: 'Payment review', value: statusCounts.paymentReview },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-grey">
                {item.label}
              </p>
              <item.icon className="h-4 w-4 text-brand-gold" />
            </div>
            <p className="mt-4 text-3xl font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <DataTable
        rows={filteredApplications}
        columns={columns}
        getRowId={(app) => app.id}
        minWidth="1320px"
        filters={[
          {
            id: 'status',
            label: 'Status',
            getValue: (app) => app.status,
            options: ['Pending', 'Payment Review', 'Approved', 'Paid', 'Rejected', 'Cancelled'].map(
              (status) => ({ label: status, value: status })
            ),
          },
        ]}
        bulkActions={[
          {
            icon: FileText,
            label: 'Review Selected',
            onClick: (rows) => rows[0] && setSelectedApplication(rows[0]),
          },
          {
            icon: Download,
            label: 'Export Selected',
            onClick: exportApplications,
          },
        ]}
        emptyState={{
          actionLabel: applicationSearch ? 'Clear Search' : undefined,
          description: applicationSearch
            ? 'No driver applications match the current search and status filters.'
            : 'New driver applications will appear here as soon as renters submit the application form.',
          icon: Users,
          onAction: applicationSearch ? () => setApplicationSearch('') : undefined,
          title: applicationSearch ? 'No matching applications' : 'No real applications yet',
        }}
      />
    </motion.div>
  );
}
