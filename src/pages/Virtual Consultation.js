/**
 * Virtual Consultation page — booking flow controller.
 *
 * Flow:
 *   Step 1 — Choose a designer (designer cards in repeater)
 *   Step 2 — Choose a date, time, and consultation type (video/phone)
 *   Step 3 — Add optional notes and confirm booking
 *   Step 4 — Confirmation view (video call link if applicable)
 *
 * Element IDs (set in Wix editor):
 *   #designerRepeater           — Designer card repeater (step 1)
 *     #designerAvatar           — Image: designer headshot
 *     #designerNameText         — Text: designer name
 *     #designerSpecialtyText    — Text: specialty label
 *     #designerBioText          — Text: short bio
 *     #selectDesignerBtn        — Button: "Book with [Name]"
 *   #bookingFormSection         — Step 2+3 container (hidden until designer chosen)
 *   #selectedDesignerName       — Text: "Booking with Sarah Mountain"
 *   #slotDateDropdown           — Dropdown: available dates grouped by slot
 *   #timeSlotDropdown           — Dropdown: available times for selected date
 *   #consultationTypeDropdown   — Dropdown: Video Call / Phone Call
 *   #notesInput                 — TextInput: optional customer notes
 *   #bookBtn                    — Button: "Confirm Booking"
 *   #bookingError               — Text: inline error message
 *   #loadingSpinner             — Image/strip: loading indicator
 *   #confirmationSection        — Container: shown after successful booking
 *   #confirmationSummary        — Text: "Confirmed: Wed, Apr 2 at 10 AM — Video Call"
 *   #videoCallSection           — Container: shown only for video bookings
 *   #videoCallLinkText          — Text: meeting URL
 *   #bookAnotherBtn             — Button: "Book Another Consultation"
 *   #consultationHeroText       — Text: page hero heading
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
  formatSlotDisplay,
  getConsultationTypeLabel,
  groupSlotsByDate,
  CONSULTATION_TYPES,
} from 'public/consultationHelpers';
import { trackEvent } from 'public/engagementTracker';

// State
let _selectedDesignerId = '';
let _selectedDesignerName = '';
let _availableSlots = [];
let _slotsByDate = {};

// ── Page init ─────────────────────────────────────────────────────────────────

$w.onReady(async function () {
  showSection('designers');
  hideError();

  await loadDesigners();
  initBookingForm();
  initConfirmationReset();
  trackEvent('page_view', { page: 'virtual_consultation' });
});

// ── Step 1: Load designers ────────────────────────────────────────────────────

async function loadDesigners() {
  showLoading(true);
  try {
    const { success, designers } = await getDesigners();
    if (!success || !designers.length) {
      showError('No designers are currently available. Please check back soon.');
      return;
    }

    try {
      $w('#designerRepeater').data = designers.map(d => ({
        _id: d._id,
        name: d.name,
        specialty: specialtyLabel(d.specialty),
        bio: d.bio || '',
        avatarUrl: d.avatarUrl || '',
      }));

      $w('#designerRepeater').onItemReady(($item, itemData) => {
        try { $item('#designerNameText').text = itemData.name; } catch (e) {}
        try { $item('#designerSpecialtyText').text = itemData.specialty; } catch (e) {}
        try { $item('#designerBioText').text = itemData.bio; } catch (e) {}
        try {
          if (itemData.avatarUrl) {
            $item('#designerAvatar').src = itemData.avatarUrl;
          }
        } catch (e) {}

        try {
          $item('#selectDesignerBtn').label = `Book with ${itemData.name}`;
          $item('#selectDesignerBtn').onClick(async () => {
            await selectDesigner(itemData._id, itemData.name);
          });
        } catch (e) {}
      });
    } catch (e) {
      console.error('[VirtualConsultation] Repeater setup failed:', e);
    }
  } catch (err) {
    console.error('[VirtualConsultation] loadDesigners failed:', err);
    showError('Could not load designers. Please refresh the page.');
  } finally {
    showLoading(false);
  }
}

// ── Step 2: Designer selected — load slots ────────────────────────────────────

async function selectDesigner(designerId, designerName) {
  _selectedDesignerId = designerId;
  _selectedDesignerName = designerName;
  hideError();
  showLoading(true);

  try {
    const { success, slots, error } = await getAvailableConsultationSlots(designerId);
    if (!success || !slots.length) {
      showError(error || 'No slots available for this designer. Please try another.');
      showLoading(false);
      return;
    }

    _availableSlots = slots;
    _slotsByDate = groupSlotsByDate(slots);

    populateDateDropdown();
    populateTypeDropdown();
    updateSelectedDesignerLabel(designerName);
    showSection('form');
    trackEvent('consultation_designer_selected', { designerId });
  } catch (err) {
    console.error('[VirtualConsultation] selectDesigner failed:', err);
    showError('Could not load available slots. Please try again.');
  } finally {
    showLoading(false);
  }
}

function populateDateDropdown() {
  const dates = Object.keys(_slotsByDate).sort();
  const options = dates.map(d => ({
    label: formatSlotDisplay(d, '09:00').split(' at ')[0], // "Wed, Apr 2"
    value: d,
  }));

  try {
    $w('#slotDateDropdown').options = options;
    $w('#slotDateDropdown').value = '';
    $w('#slotDateDropdown').onChange(() => {
      populateTimeDropdown($w('#slotDateDropdown').value);
    });
  } catch (e) {}
}

function populateTimeDropdown(dateStr) {
  const slots = _slotsByDate[dateStr] || [];
  const options = slots.map(s => ({
    label: formatSlotDisplay(dateStr, s.timeSlot).split(' at ')[1], // "10:00 AM"
    value: s.timeSlot,
  }));

  try {
    $w('#timeSlotDropdown').options = options;
    $w('#timeSlotDropdown').value = '';
  } catch (e) {}
}

function populateTypeDropdown() {
  const options = Object.entries(CONSULTATION_TYPES).map(([value, meta]) => ({
    label: meta.label,
    value,
  }));

  try {
    $w('#consultationTypeDropdown').options = options;
    $w('#consultationTypeDropdown').value = 'video';
  } catch (e) {}
}

function updateSelectedDesignerLabel(name) {
  try {
    $w('#selectedDesignerName').text = `Booking with ${name}`;
  } catch (e) {}
}

// ── Step 3: Submit booking ────────────────────────────────────────────────────

function initBookingForm() {
  try {
    $w('#bookBtn').onClick(async () => {
      await handleBookingSubmit();
    });
  } catch (e) {}
}

async function handleBookingSubmit() {
  hideError();

  let date = '';
  let timeSlot = '';
  let consultationType = '';
  let notes = '';

  try { date = $w('#slotDateDropdown').value; } catch (e) {}
  try { timeSlot = $w('#timeSlotDropdown').value; } catch (e) {}
  try { consultationType = $w('#consultationTypeDropdown').value || 'video'; } catch (e) {}
  try { notes = ($w('#notesInput').value || '').slice(0, 1000); } catch (e) {}

  const form = {
    designerId: _selectedDesignerId,
    date,
    timeSlot,
    consultationType,
  };

  const { valid, errors } = validateConsultationForm(form);
  if (!valid) {
    showError(errors[0]);
    return;
  }

  showLoading(true);
  try {
    $w('#bookBtn').disable();
  } catch (e) {}

  try {
    const result = await bookConsultation({ ...form, notes });

    if (!result.success) {
      showError(result.error || 'Booking failed. Please try again.');
      return;
    }

    showConfirmation({
      dateDisplay: formatSlotDisplay(date, timeSlot),
      typeLabel: getConsultationTypeLabel(consultationType),
      videoCallUrl: result.videoCallUrl || '',
    });

    trackEvent('consultation_booked', {
      designerId: _selectedDesignerId,
      consultationType,
    });
  } catch (err) {
    console.error('[VirtualConsultation] handleBookingSubmit failed:', err);
    showError('Unable to complete booking. Please try again or call (828) 252-9449.');
  } finally {
    showLoading(false);
    try { $w('#bookBtn').enable(); } catch (e) {}
  }
}

// ── Step 4: Confirmation ──────────────────────────────────────────────────────

function showConfirmation({ dateDisplay, typeLabel, videoCallUrl }) {
  showSection('confirmation');

  try {
    $w('#confirmationSummary').text = `Confirmed: ${dateDisplay} — ${typeLabel}`;
  } catch (e) {}

  try {
    if (videoCallUrl) {
      $w('#videoCallSection').show();
      $w('#videoCallLinkText').text = videoCallUrl;
    } else {
      $w('#videoCallSection').hide();
    }
  } catch (e) {}
}

function initConfirmationReset() {
  try {
    $w('#bookAnotherBtn').onClick(() => {
      _selectedDesignerId = '';
      _selectedDesignerName = '';
      _availableSlots = [];
      _slotsByDate = {};
      showSection('designers');
      hideError();
    });
  } catch (e) {}
}

// ── UI helpers ────────────────────────────────────────────────────────────────

/** Show one of: 'designers' | 'form' | 'confirmation' */
function showSection(section) {
  const ids = {
    designers: '#designerRepeater',
    form: '#bookingFormSection',
    confirmation: '#confirmationSection',
  };

  for (const [name, id] of Object.entries(ids)) {
    try {
      if (name === section) {
        $w(id).show();
      } else {
        $w(id).hide();
      }
    } catch (e) {}
  }
}

function showLoading(visible) {
  try {
    if (visible) {
      $w('#loadingSpinner').show();
    } else {
      $w('#loadingSpinner').hide();
    }
  } catch (e) {}
}

function showError(message) {
  try {
    $w('#bookingError').text = message;
    $w('#bookingError').show();
  } catch (e) {}
}

function hideError() {
  try {
    $w('#bookingError').hide();
    $w('#bookingError').text = '';
  } catch (e) {}
}

function specialtyLabel(specialty) {
  const labels = {
    'living-room': 'Living Room Expert',
    'bedroom': 'Bedroom Specialist',
    'office': 'Home Office Design',
    'multi-room': 'Whole-Home Design',
  };
  return labels[specialty] || specialty;
}
