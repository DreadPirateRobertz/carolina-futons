// LiveInventory.js — Live Inventory + Low Stock Banner
// Product page module: fetches live inventory status and reveals UI accordingly.
// Shows 'In Stock' / 'Low Stock — X left' / 'Out of Stock' badge,
// an urgency banner when LOW_STOCK, and a notify-me email form when out of stock.
//
// Element nicknames:
//   stockStatusBadge  — Text badge ('In Stock' / 'Low Stock — X left' / 'Out of Stock')
//   lowStockBanner    — Box shown when LOW_STOCK (hidden otherwise)
//   lowStockCount     — Text inside banner ('Only X left!')
//   lowStockIcon      — Image warning icon inside banner (optional)
//   inventoryLoader   — Box skeleton/spinner, hidden after data loads
//   notifyMeSection   — Box shown when OUT_OF_STOCK (hidden otherwise)
//   notifyMeEmail     — Input for customer email
//   notifyMeBtn       — Button to submit notify-me request
//   notifyMeSuccess   — Text confirmation ('You're on the list!')
//   addToCartButton   — Product page add-to-cart button; disabled when OUT_OF_STOCK

import { announce } from 'public/a11yHelpers.js';
import { getProductInventory, registerStockNotification } from 'backend/liveInventory.web.js';

// CSS classes applied to stockStatusBadge for color theming.
const STATUS_CLASSES = {
  in_stock:      'in-stock',
  low_stock:     'low-stock',
  out_of_stock:  'out-of-stock',
};

// ── initLiveInventory ─────────────────────────────────────────────────

/**
 * Initialize the live inventory display on the product page.
 * Fetches inventory status, reveals appropriate UI sections, and wires
 * the notify-me button for out-of-stock products.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null} state - Page state; expected shape: { product: { _id } }
 * @returns {Promise<null>} Always resolves to null (no cleanup handle needed)
 */
export async function initLiveInventory($w, state) {
  const productId = state?.product?._id;
  if (!productId) return null;

  // Collapse conditional sections immediately — revealed only if data warrants it.
  try { $w('#lowStockBanner').collapse(); } catch (e) {
    console.warn('[LiveInventory] collapse lowStockBanner failed:', e?.message);
  }
  try { $w('#notifyMeSection').collapse(); } catch (e) {
    console.warn('[LiveInventory] collapse notifyMeSection failed:', e?.message);
  }
  try { $w('#notifyMeSuccess').hide(); } catch (e) {
    console.warn('[LiveInventory] hide notifyMeSuccess failed:', e?.message);
  }

  // Wire notify-me button before async fetch so the handler is in place when
  // notifyMeSection is revealed (Wix onClick must be wired before expand()).
  try {
    $w('#notifyMeBtn').onClick(async () => {
      try {
        const email = $w('#notifyMeEmail').value;
        if (!email) {
          announce($w, 'Please enter your email address.');
          return;
        }

        const result = await registerStockNotification(productId, email);
        if (result?.success) {
          try { $w('#notifyMeBtn').hide(); } catch (e) {
            console.warn('[LiveInventory] hide notifyMeBtn failed:', e?.message);
          }
          try { $w('#notifyMeSuccess').show(); } catch (e) {
            console.warn('[LiveInventory] show notifyMeSuccess failed:', e?.message);
          }
        } else {
          announce($w, 'Unable to sign up. Please try again.');
        }
      } catch (e) {
        console.error('[LiveInventory] notifyMeBtn click failed:', e);
        announce($w, 'Unable to sign up. Please try again.');
      }
    });
  } catch (e) {
    console.warn('[LiveInventory] notifyMeBtn wire failed:', e?.message);
  }

  // Fetch inventory and update UI — loader hidden whether fetch succeeds or fails.
  try {
    const inventory = await getProductInventory(productId);

    if (!inventory?.success) {
      console.error('[LiveInventory] getProductInventory returned failure:', inventory?.error);
      try { $w('#stockStatusBadge').text = 'Availability unknown'; } catch (e) {
        console.warn('[LiveInventory] stockStatusBadge fallback failed:', e?.message);
      }
    } else {
      _applyInventoryState($w, inventory.status, inventory.quantity);
    }
  } catch (e) {
    console.error('[LiveInventory] getProductInventory failed:', e);
  } finally {
    try { $w('#inventoryLoader').hide(); } catch (e) {
      console.warn('[LiveInventory] hide inventoryLoader failed:', e?.message);
    }
  }

  return null;
}

// ── _applyInventoryState ──────────────────────────────────────────────

/**
 * Update all inventory-related UI elements based on current stock status.
 * Each DOM write is wrapped in try/catch — partial failure doesn't block render.
 *
 * @param {Function} $w
 * @param {'in_stock'|'low_stock'|'out_of_stock'} status
 * @param {number} quantity - Current stock quantity (used for low-stock display)
 */
function _applyInventoryState($w, status, quantity) {
  // Badge text + CSS class for color theming.
  let badgeText;
  if (status === 'out_of_stock') {
    badgeText = 'Out of Stock';
  } else if (status === 'low_stock') {
    badgeText = `Low Stock — ${quantity} left`;
  } else {
    badgeText = 'In Stock';
  }

  try { $w('#stockStatusBadge').text = badgeText; } catch (e) {
    console.warn('[LiveInventory] stockStatusBadge text failed:', e?.message);
  }
  try {
    const cssClass = STATUS_CLASSES[status] || STATUS_CLASSES.in_stock;
    $w('#stockStatusBadge').customClassList.add(cssClass);
  } catch (e) {
    console.warn('[LiveInventory] stockStatusBadge class failed:', e?.message);
  }

  if (status === 'low_stock') {
    try { $w('#lowStockBanner').expand(); } catch (e) {
      console.warn('[LiveInventory] expand lowStockBanner failed:', e?.message);
    }
    try { $w('#lowStockCount').text = `Only ${quantity} left!`; } catch (e) {
      console.warn('[LiveInventory] lowStockCount text failed:', e?.message);
    }
    announce($w, `Low stock — only ${quantity} left`);
  }

  if (status === 'out_of_stock') {
    try { $w('#notifyMeSection').expand(); } catch (e) {
      console.warn('[LiveInventory] expand notifyMeSection failed:', e?.message);
    }
    try { $w('#addToCartButton').disable(); } catch (e) {
      console.warn('[LiveInventory] disable addToCartButton failed:', e?.message);
    }
    announce($w, 'Out of stock — sign up to be notified when available');
  }
}
