// responsiveBreakpoints.test.js - Tests for responsive breakpoint enhancements (CF-4rh)
import { describe, it, expect, beforeEach, vi } from 'vitest';

const setWindowWidth = (width) => {
  global.window = { innerWidth: width, addEventListener: vi.fn(), removeEventListener: vi.fn() };
};

describe('Enhanced responsive breakpoints (CF-4rh)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  describe('getViewport - all 6 breakpoints', () => {
    it('returns "mobile" for width 320', async () => {
      setWindowWidth(320);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobile');
    });

    it('returns "mobile" for width 479 (just below mobileLarge)', async () => {
      setWindowWidth(479);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobile');
    });

    it('returns "mobileLarge" for width 480', async () => {
      setWindowWidth(480);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobileLarge');
    });

    it('returns "mobileLarge" for width 767 (just below tablet)', async () => {
      setWindowWidth(767);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('mobileLarge');
    });

    it('returns "tablet" for width 768', async () => {
      setWindowWidth(768);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('tablet');
    });

    it('returns "desktop" for width 1024', async () => {
      setWindowWidth(1024);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('desktop');
    });

    it('returns "wide" for width 1280', async () => {
      setWindowWidth(1280);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('wide');
    });

    it('returns "ultraWide" for width 1440', async () => {
      setWindowWidth(1440);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('ultraWide');
    });

    it('returns "ultraWide" for width 1920', async () => {
      setWindowWidth(1920);
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('ultraWide');
    });

    it('returns "desktop" when window is undefined (SSR)', async () => {
      delete global.window;
      const { getViewport } = await import('public/mobileHelpers');
      expect(getViewport()).toBe('desktop');
    });
  });

  describe('isMobile - includes mobileLarge', () => {
    it('returns true for mobile (320)', async () => {
      setWindowWidth(320);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(true);
    });

    it('returns true for mobileLarge (480)', async () => {
      setWindowWidth(480);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(true);
    });

    it('returns false for tablet (768)', async () => {
      setWindowWidth(768);
      const { isMobile } = await import('public/mobileHelpers');
      expect(isMobile()).toBe(false);
    });
  });

  describe('isTabletOrBelow', () => {
    it('returns true for mobile', async () => {
      setWindowWidth(375);
      const { isTabletOrBelow } = await import('public/mobileHelpers');
      expect(isTabletOrBelow()).toBe(true);
    });

    it('returns true for mobileLarge', async () => {
      setWindowWidth(600);
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
  });

  describe('getResponsiveValue', () => {
    it('returns mobile value for mobile viewport', async () => {
      setWindowWidth(375);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 });
      expect(result).toBe(1);
    });

    it('returns mobile value for mobileLarge when no mobileLarge key', async () => {
      setWindowWidth(500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 });
      expect(result).toBe(1);
    });

    it('returns mobileLarge value when provided', async () => {
      setWindowWidth(500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, mobileLarge: 1.5, tablet: 2, desktop: 3 });
      expect(result).toBe(1.5);
    });

    it('returns tablet value for tablet viewport', async () => {
      setWindowWidth(800);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 });
      expect(result).toBe(2);
    });

    it('returns desktop value for desktop viewport', async () => {
      setWindowWidth(1100);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 });
      expect(result).toBe(3);
    });

    it('returns wide value when provided', async () => {
      setWindowWidth(1300);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3, wide: 4 });
      expect(result).toBe(4);
    });

    it('falls back to desktop for wide when no wide key', async () => {
      setWindowWidth(1300);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, tablet: 2, desktop: 3 });
      expect(result).toBe(3);
    });

    it('returns ultraWide value when provided', async () => {
      setWindowWidth(1500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, desktop: 3, ultraWide: 5 });
      expect(result).toBe(5);
    });

    it('falls back to desktop for ultraWide when no ultraWide key', async () => {
      setWindowWidth(1500);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: 1, desktop: 3 });
      expect(result).toBe(3);
    });

    it('works with string values', async () => {
      setWindowWidth(375);
      const { getResponsiveValue } = await import('public/mobileHelpers');
      const result = getResponsiveValue({ mobile: '16px', tablet: '20px', desktop: '24px' });
      expect(result).toBe('16px');
    });
  });

  describe('getResponsiveSpacing', () => {
    it('returns mobile spacing values for mobile viewport', async () => {
      setWindowWidth(375);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const result = getResponsiveSpacing();
      expect(result.pagePadding).toBe('16px');
      expect(result.sectionGap).toBe('48px');
      expect(result.gridGap).toBe('16px');
    });

    it('returns tablet spacing values for tablet viewport', async () => {
      setWindowWidth(800);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const result = getResponsiveSpacing();
      expect(result.pagePadding).toBe('24px');
      expect(result.sectionGap).toBe('64px');
      expect(result.gridGap).toBe('20px');
    });

    it('returns desktop spacing values for desktop viewport', async () => {
      setWindowWidth(1100);
      const { getResponsiveSpacing } = await import('public/mobileHelpers');
      const result = getResponsiveSpacing();
      expect(result.pagePadding).toBe('80px');
      expect(result.sectionGap).toBe('80px');
      expect(result.gridGap).toBe('24px');
    });
  });

  describe('getResponsiveTypography', () => {
    it('returns scaled-down sizes for mobile', async () => {
      setWindowWidth(375);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const result = getResponsiveTypography();
      expect(result.heroTitle).toBe('32px');
      expect(result.h1).toBe('28px');
      expect(result.h2).toBe('24px');
      expect(result.h3).toBe('20px');
      expect(result.body).toBe('16px');
    });

    it('returns tablet-scaled sizes for tablet', async () => {
      setWindowWidth(800);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const result = getResponsiveTypography();
      expect(result.heroTitle).toBe('42px');
      expect(result.h1).toBe('34px');
      expect(result.h2).toBe('28px');
    });

    it('returns full desktop sizes for desktop', async () => {
      setWindowWidth(1100);
      const { getResponsiveTypography } = await import('public/mobileHelpers');
      const result = getResponsiveTypography();
      expect(result.heroTitle).toBe('56px');
      expect(result.h1).toBe('42px');
      expect(result.h2).toBe('32px');
    });
  });

  describe('getResponsiveColumns', () => {
    it('returns 1 column for mobile', async () => {
      setWindowWidth(375);
      const { getResponsiveColumns } = await import('public/mobileHelpers');
      expect(getResponsiveColumns()).toBe(1);
    });

    it('returns 1 column for mobileLarge', async () => {
      setWindowWidth(500);
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

    it('returns 3 columns for wide', async () => {
      setWindowWidth(1300);
      const { getResponsiveColumns } = await import('public/mobileHelpers');
      expect(getResponsiveColumns()).toBe(3);
    });
  });

  describe('limitForViewport with enhanced breakpoints', () => {
    it('uses mobileLarge limit when provided and viewport is mobileLarge', async () => {
      setWindowWidth(500);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, mobileLarge: 6, tablet: 8, desktop: 12 });
      expect(result).toHaveLength(6);
    });

    it('falls back to mobile limit when mobileLarge viewport but no mobileLarge key', async () => {
      setWindowWidth(500);
      const { limitForViewport } = await import('public/mobileHelpers');
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = limitForViewport(items, { mobile: 4, tablet: 8, desktop: 12 });
      expect(result).toHaveLength(4);
    });
  });

  describe('backward compatibility', () => {
    it('isTouchDevice still returns true for mobileLarge', async () => {
      setWindowWidth(500);
      const { isTouchDevice } = await import('public/mobileHelpers');
      expect(isTouchDevice()).toBe(true);
    });

    it('collapseOnMobile still works for mobileLarge', async () => {
      setWindowWidth(500);
      const { collapseOnMobile } = await import('public/mobileHelpers');
      const collapsed = [];
      const $w = (id) => ({ collapse: () => collapsed.push(id) });
      collapseOnMobile($w, ['#section1']);
      expect(collapsed).toEqual(['#section1']);
    });

    it('limitForViewport returns empty array for non-array input', async () => {
      setWindowWidth(375);
      const { limitForViewport } = await import('public/mobileHelpers');
      expect(limitForViewport(null)).toEqual([]);
      expect(limitForViewport(undefined)).toEqual([]);
      expect(limitForViewport('string')).toEqual([]);
    });
  });
});
