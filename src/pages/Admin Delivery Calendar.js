/**
 * @page Admin Delivery Calendar
 * @url /admin-delivery-calendar
 * @description Brenda's admin dashboard for white-glove delivery scheduling.
 * Admin-only page (uses Permissions.Admin backend methods).
 *
 * Features:
 * - View all upcoming white-glove appointments in a date range
 * - Block/unblock delivery dates (store holidays, inventory days)
 * - See blocked dates list
 *
 * S1: Loading
 * S2: Calendar view (appointments list + date range filter)
 * S3: Block date form
 * S4: Blocked dates list
 * S5: Error
 */

import {
  getAdminCalendar,
  blockDeliveryDate,
  unblockDeliveryDate,
  getBlockedDates,
} from 'backend/whiteGloveScheduling.web';
import { announce } from 'public/a11yHelpers';

// ── Page entry point ──────────────────────────────────────────────────

$w.onReady(async function () {
  await _initAdminPage();
});

// ── Main init ─────────────────────────────────────────────────────────

/**
 * Load calendar for the next 14 days and blocked dates list.
 * Exported for testing.
 */
export async function _initAdminPage() {
  _showSection('loading');

  try {
    const today  = new Date();
    const endDay = new Date(today);
    endDay.setDate(endDay.getDate() + 14);

    const startStr = _toDateStr(today);
    const endStr   = _toDateStr(endDay);

    const [calResult, blockedResult] = await Promise.all([
      getAdminCalendar(startStr, endStr),
      getBlockedDates(),
    ]);

    if (!calResult.success) {
      _showError(calResult.error || 'Could not load calendar.');
      return;
    }

    _renderCalendar(calResult.data, startStr, endStr);
    _renderBlockedDates(blockedResult.success ? blockedResult.data : []);
    _wireBlockForm();
  } catch (err) {
    console.error('[AdminDeliveryCalendar] Init error:', err);
    _showError('Something went wrong. Please refresh the page.');
  }
}

// ── S2: Calendar ──────────────────────────────────────────────────────

/**
 * Render the appointments list and date range controls.
 * Exported for testing.
 * @param {Array}  appointments
 * @param {string} startStr - YYYY-MM-DD
 * @param {string} endStr   - YYYY-MM-DD
 */
export function _renderCalendar(appointments, startStr, endStr) {
  _showSection('calendar');

  try { $w('#calendarRangeLabel').text = `${_formatDate(startStr)} – ${_formatDate(endStr)}`; } catch (e) {}
  try {
    $w('#calendarApptCount').text =
      `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`;
  } catch (e) {}

  if (appointments.length === 0) {
    try { $w('#calendarEmpty').expand(); } catch (e) {}
    try { $w('#calendarRepeater').collapse(); } catch (e) {}
  } else {
    try { $w('#calendarEmpty').collapse(); } catch (e) {}
    try { $w('#calendarRepeater').expand(); } catch (e) {}
    _populateCalendarRepeater(appointments);
  }

  // Date range filter
  try {
    $w('#calendarFilterBtn').onClick(async () => {
      let from = '';
      let to   = '';
      try { from = $w('#calendarFromDate').value || ''; } catch (e) {}
      try { to   = $w('#calendarToDate').value   || ''; } catch (e) {}

      if (!from || !to) {
        try { $w('#calendarFilterError').text = 'Please select both start and end dates.'; } catch (e) {}
        try { $w('#calendarFilterError').expand(); } catch (e) {}
        return;
      }

      try { $w('#calendarFilterError').collapse(); } catch (e) {}
      try { $w('#calendarFilterBtn').disable(); } catch (e) {}

      const result = await getAdminCalendar(from, to);

      try { $w('#calendarFilterBtn').enable(); } catch (e) {}

      if (!result.success) {
        try { $w('#calendarFilterError').text = result.error || 'Could not load calendar.'; } catch (e) {}
        try { $w('#calendarFilterError').expand(); } catch (e) {}
        return;
      }

      _renderCalendar(result.data, from, to);
    });
  } catch (e) {}
}

function _populateCalendarRepeater(appointments) {
  const repeater = $w('#calendarRepeater');
  repeater.data = appointments.map(a => ({ ...a }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#apptDate').text    = _formatDate(itemData.appointmentDate); } catch (e) {}
    try { $item('#apptWindow').text  = itemData.windowLabel || itemData.window; } catch (e) {}
    try { $item('#apptStatus').text  = _formatStatus(itemData.status); } catch (e) {}
    try { $item('#apptEmail').text   = itemData.customerEmail || '—'; } catch (e) {}
    try { $item('#apptPhone').text   = itemData.customerPhone || '—'; } catch (e) {}
    try { $item('#apptAddress').text = itemData.address || '—'; } catch (e) {}
    try { $item('#apptNotes').text   = itemData.notes || ''; } catch (e) {}
    try { $item('#apptOrderId').text = itemData.orderId || ''; } catch (e) {}
  });
}

// ── S3: Block date form ───────────────────────────────────────────────

function _wireBlockForm() {
  try {
    $w('#blockDateSubmitBtn').onClick(async () => {
      await _handleBlockDate();
    });
  } catch (e) {}
}

/**
 * Handle the block-a-date form submission.
 * Exported for testing.
 */
export async function _handleBlockDate() {
  let date   = '';
  let reason = '';

  try { date   = $w('#blockDateInput').value   || ''; } catch (e) {}
  try { reason = $w('#blockReasonInput').value || ''; } catch (e) {}

  if (!date) {
    try { $w('#blockFormError').text = 'Please select a date to block.'; } catch (e) {}
    try { $w('#blockFormError').expand(); } catch (e) {}
    return;
  }

  try { $w('#blockDateSubmitBtn').disable(); } catch (e) {}
  try { $w('#blockDateSubmitBtn').label = 'Blocking...'; } catch (e) {}
  try { $w('#blockFormError').collapse(); } catch (e) {}

  const result = await blockDeliveryDate(date, reason);

  try { $w('#blockDateSubmitBtn').enable(); } catch (e) {}
  try { $w('#blockDateSubmitBtn').label = 'Block Date'; } catch (e) {}

  if (!result.success) {
    try { $w('#blockFormError').text = result.error || 'Failed to block date.'; } catch (e) {}
    try { $w('#blockFormError').expand(); } catch (e) {}
    return;
  }

  announce($w, `${date} has been blocked for deliveries.`);
  try { $w('#blockDateInput').value = ''; } catch (e) {}
  try { $w('#blockReasonInput').value = ''; } catch (e) {}

  // Reload blocked dates list
  const blocked = await getBlockedDates();
  _renderBlockedDates(blocked.success ? blocked.data : []);
}

// ── S4: Blocked dates list ────────────────────────────────────────────

/**
 * Render the blocked dates list with unblock buttons.
 * Exported for testing.
 * @param {Array} blockedDates
 */
export function _renderBlockedDates(blockedDates) {
  try { $w('#blockedDatesSection').expand(); } catch (e) {}
  try {
    $w('#blockedDateCount').text =
      `${blockedDates.length} blocked date${blockedDates.length !== 1 ? 's' : ''}`;
  } catch (e) {}

  if (blockedDates.length === 0) {
    try { $w('#blockedDatesEmpty').expand(); } catch (e) {}
    try { $w('#blockedDatesRepeater').collapse(); } catch (e) {}
    return;
  }

  try { $w('#blockedDatesEmpty').collapse(); } catch (e) {}
  try { $w('#blockedDatesRepeater').expand(); } catch (e) {}

  const repeater = $w('#blockedDatesRepeater');
  repeater.data  = blockedDates.map(d => ({ ...d }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#blockedDateText').text   = _formatDate(itemData.blockedDate); } catch (e) {}
    try { $item('#blockedReasonText').text = itemData.reason || ''; } catch (e) {}

    try {
      $item('#unblockBtn').onClick(async () => {
        try { $item('#unblockBtn').disable(); } catch (e2) {}
        const result = await unblockDeliveryDate(itemData.blockedDate);
        if (result.success) {
          announce($w, `${itemData.blockedDate} is now available for deliveries.`);
          const updated = await getBlockedDates();
          _renderBlockedDates(updated.success ? updated.data : []);
        } else {
          try { $item('#unblockBtn').enable(); } catch (e2) {}
          announce($w, result.error || 'Could not unblock date.');
        }
      });
    } catch (e) {}
  });
}

// ── Section helpers ───────────────────────────────────────────────────

/**
 * Collapse all sections and expand only the named one.
 * Exported for testing.
 */
export function _showSection(name) {
  const sectionIds = {
    loading:  '#adminLoadingSection',
    calendar: '#adminCalendarSection',
    error:    '#adminErrorSection',
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
}

function _showError(message) {
  _showSection('error');
  try { $w('#adminErrorText').text = message; } catch (e) {}
}

// ── Format helpers ────────────────────────────────────────────────────

/**
 * Format a YYYY-MM-DD date to a readable string.
 * Exported for testing.
 */
export function _formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr || '';
  }
}

function _formatStatus(status) {
  const labels = { confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
  return labels[status] || status || '';
}

function _toDateStr(d) {
  return d.toISOString().split('T')[0];
}
