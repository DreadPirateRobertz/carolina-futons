/**
 * @file newsletterCatalogDriven.test.js
 * @description Tests for catalog-driven newsletter template generation:
 * - Price Drop section generation
 * - Back in Stock section generation
 * - Full HTML email template assembly (New Arrivals, Price Drop, Back in Stock)
 * Uses real catalog-MASTER.json data throughout.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getNewArrivalsSection,
  getPriceDropSection,
  getBackInStockSection,
  generateNewArrivalsEmail,
  generatePriceDropEmail,
  generateBackInStockEmail,
  _CATEGORY_LABELS,
} from '../src/backend/emailTemplates.web.js';

// Load real catalog data
const catalog = JSON.parse(
  readFileSync(resolve(__dirname, '../content/catalog-MASTER.json'), 'utf-8')
);
const products = catalog.products;

// Helper: build products with previous prices for price-drop testing
function makePriceDropProducts(count = 4) {
  return products
    .filter(p => p.name && p.price != null)
    .slice(0, count)
    .map(p => ({
      ...p,
      previousPrice: p.price * 1.25, // previousPrice is 25% above current, yielding a 20% savings
    }));
}

// Helper: build back-in-stock products
function makeBackInStockProducts(count = 4) {
  return products
    .filter(p => p.name && p.price != null)
    .slice(0, count)
    .map(p => ({
      ...p,
      availability: 'InStock',
      restockedAt: new Date().toISOString(),
    }));
}

// ── getPriceDropSection ──────────────────────────────────────────────

describe('getPriceDropSection', () => {
  it('returns empty string for empty array', async () => {
    expect(await getPriceDropSection([])).toBe('');
  });

  it('returns empty string for null input', async () => {
    expect(await getPriceDropSection(null)).toBe('');
  });

  it('returns empty string for non-array input', async () => {
    expect(await getPriceDropSection('not an array')).toBe('');
  });

  it('generates section with "Price Drop" heading', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain('Price Drop');
  });

  it('shows both current and previous price', async () => {
    const items = makePriceDropProducts(1);
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain(`$${Number(items[0].price).toFixed(2)}`);
    expect(html).toContain(`$${Number(items[0].previousPrice).toFixed(2)}`);
  });

  it('applies strikethrough to previous price', async () => {
    const items = makePriceDropProducts(1);
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain('text-decoration:line-through');
  });

  it('uses real product names from catalog', async () => {
    const items = makePriceDropProducts(3);
    const html = await getPriceDropSection(items, 4);
    for (const p of items) {
      expect(html).toContain(p.name);
    }
  });

  it('respects the limit parameter', async () => {
    const items = makePriceDropProducts(4);
    const html = await getPriceDropSection(items, 2);
    // Only first 2 should appear
    expect(html).toContain(items[0].name);
    expect(html).toContain(items[1].name);
    expect(html).not.toContain(items[2].name);
  });

  it('caps limit at 8', async () => {
    const items = makePriceDropProducts(4);
    const html = await getPriceDropSection(items, 100);
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBeLessThanOrEqual(8);
  });

  it('clamps limit to minimum of 1', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, 0);
    expect(html).toContain('Price Drop');
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBe(1);
  });

  it('filters out products without previousPrice', async () => {
    const items = [
      { name: 'No Drop', price: 100, slug: 'nd' },
      { ...products[0], previousPrice: products[0].price * 1.5 },
    ];
    const html = await getPriceDropSection(items, 4);
    expect(html).not.toContain('No Drop');
    expect(html).toContain(products[0].name);
  });

  it('filters out products where previousPrice <= current price', async () => {
    const items = [
      { name: 'Not Really Dropped', price: 200, previousPrice: 150, slug: 'nrd' },
      { ...products[0], previousPrice: products[0].price + 100 },
    ];
    const html = await getPriceDropSection(items, 4);
    expect(html).not.toContain('Not Really Dropped');
    expect(html).toContain(products[0].name);
  });

  it('returns empty when no products have valid price drops', async () => {
    const items = [
      { name: 'A', price: 100, slug: 'a' },
      { name: 'B', price: 200, previousPrice: 100, slug: 'b' },
    ];
    expect(await getPriceDropSection(items)).toBe('');
  });

  it('includes "View all deals" CTA link', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain('View all deals');
    expect(html).toContain('/shop-main');
  });

  it('calculates and shows savings percentage', async () => {
    const items = [{
      name: 'Test Product',
      price: 75,
      previousPrice: 100,
      slug: 'test',
      images: ['img.jpg'],
    }];
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain('25%');
  });

  it('uses inline styles for email client compatibility', async () => {
    const items = makePriceDropProducts(1);
    const html = await getPriceDropSection(items, 4);
    expect(html).toContain('style=');
    expect(html).toContain('font-family:Arial');
  });

  it('returns empty for previousPrice === price (boundary)', async () => {
    const items = [{ name: 'Same Price', price: 100, previousPrice: 100, slug: 'sp' }];
    expect(await getPriceDropSection(items)).toBe('');
  });

  it('filters out products with non-numeric price (NaN guard)', async () => {
    const items = [
      { name: 'Bad Price', price: 'free', previousPrice: 100, slug: 'bp' },
      { name: 'Bad Prev', price: 100, previousPrice: 'was-200', slug: 'bpv' },
      { ...products[0], previousPrice: products[0].price + 100 },
    ];
    const html = await getPriceDropSection(items, 4);
    expect(html).not.toContain('Bad Price');
    expect(html).not.toContain('Bad Prev');
    expect(html).not.toContain('NaN');
    expect(html).toContain(products[0].name);
  });

  it('sanitizes product names to strip HTML tags', async () => {
    const items = [{
      name: '<script>alert(1)</script>Legit Name',
      price: 50,
      previousPrice: 100,
      slug: 'xss',
      images: ['https://example.com/img.jpg'],
    }];
    const html = await getPriceDropSection(items, 4);
    expect(html).not.toContain('<script>');
    expect(html).toContain('alert(1)Legit Name');
  });

  it('renders card without image when images array is empty', async () => {
    const items = [{
      name: 'No Image Product',
      price: 50,
      previousPrice: 100,
      slug: 'nip',
      images: [],
    }];
    const html = await getPriceDropSection(items, 1);
    expect(html).toContain('No Image Product');
    expect(html).toContain('$50.00');
    expect(html).not.toContain('<img');
  });

  it('handles negative limit by clamping to 1', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, -5);
    expect(html).toContain('Price Drop');
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBe(1);
  });
});

// ── getBackInStockSection ────────────────────────────────────────────

describe('getBackInStockSection', () => {
  it('returns empty string for empty array', async () => {
    expect(await getBackInStockSection([])).toBe('');
  });

  it('returns empty string for null input', async () => {
    expect(await getBackInStockSection(null)).toBe('');
  });

  it('returns empty string for non-array input', async () => {
    expect(await getBackInStockSection('not an array')).toBe('');
  });

  it('generates section with "Back in Stock" heading', async () => {
    const items = makeBackInStockProducts(2);
    const html = await getBackInStockSection(items, 4);
    expect(html).toContain('Back in Stock');
  });

  it('uses real product names from catalog', async () => {
    const items = makeBackInStockProducts(3);
    const html = await getBackInStockSection(items, 4);
    for (const p of items) {
      expect(html).toContain(p.name);
    }
  });

  it('includes product prices', async () => {
    const items = makeBackInStockProducts(2);
    const html = await getBackInStockSection(items, 4);
    for (const p of items) {
      expect(html).toContain(`$${Number(p.price).toFixed(2)}`);
    }
  });

  it('includes product images', async () => {
    const items = makeBackInStockProducts(2);
    // Verify test data has images to avoid vacuous assertion
    const withImages = items.filter(p => p.images && p.images[0]);
    expect(withImages.length).toBeGreaterThan(0);
    const html = await getBackInStockSection(items, 4);
    for (const p of withImages) {
      expect(html).toContain(p.images[0]);
    }
  });

  it('respects the limit parameter', async () => {
    const items = makeBackInStockProducts(4);
    const html = await getBackInStockSection(items, 2);
    expect(html).toContain(items[0].name);
    expect(html).toContain(items[1].name);
    expect(html).not.toContain(items[2].name);
  });

  it('caps limit at 8', async () => {
    const items = makeBackInStockProducts(4);
    const html = await getBackInStockSection(items, 100);
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBeLessThanOrEqual(8);
  });

  it('clamps limit to minimum of 1', async () => {
    const items = makeBackInStockProducts(2);
    const html = await getBackInStockSection(items, 0);
    expect(html).toContain('Back in Stock');
    const cardCount = (html.match(/<table[^>]*width="200"/g) || []).length;
    expect(cardCount).toBe(1);
  });

  it('filters out products not marked InStock', async () => {
    const items = [
      { name: 'Still Out', price: 100, availability: 'OutOfStock', slug: 'so' },
      { ...products[0], availability: 'InStock', restockedAt: new Date().toISOString() },
    ];
    const html = await getBackInStockSection(items, 4);
    expect(html).not.toContain('Still Out');
    expect(html).toContain(products[0].name);
  });

  it('requires restockedAt field to be present', async () => {
    const items = [
      { name: 'No Restock Date', price: 100, availability: 'InStock', slug: 'nrd' },
    ];
    expect(await getBackInStockSection(items)).toBe('');
  });

  it('returns empty when no products qualify', async () => {
    const items = [
      { name: 'A', price: 100, availability: 'OutOfStock', slug: 'a' },
      { name: 'B', price: 200, availability: 'InStock', slug: 'b' }, // no restockedAt
    ];
    expect(await getBackInStockSection(items)).toBe('');
  });

  it('includes "Shop now before they sell out" CTA link', async () => {
    const items = makeBackInStockProducts(2);
    const html = await getBackInStockSection(items, 4);
    expect(html).toContain('Shop now');
    expect(html).toContain('/shop-main');
  });

  it('uses inline styles for email client compatibility', async () => {
    const items = makeBackInStockProducts(1);
    const html = await getBackInStockSection(items, 4);
    expect(html).toContain('style=');
    expect(html).toContain('font-family:Arial');
  });
});

// ── generateNewArrivalsEmail ─────────────────────────────────────────

describe('generateNewArrivalsEmail', () => {
  it('returns complete HTML document', async () => {
    const html = await generateNewArrivalsEmail(products, 4);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('includes email header with Carolina Futons branding', async () => {
    const html = await generateNewArrivalsEmail(products, 4);
    expect(html).toContain('Carolina Futons');
  });

  it('includes New Arrivals product section', async () => {
    const html = await generateNewArrivalsEmail(products, 4);
    expect(html).toContain('New Arrivals');
  });

  it('includes unsubscribe link', async () => {
    const html = await generateNewArrivalsEmail(products, 4);
    expect(html).toContain('unsubscribe');
  });

  it('includes footer with company info', async () => {
    const html = await generateNewArrivalsEmail(products, 4);
    expect(html).toContain('Carolina Futons');
    expect(html).toContain('Hendersonville');
  });

  it('uses real product data from catalog', async () => {
    const html = await generateNewArrivalsEmail(products, 2);
    const eligible = products.filter(p => p.name && p.price != null);
    const arrivals = eligible.slice(-2).reverse();
    for (const p of arrivals) {
      expect(html).toContain(p.name);
    }
  });

  it('returns empty string for empty products', async () => {
    expect(await generateNewArrivalsEmail([])).toBe('');
  });

  it('returns empty string for null products', async () => {
    expect(await generateNewArrivalsEmail(null)).toBe('');
  });

  it('respects product limit', async () => {
    const eligible = products.filter(p => p.name && p.price != null);
    expect(eligible.length).toBeGreaterThan(2);
    const html = await generateNewArrivalsEmail(products, 2);
    const notIncluded = eligible[eligible.length - 3];
    expect(html).not.toContain(notIncluded.name);
  });
});

// ── generatePriceDropEmail ───────────────────────────────────────────

describe('generatePriceDropEmail', () => {
  it('returns complete HTML document', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('includes email header with Carolina Futons branding', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('Carolina Futons');
  });

  it('includes Price Drop product section', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('Price Drop');
  });

  it('shows strikethrough previous prices', async () => {
    const items = makePriceDropProducts(1);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('text-decoration:line-through');
  });

  it('includes unsubscribe link', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('unsubscribe');
  });

  it('includes footer with company info', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 4);
    expect(html).toContain('Hendersonville');
  });

  it('returns empty string for empty products', async () => {
    expect(await generatePriceDropEmail([])).toBe('');
  });

  it('returns empty string for null products', async () => {
    expect(await generatePriceDropEmail(null)).toBe('');
  });

  it('returns empty string when no valid price drops', async () => {
    const items = [{ name: 'No Drop', price: 100, slug: 'nd' }];
    expect(await generatePriceDropEmail(items)).toBe('');
  });
});

// ── generateBackInStockEmail ─────────────────────────────────────────

describe('generateBackInStockEmail', () => {
  it('returns complete HTML document', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('includes email header with Carolina Futons branding', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    expect(html).toContain('Carolina Futons');
  });

  it('includes Back in Stock product section', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    expect(html).toContain('Back in Stock');
  });

  it('includes unsubscribe link', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    expect(html).toContain('unsubscribe');
  });

  it('includes footer with company info', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    expect(html).toContain('Hendersonville');
  });

  it('returns empty string for empty products', async () => {
    expect(await generateBackInStockEmail([])).toBe('');
  });

  it('returns empty string for null products', async () => {
    expect(await generateBackInStockEmail(null)).toBe('');
  });

  it('returns empty string when no valid restocked products', async () => {
    const items = [{ name: 'Still Out', price: 100, availability: 'OutOfStock', slug: 'so' }];
    expect(await generateBackInStockEmail(items)).toBe('');
  });

  it('uses real product data from catalog', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 4);
    for (const p of items) {
      expect(html).toContain(p.name);
      expect(html).toContain(`$${Number(p.price).toFixed(2)}`);
    }
  });
});

// ── HTML Email Structure Tests ───────────────────────────────────────

describe('Email HTML structure', () => {
  it('New Arrivals email has proper table-based layout', async () => {
    const html = await generateNewArrivalsEmail(products, 2);
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    // No divs — email templates should be table-based for compatibility
    expect(html).not.toMatch(/<div\s/);
  });

  it('Price Drop email has proper table-based layout', async () => {
    const items = makePriceDropProducts(2);
    const html = await generatePriceDropEmail(items, 2);
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    expect(html).not.toMatch(/<div\s/);
  });

  it('Back in Stock email has proper table-based layout', async () => {
    const items = makeBackInStockProducts(2);
    const html = await generateBackInStockEmail(items, 2);
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    expect(html).not.toMatch(/<div\s/);
  });

  it('all email types use inline styles (no external CSS)', async () => {
    const newArrivals = await generateNewArrivalsEmail(products, 2);
    const priceDrop = await generatePriceDropEmail(makePriceDropProducts(2), 2);
    const backInStock = await generateBackInStockEmail(makeBackInStockProducts(2), 2);

    for (const html of [newArrivals, priceDrop, backInStock]) {
      expect(html).not.toContain('<link rel="stylesheet"');
      expect(html).not.toContain('<style>');
      expect(html).toContain('style=');
    }
  });

  it('all email types include meta viewport for mobile', async () => {
    const newArrivals = await generateNewArrivalsEmail(products, 2);
    const priceDrop = await generatePriceDropEmail(makePriceDropProducts(2), 2);
    const backInStock = await generateBackInStockEmail(makeBackInStockProducts(2), 2);

    for (const html of [newArrivals, priceDrop, backInStock]) {
      expect(html).toContain('viewport');
    }
  });
});

// ── Data Integrity Tests ─────────────────────────────────────────────

describe('Newsletter catalog data integrity', () => {
  it('price drop section only shows products from provided input', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, 4);
    const allCatalogNames = new Set(products.map(p => p.name));
    // Every name in the output should be from our input items
    const foundNames = [...allCatalogNames].filter(n => html.includes(n));
    const inputNames = new Set(items.map(p => p.name));
    for (const name of foundNames) {
      expect(inputNames.has(name)).toBe(true);
    }
  });

  it('back in stock section only shows products from provided input', async () => {
    const items = makeBackInStockProducts(2);
    const html = await getBackInStockSection(items, 4);
    const allCatalogNames = new Set(products.map(p => p.name));
    const foundNames = [...allCatalogNames].filter(n => html.includes(n));
    const inputNames = new Set(items.map(p => p.name));
    for (const name of foundNames) {
      expect(inputNames.has(name)).toBe(true);
    }
  });

  it('price drop products have real prices from catalog', async () => {
    const items = makePriceDropProducts(2);
    const html = await getPriceDropSection(items, 4);
    for (const p of items) {
      expect(html).toContain(`$${Number(p.price).toFixed(2)}`);
    }
  });

  it('all product images in price drop are from catalog-MASTER.json', async () => {
    const items = makePriceDropProducts(4);
    const html = await getPriceDropSection(items, 4);
    const allImages = new Set(products.flatMap(p => p.images || []));
    const imgSrcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    for (const src of imgSrcs) {
      expect(allImages.has(src), `image ${src} not in catalog`).toBe(true);
    }
  });

  it('all product images in back in stock are from catalog-MASTER.json', async () => {
    const items = makeBackInStockProducts(4);
    const html = await getBackInStockSection(items, 4);
    const allImages = new Set(products.flatMap(p => p.images || []));
    const imgSrcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    for (const src of imgSrcs) {
      expect(allImages.has(src), `image ${src} not in catalog`).toBe(true);
    }
  });
});

// ── buildPriceDropBlock (via getPriceDropSection internals) ──────────

describe('Price drop block rendering', () => {
  it('shows savings amount when previousPrice provided', async () => {
    const items = [{
      name: 'Save Test',
      price: 400,
      previousPrice: 500,
      slug: 'save-test',
      images: ['img.jpg'],
    }];
    const html = await getPriceDropSection(items, 1);
    // Should show save $100 or 20%
    expect(html).toContain('20%');
  });

  it('handles fractional savings percentage', async () => {
    const items = [{
      name: 'Fraction Test',
      price: 333,
      previousPrice: 500,
      slug: 'frac',
      images: ['img.jpg'],
    }];
    const html = await getPriceDropSection(items, 1);
    // 33.4% off — should show integer percentage
    expect(html).toMatch(/3[34]%/);
  });
});
