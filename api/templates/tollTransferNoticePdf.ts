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
  address: '13/27-33 Adderstone Rd, Merrylands NSW 2160',
  name: 'MAPLE PAINTING PTY LTD',
  phone: '0420 550 566',
};

const line = (doc: PDFKit.PDFDocument, x1: number, y: number, x2: number) => {
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
};

const checkbox = (doc: PDFKit.PDFDocument, x: number, y: number, checked: boolean) => {
  doc.rect(x, y, 10, 10).stroke();
  if (checked) {
    doc.moveTo(x + 2, y + 5).lineTo(x + 4.5, y + 8).lineTo(x + 8, y + 2).stroke();
  }
};

const fieldBox = (
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  width: number,
  height = 36
) => {
  doc.rect(x, y, width, height).stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).text(label.toUpperCase(), x + 4, y + 4, {
    width: width - 8,
  });
  doc.font('Helvetica').fontSize(9).text(value?.trim() || ' ', x + 4, y + 16, {
    width: width - 8,
    height: height - 18,
  });
};

const drawLetterBoxes = (
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  count: number,
  size = 14
) => {
  const normalized = value.toUpperCase().replace(/\s+/g, '');
  for (let index = 0; index < count; index += 1) {
    const boxX = x + index * size;
    doc.rect(boxX, y, size, size).stroke();
    const char = normalized[index] || '';
    if (char) {
      doc.font('Helvetica-Bold').fontSize(8).text(char, boxX, y + 3, {
        align: 'center',
        width: size,
      });
    }
  }
};

export const buildTollTransferNoticePdf = async (
  notice: TollTransferNoticePdfData
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: false,
      compress: false,
      margin: 28,
      size: 'A4',
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage();
    doc.lineWidth(0.6);

    const pageWidth = doc.page.width;
    const left = 28;
    const right = pageWidth - 28;
    const contentWidth = right - left;
    let y = 24;

    doc.font('Helvetica-Bold').fontSize(7).text('OFFICIAL: Sensitive - Personal (when completed)', left, y);
    y += 18;
    doc.font('Helvetica-Bold').fontSize(17).text(
      'Tolling Notice Statutory Declaration – Companies',
      left,
      y,
      { width: contentWidth - 110 }
    );
    doc.rect(right - 95, y - 4, 95, 42).stroke();
    doc.fontSize(7).text('OFFICE USE ONLY', right - 88, y + 4, { width: 82, align: 'center' });
    y += 38;

    doc.font('Helvetica').fontSize(7.5).text(
      'Use this form to give notice of the name and address of the driver who was in charge of the vehicle at the time of the trip. Print clearly in CAPITAL letters using black pen. The original Toll Notice or a copy must be enclosed.',
      left,
      y,
      { width: contentWidth }
    );
    y += 28;

    fieldBox(doc, 'Toll Notice number', notice.toll_notice_number, left, y, 250);
    fieldBox(doc, 'Vehicle registration number', notice.vehicle_registration, left + 260, y, 170);
    drawLetterBoxes(doc, notice.vehicle_registration, left + 438, y + 16, 7, 13);
    y += 46;

    fieldBox(doc, 'Organisation name', companyDetails.name, left, y, 260);
    fieldBox(doc, 'Phone number', companyDetails.phone, left + 270, y, 140);
    y += 42;
    fieldBox(doc, 'Organisation address', companyDetails.address, left, y, contentWidth, 38);
    y += 48;

    doc.rect(left, y, contentWidth, 18).fillAndStroke('#000000', '#000000');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(
      'PERSON OR ORGANISATION RESPONSIBLE FOR TOLL',
      left + 6,
      y + 5
    );
    doc.fillColor('#000000');
    y += 24;

    const [surname, ...givenParts] = notice.nominee_full_name.trim().split(/\s+/);
    const givenNames = givenParts.join(' ');
    fieldBox(doc, 'Surname or organisation name', surname || notice.nominee_full_name, left, y, 260);
    fieldBox(doc, 'Given name(s)', givenNames, left + 270, y, contentWidth - 270);
    y += 42;
    fieldBox(doc, 'Date of birth', notice.nominee_dob || '', left, y, 120);
    fieldBox(doc, 'Phone number', notice.nominee_phone, left + 130, y, 150);
    fieldBox(doc, 'Toll trip date', notice.toll_trip_date || '', left + 290, y, 120);
    y += 42;
    fieldBox(doc, 'Mailing address', notice.nominee_address, left, y, contentWidth, 40);
    y += 46;
    fieldBox(doc, 'Suburb', notice.nominee_suburb, left, y, 170);
    fieldBox(doc, 'State', notice.nominee_state, left + 180, y, 80);
    fieldBox(doc, 'Postcode', notice.nominee_postcode, left + 270, y, 100);
    fieldBox(doc, 'Country', notice.nominee_country, left + 380, y, contentWidth - 380);
    y += 48;

    checkbox(doc, left, y, notice.responsible_type === 'responsible');
    doc.font('Helvetica').fontSize(8).text(
      'was the driver, person or organisation responsible for toll',
      left + 16,
      y - 1
    );
    checkbox(doc, left, y + 18, notice.responsible_type === 'new-owner');
    doc.text('Was the new owner from:', left + 16, y + 17);
    line(doc, left + 120, y + 29, left + 230);
    checkbox(doc, left + 260, y + 18, notice.responsible_type === 'previous-owner');
    doc.text('Was the previous owner until:', left + 276, y + 17);
    line(doc, left + 400, y + 29, right);
    y += 50;

    doc.font('Helvetica-Bold').fontSize(8).text(
      'Toll Notice has been enclosed',
      left + 16,
      y - 1
    );
    checkbox(doc, left, y, true);
    doc.font('Helvetica').fontSize(7.5).text(
      'The original Toll Notice or a copy must be enclosed.',
      left + 16,
      y + 13
    );
    y += 38;

    doc.font('Helvetica-Bold').fontSize(8).text('Declaration', left, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).text(
      `I, ${notice.authorised_officer_name}, am an authorised officer of ${companyDetails.name}. I make this solemn declaration conscientiously believing the same to be true, and by virtue of the provisions of the Oaths Act 1900.`,
      left,
      y,
      { width: contentWidth }
    );
    y += 36;
    fieldBox(doc, 'Declared at [place]', notice.declaration_place, left, y, 220);
    fieldBox(doc, 'On [date]', notice.declaration_date, left + 230, y, 130);
    doc.font('Helvetica-Bold').fontSize(7).text('Signature of declarant', left + 380, y + 2);
    line(doc, left + 380, y + 32, right);
    y += 54;

    doc.font('Helvetica-Bold').fontSize(8).text('Authorised witness, who states:', left, y);
    y += 16;
    fieldBox(doc, 'Name of authorised witness', notice.witness_name || '', left, y, 260);
    fieldBox(doc, 'Qualification of authorised witness', notice.witness_qualification || '', left + 270, y, 180);
    fieldBox(doc, 'JP number', notice.witness_jp_number || '', left + 460, y, contentWidth - 460);
    y += 50;
    checkbox(doc, left, y, false);
    doc.font('Helvetica').fontSize(7.5).text('I saw the face of the person making this declaration.', left + 16, y - 1);
    checkbox(doc, left, y + 16, false);
    doc.text('I have known the person for at least 12 months.', left + 16, y + 15);
    checkbox(doc, left, y + 32, false);
    doc.text("I confirmed the person's identity using an identification document.", left + 16, y + 31);
    y += 64;
    doc.font('Helvetica-Bold').fontSize(7).text('Signature of authorised witness', left, y);
    line(doc, left + 145, y + 10, left + 360);
    doc.text('Date', left + 380, y);
    line(doc, left + 410, y + 10, right);
    y += 36;

    doc.font('Helvetica-Bold').fontSize(7).text('Please return this form to:', left, y);
    doc.font('Helvetica').fontSize(7).text(
      'Toll Compliance Management, Locked Bag 5004, Parramatta NSW 2124',
      left + 100,
      y
    );
    y += 16;
    doc.font('Helvetica-Bold').fontSize(7).text('Personal Information Collection Notice', left, y);
    y += 10;
    doc.font('Helvetica').fontSize(6.3).text(
      'Transport for NSW is committed to protecting your privacy and ensuring your personal and health information is managed according to law. Find out why we collect your personal information and how we use and manage it by reading our privacy statement at www.transport.nsw.gov.au/privacy-statement or phone 13 22 13 to request a copy.',
      left,
      y,
      { width: contentWidth }
    );
    doc.font('Helvetica-Bold').fontSize(6.5).text(
      'Catalogue No. 45071726  Form No. 1672  Page 1 of 1',
      left,
      812
    );
    doc.text('OFFICIAL: Sensitive - Personal (when completed)', right - 170, 812, {
      align: 'right',
      width: 170,
    });

    doc.end();
  });
