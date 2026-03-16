// mobileHelpers.test.js - Tests for mobile-first responsive utilities
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window for viewport detection
const setWindowWidth = (width) => {
  global.window = { innerWidth: width, addEventListener: vi.fn(), removeEventListener: vi.fn() };
};

describe('mobileHelpers', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  describe('getViewport', () => {
    it('returns "mobile" for widths below tablet breakpoint (768)', async () => {
      setWindowWidth(375);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobile');
    });

    it('returns "tablet" for widths between tablet and desktop breakpoints', async () => {
      setWindowWidth(800);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('tablet');
    });

    it('returns "desktop" for widths between desktop and wide breakpoints', async () => {
      setWindowWidth(1100);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('desktop');
    });

    it('returns "wide" for widths between wide (1280) and ultraWide (1440)', async () => {
      setWindowWidth(1300);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('wide');
    });

    it('returns "ultraWide" for widths at or above ultraWide breakpoint (1440)', async () => {
      setWindowWidth(1440);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('ultraWide');
    });

    it('returns "desktop" when window is undefined (SSR)', async () => {
      delete global.window;
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('desktop');
    });
  });

  describe('isMobile', () => {
    it('returns true for mobile viewport', async () => {
      setWindowWidth(375);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(true);
    });

    it('returns false for tablet viewport', async () => {
      setWindowWidth(800);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(false);
    });

    it('returns false for desktop viewport', async () => {
      setWindowWidth(1100);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(false);
    });
  });

  describe('isTouchDevice', () => {
    it('returns true for mobile', async () => {
      setWindowWidth(375);
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(true);
    });

    it('returns true for tablet', async () => {
      setWindowWidth(800);
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(true);
    });

    it('returns false for desktop without touch capability', async () => {
      setWindowWidth(1100);
      Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
      vi.resetModules();
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(false);
    });

    it('returns true for desktop with touch capability (e.g. Surface)', async () => {
      setWindowWidth(1100);
      Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 2 }, configurable: true });
      vi.resetModules();
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(true);
    });

    it('returns false for desktop when navigator is undefined', async () => {
      setWindowWidth(1100);
      Object.defineProperty(global, 'navigator', { value: undefined, configurable: true });
      vi.resetModules();
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(false);
    });
  });

  describe('limitForViewport', () => {
    it('limits items based on mobile viewport', async () => {
      setWindowWidth(375);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 6, desktop: 12 });
      expect(result).toHaveLength(4);
    });

    it('limits items based on tablet viewport', async () => {
      setWindowWidth(800);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 6, desktop: 12 });
      expect(result).toHaveLength(6);
    });

    it('limits items based on desktop viewport', async () => {
      setWindowWidth(1100);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items);
      expect(result).toHaveLength(12);
    });

    it('returns all items if fewer than limit', async () => {
      setWindowWidth(375);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = [{ id: 1 }, { id: 2 }];
      const result = limitForViewport(items, { mobile: 4 });
      expect(result).toHaveLength(2);
    });
  });

  describe('collapseOnMobile', () => {
    it('collapses sections on mobile', async () => {
      setWindowWidth(375);
      const { collapseOnMobile } = await import('public/mobileHelpers');
      const collapsed = [];
      const $w = (id) => ({ collapse: () => collapsed.push(id) });
      collapseOnMobile($w, ['#section1', '#section2']);
      expect(collapsed).toEqual(['#section1', '#section2']);
    });

    it('does nothing on desktop', async () => {
      setWindowWidth(1100);
      const { collapseOnMobile } = await import('public/mobileHelpers');
      const collapsed = [];
      const $w = (id) => ({ collapse: () => collapsed.push(id) });
      collapseOnMobile($w, ['#section1', '#section2']);
      expect(collapsed).toEqual([]);
    });
  });

  describe('smoothScrollTo', () => {
    it('calls scrollTo on the element', async () => {
      setWindowWidth(1100);
      const { smoothScrollTo } = await import('public/mobileHelpers');
      const scrollTo = vi.fn();
      smoothScrollTo({ scrollTo });
      expect(scrollTo).toHaveBeenCalled();
    });

    it('does not throw for null element', async () => {
      setWindowWidth(1100);
      const { smoothScrollTo } = await import('public/mobileHelpers');
      expect(() => smoothScrollTo(null)).not.toThrow();
    });
  });

  describe('onViewportChange', () => {
    it('returns an unsubscribe function', async () => {
      setWindowWidth(1100);
      const { onViewportChange } = await import('public/mobileHelpers');
      const unsubscribe = onViewportChange(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('returns no-op when window is undefined', async () => {
      delete global.window;
      const { onViewportChange } = await import('public/mobileHelpers');
      const unsubscribe = onViewportChange(() => {});
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('addSwipeHandler', () => {
    it('does nothing when element is null', async () => {
      setWindowWidth(375);
      const { addSwipeHandler } = await import('public/mobileHelpers');
      expect(() => addSwipeHandler(null, {})).not.toThrow();
    });

    it('registers touch listeners on DOM element', async () => {
      setWindowWidth(375);
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const el = {
        addEventListener: (event, handler, opts) => { listeners[event] = handler; },
        htmlElement: undefined,
      };
      el.htmlElement = undefined;
      // The function checks element.htmlElement || element, and needs addEventListener
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      addSwipeHandler({ htmlElement: domEl }, { onLeft: vi.fn(), onRight: vi.fn() });
      expect(listeners.touchstart).toBeDefined();
      expect(listeners.touchend).toBeDefined();
    });
  });

  describe('initBackToTop', () => {
    it('hides the button initially', async () => {
      setWindowWidth(1100);
      const { initBackToTop } = await import('public/mobileHelpers');
      let hidden = false;
      const $w = () => ({
        hide: () => { hidden = true; },
        onClick: () => {},
      });
      initBackToTop($w);
      expect(hidden).toBe(true);
    });

    it('does not throw when $w returns null', async () => {
      setWindowWidth(1100);
      const { initBackToTop } = await import('public/mobileHelpers');
      const $w = () => null;
      expect(() => initBackToTop($w)).not.toThrow();
    });
  });

  // ── mobileLarge viewport ────────────────────────────────────────────

  describe('getViewport — mobileLarge', () => {
    it('returns "mobileLarge" for widths between mobile (480) and tablet (768)', async () => {
      setWindowWidth(500);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobileLarge');
    });

    it('returns "mobileLarge" at exactly 480', async () => {
      setWindowWidth(480);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobileLarge');
    });
  });

  describe('isMobile — mobileLarge', () => {
    it('returns true for mobileLarge viewport', async () => {
      setWindowWidth(500);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(true);
    });
  });

  // ── isTabletOrBelow ────────────────────────────────────────────────

  describe('isTabletOrBelow', () => {
    it('returns true for mobile', async () => {
      setWindowWidth(375);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(true);
    });

    it('returns true for mobileLarge', async () => {
      setWindowWidth(500);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(true);
    });

    it('returns true for tablet', async () => {
      setWindowWidth(800);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(true);
    });

    it('returns false for desktop', async () => {
      setWindowWidth(1100);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(false);
    });

    it('returns false for wide', async () => {
      setWindowWidth(1300);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(false);
    });

    it('returns false for ultraWide', async () => {
      setWindowWidth(1440);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(false);
    });
  });

  // ── isTouchDevice — mobileLarge ─────────────────────────────────────

  describe('isTouchDevice — mobileLarge', () => {
    it('returns true for mobileLarge', async () => {
      setWindowWidth(500);
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(true);
    });
  });

  // ── getResponsiveValue ─────────────────────────────────────────────

  describe('getResponsiveValue', () => {
    it('returns exact match for viewport', async () => {
      setWindowWidth(800);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 })).toBe(2);
    });

    it('falls back mobileLarge → mobile', async () => {
      setWindowWidth(500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 })).toBe(1);
    });

    it('uses mobileLarge key if provided', async () => {
      setWindowWidth(500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, mobileLarge: 1.5, tablet: 2 })).toBe(1.5);
    });

    it('falls back wide → desktop', async () => {
      setWindowWidth(1300);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 })).toBe(3);
    });

    it('uses wide key if provided', async () => {
      setWindowWidth(1300);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, desktop: 3, wide: 4 })).toBe(4);
    });

    it('falls back ultraWide → wide → desktop', async () => {
      setWindowWidth(1440);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, desktop: 3 })).toBe(3);
    });

    it('falls back ultraWide → wide when wide is provided', async () => {
      setWindowWidth(1440);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, desktop: 3, wide: 4 })).toBe(4);
    });

    it('uses ultraWide key if provided', async () => {
      setWindowWidth(1440);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, desktop: 3, ultraWide: 5 })).toBe(5);
    });

    it('falls back to desktop for unknown viewport without specific fallback', async () => {
      setWindowWidth(1100);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      expect(getResponsiveValue({ mobile: 1, desktop: 3 })).toBe(3);
    });
  });

  // ── getResponsiveSpacing ────────────────────────────────────────────

  describe('getResponsiveSpacing', () => {
    it('returns mobile spacing for mobile viewport', async () => {
      setWindowWidth(375);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const spacing = getResponsiveSpacing();
      expect(spacing.pagePadding).toBe('16px');
      expect(spacing.sectionGap).toBe('48px');
    });

    it('returns tablet spacing for tablet viewport', async () => {
      setWindowWidth(800);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const spacing = getResponsiveSpacing();
      expect(spacing.pagePadding).toBe('24px');
      expect(spacing.sectionGap).toBe('64px');
    });

    it('returns desktop spacing for desktop viewport', async () => {
      setWindowWidth(1100);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const spacing = getResponsiveSpacing();
      expect(spacing.pagePadding).toBe('80px');
      expect(spacing.sectionGap).toBe('80px');
    });

    it('returns gridGap for each viewport', async () => {
      setWindowWidth(375);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const spacing = getResponsiveSpacing();
      expect(spacing.gridGap).toBeDefined();
      expect(typeof spacing.gridGap).toBe('string');
    });
  });

  // ── getResponsiveTypography ─────────────────────────────────────────

  describe('getResponsiveTypography', () => {
    it('returns all typography keys', async () => {
      setWindowWidth(1100);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const typo = getResponsiveTypography();
      expect(typo).toHaveProperty('heroTitle');
      expect(typo).toHaveProperty('h1');
      expect(typo).toHaveProperty('h2');
      expect(typo).toHaveProperty('h3');
      expect(typo).toHaveProperty('h4');
      expect(typo).toHaveProperty('body');
      expect(typo).toHaveProperty('bodySmall');
    });

    it('returns smaller sizes on mobile', async () => {
      setWindowWidth(375);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const typo = getResponsiveTypography();
      expect(typo.heroTitle).toBe('32px');
      expect(typo.h1).toBe('28px');
      expect(typo.body).toBe('16px');
    });

    it('returns larger sizes on desktop', async () => {
      setWindowWidth(1100);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const typo = getResponsiveTypography();
      expect(typo.heroTitle).toBe('56px');
      expect(typo.h1).toBe('42px');
    });

    it('returns intermediate sizes on tablet', async () => {
      setWindowWidth(800);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const typo = getResponsiveTypography();
      expect(typo.heroTitle).toBe('42px');
      expect(typo.h1).toBe('34px');
    });
  });

  // ── getResponsiveColumns ────────────────────────────────────────────

  describe('getResponsiveColumns', () => {
    it('returns 1 column for mobile', async () => {
      setWindowWidth(375);
      const { getResponsiveColumns } = await import('public/mobileHelpers');
      expect(getResponsiveColumns()).toBe(1);
    });

    it('returns 2 columns for tablet', async () => {
      setWindowWidth(800);
      const { getResponsiveColumns } = await import('public/mobileHelpers');
      expect(getResponsiveColumns()).toBe(2);
    });

    it('returns 3 columns for desktop', async () => {
      setWindowWidth(1100);
      const { getResponsiveColumns } = await import('public/mobileHelpers');
      expect(getResponsiveColumns()).toBe(3);
    });
  });

  // ── limitForViewport edge cases ─────────────────────────────────────

  describe('limitForViewport — edge cases', () => {
    it('returns empty array for non-array input', async () => {
      setWindowWidth(1100);
      const { limitForViewport } = await import('public/mobileHelpers');
      expect(limitForViewport(null)).toEqual([]);
      expect(limitForViewport(undefined)).toEqual([]);
      expect(limitForViewport('not-array')).toEqual([]);
    });

    it('uses mobileLarge fallback to mobile limit', async () => {
      setWindowWidth(500);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 6, desktop: 12 });
      expect(result).toHaveLength(4);
    });

    it('uses wide fallback to desktop limit', async () => {
      setWindowWidth(1300);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 6, desktop: 12 });
      expect(result).toHaveLength(12);
    });

    it('uses custom wide limit when provided', async () => {
      setWindowWidth(1300);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 6, desktop: 12, wide: 16 });
      expect(result).toHaveLength(16);
    });
  });

  // ── initShowMore ────────────────────────────────────────────────────

  describe('initShowMore', () => {
    it('shows button and limits repeater data on mobile', async () => {
      setWindowWidth(375);
      const { initShowMore } = await import('public/mobileHelpers');
      const repeater = { data: null };
      const button = { label: '', show: vi.fn(), hide: vi.fn(), onClick: vi.fn() };
      const $w = (id) => {
        if (id === '#rep') return repeater;
        if (id === '#btn') return button;
      };
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      initShowMore($w, '#rep', '#btn', items, 4);
      expect(repeater.data).toHaveLength(4);
      expect(button.show).toHaveBeenCalled();
      expect(button.label).toBe('Show All (10)');
    });

    it('hides button on desktop', async () => {
      setWindowWidth(1100);
      const { initShowMore } = await import('public/mobileHelpers');
      const button = { hide: vi.fn() };
      const $w = (id) => {
        if (id === '#btn') return button;
      };
      initShowMore($w, '#rep', '#btn', [1, 2, 3], 4);
      expect(button.hide).toHaveBeenCalled();
    });

    it('hides button when items <= initialCount on mobile', async () => {
      setWindowWidth(375);
      const { initShowMore } = await import('public/mobileHelpers');
      const button = { hide: vi.fn() };
      const $w = (id) => {
        if (id === '#btn') return button;
      };
      initShowMore($w, '#rep', '#btn', [1, 2], 4);
      expect(button.hide).toHaveBeenCalled();
    });

    it('button click reveals all items', async () => {
      setWindowWidth(375);
      const { initShowMore } = await import('public/mobileHelpers');
      const repeater = { data: null };
      let clickHandler;
      const button = {
        label: '',
        show: vi.fn(),
        hide: vi.fn(),
        onClick: (fn) => { clickHandler = fn; },
      };
      const $w = (id) => {
        if (id === '#rep') return repeater;
        if (id === '#btn') return button;
      };
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      initShowMore($w, '#rep', '#btn', items, 4);
      expect(repeater.data).toHaveLength(4);
      clickHandler();
      expect(repeater.data).toHaveLength(10);
      expect(button.hide).toHaveBeenCalled();
    });

    it('does not throw when $w throws', async () => {
      setWindowWidth(375);
      const { initShowMore } = await import('public/mobileHelpers');
      const $w = () => { throw new Error('element not found'); };
      expect(() => initShowMore($w, '#rep', '#btn', [1, 2, 3, 4, 5])).not.toThrow();
    });
  });

  // ── addSwipeHandler — swipe directions ──────────────────────────────

  describe('addSwipeHandler — swipe directions', () => {
    function setupSwipeHandler(handlers, threshold) {
      const listeners = {};
      const domEl = {
        addEventListener: (event, handler) => { listeners[event] = handler; },
      };
      // import is async but we need a synchronous setup
      return { listeners, domEl, handlers };
    }

    it('fires onRight for rightward swipe', async () => {
      setWindowWidth(375);
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onRight = vi.fn();
      addSwipeHandler({ htmlElement: domEl }, { onRight });
      listeners.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
      listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 200 }] });
      expect(onRight).toHaveBeenCalled();
    });

    it('fires onLeft for leftward swipe', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onLeft = vi.fn();
      addSwipeHandler({ htmlElement: domEl }, { onLeft });
      listeners.touchstart({ touches: [{ clientX: 200, clientY: 200 }] });
      listeners.touchend({ changedTouches: [{ clientX: 100, clientY: 200 }] });
      expect(onLeft).toHaveBeenCalled();
    });

    it('fires onDown for downward swipe', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onDown = vi.fn();
      addSwipeHandler({ htmlElement: domEl }, { onDown });
      listeners.touchstart({ touches: [{ clientX: 200, clientY: 100 }] });
      listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 200 }] });
      expect(onDown).toHaveBeenCalled();
    });

    it('fires onUp for upward swipe', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onUp = vi.fn();
      addSwipeHandler({ htmlElement: domEl }, { onUp });
      listeners.touchstart({ touches: [{ clientX: 200, clientY: 200 }] });
      listeners.touchend({ changedTouches: [{ clientX: 200, clientY: 100 }] });
      expect(onUp).toHaveBeenCalled();
    });

    it('does not fire handler when swipe is below threshold', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const domEl = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onRight = vi.fn();
      addSwipeHandler({ htmlElement: domEl }, { onRight }, 100);
      listeners.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
      listeners.touchend({ changedTouches: [{ clientX: 130, clientY: 200 }] });
      expect(onRight).not.toHaveBeenCalled();
    });

    it('does nothing when window is undefined', async () => {
      delete global.window;
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      expect(() => addSwipeHandler({ htmlElement: {} }, { onLeft: vi.fn() })).not.toThrow();
    });

    it('uses element directly when htmlElement is undefined', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      const listeners = {};
      const el = { addEventListener: (event, handler) => { listeners[event] = handler; } };
      const onLeft = vi.fn();
      addSwipeHandler(el, { onLeft });
      expect(listeners.touchstart).toBeDefined();
    });

    it('handles element without addEventListener gracefully', async () => {
      setWindowWidth(375);
      vi.resetModules();
      const { addSwipeHandler } = await import('public/mobileHelpers');
      expect(() => addSwipeHandler({}, { onLeft: vi.fn() })).not.toThrow();
    });
  });

  // ── collapseOnMobile — edge cases ───────────────────────────────────

  describe('collapseOnMobile — error handling', () => {
    it('does not throw when $w throws for a section', async () => {
      setWindowWidth(375);
      const { collapseOnMobile } = await import('public/mobileHelpers');
      const $w = () => { throw new Error('not found'); };
      expect(() => collapseOnMobile($w, ['#bad'])).not.toThrow();
    });
  });

  // ── smoothScrollTo edge cases ────────────────────────────────────────

  describe('smoothScrollTo — edge cases', () => {
    it('does not throw for element without scrollTo', async () => {
      setWindowWidth(1100);
      const { smoothScrollTo } = await import('public/mobileHelpers');
      expect(() => smoothScrollTo({})).not.toThrow();
    });

    it('does not throw for undefined element', async () => {
      setWindowWidth(1100);
      vi.resetModules();
      const { smoothScrollTo } = await import('public/mobileHelpers');
      expect(() => smoothScrollTo(undefined)).not.toThrow();
    });
  });

  // ── onViewportChange — unsubscribe ──────────────────────────────────

  describe('onViewportChange — unsubscribe', () => {
    it('cleans up resize listener on unsubscribe', async () => {
      const removeListener = vi.fn();
      global.window = { innerWidth: 1100, addEventListener: vi.fn(), removeEventListener: removeListener };
      const { onViewportChange } = await import('public/mobileHelpers');
      const unsub = onViewportChange(() => {});
      unsub();
      expect(removeListener).toHaveBeenCalled();
    });
  });
});
