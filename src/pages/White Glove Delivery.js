/**
 * @page White Glove Delivery
 * @url /white-glove-delivery
 * @description Post-purchase white-glove delivery appointment scheduling.
 * Customer lands here from the Thank You Page prompt or from an email link.
 *
 * URL params:
 * - ?orderId=<id>  — pre-selects the order to schedule
 *
 * Modes:
 * - Scheduling: pick date + window from calendar (default)
 * - Already scheduled: show current appointment + reschedule option
 * - Success: confirmation view after booking
 *
 * S1: Loading
 * S2: Already-scheduled view (show appointment, offer reschedule)
 * S3: Calendar picker (date list → window select → confirm)
 * S4: Confirmation view
 * S5: Error / not-authenticated
 */

import {
  getWhiteGloveSlots,
  bookWhiteGloveDelivery,
  getMyWhiteGloveAppointment,
  rescheduleWhiteGlove,
} from 'backend/whiteGloveScheduling.web';
import { announce } from 'public/a11yHelpers';
import wixLocationFrontend from 'wix-location-frontend';

// ── Page entry point ──────────────────────────────────────────────────

$w.onReady(async function () {
  await _initPage();
});

// ── Main init ─────────────────────────────────────────────────────────

/**
 * Load slots and existing appointment, then render appropriate section.
 * Exported for testing.
 */
export async function _initPage() {
  _showSection('loading');

  const orderId = (wixLocationFrontend.query || {}).orderId || null;

  try {
    // Check for existing appointment first
    if (orderId) {
      const existing = await getMyWhiteGloveAppointment(orderId);

      if (!existing.success && existing.error === 'Not authenticated') {
        _showError('Please sign in to schedule your white-glove delivery.');
        return;
      }

      if (existing.success && existing.data) {
        _renderExistingAppointment(existing.data);
        return;
      }
    }

    // Load available slots and show calendar
    const slotsResult = await getWhiteGloveSlots(orderId);

    if (!slotsResult.success) {
      _showError(slotsResult.error || 'Could not load available delivery dates.');
      return;
    }

    _renderCalendar(slotsResult.slots, orderId);
  } catch (err) {
    console.error('[WhiteGloveDelivery] Unexpected error:', err);
    _showError('Something went wrong. Please try again.');
  }
}

// ── S2: Existing appointment ──────────────────────────────────────────

/**
 * Show the current appointment summary. Offer reschedule if eligible.
 * Exported for testing.
 * @param {Object} appt - appointment data from getMyWhiteGloveAppointment
 */
export function _renderExistingAppointment(appt) {
  _showSection('existing');

  try {
    $w('#existingDateText').text = _formatDate(appt.appointmentDate);
  } catch (e) {}
  try {
    $w('#existingWindowText').text = appt.windowLabel || appt.window;
  } catch (e) {}
  try {
    $w('#existingStatusText').text = _formatStatus(appt.status);
  } catch (e) {}

  // Reschedule button
  try {
    const rescheduleBtn = $w('#rescheduleBtn');
    if (!appt.canReschedule) {
      rescheduleBtn.disable();
      try {
        $w('#rescheduleNote').text = 'You have already rescheduled this appointment.';
        $w('#rescheduleNote').expand();
      } catch (e) {}
    } else {
      rescheduleBtn.onClick(async () => {
        await _handleReschedule(appt._id);
      });
    }
  } catch (e) {}
}

async function _handleReschedule(appointmentId) {
  _showSection('loading');

  const slotsResult = await getWhiteGloveSlots(null);
  if (!slotsResult.success) {
    _showError(slotsResult.error || 'Could not load available slots.');
    return;
  }

  _renderCalendar(slotsResult.slots, null, appointmentId);
}

// ── S3: Calendar picker ───────────────────────────────────────────────

/**
 * Render the two-step calendar: date list, then window selector.
 * Exported for testing.
 * @param {Array}       slots         - from getWhiteGloveSlots
 * @param {string|null} orderId       - for new bookings
 * @param {string|null} appointmentId - for reschedules
 */
export function _renderCalendar(slots, orderId, appointmentId = null) {
  _showSection('calendar');

  const availableDates = _groupSlotsByDate(slots);
  const dateKeys = Object.keys(availableDates).filter(d => availableDates[d].some(s => s.available));

  if (dateKeys.length === 0) {
    try { $w('#calendarNoSlots').expand(); } catch (e) {}
    try { $w('#calendarDateRepeater').collapse(); } catch (e) {}
    return;
  }

  try { $w('#calendarNoSlots').collapse(); } catch (e) {}
  try { $w('#calendarDateRepeater').expand(); } catch (e) {}

  // Populate date list
  const repeater = $w('#calendarDateRepeater');
  repeater.data = dateKeys.map(d => ({
    _id: d,
    date: d,
    dayLabel: `${availableDates[d][0].dayOfWeek}, ${_formatDate(d)}`,
    available: availableDates[d].some(s => s.available),
  }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#calendarDayLabel').text = itemData.dayLabel; } catch (e) {}

    if (!itemData.available) {
      try { $item('#calendarSelectDayBtn').disable(); } catch (e) {}
      try { $item('#calendarSelectDayBtn').label = 'Full'; } catch (e) {}
    } else {
      try {
        $item('#calendarSelectDayBtn').onClick(() => {
          _showWindowSelector(availableDates[itemData.date], itemData.date, orderId, appointmentId);
        });
      } catch (e) {}
    }
  });

  // Back button
  try {
    $w('#calendarBackBtn').onClick(() => {
      try { wixLocationFrontend.to('/'); } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Show the window picker for a chosen date.
 * Exported for testing.
 * @param {Array}       slots         - windows for the chosen date
 * @param {string}      dateStr       - YYYY-MM-DD
 * @param {string|null} orderId
 * @param {string|null} appointmentId
 */
export function _showWindowSelector(slots, dateStr, orderId, appointmentId) {
  try { $w('#windowSelectorSection').expand(); } catch (e) {}
  try { $w('#windowDateLabel').text = _formatDate(dateStr); } catch (e) {}

  const repeater = $w('#windowRepeater');
  repeater.data = slots.map(s => ({ ...s, _id: s.window }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#windowLabel').text = itemData.label; } catch (e) {}
    try {
      $item('#windowSpotsText').text = itemData.available
        ? `${itemData.spotsLeft} spot${itemData.spotsLeft !== 1 ? 's' : ''} available`
        : 'Full';
    } catch (e) {}

    const btn = $item('#windowSelectBtn');
    if (!itemData.available) {
      try { btn.disable(); } catch (e) {}
    } else {
      try {
        btn.onClick(async () => {
          await _confirmBooking(dateStr, itemData.window, orderId, appointmentId);
        });
      } catch (e) {}
    }
  });

  // Close / back from window selector
  try {
    $w('#windowBackBtn').onClick(() => {
      try { $w('#windowSelectorSection').collapse(); } catch (e) {}
    });
  } catch (e) {}
}

// ── S4: Booking / rescheduling ────────────────────────────────────────

/**
 * Book or reschedule the appointment and show confirmation.
 * Exported for testing.
 */
export async function _confirmBooking(dateStr, windowKey, orderId, appointmentId) {
  _showSection('loading');

  let result;

  if (appointmentId) {
    result = await rescheduleWhiteGlove(appointmentId, dateStr, windowKey);
  } else {
    result = await bookWhiteGloveDelivery({
      orderId: orderId || '',
      appointmentDate: dateStr,
      window: windowKey,
    });
  }

  if (!result.success) {
    _showError(result.error || 'Could not complete booking. Please try again.');
    return;
  }

  const data = result.data || {};
  _renderConfirmation({
    appointmentDate: data.appointmentDate || dateStr,
    windowLabel: data.windowLabel || windowKey,
    isReschedule: !!appointmentId,
  });
}

/**
 * Show the success confirmation view.
 * Exported for testing.
 */
export function _renderConfirmation(data) {
  _showSection('confirmation');

  try {
    $w('#confirmDateText').text = _formatDate(data.appointmentDate);
  } catch (e) {}
  try {
    $w('#confirmWindowText').text = data.windowLabel || '';
  } catch (e) {}
  try {
    $w('#confirmHeadline').text = data.isReschedule
      ? 'Your appointment has been rescheduled!'
      : 'Your delivery is scheduled!';
  } catch (e) {}
  try {
    $w('#confirmSubtext').text = "We'll send you a confirmation email with all the details.";
  } catch (e) {}

  announce($w, `${data.isReschedule ? 'Rescheduled' : 'Scheduled'}: white-glove delivery on ${_formatDate(data.appointmentDate)}`);

  // Back to orders button
  try {
    $w('#confirmOrdersBtn').onClick(() => {
      try { wixLocationFrontend.to('/member-page'); } catch (e) {}
    });
  } catch (e) {}
}

// ── Section helpers ───────────────────────────────────────────────────

/**
 * Collapse all sections and expand only the named one.
 * Exported for testing.
 */
export function _showSection(name) {
  const sectionIds = {
    loading:      '#wgLoadingSection',
    existing:     '#wgExistingSection',
    calendar:     '#wgCalendarSection',
    confirmation: '#wgConfirmSection',
    error:        '#wgErrorSection',
  };

  for (const [key, sel] of Object.entries(sectionIds)) {
    try {
      if (key === name) {
        $w(sel).expand();
      } else {
        $w(sel).collapse();
      }
    } catch (e) {}
  }

  // Window selector is a sub-panel within calendar, always start collapsed
  if (name !== 'calendar') {
    try { $w('#windowSelectorSection').collapse(); } catch (e) {}
  }
}

function _showError(message) {
  _showSection('error');
  try { $w('#wgErrorText').text = message; } catch (e) {}
}

// ── Format helpers ────────────────────────────────────────────────────

/**
 * Format a YYYY-MM-DD date string to a readable display string.
 * Exported for testing.
 */
export function _formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function _formatStatus(status) {
  const labels = { confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
  return labels[status] || status || '';
}

/**
 * Group a flat slots array into { 'YYYY-MM-DD': [slot, ...] }.
 * Exported for testing.
 */
export function _groupSlotsByDate(slots) {
  const grouped = {};
  for (const slot of slots) {
    if (!grouped[slot.date]) grouped[slot.date] = [];
    grouped[slot.date].push(slot);
  }
  return grouped;
}
