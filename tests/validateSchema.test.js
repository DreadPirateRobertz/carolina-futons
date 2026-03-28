/**
 * @file validateSchema.test.js
 * @description CF-5r7k: Tests for validateSchema utility and endpoint wiring.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSchema } from '../src/backend/utils/validateSchema.js';
import { __reset, __seed } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── validateSchema unit tests ───────────────────────────────────────

describe('validateSchema', () => {
  it('returns empty array for valid data', () => {
    const errors = validateSchema({ name: 'Alice', email: 'a@b.com' }, {
      name: { type: 'string', required: true, maxLength: 200 },
      email: { type: 'string', required: true, maxLength: 254 },
    });
    expect(errors).toEqual([]);
  });

  it('returns error for missing required fields', () => {
    const errors = validateSchema({}, {
      email: { type: 'string', required: true, label: 'Email' },
    });
    expect(errors).toEqual(['Email is required.']);
  });

  it('returns error for null/undefined data', () => {
    const errors = validateSchema(null, { name: { type: 'string' } });
    expect(errors).toEqual(['Request data is required.']);
  });

  it('returns error for wrong type (string expected, number given)', () => {
    const errors = validateSchema({ age: 25 }, {
      age: { type: 'string', label: 'Age' },
    });
    expect(errors).toEqual(['Age must be text.']);
  });

  it('returns error for wrong type (number expected, string given)', () => {
    const errors = validateSchema({ qty: 'five' }, {
      qty: { type: 'number', label: 'Quantity' },
    });
    expect(errors).toEqual(['Quantity must be a number.']);
  });

  it('catches NaN as invalid number', () => {
    const errors = validateSchema({ qty: NaN }, {
      qty: { type: 'number', label: 'Quantity' },
    });
    expect(errors).toEqual(['Quantity must be a number.']);
  });

  it('returns error for string exceeding maxLength', () => {
    const errors = validateSchema({ name: 'x'.repeat(201) }, {
      name: { type: 'string', maxLength: 200, label: 'Name' },
    });
    expect(errors).toEqual(['Name is too long (max 200 characters).']);
  });

  it('returns error for number below min', () => {
    const errors = validateSchema({ qty: 0 }, {
      qty: { type: 'number', min: 1, label: 'Quantity' },
    });
    expect(errors).toEqual(['Quantity must be at least 1.']);
  });

  it('returns error for number above max', () => {
    const errors = validateSchema({ qty: 999999 }, {
      qty: { type: 'number', max: 99999, label: 'Quantity' },
    });
    expect(errors).toEqual(['Quantity must be at most 99999.']);
  });

  it('returns error for value not in allowedValues', () => {
    const errors = validateSchema({ tier: 'diamond' }, {
      tier: { type: 'string', allowedValues: ['basic', 'extended', 'premium'], label: 'Tier' },
    });
    expect(errors).toEqual(['Tier is not a valid option.']);
  });

  it('accepts value in allowedValues', () => {
    const errors = validateSchema({ tier: 'basic' }, {
      tier: { type: 'string', allowedValues: ['basic', 'extended', 'premium'] },
    });
    expect(errors).toEqual([]);
  });

  it('returns error for string not matching pattern', () => {
    const errors = validateSchema({ date: 'not-a-date' }, {
      date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, label: 'Date' },
    });
    expect(errors).toEqual(['Date format is invalid.']);
  });

  it('accepts string matching pattern', () => {
    const errors = validateSchema({ date: '2026-03-28' }, {
      date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ },
    });
    expect(errors).toEqual([]);
  });

  it('skips optional fields that are absent', () => {
    const errors = validateSchema({}, {
      phone: { type: 'string', maxLength: 20 },
    });
    expect(errors).toEqual([]);
  });

  it('uses field name as label when label not provided', () => {
    const errors = validateSchema({}, {
      contactEmail: { type: 'string', required: true },
    });
    expect(errors).toEqual(['contactEmail is required.']);
  });

  it('collects multiple errors', () => {
    const errors = validateSchema({}, {
      name: { type: 'string', required: true, label: 'Name' },
      email: { type: 'string', required: true, label: 'Email' },
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBe('Name is required.');
    expect(errors[1]).toBe('Email is required.');
  });

  it('validates boolean type', () => {
    const errors = validateSchema({ active: 'yes' }, {
      active: { type: 'boolean', label: 'Active' },
    });
    expect(errors).toEqual(['Active must be true or false.']);
  });
});

// ── Endpoint wiring integration tests ───────────────────────────────

describe('contactSubmissions — schema validation', () => {
  it('rejects oversized name field', async () => {
    const { submitContactForm } = await import('../src/backend/contactSubmissions.web.js');
    const result = await submitContactForm({
      email: 'test@example.com',
      name: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too long/i);
  });

  it('rejects non-string email', async () => {
    const { submitContactForm } = await import('../src/backend/contactSubmissions.web.js');
    const result = await submitContactForm({ email: 12345 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/must be text/i);
  });
});

describe('tradeProgram — schema validation', () => {
  it('rejects missing business name', async () => {
    const { applyForTradeAccount } = await import('../src/backend/tradeProgram.web.js');
    const result = await applyForTradeAccount({
      contactName: 'Jane',
      contactEmail: 'biz@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/business name.*required/i);
  });

  it('rejects oversized annual units', async () => {
    const { applyForTradeAccount } = await import('../src/backend/tradeProgram.web.js');
    const result = await applyForTradeAccount({
      businessName: 'Test',
      contactName: 'Jane',
      contactEmail: 'biz@example.com',
      estimatedAnnualUnits: 999999,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at most/i);
  });
});

describe('deliveryScheduling — schema validation', () => {
  it('rejects invalid delivery type', async () => {
    const { reserveDeliveryWindow } = await import('../src/backend/deliveryScheduling.web.js');
    const result = await reserveDeliveryWindow({
      orderId: 'ord-1',
      date: '2026-04-01',
      timeSlot: 'morning',
      deliveryType: 'drone',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not a valid option/i);
  });

  it('rejects invalid date format', async () => {
    const { reserveDeliveryWindow } = await import('../src/backend/deliveryScheduling.web.js');
    const result = await reserveDeliveryWindow({
      orderId: 'ord-1',
      date: 'tomorrow',
      timeSlot: 'morning',
      deliveryType: 'local',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/format is invalid/i);
  });
});

describe('giftRegistry — schema validation', () => {
  it('rejects oversized buyer name', async () => {
    const { markItemPurchased } = await import('../src/backend/giftRegistry.web.js');
    const result = await markItemPurchased('valid-item-id-1234567890', {
      buyerName: 'x'.repeat(51),
      quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too long/i);
  });

  it('rejects quantity below minimum', async () => {
    const { markItemPurchased } = await import('../src/backend/giftRegistry.web.js');
    const result = await markItemPurchased('valid-item-id-1234567890', {
      quantity: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at least 1/i);
  });
});
