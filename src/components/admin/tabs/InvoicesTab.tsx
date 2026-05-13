import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Loader2, AlertCircle, FileText, DollarSign, Download } from 'lucide-react';
import { OperationalInvoice } from '../../../types';
import DataTable, { type DataTableColumn } from '../DataTable';
import MetricCard from '../MetricCard';

interface InvoicesTabProps {
  invoiceSearch: string;
  setInvoiceSearch: (val: string) => void;
  isLoadingInvoiceDataset: boolean;
  invoiceHistoryAvailable: boolean;
  deferredInvoiceSearch: string;
  invoiceTotalItems: number;
  invoiceTotals: {
    total_amount: number;
    outstanding_balance: number;
    open_count: number;
  };
  invoiceRecords: OperationalInvoice[];
  invoiceCurrentPage: number;
  invoiceTotalPages: number;
  invoicePageSize: number;
  isFetching: boolean;
  setInvoicePage: React.Dispatch<React.SetStateAction<number>>;
  setInvoicePageSize: React.Dispatch<React.SetStateAction<number>>;
  formatCurrency: (value?: number | string | null) => string;
  formatDate: (value?: string | null) => string;
  operationalHistoryMessage: string;
}

const renderLoadingPanel = (message: string) => (
  <div className="bg-white/5 border border-white/10 rounded-3xl p-10 flex items-center gap-4 text-sm text-brand-grey">
    <Loader2 className="w-5 h-5 animate-spin text-brand-gold" />
    <span>{message}</span>
  </div>
);

const renderOperationalUnavailable = (title: string, operationalHistoryMessage: string) => (
  <div className="bg-white/5 border border-white/10 rounded-3xl p-10 space-y-4">
    <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
      <AlertCircle className="w-5 h-5 text-brand-gold" />
    </div>
    <div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-brand-grey leading-relaxed">
        {operationalHistoryMessage}
      </p>
    </div>
    <div className="bg-brand-navy/60 border border-white/10 rounded-2xl px-5 py-4 text-[11px] text-brand-grey font-light">
      Run <span className="font-mono text-white">npm run migrate:operational-history</span>{' '}
      with <span className="font-mono text-white">DATABASE_URL</span> (preferred, or{' '}
      <span className="font-mono text-white">SUPABASE_DB_URL</span>), then run{' '}
      <span className="font-mono text-white">
        powershell -ExecutionPolicy Bypass -File scripts/import-operational-history-from-workbooks.ps1 -Apply
      </span>
      .
    </div>
  </div>
);

export default function InvoicesTab({
  invoiceSearch,
  setInvoiceSearch,
  isLoadingInvoiceDataset,
  invoiceHistoryAvailable,
  deferredInvoiceSearch,
  invoiceTotalItems,
  invoiceTotals,
  invoiceRecords,
  invoiceCurrentPage,
  invoiceTotalPages,
  invoicePageSize,
  isFetching,
  setInvoicePage,
  setInvoicePageSize,
  formatCurrency,
  formatDate,
  operationalHistoryMessage,
}: InvoicesTabProps) {
  const exportInvoices = (invoices: OperationalInvoice[]) => {
    const headers = [
      'Invoice Number',
      'Customer',
      'Email',
      'Vehicle',
      'Amount',
      'Balance',
      'Invoice Date',
      'Status',
    ];
    const rows = invoices.map((invoice) => [
      invoice.external_invoice_number,
      invoice.customer_name,
      invoice.customer_email || '',
      invoice.car_registration || '',
      invoice.amount,
      invoice.balance,
      invoice.invoice_date,
      invoice.status,
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
    link.download = 'maple-invoices.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<Array<DataTableColumn<OperationalInvoice>>>(
    () => [
      {
        header: 'Invoice',
        id: 'invoice',
        minWidth: '170px',
        sortValue: (invoice) => invoice.external_invoice_number,
        cell: (invoice) => (
          <div>
            <p className="text-sm font-bold text-white">
              #{invoice.external_invoice_number}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              {invoice.due_label || 'No due label'}
            </p>
          </div>
        ),
      },
      {
        header: 'Customer',
        id: 'customer',
        minWidth: '240px',
        sortValue: (invoice) => invoice.customer_name,
        cell: (invoice) => (
          <div>
            <p className="text-sm font-bold text-white">{invoice.customer_name}</p>
            <p className="text-[10px] text-slate-400">
              {invoice.customer_email || 'No linked email'}
            </p>
          </div>
        ),
      },
      {
        header: 'Vehicle',
        id: 'vehicle',
        minWidth: '130px',
        sortValue: (invoice) => invoice.car_registration || '',
        cell: (invoice) => (
          <span className="text-xs text-slate-400">
            {invoice.car_registration || 'N/A'}
          </span>
        ),
      },
      {
        align: 'right',
        header: 'Amount',
        id: 'amount',
        minWidth: '130px',
        sortValue: (invoice) => invoice.amount,
        cell: (invoice) => (
          <span className="text-sm font-bold text-white">
            {formatCurrency(invoice.amount)}
          </span>
        ),
      },
      {
        align: 'right',
        header: 'Balance',
        id: 'balance',
        minWidth: '130px',
        sortValue: (invoice) => invoice.balance,
        cell: (invoice) => (
          <span className="text-sm font-bold text-slate-300">
            {formatCurrency(invoice.balance)}
          </span>
        ),
      },
      {
        header: 'Invoice Date',
        id: 'date',
        minWidth: '150px',
        sortValue: (invoice) => new Date(invoice.invoice_date),
        cell: (invoice) => (
          <span className="text-xs text-slate-400">
            {formatDate(invoice.invoice_date)}
          </span>
        ),
      },
      {
        header: 'Status',
        id: 'status',
        minWidth: '130px',
        sortValue: (invoice) => invoice.status,
        cell: (invoice) => (
          <span
            className={`rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
              invoice.status === 'Paid'
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : 'border-[#dfb125]/20 bg-[#dfb125]/10 text-[#dfb125]'
            }`}
          >
            {invoice.status}
          </span>
        ),
      },
    ],
    [formatCurrency, formatDate]
  );

  return (
    <motion.div
      key="invoices"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Invoice <span className="text-brand-gold italic">History</span>
          </h2>
          <p className="text-brand-grey font-light">
            Imported legacy invoice history for operational review and
            reconciliation.
          </p>
        </div>
        <div className="flex w-full gap-4 md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder="Search invoices..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-6 text-sm text-white outline-none transition-all focus:border-brand-gold md:w-72"
            />
          </div>
        </div>
      </div>

      {isLoadingInvoiceDataset ? (
        renderLoadingPanel('Loading invoice history...')
      ) : !invoiceHistoryAvailable ? (
        renderOperationalUnavailable(
          'Invoice history schema is not installed',
          operationalHistoryMessage
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <MetricCard
              helper={
                deferredInvoiceSearch
                  ? 'Invoices matching the current search'
                  : 'Rows imported from the workbook export'
              }
              icon={FileText}
              label={deferredInvoiceSearch ? 'Matching Invoices' : 'Imported Invoices'}
              numericValue={invoiceTotalItems}
              value={invoiceTotalItems}
            />
            <MetricCard
              helper="Outstanding balance on the current page"
              icon={AlertCircle}
              label="Visible Balance"
              numericValue={invoiceTotals.outstanding_balance}
              value={formatCurrency(invoiceTotals.outstanding_balance)}
            />
            <MetricCard
              helper="Invoices with remaining balance on this page"
              icon={DollarSign}
              label="Open on Page"
              numericValue={invoiceTotals.open_count}
              value={invoiceTotals.open_count}
            />
          </div>

          <DataTable
            rows={invoiceRecords}
            columns={columns}
            getRowId={(invoice) => invoice.id}
            minWidth="1120px"
            filters={[
              {
                id: 'status',
                label: 'Status',
                getValue: (invoice) => invoice.status,
                options: ['Open', 'Paid'].map((status) => ({ label: status, value: status })),
              },
            ]}
            bulkActions={[
              {
                icon: Download,
                label: 'Export Selected',
                onClick: exportInvoices,
              },
            ]}
            pagination={{
              isFetching,
              mode: 'server',
              onPageChange: setInvoicePage,
              onPageSizeChange: (pageSize) => {
                setInvoicePageSize(pageSize);
                setInvoicePage(1);
              },
              page: invoiceCurrentPage,
              pageSize: invoicePageSize,
              pageSizeOptions: [10, 25, 50, 100],
              totalItems: invoiceTotalItems,
              totalPages: invoiceTotalPages,
            }}
            emptyState={{
              actionLabel: invoiceSearch ? 'Clear Search' : undefined,
              description: invoiceSearch
                ? 'No invoice records match the current search and status filters.'
                : 'Imported invoice history will appear here after operational history is loaded.',
              icon: FileText,
              onAction: invoiceSearch ? () => setInvoiceSearch('') : undefined,
              title: invoiceSearch ? 'No matching invoices' : 'No invoices yet',
            }}
          />
        </>
      )}
    </motion.div>
  );
}
