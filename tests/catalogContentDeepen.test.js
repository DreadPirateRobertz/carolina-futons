import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  getProductContent, getProductSpecs, getCategoryContent,
  getAllCategories, saveFAQ, saveProductSpecs,
} from 'backend/catalogContent.web';

beforeEach(() => {
  __reset();
});

// ═════════════════════════════════════════════════════════════════════
// cleanSlug edge cases (tested via exported functions that use it)
// ═════════════════════════════════════════════════════════════════════
describe('cleanSlug edge cases', () => {
  it('strips special chars from slug', async () => {
    __seed('Stores/Products', [{ slug: 'hellworld', name: 'Test' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('he!ll@wo#rld');
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('hellworld');
  });

  it('lowercases uppercase slugs', async () => {
    __seed('ProductSpecs', [{ slug: 'upper-test', materials: 'Oak' }]);
    const result = await getProductSpecs('UPPER-TEST');
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('upper-test');
  });

  it('truncates slugs longer than 100 chars', async () => {
    const longSlug = 'a'.repeat(150);
    const truncated = 'a'.repeat(100);
    __seed('ProductSpecs', [{ slug: truncated, materials: 'Pine' }]);
    const result = await getProductSpecs(longSlug);
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe(truncated);
  });

  it('returns error for undefined slug', async () => {
    const result = await getProductContent(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('returns error for numeric slug (non-string)', async () => {
    const result = await getProductSpecs(12345);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('returns error for slug that becomes empty after cleaning', async () => {
    // Only special chars — all stripped, resulting in empty string
    const result = await getProductContent('!!!@@@###');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });
});

// ═════════════════════════════════════════════════════════════════════
// parseJsonField edge cases (tested via getProductSpecs/getProductContent)
// ═════════════════════════════════════════════════════════════════════
describe('parseJsonField edge cases', () => {
  it('returns object as-is when dimensions is already an object', async () => {
    // If the DB somehow has an object instead of a string, parseJsonField returns it directly
    __seed('ProductSpecs', [{ slug: 'obj-dims', dimensions: { w: 50 }, features: ['a'] }]);
    const result = await getProductSpecs('obj-dims');
    expect(result.success).toBe(true);
    expect(result.data.dimensions).toEqual({ w: 50 });
  });

  it('returns array as-is when features is already an array', async () => {
    __seed('ProductSpecs', [{ slug: 'arr-feat', dimensions: null, features: ['x', 'y'] }]);
    const result = await getProductSpecs('arr-feat');
    expect(result.success).toBe(true);
    expect(result.data.features).toEqual(['x', 'y']);
  });

  it('returns null for malformed JSON string in dimensions', async () => {
    __seed('ProductSpecs', [{ slug: 'bad-json', dimensions: '{broken', features: '["valid"]' }]);
    const result = await getProductSpecs('bad-json');
    expect(result.data.dimensions).toBeNull();
    expect(result.data.features).toEqual(['valid']);
  });

  it('returns empty array for malformed JSON string in features', async () => {
    __seed('ProductSpecs', [{ slug: 'bad-feat', dimensions: null, features: 'not[json' }]);
    const result = await getProductSpecs('bad-feat');
    // parseJsonField returns null for malformed, then || [] kicks in
    expect(result.data.features).toEqual([]);
  });

  it('returns null for undefined dimension value', async () => {
    __seed('ProductSpecs', [{ slug: 'undef-dims' }]);
    const result = await getProductSpecs('undef-dims');
    expect(result.data.dimensions).toBeNull();
  });

  it('returns empty array for empty string features', async () => {
    // empty string is falsy, parseJsonField returns null, || [] gives []
    __seed('ProductSpecs', [{ slug: 'empty-feat', features: '' }]);
    const result = await getProductSpecs('empty-feat');
    expect(result.data.features).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// saveProductSpecs insert vs update paths
// ═════════════════════════════════════════════════════════════════════
describe('saveProductSpecs insert/update paths', () => {
  it('calls insert when no existing specs for slug', async () => {
    let insertedCollection;
    __onInsert((collection, item) => { insertedCollection = collection; });
    __seed('ProductSpecs', []);

    const result = await saveProductSpecs({ slug: 'new-futon', materials: 'Bamboo' });
    expect(result.success).toBe(true);
    expect(insertedCollection).toBe('ProductSpecs');
  });

  it('calls update when existing specs found for slug', async () => {
    let updatedCollection, updatedItem;
    __onUpdate((collection, item) => { updatedCollection = collection; updatedItem = item; });
    __seed('ProductSpecs', [{ _id: 'existing-1', slug: 'old-futon', materials: 'Pine' }]);

    const result = await saveProductSpecs({ slug: 'old-futon', materials: 'Oak' });
    expect(result.success).toBe(true);
    expect(updatedCollection).toBe('ProductSpecs');
    expect(updatedItem._id).toBe('existing-1');
    expect(updatedItem.materials).toBe('Oak');
  });

  it('rejects non-object input (string)', async () => {
    const result = await saveProductSpecs('not-an-object');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid specs data');
  });

  it('rejects non-object input (number)', async () => {
    const result = await saveProductSpecs(42);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid specs data');
  });

  it('serializes dimensions as JSON string on insert', async () => {
    let insertedItem;
    __onInsert((_, item) => { insertedItem = item; });
    __seed('ProductSpecs', []);

    await saveProductSpecs({ slug: 'dim-test', dimensions: { width: 80, height: 30 } });
    expect(insertedItem.dimensions).toBe('{"width":80,"height":30}');
  });

  it('serializes features as JSON array string on insert', async () => {
    let insertedItem;
    __onInsert((_, item) => { insertedItem = item; });
    __seed('ProductSpecs', []);

    await saveProductSpecs({ slug: 'feat-test', features: ['solid wood', 'eco-friendly'] });
    expect(insertedItem.features).toBe('["solid wood","eco-friendly"]');
  });

  it('stores null dimensions when not provided', async () => {
    let insertedItem;
    __onInsert((_, item) => { insertedItem = item; });
    __seed('ProductSpecs', []);

    await saveProductSpecs({ slug: 'no-dims' });
    expect(insertedItem.dimensions).toBeNull();
  });

  it('stores null features when not an array', async () => {
    let insertedItem;
    __onInsert((_, item) => { insertedItem = item; });
    __seed('ProductSpecs', []);

    await saveProductSpecs({ slug: 'str-feat', features: 'just a string' });
    expect(insertedItem.features).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// saveFAQ insert vs update paths
// ═════════════════════════════════════════════════════════════════════
describe('saveFAQ insert/update paths', () => {
  it('calls insert when no _id provided', async () => {
    let insertedCollection;
    __onInsert((collection) => { insertedCollection = collection; });

    const result = await saveFAQ({
      targetType: 'product', targetSlug: 'test',
      question: 'New?', answer: 'Yes',
    });
    expect(result.success).toBe(true);
    expect(insertedCollection).toBe('ProductFAQs');
  });

  it('calls update when _id is provided', async () => {
    let updatedCollection, updatedItem;
    __onUpdate((collection, item) => { updatedCollection = collection; updatedItem = item; });
    __seed('ProductFAQs', [{ _id: 'faq-up', targetType: 'product', targetSlug: 'test', question: 'Old', answer: 'Old' }]);

    const result = await saveFAQ({
      _id: 'faq-up', targetType: 'product', targetSlug: 'test',
      question: 'Updated?', answer: 'Updated',
    });
    expect(result.success).toBe(true);
    expect(updatedCollection).toBe('ProductFAQs');
    expect(updatedItem._id).toBe('faq-up');
  });

  it('preserves explicit sortOrder', async () => {
    const result = await saveFAQ({
      targetType: 'category', targetSlug: 'futon-frames',
      question: 'Q?', answer: 'A', sortOrder: 5,
    });
    expect(result.data.sortOrder).toBe(5);
  });

  it('cleans targetSlug via cleanSlug', async () => {
    const result = await saveFAQ({
      targetType: 'product', targetSlug: 'My-Product!!',
      question: 'Q?', answer: 'A',
    });
    expect(result.data.targetSlug).toBe('my-product');
  });
});

// ═════════════════════════════════════════════════════════════════════
// saveFAQ validation
// ═════════════════════════════════════════════════════════════════════
describe('saveFAQ validation', () => {
  it('rejects missing targetSlug (undefined)', async () => {
    const result = await saveFAQ({
      targetType: 'product', question: 'Q?', answer: 'A',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('slug');
  });

  it('rejects non-string targetSlug (number)', async () => {
    const result = await saveFAQ({
      targetType: 'product', targetSlug: 123,
      question: 'Q?', answer: 'A',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('slug');
  });

  it('rejects non-string question (number)', async () => {
    const result = await saveFAQ({
      targetType: 'product', targetSlug: 'test',
      question: 42, answer: 'A',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Question');
  });

  it('rejects non-string answer (array)', async () => {
    const result = await saveFAQ({
      targetType: 'product', targetSlug: 'test',
      question: 'Q?', answer: ['not', 'a', 'string'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Answer');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getCategoryContent edge cases
// ═════════════════════════════════════════════════════════════════════
describe('getCategoryContent edge cases', () => {
  it('rejects non-string category (number)', async () => {
    const result = await getCategoryContent(999);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid category');
  });

  it('rejects non-string category (boolean)', async () => {
    const result = await getCategoryContent(true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid category');
  });

  it('falls back to title-cased slug when content not found', async () => {
    __seed('CategoryContent', []);
    __seed('ProductFAQs', []);
    const result = await getCategoryContent('murphy-cabinet-beds');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Murphy Cabinet Beds');
    expect(result.data.description).toBe('');
    expect(result.data.buyingGuide).toBeNull();
    expect(result.data.seoTitle).toBeNull();
    expect(result.data.seoDescription).toBeNull();
  });

  it('includes FAQs even when no content record exists', async () => {
    __seed('CategoryContent', []);
    __seed('ProductFAQs', [
      { targetType: 'category', targetSlug: 'covers', question: 'Washable?', answer: 'Yes', sortOrder: 0 },
    ]);
    const result = await getCategoryContent('covers');
    expect(result.success).toBe(true);
    expect(result.data.faqs).toHaveLength(1);
    expect(result.data.faqs[0].question).toBe('Washable?');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAllCategories edge cases
// ═════════════════════════════════════════════════════════════════════
describe('getAllCategories edge cases', () => {
  it('returns all 12 default categories when DB is empty', async () => {
    __seed('CategoryContent', []);
    const result = await getAllCategories();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(12);
    // Spot-check a few
    expect(result.data[0].category).toBe('futon-frames');
    expect(result.data[0].title).toBe('Futon Frames');
    expect(result.data[1].category).toBe('mattresses');
    expect(result.data[1].title).toBe('Mattresses');
    expect(result.data[11].category).toBe('pillows-702');
  });

  it('assigns sequential sortOrder to default categories', async () => {
    __seed('CategoryContent', []);
    const result = await getAllCategories();
    result.data.forEach((cat, i) => {
      expect(cat.sortOrder).toBe(i);
    });
  });

  it('defaults description to empty string for CMS categories missing it', async () => {
    __seed('CategoryContent', [{ category: 'covers', title: 'Covers', sortOrder: 0 }]);
    const result = await getAllCategories();
    expect(result.data[0].description).toBe('');
  });

  it('falls back category as title when title is missing', async () => {
    __seed('CategoryContent', [{ category: 'log-frames', sortOrder: 0 }]);
    const result = await getAllCategories();
    expect(result.data[0].title).toBe('log-frames');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getProductContent — product with no specs / empty FAQs
// ═════════════════════════════════════════════════════════════════════
describe('getProductContent — sparse data', () => {
  it('returns null specs and empty FAQs for bare product', async () => {
    __seed('Stores/Products', [{ slug: 'bare-product', name: 'Bare' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);

    const result = await getProductContent('bare-product');
    expect(result.success).toBe(true);
    expect(result.data.specs).toBeNull();
    expect(result.data.faqs).toEqual([]);
    expect(result.data.description).toBe('');
    expect(result.data.price).toBeNull();
    expect(result.data.formattedPrice).toBeNull();
    expect(result.data.sku).toBeNull();
    expect(result.data.category).toBeNull();
    expect(result.data.manufacturer).toBeNull();
    expect(result.data.images).toEqual([]);
    expect(result.data.variants).toEqual([]);
  });

  it('returns inStock false when explicitly set', async () => {
    __seed('Stores/Products', [{ slug: 'oos', name: 'Out of Stock', inStock: false }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);

    const result = await getProductContent('oos');
    expect(result.data.inStock).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getProductSpecs — no specs found
// ═════════════════════════════════════════════════════════════════════
describe('getProductSpecs — no specs', () => {
  it('returns { success: true, data: null } when no specs exist', async () => {
    __seed('ProductSpecs', []);
    const result = await getProductSpecs('nonexistent-product');
    expect(result).toEqual({ success: true, data: null });
  });
});
