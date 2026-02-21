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
} from '../src/public/productPageUtils.js';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, casegoodsItem } from './fixtures/products.js';

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

    it('detects Otis Bed for mattress', () => {
      expect(detectProductBrand(futonMattress)).toBe('Otis Bed');
    });

    it('defaults to Night & Day Furniture', () => {
      expect(detectProductBrand(futonFrame)).toBe('Night & Day Furniture');
    });

    it('returns empty string when no collections', () => {
      expect(detectProductBrand({})).toBe('');
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
});
