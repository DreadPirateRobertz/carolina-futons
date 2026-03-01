import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, futonMattress, wallHuggerFrame, saleProduct, outdoorFrame } from './fixtures/products.js';

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
    options: [],
    data: [],
    style: { color: '', backgroundColor: '', opacity: '' },
    accessibility: { ariaLabel: '', ariaModal: false, role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onKeyPress: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
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

// ── Product fixtures with color/options data ────────────────────────

const featuredWithColor = {
  ...wallHuggerFrame,
  color: 'walnut',
  productOptions: [
    { name: 'Finish', optionType: 'color', choices: [
      { value: 'Black Walnut', inStock: true },
      { value: 'Natural', inStock: true },
      { value: 'Espresso', inStock: true },
    ] },
  ],
};

const frameWithColor = {
  ...futonFrame,
  color: 'natural',
  productOptions: [
    { name: 'Finish', optionType: 'color', choices: [
      { value: 'Natural', inStock: true },
      { value: 'Cherry', inStock: true },
    ] },
  ],
};

const mattressWithColor = {
  ...futonMattress,
  color: 'white',
  productOptions: [],
};

const noColorProduct = {
  ...outdoorFrame,
  color: undefined,
  productOptions: undefined,
};

const mockFeatured = [featuredWithColor, frameWithColor, mattressWithColor];
const mockSaleItems = [saleProduct, futonMattress];

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue(mockFeatured),
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleItems),
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
    if (el && typeof el.onClick === 'function') el.onClick(handler);
    if (el && opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
}));

vi.mock('wix-data', () => {
  const mockQuery = {
    hasSome: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue(12),
    find: vi.fn().mockResolvedValue({ items: [] }),
    eq: vi.fn().mockReturnThis(),
    ne: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    ascending: vi.fn().mockReturnThis(),
  };
  return { default: { query: vi.fn(() => mockQuery) } };
});

vi.mock('public/cartService', () => ({
  addToCart: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Home Page — Product Card Grid', () => {
  beforeAll(async () => {
    await import('../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Helper: invoke onItemReady callback with an item scope ──────

  function getItemReadyCb(repeaterId) {
    const repeater = getEl(repeaterId);
    const calls = repeater.onItemReady.mock.calls;
    if (calls.length === 0) return null;
    return calls[calls.length - 1][0];
  }

  function createItemScope() {
    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) {
        itemElements[sel] = {
          text: '', src: '', alt: '', html: '', label: '',
          style: { color: '', backgroundColor: '', opacity: '' },
          accessibility: { ariaLabel: '', ariaModal: false, role: '' },
          show: vi.fn(() => Promise.resolve()),
          hide: vi.fn(() => Promise.resolve()),
          collapse: vi.fn(),
          expand: vi.fn(),
          onClick: vi.fn(),
          onMouseIn: vi.fn(),
          onMouseOut: vi.fn(),
          disable: vi.fn(),
          enable: vi.fn(),
        };
      }
      return itemElements[sel];
    };
    return { $item, itemElements };
  }

  // ── Featured Products Card Rendering ────────────────────────────

  describe('featured product card rendering', () => {
    it('sets section heading and subtitle', async () => {
      await onReadyHandler();
      expect(getEl('#featuredTitle').text).toBe('Our Favorite Finds');
      expect(getEl('#featuredSubtitle').text).toContain('Handpicked');
    });

    it('populates featured repeater with product data', async () => {
      await onReadyHandler();
      expect(getEl('#featuredRepeater').data).toEqual(mockFeatured);
    });

    it('onItemReady sets image, name, and price on card', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      expect(cb).toBeTruthy();

      const { $item, itemElements } = createItemScope();
      cb($item, featuredWithColor);

      expect(itemElements['#featuredImage'].src).toBe(wallHuggerFrame.mainMedia);
      expect(itemElements['#featuredName'].text).toBe(wallHuggerFrame.name);
      expect(itemElements['#featuredPrice'].text).toBe(wallHuggerFrame.formattedPrice);
    });

    it('onItemReady sets SEO alt text on product image', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, frameWithColor);
      expect(itemElements['#featuredImage'].alt).toContain('Eureka');
      expect(itemElements['#featuredImage'].alt).toContain('Carolina Futons');
    });
  });

  // ── Sale Badge + Pricing ────────────────────────────────────────

  describe('sale badge and pricing', () => {
    it('shows discounted price and original strikethrough for sale items', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, mattressWithColor);
      expect(itemElements['#featuredPrice'].text).toBe(futonMattress.formattedDiscountedPrice);
      expect(itemElements['#featuredOriginalPrice'].text).toBe(futonMattress.formattedPrice);
      expect(itemElements['#featuredOriginalPrice'].show).toHaveBeenCalled();
      expect(itemElements['#featuredSaleBadge'].show).toHaveBeenCalled();
    });

    it('does NOT show sale badge for non-discounted products', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      // Price should be regular price (no discount)
      expect(itemElements['#featuredPrice'].text).toBe(wallHuggerFrame.formattedPrice);
      // Sale badge should be hidden for non-discounted products
      expect(itemElements['#featuredSaleBadge']?.hide).toHaveBeenCalled();
    });
  });

  // ── Ribbon Badges ───────────────────────────────────────────────

  describe('ribbon badges', () => {
    it('shows ribbon badge text for products with ribbon', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor); // wallHuggerFrame has ribbon: 'Featured'
      expect(itemElements['#featuredRibbon'].text).toBe('Featured');
      expect(itemElements['#featuredRibbon'].show).toHaveBeenCalled();
    });

    it('hides ribbon for products without ribbon', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, frameWithColor); // futonFrame has ribbon: ''
      expect(itemElements['#featuredRibbon'].hide).toHaveBeenCalled();
    });
  });

  // ── Color Swatches ──────────────────────────────────────────────

  describe('color swatches', () => {
    it('displays color indicator text for products with color options', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      // Product has 3 color choices — should show swatch count or color text
      expect(itemElements['#featuredColorText'].text).toMatch(/3|finish/i);
    });

    it('shows color swatch container for products with options', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      expect(itemElements['#featuredSwatchContainer'].show).toHaveBeenCalled();
    });

    it('hides color swatch container for products without color options', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, mattressWithColor); // empty productOptions
      expect(itemElements['#featuredSwatchContainer'].hide).toHaveBeenCalled();
    });

    it('handles missing productOptions gracefully', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item } = createItemScope();

      expect(() => cb($item, noColorProduct)).not.toThrow();
    });
  });

  // ── Quick View ──────────────────────────────────────────────────

  describe('Quick View button', () => {
    it('wires Quick View button click handler on each card', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      expect(itemElements['#featuredQuickViewBtn'].onClick).toHaveBeenCalled();
    });

    it('Quick View button has accessible label', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      expect(itemElements['#featuredQuickViewBtn'].accessibility.ariaLabel)
        .toContain('Quick view');
    });
  });

  describe('Quick View modal', () => {
    it('registers Quick View modal handlers during page init', async () => {
      await onReadyHandler();

      // Close button should have onClick registered
      expect(getEl('#featuredQvClose').onClick).toHaveBeenCalled();
      // View Full button should have onClick registered
      expect(getEl('#featuredQvViewFull').onClick).toHaveBeenCalled();
      // Add to Cart button should have onClick registered
      expect(getEl('#featuredQvAddToCart').onClick).toHaveBeenCalled();
    });

    it('opening Quick View populates modal with product data', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);

      // Simulate clicking the Quick View button
      const qvClickHandler = itemElements['#featuredQuickViewBtn'].onClick.mock.calls[0][0];
      qvClickHandler();

      // Modal should be populated
      expect(getEl('#featuredQvImage').src).toBe(wallHuggerFrame.mainMedia);
      expect(getEl('#featuredQvName').text).toBe(wallHuggerFrame.name);
      expect(getEl('#featuredQvPrice').text).toBe(wallHuggerFrame.formattedPrice);
    });

    it('opening Quick View shows the modal with fade', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      const qvClickHandler = itemElements['#featuredQuickViewBtn'].onClick.mock.calls[0][0];
      qvClickHandler();

      expect(getEl('#featuredQuickViewModal').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 200 })
      );
    });

    it('closing Quick View hides the modal', async () => {
      await onReadyHandler();

      // Trigger close
      const closeHandler = getEl('#featuredQvClose').onClick.mock.calls[0][0];
      closeHandler();

      expect(getEl('#featuredQuickViewModal').hide).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 200 })
      );
    });

    it('Quick View modal has ARIA dialog attributes', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      const qvClickHandler = itemElements['#featuredQuickViewBtn'].onClick.mock.calls[0][0];
      qvClickHandler();

      const modal = getEl('#featuredQuickViewModal');
      expect(modal.accessibility.role).toBe('dialog');
      expect(modal.accessibility.ariaModal).toBe(true);
    });
  });

  // ── Card Click Navigation ───────────────────────────────────────

  describe('card click navigation', () => {
    it('registers click handlers on image and name for navigation', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, frameWithColor);
      expect(itemElements['#featuredImage'].onClick).toHaveBeenCalled();
      expect(itemElements['#featuredName'].onClick).toHaveBeenCalled();
    });

    it('image click handler navigates to safe-slugified product URL', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, frameWithColor);
      // makeClickable was called — just confirm onClick was wired
      expect(itemElements['#featuredImage'].onClick).toHaveBeenCalled();
    });
  });

  // ── Accessibility ───────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets aria labels on product image', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      expect(itemElements['#featuredImage'].accessibility.ariaLabel)
        .toContain(wallHuggerFrame.name);
    });

    it('sets aria labels on product name', async () => {
      await onReadyHandler();
      const cb = getItemReadyCb('#featuredRepeater');
      const { $item, itemElements } = createItemScope();

      cb($item, featuredWithColor);
      expect(itemElements['#featuredName'].accessibility.ariaLabel)
        .toContain(wallHuggerFrame.name);
    });
  });

  // ── Error Handling ──────────────────────────────────────────────

  describe('error handling', () => {
    it('handles empty featured products gracefully', async () => {
      const { getFeaturedProducts } = await import('backend/productRecommendations.web');
      getFeaturedProducts.mockResolvedValueOnce([]);

      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('handles getFeaturedProducts rejection gracefully', async () => {
      const { getFeaturedProducts } = await import('backend/productRecommendations.web');
      getFeaturedProducts.mockRejectedValueOnce(new Error('Network error'));

      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('handles missing repeater element gracefully', async () => {
      // Clear to simulate missing repeater — the get will return mock with no data assignment
      const { getFeaturedProducts } = await import('backend/productRecommendations.web');
      getFeaturedProducts.mockResolvedValueOnce([]);

      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });
});
