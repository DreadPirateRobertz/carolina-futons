/**
 * @module giftProductBtn
 * @description "Give as a Gift" CTA logic for the Product Page.
 * Finds the best-matching gift card denomination for the product price,
 * then adds a gift card to the Wix Stores cart. Falls back to navigating
 * to the /gift-cards page if the cart API call fails.
 *
 * Designed for full testability in vitest (injectable cart, navigate).
 * The masterPage/Product Page wires this into #giftProductBtn.
 */

import { GIFT_CARD_DENOMINATIONS } from 'public/giftCardHelpers.js';

export const GIFT_PRODUCT_BTN_TEXT = 'Give as a Gift';

/**
 * Wix Stores gift card product ID.
 * Set in Wix Stores as a gift card product type — this value must match
 * the product ID configured in the Wix dashboard.
 */
export const GIFT_CARD_PRODUCT_ID = 'gift-card';

/**
 * Find the lowest gift card denomination that is >= the product price.
 * If the price exceeds all denominations, returns the highest available.
 * Returns null for invalid (non-positive, non-number) prices.
 *
 * @param {number} price - Product price in dollars
 * @returns {{ amount: number, label: string }|null}
 */
export function selectGiftDenomination(price) {
  if (typeof price !== 'number' || isNaN(price) || price <= 0) return null;
  const sorted = [...GIFT_CARD_DENOMINATIONS].sort((a, b) => a.amount - b.amount);
  return sorted.find(d => d.amount >= price) || sorted[sorted.length - 1];
}

/**
 * Handle "Give as a Gift" button click.
 * Selects the appropriate gift card denomination for the product price
 * and adds it to the cart via the injected addToCart function.
 * On cart failure, calls the optional navigate fallback.
 *
 * @param {Object} product
 * @param {string} product.productId - Wix Stores product ID
 * @param {string} product.productName - Display name for gift label
 * @param {number} product.price - Product price (used to select denomination)
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Function} [opts.addToCart] - cart.addProducts(items) function
 * @param {Function} [opts.navigate] - Navigation function (fallback on error)
 * @returns {Promise<{ success: boolean, denomination?: number, error?: string }>}
 */
export async function handleGiftProductClick(product, opts = {}) {
  const denomination = selectGiftDenomination(product?.price);
  if (!denomination) {
    return { success: false, error: 'no_denomination' };
  }

  const { addToCart, navigate } = opts;

  try {
    if (addToCart) {
      await addToCart([{
        productId: GIFT_CARD_PRODUCT_ID,
        quantity: 1,
        options: {
          giftFor: product.productName || '',
          amount: denomination.amount,
          sourceProductId: product.productId || '',
        },
      }]);
    }
    return { success: true, denomination: denomination.amount };
  } catch (_err) {
    // Cart API unavailable — fall back to /gift-cards page
    if (navigate) {
      navigate(`/gift-cards?amount=${denomination.amount}`);
    }
    return { success: false, error: 'cart_failed' };
  }
}

/**
 * Initialize the Give as a Gift button on the Product Page.
 * Wires #giftProductBtn click to handleGiftProductClick.
 * Safe to call when #giftProductBtn is absent (graceful no-op).
 *
 * @param {Function} $wFn - Wix selector function
 * @param {Object} product - { productId, productName, price }
 * @param {Object} [opts] - Injectable overrides (addToCart, navigate)
 */
export function initGiftProductButton($wFn, product, opts = {}) {
  try {
    const btn = $wFn('#giftProductBtn');
    btn.text = GIFT_PRODUCT_BTN_TEXT;
    try {
      btn.accessibility.ariaLabel = 'Give this as a gift — shop Carolina Futons gift cards';
    } catch (_) {}

    btn.onClick(async () => {
      try { btn.disable?.(); } catch (_) {}
      try {
        const result = await handleGiftProductClick(product, opts);
        if (!result.success && result.error !== 'no_denomination' && opts.navigate) {
          const den = selectGiftDenomination(product?.price);
          opts.navigate(`/gift-cards${den ? `?amount=${den.amount}` : ''}`);
        }
      } finally {
        try { btn.enable?.(); } catch (_) {}
      }
    });
  } catch (_) {
    // #giftProductBtn may not exist on all product page layouts
  }
}
