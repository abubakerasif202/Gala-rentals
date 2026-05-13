import { useId, useRef, useState } from 'react';
import Editor from 'react-simple-code-editor';

import { insertTemplateVariable } from './agreementEditorUtils';

export const AGREEMENT_TEMPLATE_VARIABLES = [
  '{{registeredOwnerName}}',
  '{{registeredOwnerAddress}}',
  '{{registeredOwnerContact}}',
  '{{registeredOwnerEmail}}',
  '{{renteeName}}',
  '{{renteeDob}}',
  '{{renteeLicenseNumber}}',
  '{{renteeLicenseState}}',
  '{{renteeAddress}}',
  '{{renteeContact}}',
  '{{renteeEmail}}',
  '{{vehicleMake}}',
  '{{vehicleModel}}',
  '{{vehicleYear}}',
  '{{vehicleVin}}',
  '{{vehicleReg}}',
  '{{kmAllowance}}',
  '{{weeklyRent}}',
  '{{fuelPolicy}}',
  '{{insuranceCoverage}}',
  '{{feeSchedule}}',
  '{{rentalStartDate}}',
  '{{rentalEndDate}}',
  '{{minimumRentalPeriod}}',
  '{{returnPolicy}}',
  '{{agreementDate}}',
];

interface MarkdownTemplateEditorProps {
  onChange: (value: string) => void;
  value: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const highlightMarkdownLine = (line: string) => {
  let highlighted = line;

  highlighted = highlighted.replace(
    /(^#{1,6}\s.+$)/g,
    '<span style="color:#dfb125">$1</span>'
  );
  highlighted = highlighted.replace(
    /(\*\*[^*]+\*\*)/g,
    '<span style="color:#ffffff">$1</span>'
  );
  highlighted = highlighted.replace(
    /(`[^`]+`)/g,
    '<span style="color:#dfb125;background:rgba(223,177,37,0.08)">$1</span>'
  );
  highlighted = highlighted.replace(
    /^(-\s)/,
    '<span style="color:#dfb125">$1</span>'
  );

  return highlighted;
};

const highlightAgreementTemplate = (code: string) =>
  escapeHtml(code)
    .split('\n')
    .map(highlightMarkdownLine)
    .join('\n')
    .replace(
      /(\{\{\s*[a-zA-Z0-9_.]+\s*\}\})/g,
      '<span style="color:#dfb125;background:rgba(223,177,37,0.14);border-radius:4px">$1</span>'
    );

export default function MarkdownTemplateEditor({
  onChange,
  value,
}: MarkdownTemplateEditorProps) {
  const editorId = useId();
  const selectionRef = useRef({ end: value.length, start: value.length });
  const [selectedVariable, setSelectedVariable] = useState('');

  const updateSelection = (event: React.SyntheticEvent<HTMLElement>) => {
    const target = event.target as HTMLTextAreaElement;

    if (typeof target.selectionStart !== 'number' || typeof target.selectionEnd !== 'number') {
      return;
    }

    selectionRef.current = {
      end: target.selectionEnd,
      start: target.selectionStart,
    };
  };

  const insertVariable = (variable: string) => {
    const result = insertTemplateVariable(
      value,
      variable,
      selectionRef.current.start,
      selectionRef.current.end
    );

    onChange(result.value);
    selectionRef.current = {
      end: result.nextCursorPosition,
      start: result.nextCursorPosition,
    };

    window.requestAnimationFrame(() => {
      const textarea = document.getElementById(editorId) as HTMLTextAreaElement | null;

      textarea?.focus();
      textarea?.setSelectionRange(result.nextCursorPosition, result.nextCursorPosition);
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e3a5f] bg-[#0b1f36]">
      <div className="sticky top-0 z-10 border-b border-[#1e3a5f] bg-[#061425] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Variables
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Click to insert at cursor position
            </p>
          </div>
          <select
            value={selectedVariable}
            onChange={(event) => {
              const variable = event.target.value;
              setSelectedVariable('');

              if (variable) {
                insertVariable(variable);
              }
            }}
            className="h-10 rounded-lg border border-[#1e3a5f] bg-[#0b1f36] px-3 text-xs text-white outline-none focus:border-[#dfb125] lg:hidden"
          >
            <option value="">Insert variable...</option>
            {AGREEMENT_TEMPLATE_VARIABLES.map((variable) => (
              <option key={variable} value={variable}>
                {variable}
              </option>
            ))}
          </select>
          <div className="hidden max-h-24 flex-wrap gap-2 overflow-y-auto lg:flex xl:justify-end">
            {AGREEMENT_TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="rounded-lg border border-[#1e3a5f] bg-[#0b1f36] px-3 py-2 font-mono text-[11px] text-white transition-all hover:border-[#dfb125]/70 hover:text-[#dfb125]"
              >
                {variable}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlightAgreementTemplate}
        padding={20}
        textareaId={editorId}
        onClick={updateSelection}
        onKeyUp={updateSelection}
        onSelect={updateSelection}
        placeholder="Agreement template markdown"
        className="min-h-[440px] text-xs leading-6"
        textareaClassName="outline-none"
        preClassName="font-mono"
        spellCheck={false}
        style={{
          background: '#0b1f36',
          caretColor: '#dfb125',
          color: 'white',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          minHeight: 440,
        }}
      />
    </div>
  );
}
