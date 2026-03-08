/**
 * Tests for checkoutProgress.js — Checkout step progress indicator logic
 */
import { describe, it, expect } from 'vitest';
import {
  getCheckoutSteps,
  getActiveStepIndex,
  getStepAriaAttributes,
} from '../../src/public/checkoutProgress.js';

// ── getCheckoutSteps ──────────────────────────────────────────────────

describe('getCheckoutSteps', () => {
  it('returns 4 checkout steps', () => {
    const steps = getCheckoutSteps();
    expect(steps).toHaveLength(4);
  });

  it('returns steps in correct order', () => {
    const steps = getCheckoutSteps();
    expect(steps.map(s => s.id)).toEqual(['information', 'shipping', 'payment', 'review']);
  });

  it('each step has id, label, and number', () => {
    const steps = getCheckoutSteps();
    steps.forEach(step => {
      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('label');
      expect(step).toHaveProperty('number');
      expect(typeof step.id).toBe('string');
      expect(typeof step.label).toBe('string');
      expect(typeof step.number).toBe('number');
    });
  });

  it('returns a defensive copy (not a reference)', () => {
    const steps1 = getCheckoutSteps();
    const steps2 = getCheckoutSteps();
    expect(steps1).not.toBe(steps2);
    steps1[0].label = 'Modified';
    expect(getCheckoutSteps()[0].label).toBe('Information');
  });
});

// ── getActiveStepIndex ────────────────────────────────────────────────

describe('getActiveStepIndex', () => {
  it('returns correct index for each step ID', () => {
    expect(getActiveStepIndex('information')).toBe(0);
    expect(getActiveStepIndex('shipping')).toBe(1);
    expect(getActiveStepIndex('payment')).toBe(2);
    expect(getActiveStepIndex('review')).toBe(3);
  });

  it('returns 0 for unknown step ID', () => {
    expect(getActiveStepIndex('unknown')).toBe(0);
    expect(getActiveStepIndex('confirmation')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(getActiveStepIndex(null)).toBe(0);
    expect(getActiveStepIndex(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getActiveStepIndex('')).toBe(0);
  });

  it('returns 0 for non-string types', () => {
    expect(getActiveStepIndex(123)).toBe(0);
    expect(getActiveStepIndex({})).toBe(0);
  });
});

// ── getStepAriaAttributes ─────────────────────────────────────────────

describe('getStepAriaAttributes', () => {
  it('returns completed state for steps before active', () => {
    const attrs = getStepAriaAttributes(0, 2, 'Information');
    expect(attrs.state).toBe('completed');
    expect(attrs.ariaLabel).toContain('completed');
    expect(attrs.ariaLabel).toContain('Information');
    expect(attrs).not.toHaveProperty('ariaCurrent');
  });

  it('returns active state for current step', () => {
    const attrs = getStepAriaAttributes(1, 1, 'Shipping');
    expect(attrs.state).toBe('active');
    expect(attrs.ariaCurrent).toBe('step');
    expect(attrs.ariaLabel).toContain('current');
    expect(attrs.ariaLabel).toContain('Shipping');
  });

  it('returns pending state for steps after active', () => {
    const attrs = getStepAriaAttributes(3, 1, 'Review');
    expect(attrs.state).toBe('pending');
    expect(attrs.ariaLabel).toContain('Review');
    expect(attrs.ariaLabel).not.toContain('completed');
    expect(attrs.ariaLabel).not.toContain('current');
    expect(attrs).not.toHaveProperty('ariaCurrent');
  });

  it('includes step number in aria-label', () => {
    const attrs = getStepAriaAttributes(2, 2, 'Payment');
    expect(attrs.ariaLabel).toContain('Step 3');
  });

  it('uses default label when none provided', () => {
    const attrs = getStepAriaAttributes(0, 0);
    expect(attrs.ariaLabel).toContain('Step 1');
  });

  it('handles first step as active', () => {
    const attrs = getStepAriaAttributes(0, 0, 'Information');
    expect(attrs.state).toBe('active');
    expect(attrs.ariaCurrent).toBe('step');
  });

  it('handles last step as active with all preceding completed', () => {
    expect(getStepAriaAttributes(0, 3).state).toBe('completed');
    expect(getStepAriaAttributes(1, 3).state).toBe('completed');
    expect(getStepAriaAttributes(2, 3).state).toBe('completed');
    expect(getStepAriaAttributes(3, 3).state).toBe('active');
  });
});
