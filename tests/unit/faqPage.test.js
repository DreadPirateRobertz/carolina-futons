import { describe, it, expect } from 'vitest';

import {
  getFaqData,
  getFaqCategories,
  filterFaqsByCategory,
  searchFaqs,
  buildFaqSchemaData,
} from '../../src/public/faqHelpers.js';

// ── Combined filter + search (simulates page behavior) ──────────────

describe('FAQ page filtering behavior', () => {
  it('category then search narrows results correctly', () => {
    const all = getFaqData();
    const products = filterFaqsByCategory(all, 'products');
    const result = searchFaqs(products, 'futon');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(products.length);
    for (const faq of result) {
      expect(faq.category).toBe('products');
      const combined = (faq.question + faq.answer).toLowerCase();
      expect(combined).toContain('futon');
    }
  });

  it('search then category narrows results correctly', () => {
    const all = getFaqData();
    const searched = searchFaqs(all, 'warranty');
    const result = filterFaqsByCategory(searched, 'returns');
    for (const faq of result) {
      expect(faq.category).toBe('returns');
      const combined = (faq.question + faq.answer).toLowerCase();
      expect(combined).toContain('warranty');
    }
  });

  it('clearing category shows all search results', () => {
    const all = getFaqData();
    const searched = searchFaqs(all, 'futon');
    const withCat = filterFaqsByCategory(searched, 'products');
    const cleared = filterFaqsByCategory(searched, null);
    expect(cleared.length).toBeGreaterThanOrEqual(withCat.length);
    expect(cleared).toEqual(searched);
  });

  it('clearing search shows all category results', () => {
    const all = getFaqData();
    const catFiltered = filterFaqsByCategory(all, 'shipping');
    const searched = searchFaqs(catFiltered, '');
    expect(searched).toEqual(catFiltered);
  });
});

// ── Schema generation from filtered data ────────────────────────────

describe('FAQ schema generation', () => {
  it('schema includes all FAQs by default', () => {
    const all = getFaqData();
    const schema = buildFaqSchemaData(all);
    expect(schema.length).toBe(all.length);
  });

  it('schema from category-filtered FAQs only includes that category', () => {
    const shipping = filterFaqsByCategory(getFaqData(), 'shipping');
    const schema = buildFaqSchemaData(shipping);
    expect(schema.length).toBe(shipping.length);
    for (let i = 0; i < schema.length; i++) {
      expect(schema[i].question).toBe(shipping[i].question);
      expect(schema[i].answer).toBe(shipping[i].answer);
    }
  });
});

// ── Data integrity ──────────────────────────────────────────────────

describe('FAQ data integrity', () => {
  it('no duplicate questions exist', () => {
    const faqs = getFaqData();
    const questions = faqs.map(f => f.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('answers are non-trivial (at least 20 characters)', () => {
    const faqs = getFaqData();
    for (const faq of faqs) {
      expect(faq.answer.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('category labels are user-friendly (not raw ids)', () => {
    const cats = getFaqCategories();
    for (const cat of cats) {
      // Labels should have capital letters and be longer than id
      expect(cat.label[0]).toBe(cat.label[0].toUpperCase());
      expect(cat.label.length).toBeGreaterThanOrEqual(cat.id.length);
    }
  });

  it('no FAQ contains HTML tags in question or answer', () => {
    const htmlRe = /<[^>]+>/;
    const faqs = getFaqData();
    for (const faq of faqs) {
      expect(htmlRe.test(faq.question)).toBe(false);
      expect(htmlRe.test(faq.answer)).toBe(false);
    }
  });
});
