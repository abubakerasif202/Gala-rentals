export type CsvCell = string | number | boolean | null | undefined;

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r\n]/;

export const sanitizeSpreadsheetCell = (value: CsvCell) => {
  const text = value == null ? '' : String(value);
  return SPREADSHEET_FORMULA_PREFIX.test(text) ? `'${text}` : text;
};

export const serializeCsv = (rows: CsvCell[][]) =>
  rows
    .map((row) =>
      row
        .map((value) => `"${sanitizeSpreadsheetCell(value).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n');
