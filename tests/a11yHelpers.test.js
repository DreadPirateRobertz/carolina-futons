/**
 * Tests for a11yHelpers.js — WCAG 2.1 AA accessibility utilities
 *
 * Covers: contrast ratio calculation, alt text validation, ARIA landmarks,
 * form field validation, focus management, skip navigation, keyboard patterns,
 * and design token contrast audit.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  meetsContrastAA,
  validateLandmarks,
  REQUIRED_LANDMARKS,
  validateAltText,
  validateFormField,
  getFocusIndicatorStyle,
  auditDesignTokenContrast,
  createFocusTrap,
  getKeyboardPattern,
  KEYBOARD_PATTERNS,
  initSkipNav,
  announce,
  setupAccessibleDialog,
  makeClickable,
} from '../src/public/a11yHelpers.js';

// ── hexToRgb ────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses standard hex with hash', () => {
    const rgb = hexToRgb('#FF0000');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses hex without hash', () => {
    const rgb = hexToRgb('00FF00');
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses white', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('#GGG')).toBeNull();
    expect(hexToRgb('')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });

  it('handles lowercase hex', () => {
    const rgb = hexToRgb('#abcdef');
    expect(rgb).toEqual({ r: 171, g: 205, b: 239 });
  });
});

// ── relativeLuminance ───────────────────────────────────────────────

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
  });

  it('returns 0 for black', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 2);
  });

  it('returns intermediate value for gray', () => {
    const lum = relativeLuminance({ r: 128, g: 128, b: 128 });
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

// ── contrastRatio ───────────────────────────────────────────────────

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('returns 1 for same colors', () => {
    expect(contrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 0);
  });

  it('is symmetric (fg/bg order does not matter)', () => {
    const r1 = contrastRatio('#3A2518', '#FFFFFF');
    const r2 = contrastRatio('#FFFFFF', '#3A2518');
    expect(r1).toBeCloseTo(r2, 2);
  });

  it('returns 0 for invalid colors', () => {
    expect(contrastRatio('invalid', '#FFFFFF')).toBe(0);
    expect(contrastRatio('#000000', null)).toBe(0);
  });
});

// ── meetsContrastAA ─────────────────────────────────────────────────

describe('meetsContrastAA', () => {
  it('black on white passes for normal text (21:1 >= 4.5:1)', () => {
    const result = meetsContrastAA('#000000', '#FFFFFF');
    expect(result.passes).toBe(true);
    expect(result.required).toBe(4.5);
  });

  it('fails for low contrast pair', () => {
    // Light gray on white
    const result = meetsContrastAA('#CCCCCC', '#FFFFFF');
    expect(result.passes).toBe(false);
  });

  it('uses 3:1 threshold for large text', () => {
    const result = meetsContrastAA('#767676', '#FFFFFF', 'large');
    expect(result.required).toBe(3);
  });

  it('returns ratio rounded to 2 decimal places', () => {
    const result = meetsContrastAA('#3A2518', '#FFFFFF');
    expect(String(result.ratio).split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });

  it('espresso on white passes AA', () => {
    const result = meetsContrastAA('#3A2518', '#FFFFFF');
    expect(result.passes).toBe(true);
  });
});

// ── validateLandmarks ───────────────────────────────────────────────

describe('validateLandmarks', () => {
  it('passes when all required landmarks present', () => {
    const result = validateLandmarks(['banner', 'navigation', 'main', 'contentinfo']);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('fails when landmarks are missing', () => {
    const result = validateLandmarks(['banner', 'main']);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('navigation');
    expect(result.missing).toContain('contentinfo');
  });

  it('fails with empty array', () => {
    const result = validateLandmarks([]);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(4);
  });

  it('handles case-insensitive input', () => {
    const result = validateLandmarks(['BANNER', 'Navigation', 'MAIN', 'ContentInfo']);
    expect(result.valid).toBe(true);
  });

  it('fails with non-array input', () => {
    const result = validateLandmarks(null);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(REQUIRED_LANDMARKS);
  });

  it('handles extra landmarks gracefully', () => {
    const result = validateLandmarks(['banner', 'navigation', 'main', 'contentinfo', 'search', 'complementary']);
    expect(result.valid).toBe(true);
  });
});

// ── validateAltText ─────────────────────────────────────────────────

describe('validateAltText', () => {
  it('passes for descriptive alt text', () => {
    const result = validateAltText('A blue futon frame in a living room');
    expect(result.valid).toBe(true);
  });

  it('passes for empty alt (decorative image)', () => {
    const result = validateAltText('');
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('Decorative');
  });

  it('fails for null (missing alt attribute)', () => {
    const result = validateAltText(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  it('fails for undefined', () => {
    const result = validateAltText(undefined);
    expect(result.valid).toBe(false);
  });

  it('fails for generic "image"', () => {
    const result = validateAltText('image');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Generic');
  });

  it('fails for generic "photo"', () => {
    expect(validateAltText('photo').valid).toBe(false);
  });

  it('fails for generic "picture"', () => {
    expect(validateAltText('picture').valid).toBe(false);
  });

  it('fails for file extensions', () => {
    expect(validateAltText('.jpg').valid).toBe(false);
    expect(validateAltText('.png').valid).toBe(false);
  });

  it('fails for whitespace-only alt text', () => {
    const result = validateAltText('   ');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('whitespace');
  });

  it('fails for very short alt text (< 3 chars)', () => {
    const result = validateAltText('ab');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('passes for alt text exactly 3 chars', () => {
    expect(validateAltText('Cat').valid).toBe(true);
  });
});

// ── validateFormField ───────────────────────────────────────────────

describe('validateFormField', () => {
  it('passes with label', () => {
    const result = validateFormField({ id: 'email', label: 'Email Address' });
    expect(result.valid).toBe(true);
  });

  it('passes with aria-label', () => {
    const result = validateFormField({ id: 'search', ariaLabel: 'Search products' });
    expect(result.valid).toBe(true);
  });

  it('passes with aria-labelledby', () => {
    const result = validateFormField({ id: 'qty', ariaLabelledBy: 'qtyLabel' });
    expect(result.valid).toBe(true);
  });

  it('fails without any label method', () => {
    const result = validateFormField({ id: 'input1' });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('label');
  });

  it('fails for required field without aria-required', () => {
    const result = validateFormField({ id: 'name', label: 'Name', required: true });
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('aria-required');
  });

  it('passes for required field with aria-required', () => {
    const result = validateFormField({ id: 'name', label: 'Name', required: true, ariaRequired: true });
    expect(result.valid).toBe(true);
  });

  it('fails with null input', () => {
    const result = validateFormField(null);
    expect(result.valid).toBe(false);
  });

  it('fails without id', () => {
    const result = validateFormField({ label: 'Test' });
    expect(result.valid).toBe(false);
  });
});

// ── getFocusIndicatorStyle ──────────────────────────────────────────

describe('getFocusIndicatorStyle', () => {
  it('returns outline style using design token color', () => {
    const style = getFocusIndicatorStyle();
    expect(style.outline).toContain('#5B8FA8'); // mountainBlue
    expect(style.outline).toContain('3px');
    expect(style.outlineOffset).toBe('2px');
  });
});

// ── auditDesignTokenContrast ────────────────────────────────────────

describe('auditDesignTokenContrast', () => {
  it('returns audit results for all token pairs', () => {
    const results = auditDesignTokenContrast();
    expect(results.length).toBeGreaterThan(0);

    for (const r of results) {
      expect(r).toHaveProperty('pair');
      expect(r).toHaveProperty('foreground');
      expect(r).toHaveProperty('background');
      expect(r).toHaveProperty('ratio');
      expect(r).toHaveProperty('passes');
      expect(r).toHaveProperty('textSize');
      expect(r.ratio).toBeGreaterThan(0);
    }
  });

  it('espresso on white passes contrast check', () => {
    const results = auditDesignTokenContrast();
    const espressoOnWhite = results.find(r => r.pair === 'espresso on white');
    expect(espressoOnWhite.passes).toBe(true);
  });

  it('white on espresso passes contrast check', () => {
    const results = auditDesignTokenContrast();
    const whiteOnEspresso = results.find(r => r.pair === 'white on espresso');
    expect(whiteOnEspresso.passes).toBe(true);
  });
});

// ── createFocusTrap ─────────────────────────────────────────────────

describe('createFocusTrap', () => {
  it('creates trap with first and last focusable IDs', () => {
    const trap = createFocusTrap('#modal', ['#closeBtn', '#input1', '#submitBtn']);
    expect(trap.firstId).toBe('#closeBtn');
    expect(trap.lastId).toBe('#submitBtn');
    expect(trap.isActive()).toBe(true);
  });

  it('release deactivates the trap', () => {
    const trap = createFocusTrap('#dialog', ['#btn1', '#btn2']);
    trap.release();
    expect(trap.isActive()).toBe(false);
  });

  it('returns no-op trap for empty focusableIds', () => {
    const trap = createFocusTrap('#modal', []);
    expect(trap.release).toBeInstanceOf(Function);
  });

  it('returns no-op trap for null containerId', () => {
    const trap = createFocusTrap(null, ['#btn']);
    expect(trap.release).toBeInstanceOf(Function);
  });
});

// ── getKeyboardPattern ──────────────────────────────────────────────

describe('getKeyboardPattern', () => {
  it('returns button pattern', () => {
    const pattern = getKeyboardPattern('button');
    expect(pattern.keys).toContain('Enter');
    expect(pattern.keys).toContain('Space');
    expect(pattern.role).toBe('button');
  });

  it('returns link pattern', () => {
    const pattern = getKeyboardPattern('link');
    expect(pattern.keys).toContain('Enter');
    expect(pattern.keys).not.toContain('Space');
  });

  it('returns dialog pattern with Escape', () => {
    const pattern = getKeyboardPattern('dialog');
    expect(pattern.keys).toContain('Escape');
  });

  it('returns null for unknown role', () => {
    expect(getKeyboardPattern('unknown')).toBeNull();
  });

  it('returns menu pattern with arrow keys', () => {
    const pattern = getKeyboardPattern('menu');
    expect(pattern.keys).toContain('ArrowUp');
    expect(pattern.keys).toContain('ArrowDown');
  });
});

// ── initSkipNav ─────────────────────────────────────────────────────

describe('initSkipNav', () => {
  it('does not throw with mock $w that throws', () => {
    const $w = () => { throw new Error('Element not found'); };
    expect(() => initSkipNav($w)).not.toThrow();
  });

  it('registers onClick handler when element exists', () => {
    let clickHandler = null;
    const $w = (id) => {
      if (id === '#skipNav') {
        return { onClick: (fn) => { clickHandler = fn; } };
      }
      return { scrollTo: () => {} };
    };

    initSkipNav($w);
    expect(clickHandler).toBeInstanceOf(Function);
  });

  it('clicking skip nav scrolls to main content', () => {
    let scrolled = false;
    const $w = (id) => {
      if (id === '#skipNav') {
        return { onClick: (fn) => fn() };
      }
      if (id === '#mainContent') {
        return { scrollTo: () => { scrolled = true; } };
      }
      throw new Error('Unknown element');
    };

    initSkipNav($w);
    expect(scrolled).toBe(true);
  });
});

// ── announce ──────────────────────────────────────────────────────────

describe('announce', () => {
  it('sets text on a11yLiveRegion element', () => {
    vi.useFakeTimers();
    let regionText = '';
    const $w = (id) => {
      if (id === '#a11yLiveRegion') {
        return {
          text: regionText,
          set text(v) { regionText = v; },
          get text() { return regionText; },
        };
      }
      throw new Error('Unknown element');
    };
    // Override getter/setter properly
    const region = { _text: '' };
    Object.defineProperty(region, 'text', {
      get() { return this._text; },
      set(v) { this._text = v; },
    });
    const mock$w = (id) => {
      if (id === '#a11yLiveRegion') return region;
      throw new Error('Unknown element');
    };

    announce(mock$w, 'Test announcement');
    // Initially cleared
    expect(region.text).toBe('');
    // After timeout, message is set
    vi.advanceTimersByTime(100);
    expect(region.text).toBe('Test announcement');
    vi.useRealTimers();
  });

  it('does not throw with empty message', () => {
    const $w = () => { throw new Error('Should not be called'); };
    expect(() => announce($w, '')).not.toThrow();
    expect(() => announce($w, null)).not.toThrow();
  });

  it('does not throw when element does not exist', () => {
    const $w = () => { throw new Error('Element not found'); };
    expect(() => announce($w, 'message')).not.toThrow();
  });

  it('falls back to announcementText when live region missing', () => {
    let announcementText = '';
    const $w = (id) => {
      if (id === '#a11yLiveRegion') throw new Error('Not found');
      if (id === '#announcementText') {
        return {
          role: 'status',
          get text() { return announcementText; },
          set text(v) { announcementText = v; },
        };
      }
      throw new Error('Unknown');
    };

    announce($w, 'Fallback test');
    expect(announcementText).toBe('Fallback test');
  });
});

// ── setupAccessibleDialog ─────────────────────────────────────────────

describe('setupAccessibleDialog', () => {
  it('returns open and close functions', () => {
    const $w = () => ({
      accessibility: {},
      show: () => {},
      hide: () => {},
      onClick: () => {},
    });

    const dialog = setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
    });

    expect(dialog.open).toBeInstanceOf(Function);
    expect(dialog.close).toBeInstanceOf(Function);
  });

  it('sets role dialog on panel', () => {
    const accessibility = {};
    const $w = (id) => {
      if (id === '#modal') {
        return {
          accessibility,
          show: () => {},
          hide: () => {},
        };
      }
      return {
        accessibility: {},
        onClick: () => {},
        show: () => {},
        hide: () => {},
      };
    };

    setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
    });

    expect(accessibility.role).toBe('dialog');
    expect(accessibility.ariaModal).toBe(true);
  });

  it('sets ariaLabelledBy when titleId provided', () => {
    const accessibility = {};
    const $w = (id) => {
      if (id === '#modal') {
        return { accessibility, show: () => {}, hide: () => {} };
      }
      return { accessibility: {}, onClick: () => {}, show: () => {}, hide: () => {} };
    };

    setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
      titleId: '#dialogTitle',
    });

    expect(accessibility.ariaLabelledBy).toBe('#dialogTitle');
  });

  it('wires close button onClick', () => {
    let closeHandler = null;
    const $w = (id) => {
      if (id === '#closeBtn') {
        return {
          accessibility: {},
          onClick: (fn) => { closeHandler = fn; },
        };
      }
      return { accessibility: {}, show: () => {}, hide: () => {} };
    };

    setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
    });

    expect(closeHandler).toBeInstanceOf(Function);
  });

  it('calls onClose callback when closed', () => {
    vi.useFakeTimers();
    let closed = false;
    let closeHandler = null;
    const $w = (id) => {
      if (id === '#closeBtn') {
        return {
          accessibility: {},
          onClick: (fn) => { closeHandler = fn; },
        };
      }
      if (id === '#a11yLiveRegion') {
        return { text: '', set text(v) {} };
      }
      return {
        accessibility: {},
        show: () => {},
        hide: () => {},
      };
    };

    setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
      onClose: () => { closed = true; },
    });

    closeHandler();
    expect(closed).toBe(true);
    vi.useRealTimers();
  });

  it('does not throw with missing elements', () => {
    const $w = () => { throw new Error('Element not found'); };
    expect(() => setupAccessibleDialog($w, {
      panelId: '#modal',
      closeId: '#closeBtn',
    })).not.toThrow();
  });
});

// ── makeClickable ──────────────────────────────────────────────────

describe('makeClickable', () => {
  it('registers onClick and onKeyPress handlers', () => {
    let clicked = false;
    let keyPressed = false;
    const element = {
      accessibility: {},
      onClick: (fn) => { clicked = true; },
      onKeyPress: (fn) => { keyPressed = true; },
    };

    makeClickable(element, () => {});
    expect(clicked).toBe(true);
    expect(keyPressed).toBe(true);
  });

  it('sets ariaLabel when provided', () => {
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: () => {},
    };

    makeClickable(element, () => {}, { ariaLabel: 'View product' });
    expect(element.accessibility.ariaLabel).toBe('View product');
  });

  it('sets role to button by default', () => {
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: () => {},
    };

    makeClickable(element, () => {}, { role: 'button' });
    expect(element.accessibility.role).toBe('button');
  });

  it('sets custom role when provided', () => {
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: () => {},
    };

    makeClickable(element, () => {}, { role: 'link' });
    expect(element.accessibility.role).toBe('link');
  });

  it('sets tabIndex to 0', () => {
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: () => {},
    };

    makeClickable(element, () => {});
    expect(element.accessibility.tabIndex).toBe(0);
  });

  it('calls handler on Enter key press', () => {
    let handlerCalled = false;
    let keyHandler = null;
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: (fn) => { keyHandler = fn; },
    };

    makeClickable(element, () => { handlerCalled = true; });
    keyHandler({ key: 'Enter' });
    expect(handlerCalled).toBe(true);
  });

  it('calls handler on Space key press', () => {
    let handlerCalled = false;
    let keyHandler = null;
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: (fn) => { keyHandler = fn; },
    };

    makeClickable(element, () => { handlerCalled = true; });
    keyHandler({ key: ' ' });
    expect(handlerCalled).toBe(true);
  });

  it('does not call handler on other keys', () => {
    let handlerCalled = false;
    let keyHandler = null;
    const element = {
      accessibility: {},
      onClick: () => {},
      onKeyPress: (fn) => { keyHandler = fn; },
    };

    makeClickable(element, () => { handlerCalled = true; });
    keyHandler({ key: 'Tab' });
    expect(handlerCalled).toBe(false);
  });

  it('does not throw with null element', () => {
    expect(() => makeClickable(null, () => {})).not.toThrow();
  });

  it('does not throw with null handler', () => {
    const element = { accessibility: {}, onClick: () => {}, onKeyPress: () => {} };
    expect(() => makeClickable(element, null)).not.toThrow();
  });

  it('does not throw when onKeyPress is not available', () => {
    const element = {
      accessibility: {},
      onClick: () => {},
      // No onKeyPress method
    };
    expect(() => makeClickable(element, () => {})).not.toThrow();
  });
});
