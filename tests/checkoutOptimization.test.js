import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert } from './__mocks__/wix-data.js';
import {
  calculateOrderSummary,
  validateShippingAddress,
  getShippingOptions,
  getDeliveryEstimate,
  trackCheckoutStep,
  getAbandonmentRate,
  getExpressCheckoutSummary,
} from '../src/backend/checkoutOptimization.web.js';

beforeEach(() => {
  resetData();
});

// ── calculateOrderSummary ──────────────────────────────────────────

describe('calculateOrderSummary', () => {
  it('calculates subtotal for single item', () => {
    const result = calculateOrderSummary({
      items: [{ price: 499, quantity: 1 }],
    });
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(499);
    expect(result.data.itemCount).toBe(1);
  });

  it('calculates subtotal for multiple items', () => {
    const result = calculateOrderSummary({
      items: [
        { price: 599, quantity: 1 },
        { price: 299, quantity: 2 },
      ],
    });
    expect(result.data.subtotal).toBe(1197);
    expect(result.data.itemCount).toBe(3);
  });

  it('applies NC tax rate', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'NC',
    });
    expect(result.data.tax).toBe(67.5);
    expect(result.data.taxRate).toBe(0.0675);
  });

  it('applies SC tax rate', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'SC',
    });
    expect(result.data.tax).toBe(60);
  });

  it('uses default tax rate for unknown state', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'XX',
    });
    expect(result.data.taxRate).toBe(0.065);
  });

  it('does NOT give free shipping at $999 (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 999, quantity: 1 }],
    });
    expect(result.data.shipping.amount).toBe(49.99);
    expect(result.data.freeShippingProgress.qualifies).toBe(false);
  });

  it('charges shipping at $500 (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 500, quantity: 1 }],
    });
    expect(result.data.shipping.amount).toBe(49.99);
    expect(result.data.freeShippingProgress.qualifies).toBe(false);
    expect(result.data.freeShippingProgress.remaining).toBe(999499);
  });

  it('calculates near-zero free shipping progress percentage (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 500, quantity: 1 }],
    });
    expect(result.data.freeShippingProgress.percentage).toBe(0);
  });

  it('white glove local shipping', () => {
    const result = calculateOrderSummary({
      items: [{ price: 500, quantity: 1 }],
      shippingMethod: 'white_glove_local',
    });
    expect(result.data.shipping.amount).toBe(149);
  });

  it('white glove regional shipping', () => {
    const result = calculateOrderSummary({
      items: [{ price: 500, quantity: 1 }],
      shippingMethod: 'white_glove_regional',
    });
    expect(result.data.shipping.amount).toBe(249);
  });

  it('does NOT give free white glove at $2000 (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 2000, quantity: 1 }],
      shippingMethod: 'white_glove_local',
    });
    expect(result.data.shipping.amount).toBe(149);
  });

  it('calculates correct total with shipping (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'NC',
    });
    // 1000 + 49.99 (shipping) + 67.5 (tax) = 1117.49
    expect(result.data.total).toBe(1117.49);
  });

  it('fails with empty items', () => {
    const result = calculateOrderSummary({ items: [] });
    expect(result.success).toBe(false);
  });

  it('fails with null params', () => {
    const result = calculateOrderSummary(null);
    expect(result.success).toBe(false);
  });

  it('fails with no items array', () => {
    const result = calculateOrderSummary({ items: 'not array' });
    expect(result.success).toBe(false);
  });

  it('skips negative price items', () => {
    const result = calculateOrderSummary({
      items: [
        { price: 500, quantity: 1 },
        { price: -100, quantity: 1 },
      ],
    });
    expect(result.data.subtotal).toBe(500);
  });

  it('clamps quantity to 1-99', () => {
    const result = calculateOrderSummary({
      items: [{ price: 100, quantity: 200 }],
    });
    expect(result.data.itemCount).toBe(99);
  });

  it('handles case-insensitive state', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'nc',
    });
    expect(result.data.taxRate).toBe(0.0675);
  });

  it('limits items to 50', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ price: 10, quantity: 1 }));
    const result = calculateOrderSummary({ items });
    expect(result.data.subtotal).toBe(500); // 50 * 10
  });
});

// ── validateShippingAddress ────────────────────────────────────────

describe('validateShippingAddress', () => {
  const validAddress = {
    fullName: 'John Doe',
    addressLine1: '824 Locust St',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
  };

  it('accepts valid address', () => {
    const result = validateShippingAddress(validAddress);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('accepts ZIP+4 format', () => {
    const result = validateShippingAddress({ ...validAddress, zip: '28792-1234' });
    expect(result.valid).toBe(true);
  });

  it('rejects missing name', () => {
    const result = validateShippingAddress({ ...validAddress, fullName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('rejects short name', () => {
    const result = validateShippingAddress({ ...validAddress, fullName: 'J' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing street', () => {
    const result = validateShippingAddress({ ...validAddress, addressLine1: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('address') || e.toLowerCase().includes('street'))).toBe(true);
  });

  it('rejects missing city', () => {
    const result = validateShippingAddress({ ...validAddress, city: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid state code', () => {
    const result = validateShippingAddress({ ...validAddress, state: 'XYZ' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid ZIP', () => {
    const result = validateShippingAddress({ ...validAddress, zip: '123' });
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors', () => {
    const result = validateShippingAddress({ fullName: '', addressLine1: '', city: '', state: '', zip: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('fails for null input', () => {
    const result = validateShippingAddress(null);
    expect(result.success).toBe(false);
  });

  it('fails for non-object input', () => {
    const result = validateShippingAddress('string');
    expect(result.success).toBe(false);
  });
});

// ── getShippingOptions ─────────────────────────────────────────────

describe('getShippingOptions', () => {
  it('returns 3 shipping options', () => {
    const result = getShippingOptions(500);
    expect(result.success).toBe(true);
    expect(result.options).toHaveLength(3);
  });

  it('does NOT show free standard shipping at $1000 (free shipping disabled)', () => {
    const result = getShippingOptions(1000);
    const standard = result.options.find(o => o.id === 'standard');
    expect(standard.price).toBe(49.99);
  });

  it('charges standard shipping below $999', () => {
    const result = getShippingOptions(500);
    const standard = result.options.find(o => o.id === 'standard');
    expect(standard.price).toBe(49.99);
  });

  it('does NOT show free white glove at $2000 (free shipping disabled)', () => {
    const result = getShippingOptions(2000);
    const wgLocal = result.options.find(o => o.id === 'white_glove_local');
    expect(wgLocal.price).toBe(149);
  });

  it('includes delivery time estimates', () => {
    const result = getShippingOptions(500);
    result.options.forEach(opt => {
      expect(opt.estimatedDays.min).toBeGreaterThan(0);
      expect(opt.estimatedDays.max).toBeGreaterThan(opt.estimatedDays.min);
    });
  });

  it('includes descriptions', () => {
    const result = getShippingOptions(500);
    result.options.forEach(opt => {
      expect(opt.description).toBeDefined();
      expect(opt.description.length).toBeGreaterThan(0);
    });
  });
});

// ── getDeliveryEstimate ────────────────────────────────────────────

describe('getDeliveryEstimate', () => {
  it('returns standard delivery estimate', () => {
    const result = getDeliveryEstimate('standard');
    expect(result.success).toBe(true);
    expect(result.data.minDate).toBeDefined();
    expect(result.data.maxDate).toBeDefined();
    expect(result.data.label).toContain('–');
  });

  it('returns white glove local estimate', () => {
    const result = getDeliveryEstimate('white_glove_local');
    expect(result.success).toBe(true);
  });

  it('returns white glove regional estimate', () => {
    const result = getDeliveryEstimate('white_glove_regional');
    expect(result.success).toBe(true);
  });

  it('defaults to standard for unknown method', () => {
    const result = getDeliveryEstimate('unknown');
    expect(result.success).toBe(true);
    expect(result.data.minDate).toBeDefined();
  });

  it('defaults to standard for null input', () => {
    const result = getDeliveryEstimate(null);
    expect(result.success).toBe(true);
  });

  it('min date is before max date', () => {
    const result = getDeliveryEstimate('standard');
    expect(new Date(result.data.minDate) < new Date(result.data.maxDate)).toBe(true);
  });

  it('dates are in ISO format', () => {
    const result = getDeliveryEstimate('standard');
    expect(result.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── trackCheckoutStep ──────────────────────────────────────────────

describe('trackCheckoutStep', () => {
  it('tracks a checkout start', async () => {
    const result = await trackCheckoutStep({
      sessionId: 'session-abc',
      step: 'start',
      cartTotal: 999,
      itemCount: 2,
    });
    expect(result.success).toBe(true);
  });

  it('tracks checkout complete', async () => {
    const result = await trackCheckoutStep({
      sessionId: 'session-abc',
      step: 'complete',
      cartTotal: 1500,
      itemCount: 3,
    });
    expect(result.success).toBe(true);
  });

  it('tracks abandon step', async () => {
    const result = await trackCheckoutStep({
      sessionId: 'session-xyz',
      step: 'abandon',
    });
    expect(result.success).toBe(true);
  });

  it('stores metadata as JSON', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await trackCheckoutStep({
      sessionId: 'session-123',
      step: 'payment',
      metadata: { paymentMethod: 'credit_card' },
    });

    expect(inserted).toBeDefined();
    expect(JSON.parse(inserted.metadata)).toEqual({ paymentMethod: 'credit_card' });
  });

  it('requires session ID', async () => {
    const result = await trackCheckoutStep({ sessionId: '', step: 'start' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session ID');
  });

  it('rejects invalid step', async () => {
    const result = await trackCheckoutStep({ sessionId: 'abc', step: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid step');
  });

  it('fails with null data', async () => {
    const result = await trackCheckoutStep(null);
    expect(result.success).toBe(false);
  });

  it('clamps cartTotal to non-negative', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await trackCheckoutStep({
      sessionId: 'test',
      step: 'start',
      cartTotal: -100,
    });

    expect(inserted.cartTotal).toBe(0);
  });
});

// ── getAbandonmentRate ─────────────────────────────────────────────

describe('getAbandonmentRate', () => {
  it('calculates abandonment rate', async () => {
    __seed('CheckoutAnalytics', [
      { _id: 'a1', step: 'start', timestamp: new Date() },
      { _id: 'a2', step: 'start', timestamp: new Date() },
      { _id: 'a3', step: 'start', timestamp: new Date() },
      { _id: 'a4', step: 'complete', timestamp: new Date() },
    ]);

    const result = await getAbandonmentRate(7);
    expect(result.success).toBe(true);
    expect(result.data.totalStarts).toBe(3);
    expect(result.data.totalCompletes).toBe(1);
    expect(result.data.abandonRate).toBe(66.67);
  });

  it('returns 0% with no starts', async () => {
    __seed('CheckoutAnalytics', []);
    const result = await getAbandonmentRate(7);
    expect(result.success).toBe(true);
    expect(result.data.abandonRate).toBe(0);
  });

  it('clamps days to 1-90', async () => {
    __seed('CheckoutAnalytics', []);
    const result = await getAbandonmentRate(200);
    expect(result.success).toBe(true);
    expect(result.data.period).toBe('90 days');
  });

  it('defaults to 7 days', async () => {
    __seed('CheckoutAnalytics', []);
    const result = await getAbandonmentRate();
    expect(result.data.period).toBe('7 days');
  });
});

// ── getExpressCheckoutSummary ───────────────────────────────────────

describe('getExpressCheckoutSummary', () => {
  it('generates express checkout summary', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 1200, quantity: 1 }],
      address: {
        fullName: 'Jane Smith',
        addressLine1: '100 Main St',
        city: 'Asheville',
        state: 'NC',
        zip: '28801',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(1200);
    expect(result.data.shipping.amount).toBe(49.99); // Free shipping disabled
    expect(result.data.expressReady).toBe(true);
    expect(result.data.shippingAddress.state).toBe('NC');
  });

  it('fails without items', () => {
    const result = getExpressCheckoutSummary({
      items: [],
      address: { state: 'NC' },
    });
    expect(result.success).toBe(false);
  });

  it('fails without address', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 100, quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('fails without state in address', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 100, quantity: 1 }],
      address: { fullName: 'Test' },
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes address fields', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 100, quantity: 1 }],
      address: {
        fullName: '<script>alert(1)</script>Jane',
        addressLine1: '100 Main St',
        city: 'Asheville',
        state: 'NC',
        zip: '28801',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.shippingAddress.fullName).not.toContain('<script>');
  });
});
