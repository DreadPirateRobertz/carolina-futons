/**
 * @file swatchKitWidget.test.js
 * @description Tests for SwatchKitWidget.js pure helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  isSelectionValid,
  toggleSwatch,
  formatSelectionCount,
  buildAddToCartState,
  buildCreditBannerText,
  buildSelectionError,
  buildCreditStatusText,
  MIN_SWATCHES,
  MAX_SWATCHES,
  KIT_PRICE,
  QUALIFYING_MIN,
} from '../src/public/SwatchKitWidget.js';

// ---------------------------------------------------------------------------
// isSelectionValid
// ---------------------------------------------------------------------------

describe('isSelectionValid', () => {
  it('returns false for empty array', () => {
    expect(isSelectionValid([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSelectionValid(null)).toBe(false);
  });

  it('returns true for 1 selection', () => {
    expect(isSelectionValid(['a'])).toBe(true);
  });

  it('returns true for exactly 5 selections', () => {
    expect(isSelectionValid(['a', 'b', 'c', 'd', 'e'])).toBe(true);
  });

  it('returns false for 6 selections', () => {
    expect(isSelectionValid(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleSwatch
// ---------------------------------------------------------------------------

describe('toggleSwatch', () => {
  it('adds a swatch to empty selection', () => {
    expect(toggleSwatch([], 'sw-1')).toEqual(['sw-1']);
  });

  it('removes a swatch already in selection', () => {
    expect(toggleSwatch(['sw-1', 'sw-2'], 'sw-1')).toEqual(['sw-2']);
  });

  it('does not add beyond MAX_SWATCHES', () => {
    const full = ['a', 'b', 'c', 'd', 'e'];
    expect(toggleSwatch(full, 'f')).toEqual(full);
  });

  it('does not mutate the original array', () => {
    const original = ['sw-1'];
    const result = toggleSwatch(original, 'sw-2');
    expect(original).toEqual(['sw-1']);
    expect(result).toEqual(['sw-1', 'sw-2']);
  });

  it('returns empty array for null current', () => {
    expect(toggleSwatch(null, 'sw-1')).toEqual([]);
  });

  it('returns current array when swatchId is empty', () => {
    const arr = ['sw-1'];
    expect(toggleSwatch(arr, '')).toBe(arr);
  });
});

// ---------------------------------------------------------------------------
// formatSelectionCount
// ---------------------------------------------------------------------------

describe('formatSelectionCount', () => {
  it('uses singular for 1 swatch', () => {
    expect(formatSelectionCount(['a'])).toBe(`1 of ${MAX_SWATCHES} swatch selected`);
  });

  it('uses plural for 0 swatches', () => {
    expect(formatSelectionCount([])).toBe(`0 of ${MAX_SWATCHES} swatches selected`);
  });

  it('uses plural for 3 swatches', () => {
    expect(formatSelectionCount(['a', 'b', 'c'])).toBe(`3 of ${MAX_SWATCHES} swatches selected`);
  });

  it('handles null gracefully', () => {
    expect(formatSelectionCount(null)).toBe(`0 of ${MAX_SWATCHES} swatches selected`);
  });
});

// ---------------------------------------------------------------------------
// buildAddToCartState
// ---------------------------------------------------------------------------

describe('buildAddToCartState', () => {
  it('disabled with generic label for empty selection', () => {
    const state = buildAddToCartState([]);
    expect(state.disabled).toBe(true);
    expect(state.label).toBe('Select 1–5 swatches');
  });

  it('enabled with item count and price for valid selection', () => {
    const state = buildAddToCartState(['a', 'b', 'c']);
    expect(state.disabled).toBe(false);
    expect(state.label).toContain('3');
    expect(state.label).toContain(`$${KIT_PRICE}`);
  });
});

// ---------------------------------------------------------------------------
// buildCreditBannerText
// ---------------------------------------------------------------------------

describe('buildCreditBannerText', () => {
  it('mentions refund amount and qualifying minimum', () => {
    const text = buildCreditBannerText();
    expect(text).toContain(`$${KIT_PRICE}`);
    expect(text).toContain(`$${QUALIFYING_MIN}`);
  });
});

// ---------------------------------------------------------------------------
// buildSelectionError
// ---------------------------------------------------------------------------

describe('buildSelectionError', () => {
  it('returns empty string for valid selection', () => {
    expect(buildSelectionError(['a'])).toBe('');
  });

  it('returns error for empty selection', () => {
    expect(buildSelectionError([])).not.toBe('');
  });

  it('returns error for null', () => {
    expect(buildSelectionError(null)).not.toBe('');
  });

  it('returns error for over-limit selection', () => {
    const err = buildSelectionError(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(err).toContain(String(MAX_SWATCHES));
  });
});

// ---------------------------------------------------------------------------
// buildCreditStatusText
// ---------------------------------------------------------------------------

describe('buildCreditStatusText', () => {
  it('returns empty string when no pending credit', () => {
    expect(buildCreditStatusText({ hasPendingCredit: false })).toBe('');
    expect(buildCreditStatusText(null)).toBe('');
  });

  it('returns empty string for auth_required response (cf-2ag)', () => {
    // Backend signals stale session by returning { hasPendingCredit: false,
    // error: 'auth_required' }. Banner must stay hidden rather than showing
    // the pending-credit text to an unauthenticated viewer.
    expect(
      buildCreditStatusText({ hasPendingCredit: false, error: 'auth_required' }),
    ).toBe('');
  });

  it('returns text with amount when pending credit has no expiry', () => {
    const text = buildCreditStatusText({ hasPendingCredit: true, amount: 5 });
    expect(text).toContain('$5');
    expect(text).toContain(`$${QUALIFYING_MIN}`);
  });

  it('includes expiry date when provided', () => {
    const text = buildCreditStatusText({
      hasPendingCredit: true,
      amount: 5,
      expiresAt: new Date('2026-06-26T00:00:00Z'),
    });
    expect(text).toContain('Jun');
    expect(text).toContain('2026');
  });
});
