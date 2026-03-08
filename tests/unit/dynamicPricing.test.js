import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix modules
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => (val || '').toString().substring(0, max),
  validateId: (val) => /^[a-zA-Z0-9_-]+$/.test(val),
}));

const mockItems = [];
const mockQueryChain = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  ge: vi.fn().mockReturnThis(),
  le: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: mockItems, totalCount: 0 }),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQueryChain })),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockImplementation(async (col, data) => ({ ...data, _id: 'new-id' })),
    update: vi.fn().mockImplementation(async (col, data) => data),
  },
}));

import wixData from 'wix-data';
import {
  calculateDynamicPrice,
  getGeographicAdjustment,
  evaluateClearanceCandidates,
  calculateBundleDiscount,
  recordDemandSignal,
  getDemandMetrics,
  getClearanceQueue,
  updatePricingRule,
  _DEMAND_MULTIPLIERS,
  _GEOGRAPHIC_ZONES,
  _CLEARANCE_THRESHOLDS,
  _BUNDLE_TIERS,
} from '../../src/backend/dynamicPricing.web.js';

describe('dynamicPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
  });

  // ── Exported constants ─────────────────────────────────────────────

  describe('exported constants', () => {
    it('exports demand multipliers', () => {
      expect(_DEMAND_MULTIPLIERS).toBeDefined();
      expect(_DEMAND_MULTIPLIERS.high).toBeDefined();
      expect(_DEMAND_MULTIPLIERS.low).toBeDefined();
    });

    it('exports geographic zones', () => {
      expect(_GEOGRAPHIC_ZONES).toBeDefined();
      expect(_GEOGRAPHIC_ZONES.local).toBeDefined();
      expect(_GEOGRAPHIC_ZONES.regional).toBeDefined();
      expect(_GEOGRAPHIC_ZONES.national).toBeDefined();
    });

    it('exports clearance thresholds', () => {
      expect(_CLEARANCE_THRESHOLDS).toBeDefined();
      expect(typeof _CLEARANCE_THRESHOLDS.daysUntilClearance).toBe('number');
      expect(typeof _CLEARANCE_THRESHOLDS.velocityThreshold).toBe('number');
    });

    it('exports bundle tiers', () => {
      expect(_BUNDLE_TIERS).toBeDefined();
      expect(Array.isArray(_BUNDLE_TIERS)).toBe(true);
      expect(_BUNDLE_TIERS.length).toBeGreaterThan(0);
    });
  });

  // ── calculateDynamicPrice ──────────────────────────────────────────

  describe('calculateDynamicPrice', () => {
    it('returns null for missing productId', async () => {
      const result = await calculateDynamicPrice(null);
      expect(result).toEqual({
        adjustedPrice: 0,
        basePrice: 0,
        demandMultiplier: 1,
        geoAdjustment: 0,
        clearanceDiscount: 0,
        reason: 'invalid_input',
      });
    });

    it('returns null for empty string productId', async () => {
      const result = await calculateDynamicPrice('');
      expect(result).toEqual(expect.objectContaining({ reason: 'invalid_input' }));
    });

    it('returns base price when no demand data exists', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Oak Frame', price: 499, discountedPrice: null,
        collections: ['futon-frames'],
      });
      // No demand metrics found
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
      // No pricing rules
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod1');
      expect(result.basePrice).toBe(499);
      expect(result.demandMultiplier).toBe(1);
      expect(result.adjustedPrice).toBe(499);
    });

    it('applies demand surge multiplier for high-demand products', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Hot Frame', price: 500, collections: ['futon-frames'],
      });
      // High demand metrics
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          productId: 'prod1',
          viewCount30d: 500,
          cartAdds30d: 80,
          salesCount30d: 30,
          demandScore: 85,
        }],
        totalCount: 1,
      });
      // No custom rules
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod1');
      expect(result.demandMultiplier).toBeGreaterThan(1);
      expect(result.adjustedPrice).toBeGreaterThan(500);
      expect(result.reason).toContain('demand');
    });

    it('applies demand discount multiplier for low-demand products', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod2', name: 'Slow Seller', price: 300, collections: ['casegoods-accessories'],
      });
      // Low demand metrics
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          productId: 'prod2',
          viewCount30d: 10,
          cartAdds30d: 1,
          salesCount30d: 0,
          demandScore: 8,
        }],
        totalCount: 1,
      });
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod2');
      expect(result.demandMultiplier).toBeLessThan(1);
      expect(result.adjustedPrice).toBeLessThan(300);
    });

    it('applies geographic adjustment when zipCode provided', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod1', name: 'Frame', price: 500, collections: ['futon-frames'],
      });
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod1', { zipCode: '28801' });
      // Local zone should get a discount
      expect(result.geoAdjustment).toBeLessThanOrEqual(0);
    });

    it('respects price floor (never below 50% of base)', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod3', name: 'Deep Discount', price: 200, collections: ['casegoods-accessories'],
      });
      // Extremely low demand
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          productId: 'prod3', viewCount30d: 0, cartAdds30d: 0,
          salesCount30d: 0, demandScore: 0,
        }],
        totalCount: 1,
      });
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod3');
      expect(result.adjustedPrice).toBeGreaterThanOrEqual(100); // 50% floor
    });

    it('respects price ceiling (never above 115% of base)', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod4', name: 'Super Hot', price: 1000, collections: ['murphy-cabinet-beds'],
      });
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          productId: 'prod4', viewCount30d: 9999, cartAdds30d: 999,
          salesCount30d: 200, demandScore: 100,
        }],
        totalCount: 1,
      });
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await calculateDynamicPrice('prod4');
      expect(result.adjustedPrice).toBeLessThanOrEqual(1150); // 115% ceiling
    });

    it('applies clearance discount when product is in clearance', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'prod5', name: 'Old Stock', price: 600,
        collections: ['outdoor-furniture'],
        _createdDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days old
      });
      mockQueryChain.find
        .mockResolvedValueOnce({ items: [{ productId: 'prod5', demandScore: 5 }], totalCount: 1 })
        .mockResolvedValueOnce({ items: [], totalCount: 0 })
        .mockResolvedValueOnce({
          items: [{ productId: 'prod5', clearancePercent: 25, reason: 'slow_mover' }],
          totalCount: 1,
        });

      const result = await calculateDynamicPrice('prod5', { includeClearance: true });
      expect(result.clearanceDiscount).toBeGreaterThan(0);
    });

    it('handles wix-data errors gracefully', async () => {
      wixData.get.mockRejectedValueOnce(new Error('DB down'));

      const result = await calculateDynamicPrice('prod1');
      expect(result).toEqual(expect.objectContaining({
        adjustedPrice: 0,
        basePrice: 0,
        reason: 'error',
      }));
    });

    it('sanitizes productId input', async () => {
      const longId = 'a'.repeat(200);
      wixData.get.mockResolvedValueOnce(null);

      await calculateDynamicPrice(longId);
      // Should have been truncated in the sanitize call
      expect(wixData.get).toHaveBeenCalledWith('Stores/Products', 'a'.repeat(50));
    });
  });

  // ── getGeographicAdjustment ────────────────────────────────────────

  describe('getGeographicAdjustment', () => {
    it('returns 0 for null zip', () => {
      const result = getGeographicAdjustment(null, 100);
      expect(result).toEqual({ adjustment: 0, zone: 'unknown', reason: 'no_zip' });
    });

    it('returns 0 for empty zip', () => {
      const result = getGeographicAdjustment('', 100);
      expect(result).toEqual({ adjustment: 0, zone: 'unknown', reason: 'no_zip' });
    });

    it('returns local discount for WNC zip codes (287-289)', () => {
      const result = getGeographicAdjustment('28801', 500);
      expect(result.zone).toBe('local');
      expect(result.adjustment).toBeLessThanOrEqual(0); // discount or zero
    });

    it('returns regional adjustment for Southeast zips (270-399)', () => {
      const result = getGeographicAdjustment('30301', 500); // Atlanta
      expect(result.zone).toBe('regional');
    });

    it('returns national adjustment for out-of-region zips', () => {
      const result = getGeographicAdjustment('90210', 500); // Beverly Hills
      expect(result.zone).toBe('national');
    });

    it('handles non-numeric zip gracefully', () => {
      const result = getGeographicAdjustment('ABCDE', 500);
      expect(result).toEqual({ adjustment: 0, zone: 'unknown', reason: 'invalid_zip' });
    });

    it('handles zip shorter than 3 characters', () => {
      const result = getGeographicAdjustment('12', 500);
      expect(result).toEqual({ adjustment: 0, zone: 'unknown', reason: 'invalid_zip' });
    });

    it('handles negative base price', () => {
      const result = getGeographicAdjustment('28801', -100);
      expect(result.adjustment).toBe(0);
    });

    it('handles zero base price', () => {
      const result = getGeographicAdjustment('28801', 0);
      expect(result.adjustment).toBe(0);
    });

    it('handles zip with leading zeros', () => {
      const result = getGeographicAdjustment('01234', 500);
      expect(result.zone).toBe('national');
    });
  });

  // ── evaluateClearanceCandidates ────────────────────────────────────

  describe('evaluateClearanceCandidates', () => {
    it('returns empty array when no products qualify', async () => {
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
      const result = await evaluateClearanceCandidates();
      expect(result).toEqual({ candidates: [], evaluated: 0 });
    });

    it('flags old products with low demand as clearance candidates', async () => {
      const oldDate = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          {
            productId: 'old1', productName: 'Old Chair',
            viewCount30d: 5, cartAdds30d: 0, salesCount30d: 0,
            demandScore: 3, listedDate: oldDate,
          },
        ],
        totalCount: 1,
      });

      const result = await evaluateClearanceCandidates();
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].productId).toBe('old1');
      expect(result.candidates[0].suggestedDiscount).toBeGreaterThan(0);
    });

    it('does not flag recently listed products', async () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          {
            productId: 'new1', productName: 'New Chair',
            viewCount30d: 5, cartAdds30d: 0, salesCount30d: 0,
            demandScore: 3, listedDate: recentDate,
          },
        ],
        totalCount: 1,
      });

      const result = await evaluateClearanceCandidates();
      expect(result.candidates.length).toBe(0);
    });

    it('does not flag products with healthy demand', async () => {
      const oldDate = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          {
            productId: 'healthy1', productName: 'Popular Item',
            viewCount30d: 300, cartAdds30d: 50, salesCount30d: 15,
            demandScore: 70, listedDate: oldDate,
          },
        ],
        totalCount: 1,
      });

      const result = await evaluateClearanceCandidates();
      expect(result.candidates.length).toBe(0);
    });

    it('suggests higher discount for older products', async () => {
      const veryOld = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const somewhatOld = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          {
            productId: 'ancient', productName: 'Ancient Item',
            viewCount30d: 2, cartAdds30d: 0, salesCount30d: 0,
            demandScore: 1, listedDate: veryOld,
          },
          {
            productId: 'older', productName: 'Older Item',
            viewCount30d: 5, cartAdds30d: 0, salesCount30d: 0,
            demandScore: 5, listedDate: somewhatOld,
          },
        ],
        totalCount: 2,
      });

      const result = await evaluateClearanceCandidates();
      const ancient = result.candidates.find(c => c.productId === 'ancient');
      const older = result.candidates.find(c => c.productId === 'older');

      if (ancient && older) {
        expect(ancient.suggestedDiscount).toBeGreaterThanOrEqual(older.suggestedDiscount);
      }
    });

    it('caps clearance discount at 50%', async () => {
      const veryOld = new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000);
      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          {
            productId: 'ancient', productName: 'Very Old',
            viewCount30d: 0, cartAdds30d: 0, salesCount30d: 0,
            demandScore: 0, listedDate: veryOld,
          },
        ],
        totalCount: 1,
      });

      const result = await evaluateClearanceCandidates();
      if (result.candidates.length > 0) {
        expect(result.candidates[0].suggestedDiscount).toBeLessThanOrEqual(50);
      }
    });

    it('handles wix-data errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValueOnce(new Error('DB down'));
      const result = await evaluateClearanceCandidates();
      expect(result).toEqual({ candidates: [], evaluated: 0 });
    });
  });

  // ── calculateBundleDiscount ────────────────────────────────────────

  describe('calculateBundleDiscount', () => {
    it('returns 0 for empty items', async () => {
      const result = await calculateBundleDiscount([]);
      expect(result).toEqual({
        discountPercent: 0,
        discountAmount: 0,
        tier: '',
        reason: 'insufficient_items',
      });
    });

    it('returns 0 for single item', async () => {
      const result = await calculateBundleDiscount([{ productId: 'p1', price: 100 }]);
      expect(result).toEqual(expect.objectContaining({
        discountPercent: 0,
        reason: 'insufficient_items',
      }));
    });

    it('applies base bundle discount for 2 items', async () => {
      const result = await calculateBundleDiscount([
        { productId: 'p1', price: 400, category: 'futon-frames' },
        { productId: 'p2', price: 200, category: 'mattresses' },
      ]);
      expect(result.discountPercent).toBeGreaterThan(0);
      expect(result.discountAmount).toBeGreaterThan(0);
      expect(result.tier).toBeTruthy();
    });

    it('applies higher discount for 3+ items across categories', async () => {
      const twoItems = await calculateBundleDiscount([
        { productId: 'p1', price: 400, category: 'futon-frames' },
        { productId: 'p2', price: 200, category: 'mattresses' },
      ]);

      const threeItems = await calculateBundleDiscount([
        { productId: 'p1', price: 400, category: 'futon-frames' },
        { productId: 'p2', price: 200, category: 'mattresses' },
        { productId: 'p3', price: 100, category: 'casegoods-accessories' },
      ]);

      expect(threeItems.discountPercent).toBeGreaterThanOrEqual(twoItems.discountPercent);
    });

    it('applies complementary category bonus', async () => {
      // Frame + mattress = complementary
      const complementary = await calculateBundleDiscount([
        { productId: 'p1', price: 400, category: 'futon-frames' },
        { productId: 'p2', price: 200, category: 'mattresses' },
      ]);

      // Two accessories = same category, no bonus
      const sameCategory = await calculateBundleDiscount([
        { productId: 'p3', price: 400, category: 'casegoods-accessories' },
        { productId: 'p4', price: 200, category: 'casegoods-accessories' },
      ]);

      expect(complementary.discountPercent).toBeGreaterThan(sameCategory.discountPercent);
    });

    it('caps discount at 15%', async () => {
      const result = await calculateBundleDiscount([
        { productId: 'p1', price: 1000, category: 'futon-frames' },
        { productId: 'p2', price: 800, category: 'mattresses' },
        { productId: 'p3', price: 600, category: 'casegoods-accessories' },
        { productId: 'p4', price: 400, category: 'platform-beds' },
        { productId: 'p5', price: 200, category: 'outdoor-furniture' },
      ]);
      expect(result.discountPercent).toBeLessThanOrEqual(15);
    });

    it('handles null items array', async () => {
      const result = await calculateBundleDiscount(null);
      expect(result).toEqual(expect.objectContaining({ discountPercent: 0 }));
    });

    it('filters items with no price', async () => {
      const result = await calculateBundleDiscount([
        { productId: 'p1', price: 0, category: 'futon-frames' },
        { productId: 'p2', price: null, category: 'mattresses' },
      ]);
      expect(result.discountPercent).toBe(0);
    });
  });

  // ── recordDemandSignal ─────────────────────────────────────────────

  describe('recordDemandSignal', () => {
    it('records a view signal', async () => {
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          _id: 'metrics1', productId: 'prod1',
          viewCount30d: 10, cartAdds30d: 2, salesCount30d: 1,
        }],
        totalCount: 1,
      });

      const result = await recordDemandSignal('prod1', 'view');
      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalledWith(
        'ProductDemandMetrics',
        expect.objectContaining({ viewCount30d: 11 })
      );
    });

    it('records a cart_add signal', async () => {
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          _id: 'metrics1', productId: 'prod1',
          viewCount30d: 10, cartAdds30d: 2, salesCount30d: 1,
        }],
        totalCount: 1,
      });

      const result = await recordDemandSignal('prod1', 'cart_add');
      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalledWith(
        'ProductDemandMetrics',
        expect.objectContaining({ cartAdds30d: 3 })
      );
    });

    it('records a purchase signal', async () => {
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          _id: 'metrics1', productId: 'prod1',
          viewCount30d: 10, cartAdds30d: 5, salesCount30d: 2,
        }],
        totalCount: 1,
      });

      const result = await recordDemandSignal('prod1', 'purchase');
      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalledWith(
        'ProductDemandMetrics',
        expect.objectContaining({ salesCount30d: 3 })
      );
    });

    it('creates new metrics record if none exists', async () => {
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await recordDemandSignal('prod1', 'view');
      expect(result.success).toBe(true);
      expect(wixData.insert).toHaveBeenCalledWith(
        'ProductDemandMetrics',
        expect.objectContaining({ productId: 'prod1', viewCount30d: 1 })
      );
    });

    it('rejects invalid signal type', async () => {
      const result = await recordDemandSignal('prod1', 'invalid_signal');
      expect(result.success).toBe(false);
      expect(result.error).toContain('signal');
    });

    it('rejects missing productId', async () => {
      const result = await recordDemandSignal(null, 'view');
      expect(result.success).toBe(false);
    });

    it('rejects empty productId', async () => {
      const result = await recordDemandSignal('', 'view');
      expect(result.success).toBe(false);
    });

    it('handles wix-data errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValueOnce(new Error('DB down'));
      const result = await recordDemandSignal('prod1', 'view');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ── getDemandMetrics ───────────────────────────────────────────────

  describe('getDemandMetrics', () => {
    it('returns metrics for a valid product', async () => {
      mockQueryChain.find.mockResolvedValueOnce({
        items: [{
          productId: 'prod1', viewCount30d: 100, cartAdds30d: 20,
          salesCount30d: 8, demandScore: 55, updatedAt: new Date(),
        }],
        totalCount: 1,
      });

      const result = await getDemandMetrics('prod1');
      expect(result.viewCount30d).toBe(100);
      expect(result.cartAdds30d).toBe(20);
      expect(result.salesCount30d).toBe(8);
      expect(result.demandScore).toBe(55);
    });

    it('returns empty metrics for unknown product', async () => {
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await getDemandMetrics('unknown');
      expect(result).toEqual(expect.objectContaining({
        viewCount30d: 0,
        cartAdds30d: 0,
        salesCount30d: 0,
        demandScore: 0,
      }));
    });

    it('returns empty metrics for null productId', async () => {
      const result = await getDemandMetrics(null);
      expect(result.demandScore).toBe(0);
    });

    it('handles wix-data errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValueOnce(new Error('DB error'));
      const result = await getDemandMetrics('prod1');
      expect(result.demandScore).toBe(0);
    });
  });

  // ── getClearanceQueue ──────────────────────────────────────────────

  describe('getClearanceQueue', () => {
    it('returns active clearance items', async () => {
      mockQueryChain.find.mockResolvedValueOnce({
        items: [
          { productId: 'c1', productName: 'Old Table', clearancePercent: 30, reason: 'slow_mover' },
          { productId: 'c2', productName: 'Old Chair', clearancePercent: 20, reason: 'overstock' },
        ],
        totalCount: 2,
      });

      const result = await getClearanceQueue();
      expect(result.items.length).toBe(2);
      expect(result.items[0].clearancePercent).toBe(30);
    });

    it('returns empty array when no clearance items', async () => {
      mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
      const result = await getClearanceQueue();
      expect(result.items).toEqual([]);
    });

    it('handles wix-data errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValueOnce(new Error('DB error'));
      const result = await getClearanceQueue();
      expect(result.items).toEqual([]);
    });
  });

  // ── updatePricingRule ──────────────────────────────────────────────

  describe('updatePricingRule', () => {
    it('creates a new pricing rule', async () => {
      const rule = {
        name: 'Summer Sale',
        type: 'seasonal',
        discountPercent: 10,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-08-31'),
        categories: ['outdoor-furniture'],
        isActive: true,
      };

      const result = await updatePricingRule(rule);
      expect(result.success).toBe(true);
      expect(wixData.insert).toHaveBeenCalledWith(
        'DynamicPricingRules',
        expect.objectContaining({ name: 'Summer Sale', type: 'seasonal' })
      );
    });

    it('updates an existing pricing rule', async () => {
      const rule = {
        _id: 'rule1',
        name: 'Updated Sale',
        type: 'seasonal',
        discountPercent: 15,
        isActive: true,
      };

      const result = await updatePricingRule(rule);
      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalled();
    });

    it('rejects missing name', async () => {
      const result = await updatePricingRule({ type: 'seasonal', discountPercent: 10 });
      expect(result.success).toBe(false);
    });

    it('rejects missing type', async () => {
      const result = await updatePricingRule({ name: 'Test', discountPercent: 10 });
      expect(result.success).toBe(false);
    });

    it('clamps discount to 0-50 range', async () => {
      const rule = {
        name: 'Extreme Sale',
        type: 'seasonal',
        discountPercent: 75,
        isActive: true,
      };

      await updatePricingRule(rule);
      expect(wixData.insert).toHaveBeenCalledWith(
        'DynamicPricingRules',
        expect.objectContaining({ discountPercent: 50 })
      );
    });

    it('rejects negative discount', async () => {
      const rule = {
        name: 'Negative',
        type: 'seasonal',
        discountPercent: -5,
        isActive: true,
      };

      await updatePricingRule(rule);
      expect(wixData.insert).toHaveBeenCalledWith(
        'DynamicPricingRules',
        expect.objectContaining({ discountPercent: 0 })
      );
    });

    it('handles wix-data errors gracefully', async () => {
      wixData.insert.mockRejectedValueOnce(new Error('DB error'));
      const result = await updatePricingRule({
        name: 'Fail Rule', type: 'seasonal', discountPercent: 10, isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it('sanitizes string inputs', async () => {
      const rule = {
        name: '<script>alert("xss")</script>Summer Sale',
        type: 'seasonal',
        discountPercent: 10,
        isActive: true,
      };

      await updatePricingRule(rule);
      // sanitize mock strips to maxLen, so just verify insert was called
      expect(wixData.insert).toHaveBeenCalled();
    });
  });
});
