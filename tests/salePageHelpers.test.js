import { describe, it, expect } from 'vitest';
import {
  getSaleIntro,
  getPriceMatchNote,
  formatDiscount,
  formatSalePrice,
  sortByDiscount,
} from '../src/public/salePageHelpers.js';

// ── getSaleIntro ──────────────────────────────────────────────────────

describe('getSaleIntro', () => {
  it('returns a non-empty string', () => {
    expect(typeof getSaleIntro()).toBe('string');
    expect(getSaleIntro().length).toBeGreaterThan(20);
  });

  it('mentions sale and clearance', () => {
    expect(getSaleIntro()).toContain('sale');
    expect(getSaleIntro()).toContain('clearance');
  });
});

// ── getPriceMatchNote ─────────────────────────────────────────────────

describe('getPriceMatchNote', () => {
  it('mentions price-matching policy', () => {
    expect(getPriceMatchNote()).toContain('price-matching');
  });

  it('mentions GripStrips included', () => {
    expect(getPriceMatchNote()).toContain('GripStrips');
  });
});

// ── formatDiscount ────────────────────────────────────────────────────

describe('formatDiscount', () => {
  it('returns percentage off for significant discounts', () => {
    expect(formatDiscount(1000, 800)).toBe('20% off');
  });

  it('returns dollar savings for small percentage discounts', () => {
    expect(formatDiscount(1000, 950)).toBe('Save $50');
  });

  it('returns empty for no discount', () => {
    expect(formatDiscount(1000, 1000)).toBe('');
  });

  it('returns empty for sale price higher than original', () => {
    expect(formatDiscount(800, 1000)).toBe('');
  });

  it('returns empty for null/undefined inputs', () => {
    expect(formatDiscount(null, 500)).toBe('');
    expect(formatDiscount(1000, null)).toBe('');
  });

  it('rounds percentage to nearest integer', () => {
    expect(formatDiscount(300, 200)).toBe('33% off');
  });
});

// ── formatSalePrice ───────────────────────────────────────────────────

describe('formatSalePrice', () => {
  it('shows Reg. and Sale prices', () => {
    const result = formatSalePrice({ price: 1129, discountedPrice: 903 });
    expect(result).toContain('Reg.');
    expect(result).toContain('Sale');
    expect(result).toContain('$1,129');
    expect(result).toContain('$903');
  });

  it('shows only original price when no discount', () => {
    const result = formatSalePrice({ price: 500 });
    expect(result).toBe('$500');
    expect(result).not.toContain('Sale');
  });

  it('returns empty for null product', () => {
    expect(formatSalePrice(null)).toBe('');
  });

  it('returns empty for product without price', () => {
    expect(formatSalePrice({ name: 'Test' })).toBe('');
  });
});

// ── sortByDiscount ────────────────────────────────────────────────────

describe('sortByDiscount', () => {
  it('sorts by largest discount first', () => {
    const items = [
      { name: 'A', price: 100, discountedPrice: 90 },   // 10% off
      { name: 'B', price: 100, discountedPrice: 40 },   // 60% off
      { name: 'C', price: 100, discountedPrice: 70 },   // 30% off
    ];
    const sorted = sortByDiscount(items);
    expect(sorted[0].name).toBe('B');
    expect(sorted[1].name).toBe('C');
    expect(sorted[2].name).toBe('A');
  });

  it('does not mutate original array', () => {
    const items = [
      { name: 'A', price: 100, discountedPrice: 90 },
      { name: 'B', price: 100, discountedPrice: 40 },
    ];
    const sorted = sortByDiscount(items);
    expect(items[0].name).toBe('A');
    expect(sorted).not.toBe(items);
  });

  it('handles items without discountedPrice', () => {
    const items = [
      { name: 'A', price: 100 },
      { name: 'B', price: 100, discountedPrice: 50 },
    ];
    const sorted = sortByDiscount(items);
    expect(sorted[0].name).toBe('B');
  });

  it('returns empty array for empty input', () => {
    expect(sortByDiscount([])).toEqual([]);
  });
});
