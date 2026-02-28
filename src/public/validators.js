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
