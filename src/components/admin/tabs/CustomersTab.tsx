import React from 'react';
import { motion } from 'motion/react';
import { Search, Loader2, AlertCircle, Users, DollarSign } from 'lucide-react';
import { OperationalCustomer } from '../../../types';

interface CustomersTabProps {
  customerSearch: string;
  setCustomerSearch: (val: string) => void;
  isLoadingCustomerDataset: boolean;
  customerHistoryAvailable: boolean;
  deferredCustomerSearch: string;
  customerTotalItems: number;
  customerTotals: { total_billed: number; outstanding_balance: number };
  customerRecords: OperationalCustomer[];
  currentCustomerPage: number;
  customerTotalPages: number;
  isFetching: boolean;
  setCustomerPage: React.Dispatch<React.SetStateAction<number>>;
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

export default function CustomersTab({
  customerSearch,
  setCustomerSearch,
  isLoadingCustomerDataset,
  customerHistoryAvailable,
  deferredCustomerSearch,
  customerTotalItems,
  customerTotals,
  customerRecords,
  currentCustomerPage,
  customerTotalPages,
  isFetching,
  setCustomerPage,
  formatCurrency,
  formatDate,
  operationalHistoryMessage,
}: CustomersTabProps) {
  return (
    <motion.div
      key="customers"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Legacy <span className="text-brand-gold italic">Customers</span>
          </h2>
          <p className="text-brand-grey font-light">
            Private customer records imported from the operational client roster.
          </p>
        </div>
        <div className="flex w-full gap-4 md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-6 text-sm text-white outline-none transition-all focus:border-brand-gold md:w-72"
            />
          </div>
        </div>
      </div>

      {isLoadingCustomerDataset ? (
        renderLoadingPanel('Loading customer history...')
      ) : !customerHistoryAvailable ? (
        renderOperationalUnavailable('Customer history schema is not installed', operationalHistoryMessage)
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                label: deferredCustomerSearch ? 'Matching Customers' : 'Imported Customers',
                value: customerTotalItems,
                helper: deferredCustomerSearch
                  ? 'Records matching the current search'
                  : 'Rows in the private customer roster',
                icon: Users,
              },
              {
                label: 'Visible Billed',
                value: formatCurrency(customerTotals.total_billed),
                helper: 'Linked invoice value on the current page',
                icon: DollarSign,
              },
              {
                label: 'Visible Outstanding',
                value: formatCurrency(customerTotals.outstanding_balance),
                helper: 'Open balances on the current page',
                icon: AlertCircle,
              },
            ].map((card) => (
              <div key={card.label} className="bg-white/5 border border-white/10 p-8 rounded-3xl">
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
                <p className="text-xs text-brand-grey font-light">{card.helper}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Customer
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Contact
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Invoice Activity
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Outstanding
                  </th>
                  <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                    Last Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {customerRecords.map((customer) => (
                  <tr key={customer.id} className="hover:bg-white/5 transition-all">
                    <td className="px-8 py-6">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {customer.full_name}
                        </p>
                        <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                          {customer.staff_number || customer.external_id || 'Legacy record'}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-xs text-white">
                          {customer.email || 'No email on file'}
                        </p>
                        <p className="text-[10px] text-brand-grey">
                          {customer.phone || 'No phone on file'}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {customer.invoice_count} invoices
                        </p>
                        <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                          {formatCurrency(customer.total_billed)} billed
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-white">
                      {formatCurrency(customer.outstanding_balance)}
                    </td>
                    <td className="px-8 py-6 text-xs text-brand-grey">
                      {formatDate(customer.last_invoice_date)}
                    </td>
                  </tr>
                ))}
                {customerRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                    >
                      No customer records matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-white/10 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-brand-grey">
                Page {currentCustomerPage} of {customerTotalPages} •{' '}
                {customerTotalItems} records
                {isFetching ? ' • Updating...' : ''}
              </p>
              <div className="flex w-full gap-3 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                  disabled={currentCustomerPage <= 1 || isFetching}
                  className="flex-1 border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-40 sm:flex-none"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomerPage((page) =>
                      Math.min(customerTotalPages, page + 1)
                    )
                  }
                  disabled={currentCustomerPage >= customerTotalPages || isFetching}
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
