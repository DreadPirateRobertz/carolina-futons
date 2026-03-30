/**
 * @page Admin Virtual Consultation
 * @url /admin-virtual-consultation
 * @description Admin dashboard for managing virtual consultation bookings.
 * Shows upcoming consultations, lets staff add post-consultation notes
 * and product recommendations, and mark bookings complete.
 *
 * Sections:
 * - S1: Loading
 * - S2: Bookings list with date-range filter
 * - S3: Notes form (per-booking overlay)
 * - S4: Error
 *
 * CF-ym1x
 */

import {
  addConsultationNotes,
} from 'backend/virtualConsultation.web';
import wixData from 'wix-data';

// ── State ─────────────────────────────────────────────────────────────

/** Currently selected booking for note entry */
let _activeBookingId = null;

// ── Page entry point ──────────────────────────────────────────────────

$w.onReady(async function () {
  await _initAdminPage();
});

// ── Main init ─────────────────────────────────────────────────────────

/**
 * Load upcoming consultations for the next 14 days.
 * Exported for testing.
 */
export async function _initAdminPage() {
  _showSection('loading');

  try {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 14);

    const startStr = _toDateStr(today);
    const endStr   = _toDateStr(end);

    await _loadBookings(startStr, endStr);
    _wireDateFilter();
  } catch (err) {
    console.error('[AdminVirtualConsultation] Init error:', err);
    _showError('Something went wrong. Please refresh the page.');
  }
}

// ── S2: Bookings list ─────────────────────────────────────────────────

/**
 * Query and render bookings in a date range.
 * Exported for testing.
 * @param {string} startStr - YYYY-MM-DD
 * @param {string} endStr   - YYYY-MM-DD
 */
export async function _loadBookings(startStr, endStr) {
  try {
    const result = await wixData.query('ConsultationBookings')
      .ge('date', startStr)
      .le('date', endStr)
      .ne('status', 'cancelled')
      .ascending('date')
      .ascending('timeSlot')
      .limit(100)
      .find();

    _renderBookings(result.items, startStr, endStr);
  } catch (err) {
    console.error('[AdminVirtualConsultation] Load error:', err);
    _showError('Could not load consultations.');
  }
}

/**
 * Render the bookings repeater.
 * Exported for testing.
 * @param {Array}  bookings
 * @param {string} startStr
 * @param {string} endStr
 */
export function _renderBookings(bookings, startStr, endStr) {
  _showSection('bookings');

  try {
    $w('#bookingsRangeLabel').text = `${_formatDate(startStr)} – ${_formatDate(endStr)}`;
  } catch (e) {}

  try {
    $w('#bookingsCount').text =
      `${bookings.length} consultation${bookings.length !== 1 ? 's' : ''}`;
  } catch (e) {}

  if (bookings.length === 0) {
    try { $w('#bookingsEmpty').expand(); } catch (e) {}
    try { $w('#bookingsRepeater').collapse(); } catch (e) {}
    return;
  }

  try { $w('#bookingsEmpty').collapse(); } catch (e) {}
  try { $w('#bookingsRepeater').expand(); } catch (e) {}

  try {
    const repeater = $w('#bookingsRepeater');
    repeater.data = bookings.map(b => ({ _id: b._id, ...b }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#bookingDate').text     = _formatDate(itemData.date); } catch (e) {}
      try { $item('#bookingTime').text     = _formatTime(itemData.timeSlot); } catch (e) {}
      try { $item('#bookingType').text     = _formatType(itemData.consultationType); } catch (e) {}
      try { $item('#bookingStatus').text   = _formatStatus(itemData.status); } catch (e) {}
      try { $item('#bookingNotes').text    = itemData.notes || '—'; } catch (e) {}
      try {
        $item('#videoCallLinkText').text = itemData.videoCallUrl || '—';
      } catch (e) {}

      if (itemData.status !== 'completed') {
        try {
          $item('#addNotesBtn').onClick(() => {
            _openNotesForm(itemData._id);
          });
        } catch (e) {}
      } else {
        try { $item('#addNotesBtn').disable(); } catch (e) {}
        try { $item('#addNotesBtn').label = 'Completed'; } catch (e) {}
      }
    });
  } catch (e) {}
}

function _wireDateFilter() {
  try {
    $w('#filterBtn').onClick(async () => {
      let from = '';
      let to   = '';
      try { from = $w('#filterFromDate').value || ''; } catch (e) {}
      try { to   = $w('#filterToDate').value   || ''; } catch (e) {}

      if (!from || !to) {
        try { $w('#filterError').text = 'Please select both start and end dates.'; } catch (e) {}
        try { $w('#filterError').expand(); } catch (e) {}
        return;
      }

      try { $w('#filterError').collapse(); } catch (e) {}
      try { $w('#filterBtn').disable(); } catch (e) {}

      await _loadBookings(from, to);

      try { $w('#filterBtn').enable(); } catch (e) {}
    });
  } catch (e) {}
}

// ── S3: Notes form ────────────────────────────────────────────────────

/**
 * Open the notes form for a booking.
 * Exported for testing.
 * @param {string} bookingId
 */
export function _openNotesForm(bookingId) {
  _activeBookingId = bookingId;

  try { $w('#notesBookingId').text = bookingId; } catch (e) {}
  try { $w('#notesInput').value = ''; } catch (e) {}
  try { $w('#notesProductIds').value = ''; } catch (e) {}
  try { $w('#notesFormError').collapse(); } catch (e) {}
  try { $w('#notesFormSection').expand(); } catch (e) {}

  try {
    $w('#saveNotesBtn').onClick(async () => {
      await _handleSaveNotes();
    });
  } catch (e) {}

  try {
    $w('#cancelNotesBtn').onClick(() => {
      _activeBookingId = null;
      try { $w('#notesFormSection').collapse(); } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Submit notes and product recommendations.
 * Exported for testing.
 */
export async function _handleSaveNotes() {
  if (!_activeBookingId) return;

  let notes      = '';
  let productRaw = '';

  try { notes      = $w('#notesInput').value      || ''; } catch (e) {}
  try { productRaw = $w('#notesProductIds').value || ''; } catch (e) {}

  // Parse comma-separated product IDs
  const productIds = productRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  try { $w('#saveNotesBtn').disable(); } catch (e) {}
  try { $w('#saveNotesBtn').label = 'Saving...'; } catch (e) {}
  try { $w('#notesFormError').collapse(); } catch (e) {}

  const result = await addConsultationNotes(_activeBookingId, productIds, notes);

  try { $w('#saveNotesBtn').enable(); } catch (e) {}
  try { $w('#saveNotesBtn').label = 'Save Notes'; } catch (e) {}

  if (!result.success) {
    try {
      $w('#notesFormError').text = result.error || 'Could not save notes. Please try again.';
      $w('#notesFormError').expand();
    } catch (e) {}
    return;
  }

  _activeBookingId = null;
  try { $w('#notesFormSection').collapse(); } catch (e) {}

  // Refresh current view
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 14);
  await _loadBookings(_toDateStr(today), _toDateStr(end));
}

// ── Section helpers ───────────────────────────────────────────────────

/**
 * Collapse all top-level sections and expand the named one.
 * Exported for testing.
 */
export function _showSection(name) {
  const sectionIds = {
    loading:  '#avcLoadingSection',
    bookings: '#avcBookingsSection',
    error:    '#avcErrorSection',
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
  try { $w('#avcErrorText').text = message; } catch (e) {}
  try {
    $w('#avcRetryBtn').onClick(() => _initAdminPage());
  } catch (e) {}
}

// ── Format helpers ────────────────────────────────────────────────────

/**
 * Format YYYY-MM-DD to human-readable date.
 * Exported for testing.
 */
export function _formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format HH:MM time slot to 12-hour display.
 * Exported for testing.
 */
export function _formatTime(timeSlot) {
  const map = {
    '09:00': '9:00 AM',
    '10:00': '10:00 AM',
    '11:00': '11:00 AM',
    '13:00': '1:00 PM',
    '14:00': '2:00 PM',
    '15:00': '3:00 PM',
    '16:00': '4:00 PM',
  };
  return map[timeSlot] || timeSlot || '';
}

function _formatType(type) {
  return type === 'video' ? 'Video Call' : type === 'phone' ? 'Phone Call' : type || '';
}

function _formatStatus(status) {
  const labels = { confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };
  return labels[status] || status || '';
}

function _toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
