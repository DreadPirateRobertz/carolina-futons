/**
 * @module TradeInWidget
 * @description PDP trade-in CTA widget. Shows an estimated trade-in credit
 * range for the current product type and links to the /trade-in page.
 *
 * Usage: call initTradeInWidget($w, productType) from Product Page.js
 *
 * Editor elements (optional — widget hides gracefully if absent):
 *   #tradeInWidget         — container for the entire widget
 *   #tradeInCreditRange    — text: "Trade in your old futon — get up to $X credit"
 *   #tradeInCTA            — button / link: navigates to /trade-in
 *   #tradeInIneligible     — text: shown when item type has no trade-in value
 *
 * @param {Function} $w - Wix selector function
 * @param {string} productType - 'frame' | 'mattress' | '' (hides widget if unknown)
 */
import { getTradeInValuation } from 'backend/tradeInService.web';
import wixLocationFrontend from 'wix-location-frontend';

// ── Constants ─────────────────────────────────────────────────────

const TRADE_IN_PAGE_URL = '/trade-in';

// Known-type guard: if a productType is not listed here, the widget hides without
// making a backend call. Must stay in sync with VALUATION_MATRIX item types in
// tradeInService.web.js. initTradeInWidget fetches live values from the backend;
// getDisplayMax() returns these constants directly for static/synchronous callers.
const DISPLAY_MAX = {
  frame:    75,
  mattress: 40,
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Initialize the trade-in widget on a product page.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} productType - 'frame' | 'mattress' | other
 * @returns {Promise<void>}
 */
export async function initTradeInWidget($w, productType) {
  const type = (productType || '').toLowerCase().trim();

  if (!type || !DISPLAY_MAX[type]) {
    _hideWidget($w);
    return;
  }

  try {
    // Fetch best-case valuation (good condition) for the teaser
    const result = await getTradeInValuation(type, 'good');

    if (!result.success || !result.eligible) {
      _hideWidget($w);
      return;
    }

    const max = result.creditMax;

    try {
      $w('#tradeInCreditRange').text =
        `Have an old ${type}? Trade it in — get up to $${max} store credit toward a new purchase.`;
    } catch (_) { /* element may not exist */ }

    try { $w('#tradeInIneligible').hide(); } catch (_) { /* */ }

    try {
      $w('#tradeInCTA').onClick(() => {
        wixLocationFrontend.to(`${TRADE_IN_PAGE_URL}?type=${encodeURIComponent(type)}`);
      });
    } catch (_) { /* */ }

    try { $w('#tradeInWidget').show('fade', { duration: 250 }); } catch (_) { /* */ }

  } catch (err) {
    console.error('[TradeInWidget] Error initializing trade-in widget:', err);
    _hideWidget($w);
  }
}

/**
 * Get the display credit maximum for a product type (synchronous, for static display).
 * Returns 0 for unknown types.
 *
 * WARNING: returns a hardcoded frontend constant, not a live backend value.
 * Update DISPLAY_MAX if VALUATION_MATRIX credit amounts change in tradeInService.web.js.
 *
 * @param {string} productType - 'frame' | 'mattress'
 * @returns {number}
 */
export function getDisplayMax(productType) {
  const type = (productType || '').toLowerCase().trim();
  return DISPLAY_MAX[type] || 0;
}

/**
 * Build the trade-in page URL with a product type pre-fill.
 *
 * @param {string} productType - 'frame' | 'mattress'
 * @returns {string}
 */
export function buildTradeInUrl(productType) {
  const type = (productType || '').toLowerCase().trim();
  if (!type) return TRADE_IN_PAGE_URL;
  return `${TRADE_IN_PAGE_URL}?type=${encodeURIComponent(type)}`;
}

// ── Internal helpers ──────────────────────────────────────────────

function _hideWidget($w) {
  try { $w('#tradeInWidget').hide(); } catch (_) { /* element may not exist */ }
}
