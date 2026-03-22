// Bundle.js — Bundle Builder page (/bundle)
// Lets customers hand-pick 2–4 products to build a custom bundle and
// receive an automatic discount.  Shows live price + savings badge,
// an editable summary list, and adds the bundle to cart in one click.
//
// Element nicknames:
//   bundleHeroSection       — Box: hero/intro area
//   bundleProductRepeater   — Repeater: product selection cards
//     ↳ bundleProductImage  — Image
//     ↳ bundleProductName   — Text
//     ↳ bundleProductPrice  — Text
//     ↳ bundleSelectBtn     — Button (toggles selected state)
//     ↳ bundleSelectedBadge — Box (checkmark overlay, hidden by default)
//   bundleSummarySection    — Box: selected items summary (hidden until ≥2 selected)
//   bundleSummaryRepeater   — Repeater: selected items list
//     ↳ bundleSummaryName   — Text
//     ↳ bundleSummaryPrice  — Text
//     ↳ bundleSummaryRemoveBtn — Button
//   bundleTotalPrice        — Text: 'Bundle Total: $X'
//   bundleDiscountBadge     — Text: 'Save X%!' (hidden until eligible)
//   bundleAddToCartBtn      — Button: disabled until ≥2 selected
//   bundleEmptyState        — Box: 'Select at least 2 items to build a bundle'
//   bundleLoader            — Box: loading skeleton/spinner
//   bundleError             — Text: error message (hidden by default)

import { announce } from 'public/a11yHelpers.js';
import {
  getBundlePageProducts,
  calculateBundlePrice,
  addBundleToCart,
} from 'backend/bundleBuilder.web.js';

const MAX_BUNDLE_SIZE = 4;
const MIN_BUNDLE_SIZE = 2;

// ── initBundle ────────────────────────────────────────────────────────

/**
 * Initialize the Bundle Builder page.
 * Loads products, wires repeaters and the add-to-cart button.
 *
 * @param {Function} $w - Wix selector function
 * @returns {Promise<null>}
 */
export async function initBundle($w) {
  // Show loader; collapse/hide conditional sections immediately.
  try { $w('#bundleLoader').show(); } catch (e) {
    console.error('[Bundle] show bundleLoader failed:', e?.message);
  }
  try { $w('#bundleSummarySection').collapse(); } catch (e) {
    console.error('[Bundle] collapse bundleSummarySection failed:', e?.message);
  }
  try { $w('#bundleDiscountBadge').hide(); } catch (e) {
    console.error('[Bundle] hide bundleDiscountBadge failed:', e?.message);
  }
  try { $w('#bundleError').hide(); } catch (e) {
    console.error('[Bundle] hide bundleError failed:', e?.message);
  }
  try { $w('#bundleAddToCartBtn').disable(); } catch (e) {
    console.error('[Bundle] disable bundleAddToCartBtn failed:', e?.message);
  }
  try { $w('#bundleEmptyState').show(); } catch (e) {
    console.error('[Bundle] show bundleEmptyState failed:', e?.message);
  }

  // Touch hero section to confirm it is present in the element registry.
  try { void $w('#bundleHeroSection'); } catch (_) {}

  // Mutable selection state — shared across closures via reference.
  const selected = new Set();

  // ── Wire summary repeater onItemReady BEFORE any .data assignment ──
  try {
    $w('#bundleSummaryRepeater').onItemReady(($item, itemData) => {
      try { $item('#bundleSummaryName').text = itemData.name || ''; } catch (e) {
        console.error('[Bundle] bundleSummaryName text failed:', e?.message);
      }
      try { $item('#bundleSummaryPrice').text = itemData.formattedPrice || ''; } catch (e) {
        console.error('[Bundle] bundleSummaryPrice text failed:', e?.message);
      }
      try {
        $item('#bundleSummaryRemoveBtn').onClick(async () => {
          selected.delete(itemData._id);
          announce($w, `${itemData.name || 'Item'} removed from bundle`);
          await _updateUI($w, selected, allProducts);
        });
      } catch (e) {
        console.error('[Bundle] bundleSummaryRemoveBtn wire failed:', e?.message);
      }
    });
  } catch (e) {
    console.error('[Bundle] bundleSummaryRepeater onItemReady failed:', e?.message);
  }

  // ── Wire add-to-cart button ────────────────────────────────────────
  try {
    $w('#bundleAddToCartBtn').onClick(async () => {
      const selectedIds = [...selected];
      try {
        const result = await addBundleToCart(selectedIds);
        if (result?.success) {
          selected.clear();
          announce($w, 'Bundle added to cart!');
          await _updateUI($w, selected, allProducts);
        } else {
          const msg = result?.error || 'Unable to add bundle. Please try again.';
          try { $w('#bundleError').text = msg; } catch (e) {
            console.error('[Bundle] bundleError text failed:', e?.message);
          }
          try { $w('#bundleError').show(); } catch (e) {
            console.error('[Bundle] bundleError show failed:', e?.message);
          }
          announce($w, msg);
        }
      } catch (e) {
        console.error('[Bundle] addBundleToCart failed:', e);
        const msg = 'Unable to add bundle. Please try again.';
        try { $w('#bundleError').text = msg; } catch (e2) {
          console.error('[Bundle] bundleError text failed:', e2?.message);
        }
        try { $w('#bundleError').show(); } catch (e2) {
          console.error('[Bundle] bundleError show failed:', e2?.message);
        }
        announce($w, msg);
      }
    });
  } catch (e) {
    console.error('[Bundle] bundleAddToCartBtn wire failed:', e?.message);
  }

  // ── Load products ──────────────────────────────────────────────────
  let allProducts = [];
  try {
    const response = await getBundlePageProducts();

    if (!response?.success) {
      console.error('[Bundle] getBundlePageProducts returned failure:', response?.error);
      _showError($w, response?.error || 'Unable to load products. Please try again.');
    } else {
      allProducts = response.products || [];

      // Wire product repeater onItemReady BEFORE setting .data (critical).
      try {
        $w('#bundleProductRepeater').onItemReady(($item, itemData) => {
          try { $item('#bundleProductImage').src = itemData.mainMedia?.url || ''; } catch (e) {
            console.error('[Bundle] bundleProductImage src failed:', e?.message);
          }
          try { $item('#bundleProductName').text = itemData.name || ''; } catch (e) {
            console.error('[Bundle] bundleProductName text failed:', e?.message);
          }
          try { $item('#bundleProductPrice').text = itemData.formattedPrice || ''; } catch (e) {
            console.error('[Bundle] bundleProductPrice text failed:', e?.message);
          }
          try { $item('#bundleSelectedBadge').hide(); } catch (e) {
            console.error('[Bundle] bundleSelectedBadge hide failed:', e?.message);
          }
          // Initial aria-pressed state (false — not selected on load).
          try { $item('#bundleSelectBtn').accessibility.ariaPressed = 'false'; } catch (e) {
            console.error('[Bundle] bundleSelectBtn ariaPressed init failed:', e?.message);
          }
          try {
            $item('#bundleSelectBtn').onClick(async () => {
              if (selected.has(itemData._id)) {
                selected.delete(itemData._id);
                try { $item('#bundleSelectedBadge').hide(); } catch (e) {
                  console.error('[Bundle] bundleSelectedBadge hide on deselect failed:', e?.message);
                }
                try { $item('#bundleSelectBtn').accessibility.ariaPressed = 'false'; } catch (e) {
                  console.error('[Bundle] bundleSelectBtn ariaPressed deselect failed:', e?.message);
                }
                announce($w, `${itemData.name || 'Item'} removed`);
              } else {
                if (selected.size >= MAX_BUNDLE_SIZE) {
                  announce($w, `Maximum ${MAX_BUNDLE_SIZE} items allowed in a bundle`);
                  return;
                }
                selected.add(itemData._id);
                try { $item('#bundleSelectedBadge').show(); } catch (e) {
                  console.error('[Bundle] bundleSelectedBadge show failed:', e?.message);
                }
                try { $item('#bundleSelectBtn').accessibility.ariaPressed = 'true'; } catch (e) {
                  console.error('[Bundle] bundleSelectBtn ariaPressed select failed:', e?.message);
                }
                announce($w, `${itemData.name || 'Item'} added to bundle`);
              }
              await _updateUI($w, selected, allProducts);
            });
          } catch (e) {
            console.error('[Bundle] bundleSelectBtn wire failed:', e?.message);
          }
        });
      } catch (e) {
        console.error('[Bundle] bundleProductRepeater onItemReady failed:', e?.message);
      }

      // Set repeater data AFTER wiring onItemReady.
      try {
        $w('#bundleProductRepeater').data = allProducts.map(p => ({ ...p, selected: false }));
      } catch (e) {
        console.error('[Bundle] bundleProductRepeater.data set failed:', e?.message);
      }
    }
  } catch (e) {
    console.error('[Bundle] getBundlePageProducts threw:', e);
    _showError($w, 'Unable to load products. Please try again.');
  } finally {
    try { $w('#bundleLoader').hide(); } catch (e) {
      console.error('[Bundle] hide bundleLoader failed:', e?.message);
    }
  }

  return null;
}

// ── _updateUI ─────────────────────────────────────────────────────────

/**
 * Sync all UI elements to the current selection state.
 * Called after every selection change (add, remove, clear).
 *
 * @param {Function} $w
 * @param {Set<string>} selected - Set of selected product IDs
 * @param {Array} allProducts - Full product list (for looking up details)
 */
async function _updateUI($w, selected, allProducts) {
  const selectedIds = [...selected];
  const count = selectedIds.length;
  const eligible = count >= MIN_BUNDLE_SIZE;

  // Sync product repeater selected state.
  try {
    const currentData = $w('#bundleProductRepeater').data;
    $w('#bundleProductRepeater').data = currentData.map(p => ({
      ...p,
      selected: selected.has(p._id),
    }));
  } catch (e) {
    console.error('[Bundle] bundleProductRepeater.data sync failed:', e?.message);
  }

  // Update summary repeater with selected product details.
  const selectedProducts = allProducts.filter(p => selected.has(p._id));
  try {
    $w('#bundleSummaryRepeater').data = selectedProducts;
  } catch (e) {
    console.error('[Bundle] bundleSummaryRepeater.data set failed:', e?.message);
  }

  // Show/collapse summary section.
  if (eligible) {
    try { $w('#bundleSummarySection').expand(); } catch (e) {
      console.error('[Bundle] expand bundleSummarySection failed:', e?.message);
    }
    try { $w('#bundleEmptyState').hide(); } catch (e) {
      console.error('[Bundle] hide bundleEmptyState failed:', e?.message);
    }
  } else {
    try { $w('#bundleSummarySection').collapse(); } catch (e) {
      console.error('[Bundle] collapse bundleSummarySection failed:', e?.message);
    }
    try { $w('#bundleEmptyState').show(); } catch (e) {
      console.error('[Bundle] show bundleEmptyState failed:', e?.message);
    }
  }

  // Enable/disable add-to-cart button with item count in label.
  if (eligible) {
    try { $w('#bundleAddToCartBtn').enable(); } catch (e) {
      console.error('[Bundle] enable bundleAddToCartBtn failed:', e?.message);
    }
    try { $w('#bundleAddToCartBtn').label = `Add Bundle to Cart (${count} items)`; } catch (e) {
      console.error('[Bundle] bundleAddToCartBtn label failed:', e?.message);
    }
  } else {
    try { $w('#bundleAddToCartBtn').disable(); } catch (e) {
      console.error('[Bundle] disable bundleAddToCartBtn failed:', e?.message);
    }
  }

  // Calculate price and update discount badge + total.
  if (eligible) {
    await _refreshPricing($w, selectedIds, selectedProducts);
  } else {
    try { $w('#bundleDiscountBadge').hide(); } catch (e) {
      console.error('[Bundle] hide bundleDiscountBadge failed:', e?.message);
    }
    try { $w('#bundleTotalPrice').text = ''; } catch (e) {
      console.error('[Bundle] bundleTotalPrice clear failed:', e?.message);
    }
  }
}

// ── _refreshPricing ───────────────────────────────────────────────────

/**
 * Fetch bundle pricing from backend and update badge + total price text.
 *
 * @param {Function} $w
 * @param {string[]} selectedIds
 * @param {Array} selectedProducts
 */
async function _refreshPricing($w, selectedIds, selectedProducts) {
  try {
    const pricing = await calculateBundlePrice(selectedIds);

    if (pricing?.discountPercent > 0) {
      try { $w('#bundleDiscountBadge').text = `Save ${pricing.discountPercent}%!`; } catch (e) {
        console.error('[Bundle] bundleDiscountBadge text failed:', e?.message);
      }
      try { $w('#bundleDiscountBadge').show(); } catch (e) {
        console.error('[Bundle] bundleDiscountBadge show failed:', e?.message);
      }
    } else {
      try { $w('#bundleDiscountBadge').hide(); } catch (e) {
        console.error('[Bundle] bundleDiscountBadge hide failed:', e?.message);
      }
    }

    // Guard against NaN/non-finite from backend — fall back to sum of individual prices.
    const rawTotal = pricing?.bundlePrice;
    const total = Number.isFinite(rawTotal)
      ? rawTotal
      : selectedProducts.reduce((sum, p) => sum + (p.price || 0), 0);

    try {
      $w('#bundleTotalPrice').text = `Bundle Total: $${total.toFixed(2)}`;
    } catch (e) {
      console.error('[Bundle] bundleTotalPrice text failed:', e?.message);
    }
  } catch (e) {
    console.error('[Bundle] calculateBundlePrice failed:', e);
    // Fallback: show sum of individual prices without discount.
    const fallbackTotal = selectedProducts.reduce((sum, p) => sum + (p.price || 0), 0);
    try { $w('#bundleTotalPrice').text = `Bundle Total: $${fallbackTotal.toFixed(2)}`; } catch (_) {}
    try { $w('#bundleDiscountBadge').hide(); } catch (_) {}
  }
}

// ── _showError ────────────────────────────────────────────────────────

/**
 * Display an error message in the bundleError element.
 *
 * @param {Function} $w
 * @param {string} message
 */
function _showError($w, message) {
  try { $w('#bundleError').text = message; } catch (e) {
    console.error('[Bundle] bundleError text failed:', e?.message);
  }
  try { $w('#bundleError').show(); } catch (e) {
    console.error('[Bundle] bundleError show failed:', e?.message);
  }
}
