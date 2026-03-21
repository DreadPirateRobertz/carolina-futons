/**
 * @module giftThisProduct
 * @description "Gift This Product" CTA for the Product Detail Page.
 * Selects the nearest gift card denomination to the product price
 * and navigates to /gift-cards pre-filled with that amount.
 *
 * Elements: #giftThisSection (Box container), #giftThisBtn (Button)
 * Backend: getGiftCardOptions from backend/giftCards.web
 *
 * Designed for full testability in vitest (injectable navigate, trackEvent,
 * getOptions). Product Page.js wires this into the #giftThisSection element.
 */

import { GIFT_CARD_DENOMINATIONS } from 'public/giftCardHelpers.js';
import { trackEvent } from 'public/engagementTracker.js';

export const GIFT_CARDS_PATH = '/gift-cards';
export const GIFT_THIS_BTN_TEXT = 'Gift This Product';

// ── Denomination selection ─────────────────────────────────────────────

/**
 * Select the best gift card denomination for a given product price.
 * Priority order:
 *  1. Exact match — product price equals a denomination exactly
 *  2. Round up — smallest denomination strictly above the price
 *  3. Fallback to max — price exceeds all denominations
 *
 * Returns null for invalid prices (non-positive, non-finite, non-number).
 *
 * @param {number} price - Product price in dollars
 * @param {Array<{amount: number, label: string}>} [denominations] - Override list (for testing)
 * @returns {{ amount: number, label: string }|null}
 */
export function selectGiftThisDenomination(price, denominations = GIFT_CARD_DENOMINATIONS) {
  if (typeof price !== 'number' || !isFinite(price) || price <= 0) return null;
  const sorted = [...denominations].sort((a, b) => a.amount - b.amount);
  // Exact match
  const exact = sorted.find(d => d.amount === price);
  if (exact) return exact;
  // Round up
  const roundUp = sorted.find(d => d.amount > price);
  if (roundUp) return roundUp;
  // Fallback to max
  return sorted[sorted.length - 1] || null;
}

// ── URL builder ────────────────────────────────────────────────────────

/**
 * Build the /gift-cards URL pre-filled with the given denomination amount.
 *
 * @param {number} amount - Gift card denomination in dollars
 * @returns {string} Full path with query param
 */
export function buildGiftThisUrl(amount) {
  return `${GIFT_CARDS_PATH}?amount=${amount}`;
}

// ── Section init ───────────────────────────────────────────────────────

/**
 * Initialize the "Gift This Product" section on the Product Detail Page.
 * Shows #giftThisSection and wires #giftThisBtn to navigate to the gift
 * cards page with the matched denomination pre-selected.
 *
 * Gracefully no-ops if elements are absent (e.g., draft layouts).
 *
 * @param {Function} $wFn - Wix selector function ($w)
 * @param {Object} product - Current product data
 * @param {string} [product.productId] - Wix Stores product ID
 * @param {string} [product.name] - Product display name
 * @param {number} [product.price] - Product price in dollars
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Function} [opts.navigate] - Navigation function (replaces wix-location)
 * @param {Function} [opts.trackEvent] - Event tracking function
 * @param {Function} [opts.getOptions] - Returns denomination list (replaces backend call)
 * @returns {Promise<void>}
 */
export async function initGiftThisSection($wFn, product, opts = {}) {
  try {
    const price = product?.price;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
      try { $wFn('#giftThisSection').collapse(); } catch (_) {}
      return;
    }

    // Fetch denominations from backend (or use injected override for tests)
    let denominations = GIFT_CARD_DENOMINATIONS;
    if (opts.getOptions) {
      try {
        const options = await opts.getOptions();
        if (Array.isArray(options) && options.length > 0) {
          denominations = options;
        }
      } catch (_) {}
    } else {
      try {
        const { getGiftCardOptions } = await import('backend/giftCards.web');
        const options = await getGiftCardOptions();
        if (Array.isArray(options) && options.length > 0) {
          denominations = options;
        }
      } catch (_) {}
    }

    const denomination = selectGiftThisDenomination(price, denominations);
    if (!denomination) {
      try { $wFn('#giftThisSection').collapse(); } catch (_) {}
      return;
    }

    // Wire button
    const btn = $wFn('#giftThisBtn');
    btn.text = GIFT_THIS_BTN_TEXT;
    try {
      btn.accessibility.ariaLabel =
        `Give ${product?.name || 'this product'} as a gift — $${denomination.amount} gift card`;
    } catch (_) {}

    btn.onClick(() => {
      const track = opts.trackEvent || trackEvent;
      try {
        track('gift_this_click', {
          productId: product?.productId || '',
          productName: product?.name || '',
          price,
          denomination: denomination.amount,
        });
      } catch (_) {}

      const url = buildGiftThisUrl(denomination.amount);
      if (opts.navigate) {
        opts.navigate(url);
      } else {
        import('wix-location-frontend').then(loc => {
          const navFn = loc.default?.to ?? loc.to;
          navFn(url);
        }).catch(() => {});
      }
    });

    try { $wFn('#giftThisSection').expand(); } catch (_) {}
  } catch (_) {
    // Elements may be absent in some page layouts — graceful no-op
    try { $wFn('#giftThisSection').collapse(); } catch (_) {}
  }
}
