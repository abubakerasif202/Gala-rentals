import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  Loader2, 
  CheckCircle2, 
  Info,
  Database
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import * as api from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errorHandling';

export default function MaintenanceTab() {
  const [confirmText, setConfirmText] = useState('');
  const [lastResult, setLastResult] = useState<api.ResetOldApplicantsResponse | null>(null);
  
  const resetMutation = useMutation({
    mutationFn: (options: { dryRun: boolean }) => 
      api.resetOldApplicants({ 
        confirm: confirmText, 
        dryRun: options.dryRun 
      }),
    onSuccess: (data) => {
      setLastResult(data);
      if (!data.dryRun) {
        setConfirmText('');
      }
    }
  });

  const handleReset = (dryRun: boolean) => {
    resetMutation.mutate({ dryRun });
  };

  const CONFIRMATION_PHRASE = "RESET OLD APPLICANTS";
  const isConfirmed = confirmText === CONFIRMATION_PHRASE;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">System Maintenance</h2>
        <p className="text-brand-grey">Manage dangerous system-wide operations and data cleanup.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 space-y-6"
      >
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Danger Zone: Reset Old Applicant Data</h3>
            <p className="text-brand-grey text-sm leading-relaxed">
              This action identifies and permanently deletes "Old" or "Imported" applicant records and their 
              associated rental history. This is typically used to clear out legacy data from initial imports 
              or fleet synchronization snapshots.
            </p>
          </div>
        </div>

        <div className="bg-brand-navy/40 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-brand-gold">
            <Info className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Safe Record Retention</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-brand-grey">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
              Preserves all Car and Fleet records
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
              Preserves Stripe Payment history
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
              Preserves Admin user accounts
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
              Preserves active/manually created data
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-brand-grey uppercase tracking-widest">
            To proceed, please type <span className="text-red-500 underline">{CONFIRMATION_PHRASE}</span>
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type confirmation phrase here..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <button
            onClick={() => handleReset(true)}
            disabled={!isConfirmed || resetMutation.isPending}
            className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetMutation.isPending && resetMutation.variables?.dryRun ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Dry Run (Safety Check)
          </button>
          
          <button
            onClick={() => handleReset(false)}
            disabled={!isConfirmed || resetMutation.isPending}
            className="px-8 py-4 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-500/20 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetMutation.isPending && !resetMutation.variables?.dryRun ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Permanently Delete Data
          </button>
        </div>

        {resetMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm">
            <AlertTriangle className="w-5 h-5" />
            {getApiErrorMessage(resetMutation.error, 'Operation failed')}
          </div>
        )}

        {lastResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl p-6 space-y-4 border ${
              lastResult.dryRun 
                ? 'bg-brand-gold/10 border-brand-gold/20' 
                : 'bg-green-500/10 border-green-500/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {lastResult.dryRun ? (
                  <Database className="w-5 h-5 text-brand-gold" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                <h4 className={`font-bold ${lastResult.dryRun ? 'text-brand-gold' : 'text-green-500'}`}>
                  {lastResult.dryRun ? 'Dry Run Results' : 'Reset Completed'}
                </h4>
              </div>
              <span className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-brand-grey text-[10px] uppercase tracking-wider">Applications</p>
                <p className="text-white text-xl font-bold">
                  {lastResult.dryRun ? lastResult.applicationsMatched : lastResult.deletedApplications}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-brand-grey text-[10px] uppercase tracking-wider">Rentals</p>
                <p className="text-white text-xl font-bold">
                  {lastResult.dryRun ? lastResult.rentalsMatched : lastResult.deletedRentals}
                </p>
              </div>
              {!lastResult.dryRun && (
                <div className="space-y-1">
                  <p className="text-brand-grey text-[10px] uppercase tracking-wider">Preserved Cars</p>
                  <p className="text-white text-xl font-bold">{lastResult.preservedCars}</p>
                </div>
              )}
            </div>
            
            <p className="text-xs text-brand-grey italic">{lastResult.message}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
