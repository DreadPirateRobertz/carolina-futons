// mobileBreakpoints.test.js - CF-7bs: Responsive mobile breakpoints for all pages
// Tests that getViewport() distinguishes all breakpoints (320/480/768/1024/1280)
// and that all pages with dynamic content use onViewportChange for live adaptation.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const setWindowWidth = (width) => {
  global.window = { innerWidth: width, addEventListener: vi.fn(), removeEventListener: vi.fn() };
};

// ── Phase 1: getViewport() must distinguish mobileLarge ──────────────

describe('getViewport — mobileLarge breakpoint support', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  it('returns "mobile" for 320px (smallest supported)', async () => {
    setWindowWidth(320);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('mobile');
  });

  it('returns "mobile" for 479px (just below mobileLarge)', async () => {
    setWindowWidth(479);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('mobile');
  });

  it('returns "mobileLarge" for 480px', async () => {
    setWindowWidth(480);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('mobileLarge');
  });

  it('returns "mobileLarge" for 767px (just below tablet)', async () => {
    setWindowWidth(767);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('mobileLarge');
  });

  it('returns "tablet" for 768px', async () => {
    setWindowWidth(768);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('tablet');
  });

  it('returns "desktop" for 1024px', async () => {
    setWindowWidth(1024);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('desktop');
  });

  it('returns "wide" for 1280px', async () => {
    setWindowWidth(1280);
    const { getViewport } = await import('public/mobileHelpers');
    expect(getViewport()).toBe('wide');
  });
});

// ── Phase 2: isMobile includes mobileLarge ───────────────────────────

describe('isMobile — includes mobileLarge', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  it('returns true for 320px', async () => {
    setWindowWidth(320);
    const { isMobile } = await import('public/mobileHelpers');
    expect(isMobile()).toBe(true);
  });

  it('returns true for 480px (mobileLarge is still mobile)', async () => {
    setWindowWidth(480);
    const { isMobile } = await import('public/mobileHelpers');
    expect(isMobile()).toBe(true);
  });

  it('returns false for 768px', async () => {
    setWindowWidth(768);
    const { isMobile } = await import('public/mobileHelpers');
    expect(isMobile()).toBe(false);
  });
});

// ── Phase 3: isTouchDevice includes mobileLarge ──────────────────────

describe('isTouchDevice — includes mobileLarge', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  it('returns true for mobileLarge viewport', async () => {
    setWindowWidth(500);
    const { isTouchDevice } = await import('public/mobileHelpers');
    expect(isTouchDevice()).toBe(true);
  });
});

// ── Phase 4: limitForViewport supports mobileLarge ───────────────────

describe('limitForViewport — mobileLarge support', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  it('uses mobileLarge limit when viewport is mobileLarge', async () => {
    setWindowWidth(500);
    const { limitForViewport } = await import('public/mobileHelpers');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = limitForViewport(items, { mobile: 2, mobileLarge: 4, tablet: 6, desktop: 12 });
    expect(result).toHaveLength(4);
  });

  it('falls back to mobile limit when mobileLarge not specified', async () => {
    setWindowWidth(500);
    const { limitForViewport } = await import('public/mobileHelpers');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = limitForViewport(items, { mobile: 3, tablet: 6 });
    expect(result).toHaveLength(3);
  });

  it('uses default mobileLarge limit (6) when no limits specified', async () => {
    setWindowWidth(500);
    const { limitForViewport } = await import('public/mobileHelpers');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = limitForViewport(items);
    expect(result).toHaveLength(6);
  });

  it('uses default wide limit (12) on wide viewport (1280px+)', async () => {
    setWindowWidth(1400);
    const { limitForViewport } = await import('public/mobileHelpers');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = limitForViewport(items);
    expect(result).toHaveLength(12);
  });

  it('uses caller wide limit when specified', async () => {
    setWindowWidth(1400);
    const { limitForViewport } = await import('public/mobileHelpers');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = limitForViewport(items, { mobile: 2, desktop: 8, wide: 16 });
    expect(result).toHaveLength(16);
  });
});

// ── Phase 5: collapseOnMobile works for mobileLarge too ──────────────

describe('collapseOnMobile — mobileLarge support', () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.window;
  });

  it('collapses sections on mobileLarge', async () => {
    setWindowWidth(500);
    const { collapseOnMobile } = await import('public/mobileHelpers');
    const collapsed = [];
    const $w = (id) => ({ collapse: () => collapsed.push(id) });
    collapseOnMobile($w, ['#section1', '#section2']);
    expect(collapsed).toEqual(['#section1', '#section2']);
  });
});

// ── Phase 6: Page import audit — all content pages must use mobileHelpers ──

describe('page mobile breakpoint coverage audit', () => {
  // These pages have dynamic content and MUST import mobileHelpers
  const contentPages = [
    'Checkout',
    'Side Cart',
    'Home',
    'Product Page',
    'Category Page',
    'Cart Page',
    'Search Results',
    'Blog',
    'Blog Post',
    'Compare Page',
    'Member Page',
    'Thank You Page',
    'UGC Gallery',
    'Order Tracking',
    'masterPage',
  ];

  contentPages.forEach((page) => {
    it(`${page} imports from mobileHelpers`, async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const filePath = resolve(process.cwd(), `src/pages/${page}.js`);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/import\s+.*from\s+['"]public\/mobileHelpers['"]/);
    });
  });

  // Key pages with grids/repeaters must use onViewportChange for dynamic adaptation
  const dynamicPages = [
    'Home',
    'Category Page',
    'Search Results',
    'Blog',
    'UGC Gallery',
  ];

  dynamicPages.forEach((page) => {
    it(`${page} uses onViewportChange for dynamic viewport adaptation`, async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const filePath = resolve(process.cwd(), `src/pages/${page}.js`);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/onViewportChange/);
    });
  });

  // Checkout and Side Cart must use collapseOnMobile or isMobile
  ['Checkout', 'Side Cart'].forEach((page) => {
    it(`${page} uses mobile-aware layout adaptation`, async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const filePath = resolve(process.cwd(), `src/pages/${page}.js`);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/isMobile|collapseOnMobile|getViewport|limitForViewport/);
    });
  });
});
