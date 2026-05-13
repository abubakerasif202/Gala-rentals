import { describe, expect, it } from 'vitest';

import { insertTemplateVariable } from './agreementEditorUtils.js';

describe('insertTemplateVariable', () => {
  it('inserts a variable at the current cursor position', () => {
    expect(
      insertTemplateVariable('Hello  driver', '{{renteeName}}', 6, 6)
    ).toEqual({
      nextCursorPosition: 20,
      value: 'Hello {{renteeName}} driver',
    });
  });

  it('replaces the selected range and moves the cursor after the variable', () => {
    expect(
      insertTemplateVariable('Vehicle: pending', '{{vehicleReg}}', 9, 16)
    ).toEqual({
      nextCursorPosition: 23,
      value: 'Vehicle: {{vehicleReg}}',
    });
  });
});
