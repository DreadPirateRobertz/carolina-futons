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
} from '../src/public/safeInit.js';

// Mock $w globally
let mockElements;

beforeEach(() => {
  mockElements = {};
  globalThis.$w = (selector) => {
    if (mockElements[selector]) return mockElements[selector];
    throw new Error(`Element ${selector} not found`);
  };
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
  it('returns element when it exists', () => {
    const el = mockElement('#myBtn');
    expect(safeSelect('#myBtn')).toBe(el);
  });

  it('returns null when element does not exist', () => {
    expect(safeSelect('#nonexistent')).toBeNull();
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
  it('sets text on existing element', () => {
    const el = mockElement('#title');
    safeText('#title', 'Hello World');
    expect(el.text).toBe('Hello World');
  });

  it('does nothing when element missing', () => {
    expect(() => safeText('#missing', 'test')).not.toThrow();
  });
});

// ── safeClick ───────────────────────────────────────────────────────

describe('safeClick', () => {
  it('binds click handler on existing element', () => {
    const el = mockElement('#btn');
    const handler = vi.fn();
    safeClick('#btn', handler);
    expect(el.onClick).toHaveBeenCalledWith(handler);
  });

  it('does nothing when element missing', () => {
    expect(() => safeClick('#missing', vi.fn())).not.toThrow();
  });
});

// ── safeSrc ─────────────────────────────────────────────────────────

describe('safeSrc', () => {
  it('sets src on existing element', () => {
    const el = mockElement('#img');
    safeSrc('#img', 'https://example.com/photo.jpg');
    expect(el.src).toBe('https://example.com/photo.jpg');
  });

  it('does nothing when element missing', () => {
    expect(() => safeSrc('#missing', 'url')).not.toThrow();
  });
});

// ── safeExpand / safeCollapse ───────────────────────────────────────

describe('safeExpand', () => {
  it('calls expand on existing element', () => {
    const el = mockElement('#section');
    safeExpand('#section');
    expect(el.expand).toHaveBeenCalled();
  });

  it('does nothing when element missing', () => {
    expect(() => safeExpand('#missing')).not.toThrow();
  });
});

describe('safeCollapse', () => {
  it('calls collapse on existing element', () => {
    const el = mockElement('#section');
    safeCollapse('#section');
    expect(el.collapse).toHaveBeenCalled();
  });

  it('does nothing when element missing', () => {
    expect(() => safeCollapse('#missing')).not.toThrow();
  });
});

// ── safeAriaLabel ───────────────────────────────────────────────────

describe('safeAriaLabel', () => {
  it('sets aria label on existing element', () => {
    const el = mockElement('#btn');
    safeAriaLabel('#btn', 'Close dialog');
    expect(el.accessibility.ariaLabel).toBe('Close dialog');
  });

  it('does nothing when element missing', () => {
    expect(() => safeAriaLabel('#missing', 'label')).not.toThrow();
  });
});
