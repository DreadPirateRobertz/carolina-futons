/**
 * @module checkoutValidation
 * @description Real-time checkout form field validation.
 * Provides inline validation for address fields with sanitization,
 * pattern matching, and field-specific rules.
 */

import { sanitizeText } from './validators.js';

/**
 * Address field validation rules.
 * Mirrors backend/checkoutOptimization.web.js validation but runs client-side.
 */
const ADDRESS_RULES = {
  fullName: {
    required: true,
    minLength: 2,
    errorMessage: 'Full name is required (at least 2 characters).',
  },
  addressLine1: {
    required: true,
    minLength: 3,
    errorMessage: 'Street address is required.',
  },
  city: {
    required: true,
    minLength: 2,
    errorMessage: 'City is required.',
  },
  state: {
    required: true,
    pattern: /^[A-Za-z]{2}$/,
    errorMessage: 'Valid 2-letter state code is required.',
  },
  zip: {
    required: true,
    pattern: /^\d{5}(-\d{4})?$/,
    errorMessage: 'Valid ZIP code is required (e.g., 28792 or 28792-1234).',
  },
};

/**
 * Validate a single field value against rules.
 * @param {*} value - Raw field value
 * @param {Object} rules
 * @param {boolean} [rules.required] - Whether field must be non-empty
 * @param {number} [rules.minLength] - Minimum length after sanitization
 * @param {RegExp} [rules.pattern] - Regex the value must match
 * @param {string} [rules.errorMessage] - Custom error message
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateField(value, rules = {}) {
  const raw = value == null ? '' : String(value);
  const sanitized = sanitizeText(raw, 500).trim();

  if (rules.required && sanitized.length === 0) {
    return {
      valid: false,
      sanitized,
      error: rules.errorMessage || 'This field is required.',
    };
  }

  if (!rules.required && sanitized.length === 0) {
    return { valid: true, sanitized };
  }

  if (rules.minLength && sanitized.length < rules.minLength) {
    return {
      valid: false,
      sanitized,
      error: rules.errorMessage || `Must be at least ${rules.minLength} characters.`,
    };
  }

  if (rules.pattern && !rules.pattern.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: rules.errorMessage || 'Invalid format.',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate an address field by name.
 * @param {string} fieldName - One of: fullName, addressLine1, city, state, zip
 * @param {string} value - Raw field value
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateAddressField(fieldName, value) {
  const rules = ADDRESS_RULES[fieldName];
  if (!rules) {
    // Unknown field — pass through with sanitization
    const sanitized = sanitizeText(String(value || ''), 500).trim();
    return { valid: true, sanitized };
  }
  return validateField(value, rules);
}

/**
 * Determine the visual state of a field for UI rendering.
 * @param {string} value - Current field value
 * @param {boolean} touched - Whether user has interacted with the field
 * @param {{ valid: boolean }} [validationResult] - Result from validateField
 * @returns {'idle'|'valid'|'error'}
 */
/**
 * Browser autofill hint mapping for checkout address fields.
 * Uses shipping-scoped values per HTML autocomplete spec.
 */
export const AUTOCOMPLETE_HINTS = {
  '#addressFullName': 'shipping name',
  '#addressLine1': 'shipping address-line1',
  '#addressCity': 'shipping address-level2',
  '#addressState': 'shipping address-level1',
  '#addressZip': 'shipping postal-code',
};

/**
 * Apply browser autocomplete hints to checkout address input elements.
 * @param {Function} $w - Wix Velo $w selector function
 */
export function applyAutocompleteHints($w) {
  if (typeof $w !== 'function') return;
  Object.entries(AUTOCOMPLETE_HINTS).forEach(([id, hint]) => {
    try {
      const el = $w(id);
      if (el) el.autocomplete = hint;
    } catch (e) {}
  });
}

export function getFieldValidationState(value, touched, validationResult) {
  if (!touched) return 'idle';
  if (!validationResult) return 'idle';
  return validationResult.valid ? 'valid' : 'error';
}
