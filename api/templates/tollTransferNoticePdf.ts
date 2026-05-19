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

type BoxedTextOptions = {
  boxHeight?: number;
  font?: PDFFont;
  maxChars?: number;
  size?: number;
  stripSpaces?: boolean;
  uppercase?: boolean;
};

type BoxLayout = {
  boxHeight: number;
  boxWidth: number;
  cells: number;
  startX: number;
  startY: number;
};

type DateBoxLayout = {
  day: BoxLayout;
  month: BoxLayout;
  year: BoxLayout;
};

type CheckboxLayout = {
  size: number;
  x: number;
  y: number;
};

let templateBytesCache: Uint8Array | null = null;

const box = {
  height: 17.008,
  width: 14.173,
};

const dateLayout = (dayStartX: number, startY: number): DateBoxLayout => ({
  day: { boxHeight: box.height, boxWidth: box.width, cells: 2, startX: dayStartX, startY },
  month: {
    boxHeight: box.height,
    boxWidth: box.width,
    cells: 2,
    startX: dayStartX + box.width * 2.6,
    startY,
  },
  year: {
    boxHeight: box.height,
    boxWidth: box.width,
    cells: 4,
    startX: dayStartX + box.width * 5.2,
    startY,
  },
});

const fieldLayouts = {
  country: { boxHeight: box.height, boxWidth: box.width, cells: 13, startX: 96.378, startY: 447.874 },
  declarationDate: dateLayout(453.657, 308.623),
  dob: dateLayout(433.814, 521.575),
  givenNames: { boxHeight: box.height, boxWidth: box.width, cells: 19, startX: 96.491, startY: 521.575 },
  mailingAddress: { boxHeight: box.height, boxWidth: box.width, cells: 33, startX: 96.491, startY: 493.228 },
  newOwnerFromDate: dateLayout(246.728, 377.008),
  phone: { boxHeight: box.height, boxWidth: box.width, cells: 10, startX: 96.378, startY: 425.197 },
  postcode: { boxHeight: box.height, boxWidth: box.width, cells: 4, startX: 507.515, startY: 470.551 },
  previousOwnerUntilDate: dateLayout(433.814, 377.008),
  state: { boxHeight: box.height, boxWidth: box.width, cells: 3, startX: 411.137, startY: 470.551 },
  suburb: { boxHeight: box.height, boxWidth: box.width, cells: 19, startX: 96.491, startY: 470.551 },
  surname: { boxHeight: box.height, boxWidth: box.width, cells: 29, startX: 153.184, startY: 544.252 },
  tollNoticeNumber: [
    { boxHeight: box.height, boxWidth: box.width, cells: 11, startX: 110.665, startY: 705.827 },
    { boxHeight: box.height, boxWidth: box.width, cells: 2, startX: 275.074, startY: 705.827 },
  ],
  vehicleRegistration: { boxHeight: box.height, boxWidth: box.width, cells: 7, startX: 464.995, startY: 705.827 },
  witnessDate: dateLayout(453.657, 110.197),
} satisfies Record<string, BoxLayout | BoxLayout[] | DateBoxLayout>;

const checkboxLayouts = {
  enclosedNotice: { size: 11.339, x: 303.42, y: 583.937 },
  legalPractitioner: { size: 9.921, x: 170.192, y: 233.859 },
  newOwner: { size: 11.339, x: 229.72, y: 394.016 },
  previousOwner: { size: 11.339, x: 416.806, y: 394.016 },
  responsible: { size: 11.339, x: 65.31, y: 394.016 },
  witnessJp: { size: 9.921, x: 269.405, y: 233.859 },
};

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

const normalizeBoxValue = (
  value: string | null | undefined,
  { stripSpaces = false, uppercase = true }: Pick<BoxedTextOptions, 'stripSpaces' | 'uppercase'> = {}
) => {
  const normalized = String(value || '')
    .replace(/\s+/g, stripSpaces ? '' : ' ')
    .trim();

  return uppercase ? normalized.toUpperCase() : normalized;
};

const stripWhitespace = (value: string | null | undefined) => String(value || '').replace(/\s+/g, '');

const normalizeDateValue = (value: string | null | undefined) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();

const formatDateParts = (value: string | null | undefined) => {
  const raw = normalizeDateValue(value);
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

const drawBoxedText = (
  context: DrawContext,
  text: string | null | undefined,
  startX: number,
  y: number,
  boxWidth: number,
  charSpacing: number,
  options: BoxedTextOptions = {}
) => {
  const font = options.font ?? context.font;
  const fontSize = options.size ?? 8;
  const boxHeight = options.boxHeight ?? box.height;
  const normalized = normalizeBoxValue(text, {
    stripSpaces: options.stripSpaces,
    uppercase: options.uppercase,
  }).slice(0, options.maxChars);
  const pitch = boxWidth + charSpacing;
  const baselineY = y + (boxHeight - fontSize) / 2;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (!char || char === ' ') {
      continue;
    }

    const boxX = startX + index * pitch;
    const charWidth = font.widthOfTextAtSize(char, fontSize);
    context.page.drawText(char, {
      color: black,
      font,
      size: fontSize,
      x: boxX + Math.max(0, (boxWidth - charWidth) / 2),
      y: baselineY,
    });
  }
};

const drawBoxLayout = (
  context: DrawContext,
  value: string | null | undefined,
  layout: BoxLayout,
  options: BoxedTextOptions = {}
) => {
  drawBoxedText(context, value, layout.startX, layout.startY, layout.boxWidth, 0, {
    boxHeight: layout.boxHeight,
    maxChars: layout.cells,
    ...options,
  });
};

const drawDateBoxes = (context: DrawContext, value: string | null | undefined, layout: DateBoxLayout) => {
  const { day, month, year } = formatDateParts(value);
  drawBoxLayout(context, day, layout.day, { stripSpaces: true });
  drawBoxLayout(context, month, layout.month, { stripSpaces: true });
  drawBoxLayout(context, year, layout.year, { stripSpaces: true });
};

const drawSplitBoxLayouts = (
  context: DrawContext,
  value: string | null | undefined,
  layouts: BoxLayout[],
  options: BoxedTextOptions = {}
) => {
  const normalized = normalizeBoxValue(value, {
    stripSpaces: options.stripSpaces,
    uppercase: options.uppercase,
  });
  let offset = 0;

  for (const layout of layouts) {
    drawBoxLayout(context, normalized.slice(offset, offset + layout.cells), layout, {
      ...options,
      stripSpaces: false,
    });
    offset += layout.cells;
  }
};

const drawTollNoticeNumber = (context: DrawContext, value: string | null | undefined) => {
  drawSplitBoxLayouts(context, value, fieldLayouts.tollNoticeNumber, { stripSpaces: true });
};

const drawVehicleRegistration = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.vehicleRegistration, { stripSpaces: true });
};

const drawSurnameOrOrganisationName = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.surname);
};

const drawGivenNames = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.givenNames);
};

const drawMailingAddress = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.mailingAddress);
};

const drawSuburb = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.suburb);
};

const drawState = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.state, { stripSpaces: true });
};

const drawPostcode = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.postcode, { stripSpaces: true });
};

const drawCountry = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.country);
};

const drawPhone = (context: DrawContext, value: string | null | undefined) => {
  drawBoxLayout(context, value, fieldLayouts.phone, { stripSpaces: true });
};

const drawDateField = (context: DrawContext, value: string | null | undefined, layout: DateBoxLayout) => {
  drawDateBoxes(context, value, layout);
};

const drawCheck = (context: DrawContext, layout: CheckboxLayout) => {
  const size = 8;
  const charWidth = context.boldFont.widthOfTextAtSize('X', size);
  drawText(context, 'X', layout.x + (layout.size - charWidth) / 2, layout.y + (layout.size - size) / 2, {
    font: context.boldFont,
    size,
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

  drawTollNoticeNumber(context, notice.toll_notice_number);
  drawVehicleRegistration(context, notice.vehicle_registration);

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
    uppercase: true,
  });
  drawText(context, stripWhitespace(companyDetails.phone), 97, 586, {
    maxWidth: 140,
    size: 8,
  });
  drawCheck(context, checkboxLayouts.enclosedNotice);

  drawSurnameOrOrganisationName(context, surname);
  drawGivenNames(context, givenNames);
  drawDateField(context, notice.nominee_dob, fieldLayouts.dob);
  drawMailingAddress(context, notice.nominee_address);
  drawSuburb(context, notice.nominee_suburb);
  drawState(context, notice.nominee_state);
  drawPostcode(context, notice.nominee_postcode);
  drawCountry(context, notice.nominee_country);
  drawPhone(context, notice.nominee_phone);

  if (notice.responsible_type === 'responsible') {
    drawCheck(context, checkboxLayouts.responsible);
  }
  if (notice.responsible_type === 'new-owner') {
    drawCheck(context, checkboxLayouts.newOwner);
    drawDateField(context, notice.toll_trip_date, fieldLayouts.newOwnerFromDate);
  }
  if (notice.responsible_type === 'previous-owner') {
    drawCheck(context, checkboxLayouts.previousOwner);
    drawDateField(context, notice.toll_trip_date, fieldLayouts.previousOwnerUntilDate);
  }

  drawText(context, notice.declaration_place, 103, 312, {
    maxWidth: 305,
    size: 8,
    uppercase: true,
  });
  drawDateField(context, notice.declaration_date, fieldLayouts.declarationDate);
  drawText(context, notice.witness_name || '', 140, 258, {
    maxWidth: 420,
    size: 8,
  });

  if (qualification.includes('legal')) {
    drawCheck(context, checkboxLayouts.legalPractitioner);
  }
  if (qualification.includes('justice') || qualification.includes('jp')) {
    drawCheck(context, checkboxLayouts.witnessJp);
  }
  drawText(context, notice.witness_jp_number || '', 446, 236, {
    maxWidth: 115,
    size: 7.5,
  });

  drawDateField(context, notice.declaration_date, fieldLayouts.witnessDate);

  const pdfBytes = await pdfDoc.save({
    addDefaultPage: false,
    useObjectStreams: false,
  });
  return Buffer.from(pdfBytes);
};
