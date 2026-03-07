/**
 * Checkout address autocomplete tests (CF-xmv).
 * Covers: AUTOCOMPLETE_HINTS mapping, applyAutocompleteHints wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AUTOCOMPLETE_HINTS,
  applyAutocompleteHints,
} from '../src/public/checkoutValidation.js';

// ── AUTOCOMPLETE_HINTS mapping ──────────────────────────────────────

describe('AUTOCOMPLETE_HINTS', () => {
  it('maps all five address fields', () => {
    expect(AUTOCOMPLETE_HINTS).toHaveProperty('#addressFullName');
    expect(AUTOCOMPLETE_HINTS).toHaveProperty('#addressLine1');
    expect(AUTOCOMPLETE_HINTS).toHaveProperty('#addressCity');
    expect(AUTOCOMPLETE_HINTS).toHaveProperty('#addressState');
    expect(AUTOCOMPLETE_HINTS).toHaveProperty('#addressZip');
  });

  it('uses shipping-scoped autocomplete values', () => {
    expect(AUTOCOMPLETE_HINTS['#addressFullName']).toBe('shipping name');
    expect(AUTOCOMPLETE_HINTS['#addressLine1']).toBe('shipping address-line1');
    expect(AUTOCOMPLETE_HINTS['#addressCity']).toBe('shipping address-level2');
    expect(AUTOCOMPLETE_HINTS['#addressState']).toBe('shipping address-level1');
    expect(AUTOCOMPLETE_HINTS['#addressZip']).toBe('shipping postal-code');
  });
});

// ── applyAutocompleteHints ──────────────────────────────────────────

describe('applyAutocompleteHints', () => {
  let elements;
  let $w;

  beforeEach(() => {
    elements = {};
    Object.keys(AUTOCOMPLETE_HINTS).forEach(id => {
      elements[id] = {
        autocomplete: undefined,
        accessibility: {},
      };
    });
    $w = (selector) => elements[selector] || null;
  });

  it('sets autocomplete attribute on all address fields', () => {
    applyAutocompleteHints($w);

    expect(elements['#addressFullName'].autocomplete).toBe('shipping name');
    expect(elements['#addressLine1'].autocomplete).toBe('shipping address-line1');
    expect(elements['#addressCity'].autocomplete).toBe('shipping address-level2');
    expect(elements['#addressState'].autocomplete).toBe('shipping address-level1');
    expect(elements['#addressZip'].autocomplete).toBe('shipping postal-code');
  });

  it('does not throw when an element is missing from the page', () => {
    const sparse$w = (selector) => {
      if (selector === '#addressCity') return null;
      return elements[selector] || null;
    };

    expect(() => applyAutocompleteHints(sparse$w)).not.toThrow();
    // Other fields still get set
    expect(elements['#addressFullName'].autocomplete).toBe('shipping name');
    expect(elements['#addressZip'].autocomplete).toBe('shipping postal-code');
  });

  it('does not throw when $w is null or undefined', () => {
    expect(() => applyAutocompleteHints(null)).not.toThrow();
    expect(() => applyAutocompleteHints(undefined)).not.toThrow();
  });

  it('handles element that throws on property assignment', () => {
    const throwingEl = {
      get autocomplete() { return undefined; },
      set autocomplete(_) { throw new Error('readonly'); },
      accessibility: {},
    };
    elements['#addressFullName'] = throwingEl;

    expect(() => applyAutocompleteHints($w)).not.toThrow();
    // Other fields still get set
    expect(elements['#addressLine1'].autocomplete).toBe('shipping address-line1');
  });

  it('does not overwrite existing autocomplete if already set correctly', () => {
    elements['#addressFullName'].autocomplete = 'shipping name';
    applyAutocompleteHints($w);
    expect(elements['#addressFullName'].autocomplete).toBe('shipping name');
  });
});
