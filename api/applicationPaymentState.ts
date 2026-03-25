import { db } from './db/index.js';
import {
  getApplicationSelectColumns,
  getSchemaCompat,
  toApplicationPaymentWritePayload,
} from './schemaCompat.js';

type ApplicationPaymentWritePayload = {
  approved_at?: string | null;
  approved_bond?: number | null;
  approved_weekly_price?: number | null;
  assigned_car_id?: number | null;
  paid_at?: string | null;
  payment_link_sent_at?: string | null;
  payment_link_version?: number;
  pending_checkout_session_id?: string | null;
  status?: string;
};

export const updateApplicationPaymentStateIfCurrentVersion = async ({
  applicationId,
  expectedPaymentLinkVersion,
  payload,
}: {
  applicationId: string;
  expectedPaymentLinkVersion: number;
  payload: ApplicationPaymentWritePayload;
}) => {
  const compat = await getSchemaCompat();
  const selectColumns = await getApplicationSelectColumns();
  const mappedPayload = await toApplicationPaymentWritePayload(payload);

  const { data, error } = await db
    .from('applications')
    .update(mappedPayload)
    .eq('id', applicationId)
    .eq(
      compat.applicationPaymentLinkVersionColumn,
      expectedPaymentLinkVersion
    )
    .select(selectColumns)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as unknown as Record<string, unknown> | null) ?? null;
};

export const persistPendingCheckoutSessionIdIfCurrentVersion = async ({
  applicationId,
  expectedPaymentLinkVersion,
  sessionId,
}: {
  applicationId: string;
  expectedPaymentLinkVersion: number;
  sessionId: string | null;
}) => {
  const updatedApplication = await updateApplicationPaymentStateIfCurrentVersion({
    applicationId,
    expectedPaymentLinkVersion,
    payload: {
      pending_checkout_session_id: sessionId,
    },
  });

  return Boolean(updatedApplication);
};
