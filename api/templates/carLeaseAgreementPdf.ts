import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { companyDetails, formatCompanyAddress } from '../../shared/companyDetails.js';
import {
  buildDefaultCarLeaseAgreement,
  renderCarLeaseAgreementTemplate,
  type CarLeaseAgreementInput,
} from './carLeaseAgreement.js';

type PdfFormField = {
  name: string;
  value: string;
  height?: number;
  multiLine?: boolean;
  width?: number;
};

type DrawContext = {
  boldFont: PDFFont;
  font: PDFFont;
  form: ReturnType<PDFDocument['getForm']>;
  page: PDFPage;
};

type BuildCarLeaseAgreementPdfOptions = {
  templateContent?: string | null;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 36;
const labelColor = rgb(0.39, 0.41, 0.45);
const textColor = rgb(0.09, 0.11, 0.15);
const accentColor = rgb(0.85, 0.66, 0.22);
const fieldColor = rgb(0.98, 0.98, 0.97);
const borderColor = rgb(0.82, 0.84, 0.86);

const defaultAgreement = buildDefaultCarLeaseAgreement();

const toDisplayValue = (value: unknown, fallback = 'Not provided') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toTemplateExcerpt = (templateContent: string | null | undefined, input: Partial<CarLeaseAgreementInput>) => {
  const content = String(templateContent ?? '').trim();
  if (!content) {
    return null;
  }

  const rendered = renderCarLeaseAgreementTemplate(content, input)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rendered) {
    return null;
  }

  return rendered.length > 220 ? `${rendered.slice(0, 217).trimEnd()}...` : rendered;
};

const drawHeader = (
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  title: string,
  pageNumber: number
) => {
  page.drawText(companyDetails.displayName, {
    font: boldFont,
    size: 20,
    x: margin,
    y: pageHeight - margin - 8,
    color: textColor,
  });
  page.drawText(title, {
    font,
    size: 10,
    x: margin,
    y: pageHeight - margin - 28,
    color: labelColor,
  });
  page.drawText(formatCompanyAddress(), {
    font,
    size: 9,
    x: margin,
    y: pageHeight - margin - 42,
    color: labelColor,
  });
  page.drawText(`Page ${pageNumber} of 4`, {
    font,
    size: 9,
    x: pageWidth - margin - 54,
    y: pageHeight - margin - 28,
    color: labelColor,
  });
  page.drawLine({
    start: { x: margin, y: pageHeight - 66 },
    end: { x: pageWidth - margin, y: pageHeight - 66 },
    thickness: 1,
    color: accentColor,
  });
};

const drawSectionTitle = (page: PDFPage, boldFont: PDFFont, title: string, y: number) => {
  page.drawText(title, {
    font: boldFont,
    size: 12,
    x: margin,
    y,
    color: textColor,
  });
};

const drawField = (
  { boldFont, font, form, page }: DrawContext,
  field: PdfFormField,
  x: number,
  y: number
) => {
  const height = field.height ?? (field.multiLine ? 42 : 20);
  const width = field.width ?? 246;
  const textField = form.createTextField(field.name);
  textField.setText(field.value);
  if (field.multiLine) {
    textField.enableMultiline();
  }

  page.drawText(field.name, {
    font: boldFont,
    size: 8.5,
    x,
    y: y + height + 5,
    color: labelColor,
  });
  page.drawRectangle({
    borderColor,
    borderWidth: 1,
    color: fieldColor,
    height,
    width,
    x,
    y,
  });
  textField.addToPage(page, {
    x: x + 4,
    y: y + 2,
    width: width - 8,
    height: height - 4,
    borderWidth: 0,
    textColor,
    font,
  });
};

const drawParagraph = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) => {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, 8.5) > maxWidth && line) {
      page.drawText(line, { font, size: 8.5, x, y: cursorY, color: labelColor });
      line = word;
      cursorY -= 12;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    page.drawText(line, { font, size: 8.5, x, y: cursorY, color: labelColor });
  }

  return cursorY - 14;
};

const drawFeeRows = (
  context: DrawContext,
  fees: CarLeaseAgreementInput['fees'],
  yStart: number
) => {
  let y = yStart;
  for (const fee of fees) {
    context.page.drawText(`${fee.code} ${fee.title}`, {
      font: context.font,
      size: 8.5,
      x: margin,
      y,
      color: textColor,
    });
    drawField(
      context,
      {
        name: `Fee ${fee.code} amount`,
        value: fee.amount,
        width: 110,
      },
      pageWidth - margin - 110,
      y - 6
    );
    y -= 28;
  }
};

const addAgreementPage = (
  pdf: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  title: string,
  pageNumber: number
) => {
  const page = pdf.addPage([pageWidth, pageHeight]);
  drawHeader(page, font, boldFont, title, pageNumber);
  return page;
};

export const buildCarLeaseAgreementPdf = async (
  input: Partial<CarLeaseAgreementInput> = {},
  options: BuildCarLeaseAgreementPdfOptions = {}
) => {
  const agreement: CarLeaseAgreementInput = {
    ...defaultAgreement,
    ...input,
    fees: input.fees ?? defaultAgreement.fees,
  };
  const templateExcerpt = toTemplateExcerpt(options.templateContent, input);

  const pdf = await PDFDocument.create();
  pdf.setTitle('Gala Rentals Lease Agreement');
  pdf.setAuthor(companyDetails.displayName);
  pdf.setSubject('Four-page fillable rental agreement form');
  pdf.setCreator(companyDetails.displayName);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();

  const pageOne = addAgreementPage(pdf, font, boldFont, 'Fillable rental agreement - parties', 1);
  const contextOne = { boldFont, font, form, page: pageOne };
  drawSectionTitle(pageOne, boldFont, 'Agreement Parties', pageHeight - 92);
  drawField(contextOne, { name: 'Agreement date', value: toDisplayValue(agreement.agreementDate) }, margin, 686);
  drawField(contextOne, { name: 'Registered owner name', value: toDisplayValue(agreement.registeredOwnerName) }, margin, 638);
  drawField(contextOne, { name: 'Registered owner address', value: toDisplayValue(agreement.registeredOwnerAddress), height: 46, multiLine: true }, margin, 570);
  drawField(contextOne, { name: 'Registered owner contact', value: toDisplayValue(agreement.registeredOwnerContact) }, margin, 522);
  drawField(contextOne, { name: 'Registered owner email', value: toDisplayValue(agreement.registeredOwnerEmail) }, margin, 474);
  drawField(contextOne, { name: 'Rentee name', value: toDisplayValue(agreement.renteeName) }, 314, 686);
  drawField(contextOne, { name: 'Date of birth', value: toDisplayValue(agreement.renteeDob) }, 314, 638);
  drawField(contextOne, { name: 'License number', value: toDisplayValue(agreement.renteeLicenseNumber) }, 314, 590);
  drawField(contextOne, { name: 'License state', value: toDisplayValue(agreement.renteeLicenseState), width: 112 }, 314, 542);
  drawField(contextOne, { name: 'Rentee contact', value: toDisplayValue(agreement.renteeContact) }, 314, 494);
  drawField(contextOne, { name: 'Rentee email', value: toDisplayValue(agreement.renteeEmail) }, 314, 446);
  drawField(contextOne, { name: 'Rentee address', value: toDisplayValue(agreement.renteeAddress), height: 58, multiLine: true, width: pageWidth - margin * 2 }, margin, 350);
  drawField(contextOne, { name: 'Emergency contact name', value: '', width: 246 }, margin, 286);
  drawField(contextOne, { name: 'Emergency contact phone', value: '', width: 246 }, 314, 286);
  drawField(contextOne, { name: 'Additional authorised driver', value: '', width: 246 }, margin, 224);
  drawField(contextOne, { name: 'Authorised driver licence', value: '', width: 246 }, 314, 224);
  drawParagraph(
    pageOne,
    font,
    'The renter confirms the information above is true and will promptly tell Gala Rentals if licence, address, contact, payment, or driver details change during the rental.',
    margin,
    158,
    pageWidth - margin * 2
  );

  const pageTwo = addAgreementPage(pdf, font, boldFont, 'Fillable rental agreement - vehicle and pricing', 2);
  const contextTwo = { boldFont, font, form, page: pageTwo };
  drawSectionTitle(pageTwo, boldFont, 'Vehicle Details', pageHeight - 92);
  drawField(contextTwo, { name: 'Vehicle make', value: toDisplayValue(agreement.vehicleMake) }, margin, 686);
  drawField(contextTwo, { name: 'Vehicle model', value: toDisplayValue(agreement.vehicleModel) }, 314, 686);
  drawField(contextTwo, { name: 'Vehicle year', value: toDisplayValue(agreement.vehicleYear) }, margin, 638);
  drawField(contextTwo, { name: 'Vehicle VIN / rego', value: toDisplayValue(agreement.vehicleVin) }, 314, 638);
  drawField(contextTwo, { name: 'Odometer out', value: '', width: 160 }, margin, 590);
  drawField(contextTwo, { name: 'Odometer return', value: '', width: 160 }, 218, 590);
  drawField(contextTwo, { name: 'KM allowance', value: toDisplayValue(agreement.kmAllowance), width: 160 }, 410, 590);
  drawField(contextTwo, { name: 'Fuel level out', value: '', width: 160 }, margin, 542);
  drawField(contextTwo, { name: 'Fuel level return', value: '', width: 160 }, 218, 542);
  drawField(contextTwo, { name: 'Fuel policy', value: toDisplayValue(agreement.fuelPolicy), height: 46, multiLine: true, width: pageWidth - margin * 2 }, margin, 470);

  drawSectionTitle(pageTwo, boldFont, 'Pricing And Rental Period', 428);
  drawField(contextTwo, { name: 'Weekly rent', value: toDisplayValue(agreement.weeklyRent) }, margin, 382);
  drawField(contextTwo, { name: 'Rental start date', value: toDisplayValue(agreement.rentalStartDate) }, 314, 382);
  drawField(contextTwo, { name: 'Rental end date', value: toDisplayValue(agreement.rentalEndDate) }, margin, 334);
  drawField(contextTwo, { name: 'Minimum rental period', value: toDisplayValue(agreement.minimumRentalPeriod) }, 314, 334);
  drawField(contextTwo, { name: 'Bond amount', value: toDisplayValue(agreement.bondAmount) }, margin, 286);
  drawField(contextTwo, { name: 'Bond payment status', value: toDisplayValue(agreement.bondPaymentStatus) }, 314, 286);
  drawField(contextTwo, { name: 'Bond notes', value: toDisplayValue(agreement.bondNotes, ''), height: 58, multiLine: true, width: pageWidth - margin * 2 }, margin, 196);
  drawParagraph(
    pageTwo,
    font,
    'Bond is handled manually by Gala Rentals and is not charged through Stripe. Subscription payment completion marks the application paid only and does not automatically allocate a vehicle or activate a rental row.',
    margin,
    128,
    pageWidth - margin * 2
  );

  const pageThree = addAgreementPage(pdf, font, boldFont, 'Fillable rental agreement - obligations and charges', 3);
  const contextThree = { boldFont, font, form, page: pageThree };
  drawSectionTitle(pageThree, boldFont, 'Fee Schedule', pageHeight - 92);
  drawFeeRows(contextThree, agreement.fees, 698);
  drawSectionTitle(pageThree, boldFont, 'Insurance, Use And Return Conditions', 408);
  drawField(contextThree, { name: 'Insurance coverage', value: toDisplayValue(agreement.insuranceCoverage), height: 76, multiLine: true, width: pageWidth - margin * 2 }, margin, 312);
  drawField(contextThree, { name: 'Return policy', value: toDisplayValue(agreement.returnPolicy), height: 76, multiLine: true, width: pageWidth - margin * 2 }, margin, 196);
  drawParagraph(
    pageThree,
    font,
    'The renter is responsible for tolls, infringements, damage, late return costs, excess kilometres, cleaning, missing accessories, and other charges allowed under the signed agreement and applicable law.',
    margin,
    122,
    pageWidth - margin * 2
  );
  drawField(contextThree, { name: 'Admin special conditions', value: '', height: 50, multiLine: true, width: pageWidth - margin * 2 }, margin, 42);

  const pageFour = addAgreementPage(pdf, font, boldFont, 'Fillable rental agreement - declarations and signatures', 4);
  const contextFour = { boldFont, font, form, page: pageFour };
  drawSectionTitle(pageFour, boldFont, 'Renter Declarations', pageHeight - 92);
  const declarations = [
    'I have inspected the vehicle and accept the recorded condition unless noted below.',
    'I will keep payments current and understand late, toll, direct debit, and administration fees may apply.',
    'I will not allow unlisted drivers, illegal use, unsafe use, rideshare use, or travel outside approved areas without written approval.',
    'I accept that legal notices may be sent to the physical and electronic addresses recorded in this agreement.',
  ];
  let declarationY = 708;
  declarations.forEach((declaration, index) => {
    const checkbox = form.createCheckBox(`Declaration ${index + 1} accepted`);
    checkbox.addToPage(pageFour, {
      x: margin,
      y: declarationY - 4,
      width: 12,
      height: 12,
      borderWidth: 1,
    });
    pageFour.drawText(declaration, {
      font,
      size: 8.8,
      x: margin + 20,
      y: declarationY,
      color: textColor,
      maxWidth: pageWidth - margin * 2 - 20,
    });
    declarationY -= 34;
  });
  drawField(contextFour, { name: 'Vehicle condition notes', value: '', height: 72, multiLine: true, width: pageWidth - margin * 2 }, margin, 474);
  drawField(contextFour, { name: 'Rentee signature', value: '', width: 246 }, margin, 384);
  drawField(contextFour, { name: 'Rentee signed date', value: '', width: 246 }, 314, 384);
  drawField(contextFour, { name: 'Gala Rentals authorised signature', value: '', width: 246 }, margin, 310);
  drawField(contextFour, { name: 'Gala Rentals signed date', value: '', width: 246 }, 314, 310);
  drawField(contextFour, { name: 'Admin completion notes', value: '', height: 70, multiLine: true, width: pageWidth - margin * 2 }, margin, 196);
  if (templateExcerpt) {
    drawSectionTitle(pageFour, boldFont, 'Selected Agreement Template', 162);
    drawParagraph(pageFour, font, templateExcerpt, margin, 142, pageWidth - margin * 2);
  }
  drawParagraph(
    pageFour,
    font,
    `${companyDetails.legalName} trading as ${companyDetails.tradingName}. ABN ${companyDetails.abn}. Phone ${companyDetails.phone}. This fillable form is for admin completion, review, signature, and secure storage against the customer application record.`,
    margin,
    110,
    pageWidth - margin * 2
  );

  form.updateFieldAppearances(font);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};
