import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { companyDetails, formatCompanyAddress } from '../../shared/companyDetails.js';
import {
  buildDefaultCarLeaseAgreement,
  type CarLeaseAgreementInput,
} from './carLeaseAgreement.js';

type PdfFormField = {
  name: string;
  value: string;
  multiLine?: boolean;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 36;
const labelColor = rgb(0.39, 0.41, 0.45);
const textColor = rgb(0.09, 0.11, 0.15);
const accentColor = rgb(0.85, 0.66, 0.22);
const fieldColor = rgb(0.98, 0.98, 0.97);

const defaultAgreement = buildDefaultCarLeaseAgreement();

const toDisplayValue = (value: unknown, fallback = 'Not provided') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const drawHeader = (page: PDFPage, font: PDFFont, boldFont: PDFFont) => {
  page.drawText(companyDetails.displayName, {
    font: boldFont,
    size: 20,
    x: margin,
    y: pageHeight - margin - 8,
    color: textColor,
  });
  page.drawText('Fillable lease agreement form', {
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

export const buildCarLeaseAgreementPdf = async (
  input: Partial<CarLeaseAgreementInput> = {}
) => {
  const agreement: CarLeaseAgreementInput = {
    ...defaultAgreement,
    ...input,
    fees: input.fees ?? defaultAgreement.fees,
  };

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Gala Rentals Lease Agreement`);
  pdf.setAuthor(companyDetails.displayName);
  pdf.setSubject('Fillable lease agreement form');
  pdf.setCreator(companyDetails.displayName);

  const page = pdf.addPage([pageWidth, pageHeight]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();

  drawHeader(page, font, boldFont);
  drawSectionTitle(page, boldFont, 'Agreement Parties', pageHeight - 92);

  const firstSection: PdfFormField[] = [
    { name: 'Agreement date', value: toDisplayValue(agreement.agreementDate) },
    { name: 'Registered owner name', value: toDisplayValue(agreement.registeredOwnerName) },
    { name: 'Registered owner address', value: toDisplayValue(agreement.registeredOwnerAddress), multiLine: true },
    { name: 'Registered owner contact', value: toDisplayValue(agreement.registeredOwnerContact) },
    { name: 'Registered owner email', value: toDisplayValue(agreement.registeredOwnerEmail) },
    { name: 'Rentee name', value: toDisplayValue(agreement.renteeName) },
    { name: 'Date of birth', value: toDisplayValue(agreement.renteeDob) },
    { name: 'License number', value: toDisplayValue(agreement.renteeLicenseNumber) },
    { name: 'License state', value: toDisplayValue(agreement.renteeLicenseState) },
    { name: 'Rentee address', value: toDisplayValue(agreement.renteeAddress), multiLine: true },
    { name: 'Rentee contact', value: toDisplayValue(agreement.renteeContact) },
    { name: 'Rentee email', value: toDisplayValue(agreement.renteeEmail) },
  ];

  let y = pageHeight - 112;
  for (const field of firstSection) {
    const isMultiLine = Boolean(field.multiLine);
    const height = isMultiLine ? 34 : 18;
    const textField = form.createTextField(field.name);
    textField.setText(field.value);
    if (isMultiLine) {
      textField.enableMultiline();
    }
    textField.addToPage(page, {
      x: margin,
      y: y - height,
      width: 236,
      height,
      borderWidth: 0,
      textColor,
      font,
    });
    page.drawText(field.name, {
      font: boldFont,
      size: 9,
      x: margin,
      y: y + 4,
      color: labelColor,
    });
    page.drawRectangle({
      borderColor: rgb(0.82, 0.84, 0.86),
      borderWidth: 1,
      color: fieldColor,
      height,
      width: 236,
      x: margin,
      y: y - height,
    });
    page.drawText(field.value || ' ', {
      font,
      size: 8.5,
      x: margin + 6,
      y: y - height + 5,
      color: textColor,
      maxWidth: 224,
    });
    y -= isMultiLine ? 44 : 34;
  }

  page.drawText('Vehicle and pricing', {
    font: boldFont,
    size: 12,
    x: margin,
    y: 346,
    color: textColor,
  });

  const vehicleFields: Array<{ label: string; value: string; width: number; height?: number }> = [
    { label: 'Vehicle make', value: toDisplayValue(agreement.vehicleMake), width: 160 },
    { label: 'Vehicle model', value: toDisplayValue(agreement.vehicleModel), width: 160 },
    { label: 'Vehicle year', value: toDisplayValue(agreement.vehicleYear), width: 96 },
    { label: 'Vehicle VIN / rego', value: toDisplayValue(agreement.vehicleVin), width: 236 },
    { label: 'KM allowance', value: toDisplayValue(agreement.kmAllowance), width: 96 },
    { label: 'Weekly rent', value: toDisplayValue(agreement.weeklyRent), width: 160 },
    { label: 'Rental start date', value: toDisplayValue(agreement.rentalStartDate), width: 160 },
    { label: 'Rental end date', value: toDisplayValue(agreement.rentalEndDate), width: 96 },
    { label: 'Minimum rental period', value: toDisplayValue(agreement.minimumRentalPeriod), width: 160 },
    { label: 'Bond amount', value: toDisplayValue(agreement.bondAmount), width: 96 },
    { label: 'Bond payment status', value: toDisplayValue(agreement.bondPaymentStatus), width: 160 },
  ];

  let vehicleY = 324;
  for (const field of vehicleFields) {
    const height = field.height ?? 18;
    page.drawText(field.label, {
      font: boldFont,
      size: 9,
      x: margin,
      y: vehicleY + height + 4,
      color: labelColor,
    });
    const formField = form.createTextField(field.label);
    formField.setText(field.value);
    formField.addToPage(page, {
      x: margin,
      y: vehicleY,
      width: field.width,
      height,
      borderWidth: 0,
      textColor,
      font,
    });
    page.drawRectangle({
      borderColor: rgb(0.82, 0.84, 0.86),
      borderWidth: 1,
      color: fieldColor,
      height,
      width: field.width,
      x: margin,
      y: vehicleY,
    });
    page.drawText(field.value || ' ', {
      font,
      size: 8.5,
      x: margin + 6,
      y: vehicleY + 5,
      color: textColor,
      maxWidth: field.width - 12,
    });
    vehicleY -= 30;
  }

  page.drawText('Agreement notes', {
    font: boldFont,
    size: 12,
    x: margin,
    y: 44,
    color: textColor,
  });

  const notes = [
    'This PDF is a fillable form for manual completion and printing.',
    'Bond handling remains manual and is not charged through Stripe.',
    'All agreement values can be edited directly in the form fields.',
  ].join(' ');
  page.drawText(notes, {
    font,
    size: 9,
    x: margin,
    y: 28,
    color: labelColor,
    maxWidth: pageWidth - margin * 2,
  });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};
