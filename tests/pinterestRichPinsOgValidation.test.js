/**
 * OG tag output validation tests for Pinterest Rich Pins (CF-4ckn)
 *
 * Validates that product page meta tag output satisfies Pinterest's Rich Pin
 * approval requirements:
 *   - og:type = "product"
 *   - product:price:amount  (positive number, 2 decimal places)
 *   - product:price:currency (3-char ISO code)
 *   - product:availability  ("instock" | "oos" | "preorder") — no spaces
 *
 * Pinterest Rich Pins validator: https://developers.pinterest.com/tools/url-debugger/
 * Supported availability values: instock, oos, preorder (not "in stock" / "out of stock")
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { __reset as resetData } from './__mocks__/wix-data.js';
import {
  getProductPinData,
  validatePinMarkup,
  getPinterestMetaTags,
} from '../src/backend/pinterestRichPins.web.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_PRODUCT = {
  name: 'Monterey Futon Frame',
  slug: 'monterey-futon-frame',
  description: 'Solid hardwood futon frame with clean modern lines. Built to last.',
  image: 'https://static.wixstatic.com/media/monterey.jpg',
  price: 549.00,
  inStock: true,
  brand: 'Night & Day Furniture',
  category: 'Futon Frames',
  sku: 'NDF-MONTEREY-001',
};

const OUT_OF_STOCK_PRODUCT = {
  ...VALID_PRODUCT,
  name: 'Austin Futon Frame',
  slug: 'austin-futon-frame',
  inStock: false,
};

const SALE_PRODUCT = {
  ...VALID_PRODUCT,
  name: 'Osaka Futon Frame',
  slug: 'osaka-futon-frame',
  price: 699,
  salePrice: 499,
};

beforeEach(() => {
  resetData();
});

// ── og:type = "product" ─────────────────────────────────────────────────────

describe('Pinterest Rich Pins — og:type', () => {
  it('sets og:type to "product" for in-stock products', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    expect(meta['og:type']).toBe('product');
  });

  it('sets og:type to "product" for out-of-stock products', async () => {
    const { meta } = await getProductPinData(OUT_OF_STOCK_PRODUCT);
    expect(meta['og:type']).toBe('product');
  });

  it('includes og:type in generated meta tag HTML', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    const { tagString } = await getPinterestMetaTags(meta);
    expect(tagString).toContain('property="og:type"');
    expect(tagString).toContain('content="product"');
  });
});

// ── product:price:amount ───────────────────────────────────────────────────

describe('Pinterest Rich Pins — product:price:amount', () => {
  it('outputs price formatted to 2 decimal places', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    expect(meta['product:price:amount']).toBe('549.00');
  });

  it('price is a numeric string (parseable as float)', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    const parsed = parseFloat(meta['product:price:amount']);
    expect(parsed).not.toBeNaN();
    expect(parsed).toBeGreaterThan(0);
  });

  it('sets product:price:currency to USD', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    expect(meta['product:price:currency']).toBe('USD');
  });

  it('sets sale price when product is on sale', async () => {
    const { meta } = await getProductPinData(SALE_PRODUCT);
    expect(meta['product:sale_price:amount']).toBe('499.00');
    expect(meta['product:sale_price:currency']).toBe('USD');
  });

  it('does not set sale price when regular price only', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    expect(meta['product:sale_price:amount']).toBeUndefined();
  });

  it('does not set sale price when sale equals regular price', async () => {
    const { meta } = await getProductPinData({ ...VALID_PRODUCT, price: 549, salePrice: 549 });
    expect(meta['product:sale_price:amount']).toBeUndefined();
  });
});

// ── product:availability ───────────────────────────────────────────────────
// Pinterest requires no-space values: "instock" / "oos" / "preorder"
// NOT "in stock" / "out of stock" / "pre order"

describe('Pinterest Rich Pins — product:availability', () => {
  it('sets availability to "instock" (no space) for in-stock products', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    expect(meta['product:availability']).toBe('instock');
  });

  it('sets availability to "oos" (not "out of stock") for out-of-stock products', async () => {
    const { meta } = await getProductPinData(OUT_OF_STOCK_PRODUCT);
    expect(meta['product:availability']).toBe('oos');
  });

  it('sets availability to "preorder" (no space) for preorder products', async () => {
    const { meta } = await getProductPinData({ ...VALID_PRODUCT, preorder: true, inStock: false });
    expect(meta['product:availability']).toBe('preorder');
  });

  it('defaults to instock when inStock field is undefined', async () => {
    const { name, slug, price, image } = VALID_PRODUCT;
    const { meta } = await getProductPinData({ name, slug, price, image });
    expect(meta['product:availability']).toBe('instock');
  });
});

// ── Full Pinterest Rich Pin compliance ─────────────────────────────────────

describe('Pinterest Rich Pins — full compliance validation', () => {
  let pinMeta;

  beforeAll(async () => {
    const result = await getProductPinData(VALID_PRODUCT);
    expect(result.meta, 'fixture setup: getProductPinData returned null meta').toBeTruthy();
    pinMeta = result.meta;
  });

  it('has all 8 required Pinterest product pin fields', () => {
    const required = [
      'og:type',
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'product:price:amount',
      'product:price:currency',
      'product:availability',
    ];
    for (const field of required) {
      expect(pinMeta[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it('validatePinMarkup returns valid: true for a complete product', async () => {
    const { valid, errors } = await validatePinMarkup(pinMeta, 'product');
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('validatePinMarkup catches missing og:type', async () => {
    const { 'og:type': _removed, ...metaWithout } = pinMeta;
    const { valid, errors } = await validatePinMarkup(metaWithout, 'product');
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('og:type'))).toBe(true);
  });

  it('validatePinMarkup catches missing product:price:currency', async () => {
    const { 'product:price:currency': _removed, ...metaWithout } = pinMeta;
    const { valid, errors } = await validatePinMarkup(metaWithout, 'product');
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('currency'))).toBe(true);
  });

  it('validatePinMarkup catches invalid availability value', async () => {
    const invalid = { ...pinMeta, 'product:availability': 'in stock' };
    const { valid, errors } = await validatePinMarkup(invalid, 'product');
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('availability'))).toBe(true);
  });

  it('validatePinMarkup catches zero price', async () => {
    const zeroPriced = { ...pinMeta, 'product:price:amount': '0' };
    const { valid, errors } = await validatePinMarkup(zeroPriced, 'product');
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('price'))).toBe(true);
  });

  it('og:image is an absolute HTTPS URL', () => {
    expect(pinMeta['og:image']).toMatch(/^https:\/\//);
  });

  it('og:url contains the product slug', () => {
    expect(pinMeta['og:url']).toContain(VALID_PRODUCT.slug);
  });

  it('pinterest-rich-pin flag is set to "true"', () => {
    expect(pinMeta['pinterest-rich-pin']).toBe('true');
  });
});

// ── getPinterestMetaTags HTML output ───────────────────────────────────────

describe('Pinterest Rich Pins — meta tag HTML output', () => {
  it('generates valid HTML meta tags for all product fields', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    const { success, tags, tagString } = await getPinterestMetaTags(meta);

    expect(success).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
    expect(tagString).toContain('<meta property="og:type" content="product"');
    expect(tagString).toContain('<meta property="product:price:amount"');
    expect(tagString).toContain('<meta property="product:availability" content="instock"');
  });

  it('each tag is a well-formed self-closing meta element', async () => {
    const { meta } = await getProductPinData(VALID_PRODUCT);
    const { tags } = await getPinterestMetaTags(meta);

    for (const tag of tags) {
      expect(tag).toMatch(/^<meta property="[^"<>]+" content="[^<>]*" \/>$/);
    }
  });

  it('escapes HTML special characters in content', async () => {
    const { meta } = await getProductPinData({
      ...VALID_PRODUCT,
      name: 'Frame & Mattress <Set>',
      description: 'Price "as shown"',
    });
    const { tagString } = await getPinterestMetaTags(meta);
    expect(tagString).not.toContain('<Set>');
    expect(tagString).not.toContain('"as shown"');
    expect(tagString).toContain('&amp;');
  });

  it('includes sale price tags in HTML output for sale products', async () => {
    const { meta } = await getProductPinData(SALE_PRODUCT);
    const { success, tagString } = await getPinterestMetaTags(meta);
    expect(success).toBe(true);
    expect(tagString).toContain('<meta property="product:sale_price:amount"');
    expect(tagString).toContain('content="499.00"');
  });

  it('skips tags where content is explicitly empty string', async () => {
    const metaWithEmpty = { 'og:type': 'product', 'og:title': '', 'product:price:amount': '299.00' };
    const { tags } = await getPinterestMetaTags(metaWithEmpty);
    for (const tag of tags) {
      expect(tag).not.toContain('content=""');
    }
  });
});
