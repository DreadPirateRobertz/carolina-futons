/**
 * @module giftCardUpsell
 * @description Post-purchase gift card upsell on the Thank You page.
 * Suggests the next gift card denomination above the order total.
 * If the order already meets or exceeds the highest denomination ($500),
 * or the upsell was already shown this session, the section is collapsed.
 *
 * Designed for full testability in vitest (injectable storage, navigate).
 * Thank You Page.js wires this into the #giftCardUpsellSection element.
 */

import { GIFT_CARD_DENOMINATIONS } from 'public/giftCardHelpers.js';

export const GIFT_CARDS_PATH = '/gift-cards';
export const UPSELL_SESSION_KEY = 'cf_gc_upsell_shown';

/**
 * Find the smallest gift card denomination strictly greater than the order total.
 * Returns null if the order total is >= the highest denomination
 * (no upsell makes sense — the customer is already a big spender).
 *
 * @param {number} orderTotal - Order total in dollars
 * @returns {{ amount: number, label: string }|null}
 */
export function selectUpsellDenomination(orderTotal) {
  if (typeof orderTotal !== 'number' || isNaN(orderTotal) || orderTotal < 0) return null;
  const sorted = [...GIFT_CARD_DENOMINATIONS].sort((a, b) => a.amount - b.amount);
  return sorted.find(d => d.amount > orderTotal) ?? null;
}

/**
 * Whether the gift card upsell should be shown for this order.
 * Returns false if already shown this session, or if no denomination
 * is available above the order total.
 *
 * @param {number} orderTotal
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - sessionStorage-like object
 * @returns {boolean}
 */
export function shouldShowGiftCardUpsell(orderTotal, opts = {}) {
  try {
    const storage = 'storage' in opts
      ? opts.storage
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (storage?.getItem(UPSELL_SESSION_KEY)) return false;
  } catch (_) {}
  return selectUpsellDenomination(orderTotal) !== null;
}

/**
 * Mark the gift card upsell as shown for this session.
 * @param {Object} [opts]
 * @param {Object} [opts.storage] - sessionStorage-like object
 */
function markUpsellShown(opts = {}) {
  try {
    const storage = 'storage' in opts
      ? opts.storage
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    storage?.setItem(UPSELL_SESSION_KEY, '1');
  } catch (_) {}
}

/**
 * Resolve the session storage object from opts or global.
 * @param {Object} opts
 * @returns {Object|null}
 */
function _resolveStorage(opts) {
  return 'storage' in opts
    ? opts.storage
    : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
}

/**
 * Initialize the gift card upsell section on the Thank You page.
 * Calls selectUpsellDenomination once and threads the result through
 * to avoid recomputation. Collapses the section if no denomination is
 * available or the upsell was already shown this session.
 *
 * @param {Function} $wFn - Wix selector function
 * @param {number} orderTotal - Confirmed order total in dollars
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Object} [opts.storage] - sessionStorage-like object
 * @param {Function} [opts.navigate] - Navigation function
 * @returns {Promise<void>}
 */
export async function initGiftCardUpsell($wFn, orderTotal, opts = {}) {
  // Compute denomination once — threads through instead of calling selectUpsellDenomination twice
  const denomination = selectUpsellDenomination(orderTotal);

  let alreadyShown = false;
  try {
    const storage = _resolveStorage(opts);
    alreadyShown = Boolean(storage?.getItem(UPSELL_SESSION_KEY));
  } catch (e) {
    console.warn('[giftCardUpsell] Could not read session storage:', e);
  }

  if (!denomination || alreadyShown) {
    try { $wFn('#giftCardUpsellSection').collapse(); } catch (e) {
      console.warn('[giftCardUpsell] Could not collapse upsell section:', e);
    }
    return;
  }

  markUpsellShown(opts);

  try {
    try {
      $wFn('#giftCardUpsellHeading').text =
        `Complete the gift — a $${denomination.amount} Carolina Futons card`;
    } catch (_) {}
    try {
      $wFn('#giftCardUpsellDesc').text =
        `Pair their new furniture with a gift card for accessories, care products, or their next piece.`;
    } catch (_) {}

    const btn = $wFn('#giftCardUpsellBtn');
    btn.text = `Shop $${denomination.amount} Gift Cards`;
    try {
      btn.accessibility.ariaLabel = `Buy a $${denomination.amount} Carolina Futons gift card`;
    } catch (_) {}

    btn.onClick(() => {
      const url = `${GIFT_CARDS_PATH}?amount=${denomination.amount}`;
      if (opts.navigate) {
        opts.navigate(url);
      } else {
        import('wix-location-frontend').then(loc => {
          const navFn = loc.default?.to ?? loc.to;
          if (typeof navFn === 'function') {
            navFn(url);
          } else {
            console.warn('[giftCardUpsell] wix-location-frontend.to not found');
          }
        }).catch(err => {
          console.warn('[giftCardUpsell] wix-location-frontend unavailable:', err);
        });
      }
    });
  } catch (e) {
    console.warn('[giftCardUpsell] Could not initialize upsell elements:', e);
  }
}
