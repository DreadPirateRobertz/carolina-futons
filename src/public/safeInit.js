// safeInit.js — Safe element initialization utilities for Wix Velo pages
// Replaces 450+ silent try/catch blocks wrapping optional $w() element access.
// Elements may not exist on every page, so these helpers gracefully handle missing elements.
// NOTE: $w must be passed from the page context — it is NOT available as a global in public modules.

/**
 * Safely select a Wix $w element. Returns null if the element doesn't exist.
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector - Wix element selector (e.g., '#myButton')
 * @returns {object|null} The element or null
 */
export function safeSelect($w, selector) {
  try {
    const el = $w(selector);
    // $w returns an object even for non-existent elements in some contexts.
    // Check for a common property to verify it's real.
    if (el && typeof el.id !== 'undefined') return el;
    return el || null;
  } catch {
    return null;
  }
}

/**
 * Safely execute a function that may reference non-existent elements.
 * Swallows errors from missing elements but re-throws real errors.
 * @param {Function} fn - The function to execute
 */
export function safeCall(fn) {
  try {
    fn();
  } catch {
    // Element may not exist on this page — expected behavior
  }
}

/**
 * Safely set a text property on an element.
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector - Wix element selector
 * @param {string} text - Text to set
 */
export function safeText($w, selector, text) {
  try {
    $w(selector).text = text;
  } catch {
    // Element not on this page
  }
}

/**
 * Safely bind a click handler to an element.
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector - Wix element selector
 * @param {Function} handler - Click handler
 */
export function safeClick($w, selector, handler) {
  try {
    $w(selector).onClick(handler);
  } catch {
    // Element not on this page
  }
}

/**
 * Safely set an element's src property (images, iframes).
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector - Wix element selector
 * @param {string} src - Source URL
 */
export function safeSrc($w, selector, src) {
  try {
    $w(selector).src = src;
  } catch {
    // Element not on this page
  }
}

/**
 * Safely expand an element (show).
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector
 */
export function safeExpand($w, selector) {
  try {
    $w(selector).expand();
  } catch {}
}

/**
 * Safely collapse an element (hide).
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector
 */
export function safeCollapse($w, selector) {
  try {
    $w(selector).collapse();
  } catch {}
}

/**
 * Safely set ARIA label on an element.
 * @param {Function} $w - Page-scoped $w selector from Wix Velo
 * @param {string} selector
 * @param {string} label
 */
export function safeAriaLabel($w, selector, label) {
  try {
    $w(selector).accessibility.ariaLabel = label;
  } catch {}
}
