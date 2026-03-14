import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  buildGridAlt,
  detectProductBrand,
  detectProductCategory,
  getCategoryFromCollections,
  addBusinessDays,
  HEART_FILLED_SVG,
  HEART_OUTLINE_SVG,
  isCallForPrice,
  CALL_FOR_PRICE_TEXT,
} from '../src/public/productPageUtils.js';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, casegoodsItem, unfinishedFrame, otisMattress, arizonaFrame } from './fixtures/products.js';

describe('productPageUtils', () => {
  describe('formatCurrency', () => {
    it('formats number as USD', () => {
      expect(formatCurrency(499)).toBe('$499.00');
    });

    it('formats decimal amounts', () => {
      expect(formatCurrency(1899.5)).toBe('$1,899.50');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('detectProductBrand', () => {
    it('detects Strata Furniture for wall-hugger', () => {
      expect(detectProductBrand(wallHuggerFrame)).toBe('Strata Furniture');
    });

    it('detects KD Frames for unfinished collection', () => {
      expect(detectProductBrand(unfinishedFrame)).toBe('KD Frames');
    });

    it('detects Otis Bed for mattress collection', () => {
      expect(detectProductBrand(futonMattress)).toBe('Otis Bed');
    });

    it('detects Otis Bed for otis collection', () => {
      expect(detectProductBrand(otisMattress)).toBe('Otis Bed');
    });

    it('detects Arizona brand', () => {
      expect(detectProductBrand(arizonaFrame)).toBe('Arizona');
    });

    it('defaults to Night & Day Furniture', () => {
      expect(detectProductBrand(futonFrame)).toBe('Night & Day Furniture');
    });

    it('returns empty string when no collections', () => {
      expect(detectProductBrand({})).toBe('');
    });

    it('returns empty string for null product', () => {
      expect(detectProductBrand(null)).toBe('');
    });

    it('returns empty string for undefined product', () => {
      expect(detectProductBrand(undefined)).toBe('');
    });

    it('handles single string collection (non-array)', () => {
      expect(detectProductBrand({ collections: 'wall-hugger-frames' })).toBe('Strata Furniture');
    });
  });

  describe('detectProductCategory', () => {
    it('detects Murphy Cabinet Bed', () => {
      expect(detectProductCategory(murphyBed)).toBe('Murphy Cabinet Bed');
    });

    it('detects Futon Frame', () => {
      expect(detectProductCategory(futonFrame)).toBe('Futon Frame');
    });

    it('detects Futon Mattress', () => {
      expect(detectProductCategory(futonMattress)).toBe('Futon Mattress');
    });

    it('detects Bedroom Furniture for casegoods', () => {
      expect(detectProductCategory(casegoodsItem)).toBe('Bedroom Furniture');
    });
  });

  describe('buildGridAlt', () => {
    it('builds keyword-rich alt text', () => {
      const alt = buildGridAlt(futonFrame);
      expect(alt).toContain('Eureka Futon Frame');
      expect(alt).toContain('Carolina Futons');
    });

    it('truncates alt text over 125 characters', () => {
      const longName = { name: 'A'.repeat(120), collections: ['futon-frames'] };
      const alt = buildGridAlt(longName);
      expect(alt.length).toBeLessThanOrEqual(125);
      expect(alt).toMatch(/\.\.\.$/);
    });
  });

  describe('getCategoryFromCollections', () => {
    it('maps futon-frames to Futon Frames', () => {
      expect(getCategoryFromCollections(['futon-frames'])).toEqual({ label: 'Futon Frames', path: '/futon-frames' });
    });

    it('maps murphy collections', () => {
      expect(getCategoryFromCollections(['murphy-cabinet-beds'])).toEqual({ label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' });
    });

    it('defaults to Shop when no collections', () => {
      expect(getCategoryFromCollections(null)).toEqual({ label: 'Shop', path: '/shop-main' });
    });

    it('handles non-array collections', () => {
      expect(getCategoryFromCollections('mattresses')).toEqual({ label: 'Mattresses', path: '/mattresses' });
    });
  });

  describe('addBusinessDays', () => {
    it('skips weekends', () => {
      // Friday Feb 20, 2026 + 1 business day = Monday Feb 23
      const friday = new Date(2026, 1, 20); // Feb 20, 2026 is a Friday
      const result = addBusinessDays(friday, 1);
      expect(result.getDay()).toBe(1); // Monday
    });

    it('adds correct number of business days', () => {
      const monday = new Date(2026, 1, 16); // Monday
      const result = addBusinessDays(monday, 5);
      expect(result.getDay()).toBe(1); // Next Monday
    });
  });

  describe('SVG constants', () => {
    it('exports filled heart SVG data URI', () => {
      expect(HEART_FILLED_SVG).toMatch(/^data:image\/svg\+xml,/);
    });

    it('exports outline heart SVG data URI', () => {
      expect(HEART_OUTLINE_SVG).toMatch(/^data:image\/svg\+xml,/);
    });
  });

  describe('isCallForPrice', () => {
    it('returns true for $1.00 placeholder price', () => {
      expect(isCallForPrice({ price: 1 })).toBe(true);
    });

    it('returns true for price below threshold', () => {
      expect(isCallForPrice({ price: 0.5 })).toBe(true);
      expect(isCallForPrice({ price: 0 })).toBe(true);
    });

    it('returns false for normal prices', () => {
      expect(isCallForPrice({ price: 499 })).toBe(false);
      expect(isCallForPrice({ price: 2 })).toBe(false);
      expect(isCallForPrice(futonFrame)).toBe(false);
    });

    it('handles string formattedPrice when price is missing', () => {
      expect(isCallForPrice({ formattedPrice: '$1.00' })).toBe(true);
      expect(isCallForPrice({ formattedPrice: '$499.00' })).toBe(false);
    });

    it('returns false for null/undefined product', () => {
      expect(isCallForPrice(null)).toBe(false);
      expect(isCallForPrice(undefined)).toBe(false);
    });

    it('returns false when price is null but formattedPrice is normal', () => {
      expect(isCallForPrice({ price: null, formattedPrice: '$299.00' })).toBe(false);
    });
  });

  describe('CALL_FOR_PRICE_TEXT', () => {
    it('contains phone number', () => {
      expect(CALL_FOR_PRICE_TEXT).toContain('(828) 327-8030');
    });

    it('contains call-for-pricing message', () => {
      expect(CALL_FOR_PRICE_TEXT).toContain('Call for Pricing');
    });
  });
});
