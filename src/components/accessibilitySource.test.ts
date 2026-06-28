import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const expectAll = (source: string, snippets: string[]) => {
  for (const snippet of snippets) {
    expect(source).toContain(snippet);
  }
};

describe('accessibility source regressions', () => {
  it('keeps inquiry form controls labelled and errors announced without changing submit flow', () => {
    const source = readSource('src/components/InquiryForm.tsx');

    expectAll(source, [
      "const inquiryFieldId = (field: keyof InquiryValues) => `inquiry-${field}`",
      "const inquiryErrorId = (field: keyof InquiryValues) => `${inquiryFieldId(field)}-error`",
      "role=\"alert\"",
      "await submitInquiry(data);",
      "setIsSuccess(true);",
      "reset();",
      "setSubmitError(error.response?.data?.error || 'Unable to send your inquiry right now.');",
    ]);

    for (const field of ['name', 'email', 'phone', 'startDate', 'endDate', 'message']) {
      expect(source).toContain(`htmlFor={inquiryFieldId('${field}')}`);
      expect(source).toContain(`id={inquiryFieldId('${field}')}`);
    }

    for (const field of ['name', 'email', 'phone', 'startDate', 'endDate']) {
      expect(source).toContain(
        `aria-describedby={errors.${field} ? inquiryErrorId('${field}') : undefined}`
      );
      expect(source).toContain(`id={inquiryErrorId('${field}')}`);
    }
  });

  it('keeps mobile admin sidebar exposed as an accessible modal drawer', () => {
    const source = readSource('src/components/admin/Sidebar.tsx');

    expectAll(source, [
      "const drawerRef = useRef<HTMLElement | null>(null);",
      "const returnFocusRef = useRef<HTMLElement | null>(null);",
      "drawerRef.current?.focus();",
      "document.body.style.overflow = 'hidden';",
      "document.body.style.overflow = originalOverflow;",
      "if (event.key === 'Escape')",
      'onClose();',
      "document.addEventListener('keydown', handleKeyDown);",
      "document.removeEventListener('keydown', handleKeyDown);",
      'returnFocusRef.current?.focus();',
      "role={isOpen ? 'dialog' : undefined}",
      'aria-modal={isOpen ? true : undefined}',
      "aria-label={isOpen ? 'Admin navigation menu' : undefined}",
      'aria-label="Close admin navigation menu"',
    ]);
  });

  it('keeps data table filters and sortable headers exposing their current ARIA state', () => {
    const source = readSource('src/components/admin/DataTable.tsx');

    expectAll(source, [
      'const isFilterOpen = openFilterId === filterConfig.id;',
      'const filterPopoverId = `datatable-filter-${filterConfig.id}`;',
      'aria-expanded={isFilterOpen}',
      'aria-controls={filterPopoverId}',
      'id={filterPopoverId}',
      "return { columnId: column.id, direction: 'asc' };",
      "return { columnId: column.id, direction: 'desc' };",
      'return null;',
      'aria-sort={',
      "'ascending'",
      "'descending'",
      "'none'",
    ]);
  });

  it('keeps admin dashboard approval and cancellation fields accessible without rendering auth-bound admin flows', () => {
    const source = readSource('src/pages/AdminDashboard.tsx');

    expectAll(source, [
      "const applicationApprovalFieldId = (field: keyof typeof defaultApplicationApprovalForm) =>",
      'id="application-approval-form-helper"',
      'aria-describedby="application-approval-form-helper"',
      'id="cancel-application-warning"',
      'htmlFor="cancel-application-reason"',
      'id="cancel-application-reason"',
      'aria-describedby="cancel-application-warning"',
    ]);

    for (const field of [
      'approved_vehicle',
      'approved_bond',
      'approved_weekly_price',
      'rental_subscription_start_date',
    ]) {
      expect(source).toContain(`htmlFor={applicationApprovalFieldId('${field}')}`);
      expect(source).toContain(`id={applicationApprovalFieldId('${field}')}`);
    }
  });

  it('keeps the application route clear for both new and existing drivers', () => {
    const source = readSource('src/pages/Apply.tsx');

    expectAll(source, [
      'Already applied or currently renting?',
      'to="/my-rental"',
      'View My Rental',
      'get an approved quote before any secure payment link is issued.',
    ]);
  });
});
