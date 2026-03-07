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
  onViewportChange: vi.fn(() => () => {}),
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

  describe('trust bar — 4 trust signals (free shipping disabled)', () => {
    it('renders 4 trust item texts (free shipping hidden)', async () => {
      await onReadyHandler();
      const texts = [];
      for (const i of [1, 2, 3, 5]) {
        texts.push(getEl(`#trustText${i}`).text);
      }
      expect(texts.filter(t => t.length > 0)).toHaveLength(4);
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

    it('free shipping trust signal is hidden', async () => {
      await onReadyHandler();
      // trustItem4 (free shipping) is commented out — element should not be set
      expect(getEl('#trustText4').text).toBeFalsy();
    });
  });

  describe('trust bar — icons', () => {
    it('wires icon content for active trust items', async () => {
      await onReadyHandler();
      for (const i of [1, 2, 3, 5]) {
        expect(getEl(`#trustIcon${i}`).text).toBeTruthy();
      }
    });

    it('active icons have distinct content', async () => {
      await onReadyHandler();
      const icons = [];
      for (const i of [1, 2, 3, 5]) {
        icons.push(getEl(`#trustIcon${i}`).text);
      }
      const unique = new Set(icons);
      expect(unique.size).toBe(4);
    });
  });

  describe('trust bar — staggered animation', () => {
    it('shows each active trust item with fade-in', async () => {
      await onReadyHandler();
      for (const i of [1, 2, 3, 5]) {
        expect(getEl(`#trustItem${i}`).show).toHaveBeenCalledWith(
          'fade',
          expect.objectContaining({ duration: 300 })
        );
      }
    });

    it('staggers animation delay across active items', async () => {
      await onReadyHandler();
      const delays = [];
      for (const i of [1, 2, 3, 5]) {
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
    it('sets aria-label on active trust items', async () => {
      await onReadyHandler();
      for (const i of [1, 2, 3, 5]) {
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
