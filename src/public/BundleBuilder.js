/**
 * @module BundleBuilder
 * @description Bundle Builder widget for product detail pages.
 * Loads pre-configured Frame+Mattress+Cover bundles for the current frame
 * product, renders a step-picker UI with live price updates, and adds the
 * selected bundle to cart via bundleService.
 *
 * Elements (set in Wix editor):
 *   #bundleBuilderSection     — Outer container (hidden until bundles load)
 *   #bundleOptionRepeater     — Repeater: one card per available bundle
 *     #bundleOptionName       — Text: bundle display name
 *     #bundleOptionPrice      — Text: formatted bundle price
 *     #bundleOptionSavings    — Text: savings badge ("Save $N")
 *     #selectBundleBtn        — Button: "Select" — triggers selectBundle
 *   #bundleSelectedSummary    — Container: live-update area (shown on selection)
 *   #bundleSelectedName       — Text: selected bundle name
 *   #bundleSelectedPrice      — Text: live bundle price
 *   #bundleSelectedSavings    — Text: live savings display
 *   #addBundleBtn             — Button: "Add Bundle to Cart"
 *   #bundleBuilderLoading     — Loading indicator
 *   #bundleBuilderError       — Error text element
 *   #bundleAddedConfirmation  — Success message (shown after add)
 *   #noBundlesMessage         — Shown when no bundles available for frame
 *
 * Usage (from a PDP page controller):
 *   import { initBundleBuilder } from 'public/BundleBuilder';
 *   import { getBundlesByFrame, addBundle } from 'backend/bundleService.web';
 *   $w.onReady(async () => {
 *     await initBundleBuilder($w, product.id, { getBundlesByFrame, addBundle });
 *   });
 *
 * CF-eqc5.2
 */
import { getBundlesByFrame as _defaultGetBundlesByFrame, addBundle as _defaultAddBundle }
  from 'backend/bundleService.web';

// ── Module state (reset on each initBundleBuilder call) ───────────────────────

let _selectedBundle = null;
let _availableBundles = [];

// ── safeGet ───────────────────────────────────────────────────────────────────

function safeGet($w, sel) {
  try {
    return $w(sel) || null;
  } catch (err) {
    const msg = err?.message ?? '';
    if (!msg.includes('not found') && !msg.includes('Cannot read'))
      console.warn('[BundleBuilder] safeGet unexpected error:', sel, msg);
    return null;
  }
}

// ── Pure formatters ───────────────────────────────────────────────────────────

/**
 * Format a price for display. Whole dollars omit ".00"; fractional show 2dp.
 * Returns '' for non-positive or non-finite values.
 *
 * @param {number|string} price
 * @returns {string} e.g. "$499" or "$499.99" or ''
 */
export function formatBundlePrice(price) {
  const p = parseFloat(price);
  if (!Number.isFinite(p) || p <= 0) return '';
  return p % 1 === 0 ? `$${p}` : `$${p.toFixed(2)}`;
}

/**
 * Format a savings badge string. Returns '' when savings are zero or absent.
 *
 * @param {number} savings - Dollar savings
 * @returns {string} e.g. "Save $50" or ''
 */
export function formatSavingsBadge(savings) {
  const s = parseFloat(savings);
  if (!Number.isFinite(s) || s <= 0) return '';
  return `Save $${s % 1 === 0 ? s : s.toFixed(2)}`;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showLoading($w, visible) {
  const el = safeGet($w, '#bundleBuilderLoading');
  if (!el) return;
  visible ? el.show() : el.hide();
}

function showError($w, message) {
  const el = safeGet($w, '#bundleBuilderError');
  if (!el) return;
  el.text = message;
  el.show();
}

function hideError($w) {
  const el = safeGet($w, '#bundleBuilderError');
  if (!el) return;
  el.hide();
  el.text = '';
}

// ── Step 1: selectBundle — updates live price display ─────────────────────────

/**
 * Mark a bundle as selected and refresh the live price area.
 *
 * @param {function} $w - Wix element selector
 * @param {Object} bundle - Bundle record from getBundlesByFrame
 */
export function selectBundle($w, bundle) {
  _selectedBundle = bundle;

  const nameEl    = safeGet($w, '#bundleSelectedName');
  const priceEl   = safeGet($w, '#bundleSelectedPrice');
  const savingsEl = safeGet($w, '#bundleSelectedSavings');
  const summaryEl = safeGet($w, '#bundleSelectedSummary');
  const addBtn    = safeGet($w, '#addBundleBtn');

  if (nameEl)    nameEl.text    = bundle.displayName || '';
  if (priceEl)   priceEl.text   = formatBundlePrice(bundle.bundlePrice);
  if (savingsEl) savingsEl.text = formatSavingsBadge(bundle.savings);
  if (summaryEl) summaryEl.show();
  if (addBtn)    addBtn.enable();
}

// ── Step 2: renderBundleOptions — populate the picker repeater ────────────────

/**
 * Populate the bundle option repeater and wire select buttons.
 *
 * @param {function} $w - Wix element selector
 * @param {Object[]} bundles - Bundles from getBundlesByFrame
 */
export function renderBundleOptions($w, bundles) {
  const repeater = safeGet($w, '#bundleOptionRepeater');
  if (!repeater) return;

  repeater.data = bundles.map(b => ({
    _id: b._id,
    displayName: b.displayName,
    bundlePrice: b.bundlePrice,
    savings: b.savings,
  }));

  repeater.onItemReady(($item, itemData) => {
    const bundle = bundles.find(b => b._id === itemData._id);

    const nameEl    = safeGet($item, '#bundleOptionName');
    const priceEl   = safeGet($item, '#bundleOptionPrice');
    const savingsEl = safeGet($item, '#bundleOptionSavings');
    const btn       = safeGet($item, '#selectBundleBtn');

    if (nameEl)    nameEl.text    = itemData.displayName || '';
    if (priceEl)   priceEl.text   = formatBundlePrice(itemData.bundlePrice);
    if (savingsEl) savingsEl.text = formatSavingsBadge(itemData.savings);

    if (btn && bundle) {
      btn.label = 'Select';
      btn.onClick(() => selectBundle($w, bundle));
    }
  });
}

// ── Step 3: handleAddToCart ───────────────────────────────────────────────────

/**
 * Add the currently selected bundle to the cart.
 *
 * @param {function} $w - Wix element selector
 * @param {Object} [deps] - Injectable dependencies for testing
 * @param {function} [deps.addBundle] - addBundle web method
 */
export async function handleAddToCart($w, deps = {}) {
  const addBundleFn = deps.addBundle || _defaultAddBundle;

  if (!_selectedBundle) {
    showError($w, 'Please select a bundle option first.');
    return;
  }

  hideError($w);
  showLoading($w, true);

  const addBtn = safeGet($w, '#addBundleBtn');
  if (addBtn) addBtn.disable();

  try {
    const result = await addBundleFn(_selectedBundle._id);

    if (!result.success) {
      showError($w, result.error || 'Could not add bundle to cart. Please try again.');
      return;
    }

    const confirmEl = safeGet($w, '#bundleAddedConfirmation');
    if (confirmEl) confirmEl.show();

    const sectionEl = safeGet($w, '#bundleBuilderSection');
    if (sectionEl) sectionEl.collapse();
  } catch (err) {
    console.error('[BundleBuilder] handleAddToCart failed:', err);
    showError($w, 'Something went wrong. Please try again.');
  } finally {
    showLoading($w, false);
    if (addBtn) addBtn.enable();
  }
}

// ── initBundleBuilder — main entry point ──────────────────────────────────────

/**
 * Initialize the Bundle Builder widget on a PDP.
 * Loads active bundles for the given frame product, renders the step picker,
 * and wires up the Add to Cart button.
 *
 * @param {function} $w - Wix element selector
 * @param {string} frameProductId - Wix product ID of the frame on this PDP
 * @param {Object} [deps] - Injectable dependencies for testing
 * @param {function} [deps.getBundlesByFrame] - Backend web method
 * @param {function} [deps.addBundle] - Backend web method
 */
export async function initBundleBuilder($w, frameProductId, deps = {}) {
  const getBundlesByFrameFn = deps.getBundlesByFrame || _defaultGetBundlesByFrame;
  const addBundleFn         = deps.addBundle         || _defaultAddBundle;

  // Reset state
  _selectedBundle = null;
  _availableBundles = [];

  // Disable add button until a bundle is selected
  const addBtn = safeGet($w, '#addBundleBtn');
  if (addBtn) addBtn.disable();

  // Wire add to cart button
  if (addBtn) {
    addBtn.onClick(() => handleAddToCart($w, { addBundle: addBundleFn }));
  }

  if (!frameProductId) {
    return;
  }

  showLoading($w, true);
  hideError($w);

  try {
    const result = await getBundlesByFrameFn(frameProductId);

    if (!result.success) {
      showError($w, result.error || 'Could not load bundle options.');
      return;
    }

    _availableBundles = result.bundles || [];

    if (_availableBundles.length === 0) {
      const noMsg = safeGet($w, '#noBundlesMessage');
      if (noMsg) noMsg.show();
      return;
    }

    renderBundleOptions($w, _availableBundles);

    const sectionEl = safeGet($w, '#bundleBuilderSection');
    if (sectionEl) sectionEl.expand();
  } catch (err) {
    console.error('[BundleBuilder] initBundleBuilder failed:', err);
    showError($w, 'Could not load bundle options. Please refresh the page.');
  } finally {
    showLoading($w, false);
  }
}
