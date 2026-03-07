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
  });
});
