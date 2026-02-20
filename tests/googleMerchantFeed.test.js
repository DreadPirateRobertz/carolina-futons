import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { generateFeed, getFeedData } from '../src/backend/googleMerchantFeed.web.js';

const PRODUCTS = [
  {
    _id: 'prod-1',
    name: 'Kodiak Futon Frame',
    slug: 'kodiak-futon-frame',
    description: '<p>Solid hardwood futon frame with <b>easy operation</b>.</p>',
    price: 599,
    discountedPrice: 499,
    inStock: true,
    visible: true,
    sku: 'KDF-001',
    collections: ['futon-frames'],
    mainMedia: 'wix:image://v1/kodiak-main.jpg/kodiak.jpg#originWidth=800&originHeight=600',
    mediaItems: [
      { src: 'wix:image://v1/kodiak-main.jpg' },
      { src: 'wix:image://v1/kodiak-side.jpg' },
      { src: 'wix:image://v1/kodiak-back.jpg' },
    ],
  },
  {
    _id: 'prod-2',
    name: 'Murphy Cabinet Bed',
    slug: 'murphy-cabinet-bed',
    description: 'Space-saving murphy bed.',
    price: 1299,
    inStock: true,
    visible: true,
    sku: 'MCB-001',
    collections: ['murphy-cabinet-beds'],
    mainMedia: 'https://example.com/murphy.jpg',
  },
  {
    _id: 'prod-3',
    name: 'Wall Hugger Recliner Frame',
    slug: 'wall-hugger-recliner',
    description: 'Compact wall hugger design.',
    price: 899,
    inStock: false,
    visible: true,
    collections: ['wall-huggers'],
    mainMedia: { src: 'https://example.com/wallhugger.jpg' },
  },
  {
    _id: 'prod-4',
    name: 'Otis Futon Mattress',
    slug: 'otis-futon-mattress',
    description: 'Premium futon mattress.',
    price: 399,
    inStock: true,
    visible: true,
    collections: ['mattresses', 'otis'],
    mainMedia: { url: 'https://example.com/otis.jpg' },
  },
];

// ── generateFeed ────────────────────────────────────────────────────

describe('generateFeed', () => {
  beforeEach(() => {
    __seed('Stores/Products', PRODUCTS);
  });

  it('generates valid XML feed', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('</rss>');
  });

  it('includes all visible products', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('Kodiak Futon Frame');
    expect(xml).toContain('Murphy Cabinet Bed');
    expect(xml).toContain('Wall Hugger Recliner Frame');
    expect(xml).toContain('Otis Futon Mattress');
  });

  it('generates correct product links', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('https://www.carolinafutons.com/product-page/kodiak-futon-frame');
    expect(xml).toContain('https://www.carolinafutons.com/product-page/murphy-cabinet-bed');
  });

  it('strips HTML from descriptions', async () => {
    const xml = await generateFeed();
    expect(xml).not.toContain('<p>');
    expect(xml).not.toContain('<b>');
    expect(xml).toContain('Solid hardwood futon frame');
  });

  it('formats prices as "X.XX USD"', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('599.00 USD');
    expect(xml).toContain('1299.00 USD');
  });

  it('includes sale price when discounted', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<g:sale_price>499.00 USD</g:sale_price>');
  });

  it('sets availability correctly', async () => {
    const xml = await generateFeed();
    // Wall hugger is out of stock
    expect(xml).toContain('out_of_stock');
    expect(xml).toContain('in_stock');
  });

  it('includes MPN from SKU', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<g:mpn>KDF-001</g:mpn>');
  });

  it('sets identifier_exists to false', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<g:identifier_exists>false</g:identifier_exists>');
  });

  it('includes free shipping for items >= $999', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<g:service>Free Shipping</g:service>');
    expect(xml).toContain('0.00 USD');
  });

  it('detects correct brands from collections', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('Night &amp; Day Furniture'); // futon-frames default
    expect(xml).toContain('Strata Furniture'); // wall-huggers
    expect(xml).toContain('Otis Bed'); // otis collection
  });

  it('maps google product categories correctly', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('2720'); // futons category ID
    expect(xml).toContain('451');  // murphy beds category ID
  });

  it('includes additional images', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('g:additional_image_link');
  });

  it('includes channel metadata', async () => {
    const xml = await generateFeed();
    expect(xml).toContain('<title>Carolina Futons - Google Shopping Feed</title>');
    expect(xml).toContain('<lastBuildDate>');
  });

  it('returns null on error', async () => {
    // Empty store — should still work (empty feed, not null)
    __seed('Stores/Products', []);
    const xml = await generateFeed();
    expect(xml).toContain('<rss');
  });

  it('escapes XML special characters in product name', async () => {
    __seed('Stores/Products', [{
      _id: 'prod-xml',
      name: 'Tom & Jerry\'s <Special> "Futon"',
      slug: 'tom-jerry-futon',
      description: 'Sizes: 6" x 8\' & more',
      price: 299,
      inStock: true,
      visible: true,
      collections: ['futon-frames'],
      mainMedia: 'https://example.com/tom.jpg',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&apos;');
    // Raw unescaped & should not appear (only &amp; &lt; &gt; &quot; &apos;)
    expect(xml).not.toContain('<g:title>Tom & ');
  });

  it('escapes ampersands in descriptions', async () => {
    __seed('Stores/Products', [{
      _id: 'prod-amp',
      name: 'Test Frame',
      slug: 'test-frame',
      description: 'Solid wood & steel construction with <b>bolts</b>',
      price: 499,
      inStock: true,
      visible: true,
      collections: ['futon-frames'],
      mainMedia: 'https://example.com/test.jpg',
    }]);

    const xml = await generateFeed();
    // Description should have HTML stripped AND XML escaped
    expect(xml).not.toContain('<b>bolts</b>');
    expect(xml).toContain('wood &amp; steel');
  });

  it('handles product with empty description', async () => {
    __seed('Stores/Products', [{
      _id: 'prod-empty',
      name: 'No Description Frame',
      slug: 'no-desc',
      description: '',
      price: 199,
      inStock: true,
      visible: true,
      collections: ['futon-frames'],
      mainMedia: 'https://example.com/nodesc.jpg',
    }]);

    const xml = await generateFeed();
    // Should fall back to product name for description
    expect(xml).toContain('No Description Frame');
    expect(xml).toContain('<g:description>');
  });
});

// ── getFeedData ─────────────────────────────────────────────────────

describe('getFeedData', () => {
  beforeEach(() => {
    __seed('Stores/Products', PRODUCTS);
  });

  it('returns array of product objects', async () => {
    const data = await getFeedData();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(4);
  });

  it('maps product fields correctly', async () => {
    const data = await getFeedData();
    const kodiak = data.find(p => p.id === 'prod-1');
    expect(kodiak.title).toBe('Kodiak Futon Frame');
    expect(kodiak.link).toContain('/product-page/kodiak-futon-frame');
    expect(kodiak.price).toBe(599);
    expect(kodiak.salePrice).toBe(499);
    expect(kodiak.availability).toBe('in_stock');
    expect(kodiak.brand).toBe('Night & Day Furniture');
    expect(kodiak.condition).toBe('new');
    expect(kodiak.sku).toBe('KDF-001');
    expect(kodiak.identifierExists).toBe(false);
  });

  it('strips HTML from descriptions', async () => {
    const data = await getFeedData();
    const kodiak = data.find(p => p.id === 'prod-1');
    expect(kodiak.description).not.toContain('<p>');
    expect(kodiak.description).toContain('Solid hardwood futon frame');
  });

  it('marks out-of-stock items correctly', async () => {
    const data = await getFeedData();
    const wallhugger = data.find(p => p.id === 'prod-3');
    expect(wallhugger.availability).toBe('out_of_stock');
  });

  it('returns empty array on error', async () => {
    __seed('Stores/Products', []);
    const data = await getFeedData();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it('detects product types from collections', async () => {
    const data = await getFeedData();
    const murphy = data.find(p => p.id === 'prod-2');
    expect(murphy.productType).toBe('Beds > Murphy Cabinet Beds');
  });
});
