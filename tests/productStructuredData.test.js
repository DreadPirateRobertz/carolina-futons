/**
 * productStructuredData.test.js
 * CF-06xu — Product page JSON-LD structured data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProductStructuredData } from '../src/public/productStructuredData.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl() {
  return {
    _html: '',
    set html(val) { this._html = val; },
    get html() { return this._html; },
    postMessage: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#productJsonLd': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Monterey Full Futon Frame',
    description: 'Solid hardwood futon frame with easy conversion.',
    slug: 'monterey-full-futon-frame',
    sku: 'MFF-001',
    price: 499.99,
    discountedPrice: null,
    inStock: true,
    mainMedia: 'https://example.com/images/monterey.jpg',
    additionalMedia: ['https://example.com/images/monterey-2.jpg'],
    ...overrides,
  };
}

function makeReviews(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    authorName: `Reviewer ${i + 1}`,
    rating: 5 - i,             // 5, 4, 3
    body: `Great product ${i + 1}`,
    _createdDate: `2026-03-${String(20 - i).padStart(2, '0')}`,
  }));
}

function makeStructuredData(product, reviews = [], aggregate = null) {
  return {
    product,
    reviews,
    aggregate: aggregate ?? {
      average: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
      total: reviews.length,
    },
  };
}

function makeOpts($w, product, reviews = [], aggregate = null) {
  return {
    $w,
    getProductStructuredData: vi.fn().mockResolvedValue(
      makeStructuredData(product, reviews, aggregate),
    ),
  };
}

// ── Valid JSON-LD output ──────────────────────────────────────────────────────

describe('initProductStructuredData — valid JSON-LD', () => {
  let $w;
  const product = makeProduct();
  const reviews = makeReviews(3);

  beforeEach(() => { $w = make$w(); });

  it('injects valid JSON into #productJsonLd', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const html = $w('#productJsonLd')._html;
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('</script>');
    // Should be valid JSON between the script tags
    const json = html.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('generates schema.org/Product type', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('Product');
  });

  it('includes product name', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.name).toBe('Monterey Full Futon Frame');
  });

  it('includes product description', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.description).toBe('Solid hardwood futon frame with easy conversion.');
  });

  it('includes product image', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.image).toBe('https://example.com/images/monterey.jpg');
  });

  it('includes product sku', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.sku).toBe('MFF-001');
  });

  it('includes brand as Carolina Futons', async () => {
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.brand).toEqual({ '@type': 'Brand', name: 'Carolina Futons' });
  });
});

// ── Offers ────────────────────────────────────────────────────────────────────

describe('initProductStructuredData — offers', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('includes offers with price in USD', async () => {
    const product = makeProduct({ price: 499.99 });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers).toMatchObject({
      '@type': 'Offer',
      price: '499.99',
      priceCurrency: 'USD',
    });
  });

  it('sets availability to InStock when inStock is true', async () => {
    const product = makeProduct({ inStock: true });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.availability).toBe('https://schema.org/InStock');
  });

  it('sets availability to OutOfStock when inStock is false', async () => {
    const product = makeProduct({ inStock: false });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('formats price as string with two decimal places', async () => {
    const product = makeProduct({ price: 100 });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.price).toBe('100.00');
  });

  it('includes product url in offers', async () => {
    const product = makeProduct({ slug: 'monterey-full-futon-frame' });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.url).toContain('monterey-full-futon-frame');
  });
});

// ── aggregateRating ───────────────────────────────────────────────────────────

describe('initProductStructuredData — aggregateRating', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('includes aggregateRating when reviews exist', async () => {
    const product = makeProduct();
    const reviews = makeReviews(3);
    const aggregate = { average: 4, total: 3 };
    const opts = makeOpts($w, product, reviews, aggregate);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: '4.0',
      reviewCount: 3,
    });
  });

  it('omits aggregateRating when zero reviews', async () => {
    const product = makeProduct();
    const opts = makeOpts($w, product, [], { average: 0, total: 0 });
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.aggregateRating).toBeUndefined();
  });

  it('formats ratingValue with one decimal place', async () => {
    const product = makeProduct();
    const aggregate = { average: 4.333, total: 6 };
    const opts = makeOpts($w, product, makeReviews(3), aggregate);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.aggregateRating.ratingValue).toBe('4.3');
  });
});

// ── Reviews in schema ─────────────────────────────────────────────────────────

describe('initProductStructuredData — reviews', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('includes first 3 reviews as schema.org/Review', async () => {
    const product = makeProduct();
    const reviews = makeReviews(5);  // 5 reviews, should only take first 3
    const opts = makeOpts($w, product, reviews.slice(0, 3));
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.review).toHaveLength(3);
    expect(json.review[0]['@type']).toBe('Review');
  });

  it('formats review author as schema.org/Person', async () => {
    const product = makeProduct();
    const reviews = [{ authorName: 'Jane', rating: 5, body: 'Love it', _createdDate: '2026-03-20' }];
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.review[0].author).toEqual({ '@type': 'Person', name: 'Jane' });
  });

  it('includes review rating as schema.org/Rating', async () => {
    const product = makeProduct();
    const reviews = [{ authorName: 'Jane', rating: 4, body: 'Nice', _createdDate: '2026-03-20' }];
    const opts = makeOpts($w, product, reviews);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.review[0].reviewRating).toMatchObject({
      '@type': 'Rating',
      ratingValue: '4',
      bestRating: '5',
    });
  });

  it('omits review array when no reviews', async () => {
    const product = makeProduct();
    const opts = makeOpts($w, product, [], { average: 0, total: 0 });
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.review).toBeUndefined();
  });
});

// ── Missing fields / edge cases ───────────────────────────────────────────────

describe('initProductStructuredData — edge cases', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('handles missing description gracefully', async () => {
    const product = makeProduct({ description: undefined });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.description).toBe('');
  });

  it('handles missing sku gracefully', async () => {
    const product = makeProduct({ sku: undefined });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.sku).toBe('');
  });

  it('handles missing price gracefully', async () => {
    const product = makeProduct({ price: undefined });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.price).toBe('0.00');
  });

  it('does not throw when getProductStructuredData rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const opts = {
      $w,
      getProductStructuredData: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    await expect(initProductStructuredData('prod-1', opts)).resolves.not.toThrow();
  });

  it('logs error when getProductStructuredData rejects', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const opts = {
      $w,
      getProductStructuredData: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    await initProductStructuredData('prod-1', opts);
    expect(spy).toHaveBeenCalledWith(
      '[productStructuredData] Failed to fetch structured data',
      expect.any(Error),
    );
  });

  it('does not inject when getProductStructuredData rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const opts = {
      $w,
      getProductStructuredData: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    await initProductStructuredData('prod-1', opts);
    expect($w('#productJsonLd')._html).toBe('');
  });

  it('escapes </script> sequences to prevent XSS in JSON-LD', async () => {
    const product = makeProduct({ name: 'Futon</script><script>alert(1)</script>' });
    const opts = makeOpts($w, product, []);
    await initProductStructuredData('prod-1', opts);
    const html = $w('#productJsonLd')._html;
    expect(html).not.toContain('</script><script>');
    expect(html.match(/<\/script>/g)).toHaveLength(1); // only the closing tag
  });

  it('uses discountedPrice when available', async () => {
    const product = makeProduct({ price: 499.99, discountedPrice: 399.99 });
    const data = makeStructuredData(product, []);
    // Backend maps discountedPrice ?? price, so simulate that
    data.product.price = 399.99;
    const opts = {
      $w,
      getProductStructuredData: vi.fn().mockResolvedValue(data),
    };
    await initProductStructuredData('prod-1', opts);
    const json = extractJsonLd($w);
    expect(json.offers.price).toBe('399.99');
  });

  it('logs error when $w element throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing$w = () => { throw new Error('Element not found'); };
    const opts = {
      $w: throwing$w,
      getProductStructuredData: vi.fn().mockResolvedValue(
        makeStructuredData(makeProduct(), []),
      ),
    };
    await initProductStructuredData('prod-1', opts);
    expect(spy).toHaveBeenCalledWith(
      '[productStructuredData] Failed to inject JSON-LD into #productJsonLd',
      expect.any(Error),
    );
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────

function extractJsonLd($w) {
  const html = $w('#productJsonLd')._html;
  const json = html.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
  return JSON.parse(json);
}
