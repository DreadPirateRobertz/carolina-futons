/**
 * @module OrderTracker
 * @description Velo frontend module for the Order Tracking page (/order-tracking).
 *
 * Customers enter their order number + email to look up live order status.
 * Calls the orderTracking.web.js backend and wires all result elements.
 *
 * CF-vp8k: Order Status Tracker Widget — Velo frontend for Order Tracking page
 *
 * Editor nicknames (Order Tracking page):
 *   orderTrackSection     → #orderTrackSection     (Box — page container)
 *   orderLookupForm       → #orderLookupForm        (Box — lookup form wrapper)
 *   orderNumberInput      → #orderNumberInput       (TextInput — order number)
 *   orderEmailInput       → #orderEmailInput        (TextInput — email)
 *   orderLookupBtn        → #orderLookupBtn         (Button — submit lookup)
 *   orderLookupError      → #orderLookupError       (Text — hidden, shown on error)
 *   orderLookupSpinner    → #orderLookupSpinner     (Box — loading state)
 *   orderResultSection    → #orderResultSection     (Box — hidden until result)
 *   orderStatusBadge      → #orderStatusBadge       (Box — color-coded status)
 *   orderStatusText       → #orderStatusText        (Text — status label)
 *   orderEstimatedDelivery → #orderEstimatedDelivery (Text — estimated delivery date)
 *   orderCarrierText      → #orderCarrierText       (Text — carrier name)
 *   orderTrackingNumber   → #orderTrackingNumber    (Text — tracking number)
 *   orderTrackingLink     → #orderTrackingLink      (Button — opens carrier URL)
 *   orderItemsRepeater    → #orderItemsRepeater     (Repeater — line items)
 *   orderProgressBar      → #orderProgressBar       (Box — 4-step progress indicator)
 *   orderStep1            → #orderStep1             (Box — Ordered)
 *   orderStep2            → #orderStep2             (Box — Label Created)
 *   orderStep3            → #orderStep3             (Box — Shipped/In Transit)
 *   orderStep4            → #orderStep4             (Box — Delivered)
 *
 * Per-item in orderItemsRepeater:
 *   orderItemName  → #orderItemName  (Text — product name)
 *   orderItemQty   → #orderItemQty   (Text — quantity)
 *   orderItemPrice → #orderItemPrice (Text — formatted price)
 *
 * @example
 *   // In Order Tracking page code:
 *   import { initOrderTracker } from 'public/OrderTracker';
 *   $w.onReady(async () => {
 *     const { clearResult } = await initOrderTracker($w);
 *   });
 */

import { lookupOrder } from 'backend/orderTracking.web';
import { logError }    from 'backend/errorMonitoring.web';

const CSS_STEP_ACTIVE = 'order-step-active';

// ── Carrier URL builders ───────────────────────────────────────────────────

const CARRIER_URLS = {
  UPS:   tn => `https://www.ups.com/track?tracknum=${tn}`,
  FEDEX: tn => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  USPS:  tn => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`,
};

// Returns null for unknown carriers so the tracking link is hidden rather than
// pointing to a wrong carrier's site.
function buildCarrierUrl(carrier, trackingNumber) {
  const builder = CARRIER_URLS[(carrier || '').toUpperCase()];
  return builder ? builder(trackingNumber) : null;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

const STEP_MAP = {
  NOT_FULFILLED: 1,
  LABEL_CREATED: 2,
  PICKED_UP:     3,
  IN_TRANSIT:    3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED:     4,
};

/**
 * Returns the number of progress bar steps (1–4) that should be active
 * for the given fulfillmentStatus.
 *
 * @param {string} fulfillmentStatus
 * @returns {number} 1–4
 */
export function getActiveSteps(fulfillmentStatus) {
  return STEP_MAP[fulfillmentStatus] ?? 1;
}

// ── DOM helpers ────────────────────────────────────────────────────────────

// Intentionally silent: Wix $w() throws for unknown selectors at runtime.
// Returning null lets callers degrade gracefully without polluting logs for
// every optional element that happens not to be on the current page variant.
function safeGet($wFn, sel) {
  try { return $wFn(sel) || null; } catch (_) { return null; }
}

function showError($wFn, msg) {
  const el = safeGet($wFn, '#orderLookupError');
  if (!el) return;
  if (msg) el.text = msg;
  el.show();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise the Order Tracker widget on the Order Tracking page.
 *
 * 1. Resets initial visibility (hides error, spinner, result section).
 * 2. Wires button onClick and input onKeyPress for form submission.
 * 3. On submit: validates inputs, shows spinner, calls lookupOrder().
 * 4. On success: renders result, progress bar, line items; shows orderResultSection.
 * 5. On error: shows orderLookupError with message; calls logError on exceptions.
 *
 * @param {Function} $wFn - Wix $w selector function
 * @returns {Promise<{ clearResult: Function }>}
 */
export async function initOrderTracker($wFn) {
  // ── Initial state ──────────────────────────────────────────────────
  safeGet($wFn, '#orderLookupError')?.hide();
  safeGet($wFn, '#orderLookupSpinner')?.hide();
  safeGet($wFn, '#orderResultSection')?.hide();

  // ── Accessibility labels ────────────────────────────────────────────
  const numInput = safeGet($wFn, '#orderNumberInput');
  if (numInput?.accessibility) numInput.accessibility.ariaLabel = 'Order number';
  const emailInput = safeGet($wFn, '#orderEmailInput');
  if (emailInput?.accessibility) emailInput.accessibility.ariaLabel = 'Email address used for this order';

  // ── Submit handler ─────────────────────────────────────────────────
  async function handleSubmit() {
    const orderNumber = (safeGet($wFn, '#orderNumberInput')?.value ?? '').trim();
    const email       = (safeGet($wFn, '#orderEmailInput')?.value ?? '').trim();

    // Client-side validation
    if (!orderNumber) {
      showError($wFn, 'Please enter your order number.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError($wFn, 'Please enter a valid email address.');
      return;
    }

    safeGet($wFn, '#orderLookupSpinner')?.show();
    safeGet($wFn, '#orderLookupError')?.hide();

    try {
      const result = await lookupOrder(orderNumber, email);

      if (!result?.success) {
        showError($wFn, result?.error || 'Order not found. Please check your details.');
        return;
      }

      renderResult($wFn, result);
      safeGet($wFn, '#orderLookupForm')?.hide();
      safeGet($wFn, '#orderResultSection')?.show();
    } catch (err) {
      logError({ message: err?.message ?? String(err), context: 'OrderTracker.lookupOrder', stack: err?.stack });
      showError($wFn, 'Something went wrong. Please try again.');
    } finally {
      safeGet($wFn, '#orderLookupSpinner')?.hide();
    }
  }

  // ── Wire form ──────────────────────────────────────────────────────
  safeGet($wFn, '#orderLookupBtn')?.onClick(handleSubmit);

  safeGet($wFn, '#orderNumberInput')?.onKeyPress(e => {
    if (e.key === 'Enter') handleSubmit();
  });
  safeGet($wFn, '#orderEmailInput')?.onKeyPress(e => {
    if (e.key === 'Enter') handleSubmit();
  });

  // ── clearResult ────────────────────────────────────────────────────
  async function clearResult() {
    safeGet($wFn, '#orderResultSection')?.hide();
    safeGet($wFn, '#orderLookupForm')?.show();
    const numEl = safeGet($wFn, '#orderNumberInput');
    if (numEl) numEl.value = '';
    const emailEl = safeGet($wFn, '#orderEmailInput');
    if (emailEl) emailEl.value = '';
  }

  return { clearResult };
}

// ── Rendering helpers ──────────────────────────────────────────────────────

function renderResult($wFn, data) {
  const { order, shipping, lineItems } = data;

  // Status
  const statusText = safeGet($wFn, '#orderStatusText');
  if (statusText) statusText.text = order.status;

  const statusBadge = safeGet($wFn, '#orderStatusBadge');
  if (statusBadge?.accessibility) statusBadge.accessibility.ariaLabel = `Order status: ${order.status}`;

  // Carrier + tracking
  const carrierEl = safeGet($wFn, '#orderCarrierText');
  if (carrierEl) carrierEl.text = shipping.carrier || '';

  const trackNumEl = safeGet($wFn, '#orderTrackingNumber');
  if (trackNumEl) trackNumEl.text = shipping.trackingNumber || '';

  const trackLink = safeGet($wFn, '#orderTrackingLink');
  if (trackLink) {
    const carrierUrl = shipping.trackingNumber
      ? buildCarrierUrl(shipping.carrier, shipping.trackingNumber)
      : null;
    if (carrierUrl) {
      trackLink.link = carrierUrl;
      trackLink.target = '_blank';
      trackLink.show();
    } else {
      trackLink.hide();
    }
  }

  // Estimated delivery
  const estEl = safeGet($wFn, '#orderEstimatedDelivery');
  if (estEl) {
    if (shipping.estimatedDelivery) {
      const d = new Date(shipping.estimatedDelivery);
      estEl.text = `Estimated delivery: ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    } else {
      estEl.text = 'Estimated delivery: Pending';
    }
  }

  // Progress bar
  renderProgressBar($wFn, order.fulfillmentStatus);

  // Line items
  renderLineItems($wFn, lineItems || []);
}

function renderProgressBar($wFn, fulfillmentStatus) {
  const active = getActiveSteps(fulfillmentStatus);
  for (let i = 1; i <= 4; i++) {
    const el = safeGet($wFn, `#orderStep${i}`);
    if (!el) continue;
    el.removeCssClass(CSS_STEP_ACTIVE);
    if (i <= active) {
      el.addCssClass(CSS_STEP_ACTIVE);
      if (el.accessibility) el.accessibility.ariaCurrent = 'step';
    } else {
      if (el.accessibility) el.accessibility.ariaCurrent = '';
    }
  }
}

function renderLineItems($wFn, items) {
  const repeater = safeGet($wFn, '#orderItemsRepeater');
  if (!repeater || !items.length) return;

  // onItemReady MUST be registered before .data (Wix Velo requirement)
  repeater.onItemReady(($item, itemData) => {
    const nameEl = safeGet($item, '#orderItemName');
    if (nameEl) nameEl.text = itemData.name || '';

    const qtyEl = safeGet($item, '#orderItemQty');
    if (qtyEl) qtyEl.text = `Qty: ${itemData.quantity ?? 1}`;

    const priceEl = safeGet($item, '#orderItemPrice');
    if (priceEl) priceEl.text = `$${Number(itemData.price ?? 0).toFixed(2)}`;
  });

  repeater.data = items.map((item, idx) => ({ _id: `item-${idx}`, ...item }));
}
