/**
 * @module CartShippingEstimate
 * @description Shipping estimate row for Wix Cart and Side Cart.
 *
 * Shows the cheapest available shipping rate (or a ZIP prompt) above the order
 * total before the customer reaches checkout. Handles LTL freight messaging and
 * free-shipping threshold display.
 *
 * ZIP is persisted to session storage under STORAGE_KEY ('cf_shipping_zip') so
 * that a ZIP entered on one page is pre-populated on subsequent visits.
 *
 * Wix element nicknames required on Cart Page:
 *   #cartShippingEstimateRow  — collapsible container Box/Row
 *   #cartShippingResult       — Text — rate, FREE, freight msg, or "Calculating…"
 *   #cartShippingZipForm      — Box — ZIP input form; shown when no ZIP stored
 *   #cartShippingZipInput     — Input — 5-digit US ZIP
 *   #cartShippingZipBtn       — Button — "Get estimate"
 *
 * Wix element nicknames required on Side Cart page:
 *   #sideCartShippingRow      — collapsible container
 *   #sideCartShippingResult   — Text
 *   #sideCartShippingZipForm  — Box
 *   #sideCartShippingZipInput — Input
 *   #sideCartShippingZipBtn   — Button
 *
 * Usage (Cart Page):
 *   import { initCartShippingEstimate, updateCartShippingEstimate } from 'public/CartShippingEstimate';
 *   // on page ready:
 *   await initCartShippingEstimate($w, cart);
 *   // in onCartChanged:
 *   await updateCartShippingEstimate($w, cart);
 *
 * Usage (Side Cart):
 *   import { initSideCartShippingEstimate, updateSideCartShippingEstimate } from 'public/CartShippingEstimate';
 *   await initSideCartShippingEstimate($w, cart);        // page ready
 *   await updateSideCartShippingEstimate($w, currentCart); // on cart change
 *
 * @requires public/CheckoutShippingIntelligence — fetchCheckoutShippingRates, isValidZip
 * @requires public/FreightUpsellBanner          — hasLTLItemInCart
 * @requires public/cartService                  — isFreeShippingEnabled, getShippingProgress
 * @requires public/a11yHelpers                  — announce
 */

import { fetchCheckoutShippingRates, isValidZip } from 'public/CheckoutShippingIntelligence';
import { hasLTLItemInCart } from 'public/FreightUpsellBanner';
import { isFreeShippingEnabled, getShippingProgress } from 'public/cartService';
import { announce } from 'public/a11yHelpers';

export const STORAGE_KEY = 'cf_shipping_zip';
export const FREIGHT_MSG = 'Freight shipping — final rate at checkout';
export const FREE_MSG = 'FREE ✓';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/**
 * Map Wix cart line items to the shape expected by fetchCheckoutShippingRates.
 *
 * @param {Array} lineItems - Wix cart line items
 * @returns {Array<{productId: string, quantity: number, price: number}>}
 */
export function buildCartItemsForRates(lineItems) {
  return (lineItems || [])
    .map(item => ({
      productId: item.catalogReference?.catalogItemId || item.productId || null,
      quantity: item.quantity || 1,
      price: item.price?.amount ?? item.price ?? 0,
    }))
    .filter(i => i.productId);
}

/**
 * Return the option with the lowest cost from a shipping options array.
 *
 * @param {Array} options - Shipping rate options from getShippingEstimate / calculateBundleQuote
 * @returns {Object|null} Cheapest option, or null if empty
 */
export function getCheapestRate(options) {
  if (!Array.isArray(options) || options.length === 0) return null;
  return options.reduce(
    (min, o) => (Number(o.cost) < Number(min.cost) ? o : min),
    options[0],
  );
}

/**
 * Format a shipping option into a display string.
 * Returns "FREE" for zero-cost rates, "$X.XX" otherwise.
 *
 * @param {Object|null} option - Shipping rate option
 * @returns {string|null}
 */
export function formatRateLabel(option) {
  if (!option) return null;
  const cost = Number(option.cost);
  return cost === 0 ? 'FREE' : `$${cost.toFixed(2)}`;
}

// ── Element ID sets ────────────────────────────────────────────────────────────

const CART_ELEMENTS = {
  row: '#cartShippingEstimateRow',
  result: '#cartShippingResult',
  zipForm: '#cartShippingZipForm',
  zipInput: '#cartShippingZipInput',
  zipBtn: '#cartShippingZipBtn',
};

const SIDE_CART_ELEMENTS = {
  row: '#sideCartShippingRow',
  result: '#sideCartShippingResult',
  zipForm: '#sideCartShippingZipForm',
  zipInput: '#sideCartShippingZipInput',
  zipBtn: '#sideCartShippingZipBtn',
};

// ── Per-context state (isolated per Wix page JS context) ──────────────────────

let _cartPageCart = null;
let _sideCartCart = null;

// ── Element helpers ────────────────────────────────────────────────────────────

function _safeGet($w, sel) {
  try { return $w(sel) || null; } catch (_) { return null; }
}

function _safeCall($w, sel, fn) {
  const el = _safeGet($w, sel);
  if (el) fn(el);
}

function _expandOrShow($w, sel) {
  _safeCall($w, sel, el => {
    try { el.expand(); } catch (_) { try { el.show(); } catch (e) {} }
  });
}

function _collapseOrHide($w, sel) {
  _safeCall($w, sel, el => {
    try { el.collapse(); } catch (_) { try { el.hide(); } catch (e) {} }
  });
}

async function _defaultStorage() {
  return import('wix-storage-frontend').then(m => m.session);
}

// ── Internal rendering ─────────────────────────────────────────────────────────

function _showResult($w, els, text) {
  _expandOrShow($w, els.row);
  _safeCall($w, els.result, el => {
    el.text = text;
    try { el.show(); } catch (_) {}
    try { el.accessibility.ariaLive = 'polite'; } catch (_) {}
    try { el.accessibility.role = 'status'; } catch (_) {}
  });
  _collapseOrHide($w, els.zipForm);
}

function _showLoading($w, els) {
  _expandOrShow($w, els.row);
  _safeCall($w, els.result, el => {
    el.text = 'Calculating\u2026';
    try { el.show(); } catch (_) {}
  });
  _collapseOrHide($w, els.zipForm);
}

function _showZipPrompt($w, els) {
  _expandOrShow($w, els.row);
  _safeCall($w, els.result, el => { try { el.hide(); } catch (_) {} });
  _expandOrShow($w, els.zipForm);
}

async function _render($w, cart, els, storage) {
  const lineItems = cart?.lineItems || [];

  if (lineItems.length === 0) {
    _collapseOrHide($w, els.row);
    return;
  }

  // LTL freight item → static message
  if (hasLTLItemInCart(lineItems)) {
    _showResult($w, els, FREIGHT_MSG);
    return;
  }

  // Free shipping threshold met (only when feature is enabled)
  if (isFreeShippingEnabled()) {
    const subtotal = cart?.totals?.subtotal ?? 0;
    const { qualifies } = getShippingProgress(subtotal);
    if (qualifies) {
      _showResult($w, els, FREE_MSG);
      return;
    }
  }

  // Stored ZIP → auto-fetch rate
  const zip = storage.getItem(STORAGE_KEY);
  if (zip) {
    _showLoading($w, els);
    try {
      const cartItems = buildCartItemsForRates(lineItems);
      const result = await fetchCheckoutShippingRates(cartItems, zip);
      if (result.success && Array.isArray(result.options) && result.options.length > 0) {
        const cheapest = getCheapestRate(result.options);
        _showResult($w, els, formatRateLabel(cheapest));
        _safeCall($w, els.zipInput, el => { el.value = zip; });
      } else {
        _showZipPrompt($w, els);
      }
    } catch (_) {
      _showZipPrompt($w, els);
    }
    return;
  }

  // No ZIP → prompt
  _showZipPrompt($w, els);
}

// ── ZIP submit handler ─────────────────────────────────────────────────────────

async function _handleZipSubmit($w, cart, els, storage) {
  const zipEl = _safeGet($w, els.zipInput);
  const zip = (zipEl?.value ?? '').trim();

  if (!isValidZip(zip)) {
    _safeCall($w, els.result, el => {
      el.text = 'Enter a valid 5-digit ZIP';
      try { el.show(); } catch (_) {}
    });
    return;
  }

  storage.setItem(STORAGE_KEY, zip);
  _showLoading($w, els);

  const lineItems = cart?.lineItems || [];
  const cartItems = buildCartItemsForRates(lineItems);

  try {
    const result = await fetchCheckoutShippingRates(cartItems, zip);
    if (result.success && Array.isArray(result.options) && result.options.length > 0) {
      const cheapest = getCheapestRate(result.options);
      const label = formatRateLabel(cheapest);
      _showResult($w, els, label);
      announce($w, `Estimated shipping: ${label}`);
    } else {
      _safeCall($w, els.result, el => {
        el.text = 'Estimate unavailable';
        try { el.show(); } catch (_) {}
      });
    }
  } catch (_) {
    _safeCall($w, els.result, el => {
      el.text = 'Estimate unavailable';
      try { el.show(); } catch (_) {}
    });
  }
}

// ── Public API: Cart Page ──────────────────────────────────────────────────────

/**
 * Initialize the shipping estimate row on the Cart Page.
 * Wires the ZIP submit button once and renders the initial estimate.
 *
 * @param {Function}   $w
 * @param {Object|null} cart - Current cart from getCurrentCart
 * @param {object}     [opts]
 * @param {object}     [opts.storage] - Storage adapter { getItem, setItem } — injectable for tests
 */
export async function initCartShippingEstimate($w, cart, opts = {}) {
  _cartPageCart = cart;
  const storage = opts.storage ?? await _defaultStorage();

  try {
    $w(CART_ELEMENTS.zipBtn).onClick(() =>
      _handleZipSubmit($w, _cartPageCart, CART_ELEMENTS, storage),
    );
  } catch (_) {}

  try {
    await _render($w, cart, CART_ELEMENTS, storage);
  } catch (err) {
    console.warn('[CartShippingEstimate] init error:', err?.message ?? err);
    _collapseOrHide($w, CART_ELEMENTS.row);
  }
}

/**
 * Update the shipping estimate row when the cart changes.
 *
 * @param {Function}   $w
 * @param {Object|null} cart - Updated cart
 * @param {object}     [opts]
 * @param {object}     [opts.storage]
 */
export async function updateCartShippingEstimate($w, cart, opts = {}) {
  _cartPageCart = cart;
  const storage = opts.storage ?? await _defaultStorage();
  try {
    await _render($w, cart, CART_ELEMENTS, storage);
  } catch (err) {
    console.warn('[CartShippingEstimate] update error:', err?.message ?? err);
  }
}

// ── Public API: Side Cart ──────────────────────────────────────────────────────

/**
 * Initialize the shipping estimate row in the Side Cart.
 * Wires the ZIP submit button once and renders the initial estimate.
 *
 * @param {Function}   $w
 * @param {Object|null} cart
 * @param {object}     [opts]
 * @param {object}     [opts.storage]
 */
export async function initSideCartShippingEstimate($w, cart, opts = {}) {
  _sideCartCart = cart;
  const storage = opts.storage ?? await _defaultStorage();

  try {
    $w(SIDE_CART_ELEMENTS.zipBtn).onClick(() =>
      _handleZipSubmit($w, _sideCartCart, SIDE_CART_ELEMENTS, storage),
    );
  } catch (_) {}

  try {
    await _render($w, cart, SIDE_CART_ELEMENTS, storage);
  } catch (err) {
    console.warn('[CartShippingEstimate] sideCart init error:', err?.message ?? err);
    _collapseOrHide($w, SIDE_CART_ELEMENTS.row);
  }
}

/**
 * Update the shipping estimate row in the Side Cart when the cart changes.
 *
 * @param {Function}   $w
 * @param {Object|null} cart
 * @param {object}     [opts]
 * @param {object}     [opts.storage]
 */
export async function updateSideCartShippingEstimate($w, cart, opts = {}) {
  _sideCartCart = cart;
  const storage = opts.storage ?? await _defaultStorage();
  try {
    await _render($w, cart, SIDE_CART_ELEMENTS, storage);
  } catch (err) {
    console.warn('[CartShippingEstimate] sideCart update error:', err?.message ?? err);
  }
}
