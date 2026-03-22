/**
 * @module StickyAtcBar
 * @description Scroll-aware sticky Add-to-Cart bar for the Product Detail Page.
 *
 * Watches the primary #addToCartButton via a scroll listener. When that button
 * scrolls above the viewport the sticky bar slides up from the bottom, giving
 * the user a persistent purchase CTA. The bar disappears when the primary
 * button is back in view.
 *
 * Mirrors the primary button's out-of-stock disabled state and delegates the
 * actual cart operation to the same addToCart function used by the main button.
 *
 * CF-gj26: Sticky Add-to-Cart Bar
 *
 * Editor nicknames (Product Page):
 *   stickyAtcBar         → #stickyAtcBar         (Box / fixed overlay)
 *   stickyAtcProductName → #stickyAtcProductName  (Text — product name)
 *   stickyAtcPrice       → #stickyAtcPrice        (Text — formatted price)
 *   stickyAtcBtn         → #stickyAtcBtn          (Button — CTA)
 *
 * @example
 *   // In Product Page code:
 *   import { initStickyAtcBar } from 'public/StickyAtcBar';
 *   import { addToCart } from 'public/cartService';
 *   $w.onReady(() => initStickyAtcBar($w, state, { addToCart }));
 */

// ── Constants ──────────────────────────────────────────────────────────

const RESET_DELAY_MS    = 3000;
const LABEL_DEFAULT     = 'Add to Cart';
const LABEL_ADDING      = 'Adding...';
const LABEL_ADDED       = 'Added!';
const LABEL_ERROR       = 'Error — Try Again';
const LABEL_OOS         = 'Out of Stock';

// ── Internal helpers ───────────────────────────────────────────────────

function safeGet($wFn, selector) {
  try { return $wFn(selector) || null; } catch (_) { return null; }
}

// ── Render helpers ─────────────────────────────────────────────────────

/**
 * Sync product name, price, and button enabled/disabled state to the bar.
 * No-op if elements are absent or product is null.
 *
 * @param {Function} $wFn
 * @param {Object} state - { product, isOutOfStock }
 */
export function syncStickyBarState($wFn, state) {
  try {
    const { product, isOutOfStock } = state || {};
    const name  = safeGet($wFn, '#stickyAtcProductName');
    const price = safeGet($wFn, '#stickyAtcPrice');
    const btn   = safeGet($wFn, '#stickyAtcBtn');

    if (name  && product?.name)           name.text  = product.name;
    if (price && product?.formattedPrice) price.text = product.formattedPrice;

    if (btn) {
      if (isOutOfStock) {
        btn.disable();
        btn.label = LABEL_OOS;
      } else {
        btn.enable();
        btn.label = LABEL_DEFAULT;
      }
    }
  } catch (_) { /* element may not be on this page */ }
}

/**
 * Show the sticky bar.
 * @param {Function} $wFn
 */
export function showStickyBar($wFn) {
  try {
    const bar = safeGet($wFn, '#stickyAtcBar');
    if (bar) bar.show();
  } catch (_) {}
}

/**
 * Hide the sticky bar.
 * @param {Function} $wFn
 */
export function hideStickyBar($wFn) {
  try {
    const bar = safeGet($wFn, '#stickyAtcBar');
    if (bar) bar.hide();
  } catch (_) {}
}

// ── Click handler ──────────────────────────────────────────────────────

/**
 * Handle a click on the sticky Add-to-Cart button.
 * Disables the button during the async call, sets feedback labels, then
 * re-enables after RESET_DELAY_MS. No-op when product is absent.
 *
 * @param {Function} $wFn
 * @param {Object} state - { product, selectedQuantity }
 * @param {Object} opts
 * @param {Function} opts.addToCart - (productId, qty) => Promise
 */
export async function handleStickyAtcClick($wFn, state, opts = {}) {
  const btn = safeGet($wFn, '#stickyAtcBtn');
  const { product, selectedQuantity = 1 } = state || {};

  if (!product?._id) return;

  const { addToCart } = opts;
  if (!addToCart) return;

  try {
    if (btn) { btn.disable(); btn.label = LABEL_ADDING; }
    await addToCart(product._id, selectedQuantity);
    if (btn) btn.label = LABEL_ADDED;
  } catch (_) {
    if (btn) btn.label = LABEL_ERROR;
  } finally {
    setTimeout(() => {
      try {
        if (btn) { btn.label = LABEL_DEFAULT; btn.enable(); }
      } catch (_) {}
    }, RESET_DELAY_MS);
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initialise the sticky ATC bar on the Product Detail Page.
 *
 * 1. Hides the bar and syncs initial product state.
 * 2. Registers a scroll listener: shows bar when #addToCartButton exits the
 *    viewport upward (bounds.top < 0); hides when it re-enters.
 * 3. Wires the sticky button's onClick to handleStickyAtcClick.
 *
 * @param {Function} $wFn - Wix $w selector function
 * @param {Object} state  - { product, selectedQuantity, isOutOfStock }
 * @param {Object} [opts]
 * @param {Function} [opts.addToCart]       - Injectable cart function for testing
 * @param {Function} [opts.onScroll]        - Injectable scroll event (replaces wixWindowFrontend)
 * @param {Function} [opts.getBoundingRect] - Injectable zero-arg async factory → { top: number }; replaces direct DOM call for testability
 */
export function initStickyAtcBar($wFn, state, opts = {}) {
  try {
    hideStickyBar($wFn);
    syncStickyBarState($wFn, state);

    const btn = safeGet($wFn, '#stickyAtcBtn');
    if (btn) {
      btn.onClick(() => handleStickyAtcClick($wFn, state, opts));
    }

    const { onScroll, getBoundingRect } = opts;
    if (!onScroll || !getBoundingRect) return;

    let barVisible = false;

    onScroll(async () => {
      try {
        const bounds = await getBoundingRect();
        if (bounds.top < 0 && !barVisible) {
          barVisible = true;
          showStickyBar($wFn);
        } else if (bounds.top >= 0 && barVisible) {
          barVisible = false;
          hideStickyBar($wFn);
        }
      } catch (err) {
        console.error('[StickyAtcBar] scroll handler error:', err?.message ?? err);
      }
    });
  } catch (err) {
    console.error('[StickyAtcBar] init error:', err?.message ?? err);
  }
}
