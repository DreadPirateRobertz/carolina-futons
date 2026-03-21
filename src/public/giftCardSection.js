/**
 * @module giftCardSection
 * @description Gift Cards homepage section logic.
 * Shows a hero CTA linking to the Wix Stores native /gift-cards page.
 * Collapses the section if Wix Stores gift cards are disabled.
 *
 * Designed for full testability in vitest (injectable checkEnabled, navigate).
 * Home.js wires this into the #giftCardSection element.
 */

export const GIFT_CARD_HEADING = 'Give the gift of great furniture';
export const GIFT_CARD_DESC =
  'Carolina Futons gift cards — the perfect present for anyone who loves quality handcrafted furniture.';
export const GIFT_CARD_BTN_TEXT = 'Shop Gift Cards';
export const GIFT_CARDS_PATH = '/gift-cards';

/**
 * Check whether Wix Stores gift cards are enabled for this store.
 * Injectable via opts.checkEnabled for testability.
 * Fails open (returns true) if the API is unavailable.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.checkEnabled] - async/sync fn returning boolean
 * @returns {Promise<boolean>}
 */
export async function isGiftCardsEnabled(opts = {}) {
  if (typeof opts.checkEnabled === 'function') {
    try {
      return Boolean(await opts.checkEnabled());
    } catch (_) {
      return true; // fail open
    }
  }

  // Default: try Wix Stores API; assume enabled if unavailable
  try {
    const mod = await import('wix-stores-frontend');
    const store = mod.default || mod;
    if (typeof store.gifts?.isEnabled === 'function') {
      return Boolean(await store.gifts.isEnabled());
    }
    return true;
  } catch (_) {
    return true; // fail open — show section if API unavailable
  }
}

/**
 * Initialize the Gift Cards homepage section.
 * Sets heading, description, and wires the "Shop Gift Cards" CTA.
 * Collapses #giftCardSection if gift cards are disabled.
 *
 * @param {Function} $wFn - Wix selector function
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Function} [opts.checkEnabled] - Returns true if gift cards are on
 * @param {Function} [opts.navigate] - Navigation function (url string => void)
 * @returns {Promise<void>}
 */
export async function initGiftCardSection($wFn, opts = {}) {
  const enabled = await isGiftCardsEnabled(opts);

  if (!enabled) {
    try { $wFn('#giftCardSection').collapse(); } catch (_) {}
    return;
  }

  try {
    try { $wFn('#giftCardHeading').text = GIFT_CARD_HEADING; } catch (_) {}
    try { $wFn('#giftCardDesc').text = GIFT_CARD_DESC; } catch (_) {}

    const btn = $wFn('#giftCardBtn');
    btn.text = GIFT_CARD_BTN_TEXT;
    try { btn.accessibility.ariaLabel = 'Shop Carolina Futons gift cards'; } catch (_) {}

    btn.onClick(() => {
      if (opts.navigate) {
        opts.navigate(GIFT_CARDS_PATH);
      } else {
        import('wix-location-frontend').then(loc => {
          const navFn = loc.default?.to ?? loc.to;
          navFn(GIFT_CARDS_PATH);
        }).catch(() => {});
      }
    });
  } catch (_) {
    // Elements may not exist in all page layouts — graceful no-op
  }
}
