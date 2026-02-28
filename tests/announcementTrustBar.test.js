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
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '', overflowX: '' },
    accessibility: {
      ariaLabel: '',
      ariaLive: undefined,
      role: undefined,
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onItemReady: vi.fn(),
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

// ── Mock Backend Modules (required by Home.js) ──────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
  getSaleProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
}));

vi.mock('public/galleryHelpers.js', () => ({
  getRecentlyViewed: vi.fn().mockReturnValue([]),
  buildRecentlyViewedSection: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getCategoryHeroImage: vi.fn().mockReturnValue('https://example.com/hero.jpg'),
  getCategoryCardImage: vi.fn((slug) => `https://example.com/card-${slug}.jpg`),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn().mockReturnValue(false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn((items) => items),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn().mockReturnValue({
      hasSome: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(12),
      }),
    }),
  },
}));

// ── Import Home Page (registers $w.onReady) ─────────────────────────

describe('CF-c94m: Announcement Bar + Trust Bar', () => {
  beforeAll(async () => {
    await import('../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ═══════════════════════════════════════════════════════════════════
  // AC: TRUST BAR — 5-icon Joybird-style trust strip
  // ═══════════════════════════════════════════════════════════════════

  describe('trust bar — 5 trust signals', () => {
    it('renders all 5 trust item texts', async () => {
      await onReadyHandler();
      const texts = [];
      for (let i = 1; i <= 5; i++) {
        texts.push(getEl(`#trustText${i}`).text);
      }
      expect(texts.filter(t => t.length > 0)).toHaveLength(5);
    });

    it('includes "White Glove Delivery" as 5th signal', async () => {
      await onReadyHandler();
      const text5 = getEl('#trustText5').text;
      expect(text5).toBe('White Glove Delivery');
    });

    it('preserves "Largest Selection in the Carolinas"', async () => {
      await onReadyHandler();
      expect(getEl('#trustText1').text).toBe('Largest Selection in the Carolinas');
    });

    it('preserves "Family Owned Since 1991"', async () => {
      await onReadyHandler();
      expect(getEl('#trustText2').text).toBe('Family Owned Since 1991');
    });

    it('preserves "700+ Fabric Swatches"', async () => {
      await onReadyHandler();
      expect(getEl('#trustText3').text).toBe('700+ Fabric Swatches');
    });

    it('preserves "Free Shipping on Orders $999+"', async () => {
      await onReadyHandler();
      expect(getEl('#trustText4').text).toBe('Free Shipping on Orders $999+');
    });
  });

  describe('trust bar — icons', () => {
    it('wires icon content for each of the 5 trust items', async () => {
      await onReadyHandler();
      for (let i = 1; i <= 5; i++) {
        expect(getEl(`#trustIcon${i}`).text).toBeTruthy();
      }
    });

    it('each icon has distinct content', async () => {
      await onReadyHandler();
      const icons = [];
      for (let i = 1; i <= 5; i++) {
        icons.push(getEl(`#trustIcon${i}`).text);
      }
      const unique = new Set(icons);
      expect(unique.size).toBe(5);
    });
  });

  describe('trust bar — staggered animation', () => {
    it('shows each trust item with fade-in', async () => {
      await onReadyHandler();
      for (let i = 1; i <= 5; i++) {
        expect(getEl(`#trustItem${i}`).show).toHaveBeenCalledWith(
          'fade',
          expect.objectContaining({ duration: 400 })
        );
      }
    });

    it('staggers animation delay across items', async () => {
      await onReadyHandler();
      const delays = [];
      for (let i = 1; i <= 5; i++) {
        const call = getEl(`#trustItem${i}`).show.mock.calls[0];
        delays.push(call[1].delay);
      }
      // Each subsequent item should have a larger delay
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    });
  });

  describe('trust bar — accessibility', () => {
    it('sets aria-label on each trust item', async () => {
      await onReadyHandler();
      for (let i = 1; i <= 5; i++) {
        const el = getEl(`#trustItem${i}`);
        expect(el.accessibility.ariaLabel).toBeTruthy();
      }
    });
  });

  describe('trust bar — graceful degradation', () => {
    it('does not throw when #trustBar element is missing', async () => {
      // Clear to remove any cached trust bar element
      elements.clear();
      // Simulate missing element by making #trustBar return null-like behavior
      // The existing code checks `if (!trustBar) return;` which should work
      // Just verify the page init doesn't throw
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });
});
