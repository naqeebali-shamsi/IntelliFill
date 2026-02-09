/**
 * Form Filler - DOM manipulation for filling form fields
 *
 * Uses native value setters to ensure React/Vue/Angular detect changes.
 * Handles input, select, textarea, and date fields.
 */

import type { MatchedField, FillResult } from '../shared/types/field-matching';

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Get the native value setter for an input element (bypasses framework getters) */
function getNativeSetter(element: FormElement): ((v: string) => void) | null {
  if (element instanceof HTMLInputElement) {
    return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ?? null;
  }
  if (element instanceof HTMLTextAreaElement) {
    return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set ?? null;
  }
  return null;
}

/** Dispatch input/change events so frameworks detect the value change */
function dispatchChangeEvents(element: FormElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** Format a date string to YYYY-MM-DD for date inputs */
function formatDateValue(value: string): string {
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0] ?? value;
  }
  return value;
}

/** Fill a select element by matching option value or text */
function fillSelectField(element: HTMLSelectElement, value: string): boolean {
  const normalizedValue = value.toLowerCase().trim();
  const options = Array.from(element.options);

  // Match by option value (exact)
  const byValue = options.find((opt) => opt.value.toLowerCase() === normalizedValue);
  if (byValue) {
    element.value = byValue.value;
    dispatchChangeEvents(element);
    return true;
  }

  // Match by option text (exact)
  const byText = options.find((opt) => opt.text.toLowerCase().trim() === normalizedValue);
  if (byText) {
    element.value = byText.value;
    dispatchChangeEvents(element);
    return true;
  }

  // Match by option text (contains)
  const byContains = options.find(
    (opt) =>
      opt.text.toLowerCase().includes(normalizedValue) ||
      normalizedValue.includes(opt.text.toLowerCase().trim()),
  );
  if (byContains) {
    element.value = byContains.value;
    dispatchChangeEvents(element);
    return true;
  }

  return false;
}

/** Fill a single input or textarea field using native setter */
function fillInputField(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  const inputType = (element as HTMLInputElement).type?.toLowerCase();
  const fillValue = inputType === 'date' ? formatDateValue(value) : value;

  const nativeSetter = getNativeSetter(element);
  if (nativeSetter) {
    nativeSetter.call(element, fillValue);
  } else {
    element.value = fillValue;
  }

  element.focus();
  dispatchChangeEvents(element);
  return true;
}

/** Fill a single form field with a value */
export function fillField(element: FormElement, value: string): boolean {
  try {
    if (element instanceof HTMLSelectElement) {
      return fillSelectField(element, value);
    }
    return fillInputField(element as HTMLInputElement | HTMLTextAreaElement, value);
  } catch (error) {
    console.error('IntelliFill: Error filling field', error);
    return false;
  }
}

/**
 * Fill all matched fields that have exactly one match (unambiguous).
 * Fields with multiple matches are skipped (user should select from dropdown).
 */
export function fillAllFields(matchedFields: MatchedField[]): FillResult {
  const result: FillResult = { filled: 0, skipped: 0, failed: 0 };

  for (const { field, matches } of matchedFields) {
    // Skip fields with multiple matches -- user must choose
    if (matches.length !== 1) {
      result.skipped++;
      continue;
    }

    // Skip fields that already have a value
    if ((field.element as HTMLInputElement).value?.trim()) {
      result.skipped++;
      continue;
    }

    const match = matches[0];
    if (!match) {
      result.skipped++;
      continue;
    }
    const success = fillField(field.element, match.value);
    if (success) {
      result.filled++;
    } else {
      result.failed++;
    }
  }

  return result;
}
