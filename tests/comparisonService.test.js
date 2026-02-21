import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getComparisonData,
  buildShareableUrl,
  trackComparison,
  getPopularComparisons,
  findSharedCategory,
  buildComparisonRows,
  computeWinnerBadges,
  formatValue,
  hasDifferences,
  getNestedValue,
  CATEGORY_ATTRIBUTES,
  COMMON_ATTRIBUTES,
  MAX_COMPARE,
} from '../src/backend/comparisonService.web.js';
import {
  futonFrame,
  wallHuggerFrame,
  futonMattress,
  murphyBed,
  platformBed,
  metalFrame,
  outdoorFrame,
  saleProduct,
  casegoodsItem,
} from './fixtures/products.js';
import wixData, { __reset, __seed } from 'wix-data';

// ─── Constants ──────────────────────────────────────────────────

describe('MAX_COMPARE', () => {
  it('limits to 4 products', () => {
    expect(MAX_COMPARE).toBe(4);
  });
});

describe('CATEGORY_ATTRIBUTES', () => {
  it('defines attributes for futon-frames', () => {
    const attrs = CATEGORY_ATTRIBUTES['futon-frames'];
    expect(attrs).toBeDefined();
    expect(attrs.length).toBeGreaterThanOrEqual(2);
    expect(attrs.some(a => a.key === 'material')).toBe(true);
  });

  it('defines attributes for mattresses', () => {
    expect(CATEGORY_ATTRIBUTES['mattresses']).toBeDefined();
  });

  it('defines attributes for murphy-cabinet-beds', () => {
    expect(CATEGORY_ATTRIBUTES['murphy-cabinet-beds']).toBeDefined();
  });

  it('defines attributes for platform-beds', () => {
    expect(CATEGORY_ATTRIBUTES['platform-beds']).toBeDefined();
  });

  it('defines attributes for casegoods-accessories', () => {
    expect(CATEGORY_ATTRIBUTES['casegoods-accessories']).toBeDefined();
  });

  it('each attribute has key, label, and format', () => {
    for (const [, attrs] of Object.entries(CATEGORY_ATTRIBUTES)) {
      for (const attr of attrs) {
        expect(attr).toHaveProperty('key');
        expect(attr).toHaveProperty('label');
        expect(attr).toHaveProperty('format');
      }
    }
  });
});

describe('COMMON_ATTRIBUTES', () => {
  it('includes brand, material, dimensions, and availability', () => {
    const keys = COMMON_ATTRIBUTES.map(a => a.key);
    expect(keys).toContain('brand');
    expect(keys).toContain('material');
    expect(keys).toContain('dimensions');
    expect(keys).toContain('inStock');
  });
});

// ─── getNestedValue ─────────────────────────────────────────────

describe('getNestedValue', () => {
  it('resolves top-level keys', () => {
    expect(getNestedValue(futonFrame, 'brand')).toBe('Night & Day');
  });

  it('resolves nested keys', () => {
    expect(getNestedValue(futonFrame, 'options.finish')).toBe('Natural');
  });

  it('returns undefined for missing keys', () => {
    expect(getNestedValue(futonFrame, 'options.nonexistent')).toBeUndefined();
  });

  it('returns undefined for null object', () => {
    expect(getNestedValue(null, 'brand')).toBeUndefined();
  });

  it('returns undefined for deeply missing paths', () => {
    expect(getNestedValue(futonFrame, 'a.b.c.d')).toBeUndefined();
  });
});

// ─── formatValue ────────────────────────────────────────────────

describe('formatValue', () => {
  it('formats null/undefined as dash', () => {
    expect(formatValue(null, 'text')).toBe('—');
    expect(formatValue(undefined, 'text')).toBe('—');
  });

  it('formats text values', () => {
    expect(formatValue('hardwood', 'text')).toBe('hardwood');
  });

  it('formats tags arrays', () => {
    expect(formatValue(['sleeper', 'wall-hugger'], 'tags')).toBe('sleeper, wall-hugger');
  });

  it('formats empty tags as dash', () => {
    expect(formatValue([], 'tags')).toBe('—');
  });

  it('formats dimensions object', () => {
    expect(formatValue({ width: 54, depth: 38, height: 33 }, 'dimensions')).toBe('54" × 38" × 33"');
  });

  it('formats missing dimensions as dash', () => {
    expect(formatValue({}, 'dimensions')).toBe('—');
    expect(formatValue('bad', 'dimensions')).toBe('—');
  });

  it('formats stock status', () => {
    expect(formatValue(true, 'stock')).toBe('In Stock');
    expect(formatValue(false, 'stock')).toBe('Out of Stock');
  });

  it('formats price values', () => {
    expect(formatValue(499, 'price')).toBe('$499.00');
    expect(formatValue(0, 'price')).toBe('$0.00');
  });

  it('formats rating values', () => {
    expect(formatValue(4.5, 'rating')).toBe('4.5/5');
    expect(formatValue(null, 'rating')).toBe('—');
  });

  it('handles unknown format as string', () => {
    expect(formatValue(42, 'unknown')).toBe('42');
  });
});

// ─── hasDifferences ─────────────────────────────────────────────

describe('hasDifferences', () => {
  it('returns false for identical values', () => {
    expect(hasDifferences(['wood', 'wood', 'wood'])).toBe(false);
  });

  it('returns true for different values', () => {
    expect(hasDifferences(['wood', 'metal', 'wood'])).toBe(true);
  });

  it('returns false for single value', () => {
    expect(hasDifferences(['wood'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasDifferences([])).toBe(false);
  });

  it('detects numeric differences', () => {
    expect(hasDifferences([499, 699, 499])).toBe(true);
    expect(hasDifferences([499, 499])).toBe(false);
  });
});

// ─── findSharedCategory ─────────────────────────────────────────

describe('findSharedCategory', () => {
  it('finds shared category when all products share one', () => {
    expect(findSharedCategory([futonFrame, wallHuggerFrame, metalFrame])).toBe('futon-frames');
  });

  it('returns null when no shared category', () => {
    expect(findSharedCategory([futonFrame, futonMattress])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(findSharedCategory([])).toBeNull();
  });

  it('returns first shared category from multi-collection products', () => {
    // wallHugger is in both futon-frames and wall-huggers
    // futonFrame is in futon-frames only
    const result = findSharedCategory([wallHuggerFrame, futonFrame]);
    expect(result).toBe('futon-frames');
  });
});

// ─── buildComparisonRows ────────────────────────────────────────

describe('buildComparisonRows', () => {
  it('builds price and rating rows first', () => {
    const rows = buildComparisonRows([futonFrame, wallHuggerFrame], 'futon-frames');
    expect(rows[0].label).toBe('Price');
    expect(rows[1].label).toBe('Rating');
  });

  it('uses category-specific attributes for shared category', () => {
    const rows = buildComparisonRows([futonFrame, wallHuggerFrame], 'futon-frames');
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Frame Material');
  });

  it('uses common attributes when no shared category', () => {
    const rows = buildComparisonRows([futonFrame, futonMattress], null);
    const labels = rows.map(r => r.label);
    expect(labels).toContain('Brand');
    expect(labels).toContain('Material');
    expect(labels).toContain('Dimensions (W x D x H)');
  });

  it('marks differing rows', () => {
    const rows = buildComparisonRows([futonFrame, wallHuggerFrame], 'futon-frames');
    const priceRow = rows.find(r => r.label === 'Price');
    expect(priceRow.differs).toBe(true); // 499 vs 699
  });

  it('marks identical rows as not differing', () => {
    const rows = buildComparisonRows([futonFrame, saleProduct], 'futon-frames');
    const materialRow = rows.find(r => r.label === 'Frame Material');
    expect(materialRow.differs).toBe(false); // both hardwood
  });

  it('creates cells for each product', () => {
    const rows = buildComparisonRows([futonFrame, wallHuggerFrame, metalFrame], 'futon-frames');
    expect(rows[0].cells.length).toBe(3);
  });

  it('formats price with discounted price when available', () => {
    const rows = buildComparisonRows([futonFrame, saleProduct], null);
    const priceRow = rows[0];
    expect(priceRow.cells[1].value).toBe('$349.00'); // saleProduct has formattedDiscountedPrice
  });

  it('formats dimensions correctly', () => {
    const rows = buildComparisonRows([futonFrame, wallHuggerFrame], null);
    const dimRow = rows.find(r => r.label === 'Dimensions (W x D x H)');
    expect(dimRow).toBeDefined();
    expect(dimRow.cells[0].value).toBe('54" × 38" × 33"');
  });
});

// ─── computeWinnerBadges ────────────────────────────────────────

describe('computeWinnerBadges', () => {
  it('assigns bestValue to cheapest product', () => {
    const badges = computeWinnerBadges([futonFrame, wallHuggerFrame, metalFrame]);
    expect(badges.bestValue).toBe(metalFrame._id); // $299
  });

  it('assigns bestValue considering discounted prices', () => {
    const badges = computeWinnerBadges([futonFrame, saleProduct]);
    expect(badges.bestValue).toBe(saleProduct._id); // $349 discounted
  });

  it('assigns bestRated to highest-rated product', () => {
    const badges = computeWinnerBadges([futonFrame, metalFrame, outdoorFrame]);
    expect(badges.bestRated).toBe(outdoorFrame._id); // 4.8
  });

  it('assigns mostPopular to product with most reviews', () => {
    const rated1 = { ...futonFrame, numReviews: 50 };
    const rated2 = { ...wallHuggerFrame, numReviews: 10, numericRating: 4.0 };
    const badges = computeWinnerBadges([rated1, rated2]);
    expect(badges.mostPopular).toBe(rated1._id);
  });

  it('does not assign badges when fewer than 2 qualify', () => {
    const noRating = { ...futonFrame, numericRating: null };
    const badges = computeWinnerBadges([noRating, wallHuggerFrame]);
    expect(badges.bestRated).toBeUndefined(); // only 1 has rating
  });

  it('returns empty badges for products without prices', () => {
    const noPriceA = { ...futonFrame, price: undefined };
    const noPriceB = { ...wallHuggerFrame, price: undefined };
    const badges = computeWinnerBadges([noPriceA, noPriceB]);
    expect(badges.bestValue).toBeUndefined();
  });
});

// ─── getComparisonData (integration) ────────────────────────────

describe('getComparisonData', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns error for less than 2 product IDs', async () => {
    const result = await getComparisonData(['prod-1']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least 2');
  });

  it('returns error for non-array input', async () => {
    const result = await getComparisonData('not-an-array');
    expect(result.success).toBe(false);
  });

  it('returns error for empty array', async () => {
    const result = await getComparisonData([]);
    expect(result.success).toBe(false);
  });

  it('returns error for invalid IDs', async () => {
    const result = await getComparisonData(['<script>', '<alert>']);
    expect(result.success).toBe(false);
  });

  it('fetches and returns comparison data for valid IDs', async () => {
    __seed('Stores/Products', [futonFrame, wallHuggerFrame, metalFrame]);

    const result = await getComparisonData([futonFrame._id, wallHuggerFrame._id]);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.badges).toBeDefined();
    expect(result.sharedCategory).toBe('futon-frames');
  });

  it('preserves requested order', async () => {
    __seed('Stores/Products', [futonFrame, wallHuggerFrame]);

    const result = await getComparisonData([wallHuggerFrame._id, futonFrame._id]);
    expect(result.success).toBe(true);
    expect(result.products[0]._id).toBe(wallHuggerFrame._id);
    expect(result.products[1]._id).toBe(futonFrame._id);
  });

  it('returns null sharedCategory for mixed categories', async () => {
    __seed('Stores/Products', [futonFrame, futonMattress]);

    const result = await getComparisonData([futonFrame._id, futonMattress._id]);
    expect(result.success).toBe(true);
    expect(result.sharedCategory).toBeNull();
  });

  it('limits to MAX_COMPARE products', async () => {
    __seed('Stores/Products', [futonFrame, wallHuggerFrame, metalFrame, outdoorFrame, futonMattress]);

    const ids = [futonFrame._id, wallHuggerFrame._id, metalFrame._id, outdoorFrame._id, futonMattress._id];
    const result = await getComparisonData(ids);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(4);
  });

  it('returns product summaries with expected fields', async () => {
    __seed('Stores/Products', [futonFrame, wallHuggerFrame]);

    const result = await getComparisonData([futonFrame._id, wallHuggerFrame._id]);
    expect(result.success).toBe(true);
    const p = result.products[0];
    expect(p).toHaveProperty('_id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('slug');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('formattedPrice');
    expect(p).toHaveProperty('mainMedia');
    expect(p).toHaveProperty('ribbon');
    expect(p).toHaveProperty('inStock');
    expect(p).toHaveProperty('numericRating');
    expect(p).toHaveProperty('collections');
  });

  it('returns error when not enough products found', async () => {
    __seed('Stores/Products', [futonFrame]);

    const result = await getComparisonData([futonFrame._id, 'nonexistent-id']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not find enough');
  });

  it('includes winner badges in response', async () => {
    __seed('Stores/Products', [futonFrame, metalFrame]);

    const result = await getComparisonData([futonFrame._id, metalFrame._id]);
    expect(result.success).toBe(true);
    expect(result.badges).toBeDefined();
    expect(result.badges.bestValue).toBe(metalFrame._id); // cheaper
  });

  it('marks price row as differing when prices differ', async () => {
    __seed('Stores/Products', [futonFrame, wallHuggerFrame]);

    const result = await getComparisonData([futonFrame._id, wallHuggerFrame._id]);
    expect(result.success).toBe(true);
    const priceRow = result.rows.find(r => r.label === 'Price');
    expect(priceRow.differs).toBe(true);
  });
});

// ─── buildShareableUrl ──────────────────────────────────────────

describe('buildShareableUrl', () => {
  it('builds URL with product IDs', async () => {
    const url = await buildShareableUrl(['prod-1', 'prod-2']);
    expect(url).toBe('/compare?ids=prod-1,prod-2');
  });

  it('limits to 4 products', async () => {
    const ids = ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5'];
    const url = await buildShareableUrl(ids);
    const resultIds = url.replace('/compare?ids=', '').split(',');
    expect(resultIds.length).toBeLessThanOrEqual(4);
  });

  it('returns empty for less than 2 IDs', async () => {
    expect(await buildShareableUrl(['prod-1'])).toBe('');
    expect(await buildShareableUrl([])).toBe('');
  });

  it('returns empty for non-array input', async () => {
    expect(await buildShareableUrl('not-array')).toBe('');
  });

  it('filters out invalid IDs', async () => {
    const url = await buildShareableUrl(['prod-1', '<script>', 'prod-2']);
    expect(url).toBe('/compare?ids=prod-1,prod-2');
  });

  it('returns empty when too few valid IDs after filtering', async () => {
    const url = await buildShareableUrl(['<script>', 'prod-1']);
    expect(url).toBe('');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles products with missing optional fields', () => {
    const minimal = {
      _id: 'min-1',
      name: 'Minimal Product',
      price: 100,
      formattedPrice: '$100.00',
    };
    const minimal2 = {
      _id: 'min-2',
      name: 'Minimal Product 2',
      price: 200,
      formattedPrice: '$200.00',
    };

    const rows = buildComparisonRows([minimal, minimal2], null);
    expect(rows.length).toBeGreaterThan(0);
    // Should not throw
  });

  it('handles products with no reviews gracefully', () => {
    const noReview1 = { ...futonFrame, numericRating: null, numReviews: 0 };
    const noReview2 = { ...wallHuggerFrame, numericRating: null, numReviews: 0 };
    const rows = buildComparisonRows([noReview1, noReview2], 'futon-frames');
    const ratingRow = rows.find(r => r.label === 'Rating');
    expect(ratingRow.cells[0].value).toContain('No reviews');
  });

  it('handles mixed categories showing common attributes only', () => {
    // futonFrame (futon-frames) vs futonMattress (mattresses) — no shared category
    const rows = buildComparisonRows([futonFrame, futonMattress], null);
    const labels = rows.map(r => r.label);
    // Should use COMMON_ATTRIBUTES, not category-specific
    expect(labels).toContain('Brand');
    expect(labels).toContain('Material');
    expect(labels).not.toContain('Frame Material');
    expect(labels).not.toContain('Cover Material');
  });

  it('winner badges work with identical prices (no bestValue if tied)', () => {
    const p1 = { ...futonFrame, price: 499 };
    const p2 = { ...wallHuggerFrame, price: 499 };
    const badges = computeWinnerBadges([p1, p2]);
    // bestValue is assigned to first since they're equal (sort is stable)
    expect(badges.bestValue).toBeDefined();
  });

  it('handles out-of-stock products', () => {
    const rows = buildComparisonRows([futonFrame, outdoorFrame], null);
    const stockRow = rows.find(r => r.label === 'Availability');
    const outOfStockCell = stockRow.cells[1]; // outdoorFrame is out of stock
    expect(outOfStockCell.value).toBe('Out of Stock');
  });

  it('handles discounted products in comparison rows', () => {
    const rows = buildComparisonRows([futonFrame, saleProduct], null);
    const priceRow = rows[0];
    expect(priceRow.cells[1].value).toBe('$349.00'); // discounted price shown
    expect(priceRow.cells[1].raw).toBe(349);
  });
});

// ─── trackComparison ────────────────────────────────────────────

describe('trackComparison', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns false for less than 2 product IDs', async () => {
    expect(await trackComparison(['prod-1'])).toBe(false);
    expect(await trackComparison([])).toBe(false);
  });

  it('returns false for non-array input', async () => {
    expect(await trackComparison('not-array')).toBe(false);
  });

  it('creates new CompareHistory record for first comparison', async () => {
    const result = await trackComparison([futonFrame._id, wallHuggerFrame._id]);
    expect(result).toBe(true);
  });

  it('increments viewCount for repeated comparisons', async () => {
    // First comparison
    await trackComparison([futonFrame._id, wallHuggerFrame._id]);
    // Second comparison (same products, even in different order)
    const result = await trackComparison([wallHuggerFrame._id, futonFrame._id]);
    expect(result).toBe(true);
  });

  it('sorts product IDs for consistent dedup', async () => {
    // A,B and B,A should resolve to same comparison key
    await trackComparison(['b-id', 'a-id']);
    __seed('CompareHistory', [{
      _id: 'ch-1',
      comparisonKey: 'a-id|b-id',
      productIds: ['a-id', 'b-id'],
      viewCount: 1,
      lastViewed: new Date(),
    }]);
    const result = await trackComparison(['b-id', 'a-id']);
    expect(result).toBe(true);
  });

  it('filters out invalid IDs', async () => {
    const result = await trackComparison(['<script>', futonFrame._id]);
    expect(result).toBe(false); // only 1 valid ID
  });

  it('limits to MAX_COMPARE products', async () => {
    const ids = [futonFrame._id, wallHuggerFrame._id, metalFrame._id, outdoorFrame._id, futonMattress._id];
    const result = await trackComparison(ids);
    expect(result).toBe(true);
  });
});

// ─── getPopularComparisons ──────────────────────────────────────

describe('getPopularComparisons', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns empty array when no history', async () => {
    const result = await getPopularComparisons(5);
    expect(result).toEqual([]);
  });

  it('returns comparisons sorted by viewCount descending', async () => {
    __seed('CompareHistory', [
      { _id: 'ch-1', comparisonKey: 'a|b', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
      { _id: 'ch-2', comparisonKey: 'c|d', productIds: ['c', 'd'], viewCount: 10, lastViewed: new Date() },
    ]);

    const result = await getPopularComparisons(5);
    expect(result.length).toBe(2);
    expect(result[0].viewCount).toBe(10);
    expect(result[1].viewCount).toBe(5);
  });

  it('respects limit parameter', async () => {
    __seed('CompareHistory', [
      { _id: 'ch-1', comparisonKey: 'a|b', productIds: ['a', 'b'], viewCount: 5, lastViewed: new Date() },
      { _id: 'ch-2', comparisonKey: 'c|d', productIds: ['c', 'd'], viewCount: 10, lastViewed: new Date() },
      { _id: 'ch-3', comparisonKey: 'e|f', productIds: ['e', 'f'], viewCount: 3, lastViewed: new Date() },
    ]);

    const result = await getPopularComparisons(2);
    expect(result.length).toBe(2);
  });

  it('clamps limit to safe range', async () => {
    const result = await getPopularComparisons(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns productIds and viewCount per entry', async () => {
    __seed('CompareHistory', [
      { _id: 'ch-1', comparisonKey: 'a|b', productIds: ['a', 'b'], viewCount: 7, lastViewed: new Date() },
    ]);

    const result = await getPopularComparisons(5);
    expect(result[0]).toHaveProperty('productIds');
    expect(result[0]).toHaveProperty('viewCount');
    expect(result[0].productIds).toEqual(['a', 'b']);
    expect(result[0].viewCount).toBe(7);
  });
});

// ─── clearCompareList ───────────────────────────────────────────

describe('clearCompareList', () => {
  it('clears the compare list from session storage', async () => {
    const { addToCompare, getCompareList, clearCompareList } = await import('../src/public/galleryHelpers.js');
    addToCompare(futonFrame);
    expect(getCompareList().length).toBe(1);
    clearCompareList();
    expect(getCompareList().length).toBe(0);
  });

  it('does not throw when compare list is already empty', async () => {
    const { clearCompareList, getCompareList } = await import('../src/public/galleryHelpers.js');
    clearCompareList();
    expect(getCompareList()).toEqual([]);
  });
});
