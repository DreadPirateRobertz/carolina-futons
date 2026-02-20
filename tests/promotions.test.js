import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { getActivePromotion } from '../src/backend/promotions.web.js';

const now = new Date();
const yesterday = new Date(now.getTime() - 86400000);
const tomorrow = new Date(now.getTime() + 86400000);
const lastWeek = new Date(now.getTime() - 7 * 86400000);
const nextWeek = new Date(now.getTime() + 7 * 86400000);

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
});
