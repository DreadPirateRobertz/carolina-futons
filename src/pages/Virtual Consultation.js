/**
 * @page Virtual Consultation
 * @url /virtual-consultation
 * @description Customer-facing booking flow for virtual room consultations.
 * Customers pick a designer, choose a date/time, select consultation type,
 * add notes, and confirm their appointment.
 *
 * Modes:
 * - S1: Loading
 * - S2: Designer picker
 * - S3: Slot picker (date → time slot → type form)
 * - S4: Confirmation view (with video call link if applicable)
 * - S5: Error / not-authenticated
 *
 * CF-ym1x
 */

import {
  getDesigners,
  getAvailableConsultationSlots,
  bookConsultation,
} from 'backend/virtualConsultation.web';
import {
  validateConsultationForm,
  buildBookingConfirmation,
  formatSlotDisplay,
  groupSlotsByDate,
  TIME_SLOTS,
} from 'public/consultationHelpers';
import { announce } from 'public/a11yHelpers';
import wixLocationFrontend from 'wix-location-frontend';

// ── State ─────────────────────────────────────────────────────────────

/** @type {{ designerId: string, date: string, timeSlot: string, consultationType: string, notes: string, email: string }} */
let _form = {};

// ── Page entry point ──────────────────────────────────────────────────

$w.onReady(async function () {
  await _initPage();
});

// ── Main init ─────────────────────────────────────────────────────────

/**
 * Load designers and render picker.
 * Exported for testing.
 */
export async function _initPage() {
  _showSection('loading');

  try {
    const result = await getDesigners();

    if (!result.success) {
      _showError(result.error || 'Could not load available designers.');
      return;
    }

    if (!result.designers || result.designers.length === 0) {
      _showError('No designers are available for booking at this time. Please check back soon.');
      return;
    }

    _renderDesignerPicker(result.designers);
  } catch (err) {
    console.error('[VirtualConsultation] Init error:', err);
    _showError('Something went wrong. Please try again.');
  }
}

// ── S2: Designer picker ───────────────────────────────────────────────

/**
 * Render the designer list so the customer can choose who to consult.
 * Exported for testing.
 * @param {Array} designers - from getDesigners
 */
export function _renderDesignerPicker(designers) {
  _showSection('designers');

  try {
    $w('#designerPickerHeadline').text = 'Choose Your Designer';
  } catch (e) {}

  try {
    const repeater = $w('#designerRepeater');
    repeater.data = designers.map(d => ({ _id: d._id, ...d }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#designerName').text = itemData.name || ''; } catch (e) {}
      try { $item('#designerSpecialty').text = _formatSpecialty(itemData.specialty); } catch (e) {}
      try { $item('#designerBio').text = itemData.bio || ''; } catch (e) {}
      try {
        if (itemData.avatarUrl) {
          $item('#designerAvatar').src = itemData.avatarUrl;
        }
      } catch (e) {}

      try {
        $item('#selectDesignerBtn').onClick(async () => {
          _form = { designerId: itemData._id };
          await _loadSlotsForDesigner(itemData._id, itemData.name);
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// ── S3: Slot picker ───────────────────────────────────────────────────

/**
 * Load available slots for the chosen designer and render date list.
 * @param {string} designerId
 * @param {string} designerName
 */
async function _loadSlotsForDesigner(designerId, designerName) {
  _showSection('loading');

  try {
    const result = await getAvailableConsultationSlots(designerId);

    if (!result.success) {
      _showError(result.error || 'Could not load available slots.');
      return;
    }

    _renderSlotPicker(result.slots || [], designerName);
  } catch (err) {
    console.error('[VirtualConsultation] Load slots error:', err);
    _showError('Could not load available slots. Please try again.');
  }
}

/**
 * Render the date/time/type picker.
 * Exported for testing.
 * @param {Array}  slots        - from getAvailableConsultationSlots
 * @param {string} designerName
 */
export function _renderSlotPicker(slots, designerName) {
  _showSection('slots');

  try {
    $w('#slotPickerDesignerName').text = `Booking with ${designerName}`;
  } catch (e) {}

  const byDate = groupSlotsByDate(slots);
  const dateKeys = Object.keys(byDate).sort();

  if (dateKeys.length === 0) {
    try { $w('#noSlotsMessage').expand(); } catch (e) {}
    try { $w('#dateRepeater').collapse(); } catch (e) {}
    try { $w('#slotFormSection').collapse(); } catch (e) {}
    return;
  }

  try { $w('#noSlotsMessage').collapse(); } catch (e) {}
  try { $w('#dateRepeater').expand(); } catch (e) {}

  try {
    const repeater = $w('#dateRepeater');
    repeater.data = dateKeys.map(d => ({
      _id: d,
      date: d,
      slots: byDate[d],
    }));

    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#dateLabelText').text = _formatDateShort(itemData.date);
      } catch (e) {}

      try {
        $item('#selectDateBtn').onClick(() => {
          _showTimeSlotPicker(itemData.date, itemData.slots);
        });
      } catch (e) {}
    });
  } catch (e) {}

  // Back to designer picker
  try {
    $w('#slotBackBtn').onClick(() => _initPage());
  } catch (e) {}

  try { $w('#slotFormSection').collapse(); } catch (e) {}
}

/**
 * Show the time slot options for a chosen date, then reveal the booking form.
 * Exported for testing.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Array}  slots   - slots for that date
 */
export function _showTimeSlotPicker(dateStr, slots) {
  _form.date = dateStr;
  delete _form.timeSlot;

  try { $w('#selectedDateLabel').text = _formatDateFull(dateStr); } catch (e) {}

  try {
    const repeater = $w('#timeSlotRepeater');
    repeater.data = slots.map(s => ({ _id: s.timeSlot, ...s }));

    repeater.onItemReady(($item, itemData) => {
      const entry = TIME_SLOTS.find(t => t.value === itemData.timeSlot);
      try { $item('#timeSlotLabel').text = entry ? entry.label : itemData.timeSlot; } catch (e) {}

      try {
        $item('#selectTimeBtn').onClick(() => {
          _form.timeSlot = itemData.timeSlot;
          _showBookingForm(dateStr, itemData.timeSlot);
        });
      } catch (e) {}
    });
  } catch (e) {}

  try { $w('#timeSlotSection').expand(); } catch (e) {}
  try { $w('#slotFormSection').collapse(); } catch (e) {}
}

/**
 * Reveal the booking form (consultation type + notes) after slot is chosen.
 * Exported for testing.
 * @param {string} dateStr
 * @param {string} timeSlot
 */
export function _showBookingForm(dateStr, timeSlot) {
  try {
    $w('#formSlotSummary').text = formatSlotDisplay(dateStr, timeSlot);
  } catch (e) {}

  // Wire consultation type radio/buttons
  try {
    $w('#typeVideoBtn').onClick(() => { _form.consultationType = 'video'; });
  } catch (e) {}
  try {
    $w('#typePhoneBtn').onClick(() => { _form.consultationType = 'phone'; });
  } catch (e) {}

  // Wire submit
  try {
    $w('#submitBookingBtn').onClick(async () => {
      await _handleSubmitBooking();
    });
  } catch (e) {}

  try { $w('#slotFormSection').expand(); } catch (e) {}
}

// ── S4: Booking submission ────────────────────────────────────────────

/**
 * Read form values, validate, and submit booking.
 * Exported for testing.
 */
export async function _handleSubmitBooking() {
  // Read live field values
  try { _form.notes = $w('#bookingNotesInput').value || ''; } catch (e) {}
  try { _form.email = $w('#bookingEmailInput').value || ''; } catch (e) {}
  if (!_form.consultationType) {
    try { _form.consultationType = $w('#consultationTypeDropdown').value || ''; } catch (e) {}
  }

  const { valid, errors } = validateConsultationForm(_form);
  if (!valid) {
    _showFormError(errors[0]);
    return;
  }

  _showSection('loading');

  try {
    const result = await bookConsultation({
      designerId: _form.designerId,
      date: _form.date,
      timeSlot: _form.timeSlot,
      consultationType: _form.consultationType,
      notes: _form.notes,
      email: _form.email,
    });

    if (!result.success) {
      if (result.error === 'Authentication required.') {
        _showError('Please sign in to book a consultation.');
      } else {
        _showError(result.error || 'Could not complete booking. Please try again.');
      }
      return;
    }

    const confirmation = buildBookingConfirmation(result, _form);
    _renderConfirmation(confirmation);
  } catch (err) {
    console.error('[VirtualConsultation] Booking error:', err);
    _showError('Something went wrong. Please try again.');
  }
}

// ── S5: Confirmation ──────────────────────────────────────────────────

/**
 * Show the success confirmation view.
 * Exported for testing.
 * @param {Object} confirmation - from buildBookingConfirmation
 */
export function _renderConfirmation(confirmation) {
  if (!confirmation) {
    _showError('Booking created but could not display confirmation.');
    return;
  }

  _showSection('confirmation');

  try {
    $w('#confirmSlotText').text = confirmation.dateDisplay || '';
  } catch (e) {}
  try {
    $w('#confirmTypeText').text = confirmation.typeLabel || '';
  } catch (e) {}

  // Video call link — show if present
  if (confirmation.videoCallUrl) {
    try {
      $w('#videoCallSection').expand();
      $w('#videoCallLink').link = confirmation.videoCallUrl;
      $w('#videoCallLink').target = '_blank';
    } catch (e) {}
  } else {
    try { $w('#videoCallSection').collapse(); } catch (e) {}
  }

  announce($w, `Consultation booked: ${confirmation.dateDisplay}`);

  // Return to member page
  try {
    $w('#confirmDoneBtn').onClick(() => {
      try { wixLocationFrontend.to('/member-page'); } catch (e) {}
    });
  } catch (e) {}

  // Book another
  try {
    $w('#bookAnotherBtn').onClick(() => {
      _form = {};
      _initPage();
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
    loading:      '#vcLoadingSection',
    designers:    '#vcDesignerSection',
    slots:        '#vcSlotSection',
    confirmation: '#vcConfirmSection',
    error:        '#vcErrorSection',
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

  // Sub-panels within slots — always start collapsed on section change
  if (name !== 'slots') {
    try { $w('#timeSlotSection').collapse(); } catch (e) {}
    try { $w('#slotFormSection').collapse(); } catch (e) {}
  }
}

function _showError(message) {
  _showSection('error');
  try { $w('#vcErrorText').text = message; } catch (e) {}
  try {
    $w('#vcRetryBtn').onClick(() => {
      _form = {};
      _initPage();
    });
  } catch (e) {}
}

function _showFormError(message) {
  try {
    $w('#formErrorText').text = message;
    $w('#formErrorText').expand();
  } catch (e) {}
}

// ── Format helpers ────────────────────────────────────────────────────

/**
 * Format YYYY-MM-DD to short display like "Wed Apr 1".
 * Exported for testing.
 */
export function _formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format YYYY-MM-DD to full display like "Wednesday, April 1, 2026".
 * Exported for testing.
 */
export function _formatDateFull(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format a backend specialty key to a display label.
 * Exported for testing.
 */
export function _formatSpecialty(specialty) {
  const labels = {
    'living-room': 'Living Room',
    'bedroom':     'Bedroom',
    'office':      'Home Office',
    'multi-room':  'Multi-Room',
  };
  return labels[specialty] || specialty || '';
}
