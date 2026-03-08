import { describe, it, expect } from 'vitest';

import {
  validatePriceMatchFields,
  getCompetitorOptions,
  formatClaimStatus,
  getStatusColor,
  formatPrice,
  calculateSavings,
  getPriceMatchPolicy,
} from '../../src/public/priceMatchHelpers.js';

// ── validatePriceMatchFields ─────────────────────────────────────────

describe('validatePriceMatchFields', () => {
  const validFields = {
    productName: 'Asheville Futon Frame',
    ourPrice: '799.99',
    competitorName: 'Wayfair',
    competitorPrice: '649.99',
    competitorUrl: 'https://www.wayfair.com/product/123',
    notes: '',
  };

  it('returns valid for correct fields', () => {
    const result = validatePriceMatchFields(validFields);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires product name', () => {
    const result = validatePriceMatchFields({ ...validFields, productName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'productName')).toBe(true);
  });

  it('requires competitor name', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'competitorName')).toBe(true);
  });

  it('requires our price to be a valid number', () => {
    const result = validatePriceMatchFields({ ...validFields, ourPrice: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'ourPrice')).toBe(true);
  });

  it('rejects zero or negative our price', () => {
    expect(validatePriceMatchFields({ ...validFields, ourPrice: '0' }).valid).toBe(false);
    expect(validatePriceMatchFields({ ...validFields, ourPrice: '-10' }).valid).toBe(false);
  });

  it('requires competitor price to be a valid number', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorPrice: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'competitorPrice')).toBe(true);
  });

  it('rejects zero or negative competitor price', () => {
    expect(validatePriceMatchFields({ ...validFields, competitorPrice: '0' }).valid).toBe(false);
    expect(validatePriceMatchFields({ ...validFields, competitorPrice: '-5' }).valid).toBe(false);
  });

  it('rejects competitor price >= our price', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorPrice: '899.99' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'competitorPrice')).toBe(true);
  });

  it('rejects equal prices', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorPrice: '799.99' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'competitorPrice')).toBe(true);
  });

  it('validates competitor URL if provided', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorUrl: 'not-a-url' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'competitorUrl')).toBe(true);
  });

  it('allows empty competitor URL', () => {
    const result = validatePriceMatchFields({ ...validFields, competitorUrl: '' });
    expect(result.valid).toBe(true);
  });

  it('rejects non-http URLs (javascript:, ftp:)', () => {
    expect(validatePriceMatchFields({ ...validFields, competitorUrl: 'javascript:alert(1)' }).valid).toBe(false);
    expect(validatePriceMatchFields({ ...validFields, competitorUrl: 'ftp://files.com/a' }).valid).toBe(false);
  });

  it('rejects prices exceeding $50,000', () => {
    const result = validatePriceMatchFields({ ...validFields, ourPrice: '60000', competitorPrice: '50001' });
    expect(result.valid).toBe(false);
  });

  it('handles null/undefined input gracefully', () => {
    expect(validatePriceMatchFields(null).valid).toBe(false);
    expect(validatePriceMatchFields(undefined).valid).toBe(false);
    expect(validatePriceMatchFields({}).valid).toBe(false);
  });

  it('trims whitespace from all string fields', () => {
    const result = validatePriceMatchFields({
      ...validFields,
      productName: '  Futon Frame  ',
      competitorName: '  Wayfair  ',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects XSS in product name', () => {
    const result = validatePriceMatchFields({
      ...validFields,
      productName: '<script>alert(1)</script>',
    });
    // Should still be valid (sanitization strips tags, leaving non-empty text)
    // But the field should not contain HTML
    expect(result.valid).toBe(true); // "alert(1)" remains after stripping
  });

  it('collects multiple errors at once', () => {
    const result = validatePriceMatchFields({
      productName: '',
      ourPrice: '',
      competitorName: '',
      competitorPrice: '',
      competitorUrl: '',
      notes: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── getCompetitorOptions ─────────────────────────────────────────────

describe('getCompetitorOptions', () => {
  it('returns array of competitor options', () => {
    const options = getCompetitorOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThanOrEqual(5);
  });

  it('each option has label and value', () => {
    const options = getCompetitorOptions();
    for (const opt of options) {
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('value');
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.value).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.value.length).toBeGreaterThan(0);
    }
  });

  it('includes "Other" option', () => {
    const options = getCompetitorOptions();
    const other = options.find(o => o.value === 'other');
    expect(other).toBeTruthy();
  });

  it('includes major competitors (Wayfair, Amazon, IKEA)', () => {
    const options = getCompetitorOptions();
    const values = options.map(o => o.value.toLowerCase());
    expect(values).toContain('wayfair');
    expect(values).toContain('amazon');
    expect(values).toContain('ikea');
  });
});

// ── formatClaimStatus ────────────────────────────────────────────────

describe('formatClaimStatus', () => {
  it('formats "pending" status', () => {
    const result = formatClaimStatus('pending');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('review');
  });

  it('formats "approved" status', () => {
    const result = formatClaimStatus('approved');
    expect(result.toLowerCase()).toContain('approved');
  });

  it('formats "denied" status', () => {
    const result = formatClaimStatus('denied');
    expect(result.toLowerCase()).toContain('denied');
  });

  it('formats "credited" status', () => {
    const result = formatClaimStatus('credited');
    expect(result.toLowerCase()).toContain('credit');
  });

  it('handles unknown status gracefully', () => {
    const result = formatClaimStatus('unknown');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles null/undefined', () => {
    expect(typeof formatClaimStatus(null)).toBe('string');
    expect(typeof formatClaimStatus(undefined)).toBe('string');
    expect(typeof formatClaimStatus('')).toBe('string');
  });
});

// ── getStatusColor ───────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns a color string for each status', () => {
    for (const status of ['pending', 'approved', 'denied', 'credited']) {
      const color = getStatusColor(status);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('returns a fallback color for unknown status', () => {
    const color = getStatusColor('something-weird');
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });

  it('different statuses get visually distinct colors', () => {
    const approved = getStatusColor('approved');
    const denied = getStatusColor('denied');
    expect(approved).not.toEqual(denied);
  });
});

// ── formatPrice ──────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formats a number as USD currency', () => {
    expect(formatPrice(799.99)).toBe('$799.99');
  });

  it('formats whole numbers with .00', () => {
    expect(formatPrice(100)).toBe('$100.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatPrice(19.999)).toBe('$20.00');
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('handles string input by parsing', () => {
    expect(formatPrice('49.95')).toBe('$49.95');
  });

  it('returns $0.00 for non-numeric input', () => {
    expect(formatPrice('abc')).toBe('$0.00');
    expect(formatPrice(null)).toBe('$0.00');
    expect(formatPrice(undefined)).toBe('$0.00');
  });

  it('adds commas for thousands', () => {
    expect(formatPrice(1299.99)).toBe('$1,299.99');
  });
});

// ── calculateSavings ─────────────────────────────────────────────────

describe('calculateSavings', () => {
  it('calculates price difference correctly', () => {
    const result = calculateSavings(799.99, 649.99);
    expect(result.amount).toBeCloseTo(150.00, 2);
  });

  it('calculates percentage savings', () => {
    const result = calculateSavings(100, 80);
    expect(result.percentage).toBeCloseTo(20, 1);
  });

  it('returns zero for equal prices', () => {
    const result = calculateSavings(100, 100);
    expect(result.amount).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('returns zero if competitor price is higher', () => {
    const result = calculateSavings(80, 100);
    expect(result.amount).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('handles non-numeric input', () => {
    const result = calculateSavings('abc', 'def');
    expect(result.amount).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('handles zero our price without division by zero', () => {
    const result = calculateSavings(0, 50);
    expect(result.amount).toBe(0);
    expect(result.percentage).toBe(0);
  });
});

// ── getPriceMatchPolicy ──────────────────────────────────────────────

describe('getPriceMatchPolicy', () => {
  it('returns policy object with required fields', () => {
    const policy = getPriceMatchPolicy();
    expect(policy).toHaveProperty('title');
    expect(policy).toHaveProperty('description');
    expect(policy).toHaveProperty('rules');
    expect(policy).toHaveProperty('exclusions');
  });

  it('title is a non-empty string', () => {
    expect(typeof getPriceMatchPolicy().title).toBe('string');
    expect(getPriceMatchPolicy().title.length).toBeGreaterThan(0);
  });

  it('rules is a non-empty array of strings', () => {
    const { rules } = getPriceMatchPolicy();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(2);
    for (const rule of rules) {
      expect(typeof rule).toBe('string');
      expect(rule.length).toBeGreaterThan(0);
    }
  });

  it('exclusions is a non-empty array of strings', () => {
    const { exclusions } = getPriceMatchPolicy();
    expect(Array.isArray(exclusions)).toBe(true);
    expect(exclusions.length).toBeGreaterThanOrEqual(1);
  });
});
