/**
 * @file productPassport.test.js
 * @description Tests for the product passport + resale module (cf-zc6r).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  createPassport,
  getPassport,
  createResaleListing,
  browseListings,
  _estimateResaleValue,
  _estimateTradeUpCredit,
  _DEPRECIATION_YEAR_1,
  _TRADE_UP_BONUS_PERCENT,
} from '../src/backend/productPassport.web.js';

beforeEach(() => {
  __reset();
});

// ── Passport Creation ───────────────────────────────────────────────

describe('createPassport', () => {
  it('creates a passport for a purchased item', async () => {
    __seed('ProductPassports', []);

    const result = await createPassport({
      orderId: 'order-001',
      productId: 'prod-001',
      productName: 'Eureka Futon Frame',
      purchasePrice: 499,
      memberId: 'mem-1',
      materials: 'Solid plantation hardwood, cherry finish',
      manufacturer: 'Night & Day Furniture',
      warrantyYears: '10',
    });

    expect(result.success).toBe(true);
    expect(result.passportId).toBeTruthy();

    const inserted = __getInserted('ProductPassports');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].productName).toBe('Eureka Futon Frame');
    expect(inserted[0].status).toBe('active');
    expect(inserted[0].condition).toBe('new');
    expect(inserted[0].warrantyYears).toBe(10);
  });

  it('returns existing passport if already created for order+product', async () => {
    __seed('ProductPassports', [
      { _id: 'existing-1', orderId: 'order-001', productId: 'prod-001' },
    ]);

    const result = await createPassport({
      orderId: 'order-001',
      productId: 'prod-001',
      productName: 'Eureka',
      purchasePrice: 499,
      memberId: 'mem-1',
    });

    expect(result.success).toBe(true);
    // Returns existing passport ID (dedup by orderId+productId)
    expect(result.passportId).toBeTruthy();
  });

  it('requires all mandatory fields', async () => {
    const result = await createPassport({ orderId: 'order-001' });
    expect(result.success).toBe(false);
  });

  it('rejects zero or negative price', async () => {
    const result = await createPassport({
      orderId: 'o1', productId: 'p1', productName: 'Test', purchasePrice: 0, memberId: 'm1',
    });
    expect(result.success).toBe(false);
  });

  it('logs to AuditLog', async () => {
    __seed('ProductPassports', []);
    await createPassport({
      orderId: 'o1', productId: 'p1', productName: 'Frame', purchasePrice: 300, memberId: 'm1',
    });
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('create');
  });
});

// ── Get Passport ────────────────────────────────────────────────────

describe('getPassport', () => {
  it('returns passport with care history', async () => {
    __seed('ProductPassports', [
      { _id: 'pp-1', productName: 'Eureka', purchasePrice: 499, purchaseDate: new Date('2025-06-01'), status: 'active' },
    ]);
    __seed('PassportCareLog', [
      { passportId: 'pp-1', eventType: 'cleaned', notes: 'Deep cleaned upholstery', loggedAt: new Date() },
    ]);

    const result = await getPassport('pp-1');
    expect(result.success).toBe(true);
    expect(result.passport.productName).toBe('Eureka');
    expect(result.passport.resaleValue).toBeGreaterThan(0);
    expect(result.passport.careHistory).toHaveLength(1);
    expect(result.passport.careHistory[0].eventType).toBe('cleaned');
  });

  it('returns failure for unknown passport', async () => {
    __seed('ProductPassports', []);
    const result = await getPassport('nonexistent');
    expect(result.success).toBe(false);
  });
});

// ── Resale Value Estimation ─────────────────────────────────────────

describe('estimateResaleValue', () => {
  it('new item retains full value', () => {
    const value = _estimateResaleValue(500, new Date());
    expect(value).toBe(500);
  });

  it('depreciates 15% in first year', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const value = _estimateResaleValue(1000, oneYearAgo);
    expect(value).toBe(850); // 1000 * (1 - 0.15) = 850
  });

  it('depreciates 10% per year after first year', () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const value = _estimateResaleValue(1000, twoYearsAgo);
    expect(value).toBe(765); // 1000 * 0.85 * 0.90 = 765
  });

  it('never drops below 20% floor', () => {
    const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
    const value = _estimateResaleValue(1000, tenYearsAgo);
    expect(value).toBe(200); // 20% floor
  });

  it('returns 0 for zero price', () => {
    expect(_estimateResaleValue(0, new Date())).toBe(0);
  });
});

describe('estimateTradeUpCredit', () => {
  it('adds 10% bonus on top of resale value', () => {
    const credit = _estimateTradeUpCredit(500, new Date());
    const resale = _estimateResaleValue(500, new Date());
    expect(credit).toBe(Math.round(resale * 1.10));
  });

  it('bonus applies to depreciated value', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const credit = _estimateTradeUpCredit(1000, oneYearAgo);
    // Resale: 850, Trade-up: 850 * 1.10 = 935
    expect(credit).toBe(935);
  });
});

// ── Resale Listings ─────────────────────────────────────────────────

describe('createResaleListing', () => {
  it('rejects invalid condition', async () => {
    const result = await createResaleListing('pp-1', 300, 'broken', 'test');
    expect(result.success).toBe(false);
  });

  it('rejects zero asking price', async () => {
    const result = await createResaleListing('pp-1', 0, 'good', 'test');
    expect(result.success).toBe(false);
  });
});

describe('browseListings', () => {
  it('returns active listings sorted by date', async () => {
    __seed('ResaleListings', [
      { _id: 'l-1', productName: 'Frame A', askingPrice: 300, status: 'active', listedAt: new Date(), condition: 'good' },
      { _id: 'l-2', productName: 'Frame B', askingPrice: 500, status: 'active', listedAt: new Date(), condition: 'excellent' },
      { _id: 'l-3', productName: 'Frame C', askingPrice: 200, status: 'sold', listedAt: new Date() },
    ]);

    const result = await browseListings();
    expect(result.success).toBe(true);
    expect(result.listings).toHaveLength(2); // excludes sold
  });

  it('filters by max price', async () => {
    __seed('ResaleListings', [
      { _id: 'l-1', productName: 'Cheap', askingPrice: 200, status: 'active', listedAt: new Date() },
      { _id: 'l-2', productName: 'Expensive', askingPrice: 800, status: 'active', listedAt: new Date() },
    ]);

    const result = await browseListings({ maxPrice: 500 });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].productName).toBe('Cheap');
  });

  it('returns empty for no listings', async () => {
    __seed('ResaleListings', []);
    const result = await browseListings();
    expect(result.listings).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('product passport constants', () => {
  it('year 1 depreciation is 15%', () => {
    expect(_DEPRECIATION_YEAR_1).toBe(0.15);
  });

  it('trade-up bonus is 10%', () => {
    expect(_TRADE_UP_BONUS_PERCENT).toBe(0.10);
  });
});
