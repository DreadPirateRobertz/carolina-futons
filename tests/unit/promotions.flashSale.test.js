import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed } from '../__mocks__/wix-data.js';
import wixData from '../__mocks__/wix-data.js';
import { getFlashSales } from '../../src/backend/promotions.web.js';

const now = new Date();
const yesterday = new Date(now.getTime() - 86400000);
const tomorrow = new Date(now.getTime() + 86400000);
const lastWeek = new Date(now.getTime() - 7 * 86400000);
const nextWeek = new Date(now.getTime() + 7 * 86400000);
const twoHoursFromNow = new Date(now.getTime() + 2 * 3600000);

// ── getFlashSales ───────────────────────────────────────────────────

describe('getFlashSales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns active flash sale promotions', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-1',
        title: 'Weekend Flash Sale',
        subtitle: '48-Hour Blowout',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'FLASH20',
        discountPercent: 20,
        bannerMessage: 'Limited time — 20% off everything!',
        categoryScope: '',
        urgencyThreshold: 24,
        ctaUrl: '/flash-sale',
        ctaText: 'Shop Flash Sale',
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toHaveLength(1);
    expect(deals[0].title).toBe('Weekend Flash Sale');
    expect(deals[0].discountCode).toBe('FLASH20');
    expect(deals[0].type).toBe('flash_sale');
  });

  it('returns empty array when no flash sales exist', async () => {
    __seed('Promotions', []);
    const deals = await getFlashSales();
    expect(deals).toEqual([]);
  });

  it('excludes non-flash_sale type promotions', async () => {
    __seed('Promotions', [
      {
        _id: 'general-1',
        title: 'General Sale',
        type: 'general',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toEqual([]);
  });

  it('excludes inactive flash sales', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-inactive',
        title: 'Inactive Flash',
        type: 'flash_sale',
        isActive: false,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toEqual([]);
  });

  it('excludes flash sales that have not started', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-future',
        title: 'Future Flash',
        type: 'flash_sale',
        isActive: true,
        startDate: tomorrow,
        endDate: nextWeek,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toEqual([]);
  });

  it('excludes flash sales that have ended', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-past',
        title: 'Expired Flash',
        type: 'flash_sale',
        isActive: true,
        startDate: lastWeek,
        endDate: yesterday,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toEqual([]);
  });

  it('filters by categoryScope when categorySlug provided', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-frames',
        title: 'Frames Flash Sale',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: 'futon-frames',
        productIds: '',
      },
      {
        _id: 'flash-mattresses',
        title: 'Mattress Flash',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: 'mattresses',
        productIds: '',
      },
    ]);

    const deals = await getFlashSales('futon-frames');
    expect(deals).toHaveLength(1);
    expect(deals[0]._id).toBe('flash-frames');
  });

  it('returns sitewide flash sales (empty categoryScope) regardless of filter', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-sitewide',
        title: 'Sitewide Flash',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: '',
        productIds: '',
      },
    ]);

    const deals = await getFlashSales('futon-frames');
    expect(deals).toHaveLength(1);
    expect(deals[0]._id).toBe('flash-sitewide');
  });

  it('returns all flash sales when no categorySlug provided', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-a',
        title: 'Flash A',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: 'futon-frames',
        productIds: '',
      },
      {
        _id: 'flash-b',
        title: 'Flash B',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: '',
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toHaveLength(2);
  });

  it('returns all expected fields', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-full',
        title: 'Full Flash',
        subtitle: 'All the fields',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: 'FULL30',
        discountPercent: 30,
        bannerMessage: 'Custom banner!',
        categoryScope: 'covers',
        urgencyThreshold: 12,
        ctaUrl: '/flash',
        ctaText: 'Shop Now',
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    const deal = deals[0];
    expect(deal).toHaveProperty('_id');
    expect(deal).toHaveProperty('title');
    expect(deal).toHaveProperty('subtitle');
    expect(deal).toHaveProperty('type');
    expect(deal).toHaveProperty('startDate');
    expect(deal).toHaveProperty('endDate');
    expect(deal).toHaveProperty('discountCode');
    expect(deal).toHaveProperty('discountPercent');
    expect(deal).toHaveProperty('bannerMessage');
    expect(deal).toHaveProperty('categoryScope');
    expect(deal).toHaveProperty('urgencyThreshold');
    expect(deal).toHaveProperty('ctaUrl');
    expect(deal).toHaveProperty('ctaText');
  });

  it('sanitizes categorySlug input', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-xss',
        title: 'XSS Test',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        categoryScope: 'frames',
        productIds: '',
      },
    ]);

    // Malicious input should be sanitized and not match
    const deals = await getFlashSales('<script>alert("xss")</script>');
    expect(deals).toEqual([]);
  });

  it('returns empty array and logs error when CMS query throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const querySpy = vi.spyOn(wixData, 'query').mockImplementation(() => {
      throw new Error('CMS unavailable');
    });

    const deals = await getFlashSales();
    expect(deals).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching flash sales:',
      expect.any(Error)
    );

    querySpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('returns empty array when query().find() rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const querySpy = vi.spyOn(wixData, 'query').mockImplementation(() => ({
      eq() { return this; },
      le() { return this; },
      ge() { return this; },
      descending() { return this; },
      limit() { return this; },
      async find() { throw new Error('Timeout'); },
    }));

    const deals = await getFlashSales();
    expect(deals).toEqual([]);

    querySpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('handles null/undefined fields gracefully', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-nulls',
        title: 'Minimal Flash',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        discountCode: null,
        discountPercent: null,
        bannerMessage: null,
        categoryScope: null,
        urgencyThreshold: null,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    expect(deals).toHaveLength(1);
    expect(deals[0].title).toBe('Minimal Flash');
  });

  it('limits results to 10', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      _id: `flash-${i}`,
      title: `Flash ${i}`,
      type: 'flash_sale',
      isActive: true,
      startDate: yesterday,
      endDate: nextWeek,
      productIds: '',
    }));
    __seed('Promotions', items);

    const deals = await getFlashSales();
    expect(deals.length).toBeLessThanOrEqual(10);
  });

  it('orders by endDate ascending (soonest ending first)', async () => {
    __seed('Promotions', [
      {
        _id: 'flash-later',
        title: 'Ends Later',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: nextWeek,
        productIds: '',
      },
      {
        _id: 'flash-soon',
        title: 'Ends Soon',
        type: 'flash_sale',
        isActive: true,
        startDate: yesterday,
        endDate: twoHoursFromNow,
        productIds: '',
      },
    ]);

    const deals = await getFlashSales();
    // The one ending sooner should appear first
    expect(deals[0]._id).toBe('flash-soon');
  });
});
