import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';

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

const decodeLiteralPdfString = (value: string) =>
  value
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');

const extractVisiblePdfText = (pdf: Buffer) => {
  const raw = pdf.toString('latin1');
  const chunks: string[] = [];

  for (const match of raw.matchAll(/<<(?:.|\r|\n)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const objectSource = match[0];
    const streamBytes = Buffer.from(match[1], 'latin1');
    const streamText = objectSource.includes('/FlateDecode')
      ? inflateSync(streamBytes).toString('latin1')
      : streamBytes.toString('latin1');

    if (!streamText.includes(' Tj') || streamText.includes('\u0000')) {
      continue;
    }

    for (const textMatch of streamText.matchAll(/(?:\(([^()]*)\)|<([0-9A-Fa-f]+)>)\s*Tj/g)) {
      if (textMatch[1] !== undefined) {
        chunks.push(decodeLiteralPdfString(textMatch[1]));
      } else if (textMatch[2]) {
        chunks.push(Buffer.from(textMatch[2], 'hex').toString('latin1'));
      }
    }
  }

  return chunks.join(' ').replace(/\s+/g, ' ');
};

describe('buildTollTransferNoticePdf', () => {
  it('uses the original NSW tolling notice PDF template', async () => {
    const pdf = await buildTollTransferNoticePdf(sampleNotice);
    const document = await PDFDocument.load(pdf);
    const page = document.getPage(0);
    const text = extractVisiblePdfText(pdf);

    expect(document.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
    expect(text).toContain('Tolling Notice Statutory Declaration');
    expect(text).toContain('By submitting this nomination');
    expect(text).toContain('Completed form must be received at least 7 days before');
    expect(text).toContain('Toll Notice has been enclosed');
  });

  it('overlays notice, company, and nominee details onto the original form fields', async () => {
    const text = extractVisiblePdfText(await buildTollTransferNoticePdf(sampleNotice));
    const compactText = text.replace(/\s+/g, '');

    expect(compactText).toContain('TN123456789');
    expect(compactText).toContain('DC95MA');
    expect(compactText).toContain('SAPFARAZALIRAJABI');
    expect(compactText).toContain('MAPLEPAINTINGPTYLTD');
    expect(compactText).toContain('MALIK');
    expect(compactText).toContain('MANDEEP');
    expect(compactText).toContain('26062000');
    expect(compactText).not.toContain('MANDEEPMALIK');
    expect(compactText).not.toContain('20000626');
  });
});
