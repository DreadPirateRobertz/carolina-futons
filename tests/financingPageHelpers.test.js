/**
 * Tests for financingPageHelpers.js — Financing calculator page utilities
 */
import { describe, it, expect } from 'vitest';
import {
  QUICK_PRICES,
  validatePriceInput,
  formatCurrency,
  formatMonthlyPayment,
  buildComparisonRows,
  getProviderInfo,
  getPriceRangeLabel,
  getFinancingFaqs,
  filterFaqsByTopic,
} from '../src/public/financingPageHelpers.js';

// ── QUICK_PRICES ──────────────────────────────────────────────────────

describe('QUICK_PRICES', () => {
  it('contains preset price options', () => {
    expect(Array.isArray(QUICK_PRICES)).toBe(true);
    expect(QUICK_PRICES.length).toBeGreaterThan(0);
  });

  it('each entry has price and label', () => {
    QUICK_PRICES.forEach(p => {
      expect(typeof p.price).toBe('number');
      expect(typeof p.label).toBe('string');
    });
  });
});

// ── validatePriceInput ────────────────────────────────────────────────

describe('validatePriceInput', () => {
  it('accepts valid numeric price', () => {
    const result = validatePriceInput(500);
    expect(result.valid).toBe(true);
    expect(result.price).toBe(500);
    expect(result.error).toBeNull();
  });

  it('accepts string price with $ and commas', () => {
    const result = validatePriceInput('$1,500');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(1500);
  });

  it('accepts string price with leading spaces', () => {
    const result = validatePriceInput('  999  ');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(999);
  });

  it('rejects null/undefined/empty', () => {
    expect(validatePriceInput(null).valid).toBe(false);
    expect(validatePriceInput(undefined).valid).toBe(false);
    expect(validatePriceInput('').valid).toBe(false);
  });

  it('provides error message for empty input', () => {
    expect(validatePriceInput('').error).toContain('enter a price');
  });

  it('rejects non-numeric strings', () => {
    const result = validatePriceInput('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid number');
  });

  it('rejects zero and negative values', () => {
    expect(validatePriceInput(0).valid).toBe(false);
    expect(validatePriceInput(-100).valid).toBe(false);
    expect(validatePriceInput(0).error).toContain('greater than $0');
  });

  it('rejects values above $25,000', () => {
    const result = validatePriceInput(30000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('25,000');
  });

  it('accepts boundary value $25,000', () => {
    expect(validatePriceInput(25000).valid).toBe(true);
  });

  it('accepts boundary value just above $0', () => {
    expect(validatePriceInput(0.01).valid).toBe(true);
  });

  it('rejects NaN/Infinity', () => {
    expect(validatePriceInput(NaN).valid).toBe(false);
    expect(validatePriceInput(Infinity).valid).toBe(false);
  });
});

// ── formatCurrency ────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole dollar amount', () => {
    expect(formatCurrency(1500)).toBe('$1,500.00');
  });

  it('formats cents', () => {
    expect(formatCurrency(42.5)).toBe('$42.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('adds comma separators for thousands', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
  });
});

// ── formatMonthlyPayment ──────────────────────────────────────────────

describe('formatMonthlyPayment', () => {
  it('appends /mo suffix', () => {
    expect(formatMonthlyPayment(42.5)).toBe('$42.50/mo');
  });

  it('formats with commas', () => {
    expect(formatMonthlyPayment(1500)).toBe('$1,500.00/mo');
  });
});

// ── buildComparisonRows ───────────────────────────────────────────────

describe('buildComparisonRows', () => {
  it('includes afterpay row when eligible', () => {
    const afterpay = { eligible: true, installmentAmount: 125, total: 500 };
    const rows = buildComparisonRows([], afterpay);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('afterpay');
    expect(rows[0].isZeroInterest).toBe(true);
  });

  it('excludes afterpay when not eligible', () => {
    const afterpay = { eligible: false };
    const rows = buildComparisonRows([], afterpay);
    expect(rows).toHaveLength(0);
  });

  it('includes term rows', () => {
    const terms = [
      { label: '6 months', monthly: 83.33, total: 500, interest: 0, apr: 0, isZeroInterest: true, months: 6 },
      { label: '12 months', monthly: 45, total: 540, interest: 40, apr: 8.99, isZeroInterest: false, months: 12 },
    ];
    const rows = buildComparisonRows(terms, null);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('term');
    expect(rows[0].isZeroInterest).toBe(true);
    expect(rows[1].interestText).toContain('8.99%');
  });

  it('puts afterpay first, then terms', () => {
    const afterpay = { eligible: true, installmentAmount: 125, total: 500 };
    const terms = [{ label: '6 months', monthly: 83, total: 500, interest: 0, apr: 0, isZeroInterest: true, months: 6 }];
    const rows = buildComparisonRows(terms, afterpay);
    expect(rows[0].type).toBe('afterpay');
    expect(rows[1].type).toBe('term');
  });
});

// ── getProviderInfo ───────────────────────────────────────────────────

describe('getProviderInfo', () => {
  it('returns provider information', () => {
    const providers = getProviderInfo();
    expect(providers.length).toBeGreaterThan(0);
    providers.forEach(p => {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('description');
      expect(p).toHaveProperty('range');
    });
  });

  it('includes Afterpay and Affirm', () => {
    const names = getProviderInfo().map(p => p.name);
    expect(names).toContain('Afterpay');
    expect(names).toContain('Affirm');
  });
});

// ── getPriceRangeLabel ────────────────────────────────────────────────

describe('getPriceRangeLabel', () => {
  it('returns afterpay-only message for low prices', () => {
    expect(getPriceRangeLabel(100)).toContain('Afterpay');
  });

  it('returns 6-month message for $200-499', () => {
    expect(getPriceRangeLabel(300)).toContain('6-month');
  });

  it('returns multiple plans for $500-749', () => {
    expect(getPriceRangeLabel(600)).toContain('6 and 12');
  });

  it('returns multiple + afterpay for $750-1000', () => {
    expect(getPriceRangeLabel(900)).toContain('Afterpay');
  });

  it('returns full range for $1000+', () => {
    expect(getPriceRangeLabel(2000)).toContain('Full range');
  });
});

// ── getFinancingFaqs ──────────────────────────────────────────────────

describe('getFinancingFaqs', () => {
  it('returns FAQ array with question, answer, topic', () => {
    const faqs = getFinancingFaqs();
    expect(faqs.length).toBeGreaterThan(0);
    faqs.forEach(faq => {
      expect(faq).toHaveProperty('question');
      expect(faq).toHaveProperty('answer');
      expect(faq).toHaveProperty('topic');
    });
  });
});

// ── filterFaqsByTopic ─────────────────────────────────────────────────

describe('filterFaqsByTopic', () => {
  const faqs = [
    { question: 'About Affirm?', answer: 'Affirm lets you split...', topic: 'affirm' },
    { question: 'Credit check?', answer: 'Soft credit check...', topic: 'credit' },
    { question: 'Minimum purchase?', answer: 'From $35...', topic: 'eligibility' },
  ];

  it('filters by topic keyword in question/answer', () => {
    const result = filterFaqsByTopic(faqs, 'affirm');
    expect(result).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(filterFaqsByTopic(faqs, 'AFFIRM')).toHaveLength(1);
  });

  it('returns all when topic is null/empty', () => {
    expect(filterFaqsByTopic(faqs, null)).toHaveLength(3);
    expect(filterFaqsByTopic(faqs, '')).toHaveLength(3);
    expect(filterFaqsByTopic(faqs, '   ')).toHaveLength(3);
  });

  it('searches across question and answer text', () => {
    const result = filterFaqsByTopic(faqs, 'credit');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
