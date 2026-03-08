import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import {
  getProductContent,
  getProductSpecs,
  getCategoryContent,
  getAllCategories,
  saveFAQ,
  saveProductSpecs,
} from 'backend/catalogContent.web';

// ── Test Data ────────────────────────────────────────────────────────

const SAMPLE_PRODUCT = {
  _id: 'prod-001',
  name: 'Monterey Futon Frame',
  slug: 'monterey',
  description: 'Classic hardwood futon frame with clean lines.',
  price: 599,
  formattedPrice: '$599.00',
  sku: 'CF-FRAME-MONTEREY',
  category: 'futon-frames',
  manufacturer: 'Night & Day Furniture',
  inStock: true,
  images: ['img1.jpg', 'img2.jpg'],
  variants: [{ label: 'Full' }, { label: 'Queen' }],
};

const SAMPLE_SPECS = {
  _id: 'spec-001',
  productId: 'prod-001',
  slug: 'monterey',
  materials: 'Parawood (plantation-grown rubberwood)',
  weightCapacity: 500,
  assemblyDifficulty: 'moderate',
  assemblyNotes: 'Allen wrench included. 45-60 minutes.',
  assemblyVideoUrl: 'https://www.youtube.com/watch?v=abc123',
  careGuide: 'Wipe with damp cloth. Avoid direct sunlight.',
  warranty: '5-year manufacturer warranty',
  madeIn: 'Thailand',
  dimensions: '{"width": 83, "depth": 38, "height": 33, "seatDepth": 22}',
  features: '["Converts to bed","Storage drawer optional","Non-toxic finish"]',
};

const SAMPLE_FAQS = [
  { _id: 'faq-1', targetType: 'product', targetSlug: 'monterey', question: 'Does it include a mattress?', answer: 'No, mattress sold separately.', sortOrder: 0 },
  { _id: 'faq-2', targetType: 'product', targetSlug: 'monterey', question: 'What mattress sizes fit?', answer: 'Full and Queen sizes.', sortOrder: 1 },
];

const CATEGORY_FAQS = [
  { _id: 'cfaq-1', targetType: 'category', targetSlug: 'futon-frames', question: 'How long do futon frames last?', answer: 'Quality hardwood frames last 10-15 years.', sortOrder: 0 },
  { _id: 'cfaq-2', targetType: 'category', targetSlug: 'futon-frames', question: 'What size mattress do I need?', answer: 'Match your frame size — Full or Queen.', sortOrder: 1 },
];

const SAMPLE_CATEGORY_CONTENT = {
  _id: 'cat-001',
  category: 'futon-frames',
  title: 'Futon Frames',
  description: 'Solid hardwood futon frames that convert from sofa to bed in seconds.',
  buyingGuideHtml: '<h2>How to Choose a Futon Frame</h2><p>Consider your room size...</p>',
  seoTitle: 'Futon Frames | Carolina Futons',
  seoDescription: 'Shop solid hardwood futon frames from Night & Day and Strata.',
  sortOrder: 0,
};

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
});

// ── getProductContent ────────────────────────────────────────────────

describe('getProductContent', () => {
  it('returns full product content with specs and FAQs', async () => {
    __seed('Stores/Products', [SAMPLE_PRODUCT]);
    __seed('ProductSpecs', [SAMPLE_SPECS]);
    __seed('ProductFAQs', SAMPLE_FAQS);

    const result = await getProductContent('monterey');
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Monterey Futon Frame');
    expect(result.data.slug).toBe('monterey');
    expect(result.data.description).toBe('Classic hardwood futon frame with clean lines.');
    expect(result.data.price).toBe(599);
    expect(result.data.sku).toBe('CF-FRAME-MONTEREY');
    expect(result.data.manufacturer).toBe('Night & Day Furniture');
    expect(result.data.inStock).toBe(true);
    expect(result.data.images).toHaveLength(2);
    expect(result.data.variants).toHaveLength(2);
  });

  it('includes parsed specs with dimensions and features', async () => {
    __seed('Stores/Products', [SAMPLE_PRODUCT]);
    __seed('ProductSpecs', [SAMPLE_SPECS]);

    const result = await getProductContent('monterey');
    expect(result.data.specs).not.toBeNull();
    expect(result.data.specs.materials).toBe('Parawood (plantation-grown rubberwood)');
    expect(result.data.specs.weightCapacity).toBe(500);
    expect(result.data.specs.assemblyDifficulty).toBe('moderate');
    expect(result.data.specs.assemblyVideoUrl).toContain('youtube.com');
    expect(result.data.specs.warranty).toBe('5-year manufacturer warranty');
    expect(result.data.specs.madeIn).toBe('Thailand');
    expect(result.data.specs.dimensions).toEqual({ width: 83, depth: 38, height: 33, seatDepth: 22 });
    expect(result.data.specs.features).toEqual(['Converts to bed', 'Storage drawer optional', 'Non-toxic finish']);
  });

  it('includes product FAQs sorted by sortOrder', async () => {
    __seed('Stores/Products', [SAMPLE_PRODUCT]);
    __seed('ProductFAQs', SAMPLE_FAQS);

    const result = await getProductContent('monterey');
    expect(result.data.faqs).toHaveLength(2);
    expect(result.data.faqs[0].question).toBe('Does it include a mattress?');
    expect(result.data.faqs[1].question).toBe('What mattress sizes fit?');
  });

  it('returns null specs when no specs exist', async () => {
    __seed('Stores/Products', [SAMPLE_PRODUCT]);

    const result = await getProductContent('monterey');
    expect(result.success).toBe(true);
    expect(result.data.specs).toBeNull();
    expect(result.data.faqs).toEqual([]);
  });

  it('returns error for non-existent product', async () => {
    const result = await getProductContent('nonexistent-product');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Product not found');
  });

  it('returns error for empty slug', async () => {
    const result = await getProductContent('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('returns error for null slug', async () => {
    const result = await getProductContent(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('cleans slug of special characters', async () => {
    __seed('Stores/Products', [{ ...SAMPLE_PRODUCT, slug: 'montereyscript' }]);

    // Slug with special chars should be cleaned to alphanumeric+hyphens
    const result = await getProductContent('monterey<script>');
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('montereyscript');
  });

  it('handles product with no description gracefully', async () => {
    __seed('Stores/Products', [{ ...SAMPLE_PRODUCT, description: null }]);

    const result = await getProductContent('monterey');
    expect(result.success).toBe(true);
    expect(result.data.description).toBe('');
  });

  it('defaults inStock to true when not explicitly false', async () => {
    __seed('Stores/Products', [{ ...SAMPLE_PRODUCT, inStock: undefined }]);

    const result = await getProductContent('monterey');
    expect(result.data.inStock).toBe(true);
  });
});

// ── getProductSpecs ──────────────────────────────────────────────────

describe('getProductSpecs', () => {
  it('returns specs for a product', async () => {
    __seed('ProductSpecs', [SAMPLE_SPECS]);

    const result = await getProductSpecs('monterey');
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('monterey');
    expect(result.data.materials).toBe('Parawood (plantation-grown rubberwood)');
    expect(result.data.careGuide).toBe('Wipe with damp cloth. Avoid direct sunlight.');
  });

  it('returns null data when no specs exist', async () => {
    const result = await getProductSpecs('no-specs-product');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns error for invalid slug', async () => {
    const result = await getProductSpecs('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('parses JSON dimensions field', async () => {
    __seed('ProductSpecs', [SAMPLE_SPECS]);

    const result = await getProductSpecs('monterey');
    expect(result.data.dimensions).toEqual({ width: 83, depth: 38, height: 33, seatDepth: 22 });
  });

  it('parses JSON features array', async () => {
    __seed('ProductSpecs', [SAMPLE_SPECS]);

    const result = await getProductSpecs('monterey');
    expect(result.data.features).toHaveLength(3);
    expect(result.data.features).toContain('Converts to bed');
  });

  it('handles null JSON fields gracefully', async () => {
    __seed('ProductSpecs', [{
      ...SAMPLE_SPECS,
      dimensions: null,
      features: null,
    }]);

    const result = await getProductSpecs('monterey');
    expect(result.data.dimensions).toBeNull();
    expect(result.data.features).toEqual([]);
  });

  it('handles malformed JSON fields', async () => {
    __seed('ProductSpecs', [{
      ...SAMPLE_SPECS,
      dimensions: 'not valid json{{{',
      features: '!!!',
    }]);

    const result = await getProductSpecs('monterey');
    expect(result.data.dimensions).toBeNull();
    expect(result.data.features).toEqual([]);
  });
});

// ── getCategoryContent ───────────────────────────────────────────────

describe('getCategoryContent', () => {
  it('returns category content with FAQs', async () => {
    __seed('CategoryContent', [SAMPLE_CATEGORY_CONTENT]);
    __seed('ProductFAQs', CATEGORY_FAQS);

    const result = await getCategoryContent('futon-frames');
    expect(result.success).toBe(true);
    expect(result.data.category).toBe('futon-frames');
    expect(result.data.title).toBe('Futon Frames');
    expect(result.data.description).toContain('Solid hardwood');
    expect(result.data.buyingGuide).toContain('How to Choose');
    expect(result.data.seoTitle).toBe('Futon Frames | Carolina Futons');
    expect(result.data.faqs).toHaveLength(2);
    expect(result.data.faqs[0].question).toBe('How long do futon frames last?');
  });

  it('returns default title when no CMS content exists', async () => {
    const result = await getCategoryContent('platform-beds');
    expect(result.success).toBe(true);
    expect(result.data.category).toBe('platform-beds');
    expect(result.data.title).toBe('Platform Beds');
    expect(result.data.description).toBe('');
    expect(result.data.buyingGuide).toBeNull();
    expect(result.data.faqs).toEqual([]);
  });

  it('returns error for invalid category', async () => {
    const result = await getCategoryContent('fake-category');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown category');
  });

  it('returns error for null category', async () => {
    const result = await getCategoryContent(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid category');
  });

  it('returns error for empty string category', async () => {
    const result = await getCategoryContent('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid category');
  });

  it('handles category with FAQs but no content record', async () => {
    __seed('ProductFAQs', CATEGORY_FAQS);

    const result = await getCategoryContent('futon-frames');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Futon Frames');
    expect(result.data.faqs).toHaveLength(2);
  });

  it('accepts all valid categories', async () => {
    const categories = [
      'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
      'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
      'covers', 'outdoor-furniture', 'log-frames', 'pillows',
    ];

    for (const cat of categories) {
      const result = await getCategoryContent(cat);
      expect(result.success).toBe(true);
      expect(result.data.category).toBe(cat);
    }
  });
});

// ── getAllCategories ──────────────────────────────────────────────────

describe('getAllCategories', () => {
  it('returns categories from CMS', async () => {
    __seed('CategoryContent', [
      SAMPLE_CATEGORY_CONTENT,
      { _id: 'cat-002', category: 'platform-beds', title: 'Platform Beds', description: 'Low-profile beds.', sortOrder: 1 },
    ]);

    const result = await getAllCategories();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].category).toBe('futon-frames');
    expect(result.data[1].category).toBe('platform-beds');
  });

  it('returns default categories when CMS is empty', async () => {
    const result = await getAllCategories();
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(10);
    expect(result.data[0].category).toBe('futon-frames');
    expect(result.data[0].title).toBe('Futon Frames');
  });

  it('includes description in category data', async () => {
    __seed('CategoryContent', [SAMPLE_CATEGORY_CONTENT]);

    const result = await getAllCategories();
    expect(result.data[0].description).toContain('Solid hardwood');
  });
});

// ── saveFAQ ──────────────────────────────────────────────────────────

describe('saveFAQ', () => {
  it('creates a new product FAQ', async () => {
    let inserted;
    __onInsert((collection, item) => { inserted = item; });

    const result = await saveFAQ({
      targetType: 'product',
      targetSlug: 'monterey',
      question: 'Is assembly required?',
      answer: 'Yes, tools included.',
      sortOrder: 0,
    });

    expect(result.success).toBe(true);
    expect(result.data.targetType).toBe('product');
    expect(result.data.targetSlug).toBe('monterey');
    expect(result.data.question).toBe('Is assembly required?');
    expect(result.data.answer).toBe('Yes, tools included.');
    expect(inserted).toBeDefined();
  });

  it('creates a category FAQ', async () => {
    const result = await saveFAQ({
      targetType: 'category',
      targetSlug: 'futon-frames',
      question: 'What is a futon?',
      answer: 'A convertible sofa-bed.',
    });

    expect(result.success).toBe(true);
    expect(result.data.targetType).toBe('category');
    expect(result.data.targetSlug).toBe('futon-frames');
  });

  it('updates an existing FAQ', async () => {
    __seed('ProductFAQs', [SAMPLE_FAQS[0]]);
    let updated;
    __onUpdate((collection, item) => { updated = item; });

    const result = await saveFAQ({
      _id: 'faq-1',
      targetType: 'product',
      targetSlug: 'monterey',
      question: 'Does it include a mattress?',
      answer: 'No, but we sell mattresses separately. Check our mattress category!',
    });

    expect(result.success).toBe(true);
    expect(updated).toBeDefined();
    expect(updated._id).toBe('faq-1');
  });

  it('rejects invalid targetType', async () => {
    const result = await saveFAQ({
      targetType: 'invalid',
      targetSlug: 'monterey',
      question: 'Q?',
      answer: 'A.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('targetType');
  });

  it('rejects missing question', async () => {
    const result = await saveFAQ({
      targetType: 'product',
      targetSlug: 'monterey',
      question: '',
      answer: 'An answer.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Question');
  });

  it('rejects missing answer', async () => {
    const result = await saveFAQ({
      targetType: 'product',
      targetSlug: 'monterey',
      question: 'A question?',
      answer: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Answer');
  });

  it('rejects null input', async () => {
    const result = await saveFAQ(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid FAQ data');
  });

  it('sanitizes question and answer text', async () => {
    const result = await saveFAQ({
      targetType: 'product',
      targetSlug: 'monterey',
      question: '<script>alert("xss")</script>Is this safe?',
      answer: '<b>Yes</b>, it is <em>safe</em>.',
    });

    expect(result.success).toBe(true);
    expect(result.data.question).not.toContain('<script>');
    expect(result.data.answer).not.toContain('<b>');
  });

  it('defaults sortOrder to 0', async () => {
    const result = await saveFAQ({
      targetType: 'product',
      targetSlug: 'monterey',
      question: 'Q?',
      answer: 'A.',
    });

    expect(result.success).toBe(true);
    expect(result.data.sortOrder).toBe(0);
  });
});

// ── saveProductSpecs ─────────────────────────────────────────────────

describe('saveProductSpecs', () => {
  it('creates new specs for a product', async () => {
    let inserted;
    __onInsert((collection, item) => { inserted = item; });

    const result = await saveProductSpecs({
      slug: 'nomad-platform-bed',
      materials: 'Kiln-dried Tulip Poplar hardwood',
      weightCapacity: 600,
      assemblyDifficulty: 'moderate',
      assemblyNotes: 'Screwdriver or drill required.',
      careGuide: 'Unfinished natural wood — can be stained or painted.',
      warranty: '5-year warranty',
      madeIn: 'Athens, Georgia, USA',
      dimensions: { width: 80, depth: 60, height: 14 },
      features: ['No box spring needed', 'Trundle compatible', 'Eco-friendly'],
    });

    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('nomad-platform-bed');
    expect(result.data.materials).toBe('Kiln-dried Tulip Poplar hardwood');
    expect(result.data.weightCapacity).toBe(600);
    expect(inserted).toBeDefined();
    expect(inserted.dimensions).toBe('{"width":80,"depth":60,"height":14}');
    expect(inserted.features).toBe('["No box spring needed","Trundle compatible","Eco-friendly"]');
  });

  it('updates existing specs by slug lookup', async () => {
    __seed('ProductSpecs', [SAMPLE_SPECS]);
    let updated;
    __onUpdate((collection, item) => { updated = item; });

    const result = await saveProductSpecs({
      slug: 'monterey',
      materials: 'Updated material info',
      weightCapacity: 550,
      assemblyDifficulty: 'easy',
    });

    expect(result.success).toBe(true);
    expect(updated).toBeDefined();
    expect(updated._id).toBe('spec-001');
    expect(updated.materials).toBe('Updated material info');
  });

  it('rejects missing slug', async () => {
    const result = await saveProductSpecs({ materials: 'Wood' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('slug');
  });

  it('rejects null input', async () => {
    const result = await saveProductSpecs(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid specs data');
  });

  it('rejects invalid assemblyDifficulty', async () => {
    const result = await saveProductSpecs({
      slug: 'monterey',
      assemblyDifficulty: 'extreme',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('assemblyDifficulty');
  });

  it('handles null optional fields', async () => {
    const result = await saveProductSpecs({
      slug: 'minimal-product',
    });

    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('minimal-product');
    expect(result.data.materials).toBeNull();
    expect(result.data.weightCapacity).toBeNull();
  });

  it('sanitizes text fields', async () => {
    const result = await saveProductSpecs({
      slug: 'test-product',
      materials: '<script>alert("xss")</script>Hardwood',
      careGuide: '<b>Wipe</b> with cloth',
    });

    expect(result.success).toBe(true);
    // The sanitize function strips HTML tags
    expect(result.data.materials).not.toContain('<script>');
  });
});
