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
export function validateId(id, maxLen = 50) {
  if (typeof id !== 'string') return '';
  const cleaned = id.trim().slice(0, maxLen);
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

/**
 * Validate that a URL is a Wix Media Manager URL.
 * Wix media URLs follow patterns like:
 *   wix:image://v1/...
 *   https://static.wixstatic.com/media/...
 * Rejects arbitrary external URLs that could serve malicious content or leak EXIF data.
 * CF-rr8d: ClickFix hardening — prevent attacker-supplied external image URLs.
 *
 * @param {string} url - URL to validate.
 * @returns {boolean} True if the URL is a recognized Wix media URL.
 */
export function isWixMediaUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  // Wix internal media protocol
  if (trimmed.startsWith('wix:image://')) return true;
  if (trimmed.startsWith('wix:video://')) return true;
  // Wix CDN static media
  if (/^https:\/\/static\.wixstatic\.com\/media\//i.test(trimmed)) return true;
  // Wix user uploads CDN — [^/]* prevents path-injection bypass (e.g. attacker.com/.wixmp.com/)
  if (/^https:\/\/[^/]*\.wixmp\.com\//i.test(trimmed)) return true;
  return false;
}

/**
 * Generate a UUID v4-format filename with the original file extension.
 * CF-rr8d: ClickFix hardening — replace user-supplied filenames with UUIDs
 * to prevent filename-based injection and information leakage.
 *
 * @param {string} [extension='jpg'] - File extension (without dot).
 * @returns {string} UUID filename like "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
 */
export function generateUUIDFilename(extension = 'jpg') {
  const ext = (typeof extension === 'string' ? extension : 'jpg')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 10) || 'jpg';
  // Simple UUID v4 generation (crypto not available in Wix Velo backend)
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const seg = (n) => Array.from({ length: n }, hex).join('');
  const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
  const uuid = `${seg(8)}-${seg(4)}-4${seg(3)}-${variant}${seg(3)}-${seg(12)}`;
  return `${uuid}.${ext}`;
}

export function validateSlug(slug) {
  if (typeof slug !== 'string') return '';
  const cleaned = slug.trim().toLowerCase().slice(0, 100);
  return /^[a-z0-9-]+$/.test(cleaned) ? cleaned : '';
}
