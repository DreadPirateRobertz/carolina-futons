import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, futonMattress, wallHuggerFrame, saleProduct } from './fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    options: [],
    data: [],
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
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

const mockFeatured = [wallHuggerFrame, futonFrame, futonMattress];
const mockSaleItems = [saleProduct, futonMattress];

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue(mockFeatured),
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleItems),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

// ── Helpers ─────────────────────────────────────────────────────────

// Flush microtask queue so fire-and-forget deferred sections in
// prioritizeSections() have time to settle (hq-r3ie moved featuredProducts
// from critical to deferred).
const flushDeferred = () => new Promise(r => setTimeout(r, 50));

// ── Import Page ─────────────────────────────────────────────────────

describe('Home Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Featured Products ───────────────────────────────────────────

  describe('featured products', () => {
    it('populates featured repeater with product data', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      expect(repeater.data).toEqual(mockFeatured);
    });

    it('registers onItemReady for featured product cards', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets image, name, and price', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, wallHuggerFrame);
      expect(itemElements['#featuredImage'].src).toBe(wallHuggerFrame.mainMedia);
      expect(itemElements['#featuredName'].text).toBe(wallHuggerFrame.name);
      expect(itemElements['#featuredPrice'].text).toBe(wallHuggerFrame.formattedPrice);
    });

    it('onItemReady shows sale badge for discounted products', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonMattress);
      expect(itemElements['#featuredPrice'].text).toBe(futonMattress.formattedDiscountedPrice);
      expect(itemElements['#featuredSaleBadge'].show).toHaveBeenCalled();
      expect(itemElements['#featuredOriginalPrice'].show).toHaveBeenCalled();
    });

    it('onItemReady registers click handler on image and name', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#featuredImage'].onClick).toHaveBeenCalled();
      expect(itemElements['#featuredName'].onClick).toHaveBeenCalled();
    });

    it('onItemReady sets SEO alt text on image', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#featuredImage'].alt).toContain('Eureka');
      expect(itemElements['#featuredImage'].alt).toContain('Carolina Futons');
    });
  });

  // ── Sale Section ──────────────────────────────────────────────────

  describe('sale section', () => {
    it('populates sale repeater with sale items', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleRepeater');
      expect(repeater.data).toEqual(mockSaleItems);
    });

    it('registers onItemReady on sale repeater', async () => {
      await onReadyHandler();
      expect(getEl('#saleRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady populates sale card with product data', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, saleProduct);
      expect(itemElements['#saleImage'].src).toBe(saleProduct.mainMedia);
      expect(itemElements['#saleName'].text).toBe(saleProduct.name);
      expect(itemElements['#salePrice'].text).toBe(saleProduct.formattedDiscountedPrice);
    });

    it('collapses sale section when no sale items available', async () => {
      // Override mock to return empty sale items
      const { getSaleProducts } = await import('backend/productRecommendations.web');
      getSaleProducts.mockResolvedValueOnce([]);

      await onReadyHandler();
      expect(getEl('#saleSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Category Showcase ─────────────────────────────────────────────

  describe('category showcase', () => {
    it('registers click handlers on all category cards', async () => {
      await onReadyHandler();

      const categorySelectors = [
        '#categoryFutonFrames',
        '#categoryMattresses',
        '#categoryMurphy',
        '#categoryPlatformBeds',
        '#categoryCasegoods',
        '#categorySale',
      ];

      categorySelectors.forEach(sel => {
        expect(getEl(sel).onClick).toHaveBeenCalled();
      });
    });

    it('registers 6 category card click handlers', async () => {
      await onReadyHandler();
      // Count how many elements have onClick registered
      const categoryCards = [
        '#categoryFutonFrames',
        '#categoryMattresses',
        '#categoryMurphy',
        '#categoryPlatformBeds',
        '#categoryCasegoods',
        '#categorySale',
      ];
      const withClicks = categoryCards.filter(sel =>
        getEl(sel).onClick.mock.calls.length > 0
      );
      expect(withClicks).toHaveLength(6);
    });

    it('sets real CF product images on template category card boxes', async () => {
      await onReadyHandler();
      // Template boxes should get CF product images (not stock template photos)
      const templateImgIds = ['#image26', '#image24', '#image22', '#image20'];
      templateImgIds.forEach(id => {
        const img = getEl(id);
        // Images should be set to wixstatic.com URLs from placeholderImages
        expect(img.src).toContain('static.wixstatic.com');
        expect(img.src).toContain('w_600,h_400');
      });
    });

    it('sets alt text on template category card images', async () => {
      await onReadyHandler();
      const templateImgIds = ['#image26', '#image24', '#image22', '#image20'];
      templateImgIds.forEach(id => {
        const img = getEl(id);
        expect(img.alt).toBeTruthy();
        expect(img.alt.length).toBeGreaterThan(5);
      });
    });
  });

  // ── Hero Animation ────────────────────────────────────────────────

  describe('hero animation', () => {
    it('shows hero title with fade animation', async () => {
      await onReadyHandler();
      expect(getEl('#heroTitle').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 200 })
      );
    });

    it('shows hero subtitle with staggered delay', async () => {
      await onReadyHandler();
      expect(getEl('#heroSubtitle').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 400 })
      );
    });

    it('shows hero CTA with longest delay', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 600 })
      );
    });

    it('hero CTA has click handler for shop navigation', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').onClick).toHaveBeenCalled();
    });

    it('stagger timing is title(200) < subtitle(500) < CTA(800)', async () => {
      await onReadyHandler();
      const titleDelay = getEl('#heroTitle').show.mock.calls[0][1].delay;
      const subtitleDelay = getEl('#heroSubtitle').show.mock.calls[0][1].delay;
      const ctaDelay = getEl('#heroCTA').show.mock.calls[0][1].delay;

      expect(titleDelay).toBeLessThan(subtitleDelay);
      expect(subtitleDelay).toBeLessThan(ctaDelay);
    });
  });

  // ── Recently Viewed Section ──────────────────────────────────────

  describe('recently viewed section', () => {
    it('does not throw when recentSection expand fails', async () => {
      // Simulate $w throwing for missing element (Wix behavior)
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#recentSection') throw new Error('Element not found');
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });
  });

  // ── Schema Injection ──────────────────────────────────────────────

  describe('schema injection', () => {
    it('injects WebSite schema into page', async () => {
      await onReadyHandler();
      expect(getEl('#websiteSchemaHtml').postMessage).toHaveBeenCalledWith(
        '{"@type":"WebSite"}'
      );
    });

    it('does not throw when websiteSchemaHtml element is missing', async () => {
      // Simulate $w throwing for missing element (Wix behavior)
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#websiteSchemaHtml') throw new Error('Element not found');
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });

    it('does not throw when getWebSiteSchema returns null', async () => {
      const { getWebSiteSchema } = await import('backend/seoHelpers.web');
      getWebSiteSchema.mockResolvedValueOnce(null);

      await expect(onReadyHandler()).resolves.not.toThrow();
      // postMessage should not be called with null schema
    });
  });

  // ── Press Logos (As Seen In) ────────────────────────────────────────

  describe('press logos section', () => {
    it('collapses template press logos section (CF-xc7t)', async () => {
      await onReadyHandler();
      expect(getEl('#section4').collapse).toHaveBeenCalled();
    });
  });

  // ── Testimonials Guard ─────────────────────────────────────────────

  describe('testimonials guard', () => {
    it('skips testimonials when testimonialSection is missing (CF-jbyh)', async () => {
      // testimonialRepeater maps to template press logos repeater (MISMATCH)
      // initTestimonials should bail when testimonialSection doesn't exist
      const original = globalThis.$w;
      const guardSelector = Object.assign(
        (sel) => {
          if (sel === '#testimonialSection') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = guardSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();
      // testimonialRepeater should NOT have data set (guard prevented it)
      expect(getEl('#testimonialRepeater').onItemReady).not.toHaveBeenCalled();

      globalThis.$w = original;
    });
  });

  // ── Swatch Promo Section ──────────────────────────────────────────

  describe('swatch promo section', () => {
    it('sets swatch promo title and subtitle', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoTitle').text).toBe('700+ Free Fabric Swatches');
      expect(getEl('#swatchPromoSubtitle').text).toContain('Feel the quality');
    });

    it('expands swatch promo section', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoSection').expand).toHaveBeenCalled();
    });

    it('registers click handler on swatch promo CTA', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoCTA').onClick).toHaveBeenCalled();
    });
  });
});
