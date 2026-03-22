/**
 * @module ShippingIntelligence
 * @description Product page frontend wiring for the Shipping Intelligence Layer.
 *
 * Reads stored postal code (wix-storage-frontend session), calls the backend
 * getShippingEstimate webMethod, and updates all product page shipping elements.
 * Shows white-glove upsell banner when a local delivery zone is detected.
 *
 * CF-ybcm: Shipping Intelligence Layer — Velo frontend product page elements
 *
 * Editor nicknames (Product Page):
 *   shippingEstimateBox     → #shippingEstimateBox     (Box — hidden until data loads)
 *   deliveryEstimateText    → #deliveryEstimateText     (Text — 'Estimated delivery: Wed Apr 2')
 *   deliveryZoneText        → #deliveryZoneText         (Text — 'Zone 1 (within 50 mi)')
 *   shippingRateBadge       → #shippingRateBadge        (Text — 'Free local delivery')
 *   shippingEstimateSpinner → #shippingEstimateSpinner  (Box — loading state)
 *   shippingEstimateError   → #shippingEstimateError    (Text — error message, hidden by default)
 *   whiteGloveUpsellBanner  → #whiteGloveUpsellBanner   (Box — upgrade CTA, hidden by default)
 *   whiteGloveUpsellText    → #whiteGloveUpsellText     (Text — upsell copy)
 *   whiteGloveLearnMoreBtn  → #whiteGloveLearnMoreBtn   (Button — opens modal)
 *   whiteGloveModal         → #whiteGloveModal          (Box — modal overlay, hidden by default)
 *   whiteGloveModalClose    → #whiteGloveModalClose     (Button — close X)
 *   whiteGloveModalContent  → #whiteGloveModalContent   (Text — in-home setup description)
 *
 * @example
 *   // In Product Page code (inside $w.onReady + dataset onReady):
 *   import { initShippingIntelligence } from 'public/ShippingIntelligence';
 *   $w.onReady(() => {
 *     $w('#productDataset').onReady(() => {
 *       const product = $w('#productDataset').getCurrentItem();
 *       initShippingIntelligence($w, product?._id);
 *     });
 *   });
 */

import { getShippingEstimate } from 'backend/shippingIntelligence.web';
import { logError }             from 'backend/errorMonitoring.web';
import { setupAccessibleDialog } from 'public/a11yHelpers';
import { session }              from 'wix-storage-frontend';

const POSTAL_CODE_KEY = 'cf_postal_code';

// ── Pure helpers ───────────────────────────────────────────────────────────

/** Returns true if `o` is a local-delivery or highlighted option. */
function isLocalOption(o) {
  return o.code.startsWith('local-delivery-') || o.highlight === true;
}

/**
 * Returns true when the options list contains at least one local delivery option.
 * Local zone is indicated by a code starting with 'local-delivery-' or highlight:true.
 *
 * @param {Array<{code: string, highlight: boolean}>} options
 * @returns {boolean}
 */
export function isLocalZone(options) {
  return options.some(isLocalOption);
}

/**
 * Returns the primary option to display: the first highlighted option, or the first
 * option overall. Returns null when the array is empty.
 *
 * @param {Array} options
 * @returns {Object|null}
 */
export function getPrimaryOption(options) {
  if (!options.length) return null;
  return options.find(o => o.highlight) ?? options[0];
}

// ── DOM helpers ────────────────────────────────────────────────────────────

// Intentionally silent: Wix $w() throws for unknown selectors at runtime.
// Returning null lets callers degrade gracefully without polluting logs for
// every optional element that happens not to be on the current page variant.
function safeGet($wFn, sel) {
  try { return $wFn(sel) || null; } catch (_) { return null; }
}

function showError($wFn, msg) {
  const errEl = safeGet($wFn, '#shippingEstimateError');
  if (!errEl) return;
  if (msg) errEl.text = msg;
  errEl.show();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise the shipping intelligence widget on a Product Page.
 *
 * 1. Reads stored postal code from session storage.
 * 2. Shows loading spinner; hides estimate box.
 * 3. Calls getShippingEstimate(productId, postalCode).
 * 4. On success: populates elements, hides spinner, shows box.
 *    If local zone detected: shows white-glove upsell banner.
 * 5. Wires whiteGloveModal via setupAccessibleDialog.
 * 6. On error: hides spinner, shows error element with message.
 *
 * @param {Function} $wFn      - Wix $w selector function
 * @param {string}   productId - Wix catalog product ID
 * @param {Object}  [opts]
 * @param {Object}  [opts.storage] - Injectable wix-storage-frontend session (for testing)
 */
export async function initShippingIntelligence($wFn, productId, opts = {}) {
  const storage = opts.storage ?? session;

  // Wire accessible modal regardless of whether data loads — elements may be
  // pre-hidden by design and should still respond to keyboard navigation.
  let dialog = { open: () => {}, close: () => {} };
  try {
    dialog = setupAccessibleDialog($wFn, {
      panelId: '#whiteGloveModal',
      closeId: '#whiteGloveModalClose',
    });
  } catch (err) {
    logError({ message: err?.message ?? String(err), context: 'ShippingIntelligence.dialogSetup', stack: err?.stack });
  }

  const learnMoreBtn = safeGet($wFn, '#whiteGloveLearnMoreBtn');
  if (learnMoreBtn) learnMoreBtn.onClick(() => dialog.open());

  // Guard: productId required
  if (!productId) { showError($wFn); return; }

  // Read stored postal code
  const postalCode = storage.getItem(POSTAL_CODE_KEY);
  if (!postalCode) { showError($wFn); return; }

  // Show loading state
  const spinner = safeGet($wFn, '#shippingEstimateSpinner');
  const box     = safeGet($wFn, '#shippingEstimateBox');
  if (spinner) spinner.show();
  if (box) box.hide();

  try {
    const result = await getShippingEstimate(productId, postalCode);

    if (!result.success || !result.options?.length) {
      showError($wFn, result.error || 'Unable to load shipping estimate. Please try again.');
      return;
    }

    const primary = getPrimaryOption(result.options);

    // Populate text elements
    const deliveryText = safeGet($wFn, '#deliveryEstimateText');
    if (deliveryText) deliveryText.text = primary.deliveryTime;

    const zoneText = safeGet($wFn, '#deliveryZoneText');
    if (zoneText) zoneText.text = primary.title;

    const badge = safeGet($wFn, '#shippingRateBadge');
    if (badge) {
      if (primary.badge) { badge.text = primary.badge; badge.show(); }
      else               { badge.hide(); }
    }

    // White-glove upsell
    const upsellBanner = safeGet($wFn, '#whiteGloveUpsellBanner');
    if (upsellBanner) {
      if (isLocalZone(result.options)) {
        const localOpt = result.options.find(isLocalOption);
        const upsellText = safeGet($wFn, '#whiteGloveUpsellText');
        if (upsellText && localOpt?.upsellMessage) upsellText.text = localOpt.upsellMessage;
        upsellBanner.show();
      } else {
        upsellBanner.hide();
      }
    }

    // Reveal result panel
    if (box) box.show();
  } catch (err) {
    logError({ message: err?.message ?? String(err), context: 'ShippingIntelligence.init', stack: err?.stack });
    showError($wFn, 'Unable to load shipping estimate. Please try again.');
  } finally {
    if (spinner) spinner.hide();
  }
}
