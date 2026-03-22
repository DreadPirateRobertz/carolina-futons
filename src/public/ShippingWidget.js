/**
 * @module ShippingWidget
 * @description Product page shipping estimate widget. Accepts a destination zip,
 * calls getShippingEstimate, and renders rate options in a repeater.
 *
 * CF-o0va
 *
 * Elements expected on the Product Page:
 *   #shippingZipInput         — text input for destination zip
 *   #shippingCalculateBtn     — button to trigger calculation
 *   #shippingOptionsSection   — container shown after successful fetch
 *   #shippingOptionsRepeater  — repeater for rate options
 *   #shippingLoadingText      — Text element shown while API is in flight
 *   #shippingErrorText        — Text element for validation / API errors
 *   #shippingFreightNote      — shown when any option requiresFreight
 *   #shippingOriginText       — static ship-from location text
 *   #shippingHandlingNote     — shown when handlingFee_usd > 0
 *
 * Repeater item elements (both optional — widget null-guards each):
 *   #shippingOptionTitle      — carrier + service name (with "(estimated)" suffix when isEstimate)
 *   #shippingOptionCost       — formatted cost, e.g. "$49.99"
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
// Returns null when the element is not found (normal on pages where the widget
// is partially rendered). Warns on unexpected runtime errors so they are not
// silently swallowed.

function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (err) {
    const msg = err?.message ?? '';
    if (!msg.includes('not found') && !msg.includes('Cannot read'))
      console.warn('[ShippingWidget] safeGet unexpected error:', sel, msg);
    return null;
  }
}

// ── initShippingWidget ───────────────────────────────────────────────────────
/**
 * Initialize the shipping estimate widget on the Product Page.
 *
 * @param {Function} $wFn  - Wix $w selector function (injectable for testing)
 * @param {string}   productId - Wix product _id to pass to getShippingEstimate
 * @param {object}   [opts]
 * @param {object}   [opts.storage] - Storage adapter with getItem/setItem
 *   (defaults to wix-storage-frontend `local`). Inject in tests via makeStorage().
 */
export async function initShippingWidget($wFn, productId, opts = {}) {
  if (!productId) {
    logError({
      message: 'ShippingWidget: productId missing at init — widget not wired',
      context: 'ShippingWidget.init',
    });
    return;
  }

  // Dynamic import guarded: if wix-storage-frontend is unavailable (e.g. outside
  // Wix runtime) fall back to a no-op stub so zip caching degrades gracefully.
  const NOOP_STORAGE = { getItem: () => null, setItem: () => {} };
  let storage;
  try {
    storage = opts.storage ?? (await import('wix-storage-frontend').then(m => m.local));
  } catch {
    storage = NOOP_STORAGE;
  }

  const originEl = safeGet($wFn, '#shippingOriginText');
  if (originEl) originEl.text = ORIGIN_TEXT;

  let savedZip = null;
  try { savedZip = storage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  const zipInput = safeGet($wFn, '#shippingZipInput');
  if (zipInput && savedZip) zipInput.value = savedZip;

  const errorEl = safeGet($wFn, '#shippingErrorText');
  if (errorEl) errorEl.hide();

  let inflight = false;

  async function handleCalculate() {
    if (inflight) return;
    const zip = safeGet($wFn, '#shippingZipInput')?.value || '';
    const errEl = safeGet($wFn, '#shippingErrorText');
    const loadEl = safeGet($wFn, '#shippingLoadingText');

    if (errEl) errEl.hide();

    if (!isValidZip(zip)) {
      if (errEl) {
        errEl.text = 'Please enter a valid 5-digit zip code.';
        errEl.show();
      }
      return;
    }

    inflight = true;
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

      renderResults($wFn, result);
      try { storage.setItem(STORAGE_KEY, zip); } catch { /* storage unavailable — zip caching degrades gracefully */ }

      const optionsSection = safeGet($wFn, '#shippingOptionsSection');
      if (optionsSection) optionsSection.show();
    } catch (err) {
      logError({
        message: err?.message ?? String(err),
        context: 'ShippingWidget.calculate',
        stack: err?.stack,
      });
      if (errEl) {
        errEl.text = 'Unable to calculate shipping. Please try again.';
        errEl.show();
      }
    } finally {
      inflight = false;
      if (loadEl) loadEl.hide();
    }
  }

  const btn = safeGet($wFn, '#shippingCalculateBtn');
  if (btn) btn.onClick(handleCalculate);

  if (zipInput) {
    zipInput.onKeyPress(event => {
      if (event?.key === 'Enter') handleCalculate();
    });
  }
}

// ── renderResults ────────────────────────────────────────────────────────────

function renderResults($wFn, result) {
  const options = Array.isArray(result.options) ? result.options : [];

  const hasFreight = options.some(o => o.requiresFreight);
  const freightNote = safeGet($wFn, '#shippingFreightNote');
  if (freightNote) {
    if (hasFreight) freightNote.show(); else freightNote.hide();
  }

  const handlingNote = safeGet($wFn, '#shippingHandlingNote');
  if (handlingNote) {
    if (result.handlingFee_usd > 0) handlingNote.show(); else handlingNote.hide();
  }

  const repeater = safeGet($wFn, '#shippingOptionsRepeater');
  if (!repeater) return;

  // onItemReady MUST be registered before setting .data — Wix fires it synchronously
  // when .data is assigned; registering after means items render blank.
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
