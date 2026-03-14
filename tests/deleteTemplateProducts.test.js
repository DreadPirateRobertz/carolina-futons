import { describe, it, expect } from 'vitest';
import {
  loadCFProductNames,
  TEMPLATE_PRODUCT_PATTERNS,
  classifyProducts,
} from '../scripts/deleteTemplateProducts.js';

// ── Tests ───────────────────────────────────────────────────────────

describe('deleteTemplateProducts', () => {
  const cfNames = loadCFProductNames();

  describe('CF product name loading', () => {
    it('loads product names from catalog files', () => {
      expect(cfNames.size).toBeGreaterThan(10);
    });

    it('includes manual CF product names', () => {
      expect(cfNames.has('eureka')).toBe(true);
      expect(cfNames.has('flagstaff')).toBe(true);
      expect(cfNames.has('moonshadow')).toBe(true);
      expect(cfNames.has('big sur')).toBe(true);
    });

    it('stores names in lowercase', () => {
      for (const name of cfNames) {
        expect(name).toBe(name.toLowerCase());
      }
    });
  });

  describe('template product pattern matching', () => {
    it('identifies exact template product names', () => {
      expect(TEMPLATE_PRODUCT_PATTERNS).toContain('modo');
      expect(TEMPLATE_PRODUCT_PATTERNS).toContain('nyx');
      expect(TEMPLATE_PRODUCT_PATTERNS).toContain('raven');
    });

    it('has 24 template product patterns', () => {
      expect(TEMPLATE_PRODUCT_PATTERNS).toHaveLength(24);
    });
  });

  describe('product classification', () => {
    it('classifies template products correctly', () => {
      const products = [
        { id: '1', name: 'MODO' },
        { id: '2', name: 'NYX' },
        { id: '3', name: 'RAVEN' },
        { id: '4', name: 'Oslo Chair' },
      ];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(4);
      expect(template.map(p => p.name)).toEqual(['MODO', 'NYX', 'RAVEN', 'Oslo Chair']);
    });

    it('classifies CF products correctly', () => {
      const products = [
        { id: '1', name: 'Eureka' },
        { id: '2', name: 'Flagstaff' },
        { id: '3', name: 'Moonshadow' },
      ];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(keep).toHaveLength(3);
      expect(template).toHaveLength(0);
    });

    it('keeps unknown products (conservative)', () => {
      const products = [
        { id: '1', name: 'Some Random Product' },
      ];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(keep).toHaveLength(1);
      expect(template).toHaveLength(0);
    });

    it('handles mixed template and CF products', () => {
      const products = [
        { id: '1', name: 'MODO' },
        { id: '2', name: 'Eureka' },
        { id: '3', name: 'NYX' },
        { id: '4', name: 'Flagstaff' },
        { id: '5', name: 'Zen Table' },
      ];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(3); // MODO, NYX, Zen Table
      expect(keep).toHaveLength(2); // Eureka, Flagstaff
    });

    it('handles empty product list', () => {
      const { template, keep } = classifyProducts([], cfNames);
      expect(template).toHaveLength(0);
      expect(keep).toHaveLength(0);
    });

    it('handles products with empty names', () => {
      const products = [{ id: '1', name: '' }];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(keep).toHaveLength(1); // Unknown → keep
      expect(template).toHaveLength(0);
    });

    it('handles products with no name property', () => {
      const products = [{ id: '1' }];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(keep).toHaveLength(1); // Unknown → keep
    });

    it('is case-insensitive for template matching', () => {
      const products = [
        { id: '1', name: 'MODO' },
        { id: '2', name: 'modo' },
        { id: '3', name: 'Modo' },
      ];
      const { template } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(3);
    });

    it('is case-insensitive for CF matching', () => {
      const products = [
        { id: '1', name: 'EUREKA' },
        { id: '2', name: 'eureka' },
        { id: '3', name: 'Eureka' },
      ];
      const { keep } = classifyProducts(products, cfNames);
      expect(keep).toHaveLength(3);
    });

    it('matches template products with suffixes (e.g. "Zen Table")', () => {
      const products = [
        { id: '1', name: 'Zen Table' },
        { id: '2', name: 'Luna Sofa' },
        { id: '3', name: 'Nova Chair' },
      ];
      const { template } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(3);
    });

    it('does not match partial template names mid-word', () => {
      // "zenith" should NOT match "zen" since it doesn't start with "zen "
      const products = [{ id: '1', name: 'Zenith' }];
      const { template, keep } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(0);
      expect(keep).toHaveLength(1);
    });

    it('prioritizes CF match over template match', () => {
      // If a product name matches both CF and template, keep it
      const customCF = new Set(['modo']);
      const products = [{ id: '1', name: 'Modo' }];
      const { keep } = classifyProducts(products, customCF);
      expect(keep).toHaveLength(1); // CF takes priority
    });
  });
});
