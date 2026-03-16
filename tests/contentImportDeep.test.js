/**
 * Deep edge-case tests for contentImport.web.js
 *
 * Covers: validation boundaries, type coercion quirks, upsert logic,
 * dry-run vs actual mode, import history pagination, partial failures,
 * and subtle JS gotchas (NaN, Infinity, falsy values, prototype pollution).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  importFAQ,
  importShippingInfo,
  importAboutContent,
  importCategoryDescriptions,
  importAllContent,
  getContentImportHistory,
} from '../src/backend/contentImport.web.js';

beforeEach(() => {
  resetData();
});

// ── Helpers ──────────────────────────────────────────────────────────

function minimalFaq(overrides = {}) {
  return {
    categories: [{
      title: 'Ordering & Shipping',
      faqs: [{ question: 'Q?', answer: 'A.' }],
    }],
    ...overrides,
  };
}

function minimalShipping(methodOverrides = {}) {
  return {
    shippingPolicy: {
      methods: [{ name: 'Ground', price: 0, ...methodOverrides }],
    },
  };
}

function minimalAbout(overrides = {}) {
  return { about: { companyName: 'Test Co', ...overrides } };
}

function minimalCategory(catOverrides = {}) {
  return { categories: [{ slug: 'test', title: 'Test', ...catOverrides }] };
}

// ── importFAQ — edge cases ──────────────────────────────────────────

describe('importFAQ — deep edge cases', () => {
  it('rejects undefined input', async () => {
    const result = await importFAQ(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('categories');
  });

  it('rejects data.categories = null', async () => {
    const result = await importFAQ({ categories: null });
    expect(result.success).toBe(false);
  });

  it('rejects data.categories = "string"', async () => {
    const result = await importFAQ({ categories: 'not-an-array' });
    expect(result.success).toBe(false);
  });

  it('rejects data.categories = {} (object, not array)', async () => {
    const result = await importFAQ({ categories: {} });
    expect(result.success).toBe(false);
  });

  it('succeeds with empty categories array (zero items)', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const result = await importFAQ({ categories: [] });
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(0);
  });

  it('skips category entries with falsy title', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const data = {
      categories: [
        { title: '', faqs: [{ question: 'Q?', answer: 'A' }] },
        { title: null, faqs: [{ question: 'Q2?', answer: 'A2' }] },
        { title: 'Ordering & Shipping', faqs: [{ question: 'Q3?', answer: 'A3' }] },
      ],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(1);
  });

  it('rejects whitespace-only question', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: '   ', answer: 'Valid' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('question');
  });

  it('rejects whitespace-only answer', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Valid?', answer: '\t\n  ' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('answer');
  });

  it('accepts question/answer with exactly 1 non-whitespace char', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'X', answer: 'Y' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(1);
  });

  it('dry run with zero items returns totalItems 0', async () => {
    const result = await importFAQ({ categories: [] }, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.totalItems).toBe(0);
    expect(result.data.validItems).toBe(0);
    expect(result.data.errors).toHaveLength(0);
  });

  it('dry run with exactly MAX_ITEMS (500) succeeds', async () => {
    const faqs = Array.from({ length: 500 }, (_, i) => ({
      question: `Q${i}?`, answer: `A${i}`,
    }));
    const data = { categories: [{ title: 'Ordering & Shipping', faqs }] };
    const result = await importFAQ(data, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.totalItems).toBe(500);
  });

  // NaN passes `typeof x === 'number'` — but isn't a valid FAQ category concern here.
  // The key edge: question = NaN is not a string, so validation catches it.
  it('rejects NaN as question (typeof NaN === "number", not string)', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: NaN, answer: 'Valid' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('validates every VALID_FAQ_CATEGORY is accepted', async () => {
    const validCats = [
      'Ordering & Shipping', 'Futon Frames', 'Mattresses', 'Platform Beds',
      'Murphy Cabinet Beds', 'Care & Maintenance', 'Returns & Warranty',
    ];
    for (const cat of validCats) {
      const data = {
        categories: [{ title: cat, faqs: [{ question: 'Q?', answer: 'A' }] }],
      };
      const result = await importFAQ(data, { dryRun: true });
      const catErrors = result.data.errors.filter(e => e.field === 'category');
      expect(catErrors).toHaveLength(0);
    }
  });

  it('dry run categoryBreakdown counts faqs per category', async () => {
    const data = {
      categories: [
        { title: 'Ordering & Shipping', faqs: [{ question: 'Q1?', answer: 'A1' }] },
        { title: 'Mattresses', faqs: [{ question: 'Q2?', answer: 'A2' }, { question: 'Q3?', answer: 'A3' }] },
      ],
    };
    const result = await importFAQ(data, { dryRun: true });
    expect(result.data.categoryBreakdown).toEqual([
      { title: 'Ordering & Shipping', count: 1 },
      { title: 'Mattresses', count: 2 },
    ]);
  });

  it('dryRun option as truthy non-boolean is treated as false', async () => {
    // opts.dryRun === true is strict — "true" (string) is not === true
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const result = await importFAQ(minimalFaq(), { dryRun: 'yes' });
    // Not a dry run — actual import happens
    expect(result.success).toBe(true);
    expect(result.data.importId).toBeDefined();
    expect(result.data.itemCount).toBe(1);
  });

  it('upsert preserves existing _id on update', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('FAQ', [{ _id: 'keep-this-id', question: 'Q?', answer: 'Old', category: 'Ordering & Shipping' }]);
    __seed('ContentImports', []);

    await importFAQ(minimalFaq());
    const faqUpdate = updates.find(u => u.col === 'FAQ');
    expect(faqUpdate.item._id).toBe('keep-this-id');
  });

  it('multiple categories with same title are independently imported', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const data = {
      categories: [
        { title: 'Ordering & Shipping', faqs: [{ question: 'Q1?', answer: 'A1' }] },
        { title: 'Ordering & Shipping', faqs: [{ question: 'Q2?', answer: 'A2' }] },
      ],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(2);
  });

  it('import history record has correct fields', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);

    await importFAQ(minimalFaq());
    const historyRecord = inserts.find(i => i.col === 'ContentImports');
    expect(historyRecord.item.contentType).toBe('faq');
    expect(historyRecord.item.status).toBe('completed');
    expect(historyRecord.item.dryRun).toBe(false);
    expect(historyRecord.item.completedAt).toBeInstanceOf(Date);
    expect(historyRecord.item.importId).toMatch(/^cimp-/);
  });
});

// ── importShippingInfo — deep edge cases ────────────────────────────

describe('importShippingInfo — deep edge cases', () => {
  it('rejects undefined input', async () => {
    const result = await importShippingInfo(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects data with shippingPolicy but no methods', async () => {
    const result = await importShippingInfo({ shippingPolicy: { overview: 'Hi' } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('methods');
  });

  it('rejects data.shippingPolicy.methods = null', async () => {
    const result = await importShippingInfo({ shippingPolicy: { methods: null } });
    expect(result.success).toBe(false);
  });

  it('succeeds with empty methods array', async () => {
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);
    const result = await importShippingInfo({ shippingPolicy: { methods: [] } });
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(0);
  });

  // NaN passes typeof === 'number' but fails price < 0 (NaN < 0 is false)
  // So NaN price passes validation — known gap
  it('NaN price passes validation (typeof NaN === "number" and !(NaN < 0))', async () => {
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);
    const data = { shippingPolicy: { methods: [{ name: 'Test', price: NaN }] } };
    const result = await importShippingInfo(data);
    // NaN is typeof 'number' and NaN < 0 is false, so no validation error
    expect(result.success).toBe(true);
  });

  // Infinity is typeof 'number' and Infinity >= 0, so it passes
  it('Infinity price passes validation (typeof Infinity === "number")', async () => {
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);
    const data = { shippingPolicy: { methods: [{ name: 'Test', price: Infinity }] } };
    const result = await importShippingInfo(data);
    expect(result.success).toBe(true);
  });

  it('price = null passes validation (price != null is false)', async () => {
    const result = await importShippingInfo(
      { shippingPolicy: { methods: [{ name: 'Test', price: null }] } },
      { dryRun: true },
    );
    expect(result.data.errors.filter(e => e.field === 'price')).toHaveLength(0);
  });

  it('price = undefined passes validation (undefined != null is false)', async () => {
    const result = await importShippingInfo(
      { shippingPolicy: { methods: [{ name: 'Test' }] } },
      { dryRun: true },
    );
    expect(result.data.errors.filter(e => e.field === 'price')).toHaveLength(0);
  });

  it('defaults price to 0 via falsy fallback (method.price || 0)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    await importShippingInfo({ shippingPolicy: { methods: [{ name: 'Free', price: null }] } });
    const shipInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === 'Free');
    // null || 0 → 0
    expect(shipInsert.item.price).toBe(0);
  });

  it('freeThreshold = 0 becomes null via falsy fallback (0 || null)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    await importShippingInfo({ shippingPolicy: { methods: [{ name: 'Test', price: 0, freeThreshold: 0 }] } });
    const shipInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === 'Test');
    // 0 || null → null — known quirk, 0 is falsy
    expect(shipInsert.item.freeThreshold).toBeNull();
  });

  it('defaults missing optional fields to empty strings', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    await importShippingInfo({ shippingPolicy: { methods: [{ name: 'Bare' }] } });
    const shipInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === 'Bare');
    expect(shipInsert.item.description).toBe('');
    expect(shipInsert.item.timeline).toBe('');
    expect(shipInsert.item.area).toBe('');
    expect(shipInsert.item.note).toBe('');
  });

  it('upserts existing overview entry', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('ShippingInfo', [
      { _id: 'ov-1', name: '__policy_overview', description: 'Old overview', price: 0 },
      { _id: 'ship-1', name: 'Ground', price: 50 },
    ]);
    __seed('ContentImports', []);

    const data = {
      shippingPolicy: {
        overview: 'New overview text',
        methods: [{ name: 'Ground', price: 0 }],
      },
    };
    await importShippingInfo(data);
    const overviewUpdate = updates.find(u => u.col === 'ShippingInfo' && u.item.name === '__policy_overview');
    expect(overviewUpdate).toBeDefined();
    expect(overviewUpdate.item.description).toContain('New overview text');
  });

  it('dry run with validation errors still returns success: true', async () => {
    const data = {
      shippingPolicy: {
        methods: [
          { name: 'Valid', price: 0 },
          { description: 'missing name', price: -1 },
        ],
      },
    };
    const result = await importShippingInfo(data, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.errors.length).toBeGreaterThan(0);
    // 2 items, 1 invalid → 1 valid
    expect(result.data.validItems).toBe(1);
  });

  it('method name as number fails validation (not string)', async () => {
    const data = { shippingPolicy: { methods: [{ name: 42 }] } };
    const result = await importShippingInfo(data, { dryRun: true });
    expect(result.data.errors.some(e => e.field === 'name')).toBe(true);
  });
});

// ── importAboutContent — deep edge cases ────────────────────────────

describe('importAboutContent — deep edge cases', () => {
  it('rejects undefined input', async () => {
    const result = await importAboutContent(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects data = {} (no about key)', async () => {
    const result = await importAboutContent({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('about');
  });

  it('accepts data.about = {} (empty about, defaults companyName)', async () => {
    __seed('AboutContent', []);
    __seed('ContentImports', []);
    const result = await importAboutContent({ about: {} });
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(1); // company-info only
  });

  it('defaults tagline, description, location to empty when missing', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    await importAboutContent({ about: {} });
    const companyInfo = inserts.find(i => i.col === 'AboutContent' && i.item.sectionKey === 'company-info');
    const content = JSON.parse(companyInfo.item.content);
    expect(content.tagline).toBe('');
    expect(content.description).toBe('');
    expect(content.location).toEqual({});
  });

  it('values array with empty object crashes on val.title.toLowerCase()', async () => {
    // val.title is undefined → .toLowerCase() throws → caught by try/catch
    const data = { about: { values: [{}] } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(false);
    expect(result.error).toBe('About content import failed');
  });

  it('values with title containing special chars generates valid sectionKey', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const data = { about: { values: [{ title: 'Eco  Friendly!!!', description: 'Green' }] } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(true);
    const valueInsert = inserts.find(i => i.col === 'AboutContent' && i.item.sectionKey.startsWith('value-'));
    // \s+ replaces one-or-more spaces with single hyphen, special chars preserved
    expect(valueInsert.item.sectionKey).toBe('value-eco-friendly!!!');
  });

  it('manufacturers with empty object crashes on mfr.name.toLowerCase()', async () => {
    const data = { about: { manufacturers: [{}] } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(false);
    expect(result.error).toBe('About content import failed');
  });

  it('manufacturer content is JSON-stringified', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const mfr = { name: 'Acme', location: 'NC', specialty: 'Frames' };
    const data = { about: { manufacturers: [mfr] } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(true);
    const mfrInsert = inserts.find(i => i.col === 'AboutContent' && i.item.sectionKey === 'manufacturer-acme');
    const parsed = JSON.parse(mfrInsert.item.content);
    expect(parsed.specialty).toBe('Frames');
  });

  it('dry run with manufacturers lists all section keys', async () => {
    const data = {
      about: {
        companyName: 'Test',
        values: [{ title: 'Quality', description: 'Good' }],
        manufacturers: [{ name: 'Acme', description: 'Maker' }],
      },
    };
    const result = await importAboutContent(data, { dryRun: true });
    expect(result.data.sections).toContain('company-info');
    expect(result.data.sections).toContain('value-quality');
    expect(result.data.sections).toContain('manufacturer-acme');
  });

  it('sort order spans across values and manufacturers', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const data = {
      about: {
        values: [{ title: 'V1', description: 'D1' }],
        manufacturers: [{ name: 'M1', description: 'D2' }],
      },
    };
    await importAboutContent(data);
    const aboutInserts = inserts.filter(i => i.col === 'AboutContent');
    const orders = aboutInserts.map(i => i.item.sortOrder).sort((a, b) => a - b);
    // company-info=0, value-v1=1, manufacturer-m1=2
    expect(orders).toEqual([0, 1, 2]);
  });

  it('upserts multiple existing sections in one import', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('AboutContent', [
      { _id: 'a1', sectionKey: 'company-info', title: 'Old', content: '{}', sortOrder: 0 },
      { _id: 'a2', sectionKey: 'value-quality', title: 'Old', content: 'old', sortOrder: 1 },
    ]);
    __seed('ContentImports', []);

    const data = {
      about: {
        companyName: 'New Co',
        values: [{ title: 'Quality', description: 'New' }],
      },
    };
    await importAboutContent(data);
    const aboutUpdates = updates.filter(u => u.col === 'AboutContent');
    expect(aboutUpdates).toHaveLength(2);
  });

  it('dryRun: "true" (string) is not strictly true — triggers real import', async () => {
    __seed('AboutContent', []);
    __seed('ContentImports', []);
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });

    const result = await importAboutContent(minimalAbout(), { dryRun: 'true' });
    expect(result.success).toBe(true);
    // Real import happened (not dry run)
    expect(inserts.filter(i => i.col === 'AboutContent').length).toBeGreaterThan(0);
  });
});

// ── importCategoryDescriptions — deep edge cases ────────────────────

describe('importCategoryDescriptions — deep edge cases', () => {
  it('rejects undefined input', async () => {
    const result = await importCategoryDescriptions(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects data.categories = "string"', async () => {
    const result = await importCategoryDescriptions({ categories: 'not-array' });
    expect(result.success).toBe(false);
  });

  it('succeeds with empty categories array', async () => {
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);
    const result = await importCategoryDescriptions({ categories: [] });
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(0);
  });

  it('rejects slug = "" (falsy)', async () => {
    const data = { categories: [{ slug: '', title: 'Test' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
  });

  it('rejects title = "" (falsy)', async () => {
    const data = { categories: [{ slug: 'test', title: '' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
  });

  it('rejects slug = 0 (falsy number)', async () => {
    const data = { categories: [{ slug: 0, title: 'Test' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
  });

  it('productCount = 0 stays 0 via (0 || 0)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    await importCategoryDescriptions({ categories: [{ slug: 'x', title: 'X', productCount: 0 }] });
    const ins = inserts.find(i => i.col === 'CategoryDescriptions');
    expect(ins.item.productCount).toBe(0);
  });

  // productCount = false → false || 0 → 0
  it('productCount = false defaults to 0 (falsy fallback)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    await importCategoryDescriptions({ categories: [{ slug: 'x', title: 'X', productCount: false }] });
    const ins = inserts.find(i => i.col === 'CategoryDescriptions');
    expect(ins.item.productCount).toBe(0);
  });

  it('priceRange with min=0 stores 0 (not falsy-defaulted)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = { categories: [{ slug: 'x', title: 'X', priceRange: { min: 0, max: 100 } }] };
    await importCategoryDescriptions(data);
    const ins = inserts.find(i => i.col === 'CategoryDescriptions');
    // priceRange exists → cat.priceRange.min = 0 (truthy check passes, value is 0)
    expect(ins.item.priceRangeMin).toBe(0);
    expect(ins.item.priceRangeMax).toBe(100);
  });

  it('priceRange = {} gives min/max as undefined (not 0)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = { categories: [{ slug: 'x', title: 'X', priceRange: {} }] };
    await importCategoryDescriptions(data);
    const ins = inserts.find(i => i.col === 'CategoryDescriptions');
    // priceRange is truthy → cat.priceRange.min = undefined
    expect(ins.item.priceRangeMin).toBeUndefined();
    expect(ins.item.priceRangeMax).toBeUndefined();
  });

  it('dry run with validation errors reports correct validItems count', async () => {
    const data = {
      categories: [
        { slug: 'ok', title: 'OK' },
        { slug: null, title: 'No slug' },
        { slug: 'also-ok', title: 'Also OK' },
        { title: 'Missing slug too' },
      ],
    };
    const result = await importCategoryDescriptions(data, { dryRun: true });
    expect(result.data.totalItems).toBe(4);
    expect(result.data.validItems).toBe(2);
  });

  it('dry run slugs array includes all categories even invalid ones', async () => {
    const data = {
      categories: [
        { slug: 'good', title: 'Good' },
        { slug: null, title: 'Bad' },
      ],
    };
    const result = await importCategoryDescriptions(data, { dryRun: true });
    expect(result.data.slugs).toEqual(['good', null]);
  });

  it('multiple categories with same slug — second upserts the first', async () => {
    const inserts = [];
    const updates = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = {
      categories: [
        { slug: 'duped', title: 'First' },
        { slug: 'duped', title: 'Second' },
      ],
    };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(2);
    // First inserts, second finds it and updates
    const catUpdates = updates.filter(u => u.col === 'CategoryDescriptions');
    expect(catUpdates).toHaveLength(1);
    expect(catUpdates[0].item.title).toBe('Second');
  });

  it('import records contentType as "categories"', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    await importCategoryDescriptions(minimalCategory());
    const history = inserts.find(i => i.col === 'ContentImports');
    expect(history.item.contentType).toBe('categories');
  });
});

// ── importAllContent — deep edge cases ──────────────────────────────

describe('importAllContent — deep edge cases', () => {
  it('only runs importers for keys present in data object', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const data = { faq: minimalFaq() };
    const result = await importAllContent(data);
    expect(result.data.contentTypes).toEqual(['faq']);
    expect(result.data.results.shipping).toBeUndefined();
    expect(result.data.results.about).toBeUndefined();
    expect(result.data.results.categories).toBeUndefined();
  });

  it('reports allSuccess=false when any sub-importer fails', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const data = {
      faq: minimalFaq(),
      categories: { categories: [{ slug: null, title: null }] }, // will fail validation
    };
    const result = await importAllContent(data);
    expect(result.success).toBe(false);
    expect(result.data.results.faq.success).toBe(true);
    expect(result.data.results.categories.success).toBe(false);
  });

  it('empty object returns success with empty contentTypes', async () => {
    const result = await importAllContent({});
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toEqual([]);
    expect(result.data.dryRun).toBe(false);
  });

  it('dry run propagates to all sub-importers', async () => {
    const data = {
      faq: minimalFaq(),
      categories: minimalCategory(),
    };
    const result = await importAllContent(data, { dryRun: true });
    expect(result.data.dryRun).toBe(true);
    expect(result.data.results.faq.data.dryRun).toBe(true);
    expect(result.data.results.categories.data.dryRun).toBe(true);
  });

  it('unrecognized keys in data are silently ignored', async () => {
    const data = { unknownType: { foo: 'bar' } };
    const result = await importAllContent(data);
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toEqual([]);
  });

  it('data with "faq" key set to invalid value propagates failure', async () => {
    const data = { faq: 'not-an-object' };
    const result = await importAllContent(data);
    expect(result.success).toBe(false);
    expect(result.data.results.faq.success).toBe(false);
  });

  it('handles all four content types simultaneously', async () => {
    __seed('FAQ', []);
    __seed('ShippingInfo', []);
    __seed('AboutContent', []);
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = {
      faq: minimalFaq(),
      shipping: minimalShipping(),
      about: minimalAbout(),
      categories: minimalCategory(),
    };
    const result = await importAllContent(data);
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toHaveLength(4);
  });
});

// ── getContentImportHistory — deep edge cases ───────────────────────

describe('getContentImportHistory — deep edge cases', () => {
  it('page = 0 clamps to 1', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: 0 });
    expect(result.data.page).toBe(1);
  });

  it('page = NaN defaults to 1 (NaN || 1)', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: NaN });
    expect(result.data.page).toBe(1);
  });

  it('page = Infinity clamps via Math.max(1, Infinity) = Infinity', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: Infinity });
    expect(result.data.page).toBe(Infinity);
  });

  it('pageSize = -10 clamps to 1', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: -10 });
    expect(result.data.pageSize).toBe(1);
  });

  it('pageSize = NaN defaults to 10', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: NaN });
    expect(result.data.pageSize).toBe(10);
  });

  it('pageSize = 1 is valid minimum', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 1 });
    expect(result.data.pageSize).toBe(1);
  });

  it('pageSize = 50 is valid maximum', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 50 });
    expect(result.data.pageSize).toBe(50);
  });

  it('pageSize = 51 clamps to 50', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 51 });
    expect(result.data.pageSize).toBe(50);
  });

  it('page = 1.7 rounds to 2 via Math.round', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: 1.7 });
    expect(result.data.page).toBe(2);
  });

  it('pageSize = 10.4 rounds to 10 via Math.round', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 10.4 });
    expect(result.data.pageSize).toBe(10);
  });

  it('filters by each valid contentType', async () => {
    __seed('ContentImports', [
      { importId: 'a', contentType: 'faq', status: 'completed', itemCount: 1, completedAt: new Date() },
      { importId: 'b', contentType: 'shipping', status: 'completed', itemCount: 1, completedAt: new Date() },
      { importId: 'c', contentType: 'about', status: 'completed', itemCount: 1, completedAt: new Date() },
      { importId: 'd', contentType: 'categories', status: 'completed', itemCount: 1, completedAt: new Date() },
    ]);

    for (const ct of ['faq', 'shipping', 'about', 'categories']) {
      const result = await getContentImportHistory({ contentType: ct });
      expect(result.data.imports.every(i => i.contentType === ct)).toBe(true);
    }
  });

  it('dryRun field defaults to false when missing from import record', async () => {
    __seed('ContentImports', [
      { importId: 'x', contentType: 'faq', status: 'completed', itemCount: 5, completedAt: new Date() },
    ]);
    const result = await getContentImportHistory();
    expect(result.data.imports[0].dryRun).toBe(false);
  });

  it('returns totalCount from query result', async () => {
    __seed('ContentImports', Array.from({ length: 15 }, (_, i) => ({
      importId: `cimp-${i}`, contentType: 'faq', status: 'completed', itemCount: 1, completedAt: new Date(),
    })));
    const result = await getContentImportHistory({ pageSize: 5 });
    expect(result.data.imports).toHaveLength(5);
    expect(result.data.totalCount).toBe(15);
  });

  it('page 2 skips first page of results', async () => {
    __seed('ContentImports', Array.from({ length: 5 }, (_, i) => ({
      importId: `cimp-${i}`, contentType: 'faq', status: 'completed', itemCount: i, completedAt: new Date(2026, 0, i + 1),
    })));
    const result = await getContentImportHistory({ page: 2, pageSize: 2 });
    expect(result.data.page).toBe(2);
    expect(result.data.imports).toHaveLength(2);
  });

  it('called with no arguments uses all defaults', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory();
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(10);
  });

  it('contentType = "" is ignored (not in VALID_CONTENT_TYPES)', async () => {
    __seed('ContentImports', [
      { importId: 'x', contentType: 'faq', status: 'completed', itemCount: 1, completedAt: new Date() },
    ]);
    const result = await getContentImportHistory({ contentType: '' });
    // Empty string is not in VALID_CONTENT_TYPES, so filter is not applied
    expect(result.data.imports).toHaveLength(1);
  });
});

// ── Cross-cutting edge cases ────────────────────────────────────────

describe('cross-cutting edge cases', () => {
  it('importFAQ: boolean answer (true) is rejected as non-string', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Valid?', answer: true }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('importFAQ: array answer is rejected as non-string', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Valid?', answer: ['not', 'a', 'string'] }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('importShippingInfo: price = -0 passes (Object.is(-0, 0) is false but -0 < 0 is false)', async () => {
    const result = await importShippingInfo(
      { shippingPolicy: { methods: [{ name: 'Test', price: -0 }] } },
      { dryRun: true },
    );
    expect(result.data.errors.filter(e => e.field === 'price')).toHaveLength(0);
  });

  it('import IDs are unique across multiple calls', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const r1 = await importFAQ(minimalFaq());
    resetData();
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const r2 = await importFAQ(minimalFaq());
    expect(r1.data.importId).not.toBe(r2.data.importId);
  });

  it('concurrent imports to different collections do not interfere', async () => {
    __seed('FAQ', []);
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    const [faqResult, shippingResult] = await Promise.all([
      importFAQ(minimalFaq()),
      importShippingInfo(minimalShipping()),
    ]);
    expect(faqResult.success).toBe(true);
    expect(shippingResult.success).toBe(true);
  });

  it('sanitize truncates long text to MAX_TEXT_LENGTH (5000)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const longAnswer = 'A'.repeat(6000);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Q?', answer: longAnswer }],
      }],
    };
    await importFAQ(data);
    const faqInsert = inserts.find(i => i.col === 'FAQ');
    expect(faqInsert.item.answer.length).toBeLessThanOrEqual(5000);
  });

  it('sanitize truncates long title to MAX_TITLE_LENGTH (200)', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const longTitle = 'T'.repeat(300);
    const data = { categories: [{ slug: 'test', title: longTitle }] };
    await importCategoryDescriptions(data);
    const catInsert = inserts.find(i => i.col === 'CategoryDescriptions');
    expect(catInsert.item.title.length).toBeLessThanOrEqual(200);
  });
});
