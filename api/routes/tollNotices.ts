import express from 'express';
import { z } from 'zod';

import { db } from '../db/index.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { buildTollTransferNoticePdf } from '../templates/tollTransferNoticePdf.js';

const router = express.Router();

const COMPANY_DETAILS = {
  organisation_address: '13/27-33 Adderstone Rd, Merrylands NSW 2160',
  organisation_name: 'MAPLE PAINTING PTY LTD',
  organisation_phone: '0420 550 566',
};

const responsibleTypeSchema = z
  .enum(['responsible', 'new-owner', 'previous-owner'])
  .default('responsible');
const statusSchema = z.enum(['draft', 'generated', 'sent']);
const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));

const tollNoticePayloadSchema = z.object({
  application_id: z.string().trim().uuid().nullable().optional(),
  authorised_officer_name: z.string().trim().min(1, 'Authorised officer name is required'),
  car_id: z.coerce.number().int().positive().nullable().optional(),
  customer_id: z.coerce.number().int().positive().nullable().optional(),
  declaration_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Declaration date is required'),
  declaration_place: z.string().trim().min(1, 'Declaration place is required'),
  nominee_address: z.string().trim().min(1, 'Address is required'),
  nominee_country: z.string().trim().min(1).default('AUSTRALIA'),
  nominee_dob: optionalDateSchema,
  nominee_full_name: z.string().trim().min(1, 'Customer full name is required'),
  nominee_phone: z.string().trim().min(1, 'Phone is required'),
  nominee_postcode: z.string().trim().min(1, 'Postcode is required'),
  nominee_state: z.string().trim().min(1, 'State is required'),
  nominee_suburb: z.string().trim().min(1, 'Suburb is required'),
  rental_id: z.coerce.number().int().positive().nullable().optional(),
  responsible_type: responsibleTypeSchema,
  toll_notice_number: z.string().trim().min(1, 'Toll notice number is required'),
  toll_trip_date: optionalDateSchema,
  vehicle_registration: z.string().trim().min(1, 'Vehicle registration is required'),
  witness_jp_number: z.string().trim().nullable().optional(),
  witness_name: z.string().trim().nullable().optional(),
  witness_qualification: z.string().trim().nullable().optional(),
});

type TollNoticePayload = z.infer<typeof tollNoticePayloadSchema>;

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const markSentSchema = z.object({
  status: z.literal('sent'),
});

const normalizeSearch = (value: unknown) => String(value ?? '').trim().toLowerCase();

const splitFullName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { given_names: '', surname: parts[0] || '' };
  }

  return {
    given_names: parts.slice(0, -1).join(' '),
    surname: parts[parts.length - 1],
  };
};

const parseAddressParts = (address: string | null | undefined) => {
  const value = String(address || '').trim();
  const match = value.match(/^(.*?)[,\s]+([A-Za-z ]+)\s+(NSW|ACT|VIC|QLD|SA|WA|TAS|NT)\s+(\d{4})$/i);

  if (!match) {
    return {
      address: value,
      postcode: '',
      state: 'NSW',
      suburb: '',
    };
  }

  return {
    address: match[1]?.replace(/,\s*$/, '').trim() || value,
    postcode: match[4] || '',
    state: (match[3] || 'NSW').toUpperCase(),
    suburb: (match[2] || '').trim().toUpperCase(),
  };
};

const inferVehicleRegistration = (car: Record<string, unknown> | undefined) => {
  const name = String(car?.name || '');
  const bracketMatch = name.match(/\(([A-Z0-9]{2,8})\)\s*$/i);
  if (bracketMatch) {
    return bracketMatch[1].toUpperCase();
  }

  return '';
};

const auditNoticeAction = async ({
  action,
  actor,
  metadata = {},
  noticeId,
}: {
  action: string;
  actor?: string | null;
  metadata?: Record<string, unknown>;
  noticeId: number;
}) => {
  const { error } = await db.from('toll_transfer_notice_audit_events').insert([
    {
      action,
      actor: actor || null,
      metadata,
      toll_transfer_notice_id: noticeId,
    },
  ]);

  if (error) {
    console.warn('Failed to record toll transfer notice audit event', {
      action,
      noticeId,
      reason: error.message,
    });
  }
};

const getAdminEmail = (req: express.Request) =>
  typeof req.admin?.email === 'string' ? req.admin.email : null;

const fetchNoticeById = async (id: number) => {
  const { data, error } = await db
    .from('toll_transfer_notices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Record<string, unknown>;
};

const loadRentalPrefillOptions = async (search: string) => {
  const { data: rentals, error: rentalsError } = await db
    .from('rentals')
    .select('*')
    .in('status', ['Active', 'Overdue'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (rentalsError) {
    throw rentalsError;
  }

  const rentalRows = (rentals || []) as Array<Record<string, unknown>>;
  const applicationIds = Array.from(
    new Set(rentalRows.map((rental) => String(rental.application_id || '')).filter(Boolean))
  );
  const carIds = Array.from(
    new Set(
      rentalRows
        .map((rental) => Number(rental.car_id || 0))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const [applicationsResult, carsResult, customersResult] = await Promise.all([
    applicationIds.length
      ? db
          .from('applications')
          .select('id, name, phone, email, address, approved_vehicle')
          .in('id', applicationIds)
      : Promise.resolve({ data: [], error: null }),
    carIds.length
      ? db
          .from('cars')
          .select('id, name')
          .in('id', carIds)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('customers')
      .select('id, full_name, phone, email, date_of_birth, street, city, state, postcode')
      .limit(500),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (carsResult.error) throw carsResult.error;
  if (customersResult.error) throw customersResult.error;

  const applicationsById = new Map<string, Record<string, unknown>>();
  for (const application of applicationsResult.data || []) {
    applicationsById.set(String(application.id), application as Record<string, unknown>);
  }

  const carsById = new Map<number, Record<string, unknown>>();
  for (const car of carsResult.data || []) {
    carsById.set(Number(car.id), car as Record<string, unknown>);
  }

  const customerRows = (customersResult.data || []) as Array<Record<string, unknown>>;
  const customerForApplication = (application: Record<string, unknown> | undefined) => {
    if (!application) {
      return null;
    }

    const email = normalizeSearch(application.email);
    const phone = normalizeSearch(application.phone);
    const name = normalizeSearch(application.name);

    return (
      customerRows.find(
        (customer) =>
          (email && normalizeSearch(customer.email) === email) ||
          (phone && normalizeSearch(customer.phone) === phone) ||
          (name && normalizeSearch(customer.full_name) === name)
      ) || null
    );
  };

  const query = normalizeSearch(search);

  return rentalRows
    .map((rental) => {
      const application = applicationsById.get(String(rental.application_id || ''));
      const car = carsById.get(Number(rental.car_id || 0));
      const customer = customerForApplication(application);
      const addressParts = parseAddressParts(
        String(customer?.street || '') ||
          String(application?.address || '')
      );
      const fullName = String(customer?.full_name || application?.name || '').trim();
      const { given_names, surname } = splitFullName(fullName);
      const vehicleRegistration = inferVehicleRegistration(car);

      return {
        application_id: String(rental.application_id || ''),
        applicant_name: fullName,
        car_id: Number(rental.car_id || 0) || null,
        car_name: String(car?.name || application?.approved_vehicle || ''),
        customer_id: customer?.id ? Number(customer.id) : null,
        nominee_address: addressParts.address,
        nominee_country: 'AUSTRALIA',
        nominee_dob: customer?.date_of_birth || null,
        nominee_full_name: fullName,
        nominee_given_names: given_names,
        nominee_phone: String(customer?.phone || application?.phone || ''),
        nominee_postcode: customer?.postcode ? String(customer.postcode) : addressParts.postcode,
        nominee_state: customer?.state ? String(customer.state) : addressParts.state,
        nominee_suburb: customer?.city ? String(customer.city) : addressParts.suburb,
        nominee_surname: surname,
        rental_id: Number(rental.id),
        rental_status: String(rental.status || ''),
        vehicle_registration: vehicleRegistration,
      };
    })
    .filter((option) => {
      if (!query) return true;

      return [
        option.nominee_full_name,
        option.nominee_phone,
        option.vehicle_registration,
        option.application_id,
        option.car_name,
      ].some((value) => normalizeSearch(value).includes(query));
    });
};

const toRecordPayload = (payload: TollNoticePayload, req: express.Request) => ({
  ...payload,
  application_id: payload.application_id || null,
  car_id: payload.car_id || null,
  customer_id: payload.customer_id || null,
  nominee_country: payload.nominee_country.toUpperCase(),
  nominee_dob: payload.nominee_dob || null,
  pdf_url: null,
  rental_id: payload.rental_id || null,
  status: 'generated',
  toll_trip_date: payload.toll_trip_date || null,
  created_by: getAdminEmail(req),
});

router.get('/company-defaults', authenticateAdmin, (_req, res) => {
  res.json(COMPANY_DETAILS);
});

router.get('/rental-options', authenticateAdmin, async (req, res) => {
  try {
    const options = await loadRentalPrefillOptions(String(req.query.search || ''));
    res.json({ items: options });
  } catch (error) {
    console.error('Fetch toll notice rental options error:', error);
    res.status(500).json({ error: 'Failed to fetch rental options' });
  }
});

router.get('/', authenticateAdmin, async (_req, res) => {
  try {
    const { data, error } = await db
      .from('toll_transfer_notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Fetch toll transfer notices error:', error);
    res.status(500).json({ error: 'Failed to fetch toll transfer notices' });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const payload = tollNoticePayloadSchema.parse(req.body);
    const insertPayload = toRecordPayload(payload, req);
    const { data: inserted, error } = await db
      .from('toll_transfer_notices')
      .insert([insertPayload])
      .select('id')
      .single();

    if (error) throw error;

    const id = Number(inserted.id);
    const pdfUrl = `/api/toll-notices/${id}/pdf`;
    const { error: updateError } = await db
      .from('toll_transfer_notices')
      .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await auditNoticeAction({
      action: 'generate',
      actor: getAdminEmail(req),
      metadata: {
        application_id: payload.application_id || null,
        rental_id: payload.rental_id || null,
        toll_notice_number: payload.toll_notice_number,
      },
      noticeId: id,
    });

    res.status(201).json({ id, pdf_url: pdfUrl, status: 'generated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Create toll transfer notice error:', error);
    res.status(500).json({ error: 'Failed to create toll transfer notice' });
  }
});

router.get('/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const notice = await fetchNoticeById(id);
    if (!notice) {
      return res.status(404).json({ error: 'Toll transfer notice not found' });
    }

    const pdf = await buildTollTransferNoticePdf(notice as any);
    await auditNoticeAction({
      action: 'download',
      actor: getAdminEmail(req),
      metadata: { toll_notice_number: notice.toll_notice_number || null },
      noticeId: id,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="toll-transfer-notice-${id}.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Download toll transfer notice PDF error:', error);
    res.status(500).json({ error: 'Failed to download toll transfer notice PDF' });
  }
});

router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = markSentSchema.parse(req.body);
    const { data, error } = await db
      .from('toll_transfer_notices')
      .update({ status: payload.status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, status')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Toll transfer notice not found' });
    }

    await auditNoticeAction({
      action: 'send',
      actor: getAdminEmail(req),
      noticeId: id,
    });

    res.json({ id, status: statusSchema.parse(data.status) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Update toll transfer notice status error:', error);
    res.status(500).json({ error: 'Failed to update toll transfer notice status' });
  }
});

export default router;
