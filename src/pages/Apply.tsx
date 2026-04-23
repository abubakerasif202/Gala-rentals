import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { motion, type Variants } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Seo from "../components/Seo";
import { submitApplication } from "../lib/api";
import { getApiErrorMessage } from "../lib/errorHandling";
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
} from "../../shared/applicationSubmission";

const ALLOWED_UPLOAD_TYPES = new Set<string>(APPLICATION_IMAGE_CONTENT_TYPES);
const MAX_UPLOAD_SIZE_MB = Math.floor(
  MAX_APPLICATION_UPLOAD_BYTES / (1024 * 1024),
);

const heroVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, x: 18 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const dateOnlySchema = (requiredMessage: string, invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine(isValidDateOnly, invalidMessage);

const applicationFileSchema = (label: string) =>
  z
    .custom<File>((value) => value instanceof File, {
      message: `${label} is required`,
    })
    .refine(
      (file) => ALLOWED_UPLOAD_TYPES.has(file.type),
      `Please upload a JPG or PNG smaller than ${MAX_UPLOAD_SIZE_MB} MB.`,
    )
    .refine(
      (file) => file.size <= MAX_APPLICATION_UPLOAD_BYTES,
      `Please upload a JPG or PNG smaller than ${MAX_UPLOAD_SIZE_MB} MB.`,
    );

const applySchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  phone: z
    .string()
    .transform(normalizeAustralianMobile)
    .pipe(
      z
        .string()
        .regex(
          AUSTRALIAN_MOBILE_REGEX,
          "Valid Australian mobile number required",
        ),
    ),
  email: z
    .string()
    .transform(normalizeApplicationEmail)
    .pipe(z.string().email("Invalid email address")),
  address: z.string().trim().min(5, "Residential address is required"),
  license_number: z.string().trim().min(5, "License number is required"),
  license_expiry: dateOnlySchema(
    "License expiry date is required",
    "License expiry date must be a valid date",
  ).refine(
    (value) => isFutureAustraliaDate(value, getTodayInAustralia()),
    "License must not be expired",
  ),
  uber_status: z.enum(["Active", "Applying", "Not Yet Registered"]),
  experience: z.string().trim().min(1, "Experience is required"),
  weekly_budget: z.string().trim().optional(),
  intended_start_date: dateOnlySchema(
    "Start date is required",
    "Start date must be a valid date",
  ).refine(
    (value) => isTodayOrFutureAustraliaDate(value, getTodayInAustralia()),
    "Start date must be today or later",
  ),
  license_photo: applicationFileSchema("Driver licence front photo"),
  license_back_photo: applicationFileSchema("Driver licence back photo"),
});

type ApplyValues = z.input<typeof applySchema>;
type ApplySubmissionValues = z.output<typeof applySchema>;

const defaultValues: ApplyValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
  license_number: "",
  license_expiry: "",
  uber_status: "Active",
  experience: "New Driver",
  weekly_budget: "",
  intended_start_date: "",
  license_photo: null,
  license_back_photo: null,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-red-300 text-[11px] font-semibold tracking-wide">
      {message}
    </p>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
    >
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-7 text-brand-grey">
            {description}
          </p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function TrustPill({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
      <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
      {text}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-grey">
      {children}
    </label>
  );
}

function StepBadge({
  step,
  label,
  active,
}: {
  step: string;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className={[
          "flex h-11 w-11 items-center justify-center rounded-full border text-[12px] font-bold transition-colors",
          active
            ? "border-brand-gold bg-brand-gold text-brand-navy"
            : "border-white/10 bg-white/[0.03] text-brand-grey",
        ].join(" ")}
      >
        {step}
      </div>
      <span className="max-w-[90px] text-[10px] font-bold uppercase tracking-[0.28em] text-brand-grey">
        {label}
      </span>
    </div>
  );
}

export default function Apply() {
  const [step, setStep] = useState(1);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<
    string | null
  >(null);

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<ApplyValues, unknown, ApplySubmissionValues>({
    resolver: zodResolver(applySchema),
    mode: "onChange",
    defaultValues,
  });

  useEffect(() => {
    register("license_photo");
    register("license_back_photo");
  }, [register]);

  const licensePhoto = watch("license_photo");
  const licenseBackPhoto = watch("license_back_photo");

  const trustSignals = useMemo(
    () => [
      "Fast approval",
      "Approval support",
      "Premium support",
      "Reliable vehicles",
    ],
    [],
  );

  const pageSeo = (
    <Seo
      title="Apply to Drive with Maple Rentals | Sydney Car Rental Applications"
      description="Apply to drive with Maple Rentals for a premium weekly rental and Uber-ready vehicle program in Sydney. Simple onboarding, fast approval, and reliable cars."
      canonicalPath="/apply"
      keywords={[
        "apply to drive maple rentals",
        "uber driver application sydney",
        "weekly rental application",
        "rideshare car rental application",
        "sydney driver onboarding",
      ]}
    />
  );

  const handleFileUpload = (
    event: ChangeEvent<HTMLInputElement>,
    field: "license_photo" | "license_back_photo",
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setValue(field, null, { shouldValidate: true });
      return;
    }
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      event.target.value = "";
      setValue(field, null, { shouldValidate: true });
      setPageError(
        `Please upload a JPG or PNG smaller than ${MAX_UPLOAD_SIZE_MB} MB.`,
      );
      return;
    }
    if (file.size > MAX_APPLICATION_UPLOAD_BYTES) {
      event.target.value = "";
      setValue(field, null, { shouldValidate: true });
      setPageError(
        `Please upload a JPG or PNG smaller than ${MAX_UPLOAD_SIZE_MB} MB.`,
      );
      return;
    }

    setValue(field, file, { shouldValidate: true });
    setPageError(null);
  };

  const goToNextStep = async () => {
    const isValid = await trigger([
      "name",
      "phone",
      "email",
      "address",
      "uber_status",
      "experience",
      "intended_start_date",
    ]);

    if (isValid) {
      setPageError(null);
      setStep(2);
    }
  };

  const onSubmit = async (values: ApplySubmissionValues) => {
    setIsSubmitting(true);
    setPageError(null);

    try {
      if (!values.license_photo || !values.license_back_photo) {
        setPageError("Please attach both licence images before submitting.");
        return;
      }

      const payload = new FormData();
      payload.set("name", values.name);
      payload.set("phone", values.phone);
      payload.set("email", values.email);
      payload.set("address", values.address);
      payload.set("license_number", values.license_number);
      payload.set("license_expiry", values.license_expiry);
      payload.set("uber_status", values.uber_status);
      payload.set("experience", values.experience);
      payload.set("intended_start_date", values.intended_start_date);

      if (values.weekly_budget?.trim()) {
        payload.set("weekly_budget", values.weekly_budget.trim());
      }

      payload.set("license_photo", values.license_photo);
      payload.set("license_back_photo", values.license_back_photo);

      const submission = await submitApplication(payload);
      setSubmittedApplicationId(submission.application_id);
    } catch (error) {
      setPageError(
        getApiErrorMessage(
          error,
          "Failed to save your application. Please check your details and try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === 1) {
      event.preventDefault();
      void goToNextStep();
      return;
    }

    void handleSubmit(onSubmit)(event);
  };

  if (submittedApplicationId) {
    return (
      <>
        {pageSeo}
        <div className="min-h-screen bg-brand-navy pt-28 pb-20">
          <div className="mx-auto max-w-5xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_30px_100px_rgba(0,0,0,0.22)]"
            >
              <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-8 sm:p-10 lg:p-14">
                  <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                    <CheckCircle2 className="h-4 w-4" />
                    Application received
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                    Review in progress
                  </h1>
                  <p className="mt-5 max-w-2xl text-base sm:text-lg leading-8 text-brand-grey">
                    Your application was saved successfully. We will review your
                    details and contact you with next steps if everything is
                    approved.
                  </p>

                  <div className="mt-10 grid gap-4 sm:grid-cols-3">
                    {[
                      "Fast approval",
                      "Vehicle review",
                      "Secure checkout link if approved",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-brand-navy/40 px-4 py-4 text-sm text-white"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                    <Link
                      to="/cars"
                      className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-gold px-8 py-4 text-xs font-bold uppercase tracking-[0.22em] text-brand-navy transition-colors hover:bg-brand-gold-light"
                    >
                      Browse fleet
                    </Link>
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 px-8 py-4 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/5"
                    >
                      Return home
                    </Link>
                  </div>
                </div>

                <div className="border-t border-white/10 bg-brand-navy/60 p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">
                    Reference
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    Application #{submittedApplicationId}
                  </p>
                  <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-grey">
                      Next steps
                    </p>
                    <ul className="mt-5 space-y-4 text-sm leading-7 text-brand-grey">
                      <li>
                        1. A team member reviews your application and documents.
                      </li>
                      <li>
                        2. We confirm vehicle availability and the approved
                        handoff details.
                      </li>
                      <li>
                        3. You receive a secure checkout link if approved.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {pageSeo}
      <div className="min-h-screen bg-brand-navy">
        <section className="relative overflow-hidden border-b border-white/10 pt-24 sm:pt-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,40,0.18),transparent_32%)]" />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-12 lg:pb-16 lg:pt-14">
            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="lg:sticky lg:top-28"
            >
              <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-black/10 p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold">
                  Driver onboarding
                </p>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl xl:text-6xl">
                  Apply to Drive with{" "}
                  <span className="font-serif italic text-brand-gold">
                    Maple Rentals
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-8 text-brand-grey sm:text-lg">
                  Build your weekly earnings with a premium onboarding program
                  designed for Uber drivers. Quick approval, reliable cars, and
                  direct support keep onboarding simple.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    { value: "24-48h", label: "Typical review window" },
                    { value: "Weekly", label: "Rental cadence" },
                    { value: "Uber-ready", label: "Vehicle standard" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                    >
                      <p className="text-2xl font-bold tracking-tight text-white">
                        {item.value}
                      </p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-grey">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <TrustPill key={signal} text={signal} />
                  ))}
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "Weekly earning focus",
                      text: "Share your driving goals and weekly budget so we can review the right rental setup privately.",
                    },
                    {
                      title: "Reliable vehicles",
                      text: "Hybrid, Uber-ready cars prepared to keep you on the road longer.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                    >
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-brand-grey">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-[1.75rem] border border-brand-gold/20 bg-brand-gold/8 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-gold" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Fast, premium onboarding
                      </p>
                      <p className="mt-2 text-sm leading-7 text-brand-grey">
                        Complete the form in a few minutes, upload your licence
                        documents securely, and receive a decision-ready
                        application for review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-grey">
                      What we look for
                    </p>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-brand-grey">
                      <li>
                        • A valid Australian licence and clean document uploads.
                      </li>
                      <li>
                        • Willingness to drive regularly and keep a professional
                        standard.
                      </li>
                      <li>
                        • Clear onboarding details that help us match the right
                        rental setup.
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-grey">
                      Why drivers choose Maple
                    </p>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-brand-grey">
                      <li>
                        • Vehicle pricing and registration details are confirmed
                        privately after approval.
                      </li>
                      <li>
                        • Premium support through the application and handoff.
                      </li>
                      <li>
                        • Reliable fleet choices designed for ride-share work.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_30px_100px_rgba(0,0,0,0.24)]"
            >
              <div className="border-b border-white/10 px-6 py-5 sm:px-8">
                <div className="flex flex-wrap items-center gap-3">
                  <StepBadge step="1" label="Identity" active={step >= 1} />
                  <div className="hidden h-px flex-1 bg-white/10 sm:block" />
                  <StepBadge step="2" label="Licence" active={step >= 2} />
                  <div className="hidden h-px flex-1 bg-white/10 sm:block" />
                  <StepBadge step="3" label="Experience" active={step >= 2} />
                </div>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                {pageError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                      <p className="text-sm leading-7 text-red-50">
                        {pageError}
                      </p>
                    </div>
                  </div>
                )}

                <motion.form onSubmit={handleFormSubmit} className="space-y-6">
                  {step === 1 && (
                    <SectionShell
                      eyebrow="Step 1"
                      title="Personal Info"
                      description="Tell us who you are and how we can reach you. We keep this fast, clear, and mobile-friendly."
                      icon={User}
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <FormLabel>Full name</FormLabel>
                          <input
                            {...register("name")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="As shown on your licence"
                          />
                          <FieldError message={errors.name?.message} />
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Mobile number</FormLabel>
                          <input
                            {...register("phone")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="0412 345 678"
                          />
                          <FieldError message={errors.phone?.message} />
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Email address</FormLabel>
                          <input
                            {...register("email")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="driver@example.com"
                          />
                          <FieldError message={errors.email?.message} />
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Intended start date</FormLabel>
                          <input
                            type="date"
                            {...register("intended_start_date")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors focus:border-brand-gold"
                          />
                          <FieldError
                            message={errors.intended_start_date?.message}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <FormLabel>Residential address</FormLabel>
                          <textarea
                            {...register("address")}
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="Street, suburb, state, postcode"
                          />
                          <FieldError message={errors.address?.message} />
                        </div>
                      </div>
                    </SectionShell>
                  )}

                  {step === 2 && (
                    <SectionShell
                      eyebrow="Step 2"
                      title="Licence Details"
                      description="Upload the front and back of your licence so we can verify your identity and keep approval moving."
                      icon={ShieldCheck}
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <FormLabel>Licence number</FormLabel>
                          <input
                            {...register("license_number")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="NSW licence number"
                          />
                          <FieldError
                            message={errors.license_number?.message}
                          />
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Licence expiry</FormLabel>
                          <input
                            type="date"
                            {...register("license_expiry")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors focus:border-brand-gold"
                          />
                          <FieldError
                            message={errors.license_expiry?.message}
                          />
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-grey">
                            Front photo
                          </p>
                          <p className="mt-2 text-sm leading-7 text-brand-grey">
                            Upload a clear JPG or PNG. Maximum file size is{" "}
                            {MAX_UPLOAD_SIZE_MB} MB.
                          </p>
                          <label className="mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center transition-colors hover:border-brand-gold/40">
                            <Upload className="h-5 w-5 text-brand-gold" />
                            <span className="text-xs font-bold uppercase tracking-[0.28em] text-white">
                              Upload front photo
                            </span>
                            <span className="text-xs text-brand-grey">
                              {licensePhoto
                                ? licensePhoto.name
                                : "Choose an image file"}
                            </span>
                            <input
                              type="file"
                              accept={APPLICATION_IMAGE_CONTENT_TYPES.join(",")}
                              className="hidden"
                              onChange={(event) =>
                                handleFileUpload(event, "license_photo")
                              }
                            />
                          </label>
                          <div className="mt-4">
                            <FieldError
                              message={errors.license_photo?.message}
                            />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-grey">
                            Back photo
                          </p>
                          <p className="mt-2 text-sm leading-7 text-brand-grey">
                            Upload the back of your licence as a clear JPG or
                            PNG.
                          </p>
                          <label className="mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center transition-colors hover:border-brand-gold/40">
                            <Upload className="h-5 w-5 text-brand-gold" />
                            <span className="text-xs font-bold uppercase tracking-[0.28em] text-white">
                              Upload back photo
                            </span>
                            <span className="text-xs text-brand-grey">
                              {licenseBackPhoto
                                ? licenseBackPhoto.name
                                : "Choose an image file"}
                            </span>
                            <input
                              type="file"
                              accept={APPLICATION_IMAGE_CONTENT_TYPES.join(",")}
                              className="hidden"
                              onChange={(event) =>
                                handleFileUpload(event, "license_back_photo")
                              }
                            />
                          </label>
                          <div className="mt-4">
                            <FieldError
                              message={errors.license_back_photo?.message}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-brand-gold/15 bg-brand-gold/8 px-5 py-4 text-sm leading-7 text-brand-grey">
                        Complete uploads help us move faster and reduce
                        back-and-forth after submission.
                      </div>
                    </SectionShell>
                  )}

                  {step === 2 && (
                    <SectionShell
                      eyebrow="Step 3"
                      title="Driving Experience"
                      description="Share your background and weekly budget so we can align the right rental setup during review."
                      icon={Loader2}
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <FormLabel>Uber status</FormLabel>
                          <select
                            {...register("uber_status")}
                            className="w-full appearance-none rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors focus:border-brand-gold"
                          >
                            <option value="Active">Active Driver</option>
                            <option value="Applying">Applying</option>
                            <option value="Not Yet Registered">
                              Not Yet Registered
                            </option>
                          </select>
                          <FieldError message={errors.uber_status?.message} />
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Rideshare experience</FormLabel>
                          <select
                            {...register("experience")}
                            className="w-full appearance-none rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors focus:border-brand-gold"
                          >
                            <option value="New Driver">New Driver</option>
                            <option value="Less than 1 year">
                              Less than 1 year
                            </option>
                            <option value="1-3 years">1-3 years</option>
                            <option value="3+ years">3+ years</option>
                          </select>
                          <FieldError message={errors.experience?.message} />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <FormLabel>Weekly budget</FormLabel>
                          <input
                            {...register("weekly_budget")}
                            className="w-full rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold"
                            placeholder="Optional: e.g. $350"
                          />
                          <FieldError message={errors.weekly_budget?.message} />
                        </div>
                      </div>
                    </SectionShell>
                  )}

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 2) {
                          setStep(1);
                          setPageError(null);
                          return;
                        }

                        void goToNextStep();
                      }}
                      className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 px-7 py-4 text-xs font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/5"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {step === 2 ? "Back" : "Continue"}
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-gold px-8 py-4 text-xs font-bold uppercase tracking-[0.24em] text-brand-navy transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting
                        </>
                      ) : (
                        <>
                          Submit application
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.form>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}
