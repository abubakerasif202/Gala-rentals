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
  getApplicationDocumentColumn,
  getApplicationSelectColumns,
  getCarSelectColumns,
  toApplicationPaymentWritePayload,
  toApplicationWritePayload,
} from '../schemaCompat.js';
import { RENTAL_PLAN_SETUP_FEES_AUD, STRIPE_CONFIG } from '../constants.js';
import { buildDriverPaymentLink, sendDriverPaymentLinkEmail } from '../paymentLinks.js';

const router = express.Router();
const APPLICATIONS_BUCKET = 'applications';
const DOCUMENT_URL_TTL_SECONDS = 60 * 15;
const MAX_APPLICATION_UPLOAD_BYTES = 7 * 1024 * 1024;
const ALLOWED_APPLICATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
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
  email: string;
  name: string;
  payment_link_version?: number | null;
  pending_checkout_session_id?: string | null;
  status: string;
};

const getApplicationBackPhotoValue = (application: Record<string, any>) =>
  application.license_back_photo ??
  application.uber_screenshot ??
  application.uberScreenshot ??
  null;

const createRequestError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

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
  try {
    const data = applicationSchema.parse(req.body);
    let licensePhotoUrl = null;
    let licenseBackPhotoUrl = null;
    const existingApplicationSelectColumns = await getApplicationSelectColumns();
    const { data: existingApplication, error: existingApplicationError } = await db
      .from('applications')
      .select(existingApplicationSelectColumns)
      .eq('email', data.email)
      .single();

    if (existingApplicationError && !isNoRowError(existingApplicationError)) {
      throw existingApplicationError;
    }

    const existingRow =
      existingApplicationError && isNoRowError(existingApplicationError)
        ? null
        : ((existingApplication ?? null) as Record<string, any> | null);
    const shouldResetRejectedApplication = existingRow?.status === 'Rejected';
    const shouldSendConfirmationEmails = !existingRow || shouldResetRejectedApplication;

    if (existingRow) {
      if (
        existingRow.phone !== data.phone ||
        existingRow.license_number !== data.license_number
      ) {
        return res.status(409).json({
          error: 'An application already exists for this email. Contact support to continue.',
        });
      }

      if (['Approved', 'Paid'].includes(existingRow.status)) {
        return res.status(409).json({
          error: 'This application has already been submitted and is being processed.',
        });
      }
    }

    const uploadImage = async (base64Str: string, filePrefix: string) => {
      const match = base64Str.match(/^data:([a-zA-Z0-9-+/=.]+);base64,(.+)$/);
      if (!match) return null;

      const [, contentType, base64Data] = match;
      
      // Basic validation of content type
      if (!contentType.startsWith('image/')) {
        console.error(`Invalid content type for ${filePrefix}: ${contentType}`);
        return null;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      
      // Check size (e.g., 10MB limit)
      if (buffer.length > 10 * 1024 * 1024) {
        console.error(`File too large for ${filePrefix}: ${buffer.length} bytes`);
        return null;
      }

      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${filePrefix}`;

      const { data: uploadData, error: uploadError } = await db.storage
        .from(APPLICATIONS_BUCKET)
        .upload(filename, buffer, { contentType });

      if (uploadError) {
        console.error(`Error uploading ${filePrefix}:`, uploadError);
        return null;
      }

      return uploadData.path || filename;
    };

    if (data.license_photo) {
      if (!data.license_photo.startsWith('data:')) {
        return res.status(400).json({ error: 'Driver licence front photo must be a valid image data URL' });
      }
      licensePhotoUrl = await uploadImage(data.license_photo, 'license');
      if (!licensePhotoUrl) {
        return res.status(500).json({ error: 'Failed to upload driver licence front photo' });
      }
    }

    if (data.license_back_photo) {
      if (!data.license_back_photo.startsWith('data:')) {
        return res.status(400).json({ error: 'Driver licence back photo must be a valid image data URL' });
      }
      licenseBackPhotoUrl = await uploadImage(data.license_back_photo, 'license-back');
      if (!licenseBackPhotoUrl) {
        return res.status(500).json({ error: 'Failed to upload driver licence back photo' });
      }
    }

    const payload = await toApplicationWritePayload({
      ...data,
      license_photo: licensePhotoUrl,
      license_back_photo: licenseBackPhotoUrl,
    });
    let applicationId: number;

    if (existingRow) {
      const updatePayload = shouldResetRejectedApplication
        ? { ...payload, status: 'Pending' }
        : payload;
      const { error: updateError } = await db
        .from('applications')
        .update(updatePayload)
        .eq('id', existingRow.id);

      if (updateError) {
        throw updateError;
      }

      applicationId = Number(existingRow.id);
    } else {
      const { data: inserted, error } = await db
        .from('applications')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;
      applicationId = Number(inserted.id);
    }

    // Send Confirmation Emails via Resend
    if (process.env.RESEND_API_KEY && shouldSendConfirmationEmails) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@maplerentals.com.au';

        // Email to the Applicant
        await resend.emails.send({
          from: 'Maple Rentals <noreply@maplerentals.com.au>',
          to: data.email,
          subject: 'Application Received - Maple Rentals',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
              <h2 style="color: #D4AF37;">Application Received</h2>
              <p>Hi ${data.name},</p>
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
          subject: `New Driver Application: ${data.name}`,
          html: `
            <div style="font-family: sans-serif; color: #1a202c;">
              <h2>New Driver Application</h2>
              <p>A new driver application has been submitted:</p>
              <ul>
                <li><strong>Name:</strong> ${data.name}</li>
                <li><strong>Phone:</strong> ${data.phone}</li>
                <li><strong>Email:</strong> ${data.email}</li>
                <li><strong>Address:</strong> ${data.address}</li>
                <li><strong>Uber Status:</strong> ${data.uber_status}</li>
                <li><strong>Experience:</strong> ${data.experience}</li>
                <li><strong>Intended Start:</strong> ${data.intended_start_date}</li>
              </ul>
              <p>Please log in to the admin dashboard to review their documents and approve/deny the application.</p>
            </div>
          `
        });
        console.log(`Confirmation emails sent successfully for applicant: ${data.email}`);
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

    console.error('Application approve-payment error:', error);
    res.status(500).json({ error: 'Failed to approve application for payment' });
  }
});

router.put('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status } = z.object({ status: applicationStatusEnum }).parse(req.body ?? {});
    if (status === 'Approved' || status === 'Paid') {
      return res.status(400).json({
        error: 'Use the payment approval flow to approve applications. Paid status is set by Stripe.',
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
