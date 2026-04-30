import React from 'react';
import { motion } from 'motion/react';
import { Search, FileText } from 'lucide-react';
import { Application } from '../../../types';

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
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Driver <span className="text-brand-gold italic">Applications</span>
          </h2>
          <p className="text-brand-grey font-light">
            Manage and review incoming driver requests.
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

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Driver
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Experience
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Status
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Date
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredApplications.map((app) => (
              <tr
                key={app.id}
                className="hover:bg-white/5 transition-all group"
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center text-brand-gold font-bold text-sm">
                      {app.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{app.name}</p>
                      <p className="text-[10px] text-brand-grey">
                        {app.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div>
                    <p className="text-xs text-white">{app.experience}</p>
                    <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                      {app.uber_status}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-6">
                      <span
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                          app.status === 'Approved'
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : app.status === 'Paid'
                            ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
                            : app.status === 'Payment Review'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : app.status === 'Cancelled'
                            ? 'bg-red-500/10 text-red-300 border-red-500/20'
                            : app.status === 'Rejected'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-brand-navy text-brand-grey border-white/10'
                        }`}
                  >
                    {app.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-xs text-brand-grey">
                  {new Date(app.created_at).toLocaleDateString()}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button
                      className="p-2 bg-white/5 text-brand-grey rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all"
                      title="Review Application"
                      onClick={() => setSelectedApplication(app)}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredApplications.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                >
                  No applications matched the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
