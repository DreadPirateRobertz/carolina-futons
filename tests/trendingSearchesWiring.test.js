/**
 * Search Results page wiring tests for CF-ts4n: TrendingSearches
 *
 * Verifies that loadPopularChips prefers CMS terms from getTrendingSearches,
 * falls back to getPopularSearches when CMS returns empty, and falls back to
 * hardcoded defaults when both fail.
 *
 * See CF-ts4n for specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetTrendingSearches, mockGetPopularSearches, mockBuildSearchChips } = vi.hoisted(() => ({
  mockGetTrendingSearches: vi.fn(),
  mockGetPopularSearches:  vi.fn(),
  mockBuildSearchChips:    vi.fn((terms) => terms.map((t, i) => ({ _id: `chip-${i}`, label: t, query: t }))),
}));

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/trendingSearches.web', () => ({
  getTrendingSearches: mockGetTrendingSearches,
}));

vi.mock('backend/searchService.web', () => ({
  fullTextSearch: vi.fn().mockResolvedValue({ products: [], total: 0 }),
  getAutocompleteSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
  getPopularSearches: mockGetPopularSearches,
  getFilterValues: vi.fn().mockResolvedValue({ materials: [], colors: [] }),
}));

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: vi.fn().mockResolvedValue([]),
}));

vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/ga4Tracking', () => ({
  fireSearch: vi.fn().mockResolvedValue(undefined),
  fireViewItemList: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('public/cartService', () => ({ addToCart: vi.fn().mockResolvedValue({}) }));
vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((d) => d),
  initBackToTop: vi.fn(),
  getViewport: vi.fn(() => 'desktop'),
  onViewportChange: vi.fn(),
}));
vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));
vi.mock('public/WishlistCardButton.js', () => ({
  batchCheckWishlistStatus: vi.fn().mockResolvedValue(new Set()),
  initCardWishlistButton: vi.fn(),
}));
vi.mock('public/galleryHelpers', () => ({ buildProductBadgeOverlay: vi.fn() }));
vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));
vi.mock('public/SearchResultsHelpers.js', () => ({
  buildSkeletonData: vi.fn(() => []),
  getActiveFilterCount: vi.fn(() => 0),
  buildSearchChips: mockBuildSearchChips,
}));
vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/emptyStates.js', () => ({ renderEmptyState: vi.fn() }));
vi.mock('wix-location-frontend', () => ({
  default: { query: { q: '' }, to: vi.fn() },
  to: vi.fn(),
}));

// ── $w Mock ──────────────────────────────────────────────────────────

const elements = new Map();
function getEl(sel) {
  if (!elements.has(sel)) {
    elements.set(sel, {
      text: '', value: '', hidden: true, label: '', options: [],
      accessibility: {}, customClassList: { add: vi.fn(), remove: vi.fn() },
      collapse: vi.fn(() => Promise.resolve()),
      expand:   vi.fn(() => Promise.resolve()),
      show:     vi.fn(() => Promise.resolve()),
      hide:     vi.fn(() => Promise.resolve()),
      enable: vi.fn(), disable: vi.fn(),
      onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
      onKeyPress: vi.fn(), onItemReady: vi.fn(),
      data: [],
    });
  }
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

async function triggerPageLoad() {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  await import('../src/pages/Search Results.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Search Results page — trending searches wiring (CF-ts4n)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    elements.clear();
    mockBuildSearchChips.mockImplementation((terms) =>
      terms.map((t, i) => ({ _id: `chip-${i}`, label: t, query: t }))
    );
  });

  it('calls getTrendingSearches on page load when no query', async () => {
    mockGetTrendingSearches.mockResolvedValue({ success: true, terms: ['futon frames'] });
    await triggerPageLoad();
    expect(mockGetTrendingSearches).toHaveBeenCalled();
  });

  it('uses CMS terms when getTrendingSearches returns populated terms', async () => {
    const cmsTerms = ['futon frames', 'murphy beds', 'sofa beds'];
    mockGetTrendingSearches.mockResolvedValue({ success: true, terms: cmsTerms });
    await triggerPageLoad();
    const chipCalls = mockBuildSearchChips.mock.calls;
    expect(chipCalls.some(([terms]) =>
      Array.isArray(terms) && terms[0] === 'futon frames' && terms[1] === 'murphy beds'
    )).toBe(true);
  });

  it('falls back to getPopularSearches when getTrendingSearches returns empty terms', async () => {
    mockGetTrendingSearches.mockResolvedValue({ success: true, terms: [] });
    mockGetPopularSearches.mockResolvedValue({ queries: [{ query: 'platform beds' }] });
    await triggerPageLoad();
    expect(mockGetPopularSearches).toHaveBeenCalled();
  });

  it('falls back to hardcoded defaults when both getTrendingSearches and getPopularSearches fail', async () => {
    mockGetTrendingSearches.mockRejectedValue(new Error('network'));
    mockGetPopularSearches.mockRejectedValue(new Error('network'));
    await expect(triggerPageLoad()).resolves.not.toThrow();
    // buildSearchChips should still have been called (with fallback defaults)
    expect(mockBuildSearchChips).toHaveBeenCalled();
  });

  it('does not throw when getTrendingSearches throws', async () => {
    mockGetTrendingSearches.mockRejectedValue(new Error('network error'));
    await expect(triggerPageLoad()).resolves.not.toThrow();
  });

  it('does not throw when getTrendingSearches returns success: false', async () => {
    mockGetTrendingSearches.mockResolvedValue({ success: false, terms: ['futon frames'], error: 'DB error' });
    await expect(triggerPageLoad()).resolves.not.toThrow();
  });

  it('uses terms from success:false response if terms are populated', async () => {
    const fallbackTerms = ['futon frames', 'platform beds'];
    mockGetTrendingSearches.mockResolvedValue({ success: false, terms: fallbackTerms, error: 'DB error' });
    await triggerPageLoad();
    const chipCalls = mockBuildSearchChips.mock.calls;
    expect(chipCalls.some(([terms]) =>
      Array.isArray(terms) && terms[0] === 'futon frames'
    )).toBe(true);
  });
});
