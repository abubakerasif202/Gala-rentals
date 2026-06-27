import { describe, expect, it } from 'vitest';
import { sanitizeSpreadsheetCell, serializeCsv } from './csv';

describe('CSV serialization', () => {
  it.each(['=2+2', '+61400000000', '-1', '@name', '\tcmd', '\rcmd', '\ncmd'])(
    'neutralizes spreadsheet formula prefix %j',
    (value) => expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`)
  );

  it('escapes formula-leading customer, vehicle, invoice, and notes fields', () => {
    const csv = serializeCsv([
      ['Name', 'Email', 'Vehicle', 'Invoice', 'Notes', 'Empty', 'Null'],
      ['=HYPERLINK("bad")', '+user@example.com', '-rego', '@invoice', '\tprivate', '', null],
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\'+user@example.com"');
    expect(csv).toContain('"\'-rego"');
    expect(csv).toContain('"\'@invoice"');
    expect(csv).toContain('"\'\tprivate"');
    expect(csv.endsWith('"",""')).toBe(true);
  });
});
