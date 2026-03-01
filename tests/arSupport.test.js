import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('public/models3d', () => ({
  hasARModel: vi.fn((id) => id === 'prod-asheville-full'),
}));

import { checkWebARSupport, isProductAREnabled, AR_CATEGORIES } from '../src/public/arSupport.js';

describe('arSupport', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AR_CATEGORIES', () => {
    it('includes futons, frames, and murphy-beds', () => {
      expect(AR_CATEGORIES.has('futons')).toBe(true);
      expect(AR_CATEGORIES.has('frames')).toBe(true);
      expect(AR_CATEGORIES.has('murphy-beds')).toBe(true);
    });

    it('does not include covers or accessories', () => {
      expect(AR_CATEGORIES.has('covers')).toBe(false);
      expect(AR_CATEGORIES.has('accessories')).toBe(false);
    });
  });

  describe('checkWebARSupport', () => {
    it('returns true when customElements is available', () => {
      vi.stubGlobal('customElements', { get: vi.fn() });
      expect(checkWebARSupport()).toBe(true);
    });

    it('returns false when customElements is undefined', () => {
      vi.stubGlobal('customElements', undefined);
      expect(checkWebARSupport()).toBe(false);
    });
  });

  describe('isProductAREnabled', () => {
    it('returns true for eligible in-stock product with AR model', () => {
      const product = { _id: 'prod-asheville-full', collections: ['futons'], inStock: true };
      expect(isProductAREnabled(product)).toBe(true);
    });

    it('returns false for out-of-stock product', () => {
      const product = { _id: 'prod-asheville-full', collections: ['futons'], inStock: false };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for non-AR category', () => {
      const product = { _id: 'prod-asheville-full', collections: ['covers'], inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for product without AR model', () => {
      const product = { _id: 'prod-no-model', collections: ['futons'], inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for null product', () => {
      expect(isProductAREnabled(null)).toBe(false);
    });

    it('returns false for product missing collections', () => {
      const product = { _id: 'prod-asheville-full', inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('matches category from collections array', () => {
      const product = { _id: 'prod-asheville-full', collections: ['sale', 'futons', 'featured'], inStock: true };
      expect(isProductAREnabled(product)).toBe(true);
    });
  });
});
