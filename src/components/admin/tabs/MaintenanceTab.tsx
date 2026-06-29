import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Database, Download, Loader2, Trash2 } from 'lucide-react';
import axios from 'axios';
import * as api from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errorHandling';
import { getMaintenanceResetLabel } from '../maintenanceResetLabels';

const CONFIRMATION_PHRASE = 'RESET IMPORTED DATA AND FINANCIALS';

const downloadJsonBackup = (payload: Record<string, unknown>) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  link.href = url;
  link.download = `gala-imported-data-reset-backup-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const renderCountGrid = (
  counts: Record<string, number>,
  options: { labelPrefix?: string } = {}
) => (
  <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
    {Object.entries(counts).map(([key, value]) => {
      const label = `${options.labelPrefix || ''}${getMaintenanceResetLabel(key)}`;

      return (
        <div
          key={key}
          className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4"
        >
          <p className="break-words text-[11px] font-semibold uppercase leading-5 tracking-[0.16em] text-brand-grey">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
        </div>
      );
    })}
  </div>
);

export default function MaintenanceTab() {
  const [confirmText, setConfirmText] = useState('');
  const [dryRunToken, setDryRunToken] = useState<string | undefined>();
  const [dryRunResult, setDryRunResult] = useState<api.ImportedDataResetResponse | null>(null);
  const [lastDeletedCounts, setLastDeletedCounts] = useState<Record<string, number> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const dryRunMutation = useMutation({
    mutationFn: () => api.resetImportedDataDryRun(),
    onSuccess: (data) => {
      setDryRunResult(data);
      setDryRunToken(data.dryRunToken);
      setStatusMessage('Dry run complete. Review the counts before resetting.');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      api.resetImportedDataAndFinancials({
        confirm: CONFIRMATION_PHRASE,
        dryRunToken,
        reason: 'Admin maintenance reset',
      }),
    onSuccess: async (data) => {
      setLastDeletedCounts(data.deleted || null);
      setConfirmText('');
      setDryRunToken(undefined);
      setStatusMessage('Reset complete. Counts refreshed from the database.');
      const refreshed = await api.resetImportedDataDryRun();
      setDryRunResult(refreshed);
      setDryRunToken(refreshed.dryRunToken);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportImportedDataReset(),
    onSuccess: (data) => {
      downloadJsonBackup(data);
      setStatusMessage('Backup exported as JSON.');
    },
  });

  const isConfirmed = confirmText === CONFIRMATION_PHRASE;
  const canReset = Boolean(dryRunResult?.dryRun && isConfirmed && dryRunToken);
  const resetDisabledReason = !dryRunToken
    ? 'Run a dry run first so the reset uses the reviewed counts.'
    : !isConfirmed
      ? 'Enter the confirmation phrase exactly to unlock the reset.'
      : null;

  const counts = useMemo(
    () => dryRunResult?.counts || dryRunResult?.deleted || null,
    [dryRunResult],
  );
  const resetFailure = axios.isAxiosError(resetMutation.error)
    ? (resetMutation.error.response?.data as { step?: string; message?: string } | undefined)
    : undefined;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Reset Imported Data & Financials</h2>
        <p className="mt-2 text-brand-grey">
          Reset imported/legacy customers, applications, linked rentals, and local invoice data.
        </p>
      </div>

      <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <AlertTriangle className="mt-1 h-5 w-5 text-red-400" />
          <div className="space-y-2">
            <p className="font-semibold text-white">Danger zone</p>
            <p className="text-sm text-brand-grey">
              This removes imported/legacy customers, imported applications, linked imported rentals,
              and local invoice/financial records. Cars, admin users, and Stripe records are preserved.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">1. Review impact</p>
              <p className="mt-1 text-sm text-brand-grey">Run the dry run and review the database counts before taking action.</p>
            </div>
            <button
              type="button"
              onClick={() => dryRunMutation.mutate()}
              disabled={dryRunMutation.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {dryRunMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Dry Run
            </button>
          </div>

          <div className="space-y-4 rounded-lg border border-brand-gold/20 bg-brand-gold/10 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">2. Export backup</p>
              <p className="mt-1 text-sm text-brand-grey">Download a JSON backup before resetting imported records.</p>
            </div>
            <button
              type="button"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Backup
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="space-y-3">
            <label htmlFor="maintenance-reset-confirmation" className="block text-xs font-semibold uppercase tracking-[0.2em] text-brand-grey">
              3. Enter confirmation phrase
            </label>
            <input
              id="maintenance-reset-confirmation"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-describedby="maintenance-reset-confirmation-helper"
              className="min-h-11 w-full rounded-lg border border-white/10 bg-[#061425] px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-brand-gold"
              placeholder={CONFIRMATION_PHRASE}
            />
            <p id="maintenance-reset-confirmation-helper" className="text-xs leading-5 text-brand-grey">
              Type <span className="font-mono text-white">{CONFIRMATION_PHRASE}</span> exactly after reviewing a dry run.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => resetMutation.mutate()}
              disabled={!canReset || resetMutation.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/45 disabled:text-white/70 sm:w-auto"
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {resetMutation.isPending ? 'Reset Running...' : '4. Reset Imported Data & Financials'}
            </button>
            {(!canReset || resetMutation.isPending) && (
              <p className="text-xs leading-5 text-brand-grey">
                {resetMutation.isPending ? 'Reset is running. Keep this page open until the result banner appears.' : resetDisabledReason}
              </p>
            )}
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/25 bg-green-500/10 p-4 text-sm text-green-100">
          <CheckCircle className="mt-0.5 h-4 w-4 text-green-300" />
          <span>{statusMessage}</span>
        </div>
      )}

      {(dryRunMutation.isError || resetMutation.isError || exportMutation.isError) && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          {getApiErrorMessage(
            dryRunMutation.error || resetMutation.error || exportMutation.error,
            'Request failed',
          )}
          {resetFailure?.step && resetFailure?.message && (
            <div className="mt-2 text-red-100">
              Reset failed while deleting {resetFailure.step.replace(/^delete_/, '').replace(/_/g, ' ')}. Check Render logs for [maintenance-reset].
            </div>
          )}
        </div>
      )}

      {counts && (
        <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-bold text-white">Dry run counts</h3>
            <p className="mt-1 text-sm text-brand-grey">Imported data matched by the maintenance reset criteria.</p>
          </div>
          {renderCountGrid(counts)}
        </section>
      )}

      {lastDeletedCounts && (
        <section className="space-y-4 rounded-lg border border-brand-gold/20 bg-brand-gold/10 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-bold text-white">Deleted counts</h3>
            <p className="mt-1 text-sm text-brand-grey">Rows removed by the last reset run.</p>
          </div>
          {renderCountGrid(lastDeletedCounts, { labelPrefix: 'Deleted ' })}
        </section>
      )}

      {dryRunResult?.criteria && (
        <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-bold text-white">Matching rules</h3>
            <p className="mt-1 text-sm text-brand-grey">Human-readable summary of the records included by the dry run.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            {Object.entries(dryRunResult.criteria).map(([key, value]) => (
              <div key={key} className="grid gap-2 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <p className="text-xs font-semibold uppercase leading-5 tracking-[0.16em] text-brand-gold">
                  {getMaintenanceResetLabel(key)}
                </p>
                <p className="text-sm leading-6 text-brand-grey">{value}</p>
              </div>
            ))}
          </div>
          <details className="rounded-lg border border-white/10 bg-black/20">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-grey">
              Technical JSON
            </summary>
            <pre className="max-h-80 overflow-auto border-t border-white/10 p-4 text-xs leading-6 text-brand-grey">
              {JSON.stringify(dryRunResult.criteria, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}
