/**
 * @module ShippingWidget
 * @description Product page shipping estimate widget. Accepts a destination zip,
 * calls getShippingEstimate, and renders rate options in a repeater.
 *
 * CF-o0va
 *
 * Elements expected on the Product Page:
 *   #shippingEstimateSection  — outer container
 *   #shippingZipInput         — text input for destination zip
 *   #shippingCalculateBtn     — button to trigger calculation
 *   #shippingOptionsSection   — container shown after successful fetch
 *   #shippingOptionsRepeater  — repeater for rate options
 *   #shippingLoadingText      — Text element shown while API is in flight
 *   #shippingErrorText        — Text element for validation / API errors
 *   #shippingFreightNote      — Text/box shown when any option requiresFreight
 *   #shippingOriginText       — Text element showing ship-from location
 *   #shippingHandlingNote     — Text/box shown when handlingFee_usd > 0
 *
 * Repeater item elements:
 *   #shippingOptionTitle      — carrier + service name
 *   #shippingOptionCost       — formatted cost
 */
import { getShippingEstimate } from 'backend/shippingIntelligence.web';
import { logError } from 'backend/errorMonitoring.web';

const STORAGE_KEY = 'cf_zip';
const ORIGIN_TEXT = 'Ships from Hendersonville, NC';

// ── Validation ───────────────────────────────────────────────────────────────

export function isValidZip(zip) {
  if (zip == null) return false;
  return /^\d{5}$/.test(zip);
}

// ── safeGet ──────────────────────────────────────────────────────────────────

function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (err) {
    return null;
  }
}

// ── initShippingWidget ───────────────────────────────────────────────────────

export async function initShippingWidget($wFn, productId, opts = {}) {
  const storage = opts.storage ?? (await import('wix-storage-frontend').then(m => m.local));

  // Origin text
  const originEl = safeGet($wFn, '#shippingOriginText');
  if (originEl) originEl.text = ORIGIN_TEXT;

  // Pre-populate zip from storage
  const savedZip = storage.getItem(STORAGE_KEY);
  const zipInput = safeGet($wFn, '#shippingZipInput');
  if (zipInput && savedZip) zipInput.value = savedZip;

  // Hide error on init
  const errorEl = safeGet($wFn, '#shippingErrorText');
  if (errorEl) errorEl.hide();

  // Wire calculate button
  const btn = safeGet($wFn, '#shippingCalculateBtn');
  if (btn) btn.onClick(handleCalculate);

  // Wire Enter key on zip input
  if (zipInput) {
    zipInput.onKeyPress(event => {
      if (event?.key === 'Enter') handleCalculate();
    });
  }

  async function handleCalculate() {
    const zip = safeGet($wFn, '#shippingZipInput')?.value || '';
    const errEl = safeGet($wFn, '#shippingErrorText');
    const loadEl = safeGet($wFn, '#shippingLoadingText');

    // Hide previous error
    if (errEl) errEl.hide();

    if (!isValidZip(zip)) {
      if (errEl) {
        errEl.text = 'Please enter a valid 5-digit zip code.';
        errEl.show();
      }
      return;
    }

    if (loadEl) loadEl.show();

    try {
      const result = await getShippingEstimate(productId, zip);

      if (!result.success) {
        const msg = result.error === 'invalid_zip'
          ? 'Please enter a valid zip code for your delivery address.'
          : (result.error || 'Unable to calculate shipping. Please try again.');
        if (errEl) { errEl.text = msg; errEl.show(); }
        return;
      }

      storage.setItem(STORAGE_KEY, zip);
      renderResults($wFn, result);

      const optionsSection = safeGet($wFn, '#shippingOptionsSection');
      if (optionsSection) optionsSection.show();
    } catch (err) {
      logError({ context: 'ShippingWidget.calculate', error: err, productId, zip });
      if (errEl) {
        errEl.text = 'Unable to calculate shipping. Please try again.';
        errEl.show();
      }
    } finally {
      if (loadEl) loadEl.hide();
    }
  }
}

// ── renderResults ────────────────────────────────────────────────────────────

function renderResults($wFn, result) {
  const options = result.options || [];

  // Freight note
  const hasFreight = options.some(o => o.requiresFreight);
  const freightNote = safeGet($wFn, '#shippingFreightNote');
  if (freightNote) {
    if (hasFreight) freightNote.show(); else freightNote.hide();
  }

  // Handling fee note
  const handlingNote = safeGet($wFn, '#shippingHandlingNote');
  if (handlingNote) {
    if (result.handlingFee_usd > 0) handlingNote.show(); else handlingNote.hide();
  }

  // Repeater — onItemReady BEFORE .data
  const repeater = safeGet($wFn, '#shippingOptionsRepeater');
  if (!repeater) return;

  repeater.onItemReady(($item, itemData) => {
    const titleEl = $item('#shippingOptionTitle');
    const costEl = $item('#shippingOptionCost');

    if (titleEl) {
      titleEl.text = itemData.isEstimate
        ? `${itemData.title} (estimated)`
        : itemData.title;
    }

    if (costEl) {
      const cost = Number(itemData.cost ?? 0);
      costEl.text = `$${(Number.isFinite(cost) ? cost : 0).toFixed(2)}`;
    }
  });

  repeater.data = options.map((option, idx) => ({
    _id: `option-${idx}`,
    ...option,
  }));
}
