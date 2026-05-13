import { describe, expect, it } from 'vitest';

import { buildTollTransferNoticePdf, type TollTransferNoticePdfData } from './tollTransferNoticePdf.js';

const sampleNotice: TollTransferNoticePdfData = {
  authorised_officer_name: 'Sapfaraz Ali Rajabi',
  declaration_date: '2026-05-13',
  declaration_place: 'Merrylands NSW 2160',
  nominee_address: '11 Lytton St',
  nominee_country: 'Australia',
  nominee_dob: '2000-06-26',
  nominee_full_name: 'Mandeep Malik',
  nominee_phone: '0413058917',
  nominee_postcode: '2145',
  nominee_state: 'NSW',
  nominee_suburb: 'Wentworthville',
  responsible_type: 'responsible',
  toll_notice_number: 'TN123456789',
  toll_trip_date: '2026-05-12',
  vehicle_registration: 'DC95MA',
  witness_jp_number: '258403',
  witness_name: 'Zain Ul Abadin Mehdi',
  witness_qualification: 'Justice of the Peace',
};

const extractPdfText = (pdf: Buffer) =>
  Array.from(pdf.toString('latin1').matchAll(/<([0-9A-Fa-f]+)>/g))
    .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
    .join('')
    .replace(/\s+/g, ' ');

describe('buildTollTransferNoticePdf', () => {
  it('renders the NSW tolling notice statutory declaration details from the original form', async () => {
    const text = extractPdfText(await buildTollTransferNoticePdf(sampleNotice));

    expect(text).toContain('Tolling Notice Statutory Declaration');
    expect(text).toContain('Completed form must be received at least 7 days before');
    expect(text).toContain('13/27-33 Addlestone Rd, Merrylands NSW 2160');
    expect(text).toContain('Toll Notice has been enclosed');
    expect(text).toContain('Oaths Act 1900');
    expect(text).toContain('Catalogue No. 45071726 Form No. 1672 (04/2022)');
  });

  it('places the nominee surname and given names in the original form fields', async () => {
    const text = extractPdfText(await buildTollTransferNoticePdf(sampleNotice));

    expect(text).toContain('Surname or organisation name:MALIK');
    expect(text).toContain('Given name(s):MANDEEP');
    expect(text).toContain('Date of birth:26/06/2000');
    expect(text).not.toContain('Surname or organisation name:MANDEEP');
    expect(text).not.toContain('Date of birth2000-06-26');
  });
});
