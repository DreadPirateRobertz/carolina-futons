import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix modules
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue({ _id: 'member1' }) },
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
  getBundleRecommendations,
  calculateBundlePrice,
  getCoPurchasePatterns,
  recordCoPurchase,
  getBundleTemplates,
  saveBundleTemplate,
  getBundlePerformance,
  _BUNDLE_RULES,
  _TIERS,
} from '../../src/backend/bundleBuilder.web.js';

describe('bundleBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
  });

  describe('getBundleRecommendations', () => {
    it('returns empty for no cart items', async () => {
      const result = await getBundleRecommendations([], 'session1');
      expect(result).toEqual({ bundles: [], savings: 0 });
    });

    it('returns empty for null cart', async () => {
      const result = await getBundleRecommendations(null);
      expect(result).toEqual({ bundles: [], savings: 0 });
    });

    it('returns empty when no products found', async () => {
      wixData.get.mockResolvedValue(null);
      const result = await getBundleRecommendations(['prod1']);
      expect(result.bundles).toEqual([]);
    });

    it('finds complementary products for futon frame', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'frame1', name: 'Oak Frame', price: 400,
        collections: ['futon-frames'],
      });

      const complementary = [
        { _id: 'matt1', name: 'Comfort Mattress', price: 200, slug: 'comfort', formattedPrice: '$200', mainMedia: null, collections: ['mattresses'] },
      ];

      mockQueryChain.find
        .mockResolvedValueOnce({ items: complementary, totalCount: 1 }) // complementary query
        .mockResolvedValueOnce({ items: [], totalCount: 0 }); // templates query

      const result = await getBundleRecommendations(['frame1']);
      expect(result.bundles.length).toBeGreaterThan(0);
      expect(result.bundles[0].bundleName).toBeTruthy();
      expect(result.bundles[0].savings).toBeGreaterThan(0);
    });

    it('limits to 6 bundle recommendations', async () => {
      wixData.get.mockResolvedValue({
        _id: 'frame1', name: 'Frame', price: 400, collections: ['futon-frames'],
      });

      const manyProducts = Array.from({ length: 10 }, (_, i) => ({
        _id: `prod${i}`, name: `Product ${i}`, price: 100 + i * 50,
        slug: `prod-${i}`, formattedPrice: `$${100 + i * 50}`, mainMedia: null,
        collections: ['mattresses'],
      }));

      mockQueryChain.find
        .mockResolvedValueOnce({ items: manyProducts, totalCount: 10 })
        .mockResolvedValueOnce({ items: [], totalCount: 0 });

      const result = await getBundleRecommendations(['frame1']);
      expect(result.bundles.length).toBeLessThanOrEqual(6);
    });

    it('sanitizes product IDs by truncation', async () => {
      wixData.get.mockResolvedValue(null);
      const longId = 'a'.repeat(100);
      await getBundleRecommendations([longId]);
      expect(wixData.get).toHaveBeenCalledWith(
        'Stores/Products',
        'a'.repeat(50)
      );
    });

    it('limits cart to 10 products max', async () => {
      wixData.get.mockResolvedValue(null);
      const manyIds = Array.from({ length: 20 }, (_, i) => `prod${i}`);
      await getBundleRecommendations(manyIds);
      // Should only call get for first 10
      expect(wixData.get).toHaveBeenCalledTimes(10);
    });

    it('includes template bundles at top of results', async () => {
      wixData.get.mockResolvedValueOnce({
        _id: 'frame1', name: 'Frame', price: 400, collections: ['futon-frames'],
      });

      const templates = [{
        _id: 'tpl1', name: 'College Set', productIds: ['frame1', 'matt1'],
        basePrice: 600, bundlePrice: 500, discountPercent: 17,
        occasion: 'back_to_school', categories: ['futon-frames'],
        imageUrl: 'https://example.com/img.jpg',
      }];

      mockQueryChain.find
        .mockResolvedValueOnce({ items: [], totalCount: 0 }) // complementary
        .mockResolvedValueOnce({ items: templates, totalCount: 1 }); // templates

      const result = await getBundleRecommendations(['frame1']);
      expect(result.bundles.length).toBeGreaterThan(0);
      expect(result.bundles[0].templateId).toBe('tpl1');
    });

    it('handles errors gracefully', async () => {
      wixData.get.mockRejectedValue(new Error('DB error'));
      const result = await getBundleRecommendations(['prod1']);
      expect(result).toEqual({ bundles: [], savings: 0 });
    });
  });

  describe('calculateBundlePrice', () => {
    it('returns zeros for less than 2 products', async () => {
      const result = await calculateBundlePrice(['single']);
      expect(result.bundlePrice).toBe(0);
      expect(result.discountPercent).toBe(0);
    });

    it('returns zeros for null input', async () => {
      const result = await calculateBundlePrice(null);
      expect(result.bundlePrice).toBe(0);
    });

    it('calculates base 5% discount for 2 same-category products', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 400, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 300, collections: ['futon-frames'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2']);
      expect(result.basePrice).toBe(700);
      expect(result.discountPercent).toBe(5);
      expect(result.bundlePrice).toBe(665);
      expect(result.savings).toBe(35);
    });

    it('gives 8% for 2 different categories', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 500, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 200, collections: ['mattresses'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2']);
      expect(result.discountPercent).toBe(8);
      expect(result.bundlePrice).toBe(644);
    });

    it('gives 10% for 3+ categories', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 500, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 200, collections: ['mattresses'] })
        .mockResolvedValueOnce({ _id: 'p3', price: 100, collections: ['casegoods-accessories'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2', 'p3']);
      expect(result.discountPercent).toBe(10);
      expect(result.savings).toBe(80);
    });

    it('gives 12% for 4+ products', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 500, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 200, collections: ['mattresses'] })
        .mockResolvedValueOnce({ _id: 'p3', price: 100, collections: ['casegoods-accessories'] })
        .mockResolvedValueOnce({ _id: 'p4', price: 50, collections: ['outdoor-furniture'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2', 'p3', 'p4']);
      expect(result.discountPercent).toBe(12);
    });

    it('assigns correct tier labels', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 200, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 100, collections: ['mattresses'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2']);
      expect(result.tier).toBe('Starter Bundle');
    });

    it('rounds to 2 decimal places', async () => {
      wixData.get
        .mockResolvedValueOnce({ _id: 'p1', price: 333.33, collections: ['futon-frames'] })
        .mockResolvedValueOnce({ _id: 'p2', price: 166.67, collections: ['mattresses'] });

      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await calculateBundlePrice(['p1', 'p2']);
      expect(result.basePrice.toString()).toMatch(/^\d+\.?\d{0,2}$/);
      expect(result.bundlePrice.toString()).toMatch(/^\d+\.?\d{0,2}$/);
    });

    it('handles DB errors gracefully', async () => {
      wixData.get.mockRejectedValue(new Error('fail'));
      const result = await calculateBundlePrice(['p1', 'p2']);
      expect(result.bundlePrice).toBe(0);
    });
  });

  describe('getCoPurchasePatterns', () => {
    it('returns empty for no product', async () => {
      const result = await getCoPurchasePatterns('');
      expect(result).toEqual([]);
    });

    it('returns empty for null product', async () => {
      const result = await getCoPurchasePatterns(null);
      expect(result).toEqual([]);
    });

    it('merges patterns from both directions', async () => {
      const patternsA = [{ productA: 'p1', productB: 'p2', coCount: 5 }];
      const patternsB = [{ productA: 'p3', productB: 'p1', coCount: 3 }];

      mockQueryChain.find
        .mockResolvedValueOnce({ items: patternsA })
        .mockResolvedValueOnce({ items: patternsB });

      wixData.get
        .mockResolvedValueOnce({ _id: 'p2', name: 'Product 2', price: 200, mainMedia: null })
        .mockResolvedValueOnce({ _id: 'p3', name: 'Product 3', price: 300, mainMedia: null });

      const result = await getCoPurchasePatterns('p1');
      expect(result.length).toBe(2);
      expect(result[0].coCount).toBe(5); // sorted by coCount desc
      expect(result[1].coCount).toBe(3);
    });

    it('respects limit parameter', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [] });
      await getCoPurchasePatterns('p1', 3);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(3);
    });

    it('caps limit at 20', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [] });
      await getCoPurchasePatterns('p1', 100);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(20);
    });

    it('handles product lookup errors', async () => {
      mockQueryChain.find
        .mockResolvedValueOnce({ items: [{ productA: 'p1', productB: 'p2', coCount: 1 }] })
        .mockResolvedValueOnce({ items: [] });

      wixData.get.mockRejectedValue(new Error('not found'));

      const result = await getCoPurchasePatterns('p1');
      expect(result.length).toBe(1);
      expect(result[0].productName).toBe('');
    });
  });

  describe('recordCoPurchase', () => {
    it('returns false for less than 2 products', async () => {
      const result = await recordCoPurchase(['single']);
      expect(result).toEqual({ success: false, pairsRecorded: 0 });
    });

    it('returns false for null input', async () => {
      const result = await recordCoPurchase(null);
      expect(result).toEqual({ success: false, pairsRecorded: 0 });
    });

    it('records all pairs for 3 products', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await recordCoPurchase(['a', 'b', 'c']);
      // 3 products = 3 pairs: (a,b), (a,c), (b,c)
      expect(result.pairsRecorded).toBe(3);
      expect(wixData.insert).toHaveBeenCalledTimes(3);
    });

    it('increments existing pair counts', async () => {
      mockQueryChain.find.mockResolvedValue({
        items: [{ _id: 'existing', productA: 'a', productB: 'b', coCount: 5 }],
        totalCount: 1,
      });

      await recordCoPurchase(['a', 'b']);
      expect(wixData.update).toHaveBeenCalledWith('CoPurchasePatterns', expect.objectContaining({
        coCount: 6,
      }));
    });

    it('sorts product IDs for consistent pairing', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      await recordCoPurchase(['z', 'a']);
      expect(mockQueryChain.eq).toHaveBeenCalledWith('productA', 'a');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('productB', 'z');
    });

    it('limits to 20 products', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });
      const manyIds = Array.from({ length: 30 }, (_, i) => `p${i}`);

      const result = await recordCoPurchase(manyIds);
      // 20 products = 190 pairs
      expect(result.pairsRecorded).toBe(190);
    });

    it('handles DB errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValue(new Error('fail'));
      const result = await recordCoPurchase(['a', 'b']);
      expect(result).toEqual({ success: false, pairsRecorded: 0 });
    });
  });

  describe('saveBundleTemplate', () => {
    it('rejects null template', async () => {
      const result = await saveBundleTemplate(null);
      expect(result).toEqual({ success: false, templateId: '' });
    });

    it('rejects template without name', async () => {
      const result = await saveBundleTemplate({ productIds: ['a', 'b'] });
      expect(result).toEqual({ success: false, templateId: '' });
    });

    it('rejects template with fewer than 2 products', async () => {
      const result = await saveBundleTemplate({ name: 'Test', productIds: ['a'] });
      expect(result).toEqual({ success: false, templateId: '' });
    });

    it('creates new template', async () => {
      const result = await saveBundleTemplate({
        name: 'College Set',
        productIds: ['frame1', 'matt1'],
        basePrice: 600,
        bundlePrice: 500,
        discountPercent: 17,
        occasion: 'back_to_school',
      });

      expect(result.success).toBe(true);
      expect(wixData.insert).toHaveBeenCalledWith('BundleTemplates', expect.objectContaining({
        name: 'College Set',
        discountPercent: 17,
        occasion: 'back_to_school',
      }));
    });

    it('updates existing template when _id provided', async () => {
      const result = await saveBundleTemplate({
        _id: 'existing-tpl',
        name: 'Updated Set',
        productIds: ['a', 'b'],
        basePrice: 500,
        bundlePrice: 400,
        discountPercent: 20,
      });

      expect(result.success).toBe(true);
      expect(wixData.update).toHaveBeenCalled();
    });

    it('caps discount at 50%', async () => {
      await saveBundleTemplate({
        name: 'Extreme Discount',
        productIds: ['a', 'b'],
        discountPercent: 90,
      });

      expect(wixData.insert).toHaveBeenCalledWith('BundleTemplates', expect.objectContaining({
        discountPercent: 50,
      }));
    });

    it('truncates long string fields', async () => {
      const longName = 'A'.repeat(300);
      await saveBundleTemplate({
        name: longName,
        productIds: ['a', 'b'],
        occasion: 'general',
      });

      expect(wixData.insert).toHaveBeenCalledWith('BundleTemplates', expect.objectContaining({
        name: 'A'.repeat(200),
      }));
    });
  });

  describe('getBundleTemplates', () => {
    it('returns active templates', async () => {
      const templates = [{ _id: 'tpl1', name: 'Test', isActive: true }];
      mockQueryChain.find.mockResolvedValue({ items: templates, totalCount: 1 });

      const result = await getBundleTemplates();
      expect(result).toEqual(templates);
      expect(mockQueryChain.eq).toHaveBeenCalledWith('isActive', true);
    });

    it('filters by occasion when provided', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      await getBundleTemplates('back_to_school');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('occasion', 'back_to_school');
    });

    it('handles DB errors', async () => {
      mockQueryChain.find.mockRejectedValue(new Error('fail'));
      const result = await getBundleTemplates();
      expect(result).toEqual([]);
    });
  });

  describe('getBundlePerformance', () => {
    it('returns zeros when no data', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      const result = await getBundlePerformance();
      expect(result.totalImpressions).toBe(0);
      expect(result.conversionRate).toBe(0);
    });

    it('calculates correct stats from analytics data', async () => {
      const analyticsData = [
        { bundleId: 'b1', bundleName: 'Set A', event: 'impression', revenue: 0 },
        { bundleId: 'b1', bundleName: 'Set A', event: 'impression', revenue: 0 },
        { bundleId: 'b1', bundleName: 'Set A', event: 'click', revenue: 0 },
        { bundleId: 'b1', bundleName: 'Set A', event: 'purchase', revenue: 500 },
        { bundleId: 'b2', bundleName: 'Set B', event: 'impression', revenue: 0 },
      ];

      mockQueryChain.find.mockResolvedValue({ items: analyticsData, totalCount: 5 });

      const result = await getBundlePerformance(30);
      expect(result.totalImpressions).toBe(3);
      expect(result.totalClicks).toBe(1);
      expect(result.totalPurchases).toBe(1);
      expect(result.totalRevenue).toBe(500);
      expect(result.topBundles.length).toBe(2);
      expect(result.topBundles[0].bundleId).toBe('b1');
      expect(result.topBundles[0].conversionRate).toBe(50); // 1 purchase / 2 impressions * 100
    });

    it('respects days parameter', async () => {
      mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

      await getBundlePerformance(7);
      expect(mockQueryChain.ge).toHaveBeenCalledWith('timestamp', expect.any(Date));
    });

    it('handles errors gracefully', async () => {
      mockQueryChain.find.mockRejectedValue(new Error('fail'));
      const result = await getBundlePerformance();
      expect(result.totalImpressions).toBe(0);
    });
  });

  describe('BUNDLE_RULES', () => {
    it('defines rules for all major categories', () => {
      expect(_BUNDLE_RULES['futon-frames']).toBeDefined();
      expect(_BUNDLE_RULES['mattresses']).toBeDefined();
      expect(_BUNDLE_RULES['murphy-cabinet-beds']).toBeDefined();
      expect(_BUNDLE_RULES['platform-beds']).toBeDefined();
      expect(_BUNDLE_RULES['outdoor-furniture']).toBeDefined();
    });

    it('all rules have required fields', () => {
      for (const [key, rule] of Object.entries(_BUNDLE_RULES)) {
        expect(rule.complementary).toBeInstanceOf(Array);
        expect(rule.complementary.length).toBeGreaterThan(0);
        expect(rule.bundleName).toBeTruthy();
        expect(rule.discountPercent).toBeGreaterThan(0);
        expect(rule.discountPercent).toBeLessThanOrEqual(50);
      }
    });
  });

  describe('TIERS', () => {
    it('defines 4 tiers', () => {
      expect(Object.keys(_TIERS).length).toBe(4);
    });

    it('tiers have ascending price thresholds', () => {
      const tiers = Object.values(_TIERS);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].maxPrice).toBeGreaterThanOrEqual(tiers[i - 1].maxPrice);
      }
    });

    it('all tiers have labels and colors', () => {
      for (const tier of Object.values(_TIERS)) {
        expect(tier.label).toBeTruthy();
        expect(tier.badgeColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });
});
