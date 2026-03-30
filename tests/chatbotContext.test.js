/**
 * @file chatbotContext.test.js
 * @description Unit tests for chatbotContext.js — pure system prompt builder functions.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildCatalogSummary,
  extractProductKeywords,
  findSuggestedProducts,
  MAX_CATALOG_PRODUCTS,
} from '../src/backend/utils/chatbotContext.js';

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('includes store name and address in base prompt', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Carolina Futons');
    expect(prompt).toContain('Hendersonville, NC');
  });

  it('includes store hours', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Mon–Fri 10am–6pm');
    expect(prompt).toContain('Sat 10am–5pm');
  });

  it('includes return policy', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('30-day returns');
  });

  it('includes delivery area info', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Western NC');
  });

  it('injects catalog summary when provided', () => {
    const prompt = buildSystemPrompt('Futon Frame A — $299\nBed B — $599');
    expect(prompt).toContain('Futon Frame A');
    expect(prompt).toContain('$299');
  });

  it('omits catalog section when summary is empty string', () => {
    const prompt = buildSystemPrompt('');
    expect(prompt).not.toContain('Current product catalog');
  });

  it('omits catalog section when summary is only whitespace', () => {
    const prompt = buildSystemPrompt('   ');
    expect(prompt).not.toContain('Current product catalog');
  });
});

// ---------------------------------------------------------------------------
// buildCatalogSummary
// ---------------------------------------------------------------------------

describe('buildCatalogSummary', () => {
  it('returns empty string for empty array', () => {
    expect(buildCatalogSummary([])).toBe('');
  });

  it('returns empty string for non-array input', () => {
    expect(buildCatalogSummary(null)).toBe('');
    expect(buildCatalogSummary(undefined)).toBe('');
  });

  it('formats a product with name, price, and description', () => {
    const summary = buildCatalogSummary([
      { name: 'Futon Frame A', price: 299, description: 'Solid wood futon frame' },
    ]);
    expect(summary).toContain('Futon Frame A');
    expect(summary).toContain('$299');
    expect(summary).toContain('Solid wood futon frame');
  });

  it('omits price when zero or absent', () => {
    const summary = buildCatalogSummary([{ name: 'No-price item', price: 0 }]);
    expect(summary).not.toContain('$0');
  });

  it('caps at MAX_CATALOG_PRODUCTS items', () => {
    const products = Array.from({ length: MAX_CATALOG_PRODUCTS + 5 }, (_, i) => ({
      name: `Product ${i}`, price: 100,
    }));
    const summary = buildCatalogSummary(products);
    const lines = summary.split('\n');
    expect(lines.length).toBeLessThanOrEqual(MAX_CATALOG_PRODUCTS);
  });

  it('truncates very long product lines', () => {
    const summary = buildCatalogSummary([{
      name: 'A'.repeat(200),
      price: 100,
      description: 'B'.repeat(200),
    }]);
    const line = summary.split('\n')[0];
    expect(line.length).toBeLessThanOrEqual(120);
  });
});

// ---------------------------------------------------------------------------
// extractProductKeywords
// ---------------------------------------------------------------------------

describe('extractProductKeywords', () => {
  it('returns empty array for empty string', () => {
    expect(extractProductKeywords('')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(extractProductKeywords(null)).toEqual([]);
    expect(extractProductKeywords(42)).toEqual([]);
  });

  it('extracts meaningful keywords', () => {
    const kws = extractProductKeywords('Do you have any futons under $400?');
    expect(kws).toContain('futons');
    expect(kws).toContain('400');
  });

  it('filters stopwords', () => {
    const kws = extractProductKeywords('What is the best futon for my room?');
    expect(kws).not.toContain('the');
    expect(kws).not.toContain('for');
    expect(kws).not.toContain('is');
    expect(kws).toContain('best');
    expect(kws).toContain('futon');
    expect(kws).toContain('room');
  });

  it('deduplicates keywords', () => {
    const kws = extractProductKeywords('futon futon futon');
    expect(kws.filter(k => k === 'futon').length).toBe(1);
  });

  it('returns at most 10 keywords', () => {
    const msg = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
    expect(extractProductKeywords(msg).length).toBeLessThanOrEqual(10);
  });

  it('lowercases keywords', () => {
    const kws = extractProductKeywords('FUTON Frame BED');
    expect(kws).toContain('futon');
    expect(kws).toContain('frame');
    expect(kws).toContain('bed');
  });
});

// ---------------------------------------------------------------------------
// findSuggestedProducts
// ---------------------------------------------------------------------------

describe('findSuggestedProducts', () => {
  const products = [
    { name: 'Classic Futon Frame', description: 'Solid wood futon frame in natural finish', slug: 'classic-futon', price: 299 },
    { name: 'Murphy Cabinet Bed', description: 'Space-saving wall bed with cabinet', slug: 'murphy-bed', price: 899 },
    { name: 'Platform Bed', description: 'Low-profile solid wood platform bed', slug: 'platform-bed', price: 499 },
    { name: 'Futon Mattress', description: 'Cotton-blend futon mattress, multiple sizes', slug: 'futon-mattress', price: 149 },
  ];

  it('returns empty array for empty products', () => {
    expect(findSuggestedProducts([], 'futon')).toEqual([]);
  });

  it('returns empty array when no keywords match', () => {
    const result = findSuggestedProducts(products, 'refrigerator microwave oven');
    expect(result).toEqual([]);
  });

  it('returns products matching keywords in name', () => {
    const result = findSuggestedProducts(products, 'futon mattress');
    const names = result.map(p => p.name);
    expect(names).toContain('Futon Mattress');
    expect(names).toContain('Classic Futon Frame');
  });

  it('ranks higher-match products first', () => {
    const result = findSuggestedProducts(products, 'futon mattress cotton');
    // Futon Mattress matches "futon", "mattress", "cotton" — should rank first
    expect(result[0].name).toBe('Futon Mattress');
  });

  it('returns at most 3 results by default', () => {
    const result = findSuggestedProducts(products, 'futon bed wood platform');
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('respects custom limit', () => {
    const result = findSuggestedProducts(products, 'futon bed wood', 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns name, slug, and price fields', () => {
    const result = findSuggestedProducts(products, 'futon');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('slug');
    expect(result[0]).toHaveProperty('price');
  });

  it('returns null for missing slug', () => {
    const noSlugProducts = [{ name: 'Mystery Bed', description: 'futon style', price: 300 }];
    const result = findSuggestedProducts(noSlugProducts, 'futon');
    expect(result[0].slug).toBeNull();
  });

  it('returns null price for non-numeric price', () => {
    const products2 = [{ name: 'Mystery Bed', description: 'futon style', price: 'call for price' }];
    const result = findSuggestedProducts(products2, 'futon');
    expect(result[0].price).toBeNull();
  });

  it('returns empty array for empty message', () => {
    expect(findSuggestedProducts(products, '')).toEqual([]);
  });
});
