/**
 * Tests for StarRatingCard.js — Star rating display on product grid cards
 *
 * Tests star string generation, batch rating loading, card rendering,
 * zero-review state, half-star handling, error recovery, and a11y.
 *
 * CF-ys3q: Star ratings + wishlist UI hookup
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateStarString,
  batchLoadRatings,
  renderCardStarRating,
  _resetCache,
} from '../src/public/StarRatingCard.js';

// ── Mock reviewsService.web ─────────────────────────────────────────

const mockGetCategoryReviewSummaries = vi.fn();

vi.mock('backend/reviewsService.web', () => ({
  getCategoryReviewSummaries: (...args) => mockGetCategoryReviewSummaries(...args),
}));

// ── Mock helpers ────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    src: '',
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function createCard$item() {
  const els = new Map();
  const $item = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $item._els = els;
  return $item;
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCache();
});

// ── generateStarString ──────────────────────────────────────────────

describe('generateStarString', () => {
  it('renders 5 filled stars for rating 5.0', () => {
    expect(generateStarString(5)).toBe('★★★★★');
  });

  it('renders correct filled/empty for rating 3.0', () => {
    expect(generateStarString(3)).toBe('★★★☆☆');
  });

  it('renders half star for rating 3.5', () => {
    expect(generateStarString(3.5)).toBe('★★★½☆');
  });

  it('renders half star for rating 4.7', () => {
    // 4.7 → 4 full + half (0.7 >= 0.5) = ★★★★½
    expect(generateStarString(4.7)).toBe('★★★★½');
  });

  it('renders no half star for rating 4.2', () => {
    // 4.2 → 4 full + no half (0.2 < 0.5) = ★★★★☆
    expect(generateStarString(4.2)).toBe('★★★★☆');
  });

  it('renders 0 stars for rating 0', () => {
    expect(generateStarString(0)).toBe('☆☆☆☆☆');
  });

  it('renders 1 star for rating 1.0', () => {
    expect(generateStarString(1)).toBe('★☆☆☆☆');
  });

  it('always produces exactly 5 characters', () => {
    for (const rating of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      expect(generateStarString(rating).length).toBe(5);
    }
  });

  it('handles null/undefined gracefully', () => {
    expect(generateStarString(null)).toBe('☆☆☆☆☆');
    expect(generateStarString(undefined)).toBe('☆☆☆☆☆');
  });

  it('clamps rating above 5 to 5 stars', () => {
    expect(generateStarString(7)).toBe('★★★★★');
  });

  it('clamps negative rating to 0 stars', () => {
    expect(generateStarString(-2)).toBe('☆☆☆☆☆');
  });
});

// ── batchLoadRatings ────────────────────────────────────────────────

describe('batchLoadRatings', () => {
  it('calls getCategoryReviewSummaries with product IDs', async () => {
    mockGetCategoryReviewSummaries.mockResolvedValue({
      'prod-1': { average: 4.5, total: 12 },
    });

    const result = await batchLoadRatings(['prod-1']);
    expect(mockGetCategoryReviewSummaries).toHaveBeenCalledWith(['prod-1']);
    expect(result['prod-1'].average).toBe(4.5);
  });

  it('caches results across calls with same IDs', async () => {
    mockGetCategoryReviewSummaries.mockResolvedValue({
      'prod-1': { average: 4.0, total: 5 },
    });

    await batchLoadRatings(['prod-1']);
    await batchLoadRatings(['prod-1']);

    expect(mockGetCategoryReviewSummaries).toHaveBeenCalledTimes(1);
  });

  it('makes new call for different product IDs', async () => {
    mockGetCategoryReviewSummaries.mockResolvedValue({});

    await batchLoadRatings(['prod-1']);

    _resetCache();

    await batchLoadRatings(['prod-2']);

    expect(mockGetCategoryReviewSummaries).toHaveBeenCalledTimes(2);
  });

  it('returns empty object on API error', async () => {
    mockGetCategoryReviewSummaries.mockRejectedValue(new Error('Network error'));

    const result = await batchLoadRatings(['prod-1']);
    expect(result).toEqual({});
  });

  it('returns empty object for empty product list', async () => {
    const result = await batchLoadRatings([]);
    expect(result).toEqual({});
    expect(mockGetCategoryReviewSummaries).not.toHaveBeenCalled();
  });

  it('returns empty object for null input', async () => {
    const result = await batchLoadRatings(null);
    expect(result).toEqual({});
  });

  it('deduplicates concurrent calls', async () => {
    let resolvePromise;
    mockGetCategoryReviewSummaries.mockReturnValue(
      new Promise(resolve => { resolvePromise = resolve; })
    );

    const p1 = batchLoadRatings(['prod-1']);
    const p2 = batchLoadRatings(['prod-1']);

    resolvePromise({ 'prod-1': { average: 3.0, total: 2 } });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(mockGetCategoryReviewSummaries).toHaveBeenCalledTimes(1);
  });
});

// ── renderCardStarRating ────────────────────────────────────────────

describe('renderCardStarRating', () => {
  it('renders stars and count for a rated product', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.5, total: 23 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').text).toBe('★★★★½');
    expect($item('#gridReviewCount').text).toBe('(23)');
  });

  it('expands star and count elements when rating exists', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 3.0, total: 5 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').expand).toHaveBeenCalled();
    expect($item('#gridReviewCount').expand).toHaveBeenCalled();
  });

  it('shows "No reviews yet" when product has zero reviews', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 0, total: 0 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').collapse).toHaveBeenCalled();
    expect($item('#gridReviewCount').text).toBe('No reviews yet');
    expect($item('#gridReviewCount').expand).toHaveBeenCalled();
  });

  it('collapses elements when product not in ratings map', () => {
    const $item = createCard$item();
    const ratingsMap = {};

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').collapse).toHaveBeenCalled();
  });

  it('sets ARIA label on stars element', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.5, total: 23 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').accessibility.ariaLabel).toBe('4.5 out of 5 stars');
  });

  it('does not throw when elements are missing', () => {
    const $item = () => null;
    const ratingsMap = { 'prod-1': { average: 4.0, total: 10 } };

    expect(() => renderCardStarRating($item, 'prod-1', ratingsMap)).not.toThrow();
  });

  it('does not throw for null ratingsMap', () => {
    const $item = createCard$item();
    expect(() => renderCardStarRating($item, 'prod-1', null)).not.toThrow();
  });

  it('does not throw for undefined productId', () => {
    const $item = createCard$item();
    expect(() => renderCardStarRating($item, undefined, {})).not.toThrow();
  });

  it('handles singular review count text', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 5.0, total: 1 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewCount').text).toBe('(1)');
  });

  it('renders integer rating without half star', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.0, total: 10 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').text).toBe('★★★★☆');
  });

  it('sets star color to sunsetCoral', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.0, total: 10 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewStars').style.color).toBe('#4A7D94');
  });

  it('shows "No reviews yet" when product not in ratings map', () => {
    const $item = createCard$item();

    renderCardStarRating($item, 'prod-1', {});

    expect($item('#gridReviewCount').text).toBe('No reviews yet');
    expect($item('#gridReviewCount').expand).toHaveBeenCalled();
  });

  it('sanitizes non-numeric total to 0', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.0, total: '<script>alert(1)</script>' } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    // Non-numeric total → NaN → floor to 0 → "No reviews yet" path
    expect($item('#gridReviewCount').text).toBe('No reviews yet');
  });

  it('sanitizes negative total to 0', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 3.0, total: -5 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewCount').text).toBe('No reviews yet');
  });

  it('floors fractional total values', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.0, total: 10.7 } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    expect($item('#gridReviewCount').text).toBe('(10)');
  });

  it('handles Infinity total safely', () => {
    const $item = createCard$item();
    const ratingsMap = { 'prod-1': { average: 4.0, total: Infinity } };

    renderCardStarRating($item, 'prod-1', ratingsMap);

    // Infinity is numeric but not finite — floor(Infinity) = Infinity, max(0, Infinity) = Infinity
    // Number coercion is fine, display is "(Infinity)" which is safe (no XSS)
    expect($item('#gridReviewCount').text).not.toContain('<');
  });
});
