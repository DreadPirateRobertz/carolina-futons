/**
 * @module ProductHistory
 * @description Client-side recently viewed product tracking.
 * Stores up to MAX_HISTORY productIds in sessionStorage using LRU eviction
 * (most recent first, duplicates removed on re-visit).
 *
 * Designed for full vitest testability via injectable storage (pass
 * { storage } in options — no real sessionStorage required in tests).
 *
 * CF-f6ds: Recently Viewed Products
 *
 * Velo consumers:
 *   Category Page  — recentlyViewedSection repeater
 *   Home           — #recentlyViewedRepeater
 *   Cart           — #youMightAlsoLikeRepeater
 *
 * @example
 *   import { trackView, getRecentlyViewed } from 'public/ProductHistory';
 *   trackView(product._id);
 *   const ids = getRecentlyViewed(); // ['prod-abc', 'prod-xyz', ...]
 */

export const STORAGE_KEY = 'cf_product_history';
export const MAX_HISTORY = 20;

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Resolve storage from opts or fall back to globalThis.sessionStorage.
 * Returns null if sessionStorage is unavailable (SSR / private browsing).
 * @param {Object} opts
 * @returns {Object|null}
 */
function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return sessionStorage; } catch (_) { return null; }
}

/**
 * Read the current history array from storage.
 * Returns [] on any parse error or if the stored value is not an array.
 * @param {Object|null} storage
 * @returns {string[]}
 */
function readHistory(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

/**
 * Write the history array to storage.
 * Silently ignores storage errors (quota exceeded, private browsing).
 * @param {Object|null} storage
 * @param {string[]} history
 */
function writeHistory(storage, history) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (_) { /* storage unavailable or quota exceeded */ }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Record a product view.
 * Moves the productId to the front of the list (LRU). If it was already
 * in the list it is de-duplicated first. If the list exceeds MAX_HISTORY
 * the oldest entry is evicted.
 *
 * Silently ignores falsy productIds.
 *
 * @param {string} productId
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - sessionStorage-like object for testing
 */
export function trackView(productId, opts = {}) {
  if (!productId) return;

  const storage = getStorage(opts);
  let history = readHistory(storage);

  // Remove existing entry (de-duplicate before prepend)
  history = history.filter(id => id !== productId);

  // Prepend (most recent first)
  history.unshift(productId);

  // LRU eviction: trim to MAX_HISTORY
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  writeHistory(storage, history);
}

/**
 * Return the list of recently viewed productIds, most recent first.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - sessionStorage-like object for testing
 * @returns {string[]} Up to MAX_HISTORY productIds
 */
export function getRecentlyViewed(opts = {}) {
  return readHistory(getStorage(opts));
}

/**
 * Clear the recently viewed history.
 * Used for testing and explicit user-initiated resets.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - sessionStorage-like object for testing
 */
export function clearHistory(opts = {}) {
  const storage = getStorage(opts);
  if (!storage) return;
  try { storage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
}
