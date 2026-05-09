import { db } from './db/index.js';
import {
  CAR_LEASE_AGREEMENT_TEMPLATE_VERSION,
  DEFAULT_CAR_LEASE_AGREEMENT_TEMPLATE,
  type CarLeaseAgreementInput,
  renderCarLeaseAgreement,
  renderCarLeaseAgreementTemplate,
} from './templates/carLeaseAgreement.js';

export const DEFAULT_AGREEMENT_TEMPLATE_KEY = 'car-lease';

export type AgreementTemplateRecord = {
  active: boolean;
  content: string;
  created_at?: string | null;
  id: number;
  name: string;
  template_key: string;
  updated_at: string;
  updated_by?: string | null;
  version: number;
};

const AGREEMENT_TEMPLATE_SELECT =
  'id, template_key, name, content, version, active, updated_by, created_at, updated_at';

const isMissingTemplateTableError = (error: unknown) => {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === '42P01' ||
    String(maybeError?.message || '').includes('agreement_templates')
  );
};

export const buildFallbackAgreementTemplate = (): AgreementTemplateRecord => ({
  active: true,
  content: DEFAULT_CAR_LEASE_AGREEMENT_TEMPLATE,
  created_at: null,
  id: 0,
  name: 'Car Lease Agreement',
  template_key: DEFAULT_AGREEMENT_TEMPLATE_KEY,
  updated_at: new Date().toISOString(),
  updated_by: null,
  version: CAR_LEASE_AGREEMENT_TEMPLATE_VERSION,
});

export const fetchAgreementTemplates = async () => {
  const { data, error } = await db
    .from('agreement_templates')
    .select(AGREEMENT_TEMPLATE_SELECT)
    .order('template_key', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    if (isMissingTemplateTableError(error)) {
      return [buildFallbackAgreementTemplate()];
    }

    throw error;
  }

  const templates = (data || []) as AgreementTemplateRecord[];
  return templates.length > 0 ? templates : [buildFallbackAgreementTemplate()];
};

export const fetchAgreementTemplateById = async (id: number) => {
  if (id === 0) {
    return buildFallbackAgreementTemplate();
  }

  const { data, error } = await db
    .from('agreement_templates')
    .select(AGREEMENT_TEMPLATE_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error && isMissingTemplateTableError(error)) {
      return buildFallbackAgreementTemplate();
    }

    return null;
  }

  return data as AgreementTemplateRecord;
};

export const fetchActiveAgreementTemplate = async (
  templateKey = DEFAULT_AGREEMENT_TEMPLATE_KEY
) => {
  const { data, error } = await db
    .from('agreement_templates')
    .select(AGREEMENT_TEMPLATE_SELECT)
    .eq('template_key', templateKey)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTemplateTableError(error)) {
      return buildFallbackAgreementTemplate();
    }

    throw error;
  }

  if (data) {
    return data as AgreementTemplateRecord;
  }

  const templates = await fetchAgreementTemplates();
  return (
    templates.find((template) => template.template_key === templateKey) ||
    buildFallbackAgreementTemplate()
  );
};

export const renderActiveAgreementTemplate = async (
  input: Partial<CarLeaseAgreementInput> = {},
  templateKey = DEFAULT_AGREEMENT_TEMPLATE_KEY
) => {
  const template = await fetchActiveAgreementTemplate(templateKey);
  const agreement =
    template.id === 0
      ? renderCarLeaseAgreement(input)
      : renderCarLeaseAgreementTemplate(template.content, input);

  return {
    agreement,
    agreementTemplateVersion: template.version,
  };
};

