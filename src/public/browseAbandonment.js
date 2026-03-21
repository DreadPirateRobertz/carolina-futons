/**
 * @module browseAbandonment
 * @description Client-side browse abandonment product view tracking.
 * Stores the last-viewed product to sessionStorage after a 30s dwell time
 * guard, so short/accidental page visits aren't tracked. Cleared on
 * add-to-cart to prevent false abandonment recovery emails.
 *
 * The masterPage.js wires this into product page events and cart events.
 * This module is designed for full testability in vitest (injectable storage,
 * vi.useFakeTimers() for timer control).
 */

export const BROWSE_STORAGE_KEY = 'cf_browse_abandonment';

/** Minimum dwell time (ms) before a product view is considered intentional. */
export const MIN_DWELL_MS = 30 * 1000;

// Module-level pending timer ID — only one product view can be pending at a time.
let _pendingTimer = null;

/**
 * Resolve storage from opts or fall back to globalThis.sessionStorage.
 * @param {Object} opts
 * @returns {Object|null}
 */
function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return sessionStorage; } catch (_) { return null; }
}

/**
 * Track a product view with a 30s dwell time guard.
 * Only commits to sessionStorage after the visitor has stayed on the
 * product page for at least MIN_DWELL_MS. A subsequent call cancels any
 * pending write from the previous call (most recent product wins).
 *
 * @param {string} productId
 * @param {string} productName
 * @param {string} productImage
 * @param {number} price
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Object} [opts.storage] - sessionStorage-like object (pass null to disable)
 * @returns {Function} Cancel function — call before 30s to prevent storage
 */
export function trackProductView(productId, productName, productImage, price, opts = {}) {
  if (!productId) return () => {};

  const storage = getStorage(opts);

  // Cancel any pending write from the previous product view
  if (_pendingTimer !== null) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }

  const timer = setTimeout(() => {
    _pendingTimer = null;
    if (!storage) return;
    try {
      storage.setItem(BROWSE_STORAGE_KEY, JSON.stringify({
        productId,
        productName: productName || '',
        productImage: productImage || '',
        price: typeof price === 'number' ? price : 0,
        viewedAt: Date.now(),
      }));
    } catch (_) { /* storage unavailable — best effort */ }
  }, MIN_DWELL_MS);

  _pendingTimer = timer;

  return () => {
    if (_pendingTimer === timer) {
      clearTimeout(timer);
      _pendingTimer = null;
    }
  };
}

/**
 * Get the last-viewed product stored for browse abandonment recovery.
 * Returns null if nothing is stored, cleared, or storage is unavailable.
 *
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Object} [opts.storage] - sessionStorage-like object
 * @returns {{ productId, productName, productImage, price, viewedAt }|null}
 */
export function getBrowseAbandonmentData(opts = {}) {
  const storage = getStorage(opts);
  if (!storage) return null;
  try {
    const raw = storage.getItem(BROWSE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Clear browse abandonment tracking data.
 * Call this when the visitor adds a product to cart — if they've added
 * something, there's no abandonment to recover.
 * Also cancels any pending 30s timer that hasn't fired yet.
 *
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Object} [opts.storage] - sessionStorage-like object
 */
export function clearBrowseAbandonment(opts = {}) {
  if (_pendingTimer !== null) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }
  const storage = getStorage(opts);
  if (!storage) return;
  try {
    storage.removeItem(BROWSE_STORAGE_KEY);
  } catch (_) { /* storage unavailable — best effort */ }
}
