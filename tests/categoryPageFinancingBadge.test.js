/**
 * @file categoryPageFinancingBadge.test.js
 * @description CF-3dz8: Financing badge on product cards in the category grid.
 *
 * Tests that getBatchPaymentBadges is called with product price data and
 * renderCardFinancingBadge is invoked correctly in onItemReady.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock ─────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: {},
    accessibility: {},
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn().mockResolvedValue(undefined),
    onViewportEnter: vi.fn(),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onItemClicked: vi.fn(),
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

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      limit: vi.fn(() => ({
        ascending: vi.fn(() => ({
          find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
        })),
      })),
      find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    })),
    sort: vi.fn(() => ({ ascending: vi.fn().mockReturnThis(), descending: vi.fn().mockReturnThis() })),
  },
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['futon-frames'], onChange: vi.fn(), query: {} },
}));

vi.mock('wix-seo-frontend', () => ({
  default: { setLinks: vi.fn(), setMetaTags: vi.fn(), setStructuredData: vi.fn(), setTitle: vi.fn() },
}));

vi.mock('backend/seoHelpers.web', () => ({
  getCollectionSchema: vi.fn().mockResolvedValue(null),
  getBreadcrumbSchema: vi.fn().mockResolvedValue(null),
  getCategoryMetaDescription: vi.fn().mockResolvedValue(''),
  getCategoryOgTags: vi.fn().mockResolvedValue([]),
  getCanonicalUrl: vi.fn().mockResolvedValue(''),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/searchService.web', () => ({
  getFilterValues: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('backend/categorySearch.web', () => ({
  searchProducts: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  suggestFilterRelaxation: vi.fn().mockResolvedValue(null),
  getFacetMetadata: vi.fn().mockResolvedValue({}),
}));

vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/paymentOptions.web', () => ({
  getBatchPaymentBadges: vi.fn().mockResolvedValue({ success: true, badges: {} }),
}));

vi.mock('public/galleryHelpers', () => ({
  getProductBadge: vi.fn().mockReturnValue(null),
  getRecentlyViewed: vi.fn().mockReturnValue([]),
  addToCompare: vi.fn(),
  removeFromCompare: vi.fn(),
  getCompareList: vi.fn().mockReturnValue([]),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn().mockReturnValue('fallback.jpg'),
}));

vi.mock('public/categoryFilterHelpers', () => ({
  buildFilterChips: vi.fn().mockReturnValue([]),
  removeFilter: vi.fn(),
  clearAllFilters: vi.fn().mockReturnValue({}),
  serializeFiltersToUrl: vi.fn(),
  deserializeFiltersFromUrl: vi.fn().mockReturnValue({}),
  formatFeatureLabel: vi.fn().mockReturnValue(''),
  sanitizeFilterInput: vi.fn().mockReturnValue(''),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn().mockReturnValue(false),
  initBackToTop: vi.fn(),
  onViewportChange: vi.fn(),
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    await Promise.allSettled(sections.map(s => s.init()));
    return { critical: [] };
  }),
}));

vi.mock('public/CategoryPagePolish.js', () => ({
  applyCategoryPageTokens: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewItemList: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { sandBase: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8' },
}));

vi.mock('public/productCache', () => ({
  getRecentlyViewed: vi.fn().mockReturnValue([]),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn().mockReturnValue('alt'),
  detectProductBrand: vi.fn().mockReturnValue(null),
  isCallForPrice: vi.fn().mockReturnValue(false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  createFocusTrap: vi.fn(),
  setupAccessibleDialog: vi.fn(),
}));

vi.mock('public/socialProofToast', () => ({
  initCategorySocialProof: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/flashSaleHelpers', () => ({
  initFlashSaleBanner: vi.fn().mockResolvedValue(null),
}));

vi.mock('public/WishlistCardButton', () => ({
  initCardWishlistButton: vi.fn(),
  batchCheckWishlistStatus: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock('public/StarRatingCard', () => ({
  batchLoadRatings: vi.fn().mockResolvedValue({}),
  renderCardStarRating: vi.fn(),
  _resetCache: vi.fn(),
}));

vi.mock('public/productCardHelpers.js', () => ({
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn().mockReturnValue(''),
  setCardImage: vi.fn(),
  renderCardFinancingBadge: vi.fn(),
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn().mockReturnValue({}),
}));

vi.mock('public/lifestyleImages.js', () => ({
  getLifestyleOverlay: vi.fn().mockReturnValue(null),
}));

// ── Load page ───────────────────────────────────────────────────────

let getBatchPaymentBadgesMock;
let renderCardFinancingBadgeMock;

beforeAll(async () => {
  await import('../src/pages/Category Page.js');
  const paymentMod = await import('backend/paymentOptions.web');
  getBatchPaymentBadgesMock = paymentMod.getBatchPaymentBadges;
  const cardHelpersMod = await import('public/productCardHelpers.js');
  renderCardFinancingBadgeMock = cardHelpersMod.renderCardFinancingBadge;
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore promise-returning mock after clearAllMocks resets call history
  getBatchPaymentBadgesMock?.mockResolvedValue({ success: true, badges: {} });
  elements.clear();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Category Page — financing badge (CF-3dz8)', () => {
  function setupRepeaterWithProducts(products = []) {
    const repeater = getEl('#productGridRepeater');
    repeater.data = products;
    return repeater;
  }

  async function triggerOnReady() {
    if (onReadyHandler) await onReadyHandler();
  }

  it('calls getBatchPaymentBadges with product id + price pairs when products have prices', async () => {
    setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' },
      { _id: 'prod-2', name: 'Futon B', price: 799, slug: 'futon-b' },
    ]);

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 0)); // flush promises

    expect(getBatchPaymentBadgesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'prod-1', price: 499 }),
        expect.objectContaining({ productId: 'prod-2', price: 799 }),
      ])
    );
  });

  it('does not call getBatchPaymentBadges when no products have prices', async () => {
    setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 0, slug: 'futon-a' },
    ]);

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 0));

    expect(getBatchPaymentBadgesMock).not.toHaveBeenCalled();
  });

  it('passes badge array to renderCardFinancingBadge in onItemReady', async () => {
    getBatchPaymentBadgesMock.mockResolvedValue({
      success: true,
      badges: { 'prod-1': [{ label: 'Pay in 4 with Afterpay', type: 'afterpay' }] },
    });

    const repeater = setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' },
    ]);

    // Simulate onItemReady being triggered
    repeater.onItemReady.mockImplementation((cb) => {
      const $item = (sel) => getEl(`prod-1:${sel}`);
      cb($item, { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' });
    });

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 20));

    expect(renderCardFinancingBadgeMock).toHaveBeenCalledWith(
      expect.anything(),
      [{ label: 'Pay in 4 with Afterpay', type: 'afterpay' }]
    );
  });

  it('hides badge for product with no financing badges', async () => {
    getBatchPaymentBadgesMock.mockResolvedValue({
      success: true,
      badges: {},
    });

    const repeater = setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 50, slug: 'futon-a' },
    ]);

    repeater.onItemReady.mockImplementation((cb) => {
      const $item = (sel) => getEl(`prod-1:${sel}`);
      cb($item, { _id: 'prod-1', name: 'Futon A', price: 50, slug: 'futon-a' });
    });

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 20));

    expect(renderCardFinancingBadgeMock).toHaveBeenCalledWith(
      expect.anything(),
      null
    );
  });

  it('calls renderCardFinancingBadge with null when getBatchPaymentBadges fails (graceful degradation)', async () => {
    getBatchPaymentBadgesMock.mockRejectedValue(new Error('API down'));

    const repeater = setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' },
    ]);

    repeater.onItemReady.mockImplementation((cb) => {
      const $item = (sel) => getEl(`prod-1:${sel}`);
      cb($item, { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' });
    });

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 20));

    // catch handler resolves to {} — renderCardFinancingBadge called with null (no badge)
    expect(renderCardFinancingBadgeMock).toHaveBeenCalledWith(
      expect.anything(),
      null
    );
  });

  it('treats success:false response as empty badges (graceful degradation)', async () => {
    getBatchPaymentBadgesMock.mockResolvedValue({ success: false, error: 'internal error' });

    const repeater = setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' },
    ]);

    repeater.onItemReady.mockImplementation((cb) => {
      const $item = (sel) => getEl(`prod-1:${sel}`);
      cb($item, { _id: 'prod-1', name: 'Futon A', price: 499, slug: 'futon-a' });
    });

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 20));

    // r.badges is undefined when success:false — ?? {} resolves to {} — no badge entry for prod-1
    expect(renderCardFinancingBadgeMock).toHaveBeenCalledWith(
      expect.anything(),
      null
    );
  });

  it('excludes products with null or undefined price from the batch call', async () => {
    setupRepeaterWithProducts([
      { _id: 'prod-1', name: 'Futon A', price: null },
      { _id: 'prod-2', name: 'Futon B', price: undefined },
    ]);

    await triggerOnReady();
    await new Promise(r => setTimeout(r, 0));

    expect(getBatchPaymentBadgesMock).not.toHaveBeenCalled();
  });
});
