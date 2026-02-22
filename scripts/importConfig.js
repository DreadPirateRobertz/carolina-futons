/**
 * Shared configuration and utilities for CMS import scripts.
 * Used by all per-collection importers.
 */

// Batch size for wix-data bulkInsert (Wix limit is 1000 per call)
export const BATCH_SIZE = 50;

/**
 * Process items in batches to avoid Wix rate limits and payload caps.
 * @param {Array} items - Items to process.
 * @param {Function} processFn - async (batch) => results
 * @returns {Promise<{inserted: number, skipped: number, errors: Array}>}
 */
export async function processBatches(items, processFn) {
  const results = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      const batchResult = await processFn(batch);
      results.inserted += batchResult.inserted || 0;
      results.skipped += batchResult.skipped || 0;
      if (batchResult.errors) {
        results.errors.push(...batchResult.errors);
      }
    } catch (err) {
      results.errors.push({
        batch: Math.floor(i / BATCH_SIZE),
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Validate a required string field.
 * @param {*} value
 * @param {string} fieldName
 * @returns {string|null} Error message or null if valid.
 */
export function requireString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    return `Missing required field: ${fieldName}`;
  }
  return null;
}

/**
 * Validate a URL field (optional but must be valid if present).
 * @param {*} value
 * @param {string} fieldName
 * @returns {string|null} Error message or null if valid.
 */
export function validateUrl(value, fieldName) {
  if (!value) return null;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  try {
    new URL(value);
    return null;
  } catch {
    return `${fieldName} is not a valid URL: ${value}`;
  }
}

/**
 * Strip HTML tags and limit string length.
 * Same logic as backend/utils/sanitize but available to import scripts.
 */
export function sanitize(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

/**
 * Sanitize but preserve HTML (for Rich Text fields like steps/tips).
 */
export function sanitizeRichText(str, maxLen = 10000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

/**
 * Normalize a hex color to #RRGGBB format.
 */
export function normalizeHex(hex) {
  if (typeof hex !== 'string') return '#000000';
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return '#000000';
}
