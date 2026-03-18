/**
 * Compare Page — unit tests for comparePageHelpers.js
 * Stories: S1 URL parsing, S2 column rendering, S3 attributes table,
 *          S4 mobile responsive, S5 SEO + schema, S6 start-over navigation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseProductIds,
  shouldShowEmpty,
  buildColumnData,
  getProductAttribute,
  COMPARE_ATTRIBUTES,
  buildAttributeRows,
  isDiff,
  buildCompareTitle,
  buildCompareDescription,
  buildItemListSchema,
  buildMobileSnapCss,
  buildDotIndicatorData,
  removeProductFromCompare,
  buildCompareUrl,
} from '../../src/public/comparePageHelpers.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-001',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    price: 499,
    formattedPrice: '$499.00',
    compareAtPrice: null,
    mainMedia: 'https://example.com/eureka.jpg',
    ribbon: '',
    inStock: true,
    numericRating: 4.5,
    additionalInfoSections: [
      { title: 'Frame Material', description: 'Solid hardwood' },
      { title: 'Closed Dimensions', description: '54" W × 38" D × 33" H' },
      { title: 'Open Dimensions', description: '54" W × 74" L' },
      { title: 'Weight Capacity', description: '600 lbs' },
      { title: 'Mattress Size', description: 'Full' },
      { title: 'Seat Height', description: '17"' },
      { title: 'Available Fabrics', description: '12' },
    ],
    ...overrides,
  };
}

function makeProductB(overrides = {}) {
  return makeProduct({
    _id: 'prod-002',
    name: 'Dillon Wall Hugger Frame',
    slug: 'dillon-wall-hugger-frame',
    price: 699,
    formattedPrice: '$699.00',
    ribbon: 'Featured',
    additionalInfoSections: [
      { title: 'Frame Material', description: 'Engineered hardwood' },
      { title: 'Closed Dimensions', description: '54" W × 10" D × 34" H' },
      { title: 'Open Dimensions', description: '54" W × 74" L' },
      { title: 'Weight Capacity', description: '500 lbs' },
      { title: 'Mattress Size', description: 'Full' },
      { title: 'Seat Height', description: '18"' },
      { title: 'Available Fabrics', description: '8' },
    ],
    ...overrides,
  });
}

// ── Story 1: URL param parsing + product fetch ────────────────────────────────

describe('S1 — parseProductIds', () => {
  it('splits comma-separated IDs from query object', () => {
    expect(parseProductIds({ ids: 'a,b,c' })).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when ids param is missing', () => {
    expect(parseProductIds({})).toEqual([]);
  });

  it('returns empty array when ids is empty string', () => {
    expect(parseProductIds({ ids: '' })).toEqual([]);
  });

  it('caps at 4 IDs when more are provided', () => {
    const result = parseProductIds({ ids: 'a,b,c,d,e,f' });
    expect(result).toHaveLength(4);
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles exactly 4 IDs', () => {
    expect(parseProductIds({ ids: 'a,b,c,d' })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles exactly 2 IDs', () => {
    expect(parseProductIds({ ids: 'x,y' })).toEqual(['x', 'y']);
  });

  it('trims whitespace around IDs', () => {
    expect(parseProductIds({ ids: ' a , b , c ' })).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty segments from double commas', () => {
    const result = parseProductIds({ ids: 'a,,b' });
    expect(result).toEqual(['a', 'b']);
  });

  it('handles null ids param gracefully', () => {
    expect(parseProductIds({ ids: null })).toEqual([]);
  });
});

describe('S1 — shouldShowEmpty', () => {
  it('returns true for empty array', () => {
    expect(shouldShowEmpty([])).toBe(true);
  });

  it('returns true for single ID (minimum is 2)', () => {
    expect(shouldShowEmpty(['a'])).toBe(true);
  });

  it('returns false for 2 IDs', () => {
    expect(shouldShowEmpty(['a', 'b'])).toBe(false);
  });

  it('returns false for 3 IDs', () => {
    expect(shouldShowEmpty(['a', 'b', 'c'])).toBe(false);
  });

  it('returns false for 4 IDs', () => {
    expect(shouldShowEmpty(['a', 'b', 'c', 'd'])).toBe(false);
  });
});

// ── Story 2: Column rendering ─────────────────────────────────────────────────

describe('S2 — buildColumnData', () => {
  it('returns one item per product', () => {
    const products = [makeProduct(), makeProductB()];
    const cols = buildColumnData(products);
    expect(cols).toHaveLength(2);
  });

  it('each column item has _id, name, price, image, slug', () => {
    const product = makeProduct();
    const [col] = buildColumnData([product, makeProductB()]);
    expect(col._id).toBe('prod-001');
    expect(col.name).toBe('Eureka Futon Frame');
    expect(col.price).toBe('$499.00');
    expect(col.image).toBe('https://example.com/eureka.jpg');
    expect(col.slug).toBe('eureka-futon-frame');
  });

  it('showOrigPrice is false when product has no compareAtPrice', () => {
    const [col] = buildColumnData([makeProduct({ compareAtPrice: null }), makeProductB()]);
    expect(col.showOrigPrice).toBe(false);
  });

  it('showOrigPrice is false when compareAtPrice equals price', () => {
    const [col] = buildColumnData([makeProduct({ compareAtPrice: 499 }), makeProductB()]);
    expect(col.showOrigPrice).toBe(false);
  });

  it('showOrigPrice is true when compareAtPrice is greater than price', () => {
    const [col] = buildColumnData([makeProduct({ price: 399, compareAtPrice: 499 }), makeProductB()]);
    expect(col.showOrigPrice).toBe(true);
  });

  it('includes origPrice formatted when sale is active', () => {
    const [col] = buildColumnData([makeProduct({ price: 399, compareAtPrice: 499 }), makeProductB()]);
    expect(col.origPrice).toBe('$499.00');
    expect(col.salePrice).toBe('$399.00');
  });

  it('showBadge is false when ribbon is empty string', () => {
    const [col] = buildColumnData([makeProduct({ ribbon: '' }), makeProductB()]);
    expect(col.showBadge).toBe(false);
  });

  it('showBadge is true when ribbon is set', () => {
    const cols = buildColumnData([makeProduct(), makeProductB({ ribbon: 'Sale' })]);
    expect(cols[1].showBadge).toBe(true);
    expect(cols[1].badge).toBe('Sale');
  });

  it('inStock flag is passed through', () => {
    const cols = buildColumnData([
      makeProduct({ inStock: true }),
      makeProductB({ inStock: false }),
    ]);
    expect(cols[0].inStock).toBe(true);
    expect(cols[1].inStock).toBe(false);
  });

  it('product page URL is /product-page/{slug}', () => {
    const [col] = buildColumnData([makeProduct(), makeProductB()]);
    expect(col.productUrl).toBe('/product-page/eureka-futon-frame');
  });
});

// ── Story 3: Attributes table ─────────────────────────────────────────────────

describe('S3 — getProductAttribute', () => {
  const product = makeProduct();

  it('returns value for matching attribute title (case-insensitive)', () => {
    expect(getProductAttribute(product, 'Frame Material')).toBe('Solid hardwood');
  });

  it('returns "—" when attribute is not found', () => {
    expect(getProductAttribute(product, 'Nonexistent Attr')).toBe('—');
  });

  it('returns price as formatted string for Price attribute', () => {
    expect(getProductAttribute(product, 'Price')).toBe('$499.00');
  });

  it('returns formatted rating for Rating attribute', () => {
    expect(getProductAttribute(product, 'Rating')).toBe('4.5 / 5');
  });

  it('returns "—" for Rating when numericRating is null', () => {
    const p = makeProduct({ numericRating: null });
    expect(getProductAttribute(p, 'Rating')).toBe('—');
  });

  it('returns "In Stock" when product is in stock', () => {
    expect(getProductAttribute(product, 'In Stock')).toBe('In Stock');
  });

  it('returns "Out of Stock" when product is not in stock', () => {
    const p = makeProduct({ inStock: false });
    expect(getProductAttribute(p, 'In Stock')).toBe('Out of Stock');
  });
});

describe('S3 — COMPARE_ATTRIBUTES', () => {
  it('contains exactly 9 attributes', () => {
    expect(COMPARE_ATTRIBUTES).toHaveLength(9);
  });

  it('includes all required attribute names', () => {
    const names = COMPARE_ATTRIBUTES.map(a => a.label);
    expect(names).toContain('Frame Material');
    expect(names).toContain('Closed Dimensions');
    expect(names).toContain('Open Dimensions');
    expect(names).toContain('Weight Capacity');
    expect(names).toContain('Mattress Size');
    expect(names).toContain('Seat Height');
    expect(names).toContain('Price');
    expect(names).toContain('Rating');
    expect(names).toContain('In Stock');
  });

  it('each attribute has a label and key', () => {
    for (const attr of COMPARE_ATTRIBUTES) {
      expect(attr.label).toBeTruthy();
      expect(attr.key).toBeTruthy();
    }
  });
});

describe('S3 — isDiff', () => {
  it('returns false when all values are the same', () => {
    expect(isDiff(['Full', 'Full', 'Full'])).toBe(false);
  });

  it('returns true when any value differs', () => {
    expect(isDiff(['Full', 'Full', 'Queen'])).toBe(true);
  });

  it('returns true when exactly two values differ', () => {
    expect(isDiff(['In Stock', 'Out of Stock'])).toBe(true);
  });

  it('returns false for single value (no comparison possible)', () => {
    expect(isDiff(['Full'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isDiff([])).toBe(false);
  });

  it('treats "—" as a real value when comparing', () => {
    expect(isDiff(['—', 'Full'])).toBe(true);
  });

  it('returns false when all values are "—"', () => {
    expect(isDiff(['—', '—'])).toBe(false);
  });
});

describe('S3 — buildAttributeRows', () => {
  const productA = makeProduct();
  const productB = makeProductB();

  it('returns one row per COMPARE_ATTRIBUTES entry', () => {
    const rows = buildAttributeRows([productA, productB]);
    expect(rows).toHaveLength(COMPARE_ATTRIBUTES.length);
  });

  it('each row has _id, label, values array, and hasDiff flag', () => {
    const rows = buildAttributeRows([productA, productB]);
    for (const row of rows) {
      expect(row._id).toBeTruthy();
      expect(row.label).toBeTruthy();
      expect(Array.isArray(row.values)).toBe(true);
      expect(typeof row.hasDiff).toBe('boolean');
    }
  });

  it('values array has one entry per product', () => {
    const rows = buildAttributeRows([productA, productB]);
    for (const row of rows) {
      expect(row.values).toHaveLength(2);
    }
  });

  it('hasDiff is true for Frame Material row (values differ)', () => {
    const rows = buildAttributeRows([productA, productB]);
    const frameMaterialRow = rows.find(r => r.label === 'Frame Material');
    expect(frameMaterialRow.hasDiff).toBe(true);
    expect(frameMaterialRow.values).toContain('Solid hardwood');
    expect(frameMaterialRow.values).toContain('Engineered hardwood');
  });

  it('hasDiff is false for Open Dimensions row (values same)', () => {
    const rows = buildAttributeRows([productA, productB]);
    const openDimsRow = rows.find(r => r.label === 'Open Dimensions');
    expect(openDimsRow.hasDiff).toBe(false);
  });

  it('hasDiff is true for Price row (prices differ)', () => {
    const rows = buildAttributeRows([productA, productB]);
    const priceRow = rows.find(r => r.label === 'Price');
    expect(priceRow.hasDiff).toBe(true);
  });

  it('In Stock row shows correct values', () => {
    const outOfStockProduct = makeProduct({ inStock: false });
    const rows = buildAttributeRows([outOfStockProduct, productB]);
    const stockRow = rows.find(r => r.label === 'In Stock');
    expect(stockRow.values[0]).toBe('Out of Stock');
    expect(stockRow.values[1]).toBe('In Stock');
    expect(stockRow.hasDiff).toBe(true);
  });

  it('works for 3 products', () => {
    const productC = makeProduct({
      _id: 'prod-003',
      name: 'Cloud Nine Frame',
      additionalInfoSections: [
        { title: 'Frame Material', description: 'Solid hardwood' },
        { title: 'Mattress Size', description: 'Queen' },
      ],
    });
    const rows = buildAttributeRows([productA, productB, productC]);
    expect(rows[0].values).toHaveLength(3);
  });

  it('uses "—" for attributes not present on a product', () => {
    const sparseProduct = makeProduct({
      additionalInfoSections: [
        { title: 'Frame Material', description: 'Metal' },
      ],
    });
    const rows = buildAttributeRows([sparseProduct, productB]);
    const closedDimsRow = rows.find(r => r.label === 'Closed Dimensions');
    expect(closedDimsRow.values[0]).toBe('—');
  });
});

// ── Story 4: Mobile responsive ────────────────────────────────────────────────

describe('S4 — buildMobileSnapCss', () => {
  it('returns a non-empty CSS string', () => {
    const css = buildMobileSnapCss();
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  it('includes scroll-snap-type declaration', () => {
    expect(buildMobileSnapCss()).toContain('scroll-snap-type');
  });

  it('includes mandatory snap mode', () => {
    expect(buildMobileSnapCss()).toContain('mandatory');
  });

  it('includes snap-align for child elements', () => {
    expect(buildMobileSnapCss()).toContain('scroll-snap-align');
  });
});

describe('S4 — buildDotIndicatorData', () => {
  it('returns one dot per product count', () => {
    expect(buildDotIndicatorData(3, 0)).toHaveLength(3);
  });

  it('active dot is marked correctly', () => {
    const dots = buildDotIndicatorData(4, 2);
    expect(dots[2].active).toBe(true);
    expect(dots[0].active).toBe(false);
    expect(dots[3].active).toBe(false);
  });

  it('each dot has _id and active flag', () => {
    for (const dot of buildDotIndicatorData(2, 0)) {
      expect(dot._id).toBeTruthy();
      expect(typeof dot.active).toBe('boolean');
    }
  });

  it('returns empty array for count 0', () => {
    expect(buildDotIndicatorData(0, 0)).toEqual([]);
  });
});

// ── Story 5: SEO + schema ─────────────────────────────────────────────────────

describe('S5 — buildCompareTitle', () => {
  it('formats "A vs B | Carolina Futons" for 2 products', () => {
    const products = [makeProduct(), makeProductB()];
    expect(buildCompareTitle(products)).toBe(
      'Compare Eureka Futon Frame vs Dillon Wall Hugger Frame | Carolina Futons'
    );
  });

  it('formats "A vs B vs C | Carolina Futons" for 3 products', () => {
    const productC = makeProduct({ _id: 'c', name: 'Cloud Nine Frame' });
    const products = [makeProduct(), makeProductB(), productC];
    expect(buildCompareTitle(products)).toBe(
      'Compare Eureka Futon Frame vs Dillon Wall Hugger Frame vs Cloud Nine Frame | Carolina Futons'
    );
  });

  it('handles single product gracefully (edge case)', () => {
    const title = buildCompareTitle([makeProduct()]);
    expect(title).toContain('Carolina Futons');
    expect(title).toContain('Eureka Futon Frame');
  });
});

describe('S5 — buildCompareDescription', () => {
  it('mentions product names in description', () => {
    const products = [makeProduct(), makeProductB()];
    const desc = buildCompareDescription(products);
    expect(desc).toContain('Eureka Futon Frame');
    expect(desc).toContain('Dillon Wall Hugger Frame');
  });

  it('mentions key comparison topics', () => {
    const desc = buildCompareDescription([makeProduct(), makeProductB()]);
    expect(desc.toLowerCase()).toMatch(/dimension|material|pricing|price/);
  });

  it('is under 160 characters for SEO', () => {
    const products = [makeProduct(), makeProductB()];
    expect(buildCompareDescription(products).length).toBeLessThanOrEqual(160);
  });
});

describe('S5 — buildItemListSchema', () => {
  const BASE_URL = 'https://www.carolinafutons.com';

  it('returns object with @context and @type ItemList', () => {
    const schema = buildItemListSchema([makeProduct(), makeProductB()], BASE_URL);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('ItemList');
  });

  it('itemListElement has one entry per product', () => {
    const schema = buildItemListSchema([makeProduct(), makeProductB()], BASE_URL);
    expect(schema.itemListElement).toHaveLength(2);
  });

  it('each element has position, @type, and url', () => {
    const schema = buildItemListSchema([makeProduct(), makeProductB()], BASE_URL);
    for (const [i, el] of schema.itemListElement.entries()) {
      expect(el.position).toBe(i + 1);
      expect(el['@type']).toBe('ListItem');
      expect(el.url).toContain(BASE_URL);
      expect(el.url).toContain(el.item?.slug ?? makeProduct().slug);
    }
  });

  it('each item includes name and url', () => {
    const schema = buildItemListSchema([makeProduct(), makeProductB()], BASE_URL);
    const first = schema.itemListElement[0];
    expect(first.item?.name ?? first.name).toBeTruthy();
    expect(first.url).toContain('/product-page/');
  });

  it('serializes to valid JSON', () => {
    const schema = buildItemListSchema([makeProduct(), makeProductB()], BASE_URL);
    const json = JSON.stringify(schema);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ── Story 6: Start Over + back-navigation ─────────────────────────────────────

describe('S6 — removeProductFromCompare', () => {
  it('removes the specified product ID from the list', () => {
    const result = removeProductFromCompare(['a', 'b', 'c'], 'b');
    expect(result).toEqual(['a', 'c']);
  });

  it('returns original array when ID not found', () => {
    const result = removeProductFromCompare(['a', 'b'], 'z');
    expect(result).toEqual(['a', 'b']);
  });

  it('handles single-item array (removing leaves empty)', () => {
    expect(removeProductFromCompare(['a'], 'a')).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c'];
    removeProductFromCompare(original, 'a');
    expect(original).toHaveLength(3);
  });
});

describe('S6 — buildCompareUrl', () => {
  it('builds URL with comma-joined IDs', () => {
    expect(buildCompareUrl(['a', 'b', 'c'])).toBe('/compare?ids=a,b,c');
  });

  it('builds URL for 2 products', () => {
    expect(buildCompareUrl(['x', 'y'])).toBe('/compare?ids=x,y');
  });

  it('returns /compare with empty ids param for empty array', () => {
    const url = buildCompareUrl([]);
    expect(url).toContain('/compare');
  });
});
