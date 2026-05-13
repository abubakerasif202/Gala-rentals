import PDFDocument from 'pdfkit';

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

const companyDetails = {
  address: '13/27-33 Addlestone Rd, Merrylands NSW 2160',
  name: 'MAPLE PAINTING PTY LTD',
  phone: '0420 550 556',
};

const black = '#111111';
const lightGrey = '#eeeeee';

const font = (
  doc: PDFKit.PDFDocument,
  style: 'regular' | 'bold' | 'italic',
  size: number
) => {
  const name =
    style === 'bold' ? 'Helvetica-Bold' : style === 'italic' ? 'Helvetica-Oblique' : 'Helvetica';
  doc.font(name).fontSize(size).fillColor(black);
};

const text = (
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width?: number,
  options: PDFKit.Mixins.TextOptions = {}
) => {
  doc.text(value, x, y, { width, ...options });
};

const line = (
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2 = y1
) => {
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
};

const dottedLine = (
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2 = y1
) => {
  doc.save();
  doc.dash(1.2, { space: 2 }).moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.restore();
};

const checkbox = (doc: PDFKit.PDFDocument, x: number, y: number, checked: boolean) => {
  doc.rect(x, y, 11, 11).stroke();
  if (checked) {
    doc.moveTo(x + 2, y + 5).lineTo(x + 4.5, y + 8).lineTo(x + 9, y + 2).stroke();
  }
};

const normalizeBoxValue = (value: string | null | undefined, preserveSpaces = false) => {
  const normalized = String(value || '').toUpperCase().replace(/\s+/g, preserveSpaces ? ' ' : '');
  return normalized.trim();
};

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

const drawCornerMarks = (doc: PDFKit.PDFDocument, left: number, top: number, right: number) => {
  const bottom = 820;
  const length = 17;
  doc.lineWidth(1.1);
  line(doc, left, top, left + length, top);
  line(doc, left, top, left, top + length);
  line(doc, right - length, top, right, top);
  line(doc, right, top, right, top + length);
  line(doc, left, bottom, left + length, bottom);
  line(doc, left, bottom - length, left, bottom);
  line(doc, right - length, bottom, right, bottom);
  line(doc, right, bottom - length, right, bottom);
  doc.lineWidth(0.55);
};

const drawOfficeUseBand = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number
) => {
  doc.rect(x, y, width, 17).fillAndStroke(lightGrey, black);
  font(doc, 'bold', 9);
  text(doc, 'OFFICE USE ONLY', x + 4, y + 4, width - 8);
  doc.fillColor(black);
};

const drawLetterBoxes = (
  doc: PDFKit.PDFDocument,
  value: string | null | undefined,
  x: number,
  y: number,
  count: number,
  size = 12,
  preserveSpaces = false
) => {
  const normalized = normalizeBoxValue(value, preserveSpaces);
  for (let index = 0; index < count; index += 1) {
    const boxX = x + index * size;
    doc.rect(boxX, y, size, 15).stroke();
    const char = normalized[index] || '';
    if (char && char !== ' ') {
      font(doc, 'regular', 8);
      doc.text(char, boxX, y + 4, {
        align: 'center',
        width: size,
      });
    }
  }
};

const drawDateBoxes = (
  doc: PDFKit.PDFDocument,
  value: string | null | undefined,
  x: number,
  y: number
) => {
  const { day, month, year } = formatDateParts(value);
  drawLetterBoxes(doc, day, x, y, 2, 13);
  font(doc, 'regular', 10);
  text(doc, '/', x + 28, y + 3, 6);
  drawLetterBoxes(doc, month, x + 36, y, 2, 13);
  text(doc, '/', x + 64, y + 3, 6);
  drawLetterBoxes(doc, year, x + 72, y, 4, 13);
  font(doc, 'regular', 5);
  text(doc, 'day', x + 6, y + 16, 18, { align: 'center' });
  text(doc, 'month', x + 37, y + 16, 28, { align: 'center' });
  text(doc, 'year', x + 80, y + 16, 28, { align: 'center' });
};

const drawLabeledBoxes = (
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  count: number,
  size = 12,
  labelWidth = 120,
  preserveSpaces = false
) => {
  font(doc, 'regular', 8);
  text(doc, label, x, y + 3, labelWidth);
  drawLetterBoxes(doc, value, x + labelWidth, y, count, size, preserveSpaces);
};

const drawTextField = (
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  width: number,
  labelWidth = 110,
  options: { boldLabel?: boolean; uppercaseValue?: boolean } = {}
) => {
  font(doc, options.boldLabel ? 'bold' : 'regular', 8);
  text(doc, label, x, y, labelWidth);
  dottedLine(doc, x + labelWidth, y + 10, x + width, y + 10);
  const renderedValue = options.uppercaseValue
    ? String(value || '').toUpperCase()
    : String(value || '');
  font(doc, 'regular', 7.5);
  text(doc, renderedValue, x + labelWidth + 3, y - 1, Math.max(0, width - labelWidth - 5));
};

const drawBullet = (doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number) => {
  font(doc, 'regular', 8);
  doc.circle(x + 3, y + 5, 1.7).fill(black);
  text(doc, value, x + 18, y, width - 18, { lineGap: -1 });
};

const drawGreyNote = (doc: PDFKit.PDFDocument, x: number, y: number, width: number) => {
  doc.rect(x, y, width, 15).fill(lightGrey);
  font(doc, 'bold', 8);
  text(
    doc,
    'Note: A person who makes a false statement or misleading declaration is liable to a penalty or criminal prosecution.',
    x + 44,
    y + 4,
    width - 88
  );
  doc.fillColor(black);
};

export const buildTollTransferNoticePdf = async (
  notice: TollTransferNoticePdfData
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: false,
      compress: false,
      margin: 0,
      size: 'A4',
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage();
    doc.lineWidth(0.55).strokeColor(black).fillColor(black);

    const pageWidth = doc.page.width;
    const left = 31;
    const right = pageWidth - 31;
    const contentWidth = right - left;
    const { givenNames, surname } = splitNomineeName(notice.nominee_full_name);
    let y = 30;

    drawCornerMarks(doc, 18, 16, pageWidth - 18);

    font(doc, 'bold', 17);
    text(doc, 'Tolling Notice Statutory Declaration - Companies', left, y, contentWidth);
    y += 27;

    font(doc, 'regular', 8);
    text(
      doc,
      'Use this form to give notice of the name and address of the driver who was in charge of the vehicle at the time of the trip.',
      left,
      y,
      500
    );
    drawBullet(doc, 'Print clearly in CAPITAL letters using black pen.', left, y + 17, 235);
    drawBullet(doc, 'The original Toll Notice or a copy must be enclosed.', left, y + 33, 280);
    drawBullet(
      doc,
      'Completed form must be received at least 7 days before the due date on the toll notice. You must provide the name and address of the organisation you wish to nominate',
      left + 275,
      y + 17,
      255
    );
    y += 62;

    drawOfficeUseBand(doc, left, y, contentWidth);
    y += 25;

    drawLabeledBoxes(doc, 'Toll Notice number', notice.toll_notice_number, left, y, 14, 14, 84);
    font(doc, 'regular', 11);
    text(doc, '-', left + 287, y + 2, 10);
    drawLabeledBoxes(
      doc,
      'Vehicle registration number:',
      notice.vehicle_registration,
      left + 306,
      y,
      7,
      14,
      118
    );
    y += 23;
    font(doc, 'italic', 7);
    text(
      doc,
      "If multiple Toll Notice numbers for the same vehicle registration number above, please write 'as attached', and list the numbers on a separate page attached to this form.",
      left,
      y,
      contentWidth
    );
    y += 27;

    drawTextField(
      doc,
      'I, [full name of person completing this form on behalf of the Company/organisation named on the toll notice]',
      notice.authorised_officer_name.toUpperCase(),
      left,
      y,
      contentWidth,
      530
    );
    y += 24;
    font(doc, 'bold', 9);
    text(doc, 'am an authorised officer of', left, y, 160);
    y += 18;
    drawTextField(doc, 'Organisation name:', companyDetails.name, left, y, contentWidth, 95);
    y += 22;
    drawTextField(doc, 'Organisation address:', companyDetails.address, left, y, contentWidth, 105);
    y += 22;
    drawTextField(doc, 'Phone number:', companyDetails.phone, left, y, 280, 75);
    checkbox(doc, left + 287, y - 4, true);
    font(doc, 'regular', 9);
    text(doc, 'Toll Notice has been enclosed', left + 306, y - 2, 180);
    y += 25;

    font(doc, 'bold', 9);
    text(doc, 'give notice that the person named below was responsible for the trip:', left, y);
    y += 17;
    drawLabeledBoxes(doc, 'Surname or organisation name:', surname, left, y, 28, 13, 121, true);
    y += 25;
    drawLabeledBoxes(doc, 'Given name(s):', givenNames, left, y, 24, 13, 121, true);
    font(doc, 'regular', 8);
    text(doc, 'Date of birth:', left + 350, y + 3, 68);
    drawDateBoxes(doc, notice.nominee_dob, left + 418, y);
    y += 31;
    drawLabeledBoxes(doc, 'Mailing address:', notice.nominee_address, left, y, 43, 12, 121, true);
    y += 28;
    drawLabeledBoxes(doc, 'Suburb:', notice.nominee_suburb, left, y, 20, 13, 72, true);
    drawLabeledBoxes(doc, 'State:', notice.nominee_state, left + 348, y, 3, 13, 38);
    drawLabeledBoxes(doc, 'Postcode:', notice.nominee_postcode, left + 434, y, 4, 13, 61);
    y += 28;
    drawLabeledBoxes(doc, 'Country:', notice.nominee_country, left, y, 12, 13, 72, true);
    drawLabeledBoxes(doc, 'Phone number:', notice.nominee_phone, left + 245, y, 10, 13, 85);
    drawLabeledBoxes(doc, 'Organisation ABN/ACN:\n(If applicable)', '', left + 388, y - 2, 11, 10, 120);
    y += 34;

    font(doc, 'bold', 9);
    text(doc, 'person', left, y);
    font(doc, 'italic', 8);
    text(doc, '(Please tick ONE of the following three boxes as appropriate)', left + 42, y, 250);
    y += 18;
    checkbox(doc, left + 37, y, notice.responsible_type === 'responsible');
    font(doc, 'regular', 8);
    text(doc, 'was the driver, person\nor organisation\nresponsible for toll', left + 55, y - 2, 145);
    checkbox(doc, left + 203, y, notice.responsible_type === 'new-owner');
    text(doc, 'Was the new owner from:', left + 221, y - 1, 115);
    drawDateBoxes(doc, null, left + 218, y + 21);
    checkbox(doc, left + 382, y, notice.responsible_type === 'previous-owner');
    text(doc, 'Was the previous owner until:', left + 400, y - 1, 128);
    drawDateBoxes(doc, null, left + 398, y + 21);
    y += 55;

    drawGreyNote(doc, left, y, contentWidth);
    y += 26;

    font(doc, 'regular', 8);
    text(
      doc,
      'I make this solemn declaration conscientiously believing the same to be true, and by virtue of the provisions of the Oaths Act 1900.',
      left,
      y,
      contentWidth
    );
    y += 24;
    drawTextField(doc, 'Declared at [place]', notice.declaration_place.toUpperCase(), left, y, 400, 120);
    font(doc, 'regular', 8);
    text(doc, 'on [date]', left + 407, y, 48);
    drawDateBoxes(doc, notice.declaration_date, left + 455, y - 4);
    y += 27;
    drawTextField(doc, 'Signature of declarant:', '', left, y, 385, 118);
    y += 30;

    font(doc, 'bold', 8.5);
    text(doc, 'in the presence of an authorised witness, who states:', left, y);
    y += 16;
    drawTextField(doc, 'I, [name of authorised witness]', notice.witness_name || '', left, y, contentWidth, 128);
    y += 24;
    font(doc, 'regular', 8);
    text(doc, 'a [qualification of authorised witness] :', left, y, 157);
    const qualification = String(notice.witness_qualification || '').toLowerCase();
    checkbox(doc, left + 159, y - 3, qualification.includes('legal'));
    text(doc, 'Legal practitioner /', left + 176, y - 1, 95);
    checkbox(doc, left + 272, y - 3, qualification.includes('justice') || qualification.includes('jp'));
    font(doc, 'bold', 8);
    text(doc, 'Justice of the Peace', left + 290, y - 1, 104);
    font(doc, 'italic', 8);
    text(doc, '[supply JP number]', left + 397, y - 1, 82);
    dottedLine(doc, left + 472, y + 10, right);
    font(doc, 'regular', 7.5);
    text(doc, String(notice.witness_jp_number || ''), left + 476, y - 1, 55);
    y += 24;

    font(doc, 'regular', 8);
    text(
      doc,
      'certify the following matters concerning the making of this statutory declaration by the person who made it:',
      left,
      y,
      contentWidth
    );
    y += 12;
    font(doc, 'italic', 7.5);
    text(doc, "[* please cross out any text that does not apply]", left + 235, y, 190, {
      align: 'center',
    });
    y += 17;

    font(doc, 'regular', 8);
    text(doc, '1.', left, y, 16);
    text(doc, '*I saw the face of the person', left + 24, y, 175);
    font(doc, 'bold', 8);
    text(doc, 'OR', left + 172, y, 20);
    font(doc, 'regular', 8);
    text(
      doc,
      '*I did not see the face of the person because the person was wearing a face covering, but I am satisfied that the person had a special justification for not removing the covering, and',
      left + 205,
      y,
      330,
      { lineGap: -1 }
    );
    y += 35;
    text(doc, '2.', left, y, 16);
    text(doc, '*I have known the person for at\nleast 12 months', left + 24, y, 170, {
      lineGap: -1,
    });
    font(doc, 'bold', 8);
    text(doc, 'OR', left + 172, y, 20);
    font(doc, 'regular', 8);
    text(
      doc,
      "*I have not known the person for at least 12 months, but I have confirmed the person's identity using an identification document and the document I relied on was:",
      left + 205,
      y,
      330,
      { lineGap: -1 }
    );
    y += 44;
    font(doc, 'italic', 8);
    text(doc, '[describe identification document relied on]', left + 24, y, 190);
    dottedLine(doc, left + 210, y + 10, right);
    y += 35;
    drawTextField(doc, 'Signature of authorised witness:', '', left, y, 390, 150);
    font(doc, 'regular', 8);
    text(doc, 'Date:', left + 405, y, 30);
    drawDateBoxes(doc, notice.declaration_date, left + 432, y - 5);
    y += 27;

    font(doc, 'bold', 9);
    text(doc, 'Personal Information Collection Notice', left, y);
    y += 12;
    font(doc, 'regular', 7.4);
    text(
      doc,
      'Transport for NSW is committed to protecting your privacy and ensuring your personal and health information is managed according to law. Find out why we collect your personal information and how we use and manage it by reading our privacy statement at www.transport.nsw.gov.au/privacy-statement or phone 13 22 13 to request a copy.',
      left,
      y,
      contentWidth,
      { lineGap: -1 }
    );
    y += 33;
    font(doc, 'bold', 8);
    text(doc, 'Please return this form to:', left, y, 120);
    font(doc, 'regular', 8);
    text(
      doc,
      'Toll Compliance Management, Locked Bag 5004, Parramatta NSW 2124',
      left + 121,
      y,
      360
    );

    font(doc, 'regular', 6.8);
    text(doc, 'Catalogue No. 45071726  Form No. 1672 (04/2022)', left, 805, 240);
    font(doc, 'bold', 11);
    text(doc, 'OFFICIAL: Sensitive - Personal', left + 210, 805, 165);
    font(doc, 'regular', 7);
    text(doc, '(when completed)', left + 245, 819, 90);
    text(doc, 'Page 1 of 1', right - 55, 805, 55, { align: 'right' });

    doc.end();
  });
