import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  createApplicationCheckoutSession,
  fetchRentalPlans,
  submitApplication,
} from '../lib/api';
import {
  clearPendingApplicationCheckout,
  loadPendingApplicationCheckout,
  persistPendingApplicationCheckout,
  type PendingApplicationCheckout,
} from '../lib/checkoutStorage';
import type { RentalPlanWithPricing } from '../lib/rentalPlans';

const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;

const applySchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  phone: z
    .string()
    .regex(/^(?:\+61|0)4\d{8}$/, 'Valid Australian mobile number required'),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  address: z.string().min(5, 'Residential address is required'),
  license_number: z.string().min(5, 'License number is required'),
  license_expiry: z
    .string()
    .min(1, 'License expiry date is required')
    .refine((date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(date) > today;
    }, 'License must not be expired'),
  uber_status: z.enum(['Active', 'Applying', 'Not Yet Registered']),
  experience: z.string().min(1, 'Experience is required'),
  weekly_budget: z.string().optional(),
  intended_start_date: z
    .string()
    .min(1, 'Start date is required')
    .refine((date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(date) >= today;
    }, 'Start date must be today or later'),
  license_photo: z.string().min(1, 'License photo is required'),
  uber_screenshot: z.string().optional(),
  selected_plan_id: z.string().min(1, 'Please select a rental plan'),
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
  uber_screenshot: '',
  selected_plan_id: '',
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const isExpired = (value: string) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{message}</p>;
}

function StepHeader({ step }: { step: number }) {
  const items = [
    { step: 1, label: 'Driver Details', icon: User },
    { step: 2, label: 'Documents', icon: ShieldCheck },
    { step: 3, label: 'Stripe Checkout', icon: CreditCard },
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
  const [isRedirectingCheckout, setIsRedirectingCheckout] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<PendingApplicationCheckout | null>(null);

  const { data: availablePlans = [], isLoading: isPlansLoading } = useQuery<RentalPlanWithPricing[]>({
    queryKey: ['rental-plans'],
    queryFn: fetchRentalPlans,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    mode: 'onChange',
    defaultValues,
  });

  const selectedPlanId = watch('selected_plan_id');
  const licensePhoto = watch('license_photo');
  const uberScreenshot = watch('uber_screenshot');
  const selectedPlan = useMemo(
    () => availablePlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [availablePlans, selectedPlanId]
  );

  useEffect(() => {
    if (!availablePlans.length) return;
    const stored = loadPendingApplicationCheckout();
    const requestedPlanId = searchParams.get('planId');
    const fallbackPlanId = availablePlans.find((plan) => plan.popular)?.id ?? availablePlans[0].id;
    const nextPlanId =
      (requestedPlanId && availablePlans.some((plan) => plan.id === requestedPlanId)
        ? requestedPlanId
        : stored?.selectedPlanId && availablePlans.some((plan) => plan.id === stored.selectedPlanId)
          ? stored.selectedPlanId
          : fallbackPlanId) || fallbackPlanId;

    if (!selectedPlanId || !availablePlans.some((plan) => plan.id === selectedPlanId)) {
      setValue('selected_plan_id', nextPlanId, { shouldValidate: true, shouldDirty: false });
    }
  }, [availablePlans, searchParams, selectedPlanId, setValue]);

  useEffect(() => {
    const stored = loadPendingApplicationCheckout();
    const applicationId = Number(searchParams.get('application_id') || 0);
    const checkoutToken = searchParams.get('checkout_token') || searchParams.get('token') || '';

    if (applicationId && checkoutToken) {
      const matchingStoredCheckout = stored?.checkoutToken === checkoutToken ? stored : null;
      const resumed: PendingApplicationCheckout = {
        applicationId,
        checkoutToken,
        checkoutTokenExpiresAt: matchingStoredCheckout?.checkoutTokenExpiresAt || '',
        selectedPlanId: searchParams.get('planId') || matchingStoredCheckout?.selectedPlanId || '',
      };
      setPendingCheckout(resumed);
      persistPendingApplicationCheckout(resumed);
      setStep(3);
      if (searchParams.get('resume_checkout') === '1') {
        setPageError('Stripe checkout was canceled. Review the summary and continue when ready.');
      }
      return;
    }

    if (stored && isExpired(stored.checkoutTokenExpiresAt)) {
      clearPendingApplicationCheckout();
      setPageError('Your previous checkout link expired. Submit the application again to continue.');
      return;
    }

    if (stored) {
      setPendingCheckout(stored);
      setStep(3);
    }
  }, [searchParams]);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'license_photo' | 'uber_screenshot'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
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

  const beginHostedCheckout = async (checkout: PendingApplicationCheckout) => {
    setIsRedirectingCheckout(true);
    setPageError(null);
    try {
      const session = await createApplicationCheckoutSession({
        application_id: checkout.applicationId,
        checkout_token: checkout.checkoutToken,
        plan_id: checkout.selectedPlanId,
      });
      persistPendingApplicationCheckout(checkout);
      window.location.assign(session.checkout_url);
    } catch (error: any) {
      setPageError(
        error?.response?.data?.error ||
          error?.message ||
          'Unable to start Stripe checkout. Try again in a moment.'
      );
    } finally {
      setIsRedirectingCheckout(false);
    }
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
      'selected_plan_id',
    ]);
    if (isValid) {
      setPageError(null);
      setStep(2);
    }
  };

  const handleRetryCheckout = async () => {
    if (!pendingCheckout) {
      setPageError('Submit your application first to continue to Stripe checkout.');
      setStep(1);
      return;
    }
    const nextCheckout = {
      ...pendingCheckout,
      selectedPlanId: selectedPlanId || pendingCheckout.selectedPlanId,
    };
    setPendingCheckout(nextCheckout);
    persistPendingApplicationCheckout(nextCheckout);
    await beginHostedCheckout(nextCheckout);
  };

  const handleStartOver = () => {
    clearPendingApplicationCheckout();
    setPendingCheckout(null);
    setPageError(null);
    setStep(1);
    reset({ ...defaultValues, selected_plan_id: selectedPlanId || '' });
  };

  const onSubmit = async (values: ApplyValues) => {
    if (!selectedPlan) {
      setPageError('Please select a rental plan before continuing.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    setPageError(null);
    try {
      const { selected_plan_id, ...payload } = values;
      const submission = await submitApplication({
        ...payload,
        weekly_budget: `${selectedPlan.name} (${selectedPlan.pricing.recurringDueAud.toFixed(2)} AUD ${selectedPlan.pricing.recurringLabel})`,
      });
      const nextCheckout: PendingApplicationCheckout = {
        applicationId: Number(submission.application_id),
        checkoutToken: submission.checkout_token,
        checkoutTokenExpiresAt: submission.checkout_token_expires_at,
        selectedPlanId: selected_plan_id,
      };
      setPendingCheckout(nextCheckout);
      persistPendingApplicationCheckout(nextCheckout);
      setStep(3);
      await beginHostedCheckout(nextCheckout);
    } catch (error: any) {
      setPageError(
        error?.response?.data?.error ||
          'Failed to save your application. Please check your details and try again.'
      );
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
              {step === 1 && (
                <>
                  <div className="space-y-3">
                    <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-tighter">
                      Driver Application
                    </h1>
                    <p className="text-brand-grey font-light max-w-2xl">
                      Complete your application and choose the rental cadence you want before moving
                      into Stripe&apos;s hosted checkout.
                    </p>
                  </div>

                  {requestedCarId && (
                    <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-6 py-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                        Vehicle interest noted
                      </p>
                      <p className="text-sm text-brand-grey font-light">
                        Submit this application first. After approval, the team will send a secure
                        checkout link for your chosen vehicle.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Full Name</label>
                      <input {...register('name')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" placeholder="As shown on your license" />
                      <FieldError message={errors.name?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Mobile Number</label>
                      <input {...register('phone')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" placeholder="04XX XXX XXX" />
                      <FieldError message={errors.phone?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Email Address</label>
                      <input {...register('email')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" placeholder="driver@example.com" />
                      <FieldError message={errors.email?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Intended Start Date</label>
                      <input type="date" {...register('intended_start_date')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" />
                      <FieldError message={errors.intended_start_date?.message} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Residential Address</label>
                      <textarea {...register('address')} rows={3} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light resize-none" placeholder="Street, suburb, state, postcode" />
                      <FieldError message={errors.address?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Uber Status</label>
                      <select {...register('uber_status')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light appearance-none">
                        <option value="Active">Active Driver</option>
                        <option value="Applying">Applying</option>
                        <option value="Not Yet Registered">Not Yet Registered</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Rideshare Experience</label>
                      <select {...register('experience')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light appearance-none">
                        <option value="New Driver">New Driver</option>
                        <option value="Less than 1 year">Less than 1 year</option>
                        <option value="1-3 years">1-3 years</option>
                        <option value="3+ years">3+ years</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">Rental plan</p>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Choose your billing cadence</h2>
                      </div>
                      {isPlansLoading && <div className="inline-flex items-center gap-2 text-brand-grey text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading plans</div>}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {availablePlans.map((plan) => (
                        <label key={plan.id} className={`rounded-3xl border p-6 cursor-pointer transition-all ${selectedPlanId === plan.id ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 bg-brand-navy/40 hover:border-white/20'}`}>
                          <input type="radio" value={plan.id} {...register('selected_plan_id')} className="sr-only" />
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xl font-bold text-white">{plan.name}</p>
                                <p className="text-sm text-brand-grey font-light mt-1">{plan.description}</p>
                              </div>
                              {plan.highlight && <span className="px-3 py-1 rounded-full border border-brand-gold/30 text-[10px] font-bold uppercase tracking-widest text-brand-gold">{plan.highlight}</span>}
                            </div>
                            <div>
                              <p className="text-3xl font-bold text-white">{formatCurrency(plan.pricing.recurringDueAud)}</p>
                              <p className="text-xs text-brand-grey uppercase tracking-widest">{plan.pricing.recurringLabel}</p>
                            </div>
                            <div className="rounded-2xl bg-white/5 border border-white/5 px-4 py-4 text-xs space-y-2">
                              <div className="flex justify-between"><span className="text-brand-grey">Due now</span><span className="text-white font-bold">{formatCurrency(plan.pricing.upfrontDueAud)}</span></div>
                              <div className="flex justify-between"><span className="text-brand-grey">Recurring</span><span className="text-white font-bold">{formatCurrency(plan.pricing.recurringDueAud)}</span></div>
                            </div>
                            <ul className="space-y-2">
                              {plan.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-3 text-sm text-brand-grey">
                                  <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </label>
                      ))}
                    </div>
                    <FieldError message={errors.selected_plan_id?.message} />
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={goToDocumentsStep} disabled={isPlansLoading} className="inline-flex items-center gap-3 bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all disabled:opacity-50">
                      Continue to Documents <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                    <div className="space-y-3">
                      <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Document Verification</h2>
                      <p className="text-brand-grey font-light max-w-2xl">
                        Upload the documents needed to verify your driver profile before Stripe takes
                        the upfront payment.
                      </p>
                    </div>
                    {selectedPlan && (
                      <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4 min-w-[260px]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Selected plan</p>
                        <p className="text-lg font-bold text-white">{selectedPlan.name}</p>
                        <p className="text-xs text-brand-grey mt-1">
                          {formatCurrency(selectedPlan.pricing.upfrontDueAud)} due now, then {formatCurrency(selectedPlan.pricing.recurringDueAud)} {selectedPlan.pricing.recurringLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">License Number</label>
                      <input {...register('license_number')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" placeholder="NSW licence number" />
                      <FieldError message={errors.license_number?.message} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">License Expiry</label>
                      <input type="date" {...register('license_expiry')} className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none font-light" />
                      <FieldError message={errors.license_expiry?.message} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="rounded-3xl border border-white/10 bg-brand-navy/40 p-6 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">Driver licence photo</p>
                        <p className="text-sm text-brand-grey font-light mt-2">Upload a clear JPG or PNG. Maximum file size is 7 MB.</p>
                      </div>
                      <label className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-brand-gold/40 transition-all">
                        <Upload className="w-5 h-5 text-brand-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white">Upload licence</span>
                        <span className="text-xs text-brand-grey font-light">{licensePhoto ? 'File attached' : 'Choose an image file'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(event) => handleFileUpload(event, 'license_photo')} />
                      </label>
                      <FieldError message={errors.license_photo?.message} />
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-brand-navy/40 p-6 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">Uber screenshot</p>
                        <p className="text-sm text-brand-grey font-light mt-2">Optional if you are still applying for Uber access.</p>
                      </div>
                      <label className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-brand-gold/40 transition-all">
                        <Upload className="w-5 h-5 text-brand-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white">Upload screenshot</span>
                        <span className="text-xs text-brand-grey font-light">{uberScreenshot ? 'File attached' : 'Choose an image file'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(event) => handleFileUpload(event, 'uber_screenshot')} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center gap-3 border border-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-3 bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all disabled:opacity-50">
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving application</> : <>Continue to Stripe <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Secure Stripe Checkout</h2>
                    <p className="text-brand-grey font-light max-w-2xl">
                      Your application has been saved. Stripe now handles the upfront bond, setup
                      fees, and first rental cycle on a hosted checkout page.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
                    <div className="rounded-3xl border border-white/10 bg-brand-navy/40 p-8 space-y-6">
                      {selectedPlan && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-bold text-white">{selectedPlan.name}</p>
                              <p className="text-xs text-brand-grey uppercase tracking-widest mt-1">{selectedPlan.pricing.recurringLabel}</p>
                            </div>
                            <span className="text-brand-gold text-xl font-bold">{formatCurrency(selectedPlan.pricing.upfrontDueAud)}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-brand-grey">Security bond</span><span className="text-white font-bold">{formatCurrency(selectedPlan.pricing.bondAud)}</span></div>
                            <div className="flex justify-between"><span className="text-brand-grey">Initial rental</span><span className="text-white font-bold">{formatCurrency(selectedPlan.pricing.initialRentalAud)}</span></div>
                            <div className="flex justify-between"><span className="text-brand-grey">Setup fees</span><span className="text-white font-bold">{formatCurrency(selectedPlan.pricing.setupFeesAud)}</span></div>
                            <div className="pt-3 border-t border-white/10 flex justify-between"><span className="text-white font-bold uppercase tracking-widest text-xs">Recurring charge</span><span className="text-brand-gold font-bold">{formatCurrency(selectedPlan.pricing.recurringDueAud)}</span></div>
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">What happens next</p>
                        <p className="text-sm text-brand-grey font-light leading-relaxed">
                          After successful payment, the team reviews your submitted documents. Vehicle
                          pickup is handled later through a separate secure checkout link after approval.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">Hosted checkout</p>
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-3">Open Stripe checkout</h3>
                        <p className="text-sm text-brand-grey font-light mt-3">
                          If you canceled earlier, you can reopen the hosted session here without
                          starting the application from scratch.
                        </p>
                      </div>
                      <button type="button" onClick={handleRetryCheckout} disabled={isRedirectingCheckout || !pendingCheckout} className="w-full inline-flex items-center justify-center gap-3 bg-brand-gold text-brand-navy px-8 py-5 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all disabled:opacity-50">
                        {isRedirectingCheckout ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Stripe</> : <>Continue to Stripe <ArrowRight className="w-4 h-4" /></>}
                      </button>
                      <button type="button" onClick={handleStartOver} className="w-full inline-flex items-center justify-center gap-3 border border-white/10 text-white px-8 py-5 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all">
                        Update application details
                      </button>
                      <div className="pt-4 border-t border-white/10">
                        <Link to="/cars" className="text-xs uppercase tracking-widest font-bold text-brand-grey hover:text-brand-gold transition-colors">
                          Browse vehicles
                        </Link>
                      </div>
                    </div>
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
