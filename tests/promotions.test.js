import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import wixData from './__mocks__/wix-data.js';
import { getActivePromotion } from '../src/backend/promotions.web.js';

const now = new Date();
const yesterday = new Date(now.getTime() - 86400000);
const tomorrow = new Date(now.getTime() + 86400000);
const lastWeek = new Date(now.getTime() - 7 * 86400000);
const nextWeek = new Date(now.getTime() + 7 * 86400000);
const oneSecondAgo = new Date(now.getTime() - 1000);
const oneSecondFromNow = new Date(now.getTime() + 1000);

// ── getActivePromotion ──────────────────────────────────────────────

describe('getActivePromotion', () => {
  it('returns active promotion within date range', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-1',
        title: 'Spring Sale',
        subtitle: 'Save up to 30%',
        theme: 'spring',
        heroImage: 'https://example.com/spring.jpg',
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'SPRING30',
        discountPercent: 30,
        ctaUrl: '/sales',
        ctaText: 'Shop Now',
        isActive: true,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Spring Sale');
    expect(promo.subtitle).toBe('Save up to 30%');
    expect(promo.discountCode).toBe('SPRING30');
    expect(promo.discountPercent).toBe(30);
    expect(promo.ctaUrl).toBe('/sales');
  });

  it('returns null when no active promotions exist', async () => {
    __seed('Promotions', []);
    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  it('excludes inactive promotions', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-inactive',
        title: 'Old Sale',
        isActive: false,
        startDate: yesterday,
        endDate: nextWeek,
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  it('excludes promotions that have not started yet', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-future',
        title: 'Future Sale',
        isActive: true,
        startDate: tomorrow,
        endDate: nextWeek,
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  it('excludes promotions that have ended', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-past',
        title: 'Expired Sale',
        isActive: true,
        startDate: lastWeek,
        endDate: yesterday,
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  it('fetches associated products when productIds provided', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-products',
        title: 'Featured Products',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-1, prod-2',
        discountCode: 'FEAT10',
        discountPercent: 10,
      },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Frame', slug: 'eureka', price: 499, mainMedia: 'img1.jpg' },
      { _id: 'prod-2', name: 'Moonshadow Mattress', slug: 'moonshadow', price: 349, mainMedia: 'img2.jpg' },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.products).toHaveLength(2);
    expect(promo.products[0].name).toBe('Eureka Frame');
    expect(promo.products[1].name).toBe('Moonshadow Mattress');
  });

  it('returns empty products array when no productIds', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-no-products',
        title: 'General Sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toEqual([]);
  });

  it('returns all expected fields', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-full',
        title: 'Memorial Day',
        subtitle: 'Big savings',
        theme: 'patriotic',
        heroImage: 'hero.jpg',
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'MEMORIAL',
        discountPercent: 20,
        ctaUrl: '/memorial-sale',
        ctaText: 'Shop the Sale',
        isActive: true,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toHaveProperty('_id');
    expect(promo).toHaveProperty('title');
    expect(promo).toHaveProperty('subtitle');
    expect(promo).toHaveProperty('theme');
    expect(promo).toHaveProperty('heroImage');
    expect(promo).toHaveProperty('startDate');
    expect(promo).toHaveProperty('endDate');
    expect(promo).toHaveProperty('discountCode');
    expect(promo).toHaveProperty('discountPercent');
    expect(promo).toHaveProperty('ctaUrl');
    expect(promo).toHaveProperty('ctaText');
    expect(promo).toHaveProperty('products');
  });

  it('returns most recently started promotion when multiple active', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-old',
        title: 'Older Sale',
        isActive: true,
        startDate: lastWeek,
        endDate: nextWeek,
        productIds: '',
      },
      {
        _id: 'promo-new',
        title: 'Newer Sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    // descending startDate + limit(1) should pick the newer one
    expect(promo.title).toBe('Newer Sale');
  });

  // ── Product mapping fields ─────────────────────────────────────────

  it('maps all expected product fields including slug, prices, and mainMedia', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-map',
        title: 'Product Field Check',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-full',
      },
    ]);
    __seed('Stores/Products', [
      {
        _id: 'prod-full',
        name: 'Blue Ridge Futon',
        slug: 'blue-ridge-futon',
        price: 899,
        formattedPrice: '$899.00',
        discountedPrice: 749,
        formattedDiscountedPrice: '$749.00',
        mainMedia: 'https://example.com/blue-ridge.jpg',
        sku: 'BRF-001',          // extra field — should NOT appear
        inventory: 42,           // extra field — should NOT appear
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(1);
    const prod = promo.products[0];
    expect(prod._id).toBe('prod-full');
    expect(prod.name).toBe('Blue Ridge Futon');
    expect(prod.slug).toBe('blue-ridge-futon');
    expect(prod.price).toBe(899);
    expect(prod.formattedPrice).toBe('$899.00');
    expect(prod.discountedPrice).toBe(749);
    expect(prod.formattedDiscountedPrice).toBe('$749.00');
    expect(prod.mainMedia).toBe('https://example.com/blue-ridge.jpg');
  });

  it('does not expose extra product fields beyond the mapped set', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-extra',
        title: 'Extra Fields Check',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-extra',
      },
    ]);
    __seed('Stores/Products', [
      {
        _id: 'prod-extra',
        name: 'Asheville Sofa',
        slug: 'asheville-sofa',
        price: 1299,
        formattedPrice: '$1,299.00',
        discountedPrice: null,
        formattedDiscountedPrice: null,
        mainMedia: 'img.jpg',
        sku: 'ASH-001',
        inventory: 10,
        weight: 85,
      },
    ]);

    const promo = await getActivePromotion();
    const prod = promo.products[0];
    const keys = Object.keys(prod);
    expect(keys).toEqual(expect.arrayContaining([
      '_id', 'name', 'slug', 'price', 'formattedPrice',
      'discountedPrice', 'formattedDiscountedPrice', 'mainMedia',
    ]));
    expect(prod).not.toHaveProperty('sku');
    expect(prod).not.toHaveProperty('inventory');
    expect(prod).not.toHaveProperty('weight');
  });

  it('returns fewer products when some product IDs have no matching store record', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-missing',
        title: 'Missing Product Check',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-exists, prod-ghost',
      },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-exists', name: 'Found Product', slug: 'found', price: 199, mainMedia: 'img.jpg' },
      // prod-ghost intentionally missing
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(1);
    expect(promo.products[0]._id).toBe('prod-exists');
  });

  // ── productIds parsing ─────────────────────────────────────────────

  it('treats whitespace-only productIds as empty (no product fetch)', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-ws',
        title: 'Whitespace IDs',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '   ',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.products).toEqual([]);
  });

  it('handles single productId with no commas', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-single',
        title: 'Single Product',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-solo',
      },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-solo', name: 'Solo Futon', slug: 'solo', price: 599, mainMedia: 'solo.jpg' },
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(1);
    expect(promo.products[0].name).toBe('Solo Futon');
  });

  it('handles productIds with trailing comma', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-trailing',
        title: 'Trailing Comma',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: 'prod-a, prod-b,',
      },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-a', name: 'Product A', slug: 'a', price: 100, mainMedia: 'a.jpg' },
      { _id: 'prod-b', name: 'Product B', slug: 'b', price: 200, mainMedia: 'b.jpg' },
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(2);
  });

  it('handles productIds with extra spaces around values', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-spaces',
        title: 'Spaces Check',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '  prod-x ,  prod-y  , prod-z  ',
      },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-x', name: 'X', slug: 'x', price: 10, mainMedia: 'x.jpg' },
      { _id: 'prod-y', name: 'Y', slug: 'y', price: 20, mainMedia: 'y.jpg' },
      { _id: 'prod-z', name: 'Z', slug: 'z', price: 30, mainMedia: 'z.jpg' },
    ]);

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(3);
    const names = promo.products.map(p => p.name);
    expect(names).toContain('X');
    expect(names).toContain('Y');
    expect(names).toContain('Z');
  });

  // ── Edge cases on promo fields ─────────────────────────────────────

  it('returns promo even when subtitle, theme, and heroImage are null', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-nulls',
        title: 'Minimal Promo',
        subtitle: null,
        theme: null,
        heroImage: null,
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'MIN10',
        discountPercent: 10,
        ctaUrl: '/sale',
        ctaText: 'Go',
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Minimal Promo');
    expect(promo.subtitle).toBeNull();
    expect(promo.theme).toBeNull();
    expect(promo.heroImage).toBeNull();
  });

  it('returns promo when subtitle, theme, heroImage are undefined', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-undef',
        title: 'Bare Bones',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'BARE',
        discountPercent: 5,
        ctaUrl: '/',
        ctaText: 'Shop',
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Bare Bones');
    expect(promo.subtitle).toBeUndefined();
    expect(promo.theme).toBeUndefined();
    expect(promo.heroImage).toBeUndefined();
  });

  it('includes promotion exactly at startDate boundary (now = startDate)', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-start-boundary',
        title: 'Start Boundary',
        isActive: true,
        startDate: now,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    // le('startDate', now) means startDate <= now, so startDate === now should match
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Start Boundary');
  });

  it('includes promotion at endDate boundary (endDate just barely in range)', async () => {
    // The source creates its own new Date() at call time, so we set endDate
    // slightly in the future to ensure endDate >= functionNow
    const almostNow = new Date(Date.now() + 500);
    __seed('Promotions', [
      {
        _id: 'promo-end-boundary',
        title: 'End Boundary',
        isActive: true,
        startDate: lastWeek,
        endDate: almostNow,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    // ge('endDate', now) means endDate >= now — endDate just barely ahead passes
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('End Boundary');
  });

  // ── Error handling ─────────────────────────────────────────────────

  it('returns null and logs error when CMS query throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const querySpy = vi.spyOn(wixData, 'query').mockImplementation(() => {
      throw new Error('CMS unavailable');
    });

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching active promotion:',
      expect.any(Error)
    );

    querySpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('returns null when query().find() rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const querySpy = vi.spyOn(wixData, 'query').mockImplementation(() => ({
      eq() { return this; },
      le() { return this; },
      ge() { return this; },
      descending() { return this; },
      limit() { return this; },
      async find() { throw new Error('Timeout'); },
    }));

    const promo = await getActivePromotion();
    expect(promo).toBeNull();

    querySpy.mockRestore();
    consoleSpy.mockRestore();
  });

  // ── Product count / limit ──────────────────────────────────────────

  it('sets product query limit to match the number of IDs', async () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5'];
    __seed('Promotions', [
      {
        _id: 'promo-many',
        title: 'Many Products',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: ids.join(', '),
      },
    ]);
    __seed('Stores/Products', ids.map((id, i) => ({
      _id: id,
      name: `Product ${i + 1}`,
      slug: `product-${i + 1}`,
      price: (i + 1) * 100,
      formattedPrice: `$${(i + 1) * 100}.00`,
      discountedPrice: null,
      formattedDiscountedPrice: null,
      mainMedia: `img-${i + 1}.jpg`,
    })));

    const promo = await getActivePromotion();
    expect(promo.products).toHaveLength(5);
    expect(promo.products.map(p => p._id)).toEqual(ids);
  });

  // ── Date precision ─────────────────────────────────────────────────

  it('includes a promotion that started 1 second ago', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-just-started',
        title: 'Just Started',
        isActive: true,
        startDate: oneSecondAgo,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.title).toBe('Just Started');
  });

  it('excludes a promotion that starts 1 second from now', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-not-yet',
        title: 'Not Yet',
        isActive: true,
        startDate: oneSecondFromNow,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).toBeNull();
  });

  // ── productIds falsy / absent ──────────────────────────────────────

  it('returns empty products when productIds is null', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-null-ids',
        title: 'Null IDs',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: null,
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.products).toEqual([]);
  });

  it('returns empty products when productIds is undefined (field missing)', async () => {
    __seed('Promotions', [
      {
        _id: 'promo-undef-ids',
        title: 'Undefined IDs',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        // productIds intentionally omitted
      },
    ]);

    const promo = await getActivePromotion();
    expect(promo).not.toBeNull();
    expect(promo.products).toEqual([]);
  });
});
