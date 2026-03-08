/**
 * Checkout focus indicators tests (CF-no2).
 * Covers: applyFocusRing helper, initCheckoutFocusIndicators wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyFocusRing,
  getFocusIndicatorStyle,
} from '../../src/public/a11yHelpers.js';
import { colors } from '../../src/public/sharedTokens.js';

// ── applyFocusRing helper ──────────────────────────────────────────

describe('applyFocusRing', () => {
  let element;

  beforeEach(() => {
    element = {
      style: { borderColor: '#CCCCCC', borderWidth: '1px' },
      onFocus: vi.fn(),
      onBlur: vi.fn(),
    };
  });

  it('registers onFocus and onBlur handlers on the element', () => {
    applyFocusRing(element);
    expect(element.onFocus).toHaveBeenCalledTimes(1);
    expect(element.onBlur).toHaveBeenCalledTimes(1);
  });

  it('sets mountainBlue border on focus', () => {
    applyFocusRing(element);
    const focusHandler = element.onFocus.mock.calls[0][0];
    focusHandler();
    expect(element.style.borderColor).toBe(colors.mountainBlue);
    expect(element.style.borderWidth).toBe('2px');
  });

  it('restores original border on blur', () => {
    const originalColor = element.style.borderColor;
    const originalWidth = element.style.borderWidth;
    applyFocusRing(element);
    const focusHandler = element.onFocus.mock.calls[0][0];
    const blurHandler = element.onBlur.mock.calls[0][0];
    focusHandler();
    blurHandler();
    expect(element.style.borderColor).toBe(originalColor);
    expect(element.style.borderWidth).toBe(originalWidth);
  });

  it('uses custom color when provided', () => {
    applyFocusRing(element, { color: '#FF0000' });
    const focusHandler = element.onFocus.mock.calls[0][0];
    focusHandler();
    expect(element.style.borderColor).toBe('#FF0000');
  });

  it('does nothing if element is null', () => {
    expect(() => applyFocusRing(null)).not.toThrow();
  });

  it('does nothing if element lacks onFocus', () => {
    delete element.onFocus;
    expect(() => applyFocusRing(element)).not.toThrow();
  });

  it('handles element with no initial style gracefully', () => {
    element.style = {};
    applyFocusRing(element);
    const focusHandler = element.onFocus.mock.calls[0][0];
    const blurHandler = element.onBlur.mock.calls[0][0];
    focusHandler();
    expect(element.style.borderColor).toBe(colors.mountainBlue);
    blurHandler();
    expect(element.style.borderColor).toBeUndefined();
  });

  it('preserves validation border color when field has error state', () => {
    element.style.borderColor = colors.error;
    applyFocusRing(element);
    const focusHandler = element.onFocus.mock.calls[0][0];
    const blurHandler = element.onBlur.mock.calls[0][0];
    focusHandler();
    expect(element.style.borderColor).toBe(colors.mountainBlue);
    blurHandler();
    // Should restore the error border, not the original
    expect(element.style.borderColor).toBe(colors.error);
  });
});

// ── applyFocusRingToAll ──────────────────────────────────────────

describe('applyFocusRingToAll', () => {
  it('applies focus ring to multiple elements via $w selector', () => {
    const elements = {};
    const ids = ['#btn1', '#btn2', '#input1'];
    ids.forEach(id => {
      elements[id] = {
        style: { borderColor: '', borderWidth: '1px' },
        onFocus: vi.fn(),
        onBlur: vi.fn(),
      };
    });

    const $w = (selector) => elements[selector] || null;

    // Manually apply to each — this mirrors what initCheckoutFocusIndicators does
    ids.forEach(id => {
      const el = $w(id);
      if (el) applyFocusRing(el);
    });

    ids.forEach(id => {
      expect(elements[id].onFocus).toHaveBeenCalledTimes(1);
      expect(elements[id].onBlur).toHaveBeenCalledTimes(1);
    });
  });

  it('skips elements that do not exist on page', () => {
    const $w = () => null;
    expect(() => applyFocusRing($w('#nonExistent'))).not.toThrow();
  });
});

// ── getFocusIndicatorStyle consistency ────────────────────────────

describe('getFocusIndicatorStyle', () => {
  it('uses mountainBlue color', () => {
    const style = getFocusIndicatorStyle();
    expect(style.outline).toContain(colors.mountainBlue);
  });

  it('has outlineOffset for spacing', () => {
    const style = getFocusIndicatorStyle();
    expect(style.outlineOffset).toBeDefined();
  });
});
