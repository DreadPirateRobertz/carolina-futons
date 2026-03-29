/**
 * Consultation.js — Virtual Consultation booking page controller.
 * Lets customers book a 30-minute video or phone consultation with a furniture
 * expert, select a time slot, and submit a pre-consultation intake form.
 *
 * Elements:
 *   #loadingIndicator       — Shown during initial load
 *   #designerSection        — Container for designer repeater (hidden until loaded)
 *   #designerRepeater       — Repeater of available designers (each is selectable)
 *   #noDesignersMsg         — Shown when no designers are available
 *   #slotSection            — Container for date/time pickers (hidden until designer selected)
 *   #dateDropdown           — Date dropdown populated from available slots
 *   #timeSlotDropdown       — Time slot dropdown filtered by selected date
 *   #noSlotsMsg             — Shown when designer has no availability
 *   #consultTypeVideo       — Checkbox/toggle: "Video Call"
 *   #consultTypePhone       — Checkbox/toggle: "Phone Call"
 *   #bookingForm            — Container for the full booking form
 *   #roomTypeDropdown       — Intake: room type
 *   #roomSizeDropdown       — Intake: room size
 *   #primaryUseDropdown     — Intake: primary use
 *   #styleDropdown          — Intake: style preference
 *   #budgetDropdown         — Intake: budget range
 *   #timelineDropdown       — Intake: purchase timeline
 *   #descriptionInput       — Intake: optional description / notes
 *   #bookBtn                — Submit booking button
 *   #bookingErrorMsg        — Error message element
 *   #confirmationSection    — Shown after successful booking
 *   #confirmCallSection     — Shown for video bookings (contains Zoom link)
 *   #confirmCallUrl         — Text element: video call URL
 *
 * Backend:
 *   getDesigners()                       — List active designers
 *   getAvailableConsultationSlots(id)    — Available time slots for a designer
 *   bookConsultation(data)               — Create the booking record
 *   submitConsultationIntake(id, data)   — Save pre-consultation intake form
 */
import {
  getDesigners,
  getAvailableConsultationSlots,
  bookConsultation,
  submitConsultationIntake,
} from 'backend/virtualConsultation.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';

/** Module-level state shared between exported functions. */
const _state = {
  selectedDesignerId: '',
  allSlots: [],
};

/**
 * Initialize the consultation booking page.
 * Registers $w.onReady and wires all UI event handlers.
 *
 * @param {Function} $w - Wix selector function
 */
export function initConsultationPage($w) {
  $w.onReady(async function () {
    // Default to video consultation type
    try { $w('#consultTypeVideo').checked = true; } catch (_) {}

    // Wire book button
    try {
      $w('#bookBtn').onClick(async () => {
        await submitBooking($w, { selectedDesignerId: _state.selectedDesignerId });
      });
    } catch (_) {}

    // Wire date change to re-filter time slots
    try {
      $w('#dateDropdown').onChange(() => _filterTimeSlots($w));
    } catch (_) {}

    // Load designers
    await loadDesigners($w);
  });
}

/**
 * Load available designers from the backend and populate the designer repeater.
 *
 * @param {Function} $w - Wix selector function
 */
export async function loadDesigners($w) {
  try { $w('#loadingIndicator').show(); } catch (_) {}
  try { $w('#bookingErrorMsg').hide(); } catch (_) {}

  let result;
  try {
    result = await getDesigners();
  } catch (err) {
    console.error('[Consultation] Failed to load designers:', err);
    _showError($w, 'Unable to load consultants right now. Please try again shortly.');
    try { $w('#loadingIndicator').hide(); } catch (_) {}
    return;
  }

  try { $w('#loadingIndicator').hide(); } catch (_) {}

  if (!result.success || !result.designers?.length) {
    if (!result.success) {
      console.error('[Consultation] getDesigners error:', result.error);
      _showError($w, 'Unable to load consultants right now. Please try again shortly.');
    } else {
      try { $w('#noDesignersMsg').show(); } catch (_) {}
    }
    return;
  }

  try {
    $w('#designerRepeater').data = result.designers.map(d => ({
      _id: d._id,
      name: d.name,
      specialty: d.specialty,
      bio: d.bio,
      avatarUrl: d.avatarUrl || '',
    }));

    $w('#designerRepeater').onItemReady(async ($item, itemData) => {
      try { $item('#designerName').text = itemData.name; } catch (_) {}
      try { $item('#designerSpecialty').text = itemData.specialty; } catch (_) {}
      try { $item('#designerBio').text = itemData.bio; } catch (_) {}
      try { if (itemData.avatarUrl) $item('#designerAvatar').src = itemData.avatarUrl; } catch (_) {}

      try {
        $item('#selectDesignerBtn').onClick(async () => {
          _state.selectedDesignerId = itemData._id;
          await loadTimeSlots($w, itemData._id);
        });
      } catch (_) {}
    });
  } catch (err) {
    console.error('[Consultation] Failed to render designer repeater:', err);
    _showError($w, 'Unable to load consultants right now. Please try again shortly.');
    return;
  }

  try { $w('#designerSection').show(); } catch (_) {}
}

/**
 * Load available time slots for a designer and populate the date/time dropdowns.
 *
 * @param {Function} $w - Wix selector function
 * @param {string} designerId - Designer _id to load slots for
 */
export async function loadTimeSlots($w, designerId) {
  if (!designerId) return;

  try { $w('#noSlotsMsg').hide(); } catch (_) {}
  try { $w('#slotSection').hide(); } catch (_) {}
  try { $w('#bookingErrorMsg').hide(); } catch (_) {}

  let result;
  try {
    result = await getAvailableConsultationSlots(designerId);
  } catch (err) {
    console.error('[Consultation] Failed to load slots:', err, '| designerId:', designerId);
    _showError($w, 'Unable to load available times. Please try again.');
    return;
  }

  if (!result.success) {
    console.error('[Consultation] getAvailableConsultationSlots error:', result.error);
    _showError($w, 'Unable to load available times. Please try again.');
    return;
  }

  if (!result.slots?.length) {
    try { $w('#noSlotsMsg').show(); } catch (_) {}
    return;
  }

  _state.allSlots = result.slots;

  // Unique sorted dates
  const dates = [...new Set(result.slots.map(s => s.date))].sort();
  try {
    $w('#dateDropdown').options = dates.map(d => ({ label: d, value: d }));
    $w('#dateDropdown').value = dates[0];
  } catch (_) {}

  _filterTimeSlots($w);

  // Wire date change to re-filter time slots for the selected date
  try { $w('#dateDropdown').onChange(() => _filterTimeSlots($w)); } catch (_) {}

  try { $w('#slotSection').show(); } catch (_) {}
}

/**
 * Filter #timeSlotDropdown options based on currently selected date.
 *
 * @param {Function} $w - Wix selector function
 */
function _filterTimeSlots($w) {
  try {
    const selectedDate = $w('#dateDropdown').value;
    const dateSlots = _state.allSlots.filter(s => s.date === selectedDate);
    $w('#timeSlotDropdown').options = dateSlots.map(s => ({
      label: s.timeSlot,
      value: s.timeSlot,
    }));
    if (dateSlots.length) {
      $w('#timeSlotDropdown').value = dateSlots[0].timeSlot;
    }
  } catch (err) {
    console.error('[Consultation] Failed to filter time slots:', err);
  }
}

/**
 * Submit the consultation booking form.
 * Validates required fields, calls the booking backend, then submits the
 * intake form. Shows the confirmation section on success.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} opts
 * @param {string} opts.selectedDesignerId - Designer _id selected by the user
 */
export async function submitBooking($w, opts = {}) {
  const designerId = opts.selectedDesignerId || _state.selectedDesignerId;

  try { $w('#bookingErrorMsg').hide(); } catch (_) {}

  // ── Validation ──────────────────────────────────────────────────────

  if (!designerId) {
    _showError($w, 'Please select a designer to continue.');
    return;
  }

  const date = _readValue($w, '#dateDropdown');
  if (!date) {
    _showError($w, 'Please select a date for your consultation.');
    return;
  }

  const timeSlot = _readValue($w, '#timeSlotDropdown');
  if (!timeSlot) {
    _showError($w, 'Please select a time slot for your consultation.');
    return;
  }

  const roomType = _readValue($w, '#roomTypeDropdown');
  if (!roomType) {
    _showError($w, 'Please select your room type so we can prepare for your consultation.');
    return;
  }

  const roomSize = _readValue($w, '#roomSizeDropdown');
  const primaryUse = _readValue($w, '#primaryUseDropdown');
  const stylePreference = _readValue($w, '#styleDropdown');
  const budget = _readValue($w, '#budgetDropdown');
  const timeline = _readValue($w, '#timelineDropdown');
  const description = _readValue($w, '#descriptionInput');

  if (!roomSize || !primaryUse || !stylePreference || !budget || !timeline) {
    _showError($w, 'Please complete all consultation details before booking.');
    return;
  }

  // Determine consultation type from checkboxes
  let consultationType = 'video';
  try {
    if ($w('#consultTypePhone').checked) consultationType = 'phone';
    if ($w('#consultTypeVideo').checked) consultationType = 'video';
  } catch (_) {}

  // ── Submit ──────────────────────────────────────────────────────────

  try { $w('#bookBtn').disable(); } catch (_) {}
  try { $w('#bookBtn').label = 'Booking...'; } catch (_) {}

  let bookResult;
  try {
    bookResult = await bookConsultation({
      designerId,
      date,
      timeSlot,
      consultationType,
      notes: description,
    });
  } catch (err) {
    console.error('[Consultation] bookConsultation threw:', err);
    _showError($w, 'Something went wrong. Please try again or call (828) 252-9449.');
    try { $w('#bookBtn').enable(); } catch (_) {}
    try { $w('#bookBtn').label = 'Book My Consultation'; } catch (_) {}
    return;
  }

  try { $w('#bookBtn').enable(); } catch (_) {}
  try { $w('#bookBtn').label = 'Book My Consultation'; } catch (_) {}

  if (!bookResult.success) {
    const isAuthError = /authentication required/i.test(bookResult.error || '');
    const msg = isAuthError
      ? 'Please sign in to book a consultation.'
      : (bookResult.error || 'Unable to complete booking. Please try again.');
    _showError($w, msg);
    return;
  }

  // ── Post-booking intake (fire-and-forget — booking already confirmed) ──

  submitConsultationIntake(bookResult.bookingId, {
    roomType,
    roomSize,
    primaryUse,
    stylePreference,
    budget,
    timeline,
    description: description || '',
  }).catch(err =>
    console.error('[Consultation] submitConsultationIntake failed (non-blocking):', err)
  );

  // ── Analytics ───────────────────────────────────────────────────────

  try {
    trackEvent('consultation_booked', { consultationType, date, designerId });
  } catch (_) {}

  // ── Confirmation ────────────────────────────────────────────────────

  try { $w('#bookingForm').hide('fade', { duration: 300 }); } catch (_) {}

  const videoCallUrl = bookResult.videoCallUrl || '';
  if (consultationType === 'video' && videoCallUrl) {
    try { $w('#confirmCallUrl').text = videoCallUrl; } catch (_) {}
    try { $w('#confirmCallSection').show(); } catch (_) {}
  } else {
    try { $w('#confirmCallSection').hide(); } catch (_) {}
  }

  try { $w('#confirmationSection').show('fade', { duration: 300 }); } catch (_) {}
  try { announce($w, 'Your consultation has been booked! Check your email for details.'); } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────────────

function _readValue($w, sel) {
  try { return $w(sel).value || ''; } catch (_) { return ''; }
}

function _showError($w, message) {
  try {
    $w('#bookingErrorMsg').text = message;
    $w('#bookingErrorMsg').show();
    announce($w, message);
  } catch (err) {
    console.error('[Consultation] Could not display error:', err, '| Message:', message);
  }
}
