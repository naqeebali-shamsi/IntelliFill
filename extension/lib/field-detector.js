/**
 * Field Detector
 *
 * Detects and categorizes input fields on web pages
 */

const FieldDetector = (() => {
  'use strict';

  // Field type enumeration
  const FieldType = {
    TEXT: 'text',
    EMAIL: 'email',
    PHONE: 'phone',
    DATE: 'date',
    ADDRESS: 'address',
    SSN: 'ssn',
    NUMBER: 'number',
    UNKNOWN: 'unknown'
  };

  // Field detection patterns
  const FIELD_PATTERNS = {
    [FieldType.EMAIL]: [
      /email/i,
      /e[-_]?mail/i,
      /mail/i
    ],
    [FieldType.PHONE]: [
      /phone/i,
      /tel/i,
      /mobile/i,
      /cell/i,
      /fax/i
    ],
    [FieldType.DATE]: [
      /date/i,
      /birth/i,
      /dob/i,
      /day/i,
      /month/i,
      /year/i,
      /expire/i,
      /expiry/i
    ],
    [FieldType.ADDRESS]: [
      /address/i,
      /street/i,
      /city/i,
      /state/i,
      /zip/i,
      /postal/i,
      /country/i,
      /location/i
    ],
    [FieldType.SSN]: [
      /ssn/i,
      /social[-_]?security/i,
      /tax[-_]?id/i,
      /ein/i
    ],
    [FieldType.NUMBER]: [
      /number/i,
      /num/i,
      /id/i,
      /account/i,
      /reference/i,
      /ref/i
    ],
    [FieldType.TEXT]: [],
    [FieldType.UNKNOWN]: []
  };

  // Selectors for detectable fields
  const FIELD_SELECTORS = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="date"]',
    'input[type="number"]',
    'input[type="search"]',
    'input[type="url"]',
    'input:not([type])', // Input without type defaults to text
    'textarea',
    'select'
  ].join(', ');

  // Elements to exclude
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
    '.intellifill-autocomplete', // Don't detect our own dropdowns
    '[data-intellifill-processed]' // Already processed fields
  ].join(', ');

  /**
   * Detect field type from element attributes
   */
  function detectFieldType(element) {
    // Check input type attribute first
    const inputType = element.type?.toLowerCase();
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
          return type;
        }
      }
    }

    return FieldType.TEXT;
  }

  /**
   * Get best field identifier from element
   */
  function getFieldIdentifier(element) {
    // Priority: name > id > placeholder > aria-label > autocomplete
    return element.name ||
           element.id ||
           element.placeholder ||
           element.getAttribute('aria-label') ||
           element.getAttribute('autocomplete') ||
           '';
  }

  /**
   * Get field label text
   */
  function getFieldLabel(element) {
    // Try associated label element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Clone and remove input to get just label text
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      return clone.textContent?.trim() || '';
    }

    // Try aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // Try placeholder
    if (element.placeholder) return element.placeholder.trim();

    return '';
  }

  /**
   * Check if element is visible and interactable
   */
  function isElementVisible(element) {
    if (!element.offsetParent && element.style.display !== 'fixed') {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  /**
   * Check if element should be excluded
   */
  function shouldExclude(element) {
    // Check against excluded selectors
    if (element.matches(EXCLUDED_SELECTORS)) {
      return true;
    }

    // Check if inside excluded containers
    const excludedContainers = [
      '[data-intellifill-ignore]',
      '.captcha',
      '.recaptcha'
    ];

    for (const selector of excludedContainers) {
      if (element.closest(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect all form fields on the page
   */
  function detectFields() {
    const fields = [];
    const elements = document.querySelectorAll(FIELD_SELECTORS);

    elements.forEach(element => {
      // Skip if should be excluded
      if (shouldExclude(element)) return;

      // Skip if not visible
      if (!isElementVisible(element)) return;

      // Detect field metadata
      const fieldData = {
        element: element,
        name: getFieldIdentifier(element),
        label: getFieldLabel(element),
        type: detectFieldType(element),
        tagName: element.tagName.toLowerCase(),
        inputType: element.type || 'text',
        value: element.value || '',
        isRequired: element.required || element.hasAttribute('required'),
        autocomplete: element.getAttribute('autocomplete') || ''
      };

      fields.push(fieldData);
    });

    return fields;
  }

  /**
   * Mark field as processed
   */
  function markAsProcessed(element) {
    element.setAttribute('data-intellifill-processed', 'true');
  }

  /**
   * Check if field is already processed
   */
  function isProcessed(element) {
    return element.hasAttribute('data-intellifill-processed');
  }

  /**
   * Observe DOM changes for dynamic forms
   */
  function observeDOMChanges(callback) {
    const observer = new MutationObserver((mutations) => {
      let hasNewFields = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain form fields
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const hasFields = node.matches?.(FIELD_SELECTORS) ||
                                node.querySelector?.(FIELD_SELECTORS);
              if (hasFields) {
                hasNewFields = true;
              }
            }
          });
        }
      }

      if (hasNewFields) {
        callback();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Public API
  return {
    FieldType,
    detectFields,
    detectFieldType,
    getFieldIdentifier,
    getFieldLabel,
    isElementVisible,
    shouldExclude,
    markAsProcessed,
    isProcessed,
    observeDOMChanges
  };
})();

// Make available globally
window.FieldDetector = FieldDetector;
