import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';

import { buildTollTransferNoticePdf, type TollTransferNoticePdfData } from './tollTransferNoticePdf.js';
import { companyDetails } from '../../shared/companyDetails.js';

const legacyCompanyFragments = [
  'MAPLE',
  'MAPLEPAINTINGPTYLTD',
  'MAPLERENTALS',
  'AURORA',
  'ADDLESTONE',
  '13/27-33',
  'MERRYLANDS',
] as const;

const sampleNotice: TollTransferNoticePdfData = {
  authorised_officer_name: 'Sapfaraz Ali Rajabi',
  declaration_date: '2026-05-13',
  declaration_place: 'NSW',
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

type PdfTextDraw = {
  size: number;
  text: string;
  x: number;
  y: number;
};

const decodePdfHexString = (value: string) => Buffer.from(value, 'hex').toString('latin1');

const extractVisiblePdfDraws = (pdf: Buffer) => {
  const raw = pdf.toString('latin1');
  const draws: PdfTextDraw[] = [];

  for (const match of raw.matchAll(/<<(?:.|\r|\n)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const objectSource = match[0];
    const streamBytes = Buffer.from(match[1], 'latin1');
    const streamText = objectSource.includes('/FlateDecode')
      ? inflateSync(streamBytes).toString('latin1')
      : streamBytes.toString('latin1');

    if (!streamText.includes(' Tj') || streamText.includes('\u0000')) {
      continue;
    }

    for (const textMatch of streamText.matchAll(
      /BT[\s\S]*?([0-9.-]+)\s+0\s+0\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+Tm[\s\S]*?(?:\(([^()]*)\)|<([0-9A-Fa-f]+)>)\s*Tj[\s\S]*?ET/g
    )) {
      draws.push({
        size: Number(textMatch[1]),
        text:
          textMatch[5] !== undefined
            ? decodeLiteralPdfString(textMatch[5])
            : decodePdfHexString(textMatch[6] || ''),
        x: Number(textMatch[3]),
        y: Number(textMatch[4]),
      });
    }
  }

  return draws;
};

type BoxLayout = {
  boxHeight: number;
  boxWidth: number;
  cells: number;
  startX: number;
  startY: number;
};

const officialCellWidth = 14.173;
const officialCellHeight = 17.008;

const boxedLayouts = {
  country: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 13, startX: 96.378, startY: 447.874 },
  declarationDate: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 2, startX: 453.657, startY: 308.623 },
  dob: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 2, startX: 433.814, startY: 521.575 },
  givenNames: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 19, startX: 96.491, startY: 521.575 },
  mailingAddress: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 33, startX: 96.491, startY: 493.228 },
  newOwnerFromDate: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 2, startX: 246.728, startY: 377.008 },
  phone: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 10, startX: 96.378, startY: 425.197 },
  postcode: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 4, startX: 507.515, startY: 470.551 },
  state: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 3, startX: 411.137, startY: 470.551 },
  suburb: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 19, startX: 96.491, startY: 470.551 },
  surname: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 29, startX: 153.184, startY: 544.252 },
  tollNoticeNumber: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 11, startX: 110.665, startY: 705.827 },
  vehicleRegistration: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 7, startX: 464.995, startY: 705.827 },
  witnessDate: { boxHeight: officialCellHeight, boxWidth: officialCellWidth, cells: 2, startX: 453.657, startY: 110.197 },
};

const insideLayout = (draw: PdfTextDraw, layout: BoxLayout) =>
  draw.x >= layout.startX - 0.01 &&
  draw.x <= layout.startX + layout.boxWidth * layout.cells + 0.01 &&
  draw.y >= layout.startY - 0.01 &&
  draw.y <= layout.startY + layout.boxHeight + 0.01;

const expectBoxedCharacters = (draws: PdfTextDraw[], layout: BoxLayout, expected: string) => {
  const visibleExpected = [...expected].filter((char) => char !== ' ');
  const fieldDraws = draws
    .filter((draw) => draw.text.length === 1 && insideLayout(draw, layout))
    .sort((left, right) => left.x - right.x);

  expect(fieldDraws.map((draw) => draw.text).join('')).toBe(visibleExpected.join(''));

  let drawIndex = 0;
  [...expected].forEach((char, cellIndex) => {
    if (char === ' ') {
      return;
    }

    const draw = fieldDraws[drawIndex];
    const cellLeft = layout.startX + cellIndex * layout.boxWidth;
    const cellRight = cellLeft + layout.boxWidth;
    expect(draw, `expected ${char} in cell ${cellIndex}`).toBeDefined();
    expect(draw.text).toBe(char);
    expect(draw.x).toBeGreaterThanOrEqual(cellLeft);
    expect(draw.x).toBeLessThan(cellRight);
    expect(draw.y).toBeGreaterThanOrEqual(layout.startY);
    expect(draw.y).toBeLessThanOrEqual(layout.startY + layout.boxHeight);
    drawIndex += 1;
  });
};

const expectDateBoxes = (
  draws: PdfTextDraw[],
  layout: BoxLayout,
  expected: { day: string; month: string; year: string }
) => {
  expectBoxedCharacters(draws, layout, expected.day);
  expectBoxedCharacters(draws, { ...layout, startX: layout.startX + officialCellWidth * 2.6 }, expected.month);
  expectBoxedCharacters(draws, { ...layout, cells: 4, startX: layout.startX + officialCellWidth * 5.2 }, expected.year);
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
    expect(compactText).toContain(companyDetails.displayName.replace(/\s+/g, ''));
    for (const legacyFragment of legacyCompanyFragments) {
      expect(compactText).not.toContain(legacyFragment);
    }
    expect(compactText).toContain('MALIK');
    expect(compactText).toContain('MANDEEP');
    expect(compactText).toContain('26062000');
    expect(compactText).not.toContain('MANDEEPMALIK');
    expect(compactText).not.toContain('20000626');
  });

  it('renders completed form values one character per official boxed cell', async () => {
    const pdf = await buildTollTransferNoticePdf({
      ...sampleNotice,
      nominee_address: '11 Lytton St',
      nominee_country: 'Australia',
      nominee_dob: '26 / 06 / 2000',
      nominee_full_name: 'Mandeep Singh Malik',
      nominee_phone: '0413 058 917',
      nominee_state: 'nsw',
      responsible_type: 'new-owner',
      toll_notice_number: ' tn 987 654 321 ',
      toll_trip_date: '12 / 05 / 2026',
      vehicle_registration: ' dc 95 ma ',
    });
    const draws = extractVisiblePdfDraws(pdf);

    expectBoxedCharacters(draws, boxedLayouts.tollNoticeNumber, 'TN987654321');
    expectBoxedCharacters(draws, boxedLayouts.vehicleRegistration, 'DC95MA');
    expectBoxedCharacters(draws, boxedLayouts.surname, 'MALIK');
    expectBoxedCharacters(draws, boxedLayouts.givenNames, 'MANDEEP SINGH');
    expectBoxedCharacters(draws, boxedLayouts.mailingAddress, '11 LYTTON ST');
    expectBoxedCharacters(draws, boxedLayouts.suburb, 'WENTWORTHVILLE');
    expectBoxedCharacters(draws, boxedLayouts.state, 'NSW');
    expectBoxedCharacters(draws, boxedLayouts.postcode, '2145');
    expectBoxedCharacters(draws, boxedLayouts.country, 'AUSTRALIA');
    expectBoxedCharacters(draws, boxedLayouts.phone, '0413058917');
    expectDateBoxes(draws, boxedLayouts.dob, { day: '26', month: '06', year: '2000' });
    expectDateBoxes(draws, boxedLayouts.newOwnerFromDate, { day: '12', month: '05', year: '2026' });
    expectDateBoxes(draws, boxedLayouts.declarationDate, { day: '13', month: '05', year: '2026' });
    expectDateBoxes(draws, boxedLayouts.witnessDate, { day: '13', month: '05', year: '2026' });

    const newOwnerCheck = draws.find(
      (draw) =>
        draw.text === 'X' &&
        draw.x >= 229.72 &&
        draw.x <= 229.72 + 11.339 &&
        draw.y >= 394.016 &&
        draw.y <= 394.016 + 11.339
    );
    expect(newOwnerCheck).toBeDefined();
  });
});
