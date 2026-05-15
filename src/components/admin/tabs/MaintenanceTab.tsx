import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Database, Download, Loader2, Trash2 } from 'lucide-react';
import axios from 'axios';
import * as api from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errorHandling';

const CONFIRMATION_PHRASE = 'RESET IMPORTED DATA AND FINANCIALS';

export default function MaintenanceTab() {
  const [confirmText, setConfirmText] = useState('');
  const [dryRunToken, setDryRunToken] = useState<string | undefined>();
  const [dryRunResult, setDryRunResult] = useState<api.ImportedDataResetResponse | null>(null);
  const [exportPayload, setExportPayload] = useState<Record<string, unknown> | null>(null);

  const dryRunMutation = useMutation({
    mutationFn: () => api.resetImportedDataDryRun({ confirm: CONFIRMATION_PHRASE }),
    onSuccess: (data) => {
      setDryRunResult(data);
      setDryRunToken(data.dryRunToken);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      api.resetImportedDataAndFinancials({
        confirm: CONFIRMATION_PHRASE,
        dryRunToken,
        reason: 'Admin maintenance reset',
      }),
    onSuccess: (data) => {
      setDryRunResult(data);
      setConfirmText('');
      setDryRunToken(undefined);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportImportedDataReset(),
    onSuccess: (data) => setExportPayload(data),
  });

  const isConfirmed = confirmText === CONFIRMATION_PHRASE;
  const canReset = Boolean(dryRunResult?.dryRun && isConfirmed && dryRunToken);

  const counts = useMemo(
    () => dryRunResult?.counts || dryRunResult?.deleted || null,
    [dryRunResult],
  );
  const resetFailure = axios.isAxiosError(resetMutation.error)
    ? (resetMutation.error.response?.data as { step?: string; message?: string } | undefined)
    : undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Reset Imported Data & Financials</h2>
        <p className="mt-2 text-brand-grey">
          Reset imported/legacy customers, applications, linked rentals, and local invoice data.
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6">
        <div className="flex items-start gap-4">
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => dryRunMutation.mutate()}
          disabled={dryRunMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {dryRunMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Dry Run
        </button>
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Backup
        </button>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-widest text-brand-grey">
          Confirmation phrase
        </label>
        <input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
          placeholder={CONFIRMATION_PHRASE}
        />
      </div>

      <button
        type="button"
        onClick={() => resetMutation.mutate()}
        disabled={!canReset || resetMutation.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Reset Imported Data
      </button>

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
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
          {Object.entries(counts).map(([key, value]) => (
            <div key={key}>
              <p className="text-xs uppercase tracking-widest text-brand-grey">{key}</p>
              <p className="text-2xl font-bold text-white">{String(value)}</p>
            </div>
          ))}
        </div>
      )}

      {dryRunResult?.criteria && (
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-brand-grey">
          {JSON.stringify(dryRunResult.criteria, null, 2)}
        </pre>
      )}

      {exportPayload && (
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-brand-grey">
          {JSON.stringify(exportPayload, null, 2)}
        </pre>
      )}
    </div>
  );
}
