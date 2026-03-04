/**
 * @module consultationHelpers
 * @description Customer-facing virtual consultation booking UI helpers.
 * Provides form validation, slot formatting, and booking confirmation
 * display logic for the consultation booking flow.
 */

// ── Constants ───────────────────────────────────────────────────────

export const MAX_PHOTOS = 10;

export const CONSULTATION_TYPES = {
  video: {
    label: 'Video Call',
    description: 'Face-to-face video consultation with screen sharing for room visualization.',
  },
  phone: {
    label: 'Phone Call',
    description: 'Voice consultation — great for quick design questions and follow-ups.',
  },
};

export const TIME_SLOTS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
];

// ── Form Validation ─────────────────────────────────────────────────

/**
 * Validate consultation booking form before submission.
 * @param {Object} form - Form data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateConsultationForm(form) {
  if (!form || typeof form !== 'object') {
    return { valid: false, errors: ['Form data is required'] };
  }

  const errors = [];

  if (!form.designerId) {
    errors.push('Please select a designer');
  }

  if (!form.date) {
    errors.push('Please select a date');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  if (!form.timeSlot) {
    errors.push('Please select a time slot');
  }

  if (!form.consultationType || !CONSULTATION_TYPES[form.consultationType]) {
    errors.push('Please select a consultation type');
  }

  return { valid: errors.length === 0, errors };
}

// ── Display Formatting ──────────────────────────────────────────────

/**
 * Format a consultation slot for display.
 * @param {string} dateStr - YYYY-MM-DD date
 * @param {string} timeSlot - HH:MM time
 * @returns {string} Formatted string like "Wed, Apr 1 at 10:00 AM"
 */
export function formatSlotDisplay(dateStr, timeSlot) {
  if (!dateStr || !timeSlot) return '';

  try {
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return '';

    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();

    const slotEntry = TIME_SLOTS.find(s => s.value === timeSlot);
    const timeLabel = slotEntry ? slotEntry.label : timeSlot;

    return `${dayName}, ${month} ${day} at ${timeLabel}`;
  } catch {
    return '';
  }
}

/**
 * Get the display label for a consultation type.
 * @param {string} type - 'video' or 'phone'
 * @returns {string}
 */
export function getConsultationTypeLabel(type) {
  return CONSULTATION_TYPES[type]?.label || 'Consultation';
}

// ── Booking Confirmation ────────────────────────────────────────────

/**
 * Build confirmation display data from booking result and form.
 * @param {Object} result - Result from bookConsultation
 * @param {Object} form - Original form data
 * @returns {Object|null}
 */
export function buildBookingConfirmation(result, form) {
  if (!result || !result.success) return null;

  return {
    bookingId: result.bookingId,
    videoCallUrl: result.videoCallUrl || '',
    dateDisplay: formatSlotDisplay(form.date, form.timeSlot),
    typeLabel: getConsultationTypeLabel(form.consultationType),
    notes: form.notes || '',
  };
}

// ── Slot Grouping ───────────────────────────────────────────────────

/**
 * Group consultation slots by date for calendar display.
 * @param {Array} slots - Slots from getAvailableConsultationSlots
 * @returns {Object} Map of date string -> slot array
 */
export function groupSlotsByDate(slots) {
  if (!Array.isArray(slots)) return {};

  const grouped = {};
  for (const slot of slots) {
    if (!grouped[slot.date]) {
      grouped[slot.date] = [];
    }
    grouped[slot.date].push(slot);
  }
  return grouped;
}

// ── Photo Validation ────────────────────────────────────────────────

/**
 * Validate a photo URL for upload.
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export function isPhotoUrlValid(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
