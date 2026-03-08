/**
 * Checkout address autocomplete tests (CF-xmv).
 * Covers: AUTOCOMPLETE_HINTS mapping, applyAutocompleteHints wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AUTOCOMPLETE_HINTS,
  applyAutocompleteHints,
} from '../../src/public/checkoutValidation.js';

// ── AUTOCOMPLETE_HINTS mapping ──────────────────────────────────────

describe('AUTOCOMPLETE_HINTS', () => {
  it('maps all five address fields with shipping-scoped values', () => {
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

  it('logs warning and returns when $w is null or undefined', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => applyAutocompleteHints(null)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid $w'),
      expect.any(String),
    );
    warnSpy.mockClear();
    expect(() => applyAutocompleteHints(undefined)).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs warning and continues when element throws on property assignment', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwingEl = {
      get autocomplete() { return undefined; },
      set autocomplete(_) { throw new Error('readonly'); },
    };
    elements['#addressFullName'] = throwingEl;

    expect(() => applyAutocompleteHints($w)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('#addressFullName'),
      'readonly',
    );
    // Other fields still get set
    expect(elements['#addressLine1'].autocomplete).toBe('shipping address-line1');
    warnSpy.mockRestore();
  });
});
