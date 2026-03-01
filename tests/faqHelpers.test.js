import { describe, it, expect } from 'vitest';

import {
  getFaqData,
  getFaqCategories,
  filterFaqsByCategory,
  searchFaqs,
  buildFaqSchemaData,
} from '../src/public/faqHelpers.js';

// ── getFaqCategories ──────────────────────────────────────────────────

describe('getFaqCategories', () => {
  it('returns an array of category objects', () => {
    const cats = getFaqCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThanOrEqual(5);
  });

  it('each category has id, label, and description', () => {
    const cats = getFaqCategories();
    for (const cat of cats) {
      expect(typeof cat.id).toBe('string');
      expect(typeof cat.label).toBe('string');
      expect(typeof cat.description).toBe('string');
      expect(cat.id.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it('includes required categories: products, shipping, returns, financing, showroom', () => {
    const cats = getFaqCategories();
    const ids = cats.map(c => c.id);
    expect(ids).toContain('products');
    expect(ids).toContain('shipping');
    expect(ids).toContain('returns');
    expect(ids).toContain('financing');
    expect(ids).toContain('showroom');
  });

  it('category ids are unique', () => {
    const cats = getFaqCategories();
    const ids = cats.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── getFaqData ────────────────────────────────────────────────────────

describe('getFaqData', () => {
  it('returns an array of FAQ items', () => {
    const faqs = getFaqData();
    expect(Array.isArray(faqs)).toBe(true);
    expect(faqs.length).toBeGreaterThanOrEqual(10);
  });

  it('each FAQ has _id, question, answer, and category', () => {
    const faqs = getFaqData();
    for (const faq of faqs) {
      expect(typeof faq._id).toBe('string');
      expect(typeof faq.question).toBe('string');
      expect(typeof faq.answer).toBe('string');
      expect(typeof faq.category).toBe('string');
      expect(faq._id.length).toBeGreaterThan(0);
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
      expect(faq.category.length).toBeGreaterThan(0);
    }
  });

  it('all FAQ _ids are unique', () => {
    const faqs = getFaqData();
    const ids = faqs.map(f => f._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every FAQ category matches a valid category id', () => {
    const faqs = getFaqData();
    const validCats = new Set(getFaqCategories().map(c => c.id));
    for (const faq of faqs) {
      expect(validCats.has(faq.category)).toBe(true);
    }
  });

  it('each required category has at least 2 FAQs', () => {
    const faqs = getFaqData();
    const required = ['products', 'shipping', 'returns', 'financing', 'showroom'];
    for (const catId of required) {
      const count = faqs.filter(f => f.category === catId).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('questions end with a question mark', () => {
    const faqs = getFaqData();
    for (const faq of faqs) {
      expect(faq.question.endsWith('?')).toBe(true);
    }
  });
});

// ── filterFaqsByCategory ─────────────────────────────────────────────

describe('filterFaqsByCategory', () => {
  it('returns all FAQs when category is null', () => {
    const faqs = getFaqData();
    const result = filterFaqsByCategory(faqs, null);
    expect(result).toEqual(faqs);
  });

  it('returns all FAQs when category is undefined', () => {
    const faqs = getFaqData();
    const result = filterFaqsByCategory(faqs, undefined);
    expect(result).toEqual(faqs);
  });

  it('returns all FAQs when category is empty string', () => {
    const faqs = getFaqData();
    const result = filterFaqsByCategory(faqs, '');
    expect(result).toEqual(faqs);
  });

  it('filters FAQs by valid category', () => {
    const faqs = getFaqData();
    const result = filterFaqsByCategory(faqs, 'shipping');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(f => f.category === 'shipping')).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    const faqs = getFaqData();
    const result = filterFaqsByCategory(faqs, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('handles empty FAQ array', () => {
    const result = filterFaqsByCategory([], 'shipping');
    expect(result).toEqual([]);
  });

  it('handles null FAQ array', () => {
    const result = filterFaqsByCategory(null, 'shipping');
    expect(result).toEqual([]);
  });

  it('handles undefined FAQ array', () => {
    const result = filterFaqsByCategory(undefined, 'shipping');
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const faqs = getFaqData();
    const original = [...faqs];
    filterFaqsByCategory(faqs, 'products');
    expect(faqs).toEqual(original);
  });
});

// ── searchFaqs ───────────────────────────────────────────────────────

describe('searchFaqs', () => {
  it('returns all FAQs when query is empty', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, '');
    expect(result).toEqual(faqs);
  });

  it('returns all FAQs when query is null', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, null);
    expect(result).toEqual(faqs);
  });

  it('returns all FAQs when query is undefined', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, undefined);
    expect(result).toEqual(faqs);
  });

  it('matches FAQs by question text (case-insensitive)', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, 'futon');
    expect(result.length).toBeGreaterThan(0);
    for (const faq of result) {
      const combined = (faq.question + faq.answer).toLowerCase();
      expect(combined).toContain('futon');
    }
  });

  it('matches FAQs by answer text', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, 'Hendersonville');
    expect(result.length).toBeGreaterThan(0);
  });

  it('search is case-insensitive', () => {
    const faqs = getFaqData();
    const upper = searchFaqs(faqs, 'FUTON');
    const lower = searchFaqs(faqs, 'futon');
    const mixed = searchFaqs(faqs, 'Futon');
    expect(upper.length).toBe(lower.length);
    expect(lower.length).toBe(mixed.length);
  });

  it('returns empty array when no matches', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, 'xyznonexistentquery123');
    expect(result).toEqual([]);
  });

  it('handles empty FAQ array', () => {
    const result = searchFaqs([], 'futon');
    expect(result).toEqual([]);
  });

  it('handles null FAQ array', () => {
    const result = searchFaqs(null, 'futon');
    expect(result).toEqual([]);
  });

  it('trims whitespace from query', () => {
    const faqs = getFaqData();
    const trimmed = searchFaqs(faqs, 'futon');
    const padded = searchFaqs(faqs, '  futon  ');
    expect(trimmed.length).toBe(padded.length);
  });

  it('returns all for whitespace-only query', () => {
    const faqs = getFaqData();
    const result = searchFaqs(faqs, '   ');
    expect(result).toEqual(faqs);
  });

  it('does not mutate the input array', () => {
    const faqs = getFaqData();
    const original = [...faqs];
    searchFaqs(faqs, 'futon');
    expect(faqs).toEqual(original);
  });
});

// ── buildFaqSchemaData ───────────────────────────────────────────────

describe('buildFaqSchemaData', () => {
  it('returns an array of {question, answer} objects', () => {
    const faqs = getFaqData();
    const schema = buildFaqSchemaData(faqs);
    expect(Array.isArray(schema)).toBe(true);
    expect(schema.length).toBe(faqs.length);
    for (const item of schema) {
      expect(item).toHaveProperty('question');
      expect(item).toHaveProperty('answer');
      expect(typeof item.question).toBe('string');
      expect(typeof item.answer).toBe('string');
    }
  });

  it('does not include _id or category in schema items', () => {
    const faqs = getFaqData();
    const schema = buildFaqSchemaData(faqs);
    for (const item of schema) {
      expect(item).not.toHaveProperty('_id');
      expect(item).not.toHaveProperty('category');
    }
  });

  it('returns empty array for empty input', () => {
    expect(buildFaqSchemaData([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(buildFaqSchemaData(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(buildFaqSchemaData(undefined)).toEqual([]);
  });

  it('preserves question and answer content exactly', () => {
    const testFaqs = [
      { _id: 'x', question: 'Test Q?', answer: 'Test A', category: 'products' },
    ];
    const schema = buildFaqSchemaData(testFaqs);
    expect(schema[0].question).toBe('Test Q?');
    expect(schema[0].answer).toBe('Test A');
  });
});
