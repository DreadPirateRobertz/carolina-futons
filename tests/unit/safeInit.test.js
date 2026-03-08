import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeSelect,
  safeCall,
  safeText,
  safeClick,
  safeSrc,
  safeExpand,
  safeCollapse,
  safeAriaLabel,
} from '../../src/public/safeInit.js';

// Mock $w as a callable function that looks up elements
let mockElements;
let mock$w;

beforeEach(() => {
  mockElements = {};
  mock$w = (selector) => {
    if (mockElements[selector]) return mockElements[selector];
    throw new Error(`Element ${selector} not found`);
  };
  // Remove global $w to verify functions don't rely on it
  delete globalThis.$w;
});

function mockElement(selector, overrides = {}) {
  mockElements[selector] = {
    id: selector.replace('#', ''),
    text: '',
    src: '',
    accessibility: { ariaLabel: '' },
    onClick: vi.fn(),
    expand: vi.fn(),
    collapse: vi.fn(),
    ...overrides,
  };
  return mockElements[selector];
}

// ── safeSelect ──────────────────────────────────────────────────────

describe('safeSelect', () => {
  it('returns element when it exists (passed $w)', () => {
    const el = mockElement('#myBtn');
    expect(safeSelect(mock$w, '#myBtn')).toBe(el);
  });

  it('returns null when element does not exist', () => {
    expect(safeSelect(mock$w, '#nonexistent')).toBeNull();
  });

  it('does not use global $w', () => {
    globalThis.$w = () => { throw new Error('should not use global $w'); };
    const el = mockElement('#btn');
    expect(safeSelect(mock$w, '#btn')).toBe(el);
    delete globalThis.$w;
  });
});

// ── safeCall ────────────────────────────────────────────────────────

describe('safeCall', () => {
  it('executes function when no error', () => {
    const fn = vi.fn();
    safeCall(fn);
    expect(fn).toHaveBeenCalled();
  });

  it('swallows errors silently', () => {
    expect(() => {
      safeCall(() => { throw new Error('missing element'); });
    }).not.toThrow();
  });
});

// ── safeText ────────────────────────────────────────────────────────

describe('safeText', () => {
  it('sets text on existing element (passed $w)', () => {
    const el = mockElement('#title');
    safeText(mock$w, '#title', 'Hello World');
    expect(el.text).toBe('Hello World');
  });

  it('does nothing when element missing', () => {
    expect(() => safeText(mock$w, '#missing', 'test')).not.toThrow();
  });
});

// ── safeClick ───────────────────────────────────────────────────────

describe('safeClick', () => {
  it('binds click handler on existing element (passed $w)', () => {
    const el = mockElement('#btn');
    const handler = vi.fn();
    safeClick(mock$w, '#btn', handler);
    expect(el.onClick).toHaveBeenCalledWith(handler);
  });

  it('does nothing when element missing', () => {
    expect(() => safeClick(mock$w, '#missing', vi.fn())).not.toThrow();
  });
});

// ── safeSrc ─────────────────────────────────────────────────────────

describe('safeSrc', () => {
  it('sets src on existing element (passed $w)', () => {
    const el = mockElement('#img');
    safeSrc(mock$w, '#img', 'https://example.com/photo.jpg');
    expect(el.src).toBe('https://example.com/photo.jpg');
  });

  it('does nothing when element missing', () => {
    expect(() => safeSrc(mock$w, '#missing', 'url')).not.toThrow();
  });
});

// ── safeExpand / safeCollapse ───────────────────────────────────────

describe('safeExpand', () => {
  it('calls expand on existing element (passed $w)', () => {
    const el = mockElement('#section');
    safeExpand(mock$w, '#section');
    expect(el.expand).toHaveBeenCalled();
  });

  it('does nothing when element missing', () => {
    expect(() => safeExpand(mock$w, '#missing')).not.toThrow();
  });
});

describe('safeCollapse', () => {
  it('calls collapse on existing element (passed $w)', () => {
    const el = mockElement('#section');
    safeCollapse(mock$w, '#section');
    expect(el.collapse).toHaveBeenCalled();
  });

  it('does nothing when element missing', () => {
    expect(() => safeCollapse(mock$w, '#missing')).not.toThrow();
  });
});

// ── safeAriaLabel ───────────────────────────────────────────────────

describe('safeAriaLabel', () => {
  it('sets aria label on existing element (passed $w)', () => {
    const el = mockElement('#btn');
    safeAriaLabel(mock$w, '#btn', 'Close dialog');
    expect(el.accessibility.ariaLabel).toBe('Close dialog');
  });

  it('does nothing when element missing', () => {
    expect(() => safeAriaLabel(mock$w, '#missing', 'label')).not.toThrow();
  });
});
