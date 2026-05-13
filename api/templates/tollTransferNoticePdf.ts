import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type TollTransferNoticePdfData = {
  authorised_officer_name: string;
  declaration_date: string;
  declaration_place: string;
  nominee_address: string;
  nominee_country: string;
  nominee_dob?: string | null;
  nominee_full_name: string;
  nominee_phone: string;
  nominee_postcode: string;
  nominee_state: string;
  nominee_suburb: string;
  responsible_type: string;
  toll_notice_number: string;
  toll_trip_date?: string | null;
  vehicle_registration: string;
  witness_jp_number?: string | null;
  witness_name?: string | null;
  witness_qualification?: string | null;
};

const templateFileName = 'tolling-notice-statutory-declaration-companies.pdf';

export const tollNoticeTemplatePublicPath = `/forms/${templateFileName}`;

const companyDetails = {
  address: '13/27-33 Addlestone Rd, Merrylands NSW 2160',
  name: 'MAPLE PAINTING PTY LTD',
  phone: '0420 550 556',
};

const black = rgb(0.07, 0.07, 0.07);

type DrawContext = {
  boldFont: PDFFont;
  font: PDFFont;
  page: PDFPage;
};

let templateBytesCache: Uint8Array | null = null;

const getTemplateCandidates = () => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  return [
    path.join(process.cwd(), 'public', 'forms', templateFileName),
    path.join(process.cwd(), 'dist', 'forms', templateFileName),
    path.resolve(moduleDir, '../../public/forms', templateFileName),
    path.resolve(moduleDir, '../../../public/forms', templateFileName),
  ];
};

const loadTemplateBytes = async () => {
  if (templateBytesCache) {
    return templateBytesCache;
  }

  const errors: string[] = [];
  for (const candidate of getTemplateCandidates()) {
    try {
      templateBytesCache = await readFile(candidate);
      return templateBytesCache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  throw new Error(`Toll notice PDF template not found. Checked: ${errors.join('; ')}`);
};

const normalizeBoxValue = (value: string | null | undefined, preserveSpaces = false) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, preserveSpaces ? ' ' : '')
    .trim();

const formatDateParts = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { day: iso[3], month: iso[2], year: iso[1] };
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return {
      day: slash[1].padStart(2, '0'),
      month: slash[2].padStart(2, '0'),
      year,
    };
  }

  return { day: '', month: '', year: '' };
};

const splitNomineeName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { givenNames: '', surname: parts[0] || '' };
  }

  return {
    givenNames: parts.slice(0, -1).join(' '),
    surname: parts[parts.length - 1],
  };
};

const drawText = (
  context: DrawContext,
  value: string | null | undefined,
  x: number,
  y: number,
  options: {
    font?: PDFFont;
    maxWidth?: number;
    size?: number;
    uppercase?: boolean;
  } = {}
) => {
  const rendered = options.uppercase ? String(value || '').toUpperCase() : String(value || '');
  const trimmed = rendered.trim();
  if (!trimmed) {
    return;
  }

  const size = options.size ?? 7.5;
  context.page.drawText(trimmed, {
    color: black,
    font: options.font ?? context.font,
    maxWidth: options.maxWidth,
    size,
    x,
    y,
  });
};

const drawLetterBoxes = (
  context: DrawContext,
  value: string | null | undefined,
  x: number,
  y: number,
  count: number,
  boxWidth = 12,
  preserveSpaces = false
) => {
  const normalized = normalizeBoxValue(value, preserveSpaces);
  const fontSize = 8;

  for (let index = 0; index < count; index += 1) {
    const char = normalized[index] || '';
    if (!char || char === ' ') {
      continue;
    }

    const boxX = x + index * boxWidth;
    const charWidth = context.font.widthOfTextAtSize(char, fontSize);
    context.page.drawText(char, {
      color: black,
      font: context.font,
      size: fontSize,
      x: boxX + Math.max(1, (boxWidth - charWidth) / 2),
      y,
    });
  }
};

const drawDateBoxes = (
  context: DrawContext,
  value: string | null | undefined,
  x: number,
  y: number
) => {
  const { day, month, year } = formatDateParts(value);
  drawLetterBoxes(context, day, x, y, 2, 13);
  drawLetterBoxes(context, month, x + 36, y, 2, 13);
  drawLetterBoxes(context, year, x + 72, y, 4, 13);
};

const drawLabeledBoxes = (
  context: DrawContext,
  value: string | null | undefined,
  x: number,
  y: number,
  count: number,
  boxWidth = 12,
  labelWidth = 120,
  preserveSpaces = false
) => {
  drawLetterBoxes(context, value, x + labelWidth, y, count, boxWidth, preserveSpaces);
};

const drawCheck = (context: DrawContext, x: number, y: number) => {
  drawText(context, 'X', x + 2.6, y + 1.2, {
    font: context.boldFont,
    size: 8,
  });
};

export const buildTollTransferNoticePdf = async (
  notice: TollTransferNoticePdfData
): Promise<Buffer> => {
  const templateBytes = await loadTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes, { updateMetadata: false });
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const context: DrawContext = {
    boldFont,
    font,
    page,
  };
  const pageWidth = page.getWidth();
  const left = 31;
  const right = pageWidth - 31;
  const contentWidth = right - left;
  const { givenNames, surname } = splitNomineeName(notice.nominee_full_name);
  const qualification = String(notice.witness_qualification || '').toLowerCase();

  drawLabeledBoxes(context, notice.toll_notice_number, left, 708, 14, 14, 84);
  drawLabeledBoxes(context, notice.vehicle_registration, left + 306, 708, 7, 14, 118);

  drawText(context, notice.authorised_officer_name, 52, 655, {
    maxWidth: contentWidth - 20,
    size: 8,
    uppercase: true,
  });
  drawText(context, companyDetails.name, 116, 624, {
    maxWidth: 445,
    size: 8,
  });
  drawText(context, companyDetails.address, 116, 606, {
    maxWidth: 445,
    size: 8,
  });
  drawText(context, companyDetails.phone, 97, 586, {
    maxWidth: 140,
    size: 8,
  });
  drawCheck(context, 303, 584);

  drawLabeledBoxes(context, surname, left, 549, 28, 13, 121, true);
  drawLetterBoxes(context, givenNames, 96, 526, 24, 11.5, true);
  drawDateBoxes(context, notice.nominee_dob, 434, 526);
  drawLetterBoxes(context, notice.nominee_address, 96, 499, 43, 11, true);
  drawLetterBoxes(context, notice.nominee_suburb, 96, 476, 20, 13, true);
  drawLetterBoxes(context, notice.nominee_state, 411, 476, 3, 13);
  drawLetterBoxes(context, notice.nominee_postcode, 508, 476, 4, 13);
  drawLetterBoxes(context, notice.nominee_country, 96, 454, 12, 13, true);
  drawLetterBoxes(context, notice.nominee_phone, 96, 431, 10, 13);

  if (notice.responsible_type === 'responsible') {
    drawCheck(context, 65, 394);
  }
  if (notice.responsible_type === 'new-owner') {
    drawCheck(context, 230, 394);
  }
  if (notice.responsible_type === 'previous-owner') {
    drawCheck(context, 417, 394);
  }

  drawText(context, notice.declaration_place, 103, 312, {
    maxWidth: 305,
    size: 8,
    uppercase: true,
  });
  drawDateBoxes(context, notice.declaration_date, 454, 310);
  drawText(context, notice.witness_name || '', 140, 258, {
    maxWidth: 420,
    size: 8,
  });

  if (qualification.includes('legal')) {
    drawCheck(context, 170, 234);
  }
  if (qualification.includes('justice') || qualification.includes('jp')) {
    drawCheck(context, 269, 234);
  }
  drawText(context, notice.witness_jp_number || '', 446, 236, {
    maxWidth: 115,
    size: 7.5,
  });

  drawDateBoxes(context, notice.declaration_date, 454, 112);

  const pdfBytes = await pdfDoc.save({
    addDefaultPage: false,
    useObjectStreams: false,
  });
  return Buffer.from(pdfBytes);
};
