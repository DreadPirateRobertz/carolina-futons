/**
 * Tests for Category Page element hookup — CF-w7z8
 * Covers: #categoryHeroTitle, #categoryHeroSubtitle, #breadcrumbHome,
 * #breadcrumbCurrent, #categoryHeroSection, #categoryHeroSkyline,
 * #flashSaleBanner, #sortDropdown, #resultCount,
 * #filterCategory, #filterBrand, #filterPrice, #filterSize, #clearFilters,
 * #productGridRepeater, #gridCard, #gridImage, #gridName, #gridPrice,
 * #gridOrigPrice, #gridSaleBadge, #gridBadge, #gridBrand, #gridRibbon,
 * #quickViewBtn, #gridFabricBadge, #gridSwatchPreview,
 * #swatchDot1, #swatchDot2, #swatchDot3, #swatchDot4,
 * #gridCompareBtn, #gridLifestyleBadge,
 * #quickViewModal, #qvImage, #qvName, #qvPrice, #qvDescription,
 * #qvSizeSelect, #qvViewFull, #qvAddToCart, #qvClose,
 * #recentlyViewedSection, #recentlyViewedTitle, #recentlyViewedRepeater,
 * #recentImage, #recentName, #recentPrice,
 * #emptyStateSection, #emptyStateTitle, #emptyStateMessage, #emptyStateIllustration,
 * #filterMaterial, #filterColor, #filterFeatures, #filterPriceRange,
 * #filterComfortLevel, #filterWidthMin, #filterWidthMax,
 * #filterDepthMin, #filterDepthMax, #filterResultCount,
 * #clearAllFilters, #clearAllFiltersChip,
 * #filterToggleBtn, #filterDrawer, #filterDrawerOverlay, #filterDrawerApply,
 * #mobileSortBar, #activeFilterChips, #filterChipRepeater, #chipLabel,
 * #chipRemove, #filterChipsText, #filterLoadingIndicator,
 * #noMatchesSection, #noMatchesTitle, #noMatchesMessage, #noMatchesSuggestion,
 * #compareBar, #compareRepeater, #compareThumb, #compareName, #comparePrice,
 * #compareRemove, #compareViewBtn,
 * #categoryDataset, #categorySchemaHtml, #categoryBreadcrumbSchemaHtml, #categoryOgHtml
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    alt: '',
    data: [],
    items: [],
    options: [],
    checked: false,
    hidden: false,
    collapsed: false,
    placeholder: '',
    style: { color: '', backgroundColor: '', backgroundImage: '', fontWeight: '', borderColor: '', foregroundColor: '', opacity: 1 },
    accessibility: { ariaLabel: '', ariaLive: '', role: '', ariaExpanded: false },
    show: vi.fn(function () { this.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function () { this.hidden = true; return Promise.resolve(); }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn((fn) => { if (fn) fn(); return Promise.resolve(); }),
    onItemReady: vi.fn(),
    onViewportEnter: vi.fn(),
    onCurrentIndexChanged: vi.fn(),
    scrollTo: vi.fn(),
    click: vi.fn(),
    postMessage: vi.fn(),
    setSort: vi.fn(),
    setFilter: vi.fn(),
    getTotalCount: vi.fn(() => 5),
    getItems: vi.fn(() => Promise.resolve({ items: [] })),
    getCurrentItem: vi.fn(() => null),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    sort: vi.fn(() => ({
      ascending: vi.fn(() => ({})),
      descending: vi.fn(() => ({})),
    })),
    filter: vi.fn(() => ({
      contains: vi.fn(function () { return this; }),
      ge: vi.fn(function () { return this; }),
      le: vi.fn(function () { return this; }),
      hasSome: vi.fn(function () { return this; }),
    })),
  },
}));

vi.mock('wix-location-frontend', () => ({
  default: {
    path: ['futon-frames'],
    query: {},
    to: vi.fn(),
  },
  to: vi.fn(),
}));

vi.mock('wix-seo-frontend', () => ({
  head: {
    setTitle: vi.fn(),
    setMetaTag: vi.fn(),
    setLinks: vi.fn(),
    setStructuredData: vi.fn(),
  },
}));

vi.mock('backend/seoHelpers.web', () => ({
  getCollectionSchema: vi.fn(() => Promise.resolve(null)),
  getBreadcrumbSchema: vi.fn(() => Promise.resolve(null)),
  getCategoryMetaDescription: vi.fn(() => Promise.resolve(null)),
  getCategoryOgTags: vi.fn(() => Promise.resolve(null)),
  getCanonicalUrl: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('public/galleryHelpers', () => ({
  getProductBadge: vi.fn(() => null),
  getRecentlyViewed: vi.fn(() => []),
  addToCompare: vi.fn(() => true),
  removeFromCompare: vi.fn(),
  getCompareList: vi.fn(() => []),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'fallback.jpg'),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: vi.fn(() => Promise.resolve([])),
}));

vi.mock('backend/searchService.web', () => ({
  getFilterValues: vi.fn(() => Promise.resolve({
    materials: [{ value: 'Wood', count: 10 }],
    colors: [{ value: 'Brown', count: 8 }],
    features: [{ value: 'reclining', count: 5 }],
    dimensions: { width: { min: 30, max: 80 }, depth: { min: 20, max: 40 } },
    totalProducts: 42,
  })),
}));

vi.mock('backend/categorySearch.web', () => ({
  searchProducts: vi.fn(() => Promise.resolve({ items: [], totalCount: 0 })),
  suggestFilterRelaxation: vi.fn(() => Promise.resolve({ suggestions: [] })),
  getFacetMetadata: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('public/categoryFilterHelpers', () => ({
  buildFilterChips: vi.fn(() => []),
  removeFilter: vi.fn(() => ({})),
  clearAllFilters: vi.fn(() => ({})),
  serializeFiltersToUrl: vi.fn(() => ''),
  deserializeFiltersFromUrl: vi.fn(() => ({})),
  formatFeatureLabel: vi.fn((v) => v),
  sanitizeFilterInput: vi.fn((v) => v),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  initBackToTop: vi.fn(),
  onViewportChange: vi.fn(),
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    const criticalResults = await Promise.allSettled(critical.map(s => s.init()));
    // Run deferred too
    await Promise.allSettled(deferred.map(s => s.init()));
    return { critical: criticalResults };
  }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireViewItemList: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7',
    sandDark: '#C4A882',
    sandLight: '#F5EDE0',
    mountainBlue: '#5B8FA8',
    mountainBlueLight: '#8BB8CF',
    sunsetCoral: '#E8845C',
    sunsetCoralLight: '#F0A882',
  },
}));

vi.mock('public/productCache', () => ({
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn((item) => `${item.name} product image`),
  detectProductBrand: vi.fn(() => null),
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    if (el && opts?.ariaLabel) {
      el.accessibility.ariaLabel = opts.ariaLabel;
    }
    if (el && handler) {
      el.onClick(handler);
    }
  }),
  createFocusTrap: vi.fn(() => ({ release: vi.fn() })),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

vi.mock('public/socialProofToast', () => ({
  initCategorySocialProof: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn(() => Promise.resolve([])),
}));

vi.mock('public/flashSaleHelpers', () => ({
  initFlashSaleBanner: vi.fn(),
}));

vi.mock('public/WishlistCardButton', () => ({
  initCardWishlistButton: vi.fn(),
  batchCheckWishlistStatus: vi.fn(() => Promise.resolve(new Set())),
}));

vi.mock('public/StarRatingCard', () => ({
  batchLoadRatings: vi.fn(() => Promise.resolve({})),
  renderCardStarRating: vi.fn(),
  _resetCache: vi.fn(),
}));

vi.mock('public/productCardHelpers.js', () => ({
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn(),
  setCardImage: vi.fn(),
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 400, height: 400 })),
}));

vi.mock('public/lifestyleImages.js', () => ({
  getLifestyleOverlay: vi.fn(() => null),
}));

vi.mock('public/MountainSkyline.js', () => ({
  initMountainSkyline: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  await import('../src/pages/Category Page.js');
  if (onReadyHandler) await onReadyHandler();
}

function simulateRepeaterItem(repeaterId, itemData) {
  const repeater = getEl(repeaterId);
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[repeater.onItemReady.mock.calls.length - 1][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  handler($item, itemData);
  return $item;
}

// ── Category Hero Tests ─────────────────────────────────────────────

describe('Category Page — category hero element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets hero title text for known category', async () => {
    await loadPage();
    expect(getEl('#categoryHeroTitle').text).toBe('Futon Frames');
  });

  it('sets hero subtitle text for known category', async () => {
    await loadPage();
    expect(getEl('#categoryHeroSubtitle').text).toContain('Handcrafted frames');
  });

  it('sets breadcrumb Home text', async () => {
    await loadPage();
    expect(getEl('#breadcrumbHome').text).toBe('Home');
  });

  it('registers makeClickable on breadcrumbHome with ariaLabel', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers.js');
    expect(makeClickable).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ ariaLabel: 'Navigate to home page' })
    );
  });

  it('sets breadcrumb current text to category title', async () => {
    await loadPage();
    expect(getEl('#breadcrumbCurrent').text).toBe('Futon Frames');
  });

  it('sets hero section background gradient style', async () => {
    await loadPage();
    const section = getEl('#categoryHeroSection');
    // Either backgroundImage or backgroundColor gets set
    const hasStyle = section.style.backgroundImage !== '' || section.style.backgroundColor !== '';
    expect(hasStyle).toBe(true);
  });
});

// ── Sort Controls Tests ─────────────────────────────────────────────

describe('Category Page — #sortDropdown element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets sort dropdown options with 7 sort choices', async () => {
    await loadPage();
    const dropdown = getEl('#sortDropdown');
    expect(dropdown.options.length).toBe(7);
  });

  it('sets default sort value to bestselling', async () => {
    await loadPage();
    expect(getEl('#sortDropdown').value).toBe('bestselling');
  });

  it('sets ARIA label on sort dropdown', async () => {
    await loadPage();
    expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort products by');
  });

  it('registers onChange handler on sort dropdown', async () => {
    await loadPage();
    expect(getEl('#sortDropdown').onChange).toHaveBeenCalled();
  });
});

// ── Filter Controls Tests ───────────────────────────────────────────

describe('Category Page — filter controls element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on filterCategory', async () => {
    await loadPage();
    expect(getEl('#filterCategory').accessibility.ariaLabel).toBe('Browse by category');
  });

  it('sets ARIA label on filterBrand', async () => {
    await loadPage();
    expect(getEl('#filterBrand').accessibility.ariaLabel).toBe('Filter by brand');
  });

  it('sets ARIA label on filterPrice', async () => {
    await loadPage();
    expect(getEl('#filterPrice').accessibility.ariaLabel).toBe('Filter by price range');
  });

  it('sets ARIA label on filterSize', async () => {
    await loadPage();
    expect(getEl('#filterSize').accessibility.ariaLabel).toBe('Filter by size');
  });

  it('populates category filter options with 9 entries', async () => {
    await loadPage();
    const opts = getEl('#filterCategory').options;
    expect(opts.length).toBe(9);
    expect(opts[0].label).toBe('All Products');
  });

  it('sets category filter value to current path', async () => {
    await loadPage();
    expect(getEl('#filterCategory').value).toBe('futon-frames');
  });

  it('registers onChange on category filter', async () => {
    await loadPage();
    expect(getEl('#filterCategory').onChange).toHaveBeenCalled();
  });

  it('populates brand filter options', async () => {
    await loadPage();
    const opts = getEl('#filterBrand').options;
    expect(opts.length).toBeGreaterThanOrEqual(7);
    expect(opts[0].label).toBe('All Brands');
  });

  it('registers onChange on brand filter', async () => {
    await loadPage();
    expect(getEl('#filterBrand').onChange).toHaveBeenCalled();
  });

  it('populates price filter options', async () => {
    await loadPage();
    const opts = getEl('#filterPrice').options;
    expect(opts.length).toBe(6);
    expect(opts[0].label).toBe('All Prices');
  });

  it('registers onChange on price filter', async () => {
    await loadPage();
    expect(getEl('#filterPrice').onChange).toHaveBeenCalled();
  });

  it('populates size filter options', async () => {
    await loadPage();
    const opts = getEl('#filterSize').options;
    expect(opts.length).toBe(4);
    expect(opts[0].label).toBe('All Sizes');
  });

  it('registers onChange on size filter', async () => {
    await loadPage();
    expect(getEl('#filterSize').onChange).toHaveBeenCalled();
  });

  it('registers makeClickable on clearFilters with ariaLabel', async () => {
    await loadPage();
    expect(getEl('#clearFilters').accessibility.ariaLabel).toBe('Clear all filters');
  });
});

// ── Product Grid Repeater Tests ─────────────────────────────────────

describe('Category Page — #productGridRepeater child element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on product grid repeater', async () => {
    await loadPage();
    expect(getEl('#productGridRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets product name text in repeater item', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Vienna Frame', slug: 'vienna-frame', formattedPrice: '$499', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item).not.toBeNull();
    expect($item('#gridName').text).toBe('Vienna Frame');
  });

  it('calls styleCardContainer on gridCard', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test Frame', slug: 'test', collections: [] };
    simulateRepeaterItem('#productGridRepeater', itemData);
    const { styleCardContainer } = await import('public/productCardHelpers.js');
    expect(styleCardContainer).toHaveBeenCalled();
  });

  it('calls initCardHover on gridCard', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test Frame', slug: 'test', collections: [] };
    simulateRepeaterItem('#productGridRepeater', itemData);
    const { initCardHover } = await import('public/productCardHelpers.js');
    expect(initCardHover).toHaveBeenCalled();
  });

  it('calls setCardImage for product image', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test Frame', slug: 'test', collections: [] };
    simulateRepeaterItem('#productGridRepeater', itemData);
    const { setCardImage } = await import('public/productCardHelpers.js');
    expect(setCardImage).toHaveBeenCalled();
  });

  it('calls formatCardPrice with price elements', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test Frame', slug: 'test', formattedPrice: '$499', collections: [] };
    simulateRepeaterItem('#productGridRepeater', itemData);
    const { formatCardPrice } = await import('public/productCardHelpers.js');
    expect(formatCardPrice).toHaveBeenCalled();
  });

  it('registers makeClickable on gridImage with ariaLabel', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridImage').accessibility.ariaLabel).toBe('View Kodiak Frame');
  });

  it('registers makeClickable on gridName with ariaLabel', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridName').accessibility.ariaLabel).toBe('View Kodiak Frame details');
  });

  it('registers makeClickable on quickViewBtn', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Vienna Frame', slug: 'vienna', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#quickViewBtn').accessibility.ariaLabel).toBe('Quick view Vienna Frame');
  });

  it('shows fabric badge for futon collection products', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak', collections: ['futon-frames'] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridFabricBadge').text).toBe('Available in 700+ fabrics');
    expect($item('#gridFabricBadge').show).toHaveBeenCalled();
  });

  it('hides fabric badge for non-fabric products', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Mattress', slug: 'mattress', collections: ['mattresses'] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridFabricBadge').hide).toHaveBeenCalled();
  });

  it('shows ribbon when itemData has ribbon', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test', slug: 'test', ribbon: 'New!', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridRibbon').text).toBe('New!');
    expect($item('#gridRibbon').show).toHaveBeenCalled();
  });

  it('calls initCardWishlistButton for wishlist heart', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test', slug: 'test', collections: [] };
    simulateRepeaterItem('#productGridRepeater', itemData);
    const { initCardWishlistButton } = await import('public/WishlistCardButton');
    expect(initCardWishlistButton).toHaveBeenCalled();
  });

  it('shows brand label when brand detected', async () => {
    const { detectProductBrand } = await import('public/productPageUtils.js');
    detectProductBrand.mockReturnValue('Night & Day');
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test', slug: 'test', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridBrand').text).toBe('Night & Day');
    expect($item('#gridBrand').show).toHaveBeenCalled();
  });

  it('registers makeClickable on gridCompareBtn', async () => {
    await loadPage();
    const itemData = { _id: 'p1', name: 'Test Frame', slug: 'test', collections: [] };
    const $item = simulateRepeaterItem('#productGridRepeater', itemData);
    expect($item('#gridCompareBtn').label).toBe('Compare');
  });
});

// ── Quick View Modal Tests ──────────────────────────────────────────

describe('Category Page — quick view modal element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on qvViewFull', async () => {
    await loadPage();
    expect(getEl('#qvViewFull').accessibility.ariaLabel).toBe('View full product details');
  });

  it('sets ARIA label on qvAddToCart', async () => {
    await loadPage();
    expect(getEl('#qvAddToCart').accessibility.ariaLabel).toBe('Add to cart');
  });

  it('sets ARIA label on qvClose', async () => {
    await loadPage();
    expect(getEl('#qvClose').accessibility.ariaLabel).toBe('Close quick view');
  });

  it('registers onClick on qvViewFull', async () => {
    await loadPage();
    expect(getEl('#qvViewFull').onClick).toHaveBeenCalled();
  });

  it('registers onClick on qvAddToCart', async () => {
    await loadPage();
    expect(getEl('#qvAddToCart').onClick).toHaveBeenCalled();
  });

  it('calls setupAccessibleDialog for quickViewModal', async () => {
    await loadPage();
    const { setupAccessibleDialog } = await import('public/a11yHelpers.js');
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        panelId: '#quickViewModal',
        closeId: '#qvClose',
      })
    );
  });
});

// ── Result Count & Empty State Tests ────────────────────────────────

describe('Category Page — result count and empty state hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets result count text from dataset', async () => {
    await loadPage();
    const el = getEl('#resultCount');
    expect(el.text).toContain('product');
  });

  it('calls onReady on categoryDataset', async () => {
    await loadPage();
    expect(getEl('#categoryDataset').onReady).toHaveBeenCalled();
  });
});

// ── Recently Viewed Tests ───────────────────────────────────────────

describe('Category Page — recently viewed element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('hides recently viewed section when no items', async () => {
    await loadPage();
    expect(getEl('#recentlyViewedSection').hide).toHaveBeenCalled();
  });

  it('shows section and sets title when items exist', async () => {
    vi.doMock('public/galleryHelpers', () => ({
      getProductBadge: vi.fn(() => null),
      getRecentlyViewed: vi.fn(() => [
        { _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399', mainMedia: 'v.jpg' },
      ]),
      addToCompare: vi.fn(() => true),
      removeFromCompare: vi.fn(),
      getCompareList: vi.fn(() => []),
    }));

    await loadPage();
    expect(getEl('#recentlyViewedTitle').text).toBe('Recently Viewed');
    expect(getEl('#recentlyViewedSection').show).toHaveBeenCalled();
  });

  it('populates recently viewed repeater data', async () => {
    vi.doMock('public/galleryHelpers', () => ({
      getProductBadge: vi.fn(() => null),
      getRecentlyViewed: vi.fn(() => [
        { _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399', mainMedia: 'v.jpg' },
      ]),
      addToCompare: vi.fn(() => true),
      removeFromCompare: vi.fn(),
      getCompareList: vi.fn(() => []),
    }));

    await loadPage();
    const repeater = getEl('#recentlyViewedRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('sets recentName and recentPrice in repeater item', async () => {
    vi.doMock('public/galleryHelpers', () => ({
      getProductBadge: vi.fn(() => null),
      getRecentlyViewed: vi.fn(() => [
        { _id: 'rv1', name: 'Kodiak Frame', slug: 'kodiak-frame', price: '$599', mainMedia: 'k.jpg' },
      ]),
      addToCompare: vi.fn(() => true),
      removeFromCompare: vi.fn(),
      getCompareList: vi.fn(() => []),
    }));

    await loadPage();
    const $item = simulateRepeaterItem('#recentlyViewedRepeater', {
      _id: 'rv1', name: 'Kodiak Frame', slug: 'kodiak-frame', price: '$599',
    });
    expect($item).not.toBeNull();
    expect($item('#recentName').text).toBe('Kodiak Frame');
    expect($item('#recentPrice').text).toBe('$599');
  });

  it('registers makeClickable on recentImage', async () => {
    vi.doMock('public/galleryHelpers', () => ({
      getProductBadge: vi.fn(() => null),
      getRecentlyViewed: vi.fn(() => [
        { _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399', mainMedia: 'v.jpg' },
      ]),
      addToCompare: vi.fn(() => true),
      removeFromCompare: vi.fn(),
      getCompareList: vi.fn(() => []),
    }));

    await loadPage();
    const $item = simulateRepeaterItem('#recentlyViewedRepeater', {
      _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399',
    });
    expect($item('#recentImage').accessibility.ariaLabel).toBe('View Vienna Frame');
  });

  it('registers makeClickable on recentName', async () => {
    vi.doMock('public/galleryHelpers', () => ({
      getProductBadge: vi.fn(() => null),
      getRecentlyViewed: vi.fn(() => [
        { _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399', mainMedia: 'v.jpg' },
      ]),
      addToCompare: vi.fn(() => true),
      removeFromCompare: vi.fn(),
      getCompareList: vi.fn(() => []),
    }));

    await loadPage();
    const $item = simulateRepeaterItem('#recentlyViewedRepeater', {
      _id: 'rv1', name: 'Vienna Frame', slug: 'vienna-frame', price: '$399',
    });
    expect($item('#recentName').accessibility.ariaLabel).toBe('View Vienna Frame details');
  });
});

// ── Advanced Filters Tests ──────────────────────────────────────────

describe('Category Page — advanced filter element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on filterMaterial', async () => {
    await loadPage();
    expect(getEl('#filterMaterial').accessibility.ariaLabel).toBe('Filter by material');
  });

  it('populates filterMaterial options from facets', async () => {
    await loadPage();
    const opts = getEl('#filterMaterial').options;
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].label).toContain('Wood');
  });

  it('registers onChange on filterMaterial', async () => {
    await loadPage();
    expect(getEl('#filterMaterial').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on filterColor', async () => {
    await loadPage();
    expect(getEl('#filterColor').accessibility.ariaLabel).toBe('Filter by color');
  });

  it('populates filterColor options from facets', async () => {
    await loadPage();
    const opts = getEl('#filterColor').options;
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].label).toContain('Brown');
  });

  it('registers onChange on filterColor', async () => {
    await loadPage();
    expect(getEl('#filterColor').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on filterFeatures', async () => {
    await loadPage();
    expect(getEl('#filterFeatures').accessibility.ariaLabel).toBe('Filter by features');
  });

  it('registers onChange on filterFeatures', async () => {
    await loadPage();
    expect(getEl('#filterFeatures').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on filterPriceRange', async () => {
    await loadPage();
    expect(getEl('#filterPriceRange').accessibility.ariaLabel).toBe('Filter by price range');
  });

  it('registers onChange on filterPriceRange', async () => {
    await loadPage();
    expect(getEl('#filterPriceRange').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on filterComfortLevel', async () => {
    await loadPage();
    expect(getEl('#filterComfortLevel').accessibility.ariaLabel).toBe('Filter by comfort level');
  });

  it('populates comfort level options', async () => {
    await loadPage();
    const opts = getEl('#filterComfortLevel').options;
    expect(opts.length).toBe(4);
    expect(opts[0].label).toBe('Any Comfort');
  });

  it('sets ARIA labels on dimension range inputs', async () => {
    await loadPage();
    expect(getEl('#filterWidthMin').accessibility.ariaLabel).toBe('Minimum width in inches');
    expect(getEl('#filterWidthMax').accessibility.ariaLabel).toBe('Maximum width in inches');
    expect(getEl('#filterDepthMin').accessibility.ariaLabel).toBe('Minimum depth in inches');
    expect(getEl('#filterDepthMax').accessibility.ariaLabel).toBe('Maximum depth in inches');
  });

  it('sets placeholder on width/depth inputs from facet data', async () => {
    await loadPage();
    expect(getEl('#filterWidthMin').placeholder).toBe('30"');
    expect(getEl('#filterWidthMax').placeholder).toBe('80"');
    expect(getEl('#filterDepthMin').placeholder).toBe('20"');
    expect(getEl('#filterDepthMax').placeholder).toBe('40"');
  });

  it('registers onChange on dimension inputs', async () => {
    await loadPage();
    expect(getEl('#filterWidthMin').onChange).toHaveBeenCalled();
    expect(getEl('#filterWidthMax').onChange).toHaveBeenCalled();
    expect(getEl('#filterDepthMin').onChange).toHaveBeenCalled();
    expect(getEl('#filterDepthMax').onChange).toHaveBeenCalled();
  });

  it('sets filter result count text', async () => {
    await loadPage();
    expect(getEl('#filterResultCount').text).toBe('42 products');
  });

  it('registers makeClickable on clearAllFilters', async () => {
    await loadPage();
    expect(getEl('#clearAllFilters').accessibility.ariaLabel).toBe('Clear all filters');
  });

  it('registers makeClickable on clearAllFiltersChip', async () => {
    await loadPage();
    expect(getEl('#clearAllFiltersChip').accessibility.ariaLabel).toBe('Clear all active filters');
  });
});

// ── Flash Sale Banner Tests ─────────────────────────────────────────

describe('Category Page — flash sale banner hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses flash sale banner when no deals', async () => {
    await loadPage();
    expect(getEl('#flashSaleBanner').collapse).toHaveBeenCalled();
  });

  it('calls initFlashSaleBanner when deals exist', async () => {
    vi.doMock('backend/promotions.web', () => ({
      getFlashSales: vi.fn(() => Promise.resolve([{ _id: 'd1', name: 'Summer Sale', endsAt: new Date() }])),
    }));

    await loadPage();
    const { initFlashSaleBanner } = await import('public/flashSaleHelpers');
    expect(initFlashSaleBanner).toHaveBeenCalled();
  });
});

// ── Integration / Lifecycle Tests ───────────────────────────────────

describe('Category Page — lifecycle and integration hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('calls resetRatingsCache on page load', async () => {
    await loadPage();
    const { _resetCache } = await import('public/StarRatingCard');
    expect(_resetCache).toHaveBeenCalled();
  });

  it('calls initBackToTop with $w', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith(expect.anything());
  });

  it('calls prioritizeSections with critical and deferred sections', async () => {
    await loadPage();
    const { prioritizeSections } = await import('public/performanceHelpers.js');
    expect(prioritizeSections).toHaveBeenCalled();
    const sections = prioritizeSections.mock.calls[0][0];
    const criticalNames = sections.filter(s => s.critical).map(s => s.name);
    expect(criticalNames).toContain('categoryHero');
    expect(criticalNames).toContain('productGrid');
    expect(criticalNames).toContain('sortControls');
  });

  it('tracks page_view event', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'category' }));
  });

  it('calls initCategorySocialProof', async () => {
    await loadPage();
    const { initCategorySocialProof } = await import('public/socialProofToast');
    expect(initCategorySocialProof).toHaveBeenCalledWith(expect.anything(), 'futon-frames');
  });

  it('registers onViewportChange callback', async () => {
    await loadPage();
    const { onViewportChange } = await import('public/mobileHelpers');
    expect(onViewportChange).toHaveBeenCalled();
  });
});
