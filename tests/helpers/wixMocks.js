/**
 * Shared Wix Velo mock helpers for tests.
 *
 * Provides createMockElement() and create$w() used across 140+ test files.
 * Import from 'tests/helpers/wixMocks.js' instead of redefining per file.
 */
import { vi } from 'vitest';

/**
 * Create a mock Wix Velo page element with all common properties.
 * Covers: text, images, forms, repeaters, accessibility, layout, and event handlers.
 *
 * @param {Object} [overrides] - Properties to override on the mock element
 * @returns {Object} Mock Wix element
 */
export function createMockElement(overrides = {}) {
  const el = {
    // Content properties
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    items: [],
    data: [],
    options: [],

    // State properties
    hidden: false,
    collapsed: false,
    checked: false,
    htmlElement: null,

    // Style
    style: {
      color: '',
      fontWeight: '',
      backgroundColor: '',
      borderColor: '',
      borderWidth: '',
      boxShadow: '',
      opacity: 0,
      ...overrides.style,
    },

    // Accessibility
    accessibility: {
      ...overrides.accessibility,
    },

    // Background (used by some page sections)
    background: { src: '', ...overrides.background },

    // Visibility methods — stateful to support assertions on hidden/collapsed
    show: vi.fn(function (...args) { this.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function (...args) { this.hidden = true; return Promise.resolve(); }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),

    // Form methods
    focus: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),

    // Event handlers
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onBlur: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onCurrentIndexChanged: vi.fn(),
    forEachItem: vi.fn(),

    // Dataset methods
    getCurrentItem: vi.fn(() => null),
  };

  // Apply non-nested overrides
  const { style, accessibility, background, ...rest } = overrides;
  Object.assign(el, rest);

  return el;
}

/**
 * Create a mock $w selector function that lazily creates elements.
 * Each selector string gets a unique mock element, memoized across calls.
 *
 * @param {Object} [presets] - Map of selector → element overrides or pre-built elements
 * @returns {Function} Mock $w selector
 */
export function create$w(presets = {}) {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) {
      if (presets[sel] && typeof presets[sel] === 'object' && !presets[sel]._isMock) {
        els.set(sel, createMockElement(presets[sel]));
      } else if (presets[sel]) {
        els.set(sel, presets[sel]);
      } else {
        els.set(sel, createMockElement());
      }
    }
    return els.get(sel);
  };
}
