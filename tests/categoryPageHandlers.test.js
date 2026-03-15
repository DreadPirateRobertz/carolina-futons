import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

// ── Mock wix-data ──────────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      limit: vi.fn(() => ({
        ascending: vi.fn(() => ({
          find: vi.fn(() => Promise.resolve({ items: [], totalCount: 0 })),
        })),
      })),
    })),
  },
}));

// ── Mock wix-location-frontend ──────────────────────────────────────

vi.mock('wix-location-frontend', () => ({
  default: {
    path: ['futon-frames'],
    to: vi.fn(),
    query: {},
    onChange: vi.fn(),
  },
}));

// ── Mock wix-seo-frontend ──────────────────────────────────────────

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
  getCollectionSchema: vi.fn().mockResolvedValue(''),
  getBreadcrumbSchema: vi.fn().mockResolvedValue(''),
  getCategoryMetaDescription: vi.fn().mockResolvedValue(''),
  getCategoryOgTags: vi.fn().mockResolvedValue(''),
  getCanonicalUrl: vi.fn().mockResolvedValue(''),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: vi.fn().mockResolvedValue([]),
}));

vi.mock('backend/searchService.web', () => ({
  getFilterValues: vi.fn().mockResolvedValue({ materials: [], colors: [], features: [] }),
}));

vi.mock('backend/categorySearch.web', () => ({
  searchProducts: vi.fn().mockResolvedValue({ success: true, products: [], total: 0, facets: {} }),
  suggestFilterRelaxation: vi.fn().mockResolvedValue({ suggestions: [] }),
  getFacetMetadata: vi.fn().mockResolvedValue({}),
}));

vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn().mockResolvedValue([]),
}));

// ── Mock Public Modules ─────────────────────────────────────────────

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
  prioritizeSections: vi.fn(async (sections, opts) => {
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    const results = await Promise.allSettled(critical.map(s => s.init()));
    Promise.allSettled(deferred.map(s => s.init())).catch(() => {});
    return { critical: results };
  }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewItemList: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#C2B280',
    sandDark: '#A89060',
    sandLight: '#D9CCB0',
    mountainBlue: '#4A6D8C',
    mountainBlueLight: '#7A9BB5',
    sunsetCoral: '#E07A5F',
    sunsetCoralLight: '#F0A090',
  },
}));

vi.mock('public/productCache', () => ({
  getRecentlyViewed: vi.fn().mockReturnValue([]),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn().mockReturnValue(''),
  detectProductBrand: vi.fn().mockReturnValue(''),
  isCallForPrice: vi.fn().mockReturnValue(false),
  CALL_FOR_PRICE_TEXT: 'Call',
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  createFocusTrap: vi.fn().mockReturnValue({ activate: vi.fn(), deactivate: vi.fn() }),
  setupAccessibleDialog: vi.fn().mockReturnValue({ open: vi.fn(), close: vi.fn(), destroy: vi.fn() }),
}));

vi.mock('public/socialProofToast', () => ({
  initCategorySocialProof: vi.fn().mockResolvedValue(),
}));

vi.mock('public/flashSaleHelpers', () => ({
  initFlashSaleBanner: vi.fn(),
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
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn().mockReturnValue({}),
}));

vi.mock('public/lifestyleImages.js', () => ({
  getLifestyleOverlay: vi.fn().mockReturnValue(null),
}));

// ── Import Page Under Test ──────────────────────────────────────────

let resetRatingsCache;
let prioritizeSections;
let trackEvent;
let onViewportChange;
let initCategorySocialProof;

beforeAll(async () => {
  await import('../src/pages/Category Page.js');
  const starRatingCard = await import('public/StarRatingCard');
  resetRatingsCache = starRatingCard._resetCache;
  const perfHelpers = await import('public/performanceHelpers.js');
  prioritizeSections = perfHelpers.prioritizeSections;
  const tracker = await import('public/engagementTracker');
  trackEvent = tracker.trackEvent;
  const mobileHelpers = await import('public/mobileHelpers');
  onViewportChange = mobileHelpers.onViewportChange;
  const socialProof = await import('public/socialProofToast');
  initCategorySocialProof = socialProof.initCategorySocialProof;
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Category Page — onReady orchestration', () => {
  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls resetRatingsCache on ready', async () => {
    await onReadyHandler();
    expect(resetRatingsCache).toHaveBeenCalled();
  });

  it('calls prioritizeSections with critical and deferred sections', async () => {
    await onReadyHandler();
    expect(prioritizeSections).toHaveBeenCalledTimes(1);

    const [sections, opts] = prioritizeSections.mock.calls[0];
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);

    const criticalNames = sections.filter(s => s.critical).map(s => s.name);
    const deferredNames = sections.filter(s => !s.critical).map(s => s.name);
    expect(criticalNames).toContain('categoryHero');
    expect(criticalNames).toContain('productGrid');
    expect(deferredNames).toContain('recentlyViewed');
    expect(deferredNames).toContain('quickView');
  });

  it('provides an onError callback to prioritizeSections', async () => {
    await onReadyHandler();
    const [, opts] = prioritizeSections.mock.calls[0];
    expect(opts).toHaveProperty('onError');
    expect(opts.onError).toBeTypeOf('function');
  });

  it('does not throw when onReady executes', async () => {
    await expect(onReadyHandler()).resolves.not.toThrow();
  });

  it('calls trackEvent with page_view after sections resolve', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({
      page: 'category',
      category: 'futon-frames',
    }));
  });

  it('registers a viewport change handler via onViewportChange', async () => {
    await onReadyHandler();
    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls initCategorySocialProof after sections', async () => {
    await onReadyHandler();
    expect(initCategorySocialProof).toHaveBeenCalledWith(
      expect.anything(),
      'futon-frames'
    );
  });

  it('passes sortControls and resultCount as critical sections', async () => {
    await onReadyHandler();
    const [sections] = prioritizeSections.mock.calls[0];
    const criticalNames = sections.filter(s => s.critical).map(s => s.name);
    expect(criticalNames).toContain('sortControls');
    expect(criticalNames).toContain('resultCount');
    expect(criticalNames).toContain('restoreFilters');
  });

  it('passes filterControls and categoryMeta as deferred sections', async () => {
    await onReadyHandler();
    const [sections] = prioritizeSections.mock.calls[0];
    const deferredNames = sections.filter(s => !s.critical).map(s => s.name);
    expect(deferredNames).toContain('filterControls');
    expect(deferredNames).toContain('categoryMeta');
    expect(deferredNames).toContain('backToTop');
  });
});
