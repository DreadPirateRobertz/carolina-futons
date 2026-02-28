// validators.js - Frontend Input Validation Utilities
// Mirrors backend/utils/sanitize patterns for client-side use.

/**
 * Validate email format (RFC 5322 simplified).
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if valid format.
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@<>]+@[^\s@<>.][^\s@<>]*\.[^\s@<>]+$/.test(email.trim());
}

/**
 * Validate a numeric dimension input is within a realistic range.
 * @param {number} value - Parsed numeric value.
 * @param {number} [min=1] - Minimum valid value (inclusive).
 * @param {number} [max=600] - Maximum valid value in inches (inclusive).
 * @returns {boolean} True if within valid range.
 */
export function validateDimension(value, min = 1, max = 600) {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

/**
 * Strip HTML tags and enforce max length for free-text form input.
 * Mirrors backend/utils/sanitize.sanitize() for client-side use.
 * @param {string} str - Raw input string.
 * @param {number} [maxLen=1000] - Maximum allowed length.
 * @returns {string} Sanitized string.
 */
export function sanitizeText(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  // Strip complete HTML tags, then unclosed tags (e.g. <img src=x onerror=...)
  return str.replace(/<[^>]*>/g, '').replace(/<[^>]*$/g, '').trim().slice(0, maxLen);
}
