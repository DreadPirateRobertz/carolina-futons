/**
 * Shared input sanitization utilities for backend web modules.
 * Provides defense-in-depth against XSS/injection via CMS writes
 * and basic format validation for common field types.
 */

/**
 * Decode HTML entities (named, numeric decimal, numeric hex).
 * @param {string} str - String with potential HTML entities.
 * @returns {string} Decoded string.
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

/**
 * Strip HTML tags and limit string length.
 * Decodes HTML entities first to prevent entity-encoded XSS bypass,
 * then strips tags from the decoded result. Repeats decode+strip to
 * catch double-encoded payloads.
 * @param {string} str - Raw input string.
 * @param {number} [maxLen=1000] - Maximum allowed length.
 * @returns {string} Sanitized string.
 */
export function sanitize(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  const stripTags = s => s.replace(/<[^>]*>/g, '');
  // Pass 1: strip literal tags, decode entities, strip any tags that emerged
  let result = stripTags(decodeHtmlEntities(stripTags(str)));
  // Pass 2: catch double-encoded entities (&amp;lt; → &lt; → <)
  result = stripTags(decodeHtmlEntities(result));
  return result.trim().slice(0, maxLen);
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
/**
 * Validate a US phone number (10-11 digits with optional formatting).
 * @param {*} phone - Phone number to validate.
 * @returns {boolean} True if valid US phone format.
 */
export function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/[\s()\-+.]/g, '');
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('1')) return true;
  return false;
}

/**
 * Format a US phone number to E.164 format (+1XXXXXXXXXX).
 * @param {*} phone - Phone number to format.
 * @returns {string} E.164 formatted phone or empty string if invalid.
 */
export function formatPhoneE164(phone) {
  if (!validatePhone(phone)) return '';
  const digits = phone.replace(/[\s()\-+.]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+1${digits}`;
}

export function validateSlug(slug) {
  if (typeof slug !== 'string') return '';
  const cleaned = slug.trim().toLowerCase().slice(0, 100);
  return /^[a-z0-9-]+$/.test(cleaned) ? cleaned : '';
}
