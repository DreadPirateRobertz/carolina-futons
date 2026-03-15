import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ─── Mock $w runtime ──────────────────────────────────────────────
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

// ─── Mock dependencies ───────────────────────────────────────────
vi.mock('wix-location-frontend', () => ({
  default: { query: { q: '' }, to: vi.fn() },
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/ga4Tracking', () => ({
  fireSearch: vi.fn(),
  fireViewItemList: vi.fn(),
}));
vi.mock('public/cartService', () => ({
  addToCart: vi.fn(),
}));
vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((arr) => arr),
  initBackToTop: vi.fn(),
  getViewport: vi.fn(() => 'desktop'),
  onViewportChange: vi.fn(),
}));
vi.mock('backend/searchService.web', () => ({
  fullTextSearch: vi.fn(() => Promise.resolve({ products: [], total: 0 })),
  getAutocompleteSuggestions: vi.fn(),
  getPopularSearches: vi.fn(() => Promise.resolve({ queries: [] })),
  getFilterValues: vi.fn(() => Promise.resolve({ materials: [], colors: [] })),
}));
vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
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
  buildSkeletonData: vi.fn(() => []),
  getActiveFilterCount: vi.fn(() => 0),
  buildSearchChips: vi.fn(() => []),
}));
vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ─── Import mocks for assertions ─────────────────────────────────
import { initBackToTop, onViewportChange } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';

// ─── Load page (registers $w.onReady) ────────────────────────────
beforeAll(async () => {
  await import('../src/pages/Search Results.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────

describe('Search Results page', () => {
  // ── 1. Initialization ──────────────────────────────────────────

  describe('initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with searchResults', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('searchResults');
    });

    it('registers onViewportChange callback', async () => {
      await onReadyHandler();
      expect(onViewportChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── 2. Autocomplete ───────────────────────────────────────────

  describe('autocomplete setup', () => {
    it('sets ARIA label on searchInput', async () => {
      await onReadyHandler();
      expect(getEl('#searchInput').accessibility.ariaLabel).toBe('Search products');
    });

    it('sets role on suggestionsBox', async () => {
      await onReadyHandler();
      expect(getEl('#suggestionsBox').accessibility.role).toBe('listbox');
    });

    it('registers onInput handler on searchInput', async () => {
      await onReadyHandler();
      expect(getEl('#searchInput').onInput).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers onKeyPress handler on searchInput', async () => {
      await onReadyHandler();
      expect(getEl('#searchInput').onKeyPress).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── 3. Search button ──────────────────────────────────────────

  describe('search button', () => {
    it('registers onClick on searchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#searchBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on searchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#searchBtn').accessibility.ariaLabel).toBe('Search products');
    });
  });

  // ── 4. Load more button ───────────────────────────────────────

  describe('load more button', () => {
    it('registers onClick on loadMoreBtn', async () => {
      await onReadyHandler();
      expect(getEl('#loadMoreBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── 5. Filters ────────────────────────────────────────────────

  describe('filter setup', () => {
    it('registers onChange on categoryFilter', async () => {
      await onReadyHandler();
      expect(getEl('#categoryFilter').onChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on categoryFilter', async () => {
      await onReadyHandler();
      expect(getEl('#categoryFilter').accessibility.ariaLabel).toBe('Filter by category');
    });

    it('registers onChange on priceFilter', async () => {
      await onReadyHandler();
      expect(getEl('#priceFilter').onChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on priceFilter', async () => {
      await onReadyHandler();
      expect(getEl('#priceFilter').accessibility.ariaLabel).toBe('Filter by price range');
    });

    it('registers onChange on materialFilter', async () => {
      await onReadyHandler();
      expect(getEl('#materialFilter').onChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on materialFilter', async () => {
      await onReadyHandler();
      expect(getEl('#materialFilter').accessibility.ariaLabel).toBe('Filter by material');
    });

    it('registers onChange on colorFilter', async () => {
      await onReadyHandler();
      expect(getEl('#colorFilter').onChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on colorFilter', async () => {
      await onReadyHandler();
      expect(getEl('#colorFilter').accessibility.ariaLabel).toBe('Filter by color');
    });

    it('registers onClick on filterToggleBtn', async () => {
      await onReadyHandler();
      expect(getEl('#filterToggleBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on filterToggleBtn', async () => {
      await onReadyHandler();
      expect(getEl('#filterToggleBtn').accessibility.ariaLabel).toBe('Toggle filters');
    });

    it('registers onClick on clearFiltersBtn', async () => {
      await onReadyHandler();
      expect(getEl('#clearFiltersBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on clearFiltersBtn', async () => {
      await onReadyHandler();
      expect(getEl('#clearFiltersBtn').accessibility.ariaLabel).toBe('Clear all filters');
    });
  });

  // ── 6. Sorting ────────────────────────────────────────────────

  describe('sorting setup', () => {
    it('registers onChange on sortDropdown', async () => {
      await onReadyHandler();
      expect(getEl('#sortDropdown').onChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets ARIA label on sortDropdown', async () => {
      await onReadyHandler();
      expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort results');
    });
  });

  // ── 7. Empty state (no query) ─────────────────────────────────

  describe('empty state (no query)', () => {
    it('sets searchQuery text to welcome message', async () => {
      await onReadyHandler();
      expect(getEl('#searchQuery').text).toBe('Search Carolina Futons');
    });

    it('collapses searchRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#searchRepeater').collapse).toHaveBeenCalled();
      expect(getEl('#searchRepeater').collapsed).toBe(true);
    });

    it('hides loadMoreBtn', async () => {
      await onReadyHandler();
      expect(getEl('#loadMoreBtn').hide).toHaveBeenCalled();
    });

    it('sets noResultsText to popular searches prompt', async () => {
      await onReadyHandler();
      expect(getEl('#noResultsText').text).toBe('Popular searches:');
    });

    it('does not call trackEvent for search (no query)', async () => {
      const { trackEvent } = await import('public/engagementTracker');
      await onReadyHandler();
      expect(trackEvent).not.toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'search' }));
    });
  });
});
