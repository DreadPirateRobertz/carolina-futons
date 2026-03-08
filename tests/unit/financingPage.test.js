import { describe, it, expect } from 'vitest';

import {
  validatePriceInput,
  formatCurrency,
  formatMonthlyPayment,
  getFinancingFaqs,
  filterFaqsByTopic,
  buildComparisonRows,
  getProviderInfo,
  getPriceRangeLabel,
  QUICK_PRICES,
} from '../../src/public/financingPageHelpers.js';

// ── Price Input Validation ──────────────────────────────────────────

describe('validatePriceInput', () => {
  it('accepts valid numeric string', () => {
    const result = validatePriceInput('599.99');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(599.99);
    expect(result.error).toBeNull();
  });

  it('accepts integer string', () => {
    const result = validatePriceInput('1000');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(1000);
  });

  it('accepts number type', () => {
    const result = validatePriceInput(799);
    expect(result.valid).toBe(true);
    expect(result.price).toBe(799);
  });

  it('rejects empty string', () => {
    const result = validatePriceInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects null', () => {
    const result = validatePriceInput(null);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validatePriceInput(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric string', () => {
    const result = validatePriceInput('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  it('rejects negative numbers', () => {
    const result = validatePriceInput('-50');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects zero', () => {
    const result = validatePriceInput('0');
    expect(result.valid).toBe(false);
  });

  it('rejects NaN', () => {
    const result = validatePriceInput(NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects Infinity', () => {
    const result = validatePriceInput(Infinity);
    expect(result.valid).toBe(false);
  });

  it('rejects prices above $25,000', () => {
    const result = validatePriceInput('30000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('25,000');
  });

  it('strips dollar sign prefix', () => {
    const result = validatePriceInput('$599');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(599);
  });

  it('strips commas', () => {
    const result = validatePriceInput('1,299.99');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(1299.99);
  });

  it('trims whitespace', () => {
    const result = validatePriceInput('  800  ');
    expect(result.valid).toBe(true);
    expect(result.price).toBe(800);
  });
});

// ── Currency Formatting ─────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(500)).toBe('$500.00');
  });

  it('formats cents', () => {
    expect(formatCurrency(42.5)).toBe('$42.50');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(33.333)).toBe('$33.33');
  });

  it('adds comma for thousands', () => {
    expect(formatCurrency(1500)).toBe('$1,500.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatMonthlyPayment', () => {
  it('formats as "/mo" display', () => {
    expect(formatMonthlyPayment(42.5)).toBe('$42.50/mo');
  });

  it('rounds cents', () => {
    expect(formatMonthlyPayment(33.333)).toBe('$33.33/mo');
  });
});

// ── Quick Prices ────────────────────────────────────────────────────

describe('QUICK_PRICES', () => {
  it('has common furniture price points', () => {
    expect(QUICK_PRICES.length).toBeGreaterThanOrEqual(4);
    for (const qp of QUICK_PRICES) {
      expect(qp).toHaveProperty('price');
      expect(qp).toHaveProperty('label');
      expect(typeof qp.price).toBe('number');
      expect(qp.price).toBeGreaterThan(0);
    }
  });

  it('prices are in ascending order', () => {
    for (let i = 1; i < QUICK_PRICES.length; i++) {
      expect(QUICK_PRICES[i].price).toBeGreaterThan(QUICK_PRICES[i - 1].price);
    }
  });
});

// ── Comparison Table ────────────────────────────────────────────────

describe('buildComparisonRows', () => {
  const sampleTerms = [
    { months: 6, apr: 0, monthly: 133.33, total: 799.98, interest: 0, label: '6 Months', isZeroInterest: true },
    { months: 12, apr: 0, monthly: 66.67, total: 800.04, interest: 0, label: '12 Months', isZeroInterest: true },
    { months: 24, apr: 9.99, monthly: 36.89, total: 885.36, interest: 85.36, label: '24 Months', isZeroInterest: false },
  ];

  const sampleAfterpay = {
    eligible: true,
    installmentAmount: 200,
    installments: 4,
    total: 800,
  };

  it('includes Afterpay row when eligible', () => {
    const rows = buildComparisonRows(sampleTerms, sampleAfterpay);
    const afterpayRow = rows.find(r => r.type === 'afterpay');
    expect(afterpayRow).toBeDefined();
    expect(afterpayRow.payment).toBe('$200.00');
    expect(afterpayRow.totalCost).toBe('$800.00');
    expect(afterpayRow.interestText).toContain('0');
  });

  it('includes all term rows', () => {
    const rows = buildComparisonRows(sampleTerms, sampleAfterpay);
    const termRows = rows.filter(r => r.type === 'term');
    expect(termRows.length).toBe(3);
  });

  it('excludes Afterpay when ineligible', () => {
    const rows = buildComparisonRows(sampleTerms, { eligible: false });
    const afterpayRow = rows.find(r => r.type === 'afterpay');
    expect(afterpayRow).toBeUndefined();
  });

  it('returns empty array for no data', () => {
    const rows = buildComparisonRows([], { eligible: false });
    expect(rows).toEqual([]);
  });

  it('rows have required display fields', () => {
    const rows = buildComparisonRows(sampleTerms, sampleAfterpay);
    for (const row of rows) {
      expect(row).toHaveProperty('label');
      expect(row).toHaveProperty('payment');
      expect(row).toHaveProperty('totalCost');
      expect(row).toHaveProperty('interestText');
      expect(row).toHaveProperty('type');
    }
  });

  it('marks zero-interest rows', () => {
    const rows = buildComparisonRows(sampleTerms, sampleAfterpay);
    const sixMonth = rows.find(r => r.label === '6 Months');
    expect(sixMonth.isZeroInterest).toBe(true);
    const twentyFour = rows.find(r => r.label === '24 Months');
    expect(twentyFour.isZeroInterest).toBe(false);
  });
});

// ── Provider Info ───────────────────────────────────────────────────

describe('getProviderInfo', () => {
  it('returns array of provider objects', () => {
    const providers = getProviderInfo();
    expect(providers.length).toBeGreaterThanOrEqual(2);
    for (const p of providers) {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('description');
      expect(typeof p.name).toBe('string');
      expect(typeof p.description).toBe('string');
    }
  });

  it('includes Affirm', () => {
    const providers = getProviderInfo();
    const affirm = providers.find(p => p.name === 'Affirm');
    expect(affirm).toBeDefined();
  });

  it('includes Afterpay', () => {
    const providers = getProviderInfo();
    const afterpay = providers.find(p => p.name === 'Afterpay');
    expect(afterpay).toBeDefined();
  });
});

// ── Price Range Labels ──────────────────────────────────────────────

describe('getPriceRangeLabel', () => {
  it('returns label for low price', () => {
    const label = getPriceRangeLabel(100);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns label for mid price', () => {
    const label = getPriceRangeLabel(800);
    expect(typeof label).toBe('string');
  });

  it('returns label for high price', () => {
    const label = getPriceRangeLabel(3000);
    expect(typeof label).toBe('string');
  });

  it('handles boundary at financing minimum', () => {
    const below = getPriceRangeLabel(199);
    const at = getPriceRangeLabel(200);
    // Below minimum should mention financing availability
    expect(below).not.toBe(at);
  });
});

// ── Financing FAQs ──────────────────────────────────────────────────

describe('getFinancingFaqs', () => {
  it('returns array of FAQ objects', () => {
    const faqs = getFinancingFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    for (const faq of faqs) {
      expect(faq).toHaveProperty('question');
      expect(faq).toHaveProperty('answer');
      expect(typeof faq.question).toBe('string');
      expect(typeof faq.answer).toBe('string');
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });

  it('has unique questions', () => {
    const faqs = getFinancingFaqs();
    const questions = faqs.map(f => f.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe('filterFaqsByTopic', () => {
  it('returns all FAQs for null topic', () => {
    const all = getFinancingFaqs();
    const filtered = filterFaqsByTopic(all, null);
    expect(filtered).toEqual(all);
  });

  it('returns all FAQs for empty string', () => {
    const all = getFinancingFaqs();
    const filtered = filterFaqsByTopic(all, '');
    expect(filtered).toEqual(all);
  });

  it('filters by topic keyword', () => {
    const all = getFinancingFaqs();
    // At least one FAQ should mention "credit" or "interest"
    const filtered = filterFaqsByTopic(all, 'interest');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    for (const faq of filtered) {
      const combined = (faq.question + faq.answer).toLowerCase();
      expect(combined).toContain('interest');
    }
  });

  it('case insensitive filtering', () => {
    const all = getFinancingFaqs();
    const lower = filterFaqsByTopic(all, 'affirm');
    const upper = filterFaqsByTopic(all, 'AFFIRM');
    expect(lower).toEqual(upper);
  });

  it('returns empty for non-matching topic', () => {
    const all = getFinancingFaqs();
    const filtered = filterFaqsByTopic(all, 'zzzznonexistentzzzz');
    expect(filtered).toEqual([]);
  });
});
