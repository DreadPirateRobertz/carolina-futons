import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [] }),
  count: vi.fn().mockResolvedValue(0),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: vi.fn((s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim().slice(0, 1000) : '')),
  validateId: vi.fn((id) => (typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id.trim()) ? id.trim() : '')),
}));

import {
  getCustomizationOptions,
  calculateCustomizationPrice,
  saveConfiguration,
  getSavedConfigurations,
  getConfigurationById,
} from '../src/backend/customizationService.web.js';

// ── Test Data ────────────────────────────────────────────────────────

const mockSwatches = [
  { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', material: 'Cotton', priceTier: 'standard', colorFamily: 'blue', swatchImage: 'img1.jpg' },
  { _id: 'sw-2', swatchName: 'Crimson Velvet', colorHex: '#8B0000', material: 'Velvet', priceTier: 'premium', colorFamily: 'red', swatchImage: 'img2.jpg' },
  { _id: 'sw-3', swatchName: 'Organic Hemp', colorHex: '#C4B896', material: 'Hemp', priceTier: 'luxury', colorFamily: 'neutral', swatchImage: 'img3.jpg' },
];

const mockPricingRules = [
  { _id: 'pr-1', tier: 'standard', surchargePercent: 0, surchargeFlat: 0, label: 'Standard Fabric' },
  { _id: 'pr-2', tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium Fabric (+15%)' },
  { _id: 'pr-3', tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury Fabric (+$75)' },
];

const mockSavedConfig = {
  _id: 'cfg-1',
  productId: 'prod-1',
  memberId: 'member-1',
  configName: 'My Living Room Setup',
  fabricSwatchId: 'sw-2',
  fabricName: 'Crimson Velvet',
  fabricColorHex: '#8B0000',
  finishOption: 'Walnut',
  totalPrice: 574.85,
  _createdDate: new Date('2026-01-15'),
};

// ── Tests ────────────────────────────────────────────────────────────

describe('customizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getCustomizationOptions ──

  describe('getCustomizationOptions', () => {
    it('returns swatches and pricing rules for a valid product', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation((collection) => {
        const q = { ...mockQuery };
        if (collection === 'FabricSwatches') {
          q.find = vi.fn().mockResolvedValue({ items: mockSwatches });
        } else if (collection === 'CustomizationPricing') {
          q.find = vi.fn().mockResolvedValue({ items: mockPricingRules });
        }
        return q;
      });

      const result = await getCustomizationOptions('prod-1');
      expect(result).toHaveProperty('swatches');
      expect(result).toHaveProperty('pricingRules');
      expect(result.swatches).toHaveLength(3);
      expect(result.pricingRules).toHaveLength(3);
    });

    it('returns empty arrays when no swatches found', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn().mockResolvedValue({ items: [] }),
      }));

      const result = await getCustomizationOptions('prod-nonexistent');
      expect(result.swatches).toEqual([]);
    });

    it('returns empty result for empty/invalid productId', async () => {
      const result = await getCustomizationOptions('');
      expect(result.swatches).toEqual([]);
      expect(result.pricingRules).toEqual([]);
    });

    it('returns empty result for XSS productId', async () => {
      const result = await getCustomizationOptions('<script>alert("xss")</script>');
      expect(result.swatches).toEqual([]);
      expect(result.pricingRules).toEqual([]);
    });

    it('handles API error gracefully', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn().mockRejectedValue(new Error('Network error')),
      }));

      const result = await getCustomizationOptions('prod-1');
      expect(result.swatches).toEqual([]);
      expect(result.pricingRules).toEqual([]);
    });
  });

  // ── calculateCustomizationPrice ──

  describe('calculateCustomizationPrice', () => {
    it('returns base price for standard fabric (no surcharge)', () => {
      const result = calculateCustomizationPrice(499, 'standard', mockPricingRules);
      expect(result.basePrice).toBe(499);
      expect(result.surcharge).toBe(0);
      expect(result.totalPrice).toBe(499);
      expect(result.surchargeLabel).toBe('Standard Fabric');
    });

    it('applies percentage surcharge for premium fabric', () => {
      const result = calculateCustomizationPrice(499, 'premium', mockPricingRules);
      expect(result.basePrice).toBe(499);
      expect(result.surcharge).toBe(74.85); // 15% of 499
      expect(result.totalPrice).toBe(573.85);
      expect(result.surchargeLabel).toBe('Premium Fabric (+15%)');
    });

    it('applies flat surcharge for luxury fabric', () => {
      const result = calculateCustomizationPrice(499, 'luxury', mockPricingRules);
      expect(result.basePrice).toBe(499);
      expect(result.surcharge).toBe(75);
      expect(result.totalPrice).toBe(574);
      expect(result.surchargeLabel).toBe('Luxury Fabric (+$75)');
    });

    it('returns base price when tier not found in rules', () => {
      const result = calculateCustomizationPrice(499, 'unknown', mockPricingRules);
      expect(result.totalPrice).toBe(499);
      expect(result.surcharge).toBe(0);
    });

    it('handles zero base price', () => {
      const result = calculateCustomizationPrice(0, 'premium', mockPricingRules);
      expect(result.totalPrice).toBe(0);
      expect(result.surcharge).toBe(0);
    });

    it('handles negative base price gracefully', () => {
      const result = calculateCustomizationPrice(-100, 'standard', mockPricingRules);
      expect(result.totalPrice).toBe(0);
      expect(result.surcharge).toBe(0);
    });

    it('handles null/undefined pricing rules', () => {
      const result = calculateCustomizationPrice(499, 'premium', null);
      expect(result.totalPrice).toBe(499);
      expect(result.surcharge).toBe(0);
    });

    it('handles empty pricing rules array', () => {
      const result = calculateCustomizationPrice(499, 'premium', []);
      expect(result.totalPrice).toBe(499);
      expect(result.surcharge).toBe(0);
    });

    it('rounds surcharge to 2 decimal places', () => {
      const rules = [{ tier: 'test', surchargePercent: 33, surchargeFlat: 0, label: 'Test' }];
      const result = calculateCustomizationPrice(100, 'test', rules);
      // 33% of 100 = 33, total = 133
      expect(result.surcharge).toBe(33);
      expect(result.totalPrice).toBe(133);
    });
  });

  // ── saveConfiguration ──

  describe('saveConfiguration', () => {
    it('saves a valid configuration', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.insert.mockResolvedValue({ ...mockSavedConfig });

      const config = {
        productId: 'prod-1',
        memberId: 'member-1',
        configName: 'My Living Room Setup',
        fabricSwatchId: 'sw-2',
        fabricName: 'Crimson Velvet',
        fabricColorHex: '#8B0000',
        finishOption: 'Walnut',
        totalPrice: 574.85,
      };

      const result = await saveConfiguration(config);
      expect(result).toHaveProperty('_id');
      expect(wixData.insert).toHaveBeenCalledWith('SavedCustomizations', expect.objectContaining({
        productId: 'prod-1',
        memberId: 'member-1',
      }));
    });

    it('rejects config with missing productId', async () => {
      const result = await saveConfiguration({ memberId: 'member-1' });
      expect(result).toEqual({ error: 'Missing required fields' });
    });

    it('rejects config with missing memberId', async () => {
      const result = await saveConfiguration({ productId: 'prod-1' });
      expect(result).toEqual({ error: 'Missing required fields' });
    });

    it('sanitizes configName to prevent XSS', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.insert.mockResolvedValue({ _id: 'cfg-new' });

      await saveConfiguration({
        productId: 'prod-1',
        memberId: 'member-1',
        configName: '<script>alert("xss")</script>My Config',
        fabricSwatchId: 'sw-1',
        fabricName: 'Cotton',
        fabricColorHex: '#FFF',
        totalPrice: 499,
      });

      expect(wixData.insert).toHaveBeenCalledWith(
        'SavedCustomizations',
        expect.objectContaining({
          configName: expect.not.stringContaining('<script>'),
        })
      );
    });

    it('handles API error on save', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.insert.mockRejectedValue(new Error('Database error'));

      const result = await saveConfiguration({
        productId: 'prod-1',
        memberId: 'member-1',
        fabricSwatchId: 'sw-1',
        fabricName: 'Cotton',
        fabricColorHex: '#FFF',
        totalPrice: 499,
      });
      expect(result).toEqual({ error: 'Failed to save configuration' });
    });
  });

  // ── getSavedConfigurations ──

  describe('getSavedConfigurations', () => {
    it('returns saved configs for a member and product', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn().mockResolvedValue({ items: [mockSavedConfig] }),
      }));

      const result = await getSavedConfigurations('prod-1', 'member-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('configName', 'My Living Room Setup');
    });

    it('returns empty array for invalid memberId', async () => {
      const result = await getSavedConfigurations('prod-1', '');
      expect(result).toEqual([]);
    });

    it('returns empty array for invalid productId', async () => {
      const result = await getSavedConfigurations('', 'member-1');
      expect(result).toEqual([]);
    });

    it('handles API error gracefully', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.query.mockImplementation(() => ({
        ...mockQuery,
        find: vi.fn().mockRejectedValue(new Error('Network error')),
      }));

      const result = await getSavedConfigurations('prod-1', 'member-1');
      expect(result).toEqual([]);
    });
  });

  // ── getConfigurationById ──

  describe('getConfigurationById', () => {
    it('returns a config by ID', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue(mockSavedConfig);

      const result = await getConfigurationById('cfg-1');
      expect(result).toHaveProperty('configName', 'My Living Room Setup');
    });

    it('returns null for invalid ID', async () => {
      const result = await getConfigurationById('');
      expect(result).toBeNull();
    });

    it('returns null for XSS ID', async () => {
      const result = await getConfigurationById('<script>alert(1)</script>');
      expect(result).toBeNull();
    });

    it('returns null when config not found', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValue(null);

      const result = await getConfigurationById('cfg-nonexistent');
      expect(result).toBeNull();
    });

    it('handles API error gracefully', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockRejectedValue(new Error('Database error'));

      const result = await getConfigurationById('cfg-1');
      expect(result).toBeNull();
    });
  });
});
