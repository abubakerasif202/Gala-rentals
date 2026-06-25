import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Upload, User, FileText } from 'lucide-react';
import * as z from 'zod';
import Seo from '../components/Seo';
import { submitApplication } from '../lib/api';
import { getApiErrorMessage } from '../lib/errorHandling';
import {
  APPLICATION_DOCUMENT_CONTENT_TYPES,
  APPLICATION_IMAGE_CONTENT_TYPES,
  AUSTRALIAN_MOBILE_REGEX,
  MAX_APPLICATION_UPLOAD_BYTES,
  getTodayInAustralia,
  isTodayOrFutureAustraliaDate,
  isFutureAustraliaDate,
  isValidDateOnly,
  normalizeApplicationEmail,
  normalizeAustralianMobile,
} from '../../shared/applicationSubmission';

const MAX_UPLOAD_SIZE_MB = Math.floor(MAX_APPLICATION_UPLOAD_BYTES / (1024 * 1024));

const requiredDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isValidDateOnly, `${label} must be a valid date`);

const applicationSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required'),
  date_of_birth: requiredDate('Date of birth'),
  phone: z
    .string()
    .transform(normalizeAustralianMobile)
    .pipe(z.string().regex(AUSTRALIAN_MOBILE_REGEX, 'Valid Australian mobile number required')),
  email: z
    .string()
    .transform(normalizeApplicationEmail)
    .pipe(z.string().email('Invalid email address')),
  address: z.string().trim().min(5, 'Residential address is required'),
  licence_state: z.string().trim().min(1, 'Licence state is required'),
  license_number: z.string().trim().min(5, 'Licence number is required'),
  license_expiry: requiredDate('Licence expiry').refine(
    (value) => isFutureAustraliaDate(value, getTodayInAustralia()),
    'Licence must not be expired',
  ),
  uber_status: z.enum(['Active', 'Applying', 'Not Yet Registered']),
  experience: z.enum(['New Driver', 'Less than 1 year', '1-3 years', '3+ years']),
  preferred_vehicle: z.string().trim().optional().transform((value) => value || ''),
  preferred_category: z.enum(['Economy', 'SUV', 'Luxury', 'People Mover']).optional(),
  intended_start_date: requiredDate('Preferred start date').refine(
    (value) => isTodayOrFutureAustraliaDate(value, getTodayInAustralia()),
    'Start date must be today or later',
  ),
  weekly_budget: z.string().trim().optional().transform((value) => value || ''),
  rental_duration_weeks: z
    .preprocess((value) => (value === '' || value == null ? undefined : value), z.coerce.number().int().positive().optional())
    .optional(),
  driving_history_notes: z.string().trim().optional().transform((value) => value || ''),
  rental_notes: z.string().trim().optional().transform((value) => value || ''),
  agreement_accepted: z.boolean().refine((value) => value, 'You must accept the rental agreement'),
  agreement_signature: z.string().trim().min(2, 'Signature is required'),
});

const requiredImageSchema = z
  .custom<File>((value) => value instanceof File, { message: 'File is required' })
  .refine((file) => APPLICATION_IMAGE_CONTENT_TYPES.includes(file.type as (typeof APPLICATION_IMAGE_CONTENT_TYPES)[number]), 'Please upload a JPG or PNG')
  .refine((file) => file.size <= MAX_APPLICATION_UPLOAD_BYTES, `Please upload a file smaller than ${MAX_UPLOAD_SIZE_MB} MB`);

const requiredDocumentSchema = z
  .custom<File>((value) => value instanceof File, { message: 'File is required' })
  .refine((file) => APPLICATION_DOCUMENT_CONTENT_TYPES.includes(file.type as (typeof APPLICATION_DOCUMENT_CONTENT_TYPES)[number]), 'Please upload a JPG, PNG, or PDF')
  .refine((file) => file.size <= MAX_APPLICATION_UPLOAD_BYTES, `Please upload a file smaller than ${MAX_UPLOAD_SIZE_MB} MB`);

type FormState = z.input<typeof applicationSchema> & {
  license_photo: File | null;
  license_back_photo: File | null;
  proof_of_address_document: File | null;
  additional_document: File | null;
};

const initialState: FormState = {
  name: '',
  date_of_birth: '',
  phone: '',
  email: '',
  address: '',
  licence_state: 'NSW',
  license_number: '',
  license_expiry: '',
  uber_status: 'Active',
  experience: 'New Driver',
  preferred_vehicle: '',
  preferred_category: 'Economy',
  intended_start_date: '',
  weekly_budget: '',
  rental_duration_weeks: 4,
  driving_history_notes: '',
  rental_notes: '',
  agreement_accepted: false,
  agreement_signature: '',
  license_photo: null,
  license_back_photo: null,
  proof_of_address_document: null,
  additional_document: null,
};

const steps = [
  { id: 1, label: 'Personal' },
  { id: 2, label: 'Driver' },
  { id: 3, label: 'Preference' },
  { id: 4, label: 'Documents' },
  { id: 5, label: 'Review' },
] as const;

const fieldClass =
  'focus-ring-dark w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold [color-scheme:dark]';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey';
const applicationFieldId = (field: string) => `application-${field}`;
const applicationErrorId = (field: string) => `${applicationFieldId(field)}-error`;

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} className="text-[11px] font-semibold text-red-300">{message}</p>;
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-brand-grey">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function Apply() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);

  const stepSchema = useMemo(() => {
    switch (step) {
      case 1:
        return applicationSchema.pick({
          name: true,
          date_of_birth: true,
          phone: true,
          email: true,
          address: true,
        });
      case 2:
        return applicationSchema.pick({
          licence_state: true,
          license_number: true,
          license_expiry: true,
          uber_status: true,
          experience: true,
        });
      case 3:
        return applicationSchema.pick({
          preferred_vehicle: true,
          preferred_category: true,
          intended_start_date: true,
          weekly_budget: true,
          rental_duration_weeks: true,
          driving_history_notes: true,
          rental_notes: true,
        });
      case 5:
        return applicationSchema.pick({
          agreement_accepted: true,
          agreement_signature: true,
        });
      default:
        return null;
    }
  }, [step]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const fieldA11y = (field: keyof FormState) => ({
    id: applicationFieldId(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? applicationErrorId(field) : undefined,
  });

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};

    if (stepSchema) {
      const result = stepSchema.safeParse(form);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          nextErrors[key] = issue.message;
        }
      }
    }

    if (step === 4) {
      const fileChecks = {
        license_photo: requiredImageSchema.safeParse(form.license_photo),
        license_back_photo: requiredImageSchema.safeParse(form.license_back_photo),
        proof_of_address_document: requiredDocumentSchema.safeParse(form.proof_of_address_document),
      } as const;

      for (const [key, result] of Object.entries(fileChecks)) {
        if (!result.success) {
          nextErrors[key] = result.error.issues[0]?.message || 'File is required';
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    field: 'license_photo' | 'license_back_photo' | 'proof_of_address_document' | 'additional_document',
    kind: 'image' | 'document',
  ) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setField(field, null);
      return;
    }

    const allowedTypes =
      kind === 'image' ? APPLICATION_IMAGE_CONTENT_TYPES : APPLICATION_DOCUMENT_CONTENT_TYPES;
    const isAllowedType =
      kind === 'image'
        ? APPLICATION_IMAGE_CONTENT_TYPES.includes(file.type as (typeof APPLICATION_IMAGE_CONTENT_TYPES)[number])
        : APPLICATION_DOCUMENT_CONTENT_TYPES.includes(file.type as (typeof APPLICATION_DOCUMENT_CONTENT_TYPES)[number]);
    if (!isAllowedType || file.size > MAX_APPLICATION_UPLOAD_BYTES) {
      event.target.value = '';
      setErrors((current) => ({
        ...current,
        [field]:
          kind === 'image'
            ? `Please upload a JPG or PNG smaller than ${MAX_UPLOAD_SIZE_MB} MB.`
            : `Please upload a JPG, PNG, or PDF smaller than ${MAX_UPLOAD_SIZE_MB} MB.`,
      }));
      return;
    }

    setField(field, file);
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, 5));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateStep()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCheck = applicationSchema.safeParse(form);
      if (!finalCheck.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of finalCheck.error.issues) {
          nextErrors[String(issue.path[0] ?? 'form')] = issue.message;
        }
        setErrors(nextErrors);
        setIsSubmitting(false);
        return;
      }

      if (!form.license_photo || !form.license_back_photo || !form.proof_of_address_document) {
        setErrors((current) => ({
          ...current,
          form: 'Please attach all required documents before submitting.',
        }));
        setIsSubmitting(false);
        return;
      }

      const payload = new FormData();
      payload.set('name', finalCheck.data.name);
      payload.set('date_of_birth', finalCheck.data.date_of_birth);
      payload.set('phone', finalCheck.data.phone);
      payload.set('email', finalCheck.data.email);
      payload.set('address', finalCheck.data.address);
      payload.set('licence_state', finalCheck.data.licence_state);
      payload.set('license_number', finalCheck.data.license_number);
      payload.set('license_expiry', finalCheck.data.license_expiry);
      payload.set('uber_status', finalCheck.data.uber_status);
      payload.set('experience', finalCheck.data.experience);
      payload.set('preferred_vehicle', finalCheck.data.preferred_vehicle || '');
      payload.set('preferred_category', finalCheck.data.preferred_category || '');
      payload.set('intended_start_date', finalCheck.data.intended_start_date);
      payload.set('weekly_budget', finalCheck.data.weekly_budget || '');
      payload.set('rental_duration_weeks', String(finalCheck.data.rental_duration_weeks || ''));
      payload.set('driving_history_notes', finalCheck.data.driving_history_notes || '');
      payload.set('rental_notes', finalCheck.data.rental_notes || '');
      payload.set('agreement_accepted', 'true');
      payload.set('agreement_signature', finalCheck.data.agreement_signature.trim());
      payload.set('license_photo', form.license_photo);
      payload.set('license_back_photo', form.license_back_photo);
      payload.set('passport_or_uber_profile_screenshot', form.proof_of_address_document);
      payload.set('proof_of_address_document', form.proof_of_address_document);
      if (form.additional_document) {
        payload.set('additional_document', form.additional_document);
      }

      const response = await submitApplication(payload);
      setSubmittedApplicationId(response.application_id);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: getApiErrorMessage(error, 'Failed to save your application.'),
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedApplicationId) {
    return (
      <div className="min-h-screen bg-brand-navy text-white">
        <Seo
          title="Application Received | Galarentals"
          description="Galarentals application confirmation screen."
          canonicalPath="/apply"
          robots="noindex,nofollow"
        />
        <div className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
          <div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
              <CheckCircle2 className="h-4 w-4" />
              Application received
            </div>
            <h1 className="mt-6 text-4xl font-serif font-bold">Review in progress</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-brand-grey">
              Your application was saved successfully. We will review the details, confirm the vehicle,
              and issue a secure Stripe payment link if you are approved.
            </p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-brand-navy/60 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">Reference</p>
              <p className="mt-2 text-lg font-semibold text-white">Application #{submittedApplicationId}</p>
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/"
                className="focus-ring-dark inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-brand-navy"
              >
                Return Home
              </Link>
              <Link
                to="/my-rental"
                className="focus-ring-dark inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-white"
              >
                My Rental
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navy text-white">
      <Seo
        title="Apply | Galarentals"
        description="Apply for a premium Galarentals subscription in five clear steps."
        canonicalPath="/apply"
      />

      <section className="mx-auto max-w-7xl overflow-hidden px-6 py-24 lg:px-8 lg:py-28">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0 lg:sticky lg:top-28">
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold">Apply now</p>
            <h1 className="mt-5 max-w-[15ch] text-3xl font-black leading-tight tracking-tight sm:max-w-xl sm:text-6xl">
              Premium rental approvals, organized in five steps.
            </h1>
            <p className="mt-6 max-w-[32ch] text-base leading-8 text-stone-300 sm:max-w-xl sm:text-lg">
              Galarentals keeps the experience calm and professional. Submit your details, upload documents,
              and accept the agreement before the admin review begins.
            </p>

            <div className="mt-10 flex max-w-[320px] flex-wrap gap-3 sm:max-w-xl">
              {['Validated by Zod', 'Admin reviewed', 'Stripe-ready'].map((item) => (
                <span key={item} className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-grey sm:text-[11px] sm:tracking-[0.2em]">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-gold" />
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 grid max-w-[320px] gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl sm:max-w-none sm:grid-cols-3">
              {[
                { icon: User, label: 'Driver details' },
                { icon: FileText, label: 'Documents' },
                { icon: ShieldCheck, label: 'Admin review' },
              ].map((item) => (
                <div key={item.label} className="flex min-h-20 items-center justify-center gap-2 rounded-2xl bg-brand-navy/65 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-grey">
                  <item.icon className="h-4 w-4 text-brand-gold" />
                  {item.label}
                </div>
              ))}
            </div>

            <div className="mt-8 grid max-w-[320px] grid-cols-5 gap-2 sm:max-w-none">
              {steps.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'flex min-h-12 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center text-[11px] font-bold transition-colors',
                    step >= item.id ? 'border-brand-gold bg-brand-gold text-brand-navy' : 'border-white/10 bg-white/[0.03] text-brand-grey',
                  ].join(' ')}
                  aria-label={`Step ${item.id}: ${item.label}`}
                >
                  <span>{item.id}</span>
                  <span className="mt-1 hidden text-[8px] uppercase tracking-[0.16em] sm:block">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.form && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-50" role="alert">
                {errors.form}
              </div>
            )}

            {step === 1 && (
              <Section eyebrow="Step 1" title="Personal details" description="Tell us who you are and how we can reach you.">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={applicationFieldId('name')} className={labelClass}>
                      Full name
                    </label>
                    <input
                      {...fieldA11y('name')}
                      value={form.name}
                      onChange={(event) => setField('name', event.target.value)}
                      placeholder="Full name"
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('name')} message={errors.name} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('date_of_birth')} className={labelClass}>
                      Date of birth
                    </label>
                    <input
                      {...fieldA11y('date_of_birth')}
                      type="date"
                      value={form.date_of_birth}
                      onChange={(event) => setField('date_of_birth', event.target.value)}
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('date_of_birth')} message={errors.date_of_birth} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('phone')} className={labelClass}>
                      Mobile number
                    </label>
                    <input
                      {...fieldA11y('phone')}
                      value={form.phone}
                      onChange={(event) => setField('phone', event.target.value)}
                      placeholder="Mobile number"
                      autoComplete="tel"
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('phone')} message={errors.phone} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('email')} className={labelClass}>
                      Email address
                    </label>
                    <input
                      {...fieldA11y('email')}
                      value={form.email}
                      onChange={(event) => setField('email', event.target.value)}
                      placeholder="Email address"
                      autoComplete="email"
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('email')} message={errors.email} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={applicationFieldId('address')} className={labelClass}>
                      Residential address
                    </label>
                    <textarea
                      {...fieldA11y('address')}
                      value={form.address}
                      onChange={(event) => setField('address', event.target.value)}
                      placeholder="Residential address"
                      rows={3}
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('address')} message={errors.address} />
                  </div>
                </div>
              </Section>
            )}

            {step === 2 && (
              <Section eyebrow="Step 2" title="Driver details" description="We review licence and driving history details before approval.">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('licence_state')} className={labelClass}>
                      Licence state
                    </label>
                    <select
                      {...fieldA11y('licence_state')}
                      value={form.licence_state}
                      onChange={(event) => setField('licence_state', event.target.value)}
                      className={fieldClass}
                    >
                      <option value="NSW">NSW</option>
                      <option value="VIC">VIC</option>
                      <option value="QLD">QLD</option>
                      <option value="SA">SA</option>
                      <option value="WA">WA</option>
                      <option value="TAS">TAS</option>
                      <option value="ACT">ACT</option>
                      <option value="NT">NT</option>
                    </select>
                    <FieldError id={applicationErrorId('licence_state')} message={errors.licence_state} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('license_number')} className={labelClass}>
                      Licence number
                    </label>
                    <input
                      {...fieldA11y('license_number')}
                      value={form.license_number}
                      onChange={(event) => setField('license_number', event.target.value)}
                      placeholder="Licence number"
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('license_number')} message={errors.license_number} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('license_expiry')} className={labelClass}>
                      Licence expiry
                    </label>
                    <input
                      {...fieldA11y('license_expiry')}
                      type="date"
                      value={form.license_expiry}
                      onChange={(event) => setField('license_expiry', event.target.value)}
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('license_expiry')} message={errors.license_expiry} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('uber_status')} className={labelClass}>
                      Rideshare status
                    </label>
                    <select
                      {...fieldA11y('uber_status')}
                      value={form.uber_status}
                      onChange={(event) => setField('uber_status', event.target.value as FormState['uber_status'])}
                      className={fieldClass}
                    >
                      <option value="Active">Active</option>
                      <option value="Applying">Applying</option>
                      <option value="Not Yet Registered">Not Yet Registered</option>
                    </select>
                    <FieldError id={applicationErrorId('uber_status')} message={errors.uber_status} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={applicationFieldId('experience')} className={labelClass}>
                      Driving experience
                    </label>
                    <select
                      {...fieldA11y('experience')}
                      value={form.experience}
                      onChange={(event) => setField('experience', event.target.value as FormState['experience'])}
                      className={fieldClass}
                    >
                      <option value="New Driver">New Driver</option>
                      <option value="Less than 1 year">Less than 1 year</option>
                      <option value="1-3 years">1-3 years</option>
                      <option value="3+ years">3+ years</option>
                    </select>
                    <FieldError id={applicationErrorId('experience')} message={errors.experience} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={applicationFieldId('driving_history_notes')} className={labelClass}>
                      Driving history notes
                    </label>
                    <textarea
                      {...fieldA11y('driving_history_notes')}
                      value={form.driving_history_notes}
                      onChange={(event) => setField('driving_history_notes', event.target.value)}
                      placeholder="Driving history notes"
                      rows={3}
                      className={fieldClass}
                    />
                  </div>
                </div>
              </Section>
            )}

            {step === 3 && (
              <Section eyebrow="Step 3" title="Rental preference" description="Tell us what you are looking for and when you want to start.">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('preferred_category')} className={labelClass}>
                      Preferred category
                    </label>
                    <select
                      {...fieldA11y('preferred_category')}
                      value={form.preferred_category || 'Economy'}
                      onChange={(event) => setField('preferred_category', event.target.value as FormState['preferred_category'])}
                      className={fieldClass}
                    >
                      <option value="Economy">Economy</option>
                      <option value="SUV">SUV</option>
                      <option value="Luxury">Luxury</option>
                      <option value="People Mover">People Mover</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('preferred_vehicle')} className={labelClass}>
                      Preferred vehicle
                    </label>
                    <input
                      {...fieldA11y('preferred_vehicle')}
                      value={form.preferred_vehicle}
                      onChange={(event) => setField('preferred_vehicle', event.target.value)}
                      placeholder="Preferred vehicle"
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('intended_start_date')} className={labelClass}>
                      Preferred start date
                    </label>
                    <input
                      {...fieldA11y('intended_start_date')}
                      type="date"
                      value={form.intended_start_date}
                      onChange={(event) => setField('intended_start_date', event.target.value)}
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('intended_start_date')} message={errors.intended_start_date} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('weekly_budget')} className={labelClass}>
                      Weekly budget
                    </label>
                    <input
                      {...fieldA11y('weekly_budget')}
                      value={form.weekly_budget}
                      onChange={(event) => setField('weekly_budget', event.target.value)}
                      placeholder="Weekly budget"
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('rental_duration_weeks')} className={labelClass}>
                      Rental duration
                    </label>
                    <input
                      {...fieldA11y('rental_duration_weeks')}
                      type="number"
                      min="1"
                      value={
                        typeof form.rental_duration_weeks === 'number'
                          ? form.rental_duration_weeks
                          : ''
                      }
                      onChange={(event) =>
                        setField(
                          'rental_duration_weeks',
                          event.target.value ? Number(event.target.value) : undefined
                        )
                      }
                      placeholder="Rental duration in weeks"
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={applicationFieldId('rental_notes')} className={labelClass}>
                      Rental notes
                    </label>
                    <textarea
                      {...fieldA11y('rental_notes')}
                      value={form.rental_notes}
                      onChange={(event) => setField('rental_notes', event.target.value)}
                      rows={4}
                      placeholder="Any rental notes"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </Section>
            )}

            {step === 4 && (
              <Section eyebrow="Step 4" title="Documents" description="Upload clear copies so review can move quickly.">
                <div className="grid gap-5 md:grid-cols-2">
                  <label htmlFor={applicationFieldId('license_photo')} className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-brand-gold" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">Licence front</p>
                        <p className="text-sm text-brand-grey">{form.license_photo ? form.license_photo.name : 'JPG or PNG'}</p>
                      </div>
                    </div>
                    <input {...fieldA11y('license_photo')} type="file" accept={APPLICATION_IMAGE_CONTENT_TYPES.join(',')} onChange={(event) => handleFileChange(event, 'license_photo', 'image')} className="focus-ring-dark mt-4 w-full rounded text-sm text-brand-grey file:mr-4 file:rounded-full file:border-0 file:bg-brand-gold file:px-4 file:py-2 file:text-[10px] file:font-bold file:uppercase file:tracking-[0.2em] file:text-brand-navy" />
                    <FieldError id={applicationErrorId('license_photo')} message={errors.license_photo} />
                  </label>

                  <label htmlFor={applicationFieldId('license_back_photo')} className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-brand-gold" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">Licence back</p>
                        <p className="text-sm text-brand-grey">{form.license_back_photo ? form.license_back_photo.name : 'JPG or PNG'}</p>
                      </div>
                    </div>
                    <input {...fieldA11y('license_back_photo')} type="file" accept={APPLICATION_IMAGE_CONTENT_TYPES.join(',')} onChange={(event) => handleFileChange(event, 'license_back_photo', 'image')} className="focus-ring-dark mt-4 w-full rounded text-sm text-brand-grey file:mr-4 file:rounded-full file:border-0 file:bg-brand-gold file:px-4 file:py-2 file:text-[10px] file:font-bold file:uppercase file:tracking-[0.2em] file:text-brand-navy" />
                    <FieldError id={applicationErrorId('license_back_photo')} message={errors.license_back_photo} />
                  </label>

                  <label htmlFor={applicationFieldId('proof_of_address_document')} className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-brand-gold" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">Proof of address</p>
                        <p className="text-sm text-brand-grey">{form.proof_of_address_document ? form.proof_of_address_document.name : 'JPG, PNG, or PDF'}</p>
                      </div>
                    </div>
                    <input {...fieldA11y('proof_of_address_document')} type="file" accept={APPLICATION_DOCUMENT_CONTENT_TYPES.join(',')} onChange={(event) => handleFileChange(event, 'proof_of_address_document', 'document')} className="focus-ring-dark mt-4 w-full rounded text-sm text-brand-grey file:mr-4 file:rounded-full file:border-0 file:bg-brand-gold file:px-4 file:py-2 file:text-[10px] file:font-bold file:uppercase file:tracking-[0.2em] file:text-brand-navy" />
                    <FieldError id={applicationErrorId('proof_of_address_document')} message={errors.proof_of_address_document} />
                  </label>

                  <label htmlFor={applicationFieldId('additional_document')} className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-brand-gold" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">Additional document</p>
                        <p className="text-sm text-brand-grey">{form.additional_document ? form.additional_document.name : 'Optional'}</p>
                      </div>
                    </div>
                    <input {...fieldA11y('additional_document')} type="file" accept={APPLICATION_DOCUMENT_CONTENT_TYPES.join(',')} onChange={(event) => handleFileChange(event, 'additional_document', 'document')} className="focus-ring-dark mt-4 w-full rounded text-sm text-brand-grey file:mr-4 file:rounded-full file:border-0 file:bg-brand-gold file:px-4 file:py-2 file:text-[10px] file:font-bold file:uppercase file:tracking-[0.2em] file:text-brand-navy" />
                  </label>
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section eyebrow="Step 5" title="Review and submit" description="Check the summary, accept the agreement, and submit when ready.">
                <div className="grid gap-5">
                  <div className="rounded-3xl border border-white/10 bg-brand-navy/60 p-5 text-sm leading-7 text-brand-grey">
                    <p className="font-semibold text-white">Summary</p>
                    <p>Name: {form.name || 'Not set'}</p>
                    <p>Preferred category: {form.preferred_category || 'Economy'}</p>
                    <p>Start date: {form.intended_start_date || 'Not set'}</p>
                    <p>Weekly budget: {form.weekly_budget || 'Not set'}</p>
                  </div>

                  <label className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <input
                      {...fieldA11y('agreement_accepted')}
                      type="checkbox"
                      checked={Boolean(form.agreement_accepted)}
                      onChange={(event) => setField('agreement_accepted', event.target.checked)}
                      className="focus-ring-dark mt-1 h-5 w-5 rounded border-white/20 bg-brand-navy text-brand-gold"
                    />
                    <span className="text-sm leading-7 text-white">
                      I have read and agree to the rental agreement and the review process.
                    </span>
                  </label>
                  <FieldError id={applicationErrorId('agreement_accepted')} message={errors.agreement_accepted} />

                  <div className="space-y-2">
                    <label htmlFor={applicationFieldId('agreement_signature')} className={labelClass}>
                      Typed signature
                    </label>
                    <input
                      {...fieldA11y('agreement_signature')}
                      value={form.agreement_signature}
                      onChange={(event) => setField('agreement_signature', event.target.value)}
                      placeholder="Typed signature"
                      className={fieldClass}
                    />
                    <FieldError id={applicationErrorId('agreement_signature')} message={errors.agreement_signature} />
                  </div>
                </div>
              </Section>
            )}

            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(current - 1, 1))}
                  className="focus-ring-dark inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="focus-ring-dark inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-brand-navy"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="focus-ring-dark inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-brand-navy disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isSubmitting ? 'Submitting' : 'Submit application'}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
