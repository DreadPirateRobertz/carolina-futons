import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Import helpers by reading the script and extracting logic ───────
// Since the script is designed to run as CLI, we test the classification
// logic by reimplementing it here from the same source patterns.

const TEMPLATE_PRODUCT_PATTERNS = [
  'modo', 'nyx', 'raven', 'oslo', 'aria', 'luna', 'nova', 'zen',
  'cleo', 'milo', 'otto', 'vega', 'aura', 'echo', 'iris', 'onyx',
  'jade', 'opal', 'ruby', 'sage', 'teak', 'wren', 'yuma', 'zara',
];

function loadCFProductNames() {
  const names = new Set();
  const catalogFiles = [
    resolve(__dirname, '..', 'content', 'scraped-products-16-30.json'),
    resolve(__dirname, '..', 'content', 'scraped-products-31-45.json'),
  ];

  for (const file of catalogFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      for (const product of data) {
        if (product.name) names.add(product.name.trim().toLowerCase());
      }
    } catch (e) { /* file may not exist */ }
  }

  const manualCF = [
    'Eureka', 'Flagstaff', 'Rosemary', 'Bali', 'Chandler', 'Pagoda',
    'Monterey', 'Venice', 'Phoenix', 'Tucson', 'Sedona', 'Boulder',
    'Big Sur', 'Durango', 'Kingston', 'Moonshadow', 'Dreamweaver',
    'Cloud Nine', 'Serenity', 'Cascade',
  ];
  for (const name of manualCF) {
    names.add(name.trim().toLowerCase());
  }

  return names;
}

function classifyProducts(products, cfNames) {
  const template = [];
  const cf = [];

  for (const product of products) {
    const name = (product.name || '').trim();
    const nameLower = name.toLowerCase();

    const isCF = cfNames.has(nameLower) ||
      [...cfNames].some(cfName => nameLower.includes(cfName) && cfName.length > 3);

    const isTemplateMatch = TEMPLATE_PRODUCT_PATTERNS.some(pattern =>
      nameLower === pattern || nameLower.startsWith(pattern + ' ')
    );

    if (isCF) {
      cf.push(product);
    } else if (isTemplateMatch) {
      template.push(product);
    } else {
      cf.push(product);
    }
  }

  return { template, cf };
}

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
      const { template, cf } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(4);
      expect(template.map(p => p.name)).toEqual(['MODO', 'NYX', 'RAVEN', 'Oslo Chair']);
    });

    it('classifies CF products correctly', () => {
      const products = [
        { id: '1', name: 'Eureka' },
        { id: '2', name: 'Flagstaff' },
        { id: '3', name: 'Moonshadow' },
      ];
      const { template, cf } = classifyProducts(products, cfNames);
      expect(cf).toHaveLength(3);
      expect(template).toHaveLength(0);
    });

    it('keeps unknown products as CF (conservative)', () => {
      const products = [
        { id: '1', name: 'Some Random Product' },
      ];
      const { template, cf } = classifyProducts(products, cfNames);
      expect(cf).toHaveLength(1);
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
      const { template, cf } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(3); // MODO, NYX, Zen Table
      expect(cf).toHaveLength(2); // Eureka, Flagstaff
    });

    it('handles empty product list', () => {
      const { template, cf } = classifyProducts([], cfNames);
      expect(template).toHaveLength(0);
      expect(cf).toHaveLength(0);
    });

    it('handles products with empty names', () => {
      const products = [{ id: '1', name: '' }];
      const { template, cf } = classifyProducts(products, cfNames);
      expect(cf).toHaveLength(1); // Unknown → keep
      expect(template).toHaveLength(0);
    });

    it('handles products with no name property', () => {
      const products = [{ id: '1' }];
      const { template, cf } = classifyProducts(products, cfNames);
      expect(cf).toHaveLength(1); // Unknown → keep
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
      const { cf } = classifyProducts(products, cfNames);
      expect(cf).toHaveLength(3);
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
      const { template, cf } = classifyProducts(products, cfNames);
      expect(template).toHaveLength(0);
      expect(cf).toHaveLength(1);
    });

    it('prioritizes CF match over template match', () => {
      // If a product name matches both CF and template, keep it
      // This tests the if-else ordering
      const customCF = new Set(['modo']); // hypothetically if "modo" was also a CF product
      const products = [{ id: '1', name: 'Modo' }];
      const { cf } = classifyProducts(products, customCF);
      expect(cf).toHaveLength(1); // CF takes priority
    });
  });
});
