import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
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

function makeFaqData(overrides = {}) {
  return {
    categories: [
      {
        title: 'Ordering & Shipping',
        faqs: [
          { question: 'How long does shipping take?', answer: 'Most items ship in 3-5 business days.' },
          { question: 'Do you offer free shipping?', answer: 'Free shipping on orders over $1,999.' },
        ],
      },
      {
        title: 'Futon Frames',
        faqs: [
          { question: 'What sizes are available?', answer: 'Full and Queen sizes for most frames.' },
        ],
      },
    ],
    ...overrides,
  };
}

function makeShippingData(overrides = {}) {
  return {
    shippingPolicy: {
      overview: 'We offer multiple shipping options.',
      methods: [
        { name: 'Standard Shipping', description: 'Curbside delivery', price: 0, timeline: '5-10 days', freeThreshold: 1999 },
        { name: 'Local White-Glove', description: 'In-home delivery', price: 149, timeline: 'Wed-Sat', area: 'Within 50 miles' },
      ],
      ...overrides,
    },
  };
}

function makeAboutData(overrides = {}) {
  return {
    about: {
      companyName: 'Carolina Futons',
      tagline: 'Quality Futons in the Blue Ridge Mountains',
      description: 'Carolina Futons has been a specialty store since 1991.',
      location: { city: 'Hendersonville', state: 'NC' },
      values: [
        { title: 'Quality Craftsmanship', description: 'Every piece built to last.' },
        { title: 'Sustainability', description: 'Environmentally responsible furniture.' },
      ],
      ...overrides,
    },
  };
}

function makeCategoryData(overrides = {}) {
  return {
    categories: [
      {
        slug: 'futon-frames',
        title: 'Futon Frames',
        heroText: 'Solid Hardwood Futon Frames',
        description: 'Premium futon frames crafted from solid hardwood.',
        seoTitle: 'Futon Frames | Carolina Futons',
        seoDescription: 'Shop solid hardwood futon frames.',
        productCount: 19,
        priceRange: { min: 199, max: 903 },
      },
      {
        slug: 'platform-beds',
        title: 'Platform Beds',
        heroText: 'Modern Platform Beds',
        description: 'Platform beds from Night & Day and KD Frames.',
        seoTitle: 'Platform Beds | Carolina Futons',
        seoDescription: 'Shop platform beds.',
        productCount: 10,
        priceRange: { min: 229, max: 486 },
      },
    ],
    ...overrides,
  };
}

// ── importFAQ ────────────────────────────────────────────────────────

describe('importFAQ', () => {
  it('imports valid FAQ entries', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const result = await importFAQ(makeFaqData());
    expect(result.success).toBe(true);
    expect(result.data.contentType).toBe('faq');
    expect(result.data.itemCount).toBe(3);
    expect(inserts.filter(i => i.col === 'FAQ')).toHaveLength(3);
    expect(inserts.filter(i => i.col === 'ContentImports')).toHaveLength(1);
  });

  it('assigns sequential sort orders', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);

    await importFAQ(makeFaqData());
    const faqInserts = inserts.filter(i => i.col === 'FAQ');
    expect(faqInserts[0].item.sortOrder).toBe(0);
    expect(faqInserts[1].item.sortOrder).toBe(1);
    expect(faqInserts[2].item.sortOrder).toBe(2);
  });

  it('preserves FAQ category from parent', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('FAQ', []);
    __seed('ContentImports', []);

    await importFAQ(makeFaqData());
    const faqInserts = inserts.filter(i => i.col === 'FAQ');
    expect(faqInserts[0].item.category).toBe('Ordering & Shipping');
    expect(faqInserts[2].item.category).toBe('Futon Frames');
  });

  it('rejects null input', async () => {
    const result = await importFAQ(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing categories array', async () => {
    const result = await importFAQ({ notCategories: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('categories');
  });

  it('skips categories with no faqs array', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const data = { categories: [{ title: 'Empty', faqs: [] }, { title: 'No array' }] };
    const result = await importFAQ(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(0);
  });

  it('dry run returns preview without inserting', async () => {
    const inserts = [];
    __onInsert((col) => { inserts.push(col); });

    const result = await importFAQ(makeFaqData(), { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.totalItems).toBe(3);
    expect(result.data.validItems).toBe(3);
    expect(result.data.categoryBreakdown).toHaveLength(2);
    expect(inserts.filter(c => c === 'FAQ')).toHaveLength(0);
  });

  it('dry run reports validation errors', async () => {
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [
          { question: '', answer: 'Valid answer' },
          { question: 'Valid question', answer: '' },
        ],
      }],
    };
    const result = await importFAQ(data, { dryRun: true });
    expect(result.data.errors.length).toBeGreaterThan(0);
    expect(result.data.validItems).toBeLessThan(result.data.totalItems);
  });

  it('validates missing question', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: '', answer: 'Valid answer' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('question');
  });

  it('validates missing answer', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Valid question?', answer: '' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid FAQ category', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Not A Valid Category',
        faqs: [{ question: 'Q?', answer: 'A' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('category');
  });

  it('rejects exceeding MAX_ITEMS (500)', async () => {
    const faqs = Array.from({ length: 501 }, (_, i) => ({
      question: `Question ${i}?`,
      answer: `Answer ${i}`,
    }));
    const data = { categories: [{ title: 'Ordering & Shipping', faqs }] };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('rejects non-string question (number)', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 12345, answer: 'Valid answer' }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('rejects non-string answer (object)', async () => {
    __seed('FAQ', []);
    const data = {
      categories: [{
        title: 'Ordering & Shipping',
        faqs: [{ question: 'Valid?', answer: { text: 'not a string' } }],
      }],
    };
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
  });

  it('handles wixData query failure gracefully', async () => {
    // Don't seed FAQ — the mock store will be undefined, causing the query to work on empty
    // Instead we test the outer catch by not seeding ContentImports so insert fails
    // The try/catch in importFAQ should catch and return error
    const data = makeFaqData();
    // Simulate: seed FAQ so queries work, but make insert throw
    __seed('FAQ', []);
    __onInsert(() => { throw new Error('DB write failed'); });
    const result = await importFAQ(data);
    expect(result.success).toBe(false);
    expect(result.error).toBe('FAQ import failed');
  });

  it('upserts existing FAQ by question text', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('FAQ', [{ _id: 'existing-1', question: 'How long does shipping take?', answer: 'Old answer', category: 'Old' }]);
    __seed('ContentImports', []);

    const result = await importFAQ(makeFaqData());
    expect(result.success).toBe(true);
    expect(updates.filter(u => u.col === 'FAQ')).toHaveLength(1);
    expect(updates[0].item.answer).toContain('3-5 business days');
  });

  it('import ID starts with cimp-', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);
    const result = await importFAQ(makeFaqData());
    expect(result.data.importId).toMatch(/^cimp-/);
  });
});

// ── importShippingInfo ───────────────────────────────────────────────

describe('importShippingInfo', () => {
  it('imports valid shipping methods', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    const result = await importShippingInfo(makeShippingData());
    expect(result.success).toBe(true);
    expect(result.data.contentType).toBe('shipping');
    expect(result.data.itemCount).toBe(2);
    // 2 methods + 1 overview + 1 import record
    expect(inserts.filter(i => i.col === 'ShippingInfo')).toHaveLength(3);
  });

  it('stores policy overview as special entry', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    await importShippingInfo(makeShippingData());
    const overviewInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === '__policy_overview');
    expect(overviewInsert).toBeDefined();
    expect(overviewInsert.item.description).toContain('multiple shipping options');
  });

  it('rejects null input', async () => {
    const result = await importShippingInfo(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing methods array', async () => {
    const result = await importShippingInfo({ shippingPolicy: {} });
    expect(result.success).toBe(false);
  });

  it('validates negative price', async () => {
    __seed('ShippingInfo', []);
    const data = makeShippingData();
    data.shippingPolicy.methods[0].price = -10;
    const result = await importShippingInfo(data);
    expect(result.success).toBe(false);
  });

  it('validates missing method name', async () => {
    __seed('ShippingInfo', []);
    const data = { shippingPolicy: { methods: [{ description: 'No name', price: 0 }] } };
    const result = await importShippingInfo(data);
    expect(result.success).toBe(false);
  });

  it('dry run returns preview without inserting', async () => {
    const inserts = [];
    __onInsert((col) => { inserts.push(col); });

    const result = await importShippingInfo(makeShippingData(), { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.totalItems).toBe(2);
    expect(inserts.filter(c => c === 'ShippingInfo')).toHaveLength(0);
  });

  it('upserts existing shipping method', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('ShippingInfo', [{ _id: 'ship-1', name: 'Standard Shipping', price: 50 }]);
    __seed('ContentImports', []);

    const result = await importShippingInfo(makeShippingData());
    expect(result.success).toBe(true);
    const shippingUpdates = updates.filter(u => u.col === 'ShippingInfo');
    expect(shippingUpdates).toHaveLength(1);
    expect(shippingUpdates[0].item.price).toBe(0);
  });

  it('validates non-numeric price (string)', async () => {
    __seed('ShippingInfo', []);
    const data = { shippingPolicy: { methods: [{ name: 'Test', price: 'free' }] } };
    const result = await importShippingInfo(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('price');
  });

  it('dry run reports validation errors', async () => {
    const data = { shippingPolicy: { methods: [{ description: 'No name', price: -5 }] } };
    const result = await importShippingInfo(data, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.errors.length).toBeGreaterThan(0);
    expect(result.data.validItems).toBeLessThan(result.data.totalItems);
  });

  it('handles wixData failure gracefully', async () => {
    __seed('ShippingInfo', []);
    __onInsert(() => { throw new Error('DB write failed'); });
    const result = await importShippingInfo(makeShippingData());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Shipping info import failed');
  });

  it('skips overview when not provided', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    const data = { shippingPolicy: { methods: [{ name: 'Test', price: 0 }] } };
    const result = await importShippingInfo(data);
    expect(result.success).toBe(true);
    const overviewInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === '__policy_overview');
    expect(overviewInsert).toBeUndefined();
  });

  it('preserves free threshold', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('ShippingInfo', []);
    __seed('ContentImports', []);

    await importShippingInfo(makeShippingData());
    const standardInsert = inserts.find(i => i.col === 'ShippingInfo' && i.item.name === 'Standard Shipping');
    expect(standardInsert.item.freeThreshold).toBe(1999);
  });
});

// ── importAboutContent ───────────────────────────────────────────────

describe('importAboutContent', () => {
  it('imports about page content sections', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const result = await importAboutContent(makeAboutData());
    expect(result.success).toBe(true);
    expect(result.data.contentType).toBe('about');
    // 1 company-info + 2 values = 3 sections
    expect(result.data.itemCount).toBe(3);
  });

  it('creates company-info section with JSON content', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    await importAboutContent(makeAboutData());
    const companyInfo = inserts.find(i => i.col === 'AboutContent' && i.item.sectionKey === 'company-info');
    expect(companyInfo).toBeDefined();
    expect(companyInfo.item.title).toBe('Carolina Futons');
    const content = JSON.parse(companyInfo.item.content);
    expect(content.tagline).toContain('Blue Ridge');
  });

  it('creates value sections with correct keys', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    await importAboutContent(makeAboutData());
    const valueInserts = inserts.filter(i => i.col === 'AboutContent' && i.item.sectionKey.startsWith('value-'));
    expect(valueInserts).toHaveLength(2);
    expect(valueInserts[0].item.sectionKey).toBe('value-quality-craftsmanship');
    expect(valueInserts[1].item.sectionKey).toBe('value-sustainability');
  });

  it('imports manufacturer data when present', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const data = makeAboutData();
    data.about.manufacturers = [
      { name: 'Night & Day Furniture', description: 'Premium futon manufacturer' },
    ];
    const result = await importAboutContent(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(4); // 1 company + 2 values + 1 manufacturer
  });

  it('rejects null input', async () => {
    const result = await importAboutContent(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing about object', async () => {
    const result = await importAboutContent({ notAbout: {} });
    expect(result.success).toBe(false);
  });

  it('dry run returns section keys', async () => {
    const result = await importAboutContent(makeAboutData(), { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.sections).toContain('company-info');
    expect(result.data.sections).toContain('value-quality-craftsmanship');
  });

  it('upserts existing sections', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('AboutContent', [{ _id: 'ab-1', sectionKey: 'company-info', title: 'Old', content: 'Old' }]);
    __seed('ContentImports', []);

    const result = await importAboutContent(makeAboutData());
    expect(result.success).toBe(true);
    expect(updates.filter(u => u.col === 'AboutContent')).toHaveLength(1);
  });

  it('assigns sequential sort orders', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    await importAboutContent(makeAboutData());
    const aboutInserts = inserts.filter(i => i.col === 'AboutContent').sort((a, b) => a.item.sortOrder - b.item.sortOrder);
    expect(aboutInserts[0].item.sortOrder).toBe(0);
    expect(aboutInserts[1].item.sortOrder).toBe(1);
    expect(aboutInserts[2].item.sortOrder).toBe(2);
  });

  it('defaults companyName to Carolina Futons', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const data = { about: { tagline: 'Test' } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(true);
    const companyInfo = inserts.find(i => i.col === 'AboutContent' && i.item.sectionKey === 'company-info');
    expect(companyInfo.item.title).toBe('Carolina Futons');
  });

  it('handles wixData failure gracefully', async () => {
    __seed('AboutContent', []);
    __onInsert(() => { throw new Error('DB write failed'); });
    const result = await importAboutContent(makeAboutData());
    expect(result.success).toBe(false);
    expect(result.error).toBe('About content import failed');
  });

  it('handles about with no values or manufacturers', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('AboutContent', []);
    __seed('ContentImports', []);

    const data = { about: { companyName: 'Test Co' } };
    const result = await importAboutContent(data);
    expect(result.success).toBe(true);
    expect(result.data.itemCount).toBe(1); // company-info only
  });
});

// ── importCategoryDescriptions ───────────────────────────────────────

describe('importCategoryDescriptions', () => {
  it('imports valid category descriptions', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const result = await importCategoryDescriptions(makeCategoryData());
    expect(result.success).toBe(true);
    expect(result.data.contentType).toBe('categories');
    expect(result.data.itemCount).toBe(2);
    expect(inserts.filter(i => i.col === 'CategoryDescriptions')).toHaveLength(2);
  });

  it('stores SEO fields', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    await importCategoryDescriptions(makeCategoryData());
    const catInsert = inserts.find(i => i.col === 'CategoryDescriptions' && i.item.slug === 'futon-frames');
    expect(catInsert.item.seoTitle).toContain('Futon Frames');
    expect(catInsert.item.seoDescription).toContain('hardwood');
    expect(catInsert.item.heroText).toContain('Solid Hardwood');
  });

  it('stores price range fields', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    await importCategoryDescriptions(makeCategoryData());
    const catInsert = inserts.find(i => i.col === 'CategoryDescriptions' && i.item.slug === 'futon-frames');
    expect(catInsert.item.priceRangeMin).toBe(199);
    expect(catInsert.item.priceRangeMax).toBe(903);
    expect(catInsert.item.productCount).toBe(19);
  });

  it('rejects null input', async () => {
    const result = await importCategoryDescriptions(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing categories array', async () => {
    const result = await importCategoryDescriptions({ notCategories: [] });
    expect(result.success).toBe(false);
  });

  it('validates missing slug', async () => {
    __seed('CategoryDescriptions', []);
    const data = { categories: [{ title: 'No Slug', description: 'test' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
  });

  it('validates missing title', async () => {
    __seed('CategoryDescriptions', []);
    const data = { categories: [{ slug: 'test' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
  });

  it('dry run returns slugs', async () => {
    const result = await importCategoryDescriptions(makeCategoryData(), { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.slugs).toContain('futon-frames');
    expect(result.data.slugs).toContain('platform-beds');
  });

  it('upserts existing categories', async () => {
    const updates = [];
    __onUpdate((col, item) => { updates.push({ col, item }); });
    __seed('CategoryDescriptions', [{ _id: 'cat-1', slug: 'futon-frames', title: 'Old', description: 'Old' }]);
    __seed('ContentImports', []);

    const result = await importCategoryDescriptions(makeCategoryData());
    expect(result.success).toBe(true);
    expect(updates.filter(u => u.col === 'CategoryDescriptions')).toHaveLength(1);
    expect(updates[0].item.description).toContain('Premium futon frames');
  });

  it('handles missing priceRange gracefully', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = { categories: [{ slug: 'test', title: 'Test', description: 'desc' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(true);
    const catInsert = inserts.find(i => i.col === 'CategoryDescriptions');
    expect(catInsert.item.priceRangeMin).toBe(0);
    expect(catInsert.item.priceRangeMax).toBe(0);
  });

  it('validates non-string slug (number)', async () => {
    __seed('CategoryDescriptions', []);
    const data = { categories: [{ slug: 123, title: 'Test' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(false);
    expect(result.data.errors[0].field).toBe('slug');
  });

  it('handles wixData failure gracefully', async () => {
    __seed('CategoryDescriptions', []);
    __onInsert(() => { throw new Error('DB write failed'); });
    const result = await importCategoryDescriptions(makeCategoryData());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Category descriptions import failed');
  });

  it('defaults missing optional fields to empty/zero', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = { categories: [{ slug: 'minimal', title: 'Minimal' }] };
    const result = await importCategoryDescriptions(data);
    expect(result.success).toBe(true);
    const catInsert = inserts.find(i => i.col === 'CategoryDescriptions');
    expect(catInsert.item.heroText).toBe('');
    expect(catInsert.item.description).toBe('');
    expect(catInsert.item.seoTitle).toBe('');
    expect(catInsert.item.seoDescription).toBe('');
    expect(catInsert.item.productCount).toBe(0);
  });
});

// ── importAllContent ─────────────────────────────────────────────────

describe('importAllContent', () => {
  it('imports all content types at once', async () => {
    __seed('FAQ', []);
    __seed('ShippingInfo', []);
    __seed('AboutContent', []);
    __seed('CategoryDescriptions', []);
    __seed('ContentImports', []);

    const data = {
      faq: makeFaqData(),
      shipping: makeShippingData(),
      about: makeAboutData(),
      categories: makeCategoryData(),
    };
    const result = await importAllContent(data);
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toContain('faq');
    expect(result.data.contentTypes).toContain('shipping');
    expect(result.data.contentTypes).toContain('about');
    expect(result.data.contentTypes).toContain('categories');
  });

  it('imports only provided content types', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const data = { faq: makeFaqData() };
    const result = await importAllContent(data);
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toEqual(['faq']);
  });

  it('dry run previews all types', async () => {
    const data = {
      faq: makeFaqData(),
      shipping: makeShippingData(),
      about: makeAboutData(),
      categories: makeCategoryData(),
    };
    const result = await importAllContent(data, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.results.faq.data.dryRun).toBe(true);
    expect(result.data.results.shipping.data.dryRun).toBe(true);
  });

  it('reports partial failure', async () => {
    __seed('FAQ', []);
    __seed('ContentImports', []);

    const data = {
      faq: makeFaqData(),
      shipping: null, // This will fail
    };
    const result = await importAllContent(data);
    expect(result.success).toBe(false);
  });

  it('returns empty contentTypes when no keys match', async () => {
    const result = await importAllContent({});
    expect(result.success).toBe(true);
    expect(result.data.contentTypes).toHaveLength(0);
  });

  it('handles wixData failure in bulk import', async () => {
    __seed('FAQ', []);
    __onInsert(() => { throw new Error('DB write failed'); });
    const data = { faq: makeFaqData() };
    const result = await importAllContent(data);
    expect(result.success).toBe(false);
  });

  it('dry run with partial validation errors still succeeds', async () => {
    const data = {
      faq: makeFaqData(),
      shipping: { shippingPolicy: { methods: [{ description: 'No name' }] } },
    };
    const result = await importAllContent(data, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.results.shipping.data.errors.length).toBeGreaterThan(0);
  });
});

// ── getContentImportHistory ──────────────────────────────────────────

describe('getContentImportHistory', () => {
  it('returns paginated import history', async () => {
    __seed('ContentImports', [
      { importId: 'cimp-1', contentType: 'faq', status: 'completed', itemCount: 30, completedAt: new Date() },
      { importId: 'cimp-2', contentType: 'shipping', status: 'completed', itemCount: 4, completedAt: new Date() },
    ]);

    const result = await getContentImportHistory();
    expect(result.success).toBe(true);
    expect(result.data.imports).toHaveLength(2);
    expect(result.data.page).toBe(1);
  });

  it('filters by content type', async () => {
    __seed('ContentImports', [
      { importId: 'cimp-1', contentType: 'faq', status: 'completed', itemCount: 30, completedAt: new Date() },
      { importId: 'cimp-2', contentType: 'shipping', status: 'completed', itemCount: 4, completedAt: new Date() },
    ]);

    const result = await getContentImportHistory({ contentType: 'faq' });
    expect(result.success).toBe(true);
    expect(result.data.imports.every(i => i.contentType === 'faq')).toBe(true);
  });

  it('handles empty history', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory();
    expect(result.success).toBe(true);
    expect(result.data.imports).toHaveLength(0);
  });

  it('clamps page size', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 100 });
    expect(result.success).toBe(true);
    expect(result.data.pageSize).toBe(50);
  });

  it('clamps page number to minimum 1', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: -5 });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
  });

  it('ignores invalid contentType filter', async () => {
    __seed('ContentImports', [
      { importId: 'cimp-1', contentType: 'faq', status: 'completed', itemCount: 10, completedAt: new Date() },
    ]);
    const result = await getContentImportHistory({ contentType: 'invalid_type' });
    expect(result.success).toBe(true);
    // Invalid type is ignored — returns all items
    expect(result.data.imports).toHaveLength(1);
  });

  it('treats zero pageSize as default (falsy fallback)', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ pageSize: 0 });
    expect(result.success).toBe(true);
    // 0 is falsy so `0 || 10` falls back to default 10
    expect(result.data.pageSize).toBe(10);
  });

  it('handles non-numeric page and pageSize', async () => {
    __seed('ContentImports', []);
    const result = await getContentImportHistory({ page: 'abc', pageSize: null });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(10); // default
  });

  it('maps import fields correctly', async () => {
    const now = new Date();
    __seed('ContentImports', [
      { importId: 'cimp-x', contentType: 'about', status: 'completed', itemCount: 5, dryRun: true, completedAt: now },
    ]);
    const result = await getContentImportHistory();
    expect(result.success).toBe(true);
    const imp = result.data.imports[0];
    expect(imp.importId).toBe('cimp-x');
    expect(imp.contentType).toBe('about');
    expect(imp.status).toBe('completed');
    expect(imp.itemCount).toBe(5);
    expect(imp.dryRun).toBe(true);
    expect(imp.completedAt).toEqual(now);
  });
});
