import React, { ChangeEvent, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Printer, RotateCcw } from 'lucide-react';
import { Application } from '../../../types';

type ResponsibilityType = 'responsible' | 'new-owner' | 'previous-owner';
type WitnessQualification = 'Legal practitioner' | 'Justice of the Peace';

interface TollStatDecForm {
  declarantFullName: string;
  organisationName: string;
  organisationAddress: string;
  organisationPhone: string;
  tollNoticeNumber: string;
  vehicleRegistration: string;
  tollNoticeEnclosed: boolean;
  nomineeSurnameOrOrganisation: string;
  nomineeGivenNames: string;
  nomineeDateOfBirth: string;
  nomineeMailingAddress: string;
  nomineeSuburb: string;
  nomineeState: string;
  nomineePostcode: string;
  nomineeCountry: string;
  nomineePhone: string;
  nomineeOrganisationNumber: string;
  responsibilityType: ResponsibilityType;
  newOwnerFromDate: string;
  previousOwnerUntilDate: string;
  declaredAt: string;
  declarationDate: string;
  authorisedWitnessName: string;
  witnessQualification: WitnessQualification;
  jpNumber: string;
  sawFace: boolean;
  knownPerson12Months: boolean;
  confirmedIdentityUsingId: boolean;
  idDocumentReliedOn: string;
  witnessDate: string;
}

interface TollStatDecTabProps {
  applications: Application[];
}

const emptyForm: TollStatDecForm = {
  declarantFullName: '',
  organisationName: 'Maple Rentals',
  organisationAddress: '',
  organisationPhone: '',
  tollNoticeNumber: '',
  vehicleRegistration: '',
  tollNoticeEnclosed: false,
  nomineeSurnameOrOrganisation: '',
  nomineeGivenNames: '',
  nomineeDateOfBirth: '',
  nomineeMailingAddress: '',
  nomineeSuburb: '',
  nomineeState: 'NSW',
  nomineePostcode: '',
  nomineeCountry: 'Australia',
  nomineePhone: '',
  nomineeOrganisationNumber: '',
  responsibilityType: 'responsible',
  newOwnerFromDate: '',
  previousOwnerUntilDate: '',
  declaredAt: '',
  declarationDate: '',
  authorisedWitnessName: '',
  witnessQualification: 'Justice of the Peace',
  jpNumber: '',
  sawFace: false,
  knownPerson12Months: false,
  confirmedIdentityUsingId: false,
  idDocumentReliedOn: '',
  witnessDate: '',
};

const requiredFields: Array<keyof TollStatDecForm> = [
  'tollNoticeNumber',
  'vehicleRegistration',
  'declarantFullName',
  'organisationName',
  'nomineeSurnameOrOrganisation',
  'nomineeMailingAddress',
  'declarationDate',
];

const fieldLabels: Partial<Record<keyof TollStatDecForm, string>> = {
  tollNoticeNumber: 'Toll notice number',
  vehicleRegistration: 'Vehicle registration',
  declarantFullName: 'Declarant full name',
  organisationName: 'Organisation name',
  nomineeSurnameOrOrganisation: 'Nominee surname or organisation',
  nomineeMailingAddress: 'Nominee mailing address',
  declarationDate: 'Declaration date',
};

const splitApplicantName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      givenNames: '',
      surnameOrOrganisation: parts[0] || '',
    };
  }

  return {
    givenNames: parts.slice(0, -1).join(' '),
    surnameOrOrganisation: parts[parts.length - 1],
  };
};

const extractRegistrationCandidate = (application: Application) => {
  const candidates = [application.approved_vehicle, application.weekly_budget].filter(Boolean);

  for (const candidate of candidates) {
    const explicitMatch = candidate?.match(/\b(?:rego|registration|plate)\s*[:#-]?\s*([A-Z0-9 -]{3,10})\b/i);

    if (explicitMatch?.[1]) {
      return explicitMatch[1].trim().toUpperCase();
    }
  }

  return '';
};

const splitAddress = (address: string) => {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const lastPart = parts[parts.length - 1] || '';
  const statePostcode = lastPart.match(/\b([A-Z]{2,3})\s+(\d{4})\b/i);

  return {
    street: parts.slice(0, statePostcode ? -1 : undefined).join(', ') || address,
    suburb: parts.length > 1 ? parts[parts.length - 2] || '' : '',
    state: statePostcode?.[1]?.toUpperCase() || 'NSW',
    postcode: statePostcode?.[2] || '',
  };
};

const display = (value: string) => value.trim() || ' ';

const checkbox = (checked: boolean) => (checked ? '[x]' : '[ ]');

export default function TollStatDecTab({ applications }: TollStatDecTabProps) {
  const [form, setForm] = useState<TollStatDecForm>(emptyForm);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');

  const missingRequiredFields = useMemo(
    () => requiredFields.filter((field) => !String(form[field]).trim()),
    [form]
  );

  const updateField = <K extends keyof TollStatDecForm>(field: K, value: TollStatDecForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleTextChange =
    (field: keyof TollStatDecForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      updateField(field, event.target.value as never);
    };

  const handleApplicationSelect = (applicationId: string) => {
    setSelectedApplicationId(applicationId);

    const application = applications.find((item) => item.id === applicationId);

    if (!application) {
      return;
    }

    const applicantName = splitApplicantName(application.name);
    const applicantAddress = splitAddress(application.address || '');
    const registration = extractRegistrationCandidate(application);

    setForm((current) => ({
      ...current,
      nomineeGivenNames: applicantName.givenNames || current.nomineeGivenNames,
      nomineeSurnameOrOrganisation:
        applicantName.surnameOrOrganisation || current.nomineeSurnameOrOrganisation,
      nomineePhone: application.phone || current.nomineePhone,
      nomineeMailingAddress: applicantAddress.street || current.nomineeMailingAddress,
      nomineeSuburb: applicantAddress.suburb || current.nomineeSuburb,
      nomineeState: applicantAddress.state || current.nomineeState,
      nomineePostcode: applicantAddress.postcode || current.nomineePostcode,
      vehicleRegistration: registration || current.vehicleRegistration,
    }));
  };

  const handleReset = () => {
    setSelectedApplicationId('');
    setForm(emptyForm);
  };

  const handlePrint = () => {
    window.print();
  };

  const isMissing = (field: keyof TollStatDecForm) => !String(form[field]).trim();
  const inputClass = (field: keyof TollStatDecForm) =>
    `w-full rounded-xl border bg-brand-navy px-4 py-3 text-sm text-white outline-none transition-all focus:border-brand-gold ${
      isMissing(field) && requiredFields.includes(field)
        ? 'border-amber-400/60'
        : 'border-white/10'
    }`;

  const Field = ({
    label,
    field,
    type = 'text',
    placeholder,
  }: {
    label: string;
    field: keyof TollStatDecForm;
    type?: string;
    placeholder?: string;
  }) => (
    <label className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
        {label}
      </span>
      <input
        type={type}
        value={String(form[field])}
        onChange={handleTextChange(field)}
        placeholder={placeholder}
        className={inputClass(field)}
      />
    </label>
  );

  const TextAreaField = ({
    label,
    field,
    rows = 3,
  }: {
    label: string;
    field: keyof TollStatDecForm;
    rows?: number;
  }) => (
    <label className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
        {label}
      </span>
      <textarea
        value={String(form[field])}
        onChange={handleTextChange(field)}
        rows={rows}
        className={`${inputClass(field)} resize-y`}
      />
    </label>
  );

  return (
    <motion.div
      key="toll-stat-dec"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }

            html,
            body,
            #root {
              background: #fff !important;
            }

            body * {
              visibility: hidden !important;
            }

            aside,
            .no-print {
              display: none !important;
            }

            .toll-print-area,
            .toll-print-area * {
              visibility: visible !important;
            }

            .toll-print-area {
              position: absolute !important;
              inset: 0 auto auto 0 !important;
              width: 190mm !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              color: #000 !important;
              box-shadow: none !important;
              border: 0 !important;
              font-size: 9.5pt !important;
            }

            .toll-print-section {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      <div className="no-print flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-2 text-4xl font-bold uppercase tracking-tighter text-white">
            Toll <span className="text-brand-gold italic">Stat Dec</span>
          </h2>
          <p className="max-w-3xl font-light text-brand-grey">
            Prepare NSW toll notice statutory declarations for company nominations.
            V1 uses local browser state only and does not save records.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4 text-brand-gold" />
            Clear / Reset
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-3 rounded-xl bg-brand-gold px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-brand-navy transition-all hover:bg-brand-gold-light"
          >
            <Printer className="h-4 w-4" />
            Print Declaration
          </button>
        </div>
      </div>

      <div className="no-print rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-bold">
              Check all details carefully before signing. A false or misleading declaration may
              result in penalties or prosecution.
            </p>
            {missingRequiredFields.length > 0 && (
              <p className="mt-2 text-xs text-amber-100/80">
                Missing key fields:{' '}
                {missingRequiredFields.map((field) => fieldLabels[field]).join(', ')}.
                Printing is still available.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(720px,1.1fr)]">
        <div className="no-print space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Auto-fill
            </h3>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                Auto-fill from application
              </span>
              <select
                value={selectedApplicationId}
                onChange={(event) => handleApplicationSelect(event.target.value)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-brand-navy px-4 py-3 text-sm text-white outline-none transition-all focus:border-brand-gold"
              >
                <option value="">Select an application...</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name} ({application.email})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-[11px] font-light text-brand-grey">
              Auto-fill uses applicant name, phone, address, and explicit rego text if available.
              It does not guess a registration number from a vehicle model.
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Company / Declarant
            </h3>
            <div className="grid gap-4">
              <Field label="Full name of person completing form" field="declarantFullName" />
              <Field label="Organisation name" field="organisationName" />
              <TextAreaField label="Organisation address" field="organisationAddress" rows={3} />
              <Field label="Organisation phone number" field="organisationPhone" />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Toll Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Toll Notice number" field="tollNoticeNumber" />
              <Field label="Vehicle registration number" field="vehicleRegistration" />
            </div>
            <label className="mt-5 flex items-start gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={form.tollNoticeEnclosed}
                onChange={(event) => updateField('tollNoticeEnclosed', event.target.checked)}
                className="mt-1 h-4 w-4 accent-brand-gold"
              />
              Toll Notice has been enclosed
            </label>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Responsible Person / Nominee
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Surname or organisation name" field="nomineeSurnameOrOrganisation" />
              <Field label="Given name(s)" field="nomineeGivenNames" />
              <Field label="Date of birth" field="nomineeDateOfBirth" type="date" />
              <Field label="Phone number" field="nomineePhone" />
              <TextAreaField label="Mailing address" field="nomineeMailingAddress" rows={3} />
              <div className="grid gap-4">
                <Field label="Suburb" field="nomineeSuburb" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State" field="nomineeState" />
                  <Field label="Postcode" field="nomineePostcode" />
                </div>
              </div>
              <Field label="Country" field="nomineeCountry" />
              <Field label="Organisation ABN/ACN if applicable" field="nomineeOrganisationNumber" />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Responsibility Type
            </h3>
            <div className="space-y-4 text-sm text-white">
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={form.responsibilityType === 'responsible'}
                  onChange={() => updateField('responsibilityType', 'responsible')}
                  className="mt-1 accent-brand-gold"
                />
                Was the driver, person or organisation responsible for toll
              </label>
              <label className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={form.responsibilityType === 'new-owner'}
                    onChange={() => updateField('responsibilityType', 'new-owner')}
                    className="mt-1 accent-brand-gold"
                  />
                  Was the new owner from
                </span>
                <input
                  type="date"
                  value={form.newOwnerFromDate}
                  onChange={handleTextChange('newOwnerFromDate')}
                  className="rounded-xl border border-white/10 bg-brand-navy px-4 py-3 text-sm text-white outline-none transition-all focus:border-brand-gold"
                />
              </label>
              <label className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={form.responsibilityType === 'previous-owner'}
                    onChange={() => updateField('responsibilityType', 'previous-owner')}
                    className="mt-1 accent-brand-gold"
                  />
                  Was the previous owner until
                </span>
                <input
                  type="date"
                  value={form.previousOwnerUntilDate}
                  onChange={handleTextChange('previousOwnerUntilDate')}
                  className="rounded-xl border border-white/10 bg-brand-navy px-4 py-3 text-sm text-white outline-none transition-all focus:border-brand-gold"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-white">
              Declaration & Witness
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Declared at place" field="declaredAt" />
              <Field label="Declaration date" field="declarationDate" type="date" />
              <Field label="Authorised witness name" field="authorisedWitnessName" />
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                  Qualification
                </span>
                <select
                  value={form.witnessQualification}
                  onChange={handleTextChange('witnessQualification')}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-brand-navy px-4 py-3 text-sm text-white outline-none transition-all focus:border-brand-gold"
                >
                  <option value="Legal practitioner">Legal practitioner</option>
                  <option value="Justice of the Peace">Justice of the Peace</option>
                </select>
              </label>
              <Field label="JP number" field="jpNumber" />
              <Field label="Witness date" field="witnessDate" type="date" />
              <TextAreaField label="ID document relied on" field="idDocumentReliedOn" rows={2} />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-white">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.sawFace}
                  onChange={(event) => updateField('sawFace', event.target.checked)}
                  className="mt-1 h-4 w-4 accent-brand-gold"
                />
                Witness saw the face of the person making the declaration
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.knownPerson12Months}
                  onChange={(event) => updateField('knownPerson12Months', event.target.checked)}
                  className="mt-1 h-4 w-4 accent-brand-gold"
                />
                Witness has known the person for at least 12 months
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.confirmedIdentityUsingId}
                  onChange={(event) => updateField('confirmedIdentityUsingId', event.target.checked)}
                  className="mt-1 h-4 w-4 accent-brand-gold"
                />
                Witness confirmed identity using an identification document
              </label>
            </div>
          </section>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-2xl sm:p-6">
          <article className="toll-print-area mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-8 text-black shadow-2xl">
            <header className="border-b-2 border-black pb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em]">
                OFFICIAL: Sensitive - Personal (when completed)
              </p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black uppercase leading-tight">
                    Tolling Notice Statutory Declaration - Companies
                  </h1>
                  <p className="mt-1 text-xs">
                    Catalogue No. 45071726 | Form No. 1672
                  </p>
                </div>
                <div className="w-36 border-2 border-black p-2 text-center text-[10px] font-bold uppercase">
                  Office use only
                  <div className="mt-8 border-t border-black pt-1 font-normal">Reference</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-[11px] leading-snug">
                <p>
                  Use this declaration to nominate the person or organisation responsible for
                  the toll trip. The original Toll Notice or a copy must be enclosed.
                </p>
                <p>
                  The completed form must be received at least 7 days before the due date.
                  False or misleading declarations may lead to penalty or criminal prosecution.
                </p>
              </div>
            </header>

            <section className="toll-print-section mt-4 grid grid-cols-2 gap-3">
              <div className="border border-black p-2">
                <p className="text-[9px] font-bold uppercase">Toll Notice number</p>
                <p className="mt-2 min-h-6 text-sm font-bold">{display(form.tollNoticeNumber)}</p>
              </div>
              <div className="border border-black p-2">
                <p className="text-[9px] font-bold uppercase">Vehicle registration number</p>
                <p className="mt-2 min-h-6 text-sm font-bold">{display(form.vehicleRegistration)}</p>
              </div>
              <div className="col-span-2 border border-black p-2 text-sm">
                {checkbox(form.tollNoticeEnclosed)} Original Toll Notice or copy enclosed
              </div>
            </section>

            <section className="toll-print-section mt-4 border border-black">
              <h2 className="bg-black px-3 py-1 text-xs font-bold uppercase text-white">
                Company / Declarant
              </h2>
              <div className="grid grid-cols-2 gap-px bg-black text-xs">
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Full name</p>
                  <p className="mt-1 min-h-5">{display(form.declarantFullName)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Organisation</p>
                  <p className="mt-1 min-h-5">{display(form.organisationName)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Organisation address</p>
                  <p className="mt-1 min-h-10 whitespace-pre-wrap">
                    {display(form.organisationAddress)}
                  </p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Phone</p>
                  <p className="mt-1 min-h-5">{display(form.organisationPhone)}</p>
                </div>
              </div>
            </section>

            <section className="toll-print-section mt-4 border border-black">
              <h2 className="bg-black px-3 py-1 text-xs font-bold uppercase text-white">
                Responsible Person / Nominee
              </h2>
              <div className="grid grid-cols-4 gap-px bg-black text-xs">
                <div className="col-span-2 bg-white p-2">
                  <p className="font-bold uppercase">Surname or organisation name</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeSurnameOrOrganisation)}</p>
                </div>
                <div className="col-span-2 bg-white p-2">
                  <p className="font-bold uppercase">Given name(s)</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeGivenNames)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Date of birth</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeDateOfBirth)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Phone</p>
                  <p className="mt-1 min-h-5">{display(form.nomineePhone)}</p>
                </div>
                <div className="col-span-2 bg-white p-2">
                  <p className="font-bold uppercase">ABN/ACN if applicable</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeOrganisationNumber)}</p>
                </div>
                <div className="col-span-4 bg-white p-2">
                  <p className="font-bold uppercase">Mailing address</p>
                  <p className="mt-1 min-h-8 whitespace-pre-wrap">
                    {display(form.nomineeMailingAddress)}
                  </p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Suburb</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeSuburb)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">State</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeState)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Postcode</p>
                  <p className="mt-1 min-h-5">{display(form.nomineePostcode)}</p>
                </div>
                <div className="bg-white p-2">
                  <p className="font-bold uppercase">Country</p>
                  <p className="mt-1 min-h-5">{display(form.nomineeCountry)}</p>
                </div>
              </div>
            </section>

            <section className="toll-print-section mt-4 border border-black p-3 text-xs">
              <h2 className="mb-2 text-xs font-bold uppercase">Responsibility type</h2>
              <div className="grid gap-1">
                <p>
                  {checkbox(form.responsibilityType === 'responsible')} Was the driver, person or
                  organisation responsible for toll
                </p>
                <p>
                  {checkbox(form.responsibilityType === 'new-owner')} Was the new owner from{' '}
                  <span className="inline-block min-w-28 border-b border-black px-2">
                    {display(form.newOwnerFromDate)}
                  </span>
                </p>
                <p>
                  {checkbox(form.responsibilityType === 'previous-owner')} Was the previous owner
                  until{' '}
                  <span className="inline-block min-w-28 border-b border-black px-2">
                    {display(form.previousOwnerUntilDate)}
                  </span>
                </p>
              </div>
            </section>

            <section className="toll-print-section mt-4 border border-black p-3 text-xs">
              <h2 className="mb-2 text-xs font-bold uppercase">Declaration</h2>
              <p className="leading-snug">
                I, <span className="font-bold">{display(form.declarantFullName)}</span>, of{' '}
                <span className="font-bold">{display(form.organisationName)}</span>, declare that
                the information provided in this statutory declaration is true and correct and
                nominates the person or organisation responsible for the toll trip.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="font-bold uppercase">Declared at</p>
                  <p className="mt-1 border-b border-black pb-1">{display(form.declaredAt)}</p>
                </div>
                <div>
                  <p className="font-bold uppercase">Date</p>
                  <p className="mt-1 border-b border-black pb-1">{display(form.declarationDate)}</p>
                </div>
                <div>
                  <p className="font-bold uppercase">Declarant signature</p>
                  <p className="mt-6 border-b border-black pb-1">&nbsp;</p>
                </div>
              </div>
            </section>

            <section className="toll-print-section mt-4 border border-black p-3 text-xs">
              <h2 className="mb-2 text-xs font-bold uppercase">Authorised Witness</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold uppercase">Witness name</p>
                  <p className="mt-1 border-b border-black pb-1">
                    {display(form.authorisedWitnessName)}
                  </p>
                </div>
                <div>
                  <p className="font-bold uppercase">Qualification</p>
                  <p className="mt-1 border-b border-black pb-1">
                    {display(form.witnessQualification)}
                  </p>
                </div>
                <div>
                  <p className="font-bold uppercase">JP number</p>
                  <p className="mt-1 border-b border-black pb-1">{display(form.jpNumber)}</p>
                </div>
                <div>
                  <p className="font-bold uppercase">Witness date</p>
                  <p className="mt-1 border-b border-black pb-1">{display(form.witnessDate)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-1">
                <p>{checkbox(form.sawFace)} I saw the face of the person making the declaration.</p>
                <p>
                  {checkbox(form.knownPerson12Months)} I have known the person for at least 12
                  months.
                </p>
                <p>
                  {checkbox(form.confirmedIdentityUsingId)} I confirmed the person's identity using
                  an identification document.
                </p>
                <p>
                  ID document relied on:{' '}
                  <span className="inline-block min-w-72 border-b border-black px-2">
                    {display(form.idDocumentReliedOn)}
                  </span>
                </p>
              </div>
              <div className="mt-5">
                <p className="font-bold uppercase">Witness signature</p>
                <p className="mt-6 border-b border-black pb-1">&nbsp;</p>
              </div>
            </section>

            <footer className="mt-4 grid grid-cols-[1fr_auto] gap-4 border-t-2 border-black pt-3 text-[10px] leading-snug">
              <div>
                <p className="font-bold uppercase">Return address</p>
                <p>
                  Toll Compliance Management
                  <br />
                  Locked Bag 5004
                  <br />
                  Parramatta NSW 2124
                </p>
              </div>
              <p className="self-end text-right font-bold uppercase">
                OFFICIAL: Sensitive - Personal
                <br />
                (when completed)
              </p>
            </footer>
          </article>
        </div>
      </div>
    </motion.div>
  );
}
