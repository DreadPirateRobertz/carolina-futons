import { describe, it, expect } from 'vitest';
import { MODELS_3D, MODEL_CDN_BASE, getModel3DForProduct, hasARModel } from '../src/public/models3d.js';

describe('models3d', () => {
  describe('MODELS_3D catalog', () => {
    it('contains at least 10 products', () => {
      expect(MODELS_3D.length).toBeGreaterThanOrEqual(10);
    });

    it('each entry has required fields', () => {
      for (const model of MODELS_3D) {
        expect(model.productId).toMatch(/^prod-/);
        expect(model.glbUrl).toMatch(/\.glb$/);
        expect(model.usdzUrl).toMatch(/\.usdz$/);
        expect(model.dimensions).toHaveProperty('width');
        expect(model.dimensions).toHaveProperty('depth');
        expect(model.dimensions).toHaveProperty('height');
        expect(model.dimensions.width).toBeGreaterThan(0);
        expect(model.dimensions.depth).toBeGreaterThan(0);
        expect(model.dimensions.height).toBeGreaterThan(0);
        expect(typeof model.fileSizeBytes).toBe('number');
        expect(typeof model.contentHash).toBe('string');
        expect(typeof model.hasFabricVariants).toBe('boolean');
      }
    });

    it('dimensions are in meters (all under 3m)', () => {
      for (const model of MODELS_3D) {
        expect(model.dimensions.width).toBeLessThan(3);
        expect(model.dimensions.depth).toBeLessThan(3);
        expect(model.dimensions.height).toBeLessThan(3);
      }
    });

    it('has no duplicate productIds', () => {
      const ids = MODELS_3D.map(m => m.productId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('MODEL_CDN_BASE', () => {
    it('is an HTTPS URL', () => {
      expect(MODEL_CDN_BASE).toMatch(/^https:\/\//);
    });
  });

  describe('getModel3DForProduct', () => {
    it('returns model for known product', () => {
      const model = getModel3DForProduct('prod-asheville-full');
      expect(model).toBeDefined();
      expect(model.productId).toBe('prod-asheville-full');
      expect(model.glbUrl).toContain('.glb');
      expect(model.usdzUrl).toContain('.usdz');
    });

    it('returns undefined for unknown product', () => {
      expect(getModel3DForProduct('prod-nonexistent')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getModel3DForProduct('')).toBeUndefined();
    });
  });

  describe('hasARModel', () => {
    it('returns true for product with model', () => {
      expect(hasARModel('prod-asheville-full')).toBe(true);
    });

    it('returns false for product without model', () => {
      expect(hasARModel('prod-nonexistent')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasARModel('')).toBe(false);
    });
  });
});
