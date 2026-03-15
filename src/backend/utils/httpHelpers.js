/**
 * @module httpHelpers
 * Pure utility functions for HTTP function security and data sanitization.
 * Extracted from http-functions.js for testability.
 */

/**
 * Constant-time string comparison to prevent timing attacks on secret keys.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Decode HTML entities to prevent entity-encoded XSS in feed outputs.
 * Handles numeric (&#60;), hex (&#x3c;), and named (&lt;) entities.
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
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
 * Strip HTML tags AND decode entities, then remove any remaining tags
 * that were hidden inside entities. Safe for feed text fields.
 * @param {string} html
 * @returns {string}
 */
export function stripHtmlSafe(html) {
  if (!html) return '';
  // First pass: strip visible tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode entities that may contain hidden markup
  text = decodeHtmlEntities(text);
  // Second pass: strip any tags that were entity-encoded
  text = text.replace(/<[^>]*>/g, '');
  return text;
}

/**
 * Escape special XML characters for safe inclusion in XML documents.
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
