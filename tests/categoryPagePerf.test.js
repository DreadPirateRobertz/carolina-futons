import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
vi.mock('public/a11yHelpers.js', async () => await vi.importActual('../src/public/a11yHelpers.js'));
import { futonFrame, wallHuggerFrame, futonMattress } from './fixtures/products.js';
import { __setPath } from './__mocks__/wix-location-frontend.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    enable: vi.fn(), disable: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onViewportEnter: vi.fn(),
    onReady: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(() => futonFrame),
    getTotalCount: vi.fn(() => 3),
    getItems: vi.fn(() => ({ items: [futonFrame] })),
    setSort: vi.fn(), setFilter: vi.fn(),
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

// ── Mock wix-seo-frontend ─────────────────────────────────────────

vi.mock('wix-seo-frontend', () => ({
  head: {
    setTitle: vi.fn(),
    setMetaTag: vi.fn(),
    setLinks: vi.fn(),
    setStructuredData: vi.fn(),
  },
}));

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getCollectionSchema: vi.fn().mockResolvedValue('{}'),
  getBreadcrumbSchema: vi.fn().mockResolvedValue('{}'),
  getCategoryMetaDescription: vi.fn().mockResolvedValue('desc'),
  getCategoryOgTags: vi.fn().mockResolvedValue('{}'),
  getCanonicalUrl: vi.fn().mockResolvedValue('https://example.com'),
}));

// ── Hoisted mocks for modules under test ────────────────────────────

const { mockBatchLoadRatings, mockGetSwatchPreviewColors } = vi.hoisted(() => ({
  mockBatchLoadRatings: vi.fn().mockResolvedValue({
    'prod-frame-001': { avg: 4.5, count: 12 },
    'prod-frame-002': { avg: 4.0, count: 8 },
    'prod-matt-001': { avg: 3.5, count: 5 },
  }),
  mockGetSwatchPreviewColors: vi.fn().mockResolvedValue([
    { colorHex: '#FF0000' }, { colorHex: '#00FF00' },
  ]),
}));

vi.mock('public/StarRatingCard', () => ({
  batchLoadRatings: mockBatchLoadRatings,
  renderCardStarRating: vi.fn(),
  _resetCache: vi.fn(),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: mockGetSwatchPreviewColors,
}));

// ── Auto-added by cf-obz: mock coverage gap reduction ──────────────
vi.mock('public/galleryHelpers', () => ({
  getProductBadge: vi.fn(() => null),
  getRecentlyViewed: vi.fn().mockResolvedValue([]),
  addToCompare: vi.fn(),
  removeFromCompare: vi.fn(),
  getCompareList: vi.fn(() => []),
}));
vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => ''),
}));
vi.mock('backend/searchService.web', () => ({
  getFilterValues: vi.fn().mockResolvedValue({}),
}));
vi.mock('backend/categorySearch.web', () => ({
  searchProducts: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  suggestFilterRelaxation: vi.fn().mockResolvedValue(null),
  getFacetMetadata: vi.fn().mockResolvedValue({}),
}));
vi.mock('public/categoryFilterHelpers', () => ({
  buildFilterChips: vi.fn(() => []),
  removeFilter: vi.fn(f => f),
  clearAllFilters: vi.fn(() => ({})),
  serializeFiltersToUrl: vi.fn(() => ''),
  deserializeFiltersFromUrl: vi.fn(() => ({})),
  formatFeatureLabel: vi.fn(v => v),
  sanitizeFilterInput: vi.fn(v => v),
}));
vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  initBackToTop: vi.fn(),
  onViewportChange: vi.fn(),
  collapseOnMobile: vi.fn(),
}));
vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    const critical = [];
    for (const s of sections.filter(s => s.critical)) {
      try { await s.init(); critical.push({ status: 'fulfilled', value: undefined }); }
      catch (e) { critical.push({ status: 'rejected', reason: e }); }
    }
    for (const s of sections.filter(s => !s.critical)) {
      try { await s.init(); } catch (_) {}
    }
    return { critical };
  }),
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackProductPageView: vi.fn(),
  trackCartAdd: vi.fn(),
}));
vi.mock('public/ga4Tracking', () => ({
  fireViewItemList: vi.fn(),
  fireViewContent: vi.fn(),
}));
vi.mock('public/productCache', () => ({
  getCachedProduct: vi.fn(() => null),
  cacheProduct: vi.fn(),
  getRecentlyViewed: vi.fn().mockResolvedValue([]),
}));
vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));
vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn(p => p?.name ?? ''),
  detectProductBrand: vi.fn(() => ''),
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));
// a11yHelpers intentionally NOT mocked — tests assert real makeClickable
// wiring (onClick handlers, tabIndex).
vi.mock('public/socialProofToast', () => ({
  initCategorySocialProof: vi.fn(() => Promise.resolve()),
  initProductSocialProof: vi.fn(() => Promise.resolve()),
}));
vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/paymentOptions.web', () => ({
  getBatchPaymentBadges: vi.fn().mockResolvedValue({}),
}));
vi.mock('public/flashSaleHelpers', () => ({
  initFlashSaleBanner: vi.fn(),
  initFlashSaleUrgency: vi.fn(),
  initProductUrgencyBadge: vi.fn(),
}));
vi.mock('public/WishlistCardButton', () => ({
  initCardWishlistButton: vi.fn(),
  batchCheckWishlistStatus: vi.fn().mockResolvedValue({}),
}));
vi.mock('public/productCardHelpers.js', () => ({
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn(),
  setCardImage: vi.fn(),
  renderCardFinancingBadge: vi.fn(),
  renderSimplePrice: vi.fn(),
  renderCardAssemblyBadge: vi.fn(),
}));
vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 400, height: 400 })),
}));
vi.mock('public/lifestyleImages.js', () => ({
  getLifestyleOverlay: vi.fn(() => ''),
}));
// ── End auto-added mocks ────────────────────────────────────────────
// ── Import Page (registers $w.onReady handler) ──────────────────────

describe('Category Page performance optimizations', () => {
  beforeAll(async () => {
    __setPath('futon-frames');
    await import('../src/pages/Category Page.js');
  });

  beforeEach(() => {
    vi.useFakeTimers();
    elements.clear();
    mockBatchLoadRatings.mockClear();
    mockGetSwatchPreviewColors.mockClear();

    // Pre-populate repeater with product data so initProductGrid can batch IDs
    const repeater = getEl('#productGridRepeater');
    repeater.data = [futonFrame, wallHuggerFrame, futonMattress];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Filter Debounce ────────────────────────────────────────────────

  describe('basic filter debounce', () => {
    it('does not call setFilter immediately after brand filter change', async () => {
      await onReadyHandler();
      const brandFilter = getEl('#filterBrand');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const onChange = brandFilter.onChange.mock.calls[0][0];
      brandFilter.value = 'Night & Day';
      onChange();

      // setFilter should NOT be called yet — debounced
      expect(dataset.setFilter).not.toHaveBeenCalled();
    });

    it('calls setFilter after 300ms debounce on brand filter', async () => {
      await onReadyHandler();
      const brandFilter = getEl('#filterBrand');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const onChange = brandFilter.onChange.mock.calls[0][0];
      brandFilter.value = 'Night & Day';
      onChange();

      vi.advanceTimersByTime(300);
      expect(dataset.setFilter).toHaveBeenCalled();
    });

    it('does not call setFilter immediately after price filter change', async () => {
      await onReadyHandler();
      const priceFilter = getEl('#filterPrice');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const onChange = priceFilter.onChange.mock.calls[0][0];
      priceFilter.value = '300-500';
      onChange();

      expect(dataset.setFilter).not.toHaveBeenCalled();
    });

    it('does not call setFilter immediately after size filter change', async () => {
      await onReadyHandler();
      const sizeFilter = getEl('#filterSize');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const onChange = sizeFilter.onChange.mock.calls[0][0];
      sizeFilter.value = 'Full';
      onChange();

      expect(dataset.setFilter).not.toHaveBeenCalled();
    });

    it('coalesces rapid filter changes into single setFilter call', async () => {
      await onReadyHandler();
      const brandFilter = getEl('#filterBrand');
      const priceFilter = getEl('#filterPrice');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const brandChange = brandFilter.onChange.mock.calls[0][0];
      const priceChange = priceFilter.onChange.mock.calls[0][0];

      brandFilter.value = 'Night & Day';
      brandChange();
      vi.advanceTimersByTime(100);

      priceFilter.value = '300-500';
      priceChange();
      vi.advanceTimersByTime(100);

      // Still waiting — timer reset
      expect(dataset.setFilter).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(dataset.setFilter).toHaveBeenCalledTimes(1);
    });

    it('clear filters button calls setFilter immediately (no debounce)', async () => {
      await onReadyHandler();
      const clearBtn = getEl('#clearFilters');
      const dataset = getEl('#categoryDataset');
      dataset.setFilter.mockClear();

      const onClick = clearBtn.onClick.mock.calls[0][0];
      onClick();

      // Clear should be immediate, not debounced
      expect(dataset.setFilter).toHaveBeenCalled();
    });
  });

  // ── Ratings Batching ───────────────────────────────────────────────

  describe('ratings batching', () => {
    it('calls batchLoadRatings with all product IDs during grid init', async () => {
      await onReadyHandler();

      // Should have been called with all 3 product IDs from repeater.data
      const calls = mockBatchLoadRatings.mock.calls;
      const batchCall = calls.find(c =>
        Array.isArray(c[0]) && c[0].length === 3
      );
      expect(batchCall).toBeDefined();
      expect(batchCall[0]).toContain('prod-frame-001');
      expect(batchCall[0]).toContain('prod-frame-002');
      expect(batchCall[0]).toContain('prod-matt-001');
    });

    it('does not call batchLoadRatings per-item for products in initial batch', async () => {
      await onReadyHandler();
      mockBatchLoadRatings.mockClear();

      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      // Call onItemReady for products already in the batch — should NOT trigger new calls
      await itemReadyCb($item, futonFrame);
      await itemReadyCb($item, wallHuggerFrame);
      await itemReadyCb($item, futonMattress);

      // Allow promises to settle
      await vi.waitFor(() => {
        expect(mockBatchLoadRatings).not.toHaveBeenCalled();
      });
    });

    it('falls back to per-item fetch for products not in initial batch (post-filter)', async () => {
      await onReadyHandler();
      mockBatchLoadRatings.mockClear();

      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      // Simulate a product that was NOT in the initial batch (e.g. appeared after filter change)
      const newProduct = { _id: 'prod-new-999', name: 'New Product', slug: 'new-product', price: 499 };
      mockBatchLoadRatings.mockResolvedValueOnce({ 'prod-new-999': { avg: 4.5, count: 10 } });

      await itemReadyCb($item, newProduct);

      // Allow promises to settle
      await vi.waitFor(() => {
        expect(mockBatchLoadRatings).toHaveBeenCalledWith(['prod-new-999']);
      });
    });

    it('handles empty repeater data without calling batchLoadRatings', async () => {
      const repeater = getEl('#productGridRepeater');
      repeater.data = [];
      mockBatchLoadRatings.mockClear();

      await onReadyHandler();

      // No product IDs to batch — should not call batchLoadRatings
      const batchCalls = mockBatchLoadRatings.mock.calls.filter(
        c => Array.isArray(c[0]) && c[0].length > 0
      );
      expect(batchCalls).toHaveLength(0);
    });

    it('handles null repeater data gracefully', async () => {
      const repeater = getEl('#productGridRepeater');
      repeater.data = null;
      mockBatchLoadRatings.mockClear();

      await onReadyHandler();

      // Should not crash — (repeater.data || []) handles null
      const batchCalls = mockBatchLoadRatings.mock.calls.filter(
        c => Array.isArray(c[0]) && c[0].length > 0
      );
      expect(batchCalls).toHaveLength(0);
    });

    it('handles batchLoadRatings rejection gracefully', async () => {
      mockBatchLoadRatings.mockRejectedValueOnce(new Error('API down'));

      // Should not throw — .catch(() => ({})) handles it
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Swatch Deferral ────────────────────────────────────────────────

  describe('swatch viewport deferral', () => {
    it('registers onViewportEnter on grid card instead of loading swatches eagerly', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      mockGetSwatchPreviewColors.mockClear();
      itemReadyCb($item, futonFrame);

      // onViewportEnter should be registered on #gridCard
      expect(itemElements['#gridCard'].onViewportEnter).toHaveBeenCalled();
      // Swatches should NOT be loaded yet
      expect(mockGetSwatchPreviewColors).not.toHaveBeenCalled();
    });

    it('loads swatches when card enters viewport', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      mockGetSwatchPreviewColors.mockClear();
      itemReadyCb($item, futonFrame);

      // Trigger viewport entry
      const viewportCb = itemElements['#gridCard'].onViewportEnter.mock.calls[0][0];
      await viewportCb();

      expect(mockGetSwatchPreviewColors).toHaveBeenCalledWith(futonFrame._id, 4);
    });

    it('loads swatches only once even if onViewportEnter fires multiple times', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      mockGetSwatchPreviewColors.mockClear();
      itemReadyCb($item, futonFrame);

      const viewportCb = itemElements['#gridCard'].onViewportEnter.mock.calls[0][0];
      await viewportCb();
      await viewportCb(); // second fire

      // Should only load once due to swatchLoaded guard
      expect(mockGetSwatchPreviewColors).toHaveBeenCalledTimes(1);
    });

    it('falls back to eager loading when onViewportEnter is unavailable', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            // No onViewportEnter — simulates fallback path
          };
        }
        return itemElements[sel];
      };

      mockGetSwatchPreviewColors.mockClear();
      itemReadyCb($item, futonFrame);

      // Without onViewportEnter, swatches should load eagerly (fallback)
      // Give the async call time to resolve
      await vi.advanceTimersByTimeAsync(100);
      expect(mockGetSwatchPreviewColors).toHaveBeenCalledWith(futonFrame._id, 4);
    });

    it('skips swatch loading for non-fabric products (mattresses)', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', value: '',
            style: { color: '', backgroundColor: '' },
            accessibility: {},
            show: vi.fn(), hide: vi.fn(),
            collapse: vi.fn(), expand: vi.fn(),
            onClick: vi.fn(), onChange: vi.fn(),
            onViewportEnter: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      mockGetSwatchPreviewColors.mockClear();
      itemReadyCb($item, futonMattress); // mattress — no fabric options

      // Trigger viewport entry
      const viewportCb = itemElements['#gridCard'].onViewportEnter.mock.calls[0]?.[0];
      if (viewportCb) await viewportCb();

      // Mattress has collections: ['mattresses'] — no fabric match
      // initGridSwatchPreview should skip the API call
      expect(mockGetSwatchPreviewColors).not.toHaveBeenCalled();
    });
  });
});
