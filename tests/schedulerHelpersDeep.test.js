/**
 * schedulerHelpersDeep.test.js — Edge-case tests for scheduler UI helpers.
 * Covers fallback paths, boundary inputs, and response shape completeness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/ups-shipping.web', () => ({
  validateAddress: vi.fn(async () => ({ valid: true })),
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

import {
  groupSlotsByDate,
  formatSlotDate,
  validateSchedulingForm,
  buildConfirmationData,
  getDeliveryTypeLabel,
  getDeliveryTypeDescription,
  validateAddressForShipping,
  isOversizedItem,
  getFreightMessage,
  DELIVERY_TYPES,
} from '../src/public/schedulerHelpers.js';

// ── buildConfirmationData — edge cases ──────────────────────────

describe('buildConfirmationData — edge cases', () => {
  it('returns null for null result', () => {
    expect(buildConfirmationData(null, {})).toBeNull();
  });

  it('returns null for undefined result', () => {
    expect(buildConfirmationData(undefined, {})).toBeNull();
  });

  it('falls back to raw timeWindow when not morning/afternoon', () => {
    const conf = buildConfirmationData(
      { success: true, scheduleId: 'x' },
      { date: '2026-03-04', timeWindow: 'evening', type: 'standard' }
    );
    expect(conf.timeLabel).toBe('evening');
  });

  it('defaults email and address to empty string when missing', () => {
    const conf = buildConfirmationData(
      { success: true, scheduleId: 'x' },
      { date: '2026-03-04', timeWindow: 'morning', type: 'standard' }
    );
    expect(conf.email).toBe('');
    expect(conf.address).toBe('');
  });

  it('uses "Delivery" as fallback for unknown type', () => {
    const conf = buildConfirmationData(
      { success: true, scheduleId: 'x' },
      { date: '2026-03-04', timeWindow: 'morning', type: 'express' }
    );
    expect(conf.typeLabel).toBe('Delivery');
  });

  it('response has exactly 6 keys', () => {
    const conf = buildConfirmationData(
      { success: true, scheduleId: 'sched-1' },
      { date: '2026-03-04', timeWindow: 'afternoon', type: 'white_glove', customerEmail: 'a@b.com', address: '123 Main' }
    );
    expect(Object.keys(conf).sort()).toEqual(
      ['address', 'date', 'email', 'scheduleId', 'timeLabel', 'typeLabel']
    );
  });
});

// ── formatSlotDate — edge cases ─────────────────────────────────

describe('formatSlotDate — edge cases', () => {
  it('returns empty string for garbage date string', () => {
    expect(formatSlotDate('not-a-date')).toBe('');
  });

  it('returns empty string for partial date', () => {
    expect(formatSlotDate('2026-13-99')).toBe('');
  });

  it('handles first day of year', () => {
    const result = formatSlotDate('2026-01-01');
    expect(result).toContain('Jan');
    expect(result).toContain('1');
  });

  it('handles last day of year', () => {
    const result = formatSlotDate('2026-12-31');
    expect(result).toContain('Dec');
    expect(result).toContain('31');
  });
});

// ── validateSchedulingForm — edge cases ─────────────────────────

describe('validateSchedulingForm — edge cases', () => {
  const validForm = {
    orderId: 'order-001',
    date: '2026-03-04',
    timeWindow: 'morning',
    type: 'standard',
    customerEmail: 'jane@example.com',
  };

  it('rejects non-object input (string)', () => {
    const result = validateSchedulingForm('form data');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Form data is required');
  });

  it('rejects non-object input (number)', () => {
    const result = validateSchedulingForm(42);
    expect(result.valid).toBe(false);
  });

  it('accepts afternoon timeWindow', () => {
    const result = validateSchedulingForm({ ...validForm, timeWindow: 'afternoon' });
    expect(result.valid).toBe(true);
  });

  it('does not require address for standard delivery', () => {
    const result = validateSchedulingForm({ ...validForm, type: 'standard' });
    expect(result.valid).toBe(true);
  });

  it('rejects missing customerEmail', () => {
    const { customerEmail, ...noEmail } = validForm;
    const result = validateSchedulingForm(noEmail);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Valid email address is required');
  });

  it('rejects empty string customerEmail', () => {
    const result = validateSchedulingForm({ ...validForm, customerEmail: '' });
    expect(result.valid).toBe(false);
  });

  it('accepts email with subdomain', () => {
    const result = validateSchedulingForm({ ...validForm, customerEmail: 'user@mail.example.com' });
    expect(result.valid).toBe(true);
  });

  it('collects all errors for completely empty form', () => {
    const result = validateSchedulingForm({});
    // Should have: orderId, date, timeWindow, email errors (at least 4)
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.valid).toBe(false);
  });
});

// ── getDeliveryTypeLabel / Description — edge cases ─────────────

describe('getDeliveryTypeLabel — edge cases', () => {
  it('returns "Delivery" for undefined', () => {
    expect(getDeliveryTypeLabel(undefined)).toBe('Delivery');
  });

  it('returns "Delivery" for null', () => {
    expect(getDeliveryTypeLabel(null)).toBe('Delivery');
  });

  it('returns "Delivery" for empty string', () => {
    expect(getDeliveryTypeLabel('')).toBe('Delivery');
  });
});

describe('getDeliveryTypeDescription — edge cases', () => {
  it('returns empty string for unknown type', () => {
    expect(getDeliveryTypeDescription('express')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(getDeliveryTypeDescription(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getDeliveryTypeDescription(undefined)).toBe('');
  });
});

// ── validateAddressForShipping — edge cases ─────────────────────

describe('validateAddressForShipping — edge cases', () => {
  let validateAddressMock;

  beforeEach(async () => {
    ({ validateAddress: validateAddressMock } = await import('backend/ups-shipping.web'));
    validateAddressMock.mockReset();
    validateAddressMock.mockResolvedValue({ valid: true });
  });

  it('returns invalid for ambiguous result with empty candidates array', async () => {
    validateAddressMock.mockResolvedValueOnce({ valid: false, ambiguous: true, candidates: [] });
    const result = await validateAddressForShipping({ addressLine1: '123 Main', postalCode: '28792' });
    // ambiguous with empty candidates falls through to generic error
    expect(result.valid).toBe(false);
    expect(result.error).toContain('could not be verified');
  });

  it('returns invalid for ambiguous result with no candidates key', async () => {
    validateAddressMock.mockResolvedValueOnce({ valid: false, ambiguous: true });
    const result = await validateAddressForShipping({ addressLine1: '123 Main', postalCode: '28792' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('could not be verified');
  });

  it('passes custom country when provided', async () => {
    await validateAddressForShipping({ addressLine1: '1 High St', postalCode: 'SW1A 1AA', country: 'GB' });
    expect(validateAddressMock).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'GB' })
    );
  });

  it('returns valid:true with no extra keys for clean valid response', async () => {
    validateAddressMock.mockResolvedValueOnce({ valid: true });
    const result = await validateAddressForShipping({ addressLine1: '123 Main', postalCode: '28792' });
    expect(result).toEqual({ valid: true });
  });
});

// ── isOversizedItem — edge cases ────────────────────────────────

describe('isOversizedItem — edge cases', () => {
  it('returns false for empty object', () => {
    expect(isOversizedItem({})).toBe(false);
  });

  it('returns false for item with name but undefined weight', () => {
    expect(isOversizedItem({ name: 'Futon Cover', weight: undefined })).toBe(false);
  });

  it('returns false for item with null weight', () => {
    expect(isOversizedItem({ name: 'Futon Cover', weight: null })).toBe(false);
  });

  it('returns true for murphy bed regardless of case variation', () => {
    expect(isOversizedItem({ name: 'murphy bed' })).toBe(true);
    expect(isOversizedItem({ name: 'MURPHY WALL BED' })).toBe(true);
    expect(isOversizedItem({ name: 'The Murphy Collection' })).toBe(true);
  });

  it('returns true for "cabinet bed" as exact phrase', () => {
    expect(isOversizedItem({ name: 'Arason Cabinet Bed' })).toBe(true);
  });

  it('weight threshold is exactly 150 (not 151)', () => {
    expect(isOversizedItem({ name: 'Heavy Frame', weight: 149.99 })).toBe(false);
    expect(isOversizedItem({ name: 'Heavy Frame', weight: 150 })).toBe(true);
  });

  it('handles weight as string that parses to number', () => {
    expect(isOversizedItem({ name: 'Frame', weight: '200' })).toBe(true);
    expect(isOversizedItem({ name: 'Frame', weight: '80' })).toBe(false);
  });
});

// ── groupSlotsByDate — edge cases ───────────────────────────────

describe('groupSlotsByDate — edge cases', () => {
  it('returns empty object for non-array input (string)', () => {
    expect(groupSlotsByDate('not an array')).toEqual({});
  });

  it('returns empty object for non-array input (number)', () => {
    expect(groupSlotsByDate(42)).toEqual({});
  });

  it('handles single slot', () => {
    const result = groupSlotsByDate([{ date: '2026-03-04', timeWindow: 'morning' }]);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['2026-03-04']).toHaveLength(1);
  });

  it('handles slots with same date correctly', () => {
    const slots = [
      { date: '2026-03-04', timeWindow: 'morning' },
      { date: '2026-03-04', timeWindow: 'afternoon' },
      { date: '2026-03-04', timeWindow: 'morning' }, // duplicate
    ];
    const result = groupSlotsByDate(slots);
    expect(result['2026-03-04']).toHaveLength(3);
  });
});

// ── DELIVERY_TYPES constant ─────────────────────────────────────

describe('DELIVERY_TYPES — shape validation', () => {
  it('has exactly white_glove and standard', () => {
    expect(Object.keys(DELIVERY_TYPES).sort()).toEqual(['standard', 'white_glove']);
  });

  it('white_glove description mentions assembly', () => {
    expect(DELIVERY_TYPES.white_glove.description.toLowerCase()).toContain('assembly');
  });

  it('standard description mentions curbside', () => {
    expect(DELIVERY_TYPES.standard.description.toLowerCase()).toContain('curbside');
  });
});
