import React from 'react';
import { motion } from 'motion/react';
import { Search, Loader2, AlertCircle, FileText, DollarSign } from 'lucide-react';
import { OperationalInvoice } from '../../../types';

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
  isFetching: boolean;
  setInvoicePage: React.Dispatch<React.SetStateAction<number>>;
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
      with <span className="font-mono text-white">SUPABASE_DB_URL</span>, then run{' '}
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
  isFetching,
  setInvoicePage,
  formatCurrency,
  formatDate,
  operationalHistoryMessage,
}: InvoicesTabProps) {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                label: deferredInvoiceSearch
                  ? 'Matching Invoices'
                  : 'Imported Invoices',
                value: invoiceTotalItems,
                helper: deferredInvoiceSearch
                  ? 'Invoices matching the current search'
                  : 'Rows imported from the workbook export',
                icon: FileText,
              },
              {
                label: 'Visible Balance',
                value: formatCurrency(invoiceTotals.outstanding_balance),
                helper: 'Outstanding balance on the current page',
                icon: AlertCircle,
              },
              {
                label: 'Open on Page',
                value: invoiceTotals.open_count,
                helper: 'Invoices with remaining balance on this page',
                icon: DollarSign,
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
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Invoice
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Customer
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Vehicle
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Amount / Balance
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Invoice Date
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoiceRecords.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-white/5 transition-all"
                  >
                    <td className="px-8 py-6">
                      <div>
                        <p className="text-sm font-bold text-white">
                          #{invoice.external_invoice_number}
                        </p>
                        <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                          {invoice.due_label || 'No due label'}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {invoice.customer_name}
                        </p>
                        <p className="text-[10px] text-brand-grey">
                          {invoice.customer_email || 'No linked email'}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-brand-grey">
                      {invoice.car_registration || 'N/A'}
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {formatCurrency(invoice.amount)}
                        </p>
                        <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                          Balance {formatCurrency(invoice.balance)}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-brand-grey">
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                          invoice.status === 'Paid'
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoiceRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                    >
                      No invoice records matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-white/10 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-brand-grey">
                Page {invoiceCurrentPage} of {invoiceTotalPages} •{' '}
                {invoiceTotalItems} records
                {isFetching ? ' • Updating...' : ''}
              </p>
              <div className="flex w-full gap-3 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}
                  disabled={invoiceCurrentPage <= 1 || isFetching}
                  className="flex-1 border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-40 sm:flex-none"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInvoicePage((page) => Math.min(invoiceTotalPages, page + 1))
                  }
                  disabled={invoiceCurrentPage >= invoiceTotalPages || isFetching}
                  className="flex-1 border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-40 sm:flex-none"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
