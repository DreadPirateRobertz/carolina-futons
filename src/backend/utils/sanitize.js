/**
 * Shared input sanitization utilities for backend web modules.
 * Provides defense-in-depth against XSS/injection via CMS writes
 * and basic format validation for common field types.
 */

/**
 * Strip HTML tags and limit string length.
 * @param {string} str - Raw input string.
 * @param {number} [maxLen=1000] - Maximum allowed length.
 * @returns {string} Sanitized string.
 */
export function sanitize(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

/**
 * Validate email format.
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if valid format.
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplified — covers practical email formats
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim());
}

/**
 * Validate and sanitize a Wix-style record ID.
 * Allows alphanumeric characters, hyphens, and underscores.
 * @param {string} id - The ID to validate.
 * @param {number} [maxLen=50] - Maximum length.
 * @returns {string} Sanitized ID, or empty string if invalid.
 */
export function validateId(id) {
  if (typeof id !== 'string') return '';
  const cleaned = id.trim().slice(0, 50);
  return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
}

/**
 * Validate and sanitize a URL slug.
 * Allows lowercase alphanumeric characters and hyphens.
 * @param {string} slug - The slug to validate.
 * @param {number} [maxLen=100] - Maximum length.
 * @returns {string} Sanitized slug, or empty string if invalid.
 */
export function validateSlug(slug) {
  if (typeof slug !== 'string') return '';
  const cleaned = slug.trim().toLowerCase().slice(0, 100);
  return /^[a-z0-9-]+$/.test(cleaned) ? cleaned : '';
}
