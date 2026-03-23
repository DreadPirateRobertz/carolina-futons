/**
 * @module CheckoutShippingIntelligence
 * @description Checkout shipping step — wires getShippingEstimate / calculateBundleQuote
 * into the checkout flow so customers see real-time rate options before placing an order.
 *
 * CF-nnul: Mobile checkout shipping intelligence integration
 *
 * Elements expected on the Checkout page:
 *   #checkoutShippingIntelWidget   — Box, full widget container
 *   #checkoutShippingZip           — Input, 5-digit destination zip
 *   #checkoutShippingCalcBtn       — Button, "Calculate Shipping"
 *   #checkoutShippingResults       — Box, results container (hidden until fetch)
 *   #checkoutShippingRatesRepeater — Repeater, one row per rate option
 *   #checkoutShippingLoader        — Box, loading state
 *   #checkoutShippingError         — Text, error / fallback message
 *   #checkoutShippingFreightBanner — Text, shown when any option is LTL freight
 *   #checkoutShippingOrigin        — Text, "Ships from Hendersonville, NC"
 *
 * Repeater item elements (null-guarded):
 *   #checkoutShippingOptionTitle    — carrier + service name (with "(estimated)" suffix)
 *   #checkoutShippingOptionPrice    — formatted cost, e.g. "$49.99"
 *   #checkoutShippingOptionDelivery — estimated delivery window
 *   #checkoutShippingOptionRadio    — Button / Radio trigger for option selection
 */
import { getShippingEstimate, calculateBundleQuote } from 'backend/shippingIntelligence.web';

const STORAGE_KEY = 'cf_zip';
const ORIGIN_TEXT = 'Ships from Hendersonville, NC';
const CONTACT_PHONE = '(828) 252-9449';
const FREIGHT_BANNER_TEXT =
  'This order ships freight. A carrier will contact you to schedule delivery.';

// Module-level state — reset by initCheckoutShippingIntelligence each call
let _selectedShippingCode = null;
let _onShippingSelect = null;

// ── Zip validation ────────────────────────────────────────────────────────────

/**
 * Returns true for a valid 5-digit US ZIP code.
 * @param {*} zip
 * @returns {boolean}
 */
export function isValidZip(zip) {
  if (zip == null) return false;
  return /^\d{5}$/.test(String(zip).trim());
}

// ── Rate fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch shipping rates for checkout cart items at a given ZIP.
 * Routes single-product carts through getShippingEstimate and multi-item carts
 * through calculateBundleQuote.
 *
 * @param {Array<{productId: string, quantity: number, price?: number}>} cartItems
 * @param {string} zip
 * @returns {Promise<{success: boolean, options: Array, error?: string}>}
 */
export async function fetchCheckoutShippingRates(cartItems, zip) {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'No items in cart', options: [] };
  }

  if (cartItems.length === 1 && cartItems[0].productId) {
    return getShippingEstimate(cartItems[0].productId, zip);
  }

  const items = cartItems.map(item => ({
    productId: item.productId,
    quantity: item.quantity || 1,
    price: item.price || 0,
  }));
  return calculateBundleQuote(items, zip);
}

// ── safeGet / safeCall helpers ────────────────────────────────────────────────

function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (_) {
    return null;
  }
}

function safeCall($wFn, sel, fn) {
  const el = safeGet($wFn, sel);
  if (el) fn(el);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialize the shipping intelligence widget in the checkout shipping step.
 *
 * @param {Function} $wFn     - Wix $w selector function (injectable for testing)
 * @param {Array}    cartItems - Array of cart line items with productId, quantity, price
 * @param {object}   [opts]
 * @param {object}   [opts.storage]  - Storage adapter (getItem/setItem). Defaults to wix-storage-frontend local.
 * @param {Function} [opts.onSelect] - Called with (code, option) when customer selects a rate.
 */
export async function initCheckoutShippingIntelligence($wFn, cartItems, opts = {}) {
  const storage = opts.storage ??
    (await import('wix-storage-frontend').then(m => m.local));

  _selectedShippingCode = null;
  _onShippingSelect = opts.onSelect || null;

  // Set origin attribution text
  safeCall($wFn, '#checkoutShippingOrigin', el => { el.text = ORIGIN_TEXT; });

  // Pre-populate ZIP from saved storage (may come from product page or previous checkout)
  const savedZip = storage.getItem(STORAGE_KEY);
  safeCall($wFn, '#checkoutShippingZip', el => {
    if (savedZip) el.value = savedZip;
  });

  // Hide dynamic elements initially
  safeCall($wFn, '#checkoutShippingError', el => el.hide());
  safeCall($wFn, '#checkoutShippingFreightBanner', el => el.hide());
  safeCall($wFn, '#checkoutShippingResults', el => el.hide());
  safeCall($wFn, '#checkoutShippingLoader', el => el.hide());

  // Wire calculate button
  safeCall($wFn, '#checkoutShippingCalcBtn', el => {
    el.onClick(() => _handleCalculate($wFn, cartItems, storage));
  });
}

// ── Internal calculate handler ────────────────────────────────────────────────

async function _handleCalculate($wFn, cartItems, storage) {
  const zip = (safeGet($wFn, '#checkoutShippingZip')?.value ?? '').trim();
  const errEl = safeGet($wFn, '#checkoutShippingError');

  // Hide stale error and results
  if (errEl) errEl.hide();
  safeCall($wFn, '#checkoutShippingResults', el => el.hide());

  if (!isValidZip(zip)) {
    if (errEl) {
      errEl.text = 'Please enter a valid 5-digit ZIP code.';
      errEl.show();
    }
    return;
  }

  const loaderEl = safeGet($wFn, '#checkoutShippingLoader');
  if (loaderEl) loaderEl.show();

  try {
    const result = await fetchCheckoutShippingRates(cartItems, zip);

    if (!result.success || !Array.isArray(result.options) || result.options.length === 0) {
      _showFallback($wFn);
      return;
    }

    storage.setItem(STORAGE_KEY, zip);
    renderCheckoutShippingOptions($wFn, result.options);
  } catch (_) {
    _showFallback($wFn);
  } finally {
    if (loaderEl) loaderEl.hide();
  }
}

function _showFallback($wFn) {
  safeCall($wFn, '#checkoutShippingError', el => {
    el.text = `Contact us for a shipping quote: ${CONTACT_PHONE}`;
    el.show();
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Render shipping rate options into the checkout repeater.
 * Shows freight banner when any LTL option is present.
 * Registers onItemReady before setting .data (Wix Velo requirement).
 *
 * @param {Function} $wFn
 * @param {Array<ShippingOption>} options
 */
export function renderCheckoutShippingOptions($wFn, options) {
  // Freight banner: show when any option is LTL / requires liftgate
  const hasFreight = options.some(o => o.requiresLiftgate || o.isLTL || o.requiresFreight);
  safeCall($wFn, '#checkoutShippingFreightBanner', el => {
    el.text = FREIGHT_BANNER_TEXT;
    if (hasFreight) el.show(); else el.hide();
  });

  const repeater = safeGet($wFn, '#checkoutShippingRatesRepeater');
  if (!repeater) {
    // Still show results container even without repeater (other elements may be visible)
    safeCall($wFn, '#checkoutShippingResults', el => el.show());
    return;
  }

  // onItemReady MUST be registered before .data (Wix fires it synchronously on assignment)
  repeater.onItemReady(($item, itemData) => {
    const titleEl = $item('#checkoutShippingOptionTitle');
    const priceEl = $item('#checkoutShippingOptionPrice');
    const deliveryEl = $item('#checkoutShippingOptionDelivery');
    const radioEl = $item('#checkoutShippingOptionRadio');

    if (titleEl) {
      titleEl.text = itemData.isEstimate
        ? `${itemData.title} (estimated)`
        : itemData.title;
    }

    if (priceEl) {
      const cost = Number(itemData.cost ?? 0);
      priceEl.text = `$${(Number.isFinite(cost) ? cost : 0).toFixed(2)}`;
    }

    if (deliveryEl) {
      deliveryEl.text = itemData.estimatedDelivery || '';
    }

    if (radioEl) {
      radioEl.onClick(() => {
        _selectedShippingCode = itemData.code;
        if (_onShippingSelect) _onShippingSelect(itemData.code, itemData);
      });
    }
  });

  repeater.data = options.map((option, idx) => ({
    _id: `checkout-shipping-${idx}`,
    ...option,
  }));

  safeCall($wFn, '#checkoutShippingResults', el => el.show());
}

// ── State accessors ───────────────────────────────────────────────────────────

/**
 * Returns the currently selected shipping rate code (e.g. 'ups-ground'),
 * or null if the customer hasn't made a selection yet.
 * @returns {string|null}
 */
export function getSelectedShippingCode() {
  return _selectedShippingCode;
}
