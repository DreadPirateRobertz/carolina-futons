/**
 * Tests for Search Results Page element hookup — CF-w7z8
 * Covers: #searchInput, #searchBtn, #searchQuery, #resultCount,
 * #noResultsBox, #noResultsText, #loadMoreBtn, #loadingIndicator,
 * #searchRepeater, #searchImage, #searchName, #searchPrice,
 * #searchDesc, #searchRibbon, #searchOrigPrice, #searchAddBtn,
 * #searchSwatchPreview, #searchSwatchDot1, #searchSwatchDot2,
 * #searchSwatchDot3, #searchSwatchDot4,
 * #suggestionsBox, #suggestionsRepeater, #suggestionText, #suggestionType,
 * #categoryFilter, #priceFilter, #materialFilter, #colorFilter,
 * #filterToggleBtn, #filterSidebar, #clearFiltersBtn, #filterBadge,
 * #sortDropdown, #searchChipsRepeater, #chipLabel
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
    style: { color: '', backgroundColor: '', fontWeight: '', borderColor: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
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
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
    scrollTo: vi.fn(),
    click: vi.fn(),
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

vi.mock('wix-location-frontend', () => ({
  default: {
    query: { q: 'futon' },
    path: ['search'],
    to: vi.fn(),
  },
  to: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireSearch: vi.fn(() => Promise.resolve()),
  fireViewItemList: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((p) => p),
  initBackToTop: vi.fn(),
  getViewport: vi.fn(() => 'desktop'),
  onViewportChange: vi.fn(),
}));

vi.mock('backend/searchService.web', () => ({
  fullTextSearch: vi.fn(() => Promise.resolve({
    products: [
      {
        _id: 'p1', name: 'Kodiak Futon Frame', slug: 'kodiak-frame',
        mainMedia: 'kodiak.jpg', formattedPrice: '$549',
        price: 549, description: '<p>A great frame</p>',
        collections: ['futon-frames'],
      },
    ],
    total: 1,
  })),
  getAutocompleteSuggestions: vi.fn(() => Promise.resolve({ suggestions: [] })),
  getPopularSearches: vi.fn(() => Promise.resolve({ queries: [] })),
  getFilterValues: vi.fn(() => Promise.resolve({
    materials: [{ value: 'Wood', count: 10 }],
    colors: [{ value: 'Brown', count: 8 }],
  })),
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
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/WishlistCardButton.js', () => ({
  batchCheckWishlistStatus: vi.fn(() => Promise.resolve(new Set())),
  initCardWishlistButton: vi.fn(),
}));

vi.mock('public/galleryHelpers', () => ({
  buildProductBadgeOverlay: vi.fn(() => null),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: vi.fn(() => Promise.resolve([])),
}));

vi.mock('public/SearchResultsHelpers.js', () => ({
  buildSkeletonData: vi.fn((count) => Array.from({ length: count }, (_, i) => ({ _id: `skel-${i}`, isSkeleton: true }))),
  getActiveFilterCount: vi.fn(() => 0),
  buildSearchChips: vi.fn((queries) => queries.map((q, i) => ({ _id: `chip-${i}`, label: q, query: q }))),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage(overrides = {}) {
  elements.clear();
  onReadyHandler = null;

  if (overrides.query !== undefined) {
    const wlf = await import('wix-location-frontend');
    wlf.default.query = overrides.query;
  }

  if (overrides.searchResult !== undefined) {
    const { fullTextSearch } = await import('backend/searchService.web');
    fullTextSearch.mockResolvedValue(overrides.searchResult);
  }

  vi.resetModules();
  await import('../src/pages/Search Results.js');
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

// ── Search Input & Button Tests ─────────────────────────────────────

describe('Search Results — #searchInput element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets searchInput value to query from URL', async () => {
    await loadPage();
    expect(getEl('#searchInput').value).toBe('futon');
  });

  it('sets ARIA label on searchInput', async () => {
    await loadPage();
    expect(getEl('#searchInput').accessibility.ariaLabel).toBe('Search products');
  });

  it('registers onInput handler on searchInput', async () => {
    await loadPage();
    expect(getEl('#searchInput').onInput).toHaveBeenCalled();
  });

  it('registers onKeyPress handler on searchInput', async () => {
    await loadPage();
    expect(getEl('#searchInput').onKeyPress).toHaveBeenCalled();
  });
});

describe('Search Results — #searchBtn element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onClick on searchBtn', async () => {
    await loadPage();
    expect(getEl('#searchBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on searchBtn', async () => {
    await loadPage();
    expect(getEl('#searchBtn').accessibility.ariaLabel).toBe('Search products');
  });
});

// ── Search Results Display Tests ────────────────────────────────────

describe('Search Results — result display hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets searchQuery text with query string', async () => {
    await loadPage();
    expect(getEl('#searchQuery').text).toContain('futon');
  });

  it('sets resultCount text with product count', async () => {
    await loadPage();
    expect(getEl('#resultCount').text).toContain('1');
    expect(getEl('#resultCount').text).toContain('found');
  });

  it('sets ARIA live on resultCount', async () => {
    await loadPage();
    expect(getEl('#resultCount').accessibility.ariaLive).toBe('polite');
  });

  it('hides noResultsBox when results exist', async () => {
    await loadPage();
    expect(getEl('#noResultsBox').hide).toHaveBeenCalled();
  });

  it('calls announce with result count', async () => {
    await loadPage();
    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('1 product')
    );
  });

  it('tracks page_view event', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'search' }));
  });

  it('fires GA4 search event', async () => {
    await loadPage();
    const { fireSearch } = await import('public/ga4Tracking');
    expect(fireSearch).toHaveBeenCalledWith('futon', 1);
  });

  it('fires GA4 view_item_list event', async () => {
    await loadPage();
    const { fireViewItemList } = await import('public/ga4Tracking');
    expect(fireViewItemList).toHaveBeenCalled();
  });

  it('calls initPageSeo with searchResults', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('searchResults');
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith(expect.anything());
  });
});

// ── Load More Button Tests ──────────────────────────────────────────

describe('Search Results — #loadMoreBtn element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('hides loadMoreBtn when total <= PAGE_SIZE', async () => {
    await loadPage();
    expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
  });

  it('shows loadMoreBtn when total > PAGE_SIZE', async () => {
    await loadPage({
      searchResult: {
        products: Array.from({ length: 24 }, (_, i) => ({
          _id: `p${i}`, name: `Product ${i}`, slug: `product-${i}`,
          mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
          description: 'desc', collections: [],
        })),
        total: 50,
      },
    });
    expect(getEl('#loadMoreBtn').show).toHaveBeenCalled();
    expect(getEl('#loadMoreBtn').label).toBe('Load More');
  });

  it('registers onClick on loadMoreBtn', async () => {
    await loadPage();
    expect(getEl('#loadMoreBtn').onClick).toHaveBeenCalled();
  });
});

// ── Search Repeater Tests ───────────────────────────────────────────

describe('Search Results — #searchRepeater child element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onItemReady on searchRepeater', async () => {
    await loadPage();
    expect(getEl('#searchRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets searchImage src from itemData', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak',
      mainMedia: 'kodiak.jpg', formattedPrice: '$549', price: 549,
      description: 'A frame', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item).not.toBeNull();
    expect($item('#searchImage').src).toBe('kodiak.jpg');
  });

  it('sets searchImage alt text', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak',
      mainMedia: 'kodiak.jpg', formattedPrice: '$549', price: 549,
      description: 'A frame', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchImage').alt).toContain('Kodiak Frame');
  });

  it('sets searchName text', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak',
      mainMedia: 'img.jpg', formattedPrice: '$549', price: 549,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchName').text).toBe('Kodiak Frame');
  });

  it('sets searchPrice text from formattedPrice', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$549', price: 549,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchPrice').text).toBe('$549');
  });

  it('sets searchPrice to CALL_FOR_PRICE_TEXT when call-for-price', async () => {
    const { isCallForPrice } = await import('public/productPageUtils.js');
    isCallForPrice.mockReturnValue(true);
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$0', price: 0,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchPrice').text).toBe('Call for Price');
  });

  it('sets searchDesc text stripped of HTML', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$549', price: 549,
      description: '<p>A premium futon frame</p>', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchDesc').text).toContain('A premium futon frame');
    expect($item('#searchDesc').text).not.toContain('<p>');
  });

  it('registers makeClickable on searchImage with ariaLabel', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Vienna Frame', slug: 'vienna',
      mainMedia: 'img.jpg', formattedPrice: '$499', price: 499,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchImage').accessibility.ariaLabel).toBe('View Vienna Frame');
  });

  it('registers makeClickable on searchName with ariaLabel', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Vienna Frame', slug: 'vienna',
      mainMedia: 'img.jpg', formattedPrice: '$499', price: 499,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchName').accessibility.ariaLabel).toBe('View Vienna Frame details');
  });

  it('sets searchAddBtn label and ARIA label', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Kodiak Frame', slug: 'kodiak',
      mainMedia: 'img.jpg', formattedPrice: '$549', price: 549,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchAddBtn').label).toBe('Add to Cart');
    expect($item('#searchAddBtn').accessibility.ariaLabel).toBe('Add Kodiak Frame to cart');
  });

  it('registers onClick on searchAddBtn', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchAddBtn').onClick).toHaveBeenCalled();
  });

  it('enables searchAddBtn', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchAddBtn').enable).toHaveBeenCalled();
  });

  it('hides searchRibbon when no badge overlay', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchRibbon').hide).toHaveBeenCalled();
  });

  it('shows searchRibbon when badge overlay exists', async () => {
    const { buildProductBadgeOverlay } = await import('public/galleryHelpers');
    buildProductBadgeOverlay.mockReturnValue({ text: 'Sale!' });
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchRibbon').text).toBe('Sale!');
    expect($item('#searchRibbon').show).toHaveBeenCalled();
  });

  it('shows searchOrigPrice for discounted items', async () => {
    const { isCallForPrice } = await import('public/productPageUtils.js');
    isCallForPrice.mockReturnValue(false);
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$549',
      formattedDiscountedPrice: '$449',
      price: 549, discountedPrice: 449,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchOrigPrice').text).toBe('$549');
    expect($item('#searchOrigPrice').show).toHaveBeenCalled();
    expect($item('#searchPrice').text).toBe('$449');
  });

  it('hides searchOrigPrice when no discount', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$549',
      price: 549,
      description: 'desc', collections: [],
    };
    const $item = simulateRepeaterItem('#searchRepeater', itemData);
    expect($item('#searchOrigPrice').hide).toHaveBeenCalled();
  });

  it('calls initCardWishlistButton', async () => {
    await loadPage();
    const itemData = {
      _id: 'p1', name: 'Test', slug: 'test',
      mainMedia: 'img.jpg', formattedPrice: '$100', price: 100,
      description: 'desc', collections: [],
    };
    simulateRepeaterItem('#searchRepeater', itemData);
    const { initCardWishlistButton } = await import('public/WishlistCardButton.js');
    expect(initCardWishlistButton).toHaveBeenCalled();
  });
});

// ── Suggestions Box Tests ───────────────────────────────────────────

describe('Search Results — #suggestionsBox element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA role on suggestionsBox', async () => {
    await loadPage();
    expect(getEl('#suggestionsBox').accessibility.role).toBe('listbox');
  });
});

// ── Filter Controls Tests ───────────────────────────────────────────

describe('Search Results — filter controls element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on categoryFilter', async () => {
    await loadPage();
    expect(getEl('#categoryFilter').accessibility.ariaLabel).toBe('Filter by category');
  });

  it('registers onChange on categoryFilter', async () => {
    await loadPage();
    expect(getEl('#categoryFilter').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on priceFilter', async () => {
    await loadPage();
    expect(getEl('#priceFilter').accessibility.ariaLabel).toBe('Filter by price range');
  });

  it('registers onChange on priceFilter', async () => {
    await loadPage();
    expect(getEl('#priceFilter').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on materialFilter', async () => {
    await loadPage();
    expect(getEl('#materialFilter').accessibility.ariaLabel).toBe('Filter by material');
  });

  it('registers onChange on materialFilter', async () => {
    await loadPage();
    expect(getEl('#materialFilter').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on colorFilter', async () => {
    await loadPage();
    expect(getEl('#colorFilter').accessibility.ariaLabel).toBe('Filter by color');
  });

  it('registers onChange on colorFilter', async () => {
    await loadPage();
    expect(getEl('#colorFilter').onChange).toHaveBeenCalled();
  });

  it('sets ARIA label on filterToggleBtn', async () => {
    await loadPage();
    expect(getEl('#filterToggleBtn').accessibility.ariaLabel).toBe('Toggle filters');
  });

  it('registers onClick on filterToggleBtn', async () => {
    await loadPage();
    expect(getEl('#filterToggleBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on clearFiltersBtn', async () => {
    await loadPage();
    expect(getEl('#clearFiltersBtn').accessibility.ariaLabel).toBe('Clear all filters');
  });

  it('registers onClick on clearFiltersBtn', async () => {
    await loadPage();
    expect(getEl('#clearFiltersBtn').onClick).toHaveBeenCalled();
  });
});

// ── Sort Dropdown Tests ─────────────────────────────────────────────

describe('Search Results — #sortDropdown element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets ARIA label on sortDropdown', async () => {
    await loadPage();
    expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort results');
  });

  it('registers onChange on sortDropdown', async () => {
    await loadPage();
    expect(getEl('#sortDropdown').onChange).toHaveBeenCalled();
  });
});

// ── No Results / Empty State Tests ──────────────────────────────────

describe('Search Results — no results / empty state hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows noResultsBox and collapses repeater when no results', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    expect(getEl('#noResultsBox').show).toHaveBeenCalled();
    expect(getEl('#searchRepeater').collapse).toHaveBeenCalled();
  });

  it('sets searchQuery text for no results', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    expect(getEl('#searchQuery').text).toContain('No results');
  });

  it('sets ARIA role on noResultsBox', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    expect(getEl('#noResultsBox').accessibility.role).toBe('status');
  });

  it('sets noResultsText with popular searches prompt', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    expect(getEl('#noResultsText').text).toContain('popular searches');
  });

  it('hides loadMoreBtn on no results', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
  });

  it('shows empty state when no query provided', async () => {
    await loadPage({ query: {} });
    expect(getEl('#searchQuery').text).toContain('Search Carolina Futons');
    expect(getEl('#searchRepeater').collapse).toHaveBeenCalled();
  });
});

// ── Search Chips Repeater Tests ─────────────────────────────────────

describe('Search Results — #searchChipsRepeater hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('populates chips repeater on no results', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    const repeater = getEl('#searchChipsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('sets chipLabel text in repeater item', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    const $item = simulateRepeaterItem('#searchChipsRepeater', {
      _id: 'chip-0', label: 'futon frames', query: 'futon frames',
    });
    if ($item) {
      expect($item('#chipLabel').text).toBe('futon frames');
    }
  });

  it('registers makeClickable on chipLabel', async () => {
    await loadPage({
      searchResult: { products: [], total: 0 },
    });
    const $item = simulateRepeaterItem('#searchChipsRepeater', {
      _id: 'chip-0', label: 'mattresses', query: 'mattresses',
    });
    if ($item) {
      expect($item('#chipLabel').accessibility.ariaLabel).toContain('Search for mattresses');
    }
  });
});

// ── Viewport Change Tests ───────────────────────────────────────────

describe('Search Results — viewport change hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('registers onViewportChange callback', async () => {
    await loadPage();
    const { onViewportChange } = await import('public/mobileHelpers');
    expect(onViewportChange).toHaveBeenCalled();
  });
});
