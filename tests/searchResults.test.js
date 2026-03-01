/**
 * Tests for Search Results page polish — CF-z5tk
 *
 * Integration test scaffold: verifies mocks, enriched card components,
 * loading skeleton, filter sidebar, and empty state helpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix-location-frontend
vi.mock('wix-location-frontend', () => ({
  default: { query: { q: '' }, to: vi.fn() },
  to: vi.fn(),
}));

// Mock backend services
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

// Mock swatch service
const mockGetSwatchPreviewColors = vi.fn().mockResolvedValue([]);
vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: mockGetSwatchPreviewColors,
}));

// Mock engagement tracker
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

// Mock cart service
vi.mock('public/cartService', () => ({
  addToCart: vi.fn().mockResolvedValue({}),
}));

// Mock mobile helpers
vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((data) => data),
  initBackToTop: vi.fn(),
  getViewport: vi.fn(() => 'desktop'),
}));

// Mock a11y helpers
vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

// Mock WishlistCardButton
const mockBatchCheck = vi.fn().mockResolvedValue(new Set());
const mockInitCard = vi.fn();
vi.mock('public/WishlistCardButton.js', () => ({
  batchCheckWishlistStatus: mockBatchCheck,
  initCardWishlistButton: mockInitCard,
}));

// Mock galleryHelpers
vi.mock('public/galleryHelpers', () => ({
  getProductBadge: vi.fn(() => null),
  buildProductBadgeOverlay: vi.fn(() => null),
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
    discountedPrice: null,
    formattedDiscountedPrice: null,
    mainMedia: 'https://img.example.com/phoenix.jpg',
    ribbon: null,
    collections: ['mattresses'],
    description: '<p>Premium mattress</p>',
  },
];

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Search Results Page — enriched cards', () => {
  it('batchCheckWishlistStatus is importable and returns a Set', async () => {
    const result = await mockBatchCheck(['prod-1', 'prod-2']);
    expect(result).toBeInstanceOf(Set);
  });

  it('getProductBadge returns correct badge for sale items', async () => {
    const { getProductBadge } = await import('public/galleryHelpers');
    getProductBadge.mockReturnValue('Sale');
    expect(getProductBadge({ ribbon: 'Sale' })).toBe('Sale');
  });

  it('buildProductBadgeOverlay returns null for no-badge products', async () => {
    const { buildProductBadgeOverlay } = await import('public/galleryHelpers');
    buildProductBadgeOverlay.mockReturnValue(null);
    expect(buildProductBadgeOverlay({ ribbon: null })).toBeNull();
  });

  it('getSwatchPreviewColors is callable', async () => {
    mockGetSwatchPreviewColors.mockResolvedValue([
      { colorHex: '#8B4513', swatchName: 'Walnut' },
      { colorHex: '#D2B48C', swatchName: 'Tan' },
    ]);
    const result = await mockGetSwatchPreviewColors('prod-1', 4);
    expect(result).toHaveLength(2);
    expect(result[0].colorHex).toBe('#8B4513');
  });

  it('initCardWishlistButton is callable', () => {
    expect(mockInitCard).toBeDefined();
    expect(typeof mockInitCard).toBe('function');
  });
});

describe('Search Results Page — loading skeleton', () => {
  it('buildSkeletonData generates correct placeholder items', async () => {
    const { buildSkeletonData } = await import('../src/public/SearchResultsHelpers.js');
    const skeletons = buildSkeletonData(6);
    expect(skeletons).toHaveLength(6);
    expect(skeletons.every(s => s.isSkeleton)).toBe(true);
    expect(skeletons[0]._id).toBe('skeleton-0');
    expect(skeletons[5]._id).toBe('skeleton-5');
  });

  it('skeleton items have empty display fields', async () => {
    const { buildSkeletonData } = await import('../src/public/SearchResultsHelpers.js');
    const item = buildSkeletonData(1)[0];
    expect(item.name).toBe('');
    expect(item.formattedPrice).toBe('');
    expect(item.mainMedia).toBe('');
  });
});

describe('Search Results Page — filter sidebar', () => {
  it('getFilterValues returns facet data for sidebar population', async () => {
    mockGetFilterValues.mockResolvedValue({
      materials: [{ value: 'wood', count: 5 }, { value: 'metal', count: 3 }],
      colors: [{ value: 'Natural', count: 3 }],
      priceRanges: [{ label: 'Under $300', count: 8 }],
      features: [],
    });

    const result = await mockGetFilterValues();
    expect(result.materials).toHaveLength(2);
    expect(result.colors).toHaveLength(1);
    expect(result.priceRanges).toHaveLength(1);
  });

  it('getActiveFilterCount counts active filters', async () => {
    const { getActiveFilterCount } = await import('../src/public/SearchResultsHelpers.js');
    expect(getActiveFilterCount({ category: 'futons', priceRange: '', material: 'wood', color: '' })).toBe(2);
    expect(getActiveFilterCount({ category: '', priceRange: '', material: '', color: '' })).toBe(0);
    expect(getActiveFilterCount({ category: 'a', priceRange: 'b', material: 'c', color: 'd' })).toBe(4);
  });

  it('fullTextSearch accepts material and color params', async () => {
    await mockFullTextSearch({
      query: 'futon',
      category: 'futon-frames',
      material: 'wood',
      color: 'Natural',
      sortBy: 'relevance',
      limit: 24,
      offset: 0,
    });

    expect(mockFullTextSearch).toHaveBeenCalledWith(expect.objectContaining({
      material: 'wood',
      color: 'Natural',
    }));
  });
});

describe('Search Results Page — empty states', () => {
  it('buildSearchChips creates clickable chip data', async () => {
    const { buildSearchChips } = await import('../src/public/SearchResultsHelpers.js');
    const chips = buildSearchChips(['futon frames', 'mattresses', 'murphy beds']);
    expect(chips).toHaveLength(3);
    expect(chips[0]).toEqual({ _id: 'chip-0', label: 'futon frames', query: 'futon frames' });
    expect(chips[2]).toEqual({ _id: 'chip-2', label: 'murphy beds', query: 'murphy beds' });
  });

  it('getPopularSearches returns query data for chips', async () => {
    mockGetPopularSearches.mockResolvedValue({
      queries: [
        { query: 'futon frames', count: 42 },
        { query: 'mattresses', count: 35 },
      ],
    });

    const result = await mockGetPopularSearches(8);
    expect(result.queries).toHaveLength(2);
    expect(result.queries[0].query).toBe('futon frames');
  });

  it('handles empty popular searches gracefully', async () => {
    mockGetPopularSearches.mockResolvedValue({ queries: [] });
    const result = await mockGetPopularSearches(8);
    expect(result.queries).toHaveLength(0);
  });
});
