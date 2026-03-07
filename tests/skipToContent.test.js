import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    hidden: true,
    options: [],
    data: [],
    style: {
      color: '', backgroundColor: '', fontWeight: '',
      position: '', top: '', left: '', zIndex: '',
      opacity: '', overflow: '', width: '', height: '',
      padding: '', outline: '', outlineOffset: '',
      borderRadius: '', transition: '',
    },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue(null),
  getWebSiteSchema: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue(null),
  getFlashSales: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Skip-to-Content Link (CF-29d)', () => {
  beforeAll(async () => {
    await import('../src/pages/masterPage.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Existence & ARIA ──────────────────────────────────────────────

  describe('skip link element setup', () => {
    it('sets aria-label on #skipToContent', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.accessibility.ariaLabel).toBe('Skip to main content');
    });

    it('registers click handler on #skipToContent', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.onClick).toHaveBeenCalled();
    });

    it('click handler scrolls to #mainContent', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const clickHandler = skipLink.onClick.mock.calls[0][0];

      clickHandler();

      expect(getEl('#mainContent').scrollTo).toHaveBeenCalled();
    });
  });

  // ── Visible on Focus ──────────────────────────────────────────────

  describe('visible on focus behavior', () => {
    it('registers onFocus handler on #skipToContent', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.onFocus).toHaveBeenCalled();
    });

    it('registers onBlur handler on #skipToContent', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.onBlur).toHaveBeenCalled();
    });

    it('shows skip link on focus', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const focusHandler = skipLink.onFocus.mock.calls[0][0];

      focusHandler();

      expect(skipLink.show).toHaveBeenCalled();
    });

    it('hides skip link on blur', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const blurHandler = skipLink.onBlur.mock.calls[0][0];

      blurHandler();

      expect(skipLink.hide).toHaveBeenCalled();
    });
  });

  // ── Tab Order ─────────────────────────────────────────────────────

  describe('tab order', () => {
    it('skip link has tabIndex 0 for keyboard focusability', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.accessibility.tabIndex).toBe(0);
    });
  });

  // ── Initially Hidden ──────────────────────────────────────────────

  describe('initial state', () => {
    it('skip link is hidden on page load', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.hide).toHaveBeenCalled();
    });
  });

  // ── Keyboard Activation ───────────────────────────────────────────

  describe('keyboard activation', () => {
    it('skip link has onKeyPress handler for Enter key', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.onKeyPress).toHaveBeenCalled();
    });

    it('Enter key scrolls to main content', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const keyHandler = skipLink.onKeyPress.mock.calls[0][0];

      keyHandler({ key: 'Enter', preventDefault: vi.fn() });

      expect(getEl('#mainContent').scrollTo).toHaveBeenCalled();
    });

    it('Space key scrolls to main content', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const keyHandler = skipLink.onKeyPress.mock.calls[0][0];

      getEl('#mainContent').scrollTo.mockClear();
      keyHandler({ key: ' ', preventDefault: vi.fn() });

      expect(getEl('#mainContent').scrollTo).toHaveBeenCalled();
    });

    it('non-activation keys are ignored', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      const keyHandler = skipLink.onKeyPress.mock.calls[0][0];
      const preventDefault = vi.fn();

      getEl('#mainContent').scrollTo.mockClear();
      keyHandler({ key: 'Tab', preventDefault });

      expect(getEl('#mainContent').scrollTo).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  // ── Screen Reader ─────────────────────────────────────────────────

  describe('screen reader support', () => {
    it('skip link has role="link"', async () => {
      await onReadyHandler();
      const skipLink = getEl('#skipToContent');
      expect(skipLink.accessibility.role).toBe('link');
    });
  });

  // ── a11yLiveRegion ────────────────────────────────────────────────

  describe('live region setup', () => {
    it('sets ariaLive on #a11yLiveRegion', async () => {
      await onReadyHandler();
      const liveRegion = getEl('#a11yLiveRegion');
      expect(liveRegion.accessibility.ariaLive).toBe('polite');
    });

    it('sets ariaAtomic on #a11yLiveRegion', async () => {
      await onReadyHandler();
      const liveRegion = getEl('#a11yLiveRegion');
      expect(liveRegion.accessibility.ariaAtomic).toBe(true);
    });

    it('sets role="status" on #a11yLiveRegion', async () => {
      await onReadyHandler();
      const liveRegion = getEl('#a11yLiveRegion');
      expect(liveRegion.accessibility.role).toBe('status');
    });
  });
});
