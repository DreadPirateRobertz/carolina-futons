/**
 * @file googleMerchantFeedEnhanced.test.js
 * @description Tests for Wave 32 enhancements to googleMerchantFeed.web.js — CF-z5jm
 * Covers: GTIN, shipping weight, sale_price_effective_date, product_type hierarchy.
 * Complements merchantSeoHardening.test.js (existing coverage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { generateFeed, getFeedData } from '../src/backend/googleMerchantFeed.web.js';

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    price: 299,
    visible: true,
    inStock: true,
    collections: ['futon-frames'],
    mainMedia: '',
    ...overrides,
  };
}

beforeEach(() => {
  __seed('Stores/Products', []);
});

// ── GTIN ──────────────────────────────────────────────────────────────────────

describe('Google Merchant Feed — GTIN', () => {
  it('includes g:gtin when product has a valid 12-digit GTIN', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: '012345678901' })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:gtin>012345678901</g:gtin>');
  });

  it('includes g:gtin when product has a valid 13-digit GTIN (EAN)', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: '4006381333931' })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:gtin>4006381333931</g:gtin>');
  });

  it('sets identifier_exists=true when valid GTIN is present', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: '012345678901' })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:identifier_exists>true</g:identifier_exists>');
    expect(xml).not.toContain('<g:identifier_exists>false</g:identifier_exists>');
  });

  it('sets identifier_exists=false when GTIN is absent', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: null })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:identifier_exists>false</g:identifier_exists>');
    expect(xml).not.toContain('<g:identifier_exists>true</g:identifier_exists>');
  });

  it('sets identifier_exists=false when GTIN has wrong digit count', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: '12345' })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:identifier_exists>false</g:identifier_exists>');
    expect(xml).not.toContain('<g:gtin>');
  });

  it('includes gtin field in getFeedData JSON when valid', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: '012345678901' })]);
    const data = await getFeedData();
    expect(data[0].gtin).toBe('012345678901');
    expect(data[0].identifierExists).toBe(true);
  });

  it('sets gtin=null and identifierExists=false in JSON when absent', async () => {
    __seed('Stores/Products', [makeProduct({ gtin: null })]);
    const data = await getFeedData();
    expect(data[0].gtin).toBeNull();
    expect(data[0].identifierExists).toBe(false);
  });
});

// ── Shipping weight ───────────────────────────────────────────────────────────

describe('Google Merchant Feed — shipping weight', () => {
  it('includes g:shipping_weight when product weight is positive', async () => {
    __seed('Stores/Products', [makeProduct({ weight: 45.5 })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:shipping_weight>45.50 lb</g:shipping_weight>');
  });

  it('includes weight for integer weight value', async () => {
    __seed('Stores/Products', [makeProduct({ weight: 80 })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:shipping_weight>80.00 lb</g:shipping_weight>');
  });

  it('omits g:shipping_weight when weight is null', async () => {
    __seed('Stores/Products', [makeProduct({ weight: null })]);
    const xml = await generateFeed();
    expect(xml).not.toContain('shipping_weight');
  });

  it('omits g:shipping_weight when weight is 0', async () => {
    __seed('Stores/Products', [makeProduct({ weight: 0 })]);
    const xml = await generateFeed();
    expect(xml).not.toContain('shipping_weight');
  });

  it('includes shippingWeight in getFeedData JSON when present', async () => {
    __seed('Stores/Products', [makeProduct({ weight: 55 })]);
    const data = await getFeedData();
    expect(data[0].shippingWeight).toBe(55);
  });

  it('sets shippingWeight=null in JSON when weight is absent', async () => {
    __seed('Stores/Products', [makeProduct({ weight: null })]);
    const data = await getFeedData();
    expect(data[0].shippingWeight).toBeNull();
  });
});

// ── sale_price_effective_date ─────────────────────────────────────────────────

describe('Google Merchant Feed — sale_price_effective_date', () => {
  it('includes sale_price_effective_date from salePriceEffectiveDate string', async () => {
    __seed('Stores/Products', [makeProduct({
      price: 599,
      discountedPrice: 449,
      salePriceEffectiveDate: '2026-04-01T00:00:00Z/2026-04-30T23:59:59Z',
    })]);
    const xml = await generateFeed();
    expect(xml).toContain('<g:sale_price_effective_date>2026-04-01T00:00:00Z/2026-04-30T23:59:59Z</g:sale_price_effective_date>');
  });

  it('builds sale_price_effective_date from saleStartDate + saleEndDate', async () => {
    __seed('Stores/Products', [makeProduct({
      price: 499,
      discountedPrice: 399,
      saleStartDate: '2026-04-01T00:00:00Z',
      saleEndDate: '2026-04-15T23:59:59Z',
    })]);
    const xml = await generateFeed();
    expect(xml).toContain('sale_price_effective_date');
    expect(xml).toContain('2026-04-01');
    expect(xml).toContain('2026-04-15');
  });

  it('omits sale_price_effective_date when no date range is provided', async () => {
    __seed('Stores/Products', [makeProduct({ price: 599, discountedPrice: 449 })]);
    const xml = await generateFeed();
    expect(xml).not.toContain('sale_price_effective_date');
  });

  it('omits sale_price_effective_date when there is no discount', async () => {
    __seed('Stores/Products', [makeProduct({
      price: 599,
      discountedPrice: null,
      salePriceEffectiveDate: '2026-04-01T00:00:00Z/2026-04-30T23:59:59Z',
    })]);
    const xml = await generateFeed();
    expect(xml).not.toContain('sale_price_effective_date');
  });

  it('includes salePriceEffectiveDate in getFeedData JSON when present', async () => {
    __seed('Stores/Products', [makeProduct({
      price: 599,
      discountedPrice: 449,
      salePriceEffectiveDate: '2026-04-01T00:00:00Z/2026-04-30T23:59:59Z',
    })]);
    const data = await getFeedData();
    expect(data[0].salePriceEffectiveDate).toBe('2026-04-01T00:00:00Z/2026-04-30T23:59:59Z');
  });

  it('sets salePriceEffectiveDate=null in JSON when absent', async () => {
    __seed('Stores/Products', [makeProduct({ price: 299 })]);
    const data = await getFeedData();
    expect(data[0].salePriceEffectiveDate).toBeNull();
  });
});

// ── product_type hierarchy ────────────────────────────────────────────────────

describe('Google Merchant Feed — product_type hierarchy', () => {
  it('includes Furniture > prefix for futon frames', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['futon-frames'] })]);
    const xml = await generateFeed();
    expect(xml).toContain('Furniture &gt; Futon Frames');
  });

  it('includes Furniture > Beds > Murphy Cabinet Beds for murphy beds', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['murphy-cabinet-beds'] })]);
    const xml = await generateFeed();
    expect(xml).toContain('Furniture &gt; Beds &gt; Murphy Cabinet Beds');
  });

  it('includes Furniture > Beds > Platform Beds for platform beds', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['platform-beds'] })]);
    const xml = await generateFeed();
    expect(xml).toContain('Furniture &gt; Beds &gt; Platform Beds');
  });

  it('includes Furniture > Futon Frames > Wall Hugger Futons for wall huggers', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['wall-hugger-frames'] })]);
    const xml = await generateFeed();
    expect(xml).toContain('Furniture &gt; Futon Frames &gt; Wall Hugger Futons');
  });

  it('includes Furniture > Futon Covers for covers', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['covers'] })]);
    const xml = await generateFeed();
    expect(xml).toContain('Furniture &gt; Futon Covers');
  });

  it('productType in getFeedData JSON contains Furniture prefix', async () => {
    __seed('Stores/Products', [makeProduct({ collections: ['futon-frames'] })]);
    const data = await getFeedData();
    expect(data[0].productType).toContain('Furniture');
    expect(data[0].productType).toContain('Futon Frames');
  });
});
