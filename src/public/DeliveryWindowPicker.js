/**
 * @module DeliveryWindowPicker
 * @description Checkout delivery window selector for white-glove and local delivery.
 *
 * Shows a date/time picker when the customer selects white-glove or local delivery
 * at checkout. Fetches available windows from the backend, renders them grouped
 * by date, and grays out fully-booked slots. Falls back to the legacy
 * "we will contact you" message when no slots are available.
 *
 * CF-5kg: Delivery window picker for white-glove + local delivery at checkout
 *
 * Elements expected on the Checkout page:
 *   #deliveryWindowSection     — Box, full picker container (hidden until triggered)
 *   #deliveryWindowTitle       — Text, section heading
 *   #deliveryWindowLoader      — Box, loading state
 *   #deliveryWindowError       — Text, error/fallback message
 *   #deliveryWindowRepeater    — Repeater, one row per available date
 *   #deliveryWindowConfirm     — Text, confirmation of selected slot
 *
 * Repeater item elements:
 *   #windowDateLabel           — Text, e.g. "Wed, Apr 2"
 *   #windowMorningBtn          — Button, "9:00 AM – 12:00 PM"
 *   #windowAfternoonBtn        — Button, "1:00 PM – 5:00 PM"
 *   #windowMorningFull         — Text, "(Full)" — shown when morning slot unavailable
 *   #windowAfternoonFull       — Text, "(Full)" — shown when afternoon slot unavailable
 */
import { getAvailableDeliveryWindows } from 'backend/deliveryScheduling.web';
import { deliveryWindowConfig } from 'public/sharedTokens.js';

// Module-level state — reset by initDeliveryWindowPicker each call
let _selectedWindow = null;
let _onWindowSelect = null;

const TITLE_TEXT = 'Select a Delivery Window';
const FALLBACK_TEXT = deliveryWindowConfig.noSlotsMessage;

// ── Rate code helpers ──────────────────────────────────────────────────────────

/**
 * Returns true when the given shipping rate code requires a delivery window selection.
 *
 * @param {string|null} code - Shipping rate code, e.g. 'white-glove-zone1'
 * @returns {boolean}
 */
export function isWindowRequiredForCode(code) {
  if (!code || typeof code !== 'string') return false;
  return deliveryWindowConfig.eligibleCodePrefixes.some(prefix => code.startsWith(prefix));
}

/**
 * Maps a shipping rate code to the deliveryType expected by the backend.
 *
 * @param {string} code - Shipping rate code
 * @returns {'white_glove'|'local'|null}
 */
export function deliveryTypeFromCode(code) {
  if (!code) return null;
  if (code.startsWith('white-glove-')) return 'white_glove';
  if (code.startsWith('local-delivery-')) return 'local';
  return null;
}

// ── safeGet / safeCall helpers ────────────────────────────────────────────────

function safeGet($wFn, sel) {
  try { return $wFn(sel) || null; } catch (_) { return null; }
}

function safeCall($wFn, sel, fn) {
  const el = safeGet($wFn, sel);
  if (el) fn(el);
}

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Format a YYYY-MM-DD date string as "Wed, Apr 2".
 * @param {string} dateStr
 * @param {string} dayOfWeek - e.g. 'Wed'
 * @returns {string}
 */
export function formatWindowDate(dateStr, dayOfWeek) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${dayOfWeek}, ${month} ${day}`;
  } catch (_) {
    return dateStr;
  }
}

// ── Group slots by date ───────────────────────────────────────────────────────

/**
 * Group a flat list of slot objects into one entry per date.
 * Each entry has { date, dayOfWeek, morning, afternoon } where each slot is
 * { available, spotsLeft, label, timeSlot }.
 *
 * @param {Array} slots - Raw slots from getAvailableDeliveryWindows
 * @returns {Array}
 */
export function groupSlotsByDate(slots) {
  const byDate = {};
  for (const slot of slots) {
    if (!byDate[slot.date]) {
      byDate[slot.date] = {
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        morning: null,
        afternoon: null,
      };
    }
    byDate[slot.date][slot.timeSlot] = {
      available: slot.available,
      spotsLeft: slot.spotsLeft,
      label: slot.label,
      timeSlot: slot.timeSlot,
    };
  }
  return Object.values(byDate);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialize the delivery window picker in the checkout shipping step.
 * Shows the #deliveryWindowSection, fetches available windows, and renders the picker.
 *
 * @param {Function} $wFn       - Wix $w selector function (injectable for testing)
 * @param {string}   zip        - Customer's destination ZIP code
 * @param {string}   shippingCode - Selected shipping rate code (e.g. 'white-glove-zone1')
 * @param {object}   [opts]
 * @param {Function} [opts.onSelect] - Called with { date, timeSlot, label, deliveryType } on selection
 * @param {Function} [opts.fetcher]  - Override for getAvailableDeliveryWindows (testing)
 */
export async function initDeliveryWindowPicker($wFn, zip, shippingCode, opts = {}) {
  _selectedWindow = null;
  _onWindowSelect = opts.onSelect || null;

  const fetch = opts.fetcher || getAvailableDeliveryWindows;

  safeCall($wFn, '#deliveryWindowTitle', el => { el.text = TITLE_TEXT; });
  safeCall($wFn, '#deliveryWindowError', el => el.hide());
  safeCall($wFn, '#deliveryWindowConfirm', el => el.hide());
  safeCall($wFn, '#deliveryWindowRepeater', el => el.hide());
  safeCall($wFn, '#deliveryWindowLoader', el => el.show());

  // Show the container
  const section = safeGet($wFn, '#deliveryWindowSection');
  if (section) section.show('fade', { duration: 200 });

  try {
    const slots = await fetch(zip || '');

    safeCall($wFn, '#deliveryWindowLoader', el => el.hide());

    if (!Array.isArray(slots) || slots.length === 0) {
      _showFallback($wFn);
      return;
    }

    const grouped = groupSlotsByDate(slots);
    if (grouped.length === 0) {
      _showFallback($wFn);
      return;
    }

    const deliveryType = deliveryTypeFromCode(shippingCode);
    _renderWindowRepeater($wFn, grouped, deliveryType);
  } catch (_) {
    safeCall($wFn, '#deliveryWindowLoader', el => el.hide());
    _showFallback($wFn);
  }
}

/**
 * Hide the delivery window section (called when customer switches to a non-window rate).
 *
 * @param {Function} $wFn
 */
export function hideDeliveryWindowPicker($wFn) {
  _selectedWindow = null;
  safeCall($wFn, '#deliveryWindowSection', el => el.hide());
  safeCall($wFn, '#deliveryWindowConfirm', el => el.hide());
}

/**
 * Return the currently selected delivery window, or null if none selected.
 * @returns {{ date, timeSlot, label, deliveryType }|null}
 */
export function getSelectedDeliveryWindow() {
  return _selectedWindow;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _showFallback($wFn) {
  safeCall($wFn, '#deliveryWindowError', el => {
    el.text = FALLBACK_TEXT;
    el.show();
  });
}

function _renderWindowRepeater($wFn, grouped, deliveryType) {
  const repeater = safeGet($wFn, '#deliveryWindowRepeater');
  if (!repeater) {
    _showFallback($wFn);
    return;
  }

  // onItemReady MUST be registered before .data (Wix fires it synchronously on .data assignment)
  repeater.onItemReady(($item, rowData) => {
    const dateLabel = formatWindowDate(rowData.date, rowData.dayOfWeek);
    safeCall($item, '#windowDateLabel', el => { el.text = dateLabel; });

    _wireSlotButton($item, '#windowMorningBtn', '#windowMorningFull', rowData.morning, {
      date: rowData.date,
      dayOfWeek: rowData.dayOfWeek,
      deliveryType,
      $wFn,
    });

    _wireSlotButton($item, '#windowAfternoonBtn', '#windowAfternoonFull', rowData.afternoon, {
      date: rowData.date,
      dayOfWeek: rowData.dayOfWeek,
      deliveryType,
      $wFn,
    });
  });

  repeater.data = grouped.map(row => ({ _id: row.date, ...row }));
  safeCall($wFn, '#deliveryWindowRepeater', el => el.show());
}

function _wireSlotButton($item, btnSel, fullSel, slot, ctx) {
  const btn = safeGet($item, btnSel);
  const fullEl = safeGet($item, fullSel);

  if (!slot) {
    if (btn) try { btn.hide(); } catch (_) {}
    if (fullEl) try { fullEl.hide(); } catch (_) {}
    return;
  }

  if (btn) btn.label = slot.label;

  if (!slot.available) {
    if (btn) try { btn.disable(); } catch (_) {}
    if (fullEl) {
      fullEl.text = '(Full)';
      try { fullEl.show(); } catch (_) {}
    }
    return;
  }

  if (fullEl) try { fullEl.hide(); } catch (_) {}

  if (btn) {
    try { btn.enable(); } catch (_) {}
    btn.onClick(() => {
      _selectedWindow = {
        date: ctx.date,
        dayOfWeek: ctx.dayOfWeek,
        timeSlot: slot.timeSlot,
        label: slot.label,
        deliveryType: ctx.deliveryType,
      };

      // Show confirmation text
      safeCall(ctx.$wFn, '#deliveryWindowConfirm', el => {
        el.text = `Delivery window: ${formatWindowDate(ctx.date, ctx.dayOfWeek)}, ${slot.label}`;
        try { el.accessibility.role = 'status'; } catch (_) {}
        el.show();
      });

      if (_onWindowSelect) _onWindowSelect(_selectedWindow);
    });
  }
}
