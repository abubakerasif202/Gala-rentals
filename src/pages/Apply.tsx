import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { submitApplication } from '../lib/api';
import {
  APPLICATION_IMAGE_CONTENT_TYPES,
  AUSTRALIAN_MOBILE_REGEX,
  MAX_APPLICATION_UPLOAD_BYTES,
  getTodayInAustralia,
  isFutureAustraliaDate,
  isTodayOrFutureAustraliaDate,
  isValidDateOnly,
  normalizeApplicationEmail,
  normalizeAustralianMobile,
} from '../../shared/applicationSubmission';

const ALLOWED_UPLOAD_TYPES = new Set<string>(APPLICATION_IMAGE_CONTENT_TYPES);

const dateOnlySchema = (requiredMessage: string, invalidMessage: string) =>
  z.string().trim().min(1, requiredMessage).refine(isValidDateOnly, invalidMessage);

const applySchema = z.object({
  name: z.string().trim().min(2, 'Full name is required'),
  phone: z
    .string()
    .transform(normalizeAustralianMobile)
    .pipe(z.string().regex(AUSTRALIAN_MOBILE_REGEX, 'Valid Australian mobile number required')),
  email: z
    .string()
    .transform(normalizeApplicationEmail)
    .pipe(z.string().email('Invalid email address')),
  address: z.string().trim().min(5, 'Residential address is required'),
  license_number: z.string().trim().min(5, 'License number is required'),
  license_expiry: dateOnlySchema(
    'License expiry date is required',
    'License expiry date must be a valid date'
  ).refine(
    (value) => isFutureAustraliaDate(value, getTodayInAustralia()),
    'License must not be expired'
  ),
  uber_status: z.enum(['Active', 'Applying', 'Not Yet Registered']),
  experience: z.string().trim().min(1, 'Experience is required'),
  weekly_budget: z.string().trim().optional(),
  intended_start_date: dateOnlySchema(
    'Start date is required',
    'Start date must be a valid date'
  ).refine(
    (value) => isTodayOrFutureAustraliaDate(value, getTodayInAustralia()),
    'Start date must be today or later'
  ),
  license_photo: z.string().min(1, 'Driver licence front photo is required'),
  license_back_photo: z.string().min(1, 'Driver licence back photo is required'),
});

type ApplyValues = z.infer<typeof applySchema>;

const defaultValues: ApplyValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  license_number: '',
  license_expiry: '',
  uber_status: 'Active',
  experience: 'New Driver',
  weekly_budget: '',
  intended_start_date: '',
  license_photo: '',
  license_back_photo: '',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{message}</p>;
}

function StepHeader({ step }: { step: number }) {
  const items = [
    { step: 1, label: 'Driver Details', icon: User },
    { step: 2, label: 'Documents', icon: ShieldCheck },
  ];

  return (
    <div className="flex justify-between mb-16 relative">
      <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2 z-0" />
      {items.map((item) => (
        <div key={item.step} className="relative z-10 flex flex-col items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
              step >= item.step
                ? 'bg-brand-gold border-brand-gold text-brand-navy'
                : 'bg-brand-navy border-white/10 text-brand-grey'
            }`}
          >
            <item.icon className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${
              step >= item.step ? 'text-white' : 'text-brand-grey'
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Apply() {
  const [searchParams] = useSearchParams();
  const requestedCarId = searchParams.get('carId');
  const [step, setStep] = useState(1);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    mode: 'onChange',
    defaultValues,
  });

  const licensePhoto = watch('license_photo');
  const licenseBackPhoto = watch('license_back_photo');

  const handleFileUpload = (
    event: ChangeEvent<HTMLInputElement>,
    field: 'license_photo' | 'license_back_photo'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      event.target.value = '';
      setValue(field, '', { shouldValidate: true });
      setPageError('Please upload a JPG or PNG smaller than 7 MB.');
      return;
    }
    if (file.size > MAX_APPLICATION_UPLOAD_BYTES) {
      event.target.value = '';
      setValue(field, '', { shouldValidate: true });
      setPageError('Please upload a JPG or PNG smaller than 7 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setValue(field, String(reader.result || ''), { shouldValidate: true });
      setPageError(null);
    };
    reader.readAsDataURL(file);
  };

  const goToDocumentsStep = async () => {
    const isValid = await trigger([
      'name',
      'phone',
      'email',
      'address',
      'uber_status',
      'experience',
      'intended_start_date',
    ]);

    if (isValid) {
      setPageError(null);
      setStep(2);
    }
  };

  const onSubmit = async (values: ApplyValues) => {
    setIsSubmitting(true);
    setPageError(null);

    try {
      const submission = await submitApplication(values);
      setSubmittedApplicationId(submission.application_id);
    } catch (error: any) {
      setPageError(
        error?.response?.data?.error ||
          'Failed to save your application. Please check your details and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === 1) {
      event.preventDefault();
      void goToDocumentsStep();
      return;
    }

    void handleSubmit(onSubmit)(event);
  };

  if (submittedApplicationId) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-navy">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 md:p-14 text-center space-y-8">
              <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-brand-gold" />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                  Application received
                </p>
                <h1 className="text-4xl font-bold text-white uppercase tracking-tighter">
                  Review starts now
                </h1>
                <p className="text-brand-grey font-light leading-relaxed max-w-2xl mx-auto">
                  The team will review your documents, update the final bond and weekly payment if
                  needed, then send you a secure payment link after approval.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-brand-navy/40 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                  Reference
                </p>
                <p className="text-white font-bold text-lg mt-2">Application #{submittedApplicationId}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/cars"
                  className="inline-flex items-center justify-center gap-3 bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all"
                >
                  Browse Fleet
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-3 border border-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
                >
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-navy">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <StepHeader step={step} />
          {pageError && (
            <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-50 font-light">{pageError}</p>
            </div>
          )}

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-3xl"
          >
            <form onSubmit={handleFormSubmit} className="space-y-10">
              {step === 1 && (
                <>
                  <div className="space-y-3">
                    <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-tighter">
                      Driver Application
                    </h1>
                    <p className="text-brand-grey font-light max-w-2xl">
                      Submit your documents first. After review, the team approves the application,
                      sets the final bond and weekly payment, and sends a secure payment link.
                    </p>
                  </div>

                  {requestedCarId && (
                    <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-6 py-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                        Vehicle selected
                      </p>
                      <p className="text-sm text-brand-grey font-light">
                        You are applying from a vehicle page. Final vehicle assignment and pricing
                        are confirmed after review and approval.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Full Name
                      </label>
                      <input
                        {...register('name')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                        placeholder="As shown on your license"
                      />
                      <FieldError message={errors.name?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Mobile Number
                      </label>
                      <input
                        {...register('phone')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                        placeholder="0412345678"
                      />
                      <FieldError message={errors.phone?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Email Address
                      </label>
                      <input
                        {...register('email')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                        placeholder="driver@example.com"
                      />
                      <FieldError message={errors.email?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Intended Start Date
                      </label>
                      <input
                        type="date"
                        {...register('intended_start_date')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                      />
                      <FieldError message={errors.intended_start_date?.message} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Residential Address
                      </label>
                      <textarea
                        {...register('address')}
                        rows={3}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light resize-none"
                        placeholder="Street, suburb, state, postcode"
                      />
                      <FieldError message={errors.address?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Uber Status
                      </label>
                      <select
                        {...register('uber_status')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light appearance-none"
                      >
                        <option value="Active">Active Driver</option>
                        <option value="Applying">Applying</option>
                        <option value="Not Yet Registered">Not Yet Registered</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        Rideshare Experience
                      </label>
                      <select
                        {...register('experience')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light appearance-none"
                      >
                        <option value="New Driver">New Driver</option>
                        <option value="Less than 1 year">Less than 1 year</option>
                        <option value="1-3 years">1-3 years</option>
                        <option value="3+ years">3+ years</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={goToDocumentsStep}
                      className="inline-flex items-center gap-3 bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all"
                    >
                      Continue to Documents <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                    <div className="space-y-3">
                      <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">
                        Document Verification
                      </h2>
                      <p className="text-brand-grey font-light max-w-2xl">
                        Upload the documents needed for review. Payment is only requested after admin
                        approval.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4 min-w-[260px]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                        Next step after approval
                      </p>
                      <p className="text-xs text-brand-grey mt-1">
                        The team finalizes your bond and weekly payment, then emails a secure payment
                        link.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        License Number
                      </label>
                      <input
                        {...register('license_number')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                        placeholder="NSW licence number"
                      />
                      <FieldError message={errors.license_number?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                        License Expiry
                      </label>
                      <input
                        type="date"
                        {...register('license_expiry')}
                        className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light"
                      />
                      <FieldError message={errors.license_expiry?.message} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="rounded-3xl border border-white/10 bg-brand-navy/40 p-6 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                          Driver licence front photo
                        </p>
                        <p className="text-sm text-brand-grey font-light mt-2">
                          Upload a clear JPG or PNG. Maximum file size is 7 MB.
                        </p>
                      </div>
                      <label className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-brand-gold/40 transition-all">
                        <Upload className="w-5 h-5 text-brand-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white">
                          Upload front photo
                        </span>
                        <span className="text-xs text-brand-grey font-light">
                          {licensePhoto ? 'File attached' : 'Choose an image file'}
                        </span>
                        <input
                          type="file"
                          accept={APPLICATION_IMAGE_CONTENT_TYPES.join(',')}
                          className="hidden"
                          onChange={(event) => handleFileUpload(event, 'license_photo')}
                        />
                      </label>
                      <FieldError message={errors.license_photo?.message} />
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-brand-navy/40 p-6 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                          Driver licence back photo
                        </p>
                        <p className="text-sm text-brand-grey font-light mt-2">
                          Upload the back of your licence as a clear JPG or PNG. Maximum file size is
                          7 MB.
                        </p>
                      </div>
                      <label className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-brand-gold/40 transition-all">
                        <Upload className="w-5 h-5 text-brand-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white">
                          Upload back photo
                        </span>
                        <span className="text-xs text-brand-grey font-light">
                          {licenseBackPhoto ? 'File attached' : 'Choose an image file'}
                        </span>
                        <input
                          type="file"
                          accept={APPLICATION_IMAGE_CONTENT_TYPES.join(',')}
                          className="hidden"
                          onChange={(event) => handleFileUpload(event, 'license_back_photo')}
                        />
                      </label>
                      <FieldError message={errors.license_back_photo?.message} />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center justify-center gap-3 border border-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-3 bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving application
                        </>
                      ) : (
                        <>Submit Application</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
