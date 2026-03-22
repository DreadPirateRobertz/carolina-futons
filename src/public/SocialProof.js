/**
 * @module SocialProof
 * @description PDP social proof widget — "X people viewing" + "Y sold in last 24h" badges.
 *
 * Calls getViewerCount() to fetch current signals, then renders:
 *   #viewerCountBadge  — "X people viewing this" (hidden when viewCount < 2)
 *   #soldRecentlyBadge — "Y sold in last 24h"    (hidden when lastSold24h < 1)
 *   #socialProofSection — hidden when both badges are hidden or on CMS error
 *
 * Increments the viewer count once per product per browser session via
 * sessionStorage rate limiting (key: cf_vcount_<productId>). Fail-open:
 * any CMS error hides the section rather than showing stale data.
 *
 * CF-ej3t: Social Proof Widget
 *
 * Editor nicknames (Product Page):
 *   viewerCountBadge   → #viewerCountBadge
 *   soldRecentlyBadge  → #soldRecentlyBadge
 *   socialProofSection → #socialProofSection
 *
 * @example
 *   // In Product Page code:
 *   import { initSocialProof } from 'public/SocialProof';
 *   $w.onReady(() => initSocialProof(product._id));
 */
import { getViewerCount, incrementViewerCount } from 'backend/socialProof.web';

// ── Constants ─────────────────────────────────────────────────────────

/** sessionStorage key prefix for per-product session rate limiting. */
const SESSION_KEY_PREFIX = 'cf_vcount_';

/** Minimum viewCount to show the "people viewing" badge. */
const MIN_VIEWERS_TO_SHOW = 2;

// ── Internal helpers ─────────────────────────────────────────────────

function get$w(opts) {
  return opts.$w || globalThis.$w;
}

function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return sessionStorage; } catch (_) { return null; }
}

function getIncrementFn(opts) {
  return opts.incrementViewerCount || incrementViewerCount;
}

function getCountFn(opts) {
  return opts.getViewerCount || getViewerCount;
}

/** Safely hide an element — no-op if absent or $w throws. */
function hideElement($wFn, selector) {
  try {
    const el = $wFn(selector);
    if (el) el.hide();
  } catch (_) { /* element not on this page */ }
}

/** Safely show an element with text — no-op if absent or $w throws. */
function showElement($wFn, selector, text) {
  try {
    const el = $wFn(selector);
    if (!el) return;
    el.text = text;
    el.show();
  } catch (_) { /* element not on this page */ }
}

// ── Render helpers ────────────────────────────────────────────────────

/**
 * Render the "X people viewing" badge.
 * Shows the badge when viewCount >= MIN_VIEWERS_TO_SHOW, hides otherwise.
 * Returns true if the badge is visible.
 *
 * @param {Function} $wFn
 * @param {number} viewCount
 * @returns {boolean} Whether the badge is visible
 */
export function renderViewerBadge($wFn, viewCount) {
  if (viewCount >= MIN_VIEWERS_TO_SHOW) {
    showElement($wFn, '#viewerCountBadge', `${viewCount} people viewing this`);
    return true;
  }
  hideElement($wFn, '#viewerCountBadge');
  return false;
}

/**
 * Render the "Y sold in last 24h" badge.
 * Shows the badge when lastSold24h >= 1, hides otherwise.
 * Returns true if the badge is visible.
 *
 * @param {Function} $wFn
 * @param {number} lastSold24h
 * @returns {boolean} Whether the badge is visible
 */
export function renderSoldBadge($wFn, lastSold24h) {
  if (lastSold24h >= 1) {
    const label = lastSold24h === 1 ? '1 sold in last 24h' : `${lastSold24h} sold in last 24h`;
    showElement($wFn, '#soldRecentlyBadge', label);
    return true;
  }
  hideElement($wFn, '#soldRecentlyBadge');
  return false;
}

/**
 * Hide the entire social proof section.
 * Called on CMS error (fail-open) or when both badges are hidden.
 *
 * @param {Function} $wFn
 */
export function hideSocialProofSection($wFn) {
  hideElement($wFn, '#socialProofSection');
}

/**
 * Show the social proof section.
 *
 * @param {Function} $wFn
 */
export function showSocialProofSection($wFn) {
  try {
    const section = $wFn('#socialProofSection');
    if (section) section.show();
  } catch (_) { /* element not on this page */ }
}

// ── Session rate limiting ─────────────────────────────────────────────

/**
 * Check whether this session has already incremented the count for productId.
 * @param {Object|null} storage
 * @param {string} productId
 * @returns {boolean}
 */
export function hasIncrementedThisSession(storage, productId) {
  if (!storage || !productId) return false;
  try {
    return storage.getItem(`${SESSION_KEY_PREFIX}${productId}`) === '1';
  } catch (_) { return false; }
}

/**
 * Mark this session as having incremented the count for productId.
 * @param {Object|null} storage
 * @param {string} productId
 */
export function markIncrementedThisSession(storage, productId) {
  if (!storage || !productId) return;
  try {
    storage.setItem(`${SESSION_KEY_PREFIX}${productId}`, '1');
  } catch (_) { /* non-fatal — quota exceeded */ }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Initialise the social proof widget on the Product Page.
 *
 * 1. If this session has not yet incremented for this product, calls
 *    incrementViewerCount (fire-and-forget — does not block render).
 * 2. Fetches current viewCount + lastSold24h via getViewerCount.
 * 3. Renders both badges; hides section if both are hidden.
 * 4. On any CMS error: hides the entire section (fail-open).
 *
 * @param {string} productId - The product ID from the PDP dataset
 * @param {Object} [opts]
 * @param {Function} [opts.$w]                   - Injectable $w for testing
 * @param {Function} [opts.getViewerCount]        - Injectable backend call
 * @param {Function} [opts.incrementViewerCount]  - Injectable backend call
 * @param {Object}   [opts.storage]               - Injectable sessionStorage
 * @returns {Promise<{ viewCount: number, lastSold24h: number }|null>}
 */
export async function initSocialProof(productId, opts = {}) {
  const $wFn      = get$w(opts);
  const storage   = getStorage(opts);
  const getCount  = getCountFn(opts);
  const increment = getIncrementFn(opts);

  if (!productId) {
    hideSocialProofSection($wFn);
    return null;
  }

  // Fire-and-forget increment — rate limited per session per product
  if (!hasIncrementedThisSession(storage, productId)) {
    markIncrementedThisSession(storage, productId);
    increment(productId).catch(() => { /* non-fatal */ });
  }

  // Fetch current counts
  let counts;
  try {
    counts = await getCount(productId);
  } catch (err) {
    console.error('[SocialProof] getViewerCount failed:', err?.message ?? err);
    hideSocialProofSection($wFn);
    return null;
  }

  const viewerVisible = renderViewerBadge($wFn, counts.viewCount);
  const soldVisible   = renderSoldBadge($wFn, counts.lastSold24h);

  if (viewerVisible || soldVisible) {
    showSocialProofSection($wFn);
  } else {
    hideSocialProofSection($wFn);
  }

  return counts;
}
