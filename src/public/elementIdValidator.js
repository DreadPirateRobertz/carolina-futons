/**
 * Element ID Validator — Static analysis for Wix Velo $w element IDs.
 * Extracts and validates all $w('#id') references from page source code.
 * @module elementIdValidator
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

/** Valid Wix element ID: starts with letter, alphanumeric only */
const VALID_ID_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Extract unique $w element IDs from source code.
 * @param {string} source - JavaScript source code
 * @returns {string[]} Array of unique element IDs (without # prefix)
 */
export function extractElementIds(source) {
  const ids = new Set();

  // Match $w('#id') and $w("#id") patterns
  const dwRe = /\$w\(['"]#([a-zA-Z0-9_]*)['"]\)/g;
  let match;
  while ((match = dwRe.exec(source)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  // Match elementId: '#id' property patterns (e.g., in config objects)
  const propRe = /elementId:\s*['"]#([a-zA-Z0-9_]*)['"]/g;
  while ((match = propRe.exec(source)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  return [...ids];
}

/**
 * Validate a single element ID against Wix Velo naming conventions.
 * @param {string} id - Element ID (without # prefix)
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateElementId(id) {
  if (!id || id.length === 0) {
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

/**
 * Get all page file paths from src/pages/.
 * @returns {string[]} Array of absolute file paths
 */
export function getPageFiles() {
  const pagesDir = join(process.cwd(), 'src', 'pages');
  const files = readdirSync(pagesDir)
    .filter(f => f.endsWith('.js'))
    .map(f => join(pagesDir, f));
  return files;
}
