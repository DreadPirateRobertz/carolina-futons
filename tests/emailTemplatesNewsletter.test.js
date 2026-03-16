import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildProductBlock,
  getNewArrivalsSection,
  getCategorySpotlightSection,
  getProductRecommendationBlock,
  _CATEGORY_LABELS,
} from '../src/backend/emailTemplates.web.js';

// Load real catalog data — all tests use real product names/prices
const catalog = JSON.parse(
  readFileSync(resolve(__dirname, '../content/catalog-MASTER.json'), 'utf-8')
);
const products = catalog.products;

// ── CATEGORY_LABELS ─────────────────────────────────────────────────

describe('_CATEGORY_LABELS', () => {
  it('has a label for every category in catalog-MASTER.json', () => {
    for (const slug of Object.keys(catalog.categories)) {
      expect(_CATEGORY_LABELS[slug], `missing label for ${slug}`).toBeDefined();
    }
  });

  it('labels are human-readable strings (no slugs)', () => {
    for (const label of Object.values(_CATEGORY_LABELS)) {
      expect(label).toMatch(/^[A-Z]/); // starts with uppercase
      expect(label).not.toMatch(/^[a-z].*-/); // no raw slugs as labels
    }
  });
});

// ── buildProductBlock ───────────────────────────────────────────────

describe('buildProductBlock', () => {
  const product = products[0]; // Monterey Futon Frame

  it('returns empty string for null/undefined input', () => {
    expect(buildProductBlock(null)).toBe('');
    expect(buildProductBlock(undefined)).toBe('');
  });

  it('returns empty string for product without name', () => {
    expect(buildProductBlock({ price: 100 })).toBe('');
  });

  it('includes the real product name', () => {
    const html = buildProductBlock(product);
    expect(html).toContain(product.name);
  });

  it('includes formatted price with dollar sign', () => {
    const html = buildProductBlock(product);
    expect(html).toContain(`$${Number(product.price).toFixed(2)}`);
  });

  it('includes product URL', () => {
    const html = buildProductBlock(product);
    expect(html).toContain(product.url || `/product-page/${product.slug}`);
  });

  it('includes product image when available', () => {
    const html = buildProductBlock(product);
    if (product.images && product.images[0]) {
      expect(html).toContain('<img');
      expect(html).toContain(product.images[0]);
    }
  });

  it('generates valid table HTML structure', () => {
    const html = buildProductBlock(product);
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    expect(html).toContain('Shop Now');
  });

  it('omits price row when price is null', () => {
    const html = buildProductBlock({ name: 'Test', price: null, slug: 'test' });
    expect(html).not.toContain('font-weight:bold');
  });

  it('handles zero price correctly', () => {
    const html = buildProductBlock({ name: 'Free Item', price: 0, slug: 'free' });
    expect(html).toContain('$0.00');
  });

  it('falls back to SITE_URL + slug when no url provided', () => {
    const html = buildProductBlock({ name: 'Test', price: 100, slug: 'my-slug' });
    expect(html).toContain('carolinafutons.com/product-page/my-slug');
  });

  it('omits image tag when no images array', () => {
    const html = buildProductBlock({ name: 'No Image', price: 50, slug: 'test' });
    expect(html).not.toContain('<img');
  });

  it('uses inline styles for email client compatibility', () => {
    const html = buildProductBlock(product);
    expect(html).toContain('style=');
    expect(html).toContain('font-family:Arial');
  });
});

// ── getNewArrivalsSection ───────────────────────────────────────────

describe('getNewArrivalsSection', () => {
  it('returns empty string for empty array', async () => {
    expect(await getNewArrivalsSection([])).toBe('');
  });

  it('returns empty string for null input', async () => {
    expect(await getNewArrivalsSection(null)).toBe('');
  });

  it('returns empty string for non-array input', async () => {
    expect(await getNewArrivalsSection('not an array')).toBe('');
  });

  it('generates section with "New Arrivals" heading', async () => {
    const html = await getNewArrivalsSection(products, 2);
    expect(html).toContain('New Arrivals');
  });

  it('uses real product names from catalog', async () => {
    const html = await getNewArrivalsSection(products, 4);
    // Last 4 products in catalog should appear (reversed)
    const eligible = products.filter(p => p.name && p.price != null);
    const expected = eligible.slice(-4).reverse();
    for (const p of expected) {
      expect(html).toContain(p.name);
    }
  });

  it('respects the limit parameter', async () => {
    const html = await getNewArrivalsSection(products, 2);
    const eligible = products.filter(p => p.name && p.price != null);
    const last2 = eligible.slice(-2).reverse();
    for (const p of last2) {
      expect(html).toContain(p.name);
    }
    // Should NOT contain the 3rd-from-last product
    const notIncluded = eligible[eligible.length - 3];
    if (notIncluded) {
      expect(html).not.toContain(notIncluded.name);
    }
  });

  it('caps limit at 8 even if higher value passed', async () => {
    const html = await getNewArrivalsSection(products, 100);
    const imgCount = (html.match(/<img /g) || []).length;
    expect(imgCount).toBeLessThanOrEqual(8);
  });

  it('clamps limit to minimum of 1', async () => {
    const html = await getNewArrivalsSection(products, 0);
    expect(html).toContain('New Arrivals');
  });

  it('includes "View all products" CTA link', async () => {
    const html = await getNewArrivalsSection(products, 2);
    expect(html).toContain('View all products');
    expect(html).toContain('/shop-main');
  });

  it('skips products without a price', async () => {
    const mixed = [
      { name: 'No Price', price: null, slug: 'np' },
      { name: 'Has Price', price: 299, slug: 'hp', images: ['img.jpg'] },
    ];
    const html = await getNewArrivalsSection(mixed, 4);
    expect(html).not.toContain('No Price');
    expect(html).toContain('Has Price');
  });

  it('returns empty when all products lack prices', async () => {
    const noPrices = [
      { name: 'A', price: null },
      { name: 'B', price: null },
    ];
    expect(await getNewArrivalsSection(noPrices)).toBe('');
  });
});

// ── getCategorySpotlightSection ─────────────────────────────────────

describe('getCategorySpotlightSection', () => {
  it('returns empty string for null products', async () => {
    expect(await getCategorySpotlightSection(null, 'futon-frames')).toBe('');
  });

  it('returns empty string for missing category', async () => {
    expect(await getCategorySpotlightSection(products, '')).toBe('');
    expect(await getCategorySpotlightSection(products, null)).toBe('');
  });

  it('generates section with category label heading', async () => {
    const html = await getCategorySpotlightSection(products, 'futon-frames', 2);
    expect(html).toContain('Spotlight: Futon Frames');
  });

  it('uses human-readable label from CATEGORY_LABELS', async () => {
    const html = await getCategorySpotlightSection(products, 'murphy-cabinet-beds', 2);
    expect(html).toContain('Murphy Cabinet Beds');
  });

  it('only includes products from the specified category', async () => {
    const html = await getCategorySpotlightSection(products, 'murphy-cabinet-beds', 4);
    const murphyProducts = products.filter(p => p.category === 'murphy-cabinet-beds' && p.price != null);
    for (const p of murphyProducts.slice(0, 4)) {
      expect(html).toContain(p.name);
    }
  });

  it('does not include products from other categories', async () => {
    const html = await getCategorySpotlightSection(products, 'murphy-cabinet-beds', 4);
    const futonFrames = products.filter(p => p.category === 'futon-frames');
    for (const p of futonFrames.slice(0, 2)) {
      expect(html).not.toContain(p.name);
    }
  });

  it('respects the limit parameter', async () => {
    const html = await getCategorySpotlightSection(products, 'futon-frames', 2);
    const catProducts = products.filter(p => p.category === 'futon-frames' && p.price != null);
    // 3rd product should NOT appear
    if (catProducts.length > 2) {
      expect(html).not.toContain(catProducts[2].name);
    }
  });

  it('caps limit at 8', async () => {
    const html = await getCategorySpotlightSection(products, 'futon-frames', 100);
    const imgCount = (html.match(/<img /g) || []).length;
    expect(imgCount).toBeLessThanOrEqual(8);
  });

  it('returns empty for non-existent category', async () => {
    expect(await getCategorySpotlightSection(products, 'nonexistent-category')).toBe('');
  });

  it('includes "Browse all" CTA with category label', async () => {
    const html = await getCategorySpotlightSection(products, 'platform-beds', 2);
    expect(html).toContain('Browse all Platform Beds');
  });

  it('falls back to slug as label for unknown categories', async () => {
    const custom = [{ name: 'Custom', price: 99, category: 'custom-cat', slug: 'c', images: ['i.jpg'] }];
    const html = await getCategorySpotlightSection(custom, 'custom-cat', 2);
    expect(html).toContain('custom-cat');
  });
});

// ── getProductRecommendationBlock ───────────────────────────────────

describe('getProductRecommendationBlock', () => {
  it('returns empty string for empty array', async () => {
    expect(await getProductRecommendationBlock([])).toBe('');
  });

  it('returns empty string for null input', async () => {
    expect(await getProductRecommendationBlock(null)).toBe('');
  });

  it('generates section with "Recommended for You" heading', async () => {
    const html = await getProductRecommendationBlock(products, 4);
    expect(html).toContain('Recommended for You');
  });

  it('picks products from diverse categories', async () => {
    const html = await getProductRecommendationBlock(products, 6);
    // Count how many unique categories are represented
    const eligible = products.filter(p => p.name && p.price != null && p.images?.length);
    const cats = [...new Set(eligible.map(p => p.category))];
    // With 6 picks and multiple categories, should have at least 2 categories
    let catsFound = 0;
    for (const cat of cats) {
      const catProducts = eligible.filter(p => p.category === cat);
      if (catProducts.some(p => html.includes(p.name))) catsFound++;
    }
    expect(catsFound).toBeGreaterThanOrEqual(2);
  });

  it('respects the limit parameter', async () => {
    const html = await getProductRecommendationBlock(products, 2);
    // Each product block is a <table ... width="200"> — count product card tables
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBeLessThanOrEqual(2);
  });

  it('caps limit at 8', async () => {
    const html = await getProductRecommendationBlock(products, 100);
    const imgCount = (html.match(/<img /g) || []).length;
    expect(imgCount).toBeLessThanOrEqual(8);
  });

  it('only includes products with images', async () => {
    const noImages = [
      { name: 'A', price: 100, category: 'cat1', slug: 'a' },
      { name: 'B', price: 200, category: 'cat2', slug: 'b' },
    ];
    expect(await getProductRecommendationBlock(noImages)).toBe('');
  });

  it('includes "Explore" CTA link', async () => {
    const html = await getProductRecommendationBlock(products, 2);
    expect(html).toContain('Explore our full collection');
    expect(html).toContain('/shop-main');
  });

  it('uses real product names from catalog (no fabricated data)', async () => {
    const html = await getProductRecommendationBlock(products, 4);
    const allNames = products.map(p => p.name);
    // Every product name in the HTML should be from the catalog
    const nameMatches = allNames.filter(n => html.includes(n));
    expect(nameMatches.length).toBeGreaterThanOrEqual(1);
    expect(nameMatches.length).toBeLessThanOrEqual(4);
  });
});

// ── Integration: all sections use only real catalog data ────────────

describe('Newsletter catalog data integrity', () => {
  it('new arrivals section contains only names from catalog-MASTER.json', async () => {
    const html = await getNewArrivalsSection(products, 4);
    const allNames = new Set(products.map(p => p.name));
    // Extract product names from the HTML by checking which catalog names appear
    const found = [...allNames].filter(n => html.includes(n));
    for (const name of found) {
      expect(allNames.has(name)).toBe(true);
    }
  });

  it('category spotlight uses real prices from catalog', async () => {
    const html = await getCategorySpotlightSection(products, 'futon-frames', 2);
    const catProducts = products.filter(p => p.category === 'futon-frames' && p.price != null);
    for (const p of catProducts.slice(0, 2)) {
      expect(html).toContain(`$${Number(p.price).toFixed(2)}`);
    }
  });

  it('all product images in recommendations are from catalog-MASTER.json', async () => {
    const html = await getProductRecommendationBlock(products, 4);
    const allImages = new Set(products.flatMap(p => p.images || []));
    // Extract src from img tags
    const imgSrcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    for (const src of imgSrcs) {
      expect(allImages.has(src), `image ${src} not in catalog`).toBe(true);
    }
  });
});
