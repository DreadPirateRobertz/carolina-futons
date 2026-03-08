/**
 * Tests for Search Results page — CF-p09
 *
 * Comprehensive integration tests for autocomplete, filters, sorting,
 * popular search chips, loading states, and accessibility.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  const el = {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    hidden: false,
    options: [],
    data: [],
    style: { backgroundColor: '' },
    accessibility: {},
    show: vi.fn(() => { el.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(() => { el.hidden = true; return Promise.resolve(); }),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
  };
  return el;
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

// ── Mock wix-location-frontend ──────────────────────────────────────

vi.mock('wix-location-frontend', () => ({
  default: { query: { q: '' }, to: vi.fn() },
  to: vi.fn(),
}));

// ── Mock backend services ───────────────────────────────────────────

const mockFullTextSearch = vi.fn().mockResolvedValue({
  products: [],
  total: 0,
  query: '',
  facets: {},
});
const mockGetAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [] });
const mockGetPopularSearches = vi.fn().mockResolvedValue({ queries: [] });
const mockGetFilterValues = vi.fn().mockResolvedValue({
  materials: [],
  colors: [],
  priceRanges: [],
  features: [],
});

vi.mock('backend/searchService.web', () => ({
  fullTextSearch: mockFullTextSearch,
  getAutocompleteSuggestions: mockGetAutocompleteSuggestions,
  getPopularSearches: mockGetPopularSearches,
  getFilterValues: mockGetFilterValues,
}));

// ── Mock swatch service ─────────────────────────────────────────────

const mockGetSwatchPreviewColors = vi.fn().mockResolvedValue([]);
vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: mockGetSwatchPreviewColors,
}));

// ── Mock engagement tracker ─────────────────────────────────────────

const mockTrackEvent = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: mockTrackEvent,
}));

// ── Mock GA4 tracking ───────────────────────────────────────────────

vi.mock('public/ga4Tracking', () => ({
  fireSearch: vi.fn().mockResolvedValue(undefined),
  fireViewItemList: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock cart service ───────────────────────────────────────────────

const mockAddToCart = vi.fn().mockResolvedValue({});
vi.mock('public/cartService', () => ({
  addToCart: mockAddToCart,
}));

// ── Mock mobile helpers ─────────────────────────────────────────────

const mockInitBackToTop = vi.fn();
vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((data) => data),
  initBackToTop: mockInitBackToTop,
  getViewport: vi.fn(() => 'desktop'),
  onViewportChange: vi.fn(() => () => {}),
}));

// ── Mock a11y helpers ───────────────────────────────────────────────

const mockAnnounce = vi.fn();
const mockMakeClickable = vi.fn();
vi.mock('public/a11yHelpers.js', () => ({
  announce: mockAnnounce,
  makeClickable: mockMakeClickable,
}));

// ── Mock WishlistCardButton ─────────────────────────────────────────

const mockBatchCheck = vi.fn().mockResolvedValue(new Set());
const mockInitCard = vi.fn();
vi.mock('public/WishlistCardButton.js', () => ({
  batchCheckWishlistStatus: mockBatchCheck,
  initCardWishlistButton: mockInitCard,
}));

// ── Mock galleryHelpers ─────────────────────────────────────────────

const mockBuildProductBadgeOverlay = vi.fn(() => null);
vi.mock('public/galleryHelpers', () => ({
  buildProductBadgeOverlay: mockBuildProductBadgeOverlay,
}));

// ── Mock SearchResultsHelpers ───────────────────────────────────────

vi.mock('public/SearchResultsHelpers.js', () => ({
  buildSkeletonData: vi.fn((count) =>
    Array.from({ length: count }, (_, i) => ({
      _id: `skeleton-${i}`,
      isSkeleton: true,
      name: '',
      formattedPrice: '',
      mainMedia: '',
    }))
  ),
  getActiveFilterCount: vi.fn((filters) => {
    if (!filters) return 0;
    return ['category', 'priceRange', 'material', 'color'].filter(
      key => filters[key] && filters[key] !== ''
    ).length;
  }),
  buildSearchChips: vi.fn((queries, max = 8) => {
    if (!queries || !Array.isArray(queries)) return [];
    return queries.slice(0, max).map((q, i) => ({
      _id: `chip-${i}`,
      label: q,
      query: q,
    }));
  }),
}));

// ── Test data ───────────────────────────────────────────────────────

const sampleProducts = [
  {
    _id: 'prod-1',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon',
    price: 599,
    formattedPrice: '$599.00',
    discountedPrice: null,
    formattedDiscountedPrice: null,
    mainMedia: 'https://img.example.com/eureka.jpg',
    ribbon: 'Sale',
    collections: ['futon-frames'],
    description: '<p>A classic futon frame</p>',
  },
  {
    _id: 'prod-2',
    name: 'Phoenix Mattress',
    slug: 'phoenix-mattress',
    price: 399,
    formattedPrice: '$399.00',
    discountedPrice: 349,
    formattedDiscountedPrice: '$349.00',
    mainMedia: 'https://img.example.com/phoenix.jpg',
    ribbon: null,
    collections: ['mattresses'],
    description: '<p>Premium mattress</p>',
  },
];

// Helper: run onReady and trigger a search, returning captured handlers
async function setupAndSearch(query = 'futon') {
  await onReadyHandler();
  // Reset module-level filter state via clear handler
  const clearHandler = getEl('#clearFiltersBtn').onClick.mock.calls[0]?.[0];
  if (clearHandler) clearHandler();
  // Now do the search
  const inputEl = getEl('#searchInput');
  inputEl.value = query;
  const btnHandler = getEl('#searchBtn').onClick.mock.calls[0][0];
  await btnHandler();
  return {
    getFilterHandler: (id) => getEl(id).onChange.mock.calls[0]?.[0],
    getSortHandler: () => getEl('#sortDropdown').onChange.mock.calls[0]?.[0],
    getClearHandler: () => getEl('#clearFiltersBtn').onClick.mock.calls[0]?.[0],
    // onItemReady is called twice: [0]=skeleton, last=render
    getItemReady: () => {
      const calls = getEl('#searchRepeater').onItemReady.mock.calls;
      return calls[calls.length - 1]?.[0];
    },
    getLoadMoreHandler: () => getEl('#loadMoreBtn').onClick.mock.calls[0]?.[0],
  };
}

// ── Import Page (triggers $w.onReady registration) ──────────────────

beforeAll(async () => {
  await import('../../src/pages/Search Results.js');
});

beforeEach(() => {
  elements.clear();
  mockFullTextSearch.mockReset();
  mockFullTextSearch.mockResolvedValue({
    products: sampleProducts,
    total: 2,
    query: 'futon',
    facets: {},
  });
  mockGetAutocompleteSuggestions.mockReset();
  mockGetAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
  mockGetPopularSearches.mockReset();
  mockGetPopularSearches.mockResolvedValue({ queries: [] });
  mockGetFilterValues.mockReset();
  mockGetFilterValues.mockResolvedValue({
    materials: [
      { value: 'Hardwood', count: 5 },
      { value: 'Pine', count: 3 },
    ],
    colors: [
      { value: 'Natural', count: 4 },
      { value: 'Espresso', count: 2 },
    ],
  });
  mockTrackEvent.mockReset();
  mockAnnounce.mockReset();
  mockMakeClickable.mockReset();
  mockBatchCheck.mockReset();
  mockBatchCheck.mockResolvedValue(new Set());
  mockInitCard.mockReset();
  mockBuildProductBadgeOverlay.mockReset();
  mockBuildProductBadgeOverlay.mockReturnValue(null);
  mockAddToCart.mockReset();
  mockAddToCart.mockResolvedValue({});
  mockGetSwatchPreviewColors.mockReset();
  mockGetSwatchPreviewColors.mockResolvedValue([]);
  mockInitBackToTop.mockReset();
});

// ── Autocomplete ────────────────────────────────────────────────────

describe('Search Results — Autocomplete', () => {
  it('registers onInput handler on #searchInput', async () => {
    await onReadyHandler();
    expect(getEl('#searchInput').onInput).toHaveBeenCalledOnce();
  });

  it('registers onKeyPress handler on #searchInput for Enter key', async () => {
    await onReadyHandler();
    expect(getEl('#searchInput').onKeyPress).toHaveBeenCalledOnce();
  });

  it('registers onClick handler on #searchBtn', async () => {
    await onReadyHandler();
    expect(getEl('#searchBtn').onClick).toHaveBeenCalledOnce();
  });

  it('sets ARIA label on #searchInput', async () => {
    await onReadyHandler();
    expect(getEl('#searchInput').accessibility.ariaLabel).toBe('Search products');
  });

  it('sets ARIA role listbox on #suggestionsBox', async () => {
    await onReadyHandler();
    expect(getEl('#suggestionsBox').accessibility.role).toBe('listbox');
  });

  it('sets ARIA label on #searchBtn', async () => {
    await onReadyHandler();
    expect(getEl('#searchBtn').accessibility.ariaLabel).toBe('Search products');
  });

  it('searchBtn onClick triggers search with input value', async () => {
    await onReadyHandler();
    getEl('#searchInput').value = 'mattress';
    const btnHandler = getEl('#searchBtn').onClick.mock.calls[0][0];
    await btnHandler();
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'mattress' })
    );
  });

  it('searchBtn onClick does nothing for whitespace-only input', async () => {
    await onReadyHandler();
    const callsBefore = mockFullTextSearch.mock.calls.length;
    getEl('#searchInput').value = '   ';
    const btnHandler = getEl('#searchBtn').onClick.mock.calls[0][0];
    await btnHandler();
    // Should NOT have made any additional search calls
    expect(mockFullTextSearch.mock.calls.length).toBe(callsBefore);
  });

  it('Enter key triggers search with trimmed value', async () => {
    await onReadyHandler();
    getEl('#searchInput').value = '  futon frames  ';
    const keyHandler = getEl('#searchInput').onKeyPress.mock.calls[0][0];
    await keyHandler({ key: 'Enter' });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'futon frames' })
    );
  });

  it('Enter key hides suggestions box', async () => {
    await onReadyHandler();
    getEl('#searchInput').value = 'futon';
    const keyHandler = getEl('#searchInput').onKeyPress.mock.calls[0][0];
    await keyHandler({ key: 'Enter' });
    expect(getEl('#suggestionsBox').hide).toHaveBeenCalled();
  });

  it('hides suggestions for input shorter than 2 chars', async () => {
    await onReadyHandler();
    const inputHandler = getEl('#searchInput').onInput.mock.calls[0][0];
    await inputHandler({ target: { value: 'f' } });
    expect(getEl('#suggestionsBox').hide).toHaveBeenCalled();
  });
});

// ── Suggestions Display ─────────────────────────────────────────────

describe('Search Results — Suggestions Display', () => {
  it('fetches autocomplete suggestions after debounce for 2+ char input', async () => {
    mockGetAutocompleteSuggestions.mockResolvedValue({
      suggestions: [
        { text: 'futon frames', type: 'category', slug: 'futon-frames' },
      ],
    });
    await onReadyHandler();
    const inputHandler = getEl('#searchInput').onInput.mock.calls[0][0];
    await inputHandler({ target: { value: 'futo' } });

    // Wait for debounce
    await new Promise(r => setTimeout(r, 300));

    expect(mockGetAutocompleteSuggestions).toHaveBeenCalledWith('futo', 6);
  });

  it('shows suggestions box when suggestions returned', async () => {
    mockGetAutocompleteSuggestions.mockResolvedValue({
      suggestions: [
        { text: 'futon frames', type: 'category', slug: 'futon-frames' },
      ],
    });
    await onReadyHandler();
    const inputHandler = getEl('#searchInput').onInput.mock.calls[0][0];
    await inputHandler({ target: { value: 'futo' } });

    await new Promise(r => setTimeout(r, 300));

    expect(getEl('#suggestionsBox').show).toHaveBeenCalled();
    expect(getEl('#suggestionsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('hides suggestions when autocomplete API fails', async () => {
    mockGetAutocompleteSuggestions.mockRejectedValue(new Error('API error'));
    await onReadyHandler();
    const inputHandler = getEl('#searchInput').onInput.mock.calls[0][0];
    await inputHandler({ target: { value: 'futo' } });

    await new Promise(r => setTimeout(r, 300));

    expect(getEl('#suggestionsBox').hide).toHaveBeenCalled();
  });
});

// ── Filter Panel ────────────────────────────────────────────────────

describe('Search Results — Filter Panel', () => {
  it('registers onChange on all filter dropdowns', async () => {
    await onReadyHandler();
    expect(getEl('#categoryFilter').onChange).toHaveBeenCalledOnce();
    expect(getEl('#priceFilter').onChange).toHaveBeenCalledOnce();
    expect(getEl('#materialFilter').onChange).toHaveBeenCalledOnce();
    expect(getEl('#colorFilter').onChange).toHaveBeenCalledOnce();
  });

  it('sets ARIA labels on all filter dropdowns', async () => {
    await onReadyHandler();
    expect(getEl('#categoryFilter').accessibility.ariaLabel).toBe('Filter by category');
    expect(getEl('#priceFilter').accessibility.ariaLabel).toBe('Filter by price range');
    expect(getEl('#materialFilter').accessibility.ariaLabel).toBe('Filter by material');
    expect(getEl('#colorFilter').accessibility.ariaLabel).toBe('Filter by color');
  });

  it('categoryFilter onChange triggers search with category', async () => {
    const { getFilterHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'futon', facets: {} });

    const handler = getFilterHandler('#categoryFilter');
    await handler({ target: { value: 'futon-frames' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'futon-frames' })
    );
  });

  it('priceFilter onChange triggers search with priceRange', async () => {
    const { getFilterHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'futon', facets: {} });

    const handler = getFilterHandler('#priceFilter');
    await handler({ target: { value: '300-500' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ priceRange: '300-500' })
    );
  });

  it('materialFilter onChange triggers search with material', async () => {
    const { getFilterHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'futon', facets: {} });

    const handler = getFilterHandler('#materialFilter');
    await handler({ target: { value: 'Hardwood' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ material: 'Hardwood' })
    );
  });

  it('colorFilter onChange triggers search with color', async () => {
    const { getFilterHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'futon', facets: {} });

    const handler = getFilterHandler('#colorFilter');
    await handler({ target: { value: 'Espresso' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'Espresso' })
    );
  });

  it('loads facet data into material filter options', async () => {
    await onReadyHandler();
    await new Promise(r => setTimeout(r, 50));
    expect(getEl('#materialFilter').options).toEqual([
      { label: 'All Materials', value: '' },
      { label: 'Hardwood (5)', value: 'Hardwood' },
      { label: 'Pine (3)', value: 'Pine' },
    ]);
  });

  it('loads facet data into color filter options', async () => {
    await onReadyHandler();
    await new Promise(r => setTimeout(r, 50));
    expect(getEl('#colorFilter').options).toEqual([
      { label: 'All Colors', value: '' },
      { label: 'Natural (4)', value: 'Natural' },
      { label: 'Espresso (2)', value: 'Espresso' },
    ]);
  });

  it('does not crash when getFilterValues returns null facets', async () => {
    mockGetFilterValues.mockResolvedValue(null);
    await onReadyHandler();
    await new Promise(r => setTimeout(r, 50));
    // No error thrown, options remain empty
    expect(getEl('#materialFilter').options).toEqual([]);
  });
});

// ── Filter Badge ────────────────────────────────────────────────────

describe('Search Results — Filter Badge', () => {
  it('shows badge with count when filters active', async () => {
    const { getFilterHandler } = await setupAndSearch('futon');
    const handler = getFilterHandler('#categoryFilter');
    await handler({ target: { value: 'futon-frames' } });
    expect(getEl('#filterBadge').show).toHaveBeenCalled();
    expect(getEl('#filterBadge').text).toBe('1');
  });

  it('hides badge when no filters active', async () => {
    const { getClearHandler } = await setupAndSearch('futon');
    // Clear filters resets badge
    const clearHandler = getClearHandler();
    await clearHandler();
    expect(getEl('#filterBadge').hide).toHaveBeenCalled();
  });
});

// ── Mobile Filter Sidebar ───────────────────────────────────────────

describe('Search Results — Mobile Filter Sidebar', () => {
  it('registers onClick on #filterToggleBtn', async () => {
    await onReadyHandler();
    expect(getEl('#filterToggleBtn').onClick).toHaveBeenCalledOnce();
  });

  it('sets ARIA label on #filterToggleBtn', async () => {
    await onReadyHandler();
    expect(getEl('#filterToggleBtn').accessibility.ariaLabel).toBe('Toggle filters');
  });

  it('toggleBtn shows sidebar when hidden', async () => {
    await onReadyHandler();
    const sidebar = getEl('#filterSidebar');
    sidebar.hidden = true;
    const toggleHandler = getEl('#filterToggleBtn').onClick.mock.calls[0][0];
    toggleHandler();
    expect(sidebar.show).toHaveBeenCalled();
  });

  it('toggleBtn hides sidebar when visible', async () => {
    await onReadyHandler();
    const sidebar = getEl('#filterSidebar');
    sidebar.hidden = false;
    const toggleHandler = getEl('#filterToggleBtn').onClick.mock.calls[0][0];
    toggleHandler();
    expect(sidebar.hide).toHaveBeenCalled();
  });
});

// ── Clear Filters ───────────────────────────────────────────────────

describe('Search Results — Clear Filters', () => {
  it('registers onClick on #clearFiltersBtn', async () => {
    await onReadyHandler();
    expect(getEl('#clearFiltersBtn').onClick).toHaveBeenCalledOnce();
  });

  it('sets ARIA label on #clearFiltersBtn', async () => {
    await onReadyHandler();
    expect(getEl('#clearFiltersBtn').accessibility.ariaLabel).toBe('Clear all filters');
  });

  it('clears all filter and sort values on click', async () => {
    const { getClearHandler } = await setupAndSearch('futon');
    // Set some filter values
    getEl('#categoryFilter').value = 'futon-frames';
    getEl('#priceFilter').value = '300-500';
    getEl('#materialFilter').value = 'Hardwood';
    getEl('#colorFilter').value = 'Natural';

    const clearHandler = getClearHandler();
    await clearHandler();

    expect(getEl('#categoryFilter').value).toBe('');
    expect(getEl('#priceFilter').value).toBe('');
    expect(getEl('#materialFilter').value).toBe('');
    expect(getEl('#colorFilter').value).toBe('');
    expect(getEl('#sortDropdown').value).toBe('relevance');
  });

  it('triggers new search with cleared params after clear', async () => {
    const { getClearHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'futon', facets: {} });

    const clearHandler = getClearHandler();
    await clearHandler();

    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        category: '',
        priceRange: '',
        material: '',
        color: '',
        sortBy: 'relevance',
      })
    );
  });
});

// ── Sorting ─────────────────────────────────────────────────────────

describe('Search Results — Sorting', () => {
  it('registers onChange on #sortDropdown', async () => {
    await onReadyHandler();
    expect(getEl('#sortDropdown').onChange).toHaveBeenCalledOnce();
  });

  it('sets ARIA label on #sortDropdown', async () => {
    await onReadyHandler();
    expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort results');
  });

  it('sortDropdown onChange triggers search with new sort', async () => {
    const { getSortHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: sampleProducts, total: 2, query: 'futon', facets: {} });

    const sortHandler = getSortHandler();
    await sortHandler({ target: { value: 'price-asc' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'price-asc' })
    );
  });

  it('defaults to relevance when empty value selected', async () => {
    const { getSortHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({ products: sampleProducts, total: 2, query: 'futon', facets: {} });

    const sortHandler = getSortHandler();
    await sortHandler({ target: { value: '' } });
    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'relevance' })
    );
  });
});

// ── Search Results Rendering ────────────────────────────────────────

describe('Search Results — Results Rendering', () => {
  it('displays result count text', async () => {
    await setupAndSearch('futon');
    expect(getEl('#resultCount').text).toBe('2 products found');
  });

  it('displays singular text for 1 result', async () => {
    mockFullTextSearch.mockResolvedValue({
      products: [sampleProducts[0]],
      total: 1,
      query: 'eureka',
      facets: {},
    });
    await setupAndSearch('eureka');
    expect(getEl('#resultCount').text).toBe('1 product found');
  });

  it('sets polite aria-live on result count', async () => {
    await setupAndSearch('futon');
    expect(getEl('#resultCount').accessibility.ariaLive).toBe('polite');
  });

  it('announces result count for screen readers', async () => {
    await setupAndSearch('futon');
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('2 products found')
    );
  });

  it('sets query text on #searchQuery', async () => {
    await setupAndSearch('futon');
    expect(getEl('#searchQuery').text).toBe('Results for "futon"');
  });

  it('hides #noResultsBox when results found', async () => {
    await setupAndSearch('futon');
    expect(getEl('#noResultsBox').hide).toHaveBeenCalled();
  });

  it('registers onItemReady on #searchRepeater', async () => {
    await setupAndSearch('futon');
    expect(getEl('#searchRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets repeater data with product items', async () => {
    await setupAndSearch('futon');
    const repeater = getEl('#searchRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('prod-1');
    expect(repeater.data[1]._id).toBe('prod-2');
  });

  it('tracks page_view and search_results events', async () => {
    await setupAndSearch('futon');
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', { page: 'search', query: 'futon' });
    expect(mockTrackEvent).toHaveBeenCalledWith('search_results', { query: 'futon', resultCount: 2 });
  });
});

// ── Repeater Item Rendering ─────────────────────────────────────────

describe('Search Results — Repeater Item Rendering', () => {
  function getLastItemReadyHandler() {
    const calls = getEl('#searchRepeater').onItemReady.mock.calls;
    return calls[calls.length - 1]?.[0];
  }

  function createItemScope(prefix) {
    return (sel) => getEl(`${prefix}-${sel}`);
  }

  it('populates product image, name, price in repeater item', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('pop');
    handler($item, sampleProducts[0]);

    expect(getEl('pop-#searchImage').src).toBe('https://img.example.com/eureka.jpg');
    expect(getEl('pop-#searchImage').alt).toBe('Eureka Futon Frame - Carolina Futons');
    expect(getEl('pop-#searchName').text).toBe('Eureka Futon Frame');
    expect(getEl('pop-#searchPrice').text).toBe('$599.00');
  });

  it('strips HTML from description', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('html');
    handler($item, sampleProducts[0]);

    expect(getEl('html-#searchDesc').text).not.toContain('<p>');
    expect(getEl('html-#searchDesc').text).toContain('A classic futon frame');
  });

  it('shows badge overlay when product has badge', async () => {
    mockBuildProductBadgeOverlay.mockReturnValue({ text: 'Sale' });
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('badge');
    handler($item, sampleProducts[0]);

    expect(getEl('badge-#searchRibbon').text).toBe('Sale');
    expect(getEl('badge-#searchRibbon').show).toHaveBeenCalled();
  });

  it('hides badge overlay when product has no badge', async () => {
    mockBuildProductBadgeOverlay.mockReturnValue(null);
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('nobadge');
    handler($item, sampleProducts[1]);

    expect(getEl('nobadge-#searchRibbon').hide).toHaveBeenCalled();
  });

  it('shows discounted price and original price strikethrough', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('disc');
    handler($item, sampleProducts[1]); // Phoenix has discount

    expect(getEl('disc-#searchOrigPrice').text).toBe('$399.00');
    expect(getEl('disc-#searchOrigPrice').show).toHaveBeenCalled();
    expect(getEl('disc-#searchPrice').text).toBe('$349.00');
  });

  it('hides original price when no discount', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('nodisc');
    handler($item, sampleProducts[0]); // Eureka has no discount

    expect(getEl('nodisc-#searchOrigPrice').hide).toHaveBeenCalled();
  });

  it('makes image and name clickable for navigation', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('click');
    handler($item, sampleProducts[0]);

    expect(mockMakeClickable).toHaveBeenCalledWith(
      getEl('click-#searchImage'),
      expect.any(Function),
      expect.objectContaining({ ariaLabel: 'View Eureka Futon Frame' })
    );
    expect(mockMakeClickable).toHaveBeenCalledWith(
      getEl('click-#searchName'),
      expect.any(Function),
      expect.objectContaining({ ariaLabel: 'View Eureka Futon Frame details' })
    );
  });

  it('initializes wishlist button for each product', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('wish');
    handler($item, sampleProducts[0]);

    expect(mockInitCard).toHaveBeenCalledWith($item, sampleProducts[0], false);
  });

  it('handles empty description gracefully', async () => {
    await setupAndSearch('futon');
    const handler = getLastItemReadyHandler();
    const $item = createItemScope('emptydesc');
    handler($item, { ...sampleProducts[0], description: '' });
    expect(getEl('emptydesc-#searchDesc').text).toBe('');
  });
});

// ── Add to Cart ─────────────────────────────────────────────────────

describe('Search Results — Add to Cart', () => {
  it('sets up add-to-cart button with ARIA label', async () => {
    await setupAndSearch('futon');
    const calls = getEl('#searchRepeater').onItemReady.mock.calls;
    const handler = calls[calls.length - 1][0];
    const $item = (sel) => getEl(`cart-${sel}`);
    handler($item, sampleProducts[0]);

    expect(getEl('cart-#searchAddBtn').accessibility.ariaLabel).toBe('Add Eureka Futon Frame to cart');
    expect(getEl('cart-#searchAddBtn').label).toBe('Add to Cart');
    expect(getEl('cart-#searchAddBtn').onClick).toHaveBeenCalled();
  });

  it('add-to-cart shows Adding... then Added! on success', async () => {
    vi.useFakeTimers();
    await setupAndSearch('futon');
    const calls = getEl('#searchRepeater').onItemReady.mock.calls;
    const handler = calls[calls.length - 1][0];
    const $item = (sel) => getEl(`atc-${sel}`);
    handler($item, sampleProducts[0]);

    const addHandler = getEl('atc-#searchAddBtn').onClick.mock.calls[0][0];
    await addHandler();

    expect(getEl('atc-#searchAddBtn').label).toBe('Added!');
    expect(mockAddToCart).toHaveBeenCalledWith('prod-1');
    expect(mockTrackEvent).toHaveBeenCalledWith('add_to_cart', { productId: 'prod-1', source: 'search' });

    vi.advanceTimersByTime(3100);
    expect(getEl('atc-#searchAddBtn').label).toBe('Add to Cart');
    vi.useRealTimers();
  });

  it('add-to-cart shows Error on failure and recovers', async () => {
    vi.useFakeTimers();
    mockAddToCart.mockRejectedValueOnce(new Error('Cart API error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await setupAndSearch('futon');
    const calls = getEl('#searchRepeater').onItemReady.mock.calls;
    const handler = calls[calls.length - 1][0];
    const $item = (sel) => getEl(`err-${sel}`);
    handler($item, sampleProducts[0]);

    const addHandler = getEl('err-#searchAddBtn').onClick.mock.calls[0][0];
    await addHandler();

    expect(getEl('err-#searchAddBtn').label).toBe('Error');

    vi.advanceTimersByTime(3100);
    expect(getEl('err-#searchAddBtn').label).toBe('Add to Cart');

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });
});

// ── Load More ───────────────────────────────────────────────────────

describe('Search Results — Load More', () => {
  it('shows loadMoreBtn when total exceeds PAGE_SIZE', async () => {
    mockFullTextSearch.mockResolvedValue({
      products: sampleProducts,
      total: 30,
      query: 'futon',
      facets: {},
    });
    await onReadyHandler();
    getEl('#searchInput').value = 'futon';
    const btnHandler = getEl('#searchBtn').onClick.mock.calls[0][0];
    btnHandler(); // fire-and-forget (like the actual code)
    // Flush all microtasks so performSearch completes
    await new Promise(r => setTimeout(r, 0));
    const loadMore = getEl('#loadMoreBtn');
    expect(loadMore.label).toBe('Load More');
    expect(loadMore.enable).toHaveBeenCalled();
  });

  it('hides loadMoreBtn when total within PAGE_SIZE', async () => {
    mockFullTextSearch.mockResolvedValue({
      products: sampleProducts,
      total: 2,
      query: 'futon',
      facets: {},
    });
    await setupAndSearch('futon');
    expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
  });

  it('loadMoreBtn onClick fetches next page with offset', async () => {
    mockFullTextSearch.mockResolvedValue({
      products: sampleProducts,
      total: 30,
      query: 'futon',
      facets: {},
    });
    const { getLoadMoreHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({
      products: [{ _id: 'prod-3', name: 'New Item' }],
      total: 30,
      query: 'futon',
      facets: {},
    });

    const loadMoreHandler = getLoadMoreHandler();
    await loadMoreHandler();

    expect(mockFullTextSearch).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 24 })
    );
  });

  it('loadMoreBtn hides when all results loaded', async () => {
    mockFullTextSearch.mockResolvedValue({
      products: sampleProducts,
      total: 26,
      query: 'futon',
      facets: {},
    });
    const { getLoadMoreHandler } = await setupAndSearch('futon');
    mockFullTextSearch.mockClear();
    mockFullTextSearch.mockResolvedValue({
      products: [{ _id: 'prod-3', name: 'Last Item' }],
      total: 26,
      query: 'futon',
      facets: {},
    });

    const loadMoreHandler = getLoadMoreHandler();
    await loadMoreHandler();

    // offset 24 + PAGE_SIZE 24 = 48 >= 26, so should hide
    expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
  });
});

// ── No Results / Empty State ────────────────────────────────────────

describe('Search Results — No Results State', () => {
  it('shows no-results box and announces when no results', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });
    await setupAndSearch('xyznonexistent');

    expect(getEl('#noResultsBox').show).toHaveBeenCalled();
    expect(getEl('#searchQuery').text).toContain('No results for');
    expect(getEl('#searchRepeater').collapse).toHaveBeenCalled();
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('No results found')
    );
  });

  it('tracks search_no_results event', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });
    await setupAndSearch('nothing');
    expect(mockTrackEvent).toHaveBeenCalledWith('search_no_results', { query: 'nothing' });
  });

  it('shows "Try one of these popular searches:" on no results', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });
    await setupAndSearch('nothing');
    expect(getEl('#noResultsText').text).toBe('Try one of these popular searches:');
  });

  it('sets role status on #noResultsBox for accessibility', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });
    await setupAndSearch('nothing');
    expect(getEl('#noResultsBox').accessibility.role).toBe('status');
  });
});

// ── Popular Search Chips ────────────────────────────────────────────

describe('Search Results — Popular Search Chips', () => {
  it('loads chips from popular searches API on no results', async () => {
    mockGetPopularSearches.mockResolvedValue({
      queries: [{ query: 'futon frames', count: 42 }],
    });
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });

    await setupAndSearch('nothing');
    await new Promise(r => setTimeout(r, 50));

    expect(mockGetPopularSearches).toHaveBeenCalled();
    expect(getEl('#searchChipsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('falls back to default queries when API returns empty', async () => {
    mockGetPopularSearches.mockResolvedValue({ queries: [] });
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });

    await setupAndSearch('nothing');
    await new Promise(r => setTimeout(r, 50));

    const chipsRepeater = getEl('#searchChipsRepeater');
    expect(chipsRepeater.data).toBeDefined();
    expect(chipsRepeater.data.length).toBeGreaterThan(0);
    expect(chipsRepeater.data.some(d => d.label === 'futon frames')).toBe(true);
  });

  it('renders chip text and ARIA label in onItemReady', async () => {
    mockGetPopularSearches.mockResolvedValue({
      queries: [{ query: 'futon frames', count: 10 }],
    });
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });

    await setupAndSearch('nothing');
    await new Promise(r => setTimeout(r, 50));

    const chipsRepeater = getEl('#searchChipsRepeater');
    const itemReady = chipsRepeater.onItemReady.mock.calls[0]?.[0];
    if (itemReady) {
      const $item = (sel) => getEl(`chiprender-${sel}`);
      itemReady($item, { _id: 'chip-0', label: 'futon frames', query: 'futon frames' });
      expect(getEl('chiprender-#chipLabel').text).toBe('futon frames');
      expect(getEl('chiprender-#chipLabel').accessibility.ariaLabel).toBe('Search for futon frames');
    }
  });

  it('chip click triggers makeClickable with search handler', async () => {
    mockGetPopularSearches.mockResolvedValue({
      queries: [{ query: 'mattresses', count: 20 }],
    });
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });

    await setupAndSearch('nothing');
    await new Promise(r => setTimeout(r, 50));

    const chipsRepeater = getEl('#searchChipsRepeater');
    const itemReady = chipsRepeater.onItemReady.mock.calls[0]?.[0];
    if (itemReady) {
      const $item = (sel) => getEl(`chipclick-${sel}`);
      itemReady($item, { _id: 'chip-0', label: 'mattresses', query: 'mattresses' });
      expect(mockMakeClickable).toHaveBeenCalledWith(
        getEl('chipclick-#chipLabel'),
        expect.any(Function),
        expect.objectContaining({ ariaLabel: 'Search for mattresses' })
      );
    }
  });

  it('falls back to default chips when popular searches API fails', async () => {
    mockGetPopularSearches.mockRejectedValueOnce(new Error('Popular API down'));
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: 'nothing', facets: {} });

    await setupAndSearch('nothing');
    await new Promise(r => setTimeout(r, 150));

    const chipsRepeater = getEl('#searchChipsRepeater');
    // Fallback should still set data
    expect(chipsRepeater.onItemReady).toHaveBeenCalled();
  }, 10000);
});

// ── Empty State (no query) ──────────────────────────────────────────

describe('Search Results — Empty State (no query on load)', () => {
  it('shows empty state text and collapses repeater', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: '', facets: {} });
    await onReadyHandler();
    expect(getEl('#searchQuery').text).toBe('Search Carolina Futons');
    expect(getEl('#searchRepeater').collapse).toHaveBeenCalled();
    expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
  });

  it('shows "Popular searches:" text in empty state', async () => {
    mockFullTextSearch.mockResolvedValue({ products: [], total: 0, query: '', facets: {} });
    await onReadyHandler();
    expect(getEl('#noResultsText').text).toBe('Popular searches:');
  });
});

// ── Loading Skeleton ────────────────────────────────────────────────

describe('Search Results — Loading Skeleton', () => {
  it('hides loading indicator after search completes', async () => {
    await setupAndSearch('futon');
    expect(getEl('#loadingIndicator').hide).toHaveBeenCalled();
  });

  it('hides loading indicator even on search error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFullTextSearch.mockRejectedValue(new Error('Network error'));
    await setupAndSearch('futon');
    expect(getEl('#loadingIndicator').hide).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ── Error Handling ──────────────────────────────────────────────────

describe('Search Results — Error Handling', () => {
  it('shows no-results on search API failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFullTextSearch.mockRejectedValue(new Error('Network error'));
    await setupAndSearch('futon');
    expect(getEl('#noResultsBox').show).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles null result from search gracefully', async () => {
    mockFullTextSearch.mockResolvedValue(null);
    // Should not throw
    await setupAndSearch('futon');
    // No crash = pass
    expect(true).toBe(true);
  });

  it('handles missing products array in result', async () => {
    mockFullTextSearch.mockResolvedValue({ total: 0, query: 'futon', facets: {} });
    await setupAndSearch('futon');
    expect(true).toBe(true);
  });

  it('handles getFilterValues failure silently', async () => {
    mockGetFilterValues.mockRejectedValueOnce(new Error('Facets API down'));
    await onReadyHandler();
    await new Promise(r => setTimeout(r, 150));
    // No error thrown, options remain empty
    expect(getEl('#materialFilter').options).toEqual([]);
  }, 10000);
});

// ── Accessibility ───────────────────────────────────────────────────

describe('Search Results — Accessibility', () => {
  it('initializes back-to-top button', async () => {
    await onReadyHandler();
    expect(mockInitBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls batchCheckWishlistStatus before rendering', async () => {
    await setupAndSearch('futon');
    expect(mockBatchCheck).toHaveBeenCalledWith(['prod-1', 'prod-2']);
  });
});
