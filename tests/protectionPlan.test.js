import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix modules
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => (val || '').toString().substring(0, max),
  validateId: (val) => {
    if (typeof val !== 'string') return '';
    const cleaned = val.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(),
    get: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import wixData from 'wix-data';
import {
  getProtectionPlans,
  addProtectionPlan,
  removeProtectionPlan,
  getProtectionPlanSummary,
  PLAN_TIERS,
} from '../src/backend/protectionPlan.web.js';

/** Build a fresh chainable wixData.query mock */
function setupQueryMock(findResult = { items: [], totalCount: 0 }) {
  const findFn = vi.fn().mockResolvedValue(findResult);
  const chain = {
    eq: vi.fn(),
    ne: vi.fn(),
    ge: vi.fn(),
    le: vi.fn(),
    gt: vi.fn(),
    hasSome: vi.fn(),
    ascending: vi.fn(),
    descending: vi.fn(),
    limit: vi.fn(),
    find: findFn,
  };
  // All chain methods return the chain object
  for (const key of Object.keys(chain)) {
    if (key !== 'find') chain[key].mockReturnValue(chain);
  }
  wixData.query.mockReturnValue(chain);
  return { chain, findFn };
}

describe('protectionPlan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set up safe defaults
    wixData.get.mockResolvedValue(null);
    wixData.insert.mockImplementation(async (col, data) => ({ ...data, _id: data._id || 'new-id' }));
    wixData.update.mockImplementation(async (col, data) => data);
    wixData.remove.mockResolvedValue(undefined);
    setupQueryMock();
  });

  describe('PLAN_TIERS', () => {
    it('defines three plan tiers', () => {
      expect(Object.keys(PLAN_TIERS)).toHaveLength(3);
      expect(PLAN_TIERS).toHaveProperty('basic');
      expect(PLAN_TIERS).toHaveProperty('extended');
      expect(PLAN_TIERS).toHaveProperty('premium');
    });

    it('each tier has required properties', () => {
      for (const tier of Object.values(PLAN_TIERS)) {
        expect(tier).toHaveProperty('name');
        expect(tier).toHaveProperty('durationYears');
        expect(tier).toHaveProperty('pricePercent');
        expect(tier).toHaveProperty('coverage');
        expect(Array.isArray(tier.coverage)).toBe(true);
        expect(tier.coverage.length).toBeGreaterThan(0);
        expect(tier.durationYears).toBeGreaterThan(0);
        expect(tier.pricePercent).toBeGreaterThan(0);
        expect(tier.pricePercent).toBeLessThanOrEqual(25);
      }
    });

    it('premium tier costs more than extended, extended more than basic', () => {
      expect(PLAN_TIERS.premium.pricePercent).toBeGreaterThan(PLAN_TIERS.extended.pricePercent);
      expect(PLAN_TIERS.extended.pricePercent).toBeGreaterThan(PLAN_TIERS.basic.pricePercent);
    });
  });

  describe('getProtectionPlans', () => {
    it('returns empty for null/undefined product IDs', async () => {
      expect(await getProtectionPlans(null)).toEqual({ success: true, plans: [] });
      expect(await getProtectionPlans(undefined)).toEqual({ success: true, plans: [] });
    });

    it('returns empty for empty array', async () => {
      const result = await getProtectionPlans([]);
      expect(result).toEqual({ success: true, plans: [] });
    });

    it('returns plans for valid product IDs', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1',
        name: 'Oak Futon Frame',
        price: 599,
        collections: ['futon-frames'],
      });

      const result = await getProtectionPlans(['prod1']);
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].productId).toBe('prod1');
      expect(result.plans[0].productName).toBe('Oak Futon Frame');
      expect(result.plans[0].tiers).toHaveLength(3);
    });

    it('calculates correct prices for each tier', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1',
        name: 'Frame',
        price: 1000,
        collections: ['futon-frames'],
      });

      const result = await getProtectionPlans(['prod1']);
      const tiers = result.plans[0].tiers;

      for (const tier of tiers) {
        const expectedPrice = 1000 * (PLAN_TIERS[tier.id].pricePercent / 100);
        expect(tier.price).toBe(Math.round(expectedPrice * 100) / 100);
      }
    });

    it('handles multiple products', async () => {
      wixData.get
        .mockResolvedValueOnce({
          _id: 'prod1', name: 'Frame', price: 500, collections: ['futon-frames'],
        })
        .mockResolvedValueOnce({
          _id: 'prod2', name: 'Mattress', price: 300, collections: ['mattresses'],
        });

      const result = await getProtectionPlans(['prod1', 'prod2']);
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(2);
    });

    it('skips products that are not found', async () => {
      wixData.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          _id: 'prod2', name: 'Mattress', price: 300, collections: ['mattresses'],
        });

      const result = await getProtectionPlans(['bad-id', 'prod2']);
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].productId).toBe('prod2');
    });

    it('limits to max 10 products', async () => {
      const ids = Array.from({ length: 15 }, (_, i) => `prod${i}`);
      for (let i = 0; i < 10; i++) {
        wixData.get.mockResolvedValueOnce({
          _id: `prod${i}`, name: `Product ${i}`, price: 100, collections: ['futon-frames'],
        });
      }

      await getProtectionPlans(ids);
      expect(wixData.get).toHaveBeenCalledTimes(10);
    });

    it('sanitizes product IDs', async () => {
      await getProtectionPlans(['<script>alert(1)</script>']);
      expect(wixData.get).not.toHaveBeenCalled();
    });

    it('skips products with price of 0 or negative', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Free Item', price: 0, collections: ['futon-frames'],
      });

      const result = await getProtectionPlans(['prod1']);
      expect(result.plans).toHaveLength(0);
    });

    it('handles individual product fetch errors gracefully', async () => {
      wixData.get.mockRejectedValueOnce(new Error('DB error'));

      const result = await getProtectionPlans(['prod1']);
      expect(result.success).toBe(true);
      expect(result.plans).toEqual([]);
    });

    it('returns failure on catastrophic query error', async () => {
      wixData.query.mockImplementationOnce(() => { throw new Error('DB down'); });

      const result = await getProtectionPlans(['prod1'], 'sess1');
      expect(result.success).toBe(false);
      expect(result.plans).toEqual([]);
    });

    it('includes existing protection selections from CMS', async () => {
      // Set up query to return existing selection
      const { findFn } = setupQueryMock();
      findFn.mockResolvedValueOnce({
        items: [{ _id: 'sel1', productId: 'prod1', tier: 'extended', sessionId: 'sess1' }],
        totalCount: 1,
      });

      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Frame', price: 500, collections: ['futon-frames'],
      });

      const result = await getProtectionPlans(['prod1'], 'sess1');
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].selectedTier).toBe('extended');
    });
  });

  describe('addProtectionPlan', () => {
    it('rejects missing product ID', async () => {
      const result = await addProtectionPlan(null, 'basic');
      expect(result.success).toBe(false);
    });

    it('rejects missing tier', async () => {
      const result = await addProtectionPlan('prod1', null);
      expect(result.success).toBe(false);
    });

    it('rejects invalid tier name', async () => {
      const result = await addProtectionPlan('prod1', 'invalid-tier');
      expect(result.success).toBe(false);
    });

    it('rejects invalid product ID format', async () => {
      const result = await addProtectionPlan('<script>', 'basic');
      expect(result.success).toBe(false);
    });

    it('adds a protection plan successfully', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Frame', price: 500, collections: ['futon-frames'],
      });

      const { findFn } = setupQueryMock();
      findFn.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await addProtectionPlan('prod1', 'basic', 'sess1');
      expect(result.success).toBe(true);
      expect(result.data.productId).toBe('prod1');
      expect(result.data.tier).toBe('basic');
      expect(result.data.price).toBeGreaterThan(0);
      expect(wixData.insert).toHaveBeenCalledWith(
        'ProtectionPlanSelections',
        expect.objectContaining({
          productId: 'prod1',
          tier: 'basic',
        })
      );
    });

    it('updates existing selection instead of duplicating', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Frame', price: 500, collections: ['futon-frames'],
      });

      const { findFn } = setupQueryMock();
      findFn.mockResolvedValueOnce({
        items: [{ _id: 'existing1', productId: 'prod1', tier: 'basic', sessionId: 'sess1' }],
        totalCount: 1,
      });

      const result = await addProtectionPlan('prod1', 'extended', 'sess1');
      expect(result.success).toBe(true);
      expect(result.data.tier).toBe('extended');
      expect(wixData.update).toHaveBeenCalled();
      expect(wixData.insert).not.toHaveBeenCalled();
    });

    it('rejects when product not found', async () => {
      wixData.get.mockResolvedValue(null);

      const result = await addProtectionPlan('prod1', 'basic', 'sess1');
      expect(result.success).toBe(false);
    });

    it('handles DB errors gracefully', async () => {
      wixData.get.mockRejectedValueOnce(new Error('DB error'));

      const result = await addProtectionPlan('prod1', 'basic', 'sess1');
      expect(result.success).toBe(false);
    });
  });

  describe('removeProtectionPlan', () => {
    it('rejects missing product ID', async () => {
      const result = await removeProtectionPlan(null, 'sess1');
      expect(result.success).toBe(false);
    });

    it('removes existing selection', async () => {
      const { findFn } = setupQueryMock();
      findFn.mockResolvedValueOnce({
        items: [{ _id: 'sel1', productId: 'prod1', tier: 'basic', sessionId: 'sess1' }],
        totalCount: 1,
      });

      const result = await removeProtectionPlan('prod1', 'sess1');
      expect(result.success).toBe(true);
      expect(wixData.remove).toHaveBeenCalledWith('ProtectionPlanSelections', 'sel1');
    });

    it('succeeds even if no selection exists', async () => {
      const result = await removeProtectionPlan('prod1', 'sess1');
      expect(result.success).toBe(true);
    });

    it('handles DB errors gracefully', async () => {
      wixData.query.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await removeProtectionPlan('prod1', 'sess1');
      expect(result.success).toBe(false);
    });
  });

  describe('getProtectionPlanSummary', () => {
    it('returns empty summary for no session', async () => {
      const result = await getProtectionPlanSummary(null);
      expect(result.success).toBe(true);
      expect(result.data.selections).toEqual([]);
      expect(result.data.totalProtectionCost).toBe(0);
    });

    it('returns selections for a session', async () => {
      const { findFn } = setupQueryMock();
      findFn.mockResolvedValueOnce({
        items: [
          { _id: 'sel1', productId: 'prod1', tier: 'basic', price: 30, productName: 'Frame' },
          { _id: 'sel2', productId: 'prod2', tier: 'extended', price: 45, productName: 'Mattress' },
        ],
        totalCount: 2,
      });

      const result = await getProtectionPlanSummary('sess1');
      expect(result.success).toBe(true);
      expect(result.data.selections).toHaveLength(2);
      expect(result.data.totalProtectionCost).toBe(75);
    });

    it('handles DB errors gracefully', async () => {
      wixData.query.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await getProtectionPlanSummary('sess1');
      expect(result.success).toBe(false);
      expect(result.data.selections).toEqual([]);
      expect(result.data.totalProtectionCost).toBe(0);
    });
  });
});
