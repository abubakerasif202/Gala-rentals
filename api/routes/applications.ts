import express from 'express';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { authenticateAdmin } from './auth.js';
import {
  applicationApprovalSchema,
  applicationSchema,
  applicationStatusEnum,
} from '../validation.js';
import { z } from 'zod';
import crypto from 'crypto';
import { createCheckoutToken } from '../checkoutTokens.js';
import {
  getApplicationCreatedAtColumn,
  getApplicationDuplicateCheckColumns,
  getApplicationDocumentColumn,
  getApplicationSelectColumns,
  getCarSelectColumns,
  toApplicationPaymentWritePayload,
  toApplicationWritePayload,
} from '../schemaCompat.js';
import { RENTAL_PLAN_SETUP_FEES_AUD, STRIPE_CONFIG } from '../constants.js';
import { buildDriverPaymentLink, sendDriverPaymentLinkEmail } from '../paymentLinks.js';
import {
  assertVehicleAllocationAvailable,
  VehicleAllocationConflictError,
} from '../vehicleAllocations.js';
import { handleVehicleCheckoutCompletion } from '../paymentActivation.js';
import {
  APPLICATION_IMAGE_CONTENT_TYPES,
  MAX_APPLICATION_UPLOAD_BYTES,
  normalizeApplicationEmail,
} from '../../shared/applicationSubmission.js';

const router = express.Router();
const APPLICATIONS_BUCKET = 'applications';
const DOCUMENT_URL_TTL_SECONDS = 60 * 15;
const ALLOWED_APPLICATION_IMAGE_TYPES = new Set<string>(APPLICATION_IMAGE_CONTENT_TYPES);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);
const SUPABASE_STORAGE_PATH_PREFIXES = [
  `/storage/v1/object/public/${APPLICATIONS_BUCKET}/`,
  `/storage/v1/object/sign/${APPLICATIONS_BUCKET}/`,
  `/object/public/${APPLICATIONS_BUCKET}/`,
  `/object/sign/${APPLICATIONS_BUCKET}/`,
];

const extractStoragePath = (value: string) => {
  if (!isAbsoluteUrl(value)) {
    return value;
  }

  try {
    const { pathname } = new URL(value);
    const prefix = SUPABASE_STORAGE_PATH_PREFIXES.find((candidate) => pathname.includes(candidate));

    if (!prefix) {
      return null;
    }

    return decodeURIComponent(pathname.slice(pathname.indexOf(prefix) + prefix.length));
  } catch {
    return null;
  }
};

const createSignedDocumentUrl = async (path: string | null | undefined) => {
  if (!path) {
    return null;
  }

  const storagePath = extractStoragePath(path);
  if (!storagePath) {
    return path;
  }

  const { data, error } = await db.storage
    .from(APPLICATIONS_BUCKET)
    .createSignedUrl(storagePath, DOCUMENT_URL_TTL_SECONDS);

  if (error) {
    console.error(`Failed to sign application document ${storagePath}:`, error);
    return null;
  }

  return data.signedUrl;
};

type ApplicationPaymentApprovalRecord = {
  approved_bond?: number | null;
  approved_weekly_price?: number | null;
  assigned_car_id?: number | null;
  email: string;
  id: number;
  name: string;
  payment_link_version?: number | null;
  pending_checkout_session_id?: string | null;
  status: string;
};

const isRecoverableVehicleCheckoutSession = (
  session: Stripe.Checkout.Session,
  application: ApplicationPaymentApprovalRecord
) =>
  session.status === 'complete' &&
  session.payment_status === 'paid' &&
  session.metadata?.checkout_kind === 'vehicle' &&
  Number(session.metadata?.application_id || 0) === application.id &&
  Number(session.metadata?.car_id || 0) === Number(application.assigned_car_id || 0) &&
  Number(session.metadata?.payment_link_version || 0) ===
    Number(application.payment_link_version || 0);

const recoverPaymentReviewSession = async (application: ApplicationPaymentApprovalRecord) => {
  const storedSessionId = application.pending_checkout_session_id;

  if (storedSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(storedSessionId);
      if (isRecoverableVehicleCheckoutSession(session, application)) {
        return session;
      }
    } catch (error) {
      console.warn(`Unable to retrieve stored checkout session ${storedSessionId}:`, error);
    }
  }

  const matches: Stripe.Checkout.Session[] = [];
  let cursor: string | undefined;
  while (true) {
    const sessionPage = await stripe.checkout.sessions.list({
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    for (const session of sessionPage.data) {
      if (!isRecoverableVehicleCheckoutSession(session, application)) {
        continue;
      }

      matches.push(session);

      if (matches.length > 1) {
        throw createRequestError(
          409,
          'Multiple paid Stripe checkout sessions were found for this payment review. Reconcile the payment manually before retrying activation.'
        );
      }
    }

    if (!sessionPage.has_more || sessionPage.data.length === 0) {
      break;
    }

    cursor = sessionPage.data[sessionPage.data.length - 1]?.id;
  }

  return matches[0] || null;
};

const getApplicationBackPhotoValue = (application: Record<string, any>) =>
  application.license_back_photo ??
  application.uber_screenshot ??
  application.uberScreenshot ??
  null;

const createRequestError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeEmailHeaderValue = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

const removeUploadedApplicationDocuments = async (paths: string[]) => {
  if (paths.length === 0) {
    return;
  }

  const { error } = await db.storage.from(APPLICATIONS_BUCKET).remove(paths);

  if (error) {
    console.warn('Failed to clean up uploaded application documents:', error);
  }
};

router.get('/', authenticateAdmin, async (_req, res) => {
  const selectColumns = await getApplicationSelectColumns();
  const orderColumn = await getApplicationCreatedAtColumn();
  const { data, error } = await db
    .from('applications')
    .select(selectColumns)
    .order(orderColumn, { ascending: false });
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }

  const rows = ((data || []) as Array<Record<string, any>>);
  const applications = await Promise.all(
    rows.map(async (application) => {
      const {
        uber_screenshot: _legacyUberScreenshot,
        uberScreenshot: _legacyUberScreenshotCamel,
        ...rest
      } = application;

      return {
        ...rest,
        license_photo: await createSignedDocumentUrl(application.license_photo),
        license_back_photo: await createSignedDocumentUrl(getApplicationBackPhotoValue(application)),
      };
    })
  );

  res.json(applications);
});

router.get('/:id/documents/:document', authenticateAdmin, async (req, res) => {
  try {
    const { document } = z.object({
      document: z.enum(['license_photo', 'license_back_photo']),
    }).parse(req.params);

    const documentColumn = await getApplicationDocumentColumn(document);
    const selectColumn =
      documentColumn === document ? document : `${document}:${documentColumn}`;

    const { data: application, error } = await db
      .from('applications')
      .select(`id, ${selectColumn}`)
      .eq('id', req.params.id)
      .single();

    if (error || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const documentValue =
      application[document] ?? (document === 'license_back_photo' ? getApplicationBackPhotoValue(application) : null);
    const signedUrl = await createSignedDocumentUrl(documentValue);
    if (!signedUrl) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ url: signedUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Application document fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch application document' });
  }
});

router.post('/', async (req, res) => {
  const uploadedPaths: string[] = [];

  try {
    const data = applicationSchema.parse(req.body);
    const email = data.email;

    if (!email) {
      throw createRequestError(400, 'Email is required.');
    }

    const normalizedApplicationData = {
      ...data,
      email,
    };
    let licensePhotoUrl = null;
    let licenseBackPhotoUrl = null;
    const existingApplicationSelectColumns = await getApplicationDuplicateCheckColumns();
    const { data: existingApplications, error: existingApplicationError } = await db
      .from('applications')
      .select(existingApplicationSelectColumns)
      .ilike('email', normalizedApplicationData.email);

    if (existingApplicationError) {
      throw existingApplicationError;
    }

    const matchingApplications = ((existingApplications ?? []) as Array<Record<string, any>>).filter(
      (application) =>
        normalizeApplicationEmail(String(application.email ?? '')) ===
        normalizedApplicationData.email
    );

    const existingRow = matchingApplications[0] ?? null;

    if (existingRow) {
      if (
        existingRow.phone !== normalizedApplicationData.phone ||
        existingRow.license_number !== normalizedApplicationData.license_number
      ) {
        return res.status(409).json({
          error: 'An application already exists for this email. Contact support to continue.',
        });
      }

      if (existingRow.status === 'Pending') {
        return res.status(409).json({
          error: 'This application is already under review. Contact support if you need to update it.',
        });
      }

      if (existingRow.status === 'Rejected') {
        return res.status(409).json({
          error: 'This application has already been reviewed. Contact support to reopen it securely.',
        });
      }

      if (['Approved', 'Paid', 'Payment Review'].includes(String(existingRow.status))) {
        return res.status(409).json({
          error: 'This application has already been submitted and is being processed.',
        });
      }
    }

    const uploadImage = async (
      base64Str: string,
      filePrefix: string,
      fieldLabel: string
    ) => {
      const match = base64Str.match(/^data:([a-zA-Z0-9-+/=.]+);base64,(.+)$/);
      if (!match) {
        throw createRequestError(400, `${fieldLabel} must be a valid image data URL.`);
      }

      const [, contentType, base64Data] = match;
      const normalizedContentType = contentType.toLowerCase();

      if (!ALLOWED_APPLICATION_IMAGE_TYPES.has(normalizedContentType)) {
        throw createRequestError(400, `${fieldLabel} must be a JPG or PNG image.`);
      }

      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length === 0) {
        throw createRequestError(400, `${fieldLabel} could not be read.`);
      }

      if (buffer.length > MAX_APPLICATION_UPLOAD_BYTES) {
        throw createRequestError(400, `${fieldLabel} must be smaller than 7 MB.`);
      }

      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${filePrefix}`;

      const { data: uploadData, error: uploadError } = await db.storage
        .from(APPLICATIONS_BUCKET)
        .upload(filename, buffer, { contentType: normalizedContentType });

      if (uploadError) {
        console.error(`Error uploading ${filePrefix}:`, uploadError);
        throw createRequestError(500, `Failed to upload ${fieldLabel.toLowerCase()}.`);
      }

      const uploadedPath = uploadData.path || filename;
      uploadedPaths.push(uploadedPath);
      return uploadedPath;
    };

    if (data.license_photo) {
      licensePhotoUrl = await uploadImage(
        data.license_photo,
        'license',
        'Driver licence front photo'
      );
    }

    if (data.license_back_photo) {
      licenseBackPhotoUrl = await uploadImage(
        data.license_back_photo,
        'license-back',
        'Driver licence back photo'
      );
    }

    const payload = await toApplicationWritePayload({
      ...normalizedApplicationData,
      weekly_budget: normalizedApplicationData.weekly_budget?.trim() || null,
      license_photo: licensePhotoUrl,
      license_back_photo: licenseBackPhotoUrl,
    });
    const { data: inserted, error } = await db
      .from('applications')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    const applicationId = Number(inserted.id);

    // Send Confirmation Emails via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@maplerentals.com.au';
        const safeApplicantName = escapeHtml(normalizedApplicationData.name);
        const safeApplicantEmail = escapeHtml(normalizedApplicationData.email);
        const safeApplicantPhone = escapeHtml(normalizedApplicationData.phone);
        const safeApplicantAddress = escapeHtml(normalizedApplicationData.address);
        const safeUberStatus = escapeHtml(normalizedApplicationData.uber_status);
        const safeExperience = escapeHtml(normalizedApplicationData.experience);
        const safeIntendedStart = escapeHtml(normalizedApplicationData.intended_start_date);
        const applicantNameForSubject = sanitizeEmailHeaderValue(normalizedApplicationData.name);

        // Email to the Applicant
        await resend.emails.send({
          from: 'Maple Rentals <noreply@maplerentals.com.au>',
          to: normalizedApplicationData.email,
          subject: 'Application Received - Maple Rentals',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
              <h2 style="color: #D4AF37;">Application Received</h2>
              <p>Hi ${safeApplicantName},</p>
              <p>Thank you for applying to rent a Toyota Camry Hybrid with Maple Rentals.</p>
              <p>We have successfully received your application, including the front and back of your driver licence. Our team will review your application and try to get back to you within 24 hours.</p>
              <p>If you have any urgent questions, please contact us directly.</p>
              <br>
              <p>Best regards,</p>
              <p><strong>The Maple Rentals Team</strong></p>
            </div>
          `
        });

        // Email to the Admin
        await resend.emails.send({
          from: 'Maple Rentals Notifications <noreply@maplerentals.com.au>',
          to: adminEmail,
          subject: `New Driver Application: ${applicantNameForSubject}`,
          html: `
            <div style="font-family: sans-serif; color: #1a202c;">
              <h2>New Driver Application</h2>
              <p>A new driver application has been submitted:</p>
              <ul>
                <li><strong>Name:</strong> ${safeApplicantName}</li>
                <li><strong>Phone:</strong> ${safeApplicantPhone}</li>
                <li><strong>Email:</strong> ${safeApplicantEmail}</li>
                <li><strong>Address:</strong> ${safeApplicantAddress}</li>
                <li><strong>Uber Status:</strong> ${safeUberStatus}</li>
                <li><strong>Experience:</strong> ${safeExperience}</li>
                <li><strong>Intended Start:</strong> ${safeIntendedStart}</li>
              </ul>
              <p>Please log in to the admin dashboard to review their documents and approve/deny the application.</p>
            </div>
          `
        });
        console.log(
          `Confirmation emails sent successfully for applicant: ${normalizedApplicationData.email}`
        );
      } catch (emailError) {
        console.error("Failed to send Resend emails:", emailError);
      }
    }

    res.json({
      success: true,
      application_id: String(applicationId),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }

    await removeUploadedApplicationDocuments(uploadedPaths);

    if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
      return res.status(err.status).json({ error: err.message });
    }

    console.error('Application submission error:', err);
    res.status(500).json({ error: 'Application submission failed' });
  }
});

router.post('/:id/approve-payment', authenticateAdmin, async (req, res) => {
  try {
    const payload = applicationApprovalSchema.parse({
      ...req.body,
      application_id: req.params.id,
    });
    const selectColumns = await getApplicationSelectColumns();
    const { data: application, error: applicationError } = await db
      .from('applications')
      .select(selectColumns)
      .eq('id', payload.application_id)
      .single();

    if (applicationError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const applicationRecord = application as unknown as ApplicationPaymentApprovalRecord;

    if (applicationRecord.status === 'Paid') {
      return res.status(409).json({ error: 'This application has already been paid.' });
    }

    if (applicationRecord.status === 'Payment Review') {
      return res.status(409).json({
        error:
          'This application is already paid and awaiting manual activation review. Use the retry activation flow instead of sending a new payment link.',
      });
    }

    if (applicationRecord.status === 'Rejected') {
      return res.status(409).json({ error: 'Rejected applications cannot be approved for payment.' });
    }

    const { data: car, error: carError } = await db
      .from('cars')
      .select(await getCarSelectColumns())
      .eq('id', payload.assigned_car_id)
      .single();

    if (carError || !car) {
      return res.status(404).json({ error: 'Assigned vehicle not found' });
    }

    if (car.status !== 'Available') {
      return res.status(409).json({ error: 'Assigned vehicle is not available.' });
    }

    await assertVehicleAllocationAvailable({
      applicationId: payload.application_id,
      carId: payload.assigned_car_id,
      message:
        'Assigned vehicle already has another active approval or payment review. Resolve that allocation first.',
    });

    const currentVersion = Number(applicationRecord.payment_link_version || 0);
    const nextVersion = currentVersion + 1;
    const nowIso = new Date().toISOString();

    if (applicationRecord.pending_checkout_session_id) {
      try {
        await stripe.checkout.sessions.expire(applicationRecord.pending_checkout_session_id);
      } catch (expireError) {
        console.warn(
          `Unable to expire pending checkout session ${applicationRecord.pending_checkout_session_id}:`,
          expireError
        );
      }
    }

    const updatePayload = await toApplicationPaymentWritePayload({
      approved_at: nowIso,
      approved_bond: payload.approved_bond,
      approved_weekly_price: payload.approved_weekly_price,
      assigned_car_id: payload.assigned_car_id,
      paid_at: null,
      payment_link_sent_at: payload.send_payment_link ? nowIso : null,
      payment_link_version: nextVersion,
      pending_checkout_session_id: null,
      status: 'Approved',
    });

    const { error: updateError } = await db
      .from('applications')
      .update(updatePayload)
      .eq('id', payload.application_id);

    if (updateError) {
      throw updateError;
    }

    const checkoutToken = createCheckoutToken({
      applicationId: payload.application_id,
      carId: payload.assigned_car_id,
      purpose: 'vehicle',
      version: nextVersion,
    });
    const checkoutUrl = buildDriverPaymentLink({
      applicationId: payload.application_id,
      carId: payload.assigned_car_id,
      token: checkoutToken.token,
    });

    let emailDelivery = {
      delivered: false,
      reason: null as string | null,
    };

    if (payload.send_payment_link) {
      emailDelivery = await sendDriverPaymentLinkEmail({
        applicantEmail: applicationRecord.email,
        applicantName: applicationRecord.name,
        approvedBond: payload.approved_bond,
        approvedWeeklyPrice: payload.approved_weekly_price,
        carName: car.name,
        checkoutUrl,
        setupFees: RENTAL_PLAN_SETUP_FEES_AUD,
      });
    }

    res.json({
      success: true,
      checkout_token: checkoutToken.token,
      checkout_token_expires_at: checkoutToken.expiresAt,
      checkout_url: checkoutUrl,
      email_delivered: emailDelivery.delivered,
      email_reason: emailDelivery.reason,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof VehicleAllocationConflictError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Application approve-payment error:', error);
    res.status(500).json({ error: 'Failed to approve application for payment' });
  }
});

router.post('/:id/retry-payment-activation', authenticateAdmin, async (req, res) => {
  try {
    const applicationId = z.coerce.number().int().positive().parse(req.params.id);
    const selectColumns = await getApplicationSelectColumns();
    const { data: application, error: applicationError } = await db
      .from('applications')
      .select(selectColumns)
      .eq('id', applicationId)
      .single();

    if (applicationError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const applicationRecord = application as unknown as ApplicationPaymentApprovalRecord;

    if (applicationRecord.status !== 'Payment Review') {
      return res.status(409).json({
        error: 'Only applications in Payment Review can retry activation.',
      });
    }

    if (!applicationRecord.assigned_car_id) {
      return res.status(409).json({
        error: 'This payment review is missing its assigned vehicle.',
      });
    }

    const checkoutSession = await recoverPaymentReviewSession(applicationRecord);
    if (!checkoutSession || !checkoutSession.subscription) {
      return res.status(409).json({
        error:
          'We could not recover the paid checkout session for this application. Reconcile this payment manually in Stripe.',
      });
    }

    await handleVehicleCheckoutCompletion(checkoutSession);

    const { data: refreshedApplication, error: refreshedApplicationError } = await db
      .from('applications')
      .select(selectColumns)
      .eq('id', applicationId)
      .single();

    if (refreshedApplicationError || !refreshedApplication) {
      throw refreshedApplicationError || new Error('Application disappeared after activation retry.');
    }

    const refreshedRecord = refreshedApplication as unknown as ApplicationPaymentApprovalRecord;
    if (refreshedRecord.status !== 'Paid') {
      return res.status(409).json({
        error:
          'Activation is still blocked. Resolve the vehicle conflict or maintenance hold, then retry again.',
      });
    }

    res.json({ success: true, status: refreshedRecord.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Application retry-payment-activation error:', error);
    res.status(500).json({ error: 'Failed to retry payment activation' });
  }
});

router.put('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { data: existingApplication, error: applicationLookupError } = await db
      .from('applications')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (applicationLookupError) {
      throw applicationLookupError;
    }

    if (!existingApplication) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { status } = z.object({ status: applicationStatusEnum }).parse(req.body ?? {});
    if (status === 'Approved' || status === 'Paid' || status === 'Payment Review') {
      return res.status(400).json({
        error:
          'Use the payment approval flow to approve applications. Paid and Payment Review statuses are set by Stripe processing.',
      });
    }
    const { error } = await db.from('applications').update({ status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Application update error:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

export default router;
