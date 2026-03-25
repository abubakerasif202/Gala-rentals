import React from 'react';
import { motion } from 'motion/react';
import { Loader2, RefreshCw, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';
import { Application, Car } from '../../../types';

interface AgreementsTabProps {
  applications: Application[];
  approvedApplications: Application[];
  cars: Car[];
  selected_agreement_application_id: string;
  set_selected_agreement_application_id: (val: string) => void;
  selected_agreement_car_id: string;
  set_selected_agreement_car_id: (val: string) => void;
  selectedAgreementApplication?: Application;
  isGeneratingAgreement: boolean;
  handleGenerateAgreement: () => void;
  canCopyVehicleCheckoutLink: boolean;
  generateCheckoutLinkMutation: UseMutationResult<any, Error, { application_id: string; }, unknown>;
  handleCopyVehicleCheckoutLink: () => void;
  savedAgreements: any[];
  setAgreementModalMode: (mode: 'draft' | 'saved') => void;
  setAgreementContent: (content: string) => void;
  setIsAgreementModalOpen: (val: boolean) => void;
  deleteAgreementMutation: UseMutationResult<any, Error, number, unknown>;
}

export default function AgreementsTab({
  applications,
  approvedApplications,
  cars,
  selected_agreement_application_id,
  set_selected_agreement_application_id,
  selected_agreement_car_id,
  set_selected_agreement_car_id,
  selectedAgreementApplication,
  isGeneratingAgreement,
  handleGenerateAgreement,
  canCopyVehicleCheckoutLink,
  generateCheckoutLinkMutation,
  handleCopyVehicleCheckoutLink,
  savedAgreements,
  setAgreementModalMode,
  setAgreementContent,
  setIsAgreementModalOpen,
  deleteAgreementMutation,
}: AgreementsTabProps) {
  return (
    <motion.div
      key="agreements"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Lease <span className="text-brand-gold italic">Agreements</span>
          </h2>
          <p className="text-brand-grey font-light">
            Generate and manage legally binding rental contracts.
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
              Select Approved Application
            </label>
            <select
              value={selected_agreement_application_id}
              onChange={(e) => {
                const applicationId = e.target.value;
                const nextApplication = applications.find(
                  (app) => app.id === applicationId
                );
                set_selected_agreement_application_id(applicationId);
                set_selected_agreement_car_id(
                  nextApplication?.assigned_car_id
                    ? String(nextApplication.assigned_car_id)
                    : ''
                );
              }}
              className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light appearance-none"
            >
              <option value="">Select a driver...</option>
              {approvedApplications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
              Select Assigned Vehicle
            </label>
            <select
              value={selected_agreement_car_id}
              onChange={(e) => set_selected_agreement_car_id(e.target.value)}
              className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light appearance-none"
            >
              <option value="">Select a car...</option>
              {cars
                .filter((car) =>
                  selectedAgreementApplication?.assigned_car_id
                    ? car.id === selectedAgreementApplication.assigned_car_id
                    : true
                )
                .map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name} ({car.model_year}) - {car.status}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button
              disabled={
                isGeneratingAgreement ||
                !selected_agreement_application_id ||
                !selected_agreement_car_id ||
                selectedAgreementApplication?.status !== 'Paid'
              }
              onClick={handleGenerateAgreement}
              className="bg-brand-gold text-brand-navy h-[58px] font-bold uppercase tracking-widest text-[10px] hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGeneratingAgreement ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generate New Agreement
            </button>
            <button
              disabled={
                !canCopyVehicleCheckoutLink ||
                generateCheckoutLinkMutation.isPending
              }
              onClick={handleCopyVehicleCheckoutLink}
              className="bg-white/5 border border-white/10 text-white h-[58px] font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {generateCheckoutLinkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 text-brand-gold" />
              )}
              Copy Secure Payment Link
            </button>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-brand-grey font-light">
          Secure payment links are signed and time-limited. Approve the
          application first so the assigned vehicle and pricing are locked before
          copying a fresh link.
        </p>
        {selectedAgreementApplication &&
          selectedAgreementApplication.status !== 'Paid' && (
            <p className="mt-2 text-[11px] text-brand-grey font-light">
              Lease agreements unlock after the driver completes the approved
              payment.
            </p>
          )}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Agreement ID
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Driver & Vehicle
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                Generated On
              </th>
              <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {savedAgreements.map((agreement: any) => (
              <tr
                key={agreement.id}
                className="hover:bg-white/5 transition-all group"
              >
                <td className="px-8 py-6 text-xs text-brand-gold font-bold">
                  #{agreement.id.toString().padStart(6, '0')}
                </td>
                <td className="px-8 py-6">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {agreement.applicant_name}
                    </p>
                    <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                      {agreement.car_name}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-6 text-xs text-brand-grey">
                  {new Date(agreement.created_at).toLocaleDateString()}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button
                      className="p-2 bg-white/5 text-brand-grey rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all"
                      onClick={() => {
                        setAgreementModalMode('saved');
                        setAgreementContent(agreement.content);
                        setIsAgreementModalOpen(true);
                      }}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 bg-white/5 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                      onClick={() => {
                        if (window.confirm('Delete this agreement?')) {
                          deleteAgreementMutation.mutate(agreement.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {savedAgreements.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-8 py-12 text-center text-brand-grey text-xs font-light italic"
                >
                  No agreements generated yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
