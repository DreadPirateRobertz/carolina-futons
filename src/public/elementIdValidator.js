/**
 * Element ID Validator — Static analysis for Wix Velo $w element IDs.
 * Extracts and validates all $w('#id') references from page source code.
 *
 * Note: This module contains only pure functions (no fs/path imports)
 * so it remains Wix Velo compatible. File I/O lives in test code.
 * @module elementIdValidator
 */

/** Valid Wix element ID: starts with letter, alphanumeric only (no underscores) */
const VALID_ID_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Extract unique $w element IDs from source code.
 * Captures broadly (letters, digits, underscores) so that IDs with underscores
 * are extracted and then caught by validateElementId as invalid.
 * @param {string} source - JavaScript source code
 * @returns {string[]} Array of unique element IDs (without # prefix)
 */
export function extractElementIds(source) {
  if (typeof source !== 'string') return [];

  const ids = new Set();

  const patterns = [
    /\$w\(['"]#([a-zA-Z0-9_]+)['"]\)/g,       // $w('#id') and $w("#id")
    /elementId:\s*['"]#([a-zA-Z0-9_]+)['"]/g,  // elementId: '#id' in config objects
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(source)) !== null) {
      ids.add(match[1]);
    }
  }

  return [...ids];
}

/**
 * Validate a single element ID against Wix Velo naming conventions.
 * @param {string} id - Element ID (without # prefix)
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateElementId(id) {
  if (!id || typeof id !== 'string' || id.length === 0) {
    return { valid: false, reason: 'ID is empty' };
  }
  if (id.startsWith('#')) {
    return { valid: false, reason: 'ID should not include # prefix' };
  }
  if (!/^[a-zA-Z]/.test(id)) {
    return { valid: false, reason: 'ID must start with a letter' };
  }
  if (!VALID_ID_RE.test(id)) {
    return { valid: false, reason: 'ID must be alphanumeric (letters and numbers only)' };
  }
  return { valid: true };
}

/**
 * Validate all $w element IDs in a page source file.
 * @param {string} source - JavaScript source code
 * @param {string} pageName - Page file name for reporting
 * @returns {{ pageName: string, totalIds: number, invalidIds: Array<{ id: string, reason: string }>, valid: boolean }}
 */
export function validatePageIds(source, pageName) {
  const ids = extractElementIds(source);
  const invalidIds = [];

  for (const id of ids) {
    const result = validateElementId(id);
    if (!result.valid) {
      invalidIds.push({ id, reason: result.reason });
    }
  }

  return {
    pageName,
    totalIds: ids.length,
    invalidIds,
    valid: invalidIds.length === 0,
  };
}
