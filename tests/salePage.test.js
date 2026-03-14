import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    html: '',
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
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

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  isMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
  announce: vi.fn(),
}));

vi.mock('public/salePageHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/salePageHelpers.js');
  return actual;
});

const mockSaleProducts = [
  { _id: 'p1', name: 'Clover Murphy Bed', price: 2598, discountedPrice: 2398, slug: 'clover-murphy-bed' },
  { _id: 'p2', name: 'Northern Exposure Frame', price: 1129, discountedPrice: 903, slug: 'northern-exposure' },
];

vi.mock('backend/productRecommendations.web', () => ({
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleProducts),
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue({
    title: 'Showroom & Inventory Reduction Sale',
    subtitle: 'Limited time deals on floor models',
    discountCode: null,
    bannerMessage: 'Up to 60% off select items',
  }),
  getFlashSales: vi.fn().mockResolvedValue([]),
}));

// ── Load Page ──────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

describe('Sale Page', () => {
  beforeEach(async () => {
    await import('../src/pages/Sale.js');
  });

  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeInstanceOf(Function);
  });

  describe('page initialization', () => {
    it('tracks page view event', async () => {
      await onReadyHandler();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'sale' }));
    });

    it('initializes page SEO', async () => {
      await onReadyHandler();
      const { initPageSeo } = await import('public/pageSeo.js');
      expect(initPageSeo).toHaveBeenCalledWith('sale');
    });
  });

  describe('promotion banner', () => {
    it('sets promotion title', async () => {
      await onReadyHandler();
      const title = getEl('#salePromoTitle');
      expect(title.text).toContain('Showroom');
    });

    it('sets promotion banner message', async () => {
      await onReadyHandler();
      const banner = getEl('#salePromoBanner');
      expect(banner.text).toContain('60%');
    });
  });

  describe('price match note', () => {
    it('sets price match policy text', async () => {
      await onReadyHandler();
      const note = getEl('#salePriceMatchNote');
      expect(note.text).toContain('price-matching');
    });
  });

  describe('sale products repeater', () => {
    it('populates repeater with sale products', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleProductRepeater');
      expect(repeater.data).toHaveLength(2);
    });

    it('sets onItemReady on repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleProductRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets product name and price', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleProductRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_item_${sel}`);
      itemReadyCb($item, mockSaleProducts[0]);

      expect(getEl('_item_#saleProductName').text).toBe('Clover Murphy Bed');
      expect(getEl('_item_#saleProductPrice').text).toContain('Reg.');
      expect(getEl('_item_#saleProductPrice').text).toContain('$2,598');
    });

    it('repeater has accessible label', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleProductRepeater');
      expect(repeater.accessibility.ariaLabel).toContain('sale');
    });
  });

  describe('navigation', () => {
    it('wires shop link', async () => {
      await onReadyHandler();
      const shopLink = getEl('#saleShopLink');
      expect(shopLink.onClick).toHaveBeenCalled();
    });
  });
});
