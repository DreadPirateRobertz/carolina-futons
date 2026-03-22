// QuickView.js — Product Quick-View Modal
// Click on a product card opens a mini-PDP overlay without navigation.
// Displays name, price, main image, add-to-cart button, and view-full-page link.
// Data sourced from the Wix Stores catalog via wix-stores-frontend products.getProduct().
//
// Element nicknames:
//   quickViewModal      — modal/overlay container
//   quickViewClose      — modal close button
//   quickViewImage      — product main image
//   quickViewName       — product name text
//   quickViewPrice      — product price text
//   quickViewAddToCart  — add-to-cart button
//   quickViewFullLink   — link to full product page

import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { addToCart } from 'public/cartService';
import { formatCurrency } from 'public/productPageUtils.js';
import wixStoresFrontend from 'wix-stores-frontend';

// Per-session product cache keyed by productId.
const _cache = new Map();
// Currently displayed product — updated by openQuickView, read by the add-to-cart handler.
let _currentProduct = null;

/** Test helper — clears the product cache and current product between test runs. */
export function __resetCache() {
  _cache.clear();
  _currentProduct = null;
}

// ── initQuickView ─────────────────────────────────────────────────────

/**
 * Initialize the quick-view modal container.
 * Call once on page ready (Category Page, Home Page) before any card renders.
 * Wires the add-to-cart handler once here; openQuickView updates _currentProduct.
 * Returns the dialog handle for use with openQuickView().
 *
 * @param {Function} $w - Wix selector function
 * @returns {Object} dialog handle ({ open, close })
 */
export function initQuickView($w) {
  try {
    try { $w('#quickViewModal').collapse(); } catch (e) {
      console.warn('[QuickView] collapse failed:', e?.message);
    }

    // ARIA attributes
    try { $w('#quickViewModal').accessibility.role = 'dialog'; } catch (e) {
      console.warn('[QuickView] ARIA role failed:', e?.message);
    }
    try { $w('#quickViewModal').accessibility.ariaModal = true; } catch (e) {
      console.warn('[QuickView] ariaModal failed:', e?.message);
    }

    // ariaLive on add-to-cart at init so screen readers catch first announcement
    try { $w('#quickViewAddToCart').accessibility.ariaLive = 'polite'; } catch (e) {
      console.warn('[QuickView] ariaLive init failed:', e?.message);
    }

    const dialog = setupAccessibleDialog($w, {
      panelId: '#quickViewModal',
      closeId: '#quickViewClose',
      focusableIds: [
        '#quickViewClose',
        '#quickViewAddToCart',
        '#quickViewFullLink',
      ],
      onClose: () => {
        announce($w, 'Quick view closed');
      },
    });

    // Wire add-to-cart once at init; _currentProduct is updated by openQuickView.
    try {
      $w('#quickViewAddToCart').onClick(async () => {
        if (!_currentProduct) return;
        const btn = $w('#quickViewAddToCart');
        try {
          btn.disable();
          btn.label = 'Adding…';
          await addToCart(_currentProduct._id, 1);
          btn.label = 'Added!';
        } catch (e) {
          console.error('[QuickView] addToCart failed:', e);
          btn.label = 'Error — Try Again';
        } finally {
          btn.enable();
        }
      });
    } catch (e) {
      console.warn('[QuickView] addToCart wire failed:', e?.message);
    }

    return dialog;
  } catch (e) {
    console.error('[QuickView] initQuickView failed:', e);
    return null;
  }
}

// ── openQuickView ─────────────────────────────────────────────────────

/**
 * Open the quick-view modal for a specific product.
 * Fetches the product from Wix Stores on first open; subsequent opens for
 * the same productId use the in-memory cache. Updates _currentProduct so the
 * add-to-cart handler (wired once in initQuickView) uses the correct product.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} productId - Wix Stores product _id
 * @param {Object} dialog - Dialog handle returned by initQuickView()
 */
export async function openQuickView($w, productId, dialog) {
  try {
    let product = null;

    if (_cache.has(productId)) {
      product = _cache.get(productId);
    } else {
      try {
        product = await wixStoresFrontend.products.getProduct(productId);
        _cache.set(productId, product);
      } catch (e) {
        console.warn('[QuickView] getProduct failed for id:', productId, '—', e?.message);
        // Do not cache the error — allow retry on next open.
      }
    }

    _currentProduct = product;
    _renderProduct($w, product);

    announce($w, 'Quick view opened');
    if (dialog) dialog.open();
  } catch (e) {
    console.error('[QuickView] openQuickView failed:', e);
  }
}

// ── _renderProduct ────────────────────────────────────────────────────

/**
 * Populate the modal elements from a Wix Stores product object.
 * Shows fallback text when product is null (not found or fetch failed).
 *
 * @param {Function} $w
 * @param {Object|null} product - Wix Stores product, or null if unavailable
 */
function _renderProduct($w, product) {
  if (!product) {
    try { $w('#quickViewName').text = 'Product information not available.'; } catch (e) {
      console.warn('[QuickView] name fallback failed:', e?.message);
    }
    try { $w('#quickViewPrice').text = ''; } catch (e) {
      console.warn('[QuickView] price clear failed:', e?.message);
    }
    try { $w('#quickViewImage').src = ''; } catch (e) {
      console.warn('[QuickView] image clear failed:', e?.message);
    }
    try { $w('#quickViewFullLink').link = ''; } catch (e) {
      console.warn('[QuickView] fullLink clear failed:', e?.message);
    }
    return;
  }

  try { $w('#quickViewName').text = product.name || ''; } catch (e) {
    console.warn('[QuickView] name render failed:', e?.message);
  }

  try {
    const priceText = product.price != null
      ? formatCurrency(product.price)
      : '';
    $w('#quickViewPrice').text = priceText;
  } catch (e) {
    console.warn('[QuickView] price render failed:', e?.message);
  }

  try {
    const imageUrl = product.mainMedia?.image?.url || '';
    $w('#quickViewImage').src = imageUrl;
  } catch (e) {
    console.warn('[QuickView] image render failed:', e?.message);
  }

  try {
    const slug = product.slug || '';
    $w('#quickViewFullLink').link = slug ? `/product-page/${slug}` : '';
  } catch (e) {
    console.warn('[QuickView] fullLink render failed:', e?.message);
  }

  try {
    $w('#quickViewAddToCart').accessibility.ariaLabel = `Add ${product.name || 'product'} to cart`;
  } catch (e) {
    console.warn('[QuickView] addToCart ariaLabel failed:', e?.message);
  }
}
