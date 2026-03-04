/**
 * @module schedulerHelpers
 * @description Customer-facing delivery scheduler UI helpers.
 * Provides logic for white-glove delivery scheduling, address validation
 * before rate calc, and oversized item freight detection.
 *
 * Used by checkout and member pages to let customers pick delivery windows.
 */

import { validateAddress } from 'backend/ups-shipping.web';

// ── Delivery Type Constants ──────────────────────────────────────────

export const DELIVERY_TYPES = {
  white_glove: {
    label: 'White Glove Delivery',
    description: 'In-home placement, packaging removal, and basic assembly. Wed-Sat, 9am-5pm.',
  },
  standard: {
    label: 'Standard Delivery',
    description: 'Curbside delivery to your front door or garage.',
  },
};

const TIME_LABELS = {
  morning: '9:00 AM - 12:00 PM',
  afternoon: '1:00 PM - 5:00 PM',
};

const OVERSIZED_WEIGHT_THRESHOLD = 150;
const OVERSIZED_KEYWORDS = ['murphy', 'cabinet bed'];

// ── Slot Grouping ────────────────────────────────────────────────────

/**
 * Group delivery slots by date for calendar display.
 * @param {Array} slots - Slots from getAvailableDeliverySlots
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

// ── Date Formatting ──────────────────────────────────────────────────

/**
 * Format a slot date for human display.
 * @param {string} dateStr - YYYY-MM-DD date string
 * @param {string} [dayOfWeek] - Day abbreviation (Wed, Thu, etc.)
 * @returns {string} Formatted date like "Wed, Mar 4"
 */
export function formatSlotDate(dateStr, dayOfWeek) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return '';

    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const prefix = dayOfWeek ? `${dayOfWeek}, ` : '';
    return `${prefix}${month} ${day}`;
  } catch {
    return '';
  }
}

// ── Form Validation ──────────────────────────────────────────────────

/**
 * Validate the delivery scheduling form before submission.
 * @param {Object} form - Form data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateSchedulingForm(form) {
  if (!form || typeof form !== 'object') {
    return { valid: false, errors: ['Form data is required'] };
  }

  const errors = [];

  if (!form.orderId) {
    errors.push('Order ID is required');
  }

  if (!form.date) {
    errors.push('Delivery date is required');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  if (!form.timeWindow) {
    errors.push('Time window is required');
  } else if (form.timeWindow !== 'morning' && form.timeWindow !== 'afternoon') {
    errors.push('Time window must be morning or afternoon');
  }

  if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
    errors.push('Valid email address is required');
  } else if (!form.customerEmail) {
    errors.push('Valid email address is required');
  }

  if (form.type === 'white_glove' && !form.address) {
    errors.push('Delivery address is required');
  }

  return { valid: errors.length === 0, errors };
}

// ── Confirmation Builder ─────────────────────────────────────────────

/**
 * Build confirmation display data from a schedule result and form data.
 * @param {Object} result - Result from scheduleDelivery
 * @param {Object} form - Original form data
 * @returns {Object|null} Confirmation data or null if failed
 */
export function buildConfirmationData(result, form) {
  if (!result || !result.success) return null;

  return {
    scheduleId: result.scheduleId,
    date: form.date,
    timeLabel: TIME_LABELS[form.timeWindow] || form.timeWindow,
    typeLabel: getDeliveryTypeLabel(form.type),
    email: form.customerEmail || '',
    address: form.address || '',
  };
}

// ── Delivery Type Helpers ────────────────────────────────────────────

/**
 * Get the display label for a delivery type.
 * @param {string} type - 'white_glove' or 'standard'
 * @returns {string}
 */
export function getDeliveryTypeLabel(type) {
  return DELIVERY_TYPES[type]?.label || 'Delivery';
}

/**
 * Get the description for a delivery type.
 * @param {string} type - 'white_glove' or 'standard'
 * @returns {string}
 */
export function getDeliveryTypeDescription(type) {
  return DELIVERY_TYPES[type]?.description || '';
}

// ── Address Validation ───────────────────────────────────────────────

/**
 * Validate a shipping address using UPS before rate calculation.
 * Fails open — if UPS validation is unavailable, allows the address through.
 * @param {Object} address - Address fields
 * @returns {Promise<{valid: boolean, candidates?: Array, serviceUnavailable?: boolean, error?: string}>}
 */
export async function validateAddressForShipping(address) {
  if (!address || typeof address !== 'object') {
    return { valid: false, error: 'Shipping address is required' };
  }

  if (!address.addressLine1 || !address.addressLine1.trim()) {
    return { valid: false, error: 'Street address is required' };
  }

  if (!address.postalCode || !address.postalCode.trim()) {
    return { valid: false, error: 'Zip/postal code is required' };
  }

  try {
    const result = await validateAddress({
      addressLine1: address.addressLine1,
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode,
      country: address.country || 'US',
    });

    // Fail open: if the validation service is unavailable, let the order through
    if (result.unavailable) {
      return { valid: true, serviceUnavailable: true };
    }

    if (result.valid) {
      return { valid: true };
    }

    if (result.ambiguous && result.candidates?.length > 0) {
      return { valid: false, candidates: result.candidates };
    }

    return { valid: false, error: 'Address could not be verified. Please check and try again.' };
  } catch {
    // Network error — fail open
    return { valid: true, serviceUnavailable: true };
  }
}

// ── Oversized Item Detection ─────────────────────────────────────────

/**
 * Check if an item requires freight/LTL shipping (oversized).
 * @param {Object} item - Product line item with name and weight
 * @returns {boolean}
 */
export function isOversizedItem(item) {
  if (!item) return false;

  const name = (item.name || '').toLowerCase();
  const weight = Number(item.weight) || 0;

  // Murphy/cabinet beds are always oversized
  if (OVERSIZED_KEYWORDS.some(kw => name.includes(kw))) return true;

  // Anything over 150 lbs needs freight
  if (weight >= OVERSIZED_WEIGHT_THRESHOLD) return true;

  return false;
}

/**
 * Get freight shipping message for oversized items.
 * @param {boolean} hasOversized - Whether the order has oversized items
 * @returns {string}
 */
export function getFreightMessage(hasOversized) {
  if (!hasOversized) return '';
  return 'This order contains oversized items that require freight shipping. Our team will contact you to arrange delivery scheduling and provide a freight quote. White Glove delivery is recommended for oversized items.';
}
