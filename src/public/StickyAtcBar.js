/**
 * @module StickyAtcBar
 * @description Scroll-aware sticky Add-to-Cart bar for the Product Detail Page.
 *
 * Accepts an injected getBoundingRect callback (typically querying
 * #addToCartButton) that returns the primary CTA's viewport position.
 * When bounds.top < 0 the bar slides up from the bottom; when >= 0 it hides.
 * The bar disappears when the primary button is back in view.
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
 *   // In Product Page code (import paths depend on your project structure):
 *   import { initStickyAtcBar } from 'public/StickyAtcBar';
 *   $w.onReady(() => initStickyAtcBar($w, state, { addToCart }));
 */

// ── Constants ──────────────────────────────────────────────────────────

import { renderSimplePrice } from 'public/productCardHelpers.js';

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
    renderSimplePrice(price, product);

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

let _busy = false; // Concurrency guard — prevents duplicate addToCart calls on rapid taps

/**
 * Handle a click on the sticky Add-to-Cart button.
 * Disables the button during the async call, sets feedback labels, then
 * re-enables after RESET_DELAY_MS on both success and error paths.
 * No-op when product is absent or addToCart is not provided. Concurrency-safe:
 * a second click while in-flight is ignored.
 *
 * @param {Function} $wFn
 * @param {Object} state - { product, selectedQuantity }
 * @param {Object} opts
 * @param {Function} opts.addToCart - (productId, qty) => Promise
 */
export async function handleStickyAtcClick($wFn, state, opts = {}) {
  if (_busy) return;

  const btn = safeGet($wFn, '#stickyAtcBtn');
  const { product, selectedQuantity = 1 } = state || {};

  if (!product?._id) return;

  const { addToCart } = opts;
  if (!addToCart) return;

  _busy = true;
  try {
    if (btn) { btn.disable(); btn.label = LABEL_ADDING; }
    await addToCart(product._id, selectedQuantity);
    if (btn) btn.label = LABEL_ADDED;
  } catch (err) {
    console.error('[StickyAtcBar] addToCart failed:', err?.message ?? err);
    if (btn) btn.label = LABEL_ERROR;
  } finally {
    setTimeout(() => {
      _busy = false;
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
 * @param {Function} [opts.onScroll]        - Injectable scroll binder; if absent, no scroll listener is registered and the bar will never auto-show/hide
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
