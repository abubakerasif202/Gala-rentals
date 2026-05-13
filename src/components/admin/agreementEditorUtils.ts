export const insertTemplateVariable = (
  value: string,
  variable: string,
  selectionStart: number,
  selectionEnd: number
) => {
  const safeSelectionStart = Math.min(Math.max(0, selectionStart), value.length);
  const safeSelectionEnd = Math.min(
    Math.max(safeSelectionStart, selectionEnd),
    value.length
  );
  const nextValue =
    value.slice(0, safeSelectionStart) + variable + value.slice(safeSelectionEnd);

  return {
    nextCursorPosition: safeSelectionStart + variable.length,
    value: nextValue,
  };
};
