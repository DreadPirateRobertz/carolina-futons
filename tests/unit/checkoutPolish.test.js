/**
 * Checkout flow polish tests.
 * Covers: progress indicator logic, real-time form validation,
 * order summary sidebar data, express checkout flow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import {
  getCheckoutSteps,
  getActiveStepIndex,
  getStepAriaAttributes,
} from '../../src/public/checkoutProgress.js';
import {
  validateField,
  validateAddressField,
  getFieldValidationState,
} from '../../src/public/checkoutValidation.js';
import {
  calculateOrderSummary,
  getExpressCheckoutSummary,
} from '../../src/backend/checkoutOptimization.web.js';

beforeEach(() => {
  resetData();
});

// ── Checkout Progress Indicator ──────────────────────────────────────

describe('checkoutProgress: getCheckoutSteps', () => {
  it('returns 4 steps in correct order', () => {
    const steps = getCheckoutSteps();
    expect(steps).toHaveLength(4);
    expect(steps.map(s => s.id)).toEqual([
      'information',
      'shipping',
      'payment',
      'review',
    ]);
  });

  it('each step has required properties', () => {
    const steps = getCheckoutSteps();
    for (const step of steps) {
      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('label');
      expect(step).toHaveProperty('number');
      expect(typeof step.id).toBe('string');
      expect(typeof step.label).toBe('string');
      expect(typeof step.number).toBe('number');
    }
  });

  it('steps are numbered 1-4', () => {
    const steps = getCheckoutSteps();
    expect(steps.map(s => s.number)).toEqual([1, 2, 3, 4]);
  });
});

describe('checkoutProgress: getActiveStepIndex', () => {
  it('returns 0 for information step', () => {
    expect(getActiveStepIndex('information')).toBe(0);
  });

  it('returns 1 for shipping step', () => {
    expect(getActiveStepIndex('shipping')).toBe(1);
  });

  it('returns 2 for payment step', () => {
    expect(getActiveStepIndex('payment')).toBe(2);
  });

  it('returns 3 for review step', () => {
    expect(getActiveStepIndex('review')).toBe(3);
  });

  it('returns 0 for unknown step ID', () => {
    expect(getActiveStepIndex('unknown')).toBe(0);
  });

  it('returns 0 for null input', () => {
    expect(getActiveStepIndex(null)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getActiveStepIndex('')).toBe(0);
  });
});

describe('checkoutProgress: getStepAriaAttributes', () => {
  it('marks active step with aria-current', () => {
    const attrs = getStepAriaAttributes(1, 1);
    expect(attrs.ariaCurrent).toBe('step');
    expect(attrs.state).toBe('active');
  });

  it('marks completed steps', () => {
    const attrs = getStepAriaAttributes(0, 2);
    expect(attrs.ariaCurrent).toBeUndefined();
    expect(attrs.state).toBe('completed');
  });

  it('marks future steps as pending', () => {
    const attrs = getStepAriaAttributes(3, 1);
    expect(attrs.ariaCurrent).toBeUndefined();
    expect(attrs.state).toBe('pending');
  });

  it('returns ariaLabel with step number and label', () => {
    const steps = getCheckoutSteps();
    const attrs = getStepAriaAttributes(0, 0, steps[0].label);
    expect(attrs.ariaLabel).toContain('Step 1');
    expect(attrs.ariaLabel).toContain(steps[0].label);
  });

  it('includes completed status in ariaLabel', () => {
    const attrs = getStepAriaAttributes(0, 2, 'Information');
    expect(attrs.ariaLabel).toContain('completed');
  });

  it('includes current status in ariaLabel', () => {
    const attrs = getStepAriaAttributes(1, 1, 'Shipping');
    expect(attrs.ariaLabel).toContain('current');
  });
});

// ── Real-Time Form Validation ──────────────────────────────────────

describe('checkoutValidation: validateField', () => {
  it('validates required non-empty string', () => {
    const result = validateField('John Doe', { required: true, minLength: 2 });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects empty required field', () => {
    const result = validateField('', { required: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects too-short value', () => {
    const result = validateField('J', { required: true, minLength: 2 });
    expect(result.valid).toBe(false);
  });

  it('validates against regex pattern', () => {
    const result = validateField('28801', { pattern: /^\d{5}(-\d{4})?$/ });
    expect(result.valid).toBe(true);
  });

  it('rejects non-matching pattern', () => {
    const result = validateField('abc', { pattern: /^\d{5}(-\d{4})?$/ });
    expect(result.valid).toBe(false);
  });

  it('strips HTML from input before validating', () => {
    const result = validateField('<b>John</b>', { required: true, minLength: 2 });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('John');
  });

  it('allows empty non-required field', () => {
    const result = validateField('', { required: false });
    expect(result.valid).toBe(true);
  });

  it('handles null input', () => {
    const result = validateField(null, { required: true });
    expect(result.valid).toBe(false);
  });

  it('handles undefined input', () => {
    const result = validateField(undefined, { required: true });
    expect(result.valid).toBe(false);
  });

  it('handles numeric input gracefully', () => {
    const result = validateField(12345, { required: true });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('12345');
  });
});

describe('checkoutValidation: validateAddressField', () => {
  it('validates fullName', () => {
    const result = validateAddressField('fullName', 'Jane Doe');
    expect(result.valid).toBe(true);
  });

  it('rejects short fullName', () => {
    const result = validateAddressField('fullName', 'J');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2');
  });

  it('validates addressLine1', () => {
    const result = validateAddressField('addressLine1', '123 Main St');
    expect(result.valid).toBe(true);
  });

  it('rejects short address', () => {
    const result = validateAddressField('addressLine1', 'St');
    expect(result.valid).toBe(false);
  });

  it('validates city', () => {
    const result = validateAddressField('city', 'Asheville');
    expect(result.valid).toBe(true);
  });

  it('rejects short city', () => {
    const result = validateAddressField('city', 'A');
    expect(result.valid).toBe(false);
  });

  it('validates 2-letter state code', () => {
    const result = validateAddressField('state', 'NC');
    expect(result.valid).toBe(true);
  });

  it('validates lowercase state code', () => {
    const result = validateAddressField('state', 'nc');
    expect(result.valid).toBe(true);
  });

  it('rejects 3-letter state code', () => {
    const result = validateAddressField('state', 'NCC');
    expect(result.valid).toBe(false);
  });

  it('rejects numeric state code', () => {
    const result = validateAddressField('state', '12');
    expect(result.valid).toBe(false);
  });

  it('validates 5-digit ZIP', () => {
    const result = validateAddressField('zip', '28801');
    expect(result.valid).toBe(true);
  });

  it('validates ZIP+4', () => {
    const result = validateAddressField('zip', '28801-1234');
    expect(result.valid).toBe(true);
  });

  it('rejects short ZIP', () => {
    const result = validateAddressField('zip', '288');
    expect(result.valid).toBe(false);
  });

  it('rejects alphabetic ZIP', () => {
    const result = validateAddressField('zip', 'ABCDE');
    expect(result.valid).toBe(false);
  });

  it('handles unknown field name gracefully', () => {
    const result = validateAddressField('unknown', 'value');
    expect(result.valid).toBe(true);
  });

  it('strips XSS from field value', () => {
    const result = validateAddressField('fullName', '<script>alert(1)</script>');
    // Sanitization strips tags; remaining text 'alert(1)' passes minLength
    expect(result.sanitized).not.toContain('<script>');
    expect(result.sanitized).toBe('alert(1)');
  });

  it('rejects XSS that leaves too-short value', () => {
    const result = validateAddressField('fullName', '<b>A</b>');
    expect(result.valid).toBe(false);
    expect(result.sanitized).toBe('A');
  });

  it('rejects empty required field', () => {
    const result = validateAddressField('fullName', '');
    expect(result.valid).toBe(false);
  });
});

describe('checkoutValidation: getFieldValidationState', () => {
  it('returns idle for untouched empty field', () => {
    const state = getFieldValidationState('', false);
    expect(state).toBe('idle');
  });

  it('returns valid for touched valid field', () => {
    const state = getFieldValidationState('John Doe', true, { valid: true });
    expect(state).toBe('valid');
  });

  it('returns error for touched invalid field', () => {
    const state = getFieldValidationState('J', true, { valid: false });
    expect(state).toBe('error');
  });

  it('returns idle for untouched but filled field', () => {
    const state = getFieldValidationState('John', false);
    expect(state).toBe('idle');
  });
});

// ── Order Summary Sidebar Data ──────────────────────────────────────

describe('Order summary sidebar via calculateOrderSummary', () => {
  it('provides all fields needed for sidebar display', () => {
    const result = calculateOrderSummary({
      items: [
        { price: 549, quantity: 1, name: 'Monterey Frame' },
        { price: 299, quantity: 1, name: 'Blazing Needles Mattress' },
      ],
      state: 'NC',
      shippingMethod: 'standard',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('subtotal');
    expect(result.data).toHaveProperty('shipping');
    expect(result.data).toHaveProperty('tax');
    expect(result.data).toHaveProperty('total');
    expect(result.data).toHaveProperty('itemCount');
    expect(result.data).toHaveProperty('freeShippingProgress');
    expect(result.data.shipping).toHaveProperty('amount');
    expect(result.data.shipping).toHaveProperty('label');
  });

  it('updates shipping cost when method changes', () => {
    const items = [{ price: 800, quantity: 1 }];

    const standard = calculateOrderSummary({ items, state: 'NC', shippingMethod: 'standard' });
    const wgLocal = calculateOrderSummary({ items, state: 'NC', shippingMethod: 'white_glove_local' });

    expect(standard.data.shipping.amount).toBe(49.99);
    expect(wgLocal.data.shipping.amount).toBe(149);
    expect(wgLocal.data.total).toBeGreaterThan(standard.data.total);
  });

  it('does not qualify for free shipping at $1000 (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 1000, quantity: 1 }],
      state: 'NC',
    });

    expect(result.data.freeShippingProgress.qualifies).toBe(false);
    expect(result.data.freeShippingProgress.remaining).toBe(999999 - 1000);
  });

  it('shows accurate remaining for free shipping (free shipping disabled)', () => {
    const result = calculateOrderSummary({
      items: [{ price: 700, quantity: 1 }],
      state: 'NC',
    });

    expect(result.data.freeShippingProgress.qualifies).toBe(false);
    expect(result.data.freeShippingProgress.remaining).toBe(999999 - 700);
    expect(result.data.freeShippingProgress.percentage).toBe(0);
  });
});

// ── Express Checkout Integration ────────────────────────────────────

describe('Express checkout flow', () => {
  it('generates complete express summary with valid inputs', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 549, quantity: 1 }],
      address: {
        fullName: 'Jane Doe',
        addressLine1: '123 Main St',
        city: 'Asheville',
        state: 'NC',
        zip: '28801',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.expressReady).toBe(true);
    expect(result.data.subtotal).toBe(549);
    expect(result.data.total).toBeGreaterThan(549); // Includes tax + possible shipping
    expect(result.data.shippingAddress.fullName).toBe('Jane Doe');
    expect(result.data.shippingAddress.state).toBe('NC');
  });

  it('express checkout with free shipping tier', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 1200, quantity: 1 }],
      address: {
        fullName: 'John Smith',
        addressLine1: '456 Oak Ave',
        city: 'Charleston',
        state: 'SC',
        zip: '29401',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.shipping.amount).toBe(49.99); // Free shipping disabled
    expect(result.data.tax).toBeCloseTo(1200 * 0.06, 2);
  });

  it('fails gracefully without address', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 549, quantity: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('address');
  });

  it('fails gracefully with empty cart', () => {
    const result = getExpressCheckoutSummary({
      items: [],
      address: { state: 'NC' },
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes XSS in express checkout address', () => {
    const result = getExpressCheckoutSummary({
      items: [{ price: 100, quantity: 1 }],
      address: {
        fullName: '<img onerror=alert(1) src=x>Jane',
        addressLine1: '123 Main',
        city: 'Test',
        state: 'NC',
        zip: '28801',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.shippingAddress.fullName).not.toContain('<img');
    expect(result.data.shippingAddress.fullName).not.toContain('onerror');
  });

  it('handles multi-item express checkout', () => {
    const result = getExpressCheckoutSummary({
      items: [
        { price: 549, quantity: 1 },
        { price: 299, quantity: 2 },
      ],
      address: {
        fullName: 'Test User',
        addressLine1: '789 Pine',
        city: 'Raleigh',
        state: 'NC',
        zip: '27601',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(1147); // 549 + 598
    expect(result.data.itemCount).toBe(3);
  });
});
