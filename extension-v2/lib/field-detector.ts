/**
 * Field Detector - TypeScript port from extension/lib/field-detector.js
 *
 * Detects and categorizes input fields on web pages.
 * Preserves the v1 detection logic with proper TypeScript types.
 */

import { FieldType, type DetectedField } from '../shared/types/field-detection';

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Regex patterns for field type detection, ordered by specificity */
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  [FieldType.EMAIL]: [/email/i, /e[-_]?mail/i, /mail/i],
  [FieldType.PHONE]: [/phone/i, /tel/i, /mobile/i, /cell/i, /fax/i],
  [FieldType.DATE]: [/date/i, /birth/i, /dob/i, /day/i, /month/i, /year/i, /expire/i, /expiry/i],
  [FieldType.ADDRESS]: [
    /address/i,
    /street/i,
    /city/i,
    /state/i,
    /zip/i,
    /postal/i,
    /country/i,
    /location/i,
  ],
  [FieldType.SSN]: [/ssn/i, /social[-_]?security/i, /tax[-_]?id/i, /ein/i],
  [FieldType.NUMBER]: [/number/i, /num/i, /id/i, /account/i, /reference/i, /ref/i],
};

/** CSS selectors for detectable form fields */
const FIELD_SELECTORS = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="date"]',
  'input[type="number"]',
  'input[type="search"]',
  'input[type="url"]',
  'input:not([type])',
  'textarea',
  'select',
].join(', ');

/** CSS selectors for elements to exclude */
const EXCLUDED_SELECTORS = [
  '[type="password"]',
  '[type="hidden"]',
  '[type="submit"]',
  '[type="button"]',
  '[type="reset"]',
  '[type="file"]',
  '[type="image"]',
  '[type="checkbox"]',
  '[type="radio"]',
  '[disabled]',
  '[readonly]',
  '[aria-hidden="true"]',
  '.intellifill-autocomplete',
  '[data-intellifill-processed]',
].join(', ');

/** Containers that should be excluded from field detection */
const EXCLUDED_CONTAINERS = ['[data-intellifill-ignore]', '.captcha', '.recaptcha'];

/** Detect field type from element attributes */
export function detectFieldType(element: FormElement): FieldType {
  // Check input type attribute first
  const inputType = (element as HTMLInputElement).type?.toLowerCase();
  if (inputType === 'email') return FieldType.EMAIL;
  if (inputType === 'tel') return FieldType.PHONE;
  if (inputType === 'date') return FieldType.DATE;
  if (inputType === 'number') return FieldType.NUMBER;

  // Check name, id, placeholder, aria-label
  const fieldName = getFieldIdentifier(element);
  const normalizedName = fieldName.toLowerCase().trim();

  // Match against patterns
  for (const [type, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        return type as FieldType;
      }
    }
  }

  return FieldType.TEXT;
}

/** Get the best identifying string from a form element */
export function getFieldIdentifier(element: FormElement): string {
  // Priority: name > id > placeholder > aria-label > autocomplete
  return (
    (element as HTMLInputElement).name ||
    element.id ||
    (element as HTMLInputElement).placeholder ||
    element.getAttribute('aria-label') ||
    element.getAttribute('autocomplete') ||
    ''
  );
}

/** Extract label text associated with a form element */
export function getFieldLabel(element: FormElement): string {
  // Try associated label element via for attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) return label.textContent?.trim() || '';
  }

  // Try parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => input.remove());
    return clone.textContent?.trim() || '';
  }

  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Try placeholder
  const placeholder = (element as HTMLInputElement).placeholder;
  if (placeholder) return placeholder.trim();

  return '';
}

/** Check if an element is visible and interactable */
export function isElementVisible(element: FormElement): boolean {
  if (!element.offsetParent && (element as HTMLElement).style.display !== 'fixed') {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/** Check if an element should be excluded from detection */
export function shouldExclude(element: FormElement): boolean {
  if (element.matches(EXCLUDED_SELECTORS)) {
    return true;
  }

  for (const selector of EXCLUDED_CONTAINERS) {
    if (element.closest(selector)) {
      return true;
    }
  }

  return false;
}

/** Mark a field as processed by IntelliFill */
export function markAsProcessed(element: FormElement): void {
  element.setAttribute('data-intellifill-processed', 'true');
}

/** Check if a field has already been processed */
export function isProcessed(element: FormElement): boolean {
  return element.hasAttribute('data-intellifill-processed');
}

/** Detect all form fields on the page */
export function detectFields(): DetectedField[] {
  const fields: DetectedField[] = [];
  const elements = document.querySelectorAll<FormElement>(FIELD_SELECTORS);

  elements.forEach((element) => {
    if (shouldExclude(element)) return;
    if (!isElementVisible(element)) return;

    fields.push({
      element,
      name: getFieldIdentifier(element),
      label: getFieldLabel(element),
      type: detectFieldType(element),
      tagName: element.tagName.toLowerCase(),
      inputType: (element as HTMLInputElement).type || 'text',
      value: (element as HTMLInputElement).value || '',
      isRequired:
        (element as HTMLInputElement).required || element.hasAttribute('required'),
      autocomplete: element.getAttribute('autocomplete') || '',
    });
  });

  return fields;
}

/**
 * Observe DOM changes for dynamically added form fields.
 * Calls the callback (debounced) when new fields are detected.
 * Returns the MutationObserver instance for cleanup.
 */
export function observeDOMChanges(callback: () => void): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver((mutations) => {
    let hasNewFields = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const hasFields = el.matches?.(FIELD_SELECTORS) || el.querySelector?.(FIELD_SELECTORS);
            if (hasFields) {
              hasNewFields = true;
            }
          }
        });
      }
    }

    if (hasNewFields) {
      // Debounce to batch rapid DOM changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, 200);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
