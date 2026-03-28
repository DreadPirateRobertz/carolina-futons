import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    },
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => { _collections = {}; });

const mod = await import('../src/backend/catalogContent.web.js');
const { getProductContent, getProductSpecs, getCategoryContent, getAllCategories, saveFAQ, saveProductSpecs } = mod;

// ═════════════════════════════════════════════════════════════════════
// getProductContent
// ═════════════════════════════════════════════════════════════════════
describe('getProductContent', () => {
  it('returns combined product, specs, and FAQs', async () => {
    __seed('Stores/Products', [{ slug: 'asheville-futon', name: 'Asheville', description: 'A futon', price: 399, formattedPrice: '$399', sku: 'ASH-1', inStock: true, images: ['img1'], variants: [] }]);
    __seed('ProductSpecs', [{ slug: 'asheville-futon', materials: 'Oak', weightCapacity: 300, dimensions: '{"w":80}', features: '["solid wood"]' }]);
    __seed('ProductFAQs', [{ targetType: 'product', targetSlug: 'asheville-futon', question: 'Q1?', answer: 'A1', sortOrder: 1 }]);
    const result = await getProductContent('asheville-futon');
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Asheville');
    expect(result.data.specs.materials).toBe('Oak');
    expect(result.data.specs.dimensions).toEqual({ w: 80 });
    expect(result.data.specs.features).toEqual(['solid wood']);
    expect(result.data.faqs).toHaveLength(1);
  });

  it('rejects empty slug', async () => {
    const result = await getProductContent('');
    expect(result.success).toBe(false);
  });

  it('rejects null slug', async () => {
    const result = await getProductContent(null);
    expect(result.success).toBe(false);
  });

  it('returns not found for missing product', async () => {
    __seed('Stores/Products', []);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns null specs when no specs exist', async () => {
    __seed('Stores/Products', [{ slug: 'test', name: 'Test' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('test');
    expect(result.data.specs).toBeNull();
  });

  it('returns empty FAQs when none exist', async () => {
    __seed('Stores/Products', [{ slug: 'test', name: 'Test' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('test');
    expect(result.data.faqs).toEqual([]);
  });

  it('defaults inStock to true when not explicitly false', async () => {
    __seed('Stores/Products', [{ slug: 'test', name: 'Test' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('test');
    expect(result.data.inStock).toBe(true);
  });

  it('handles malformed dimensions JSON', async () => {
    __seed('Stores/Products', [{ slug: 'test', name: 'Test' }]);
    __seed('ProductSpecs', [{ slug: 'test', dimensions: 'not-json', features: null }]);
    __seed('ProductFAQs', []);
    const result = await getProductContent('test');
    expect(result.data.specs.dimensions).toBeNull();
  });

  it('handles null features', async () => {
    __seed('Stores/Products', [{ slug: 'test', name: 'Test' }]);
    __seed('ProductSpecs', [{ slug: 'test', features: null }]);
    __seed('ProductFAQs', []);
    const result = await getProductContent('test');
    expect(result.data.specs.features).toEqual([]);
  });

  it('cleans slug: lowercases and strips special chars', async () => {
    __seed('Stores/Products', [{ slug: 'my-product', name: 'My' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('My-Product');
    expect(result.success).toBe(true);
  });

  it('defaults empty optional product fields', async () => {
    __seed('Stores/Products', [{ slug: 'bare', name: 'Bare' }]);
    __seed('ProductSpecs', []);
    __seed('ProductFAQs', []);
    const result = await getProductContent('bare');
    expect(result.data.description).toBe('');
    expect(result.data.price).toBeNull();
    expect(result.data.images).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getProductSpecs
// ═════════════════════════════════════════════════════════════════════
describe('getProductSpecs', () => {
  it('returns specs for a product', async () => {
    __seed('ProductSpecs', [{ slug: 'test-futon', materials: 'Pine', weightCapacity: 500, features: '["a","b"]', dimensions: '{"h":30}' }]);
    const result = await getProductSpecs('test-futon');
    expect(result.success).toBe(true);
    expect(result.data.materials).toBe('Pine');
    expect(result.data.features).toEqual(['a', 'b']);
  });

  it('returns null data when no specs', async () => {
    __seed('ProductSpecs', []);
    const result = await getProductSpecs('no-specs');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('rejects empty slug', async () => {
    const result = await getProductSpecs('');
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getCategoryContent
// ═════════════════════════════════════════════════════════════════════
describe('getCategoryContent', () => {
  it('returns category content with FAQs', async () => {
    __seed('CategoryContent', [{ category: 'futon-frames', title: 'Futon Frames', description: 'Browse our futons', buyingGuideHtml: '<p>Guide</p>', seoTitle: 'Best Futons', seoDescription: 'SEO desc' }]);
    __seed('ProductFAQs', [{ targetType: 'category', targetSlug: 'futon-frames', question: 'How?', answer: 'Like this', sortOrder: 1 }]);
    const result = await getCategoryContent('futon-frames');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Futon Frames');
    expect(result.data.buyingGuide).toBe('<p>Guide</p>');
    expect(result.data.faqs).toHaveLength(1);
  });

  it('returns default title when no content record exists', async () => {
    __seed('CategoryContent', []);
    __seed('ProductFAQs', []);
    const result = await getCategoryContent('mattresses');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Mattresses');
    expect(result.data.description).toBe('');
  });

  it('rejects unknown category', async () => {
    const result = await getCategoryContent('unknown-category');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown category');
  });

  it('rejects null', async () => {
    const result = await getCategoryContent(null);
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', async () => {
    const cats = ['futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
      'casegoods-accessories', 'front-loading-nesting', 'wall-hugger-frames',
      'unfinished-wood', 'covers', 'outdoor-furniture', 'log-frames', 'pillows-702'];
    for (const cat of cats) {
      _collections = {};
      __seed('CategoryContent', []);
      __seed('ProductFAQs', []);
      const result = await getCategoryContent(cat);
      expect(result.success).toBe(true);
    }
  });

  it('lowercases category for matching', async () => {
    __seed('CategoryContent', []);
    __seed('ProductFAQs', []);
    const result = await getCategoryContent('Mattresses');
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAllCategories
// ═════════════════════════════════════════════════════════════════════
describe('getAllCategories', () => {
  it('returns categories from CMS when available', async () => {
    __seed('CategoryContent', [
      { category: 'futon-frames', title: 'Futons', description: 'Browse', sortOrder: 1 },
    ]);
    const result = await getAllCategories();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].category).toBe('futon-frames');
  });

  it('returns default VALID_CATEGORIES when CMS is empty', async () => {
    __seed('CategoryContent', []);
    const result = await getAllCategories();
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(12);
    expect(result.data[0].category).toBe('futon-frames');
    expect(result.data[0].title).toBe('Futon Frames');
  });

  it('defaults sortOrder to 0 when missing', async () => {
    __seed('CategoryContent', [{ category: 'test', title: 'Test' }]);
    const result = await getAllCategories();
    expect(result.data[0].sortOrder).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// saveFAQ
// ═════════════════════════════════════════════════════════════════════
describe('saveFAQ', () => {
  it('creates a new FAQ', async () => {
    const result = await saveFAQ({ targetType: 'product', targetSlug: 'test-futon', question: 'Q?', answer: 'A' });
    expect(result.success).toBe(true);
    expect(result.data._id).toBeTruthy();
    expect(result.data.question).toBe('Q?');
  });

  it('updates an existing FAQ', async () => {
    __seed('ProductFAQs', [{ _id: 'faq1', targetType: 'product', targetSlug: 'test', question: 'Old Q', answer: 'Old A', sortOrder: 0 }]);
    const result = await saveFAQ({ _id: 'faq1', targetType: 'product', targetSlug: 'test', question: 'New Q', answer: 'New A' });
    expect(result.success).toBe(true);
    const updated = _collections.ProductFAQs.find(f => f._id === 'faq1');
    expect(updated.question).toBe('New Q');
  });

  it('rejects null data', async () => {
    const result = await saveFAQ(null);
    expect(result.success).toBe(false);
  });

  it('rejects invalid targetType', async () => {
    const result = await saveFAQ({ targetType: 'invalid', targetSlug: 'x', question: 'Q', answer: 'A' });
    expect(result.success).toBe(false);
  });

  it('requires targetSlug', async () => {
    const result = await saveFAQ({ targetType: 'product', question: 'Q', answer: 'A' });
    expect(result.success).toBe(false);
  });

  it('requires question', async () => {
    const result = await saveFAQ({ targetType: 'product', targetSlug: 'x', answer: 'A' });
    expect(result.success).toBe(false);
  });

  it('requires answer', async () => {
    const result = await saveFAQ({ targetType: 'product', targetSlug: 'x', question: 'Q' });
    expect(result.success).toBe(false);
  });

  it('accepts category targetType', async () => {
    const result = await saveFAQ({ targetType: 'category', targetSlug: 'futon-frames', question: 'Q?', answer: 'A' });
    expect(result.success).toBe(true);
  });

  it('defaults sortOrder to 0', async () => {
    const result = await saveFAQ({ targetType: 'product', targetSlug: 'test', question: 'Q?', answer: 'A' });
    expect(result.data.sortOrder).toBe(0);
  });

  it('sanitizes question and answer', async () => {
    const result = await saveFAQ({ targetType: 'product', targetSlug: 'test', question: '<b>Q?</b>', answer: '<script>A</script>' });
    expect(result.data.question).not.toContain('<b>');
  });
});

// ═════════════════════════════════════════════════════════════════════
// saveProductSpecs
// ═════════════════════════════════════════════════════════════════════
describe('saveProductSpecs', () => {
  it('creates new specs', async () => {
    __seed('ProductSpecs', []);
    const result = await saveProductSpecs({
      slug: 'new-product', materials: 'Oak', weightCapacity: 300,
      assemblyDifficulty: 'moderate', features: ['solid', 'durable'],
    });
    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('new-product');
    expect(result.data.materials).toBe('Oak');
  });

  it('updates existing specs by slug', async () => {
    __seed('ProductSpecs', [{ _id: 'sp1', slug: 'existing' }]);
    const result = await saveProductSpecs({ slug: 'existing', materials: 'Pine' });
    expect(result.success).toBe(true);
    const updated = _collections.ProductSpecs.find(s => s._id === 'sp1');
    expect(updated.materials).toBe('Pine');
  });

  it('rejects null specs', async () => {
    const result = await saveProductSpecs(null);
    expect(result.success).toBe(false);
  });

  it('requires slug', async () => {
    const result = await saveProductSpecs({ materials: 'Oak' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid assemblyDifficulty', async () => {
    __seed('ProductSpecs', []);
    const result = await saveProductSpecs({ slug: 'test', assemblyDifficulty: 'impossible' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid difficulty levels', async () => {
    for (const d of ['easy', 'moderate', 'difficult']) {
      _collections = {};
      __seed('ProductSpecs', []);
      const result = await saveProductSpecs({ slug: 'test', assemblyDifficulty: d });
      expect(result.success).toBe(true);
    }
  });

  it('allows null assemblyDifficulty', async () => {
    __seed('ProductSpecs', []);
    const result = await saveProductSpecs({ slug: 'test' });
    expect(result.success).toBe(true);
  });

  it('serializes dimensions to JSON', async () => {
    __seed('ProductSpecs', []);
    await saveProductSpecs({ slug: 'test', dimensions: { w: 80, h: 30, d: 40 } });
    const record = _collections.ProductSpecs[0];
    expect(JSON.parse(record.dimensions)).toEqual({ w: 80, h: 30, d: 40 });
  });

  it('serializes features array to JSON', async () => {
    __seed('ProductSpecs', []);
    await saveProductSpecs({ slug: 'test', features: ['a', 'b'] });
    const record = _collections.ProductSpecs[0];
    expect(JSON.parse(record.features)).toEqual(['a', 'b']);
  });

  it('handles non-array features as null', async () => {
    __seed('ProductSpecs', []);
    await saveProductSpecs({ slug: 'test', features: 'not-array' });
    const record = _collections.ProductSpecs[0];
    expect(record.features).toBeNull();
  });

  it('preserves numeric weightCapacity', async () => {
    __seed('ProductSpecs', []);
    await saveProductSpecs({ slug: 'test', weightCapacity: 500 });
    expect(_collections.ProductSpecs[0].weightCapacity).toBe(500);
  });

  it('sets non-numeric weightCapacity to null', async () => {
    __seed('ProductSpecs', []);
    await saveProductSpecs({ slug: 'test', weightCapacity: 'heavy' });
    expect(_collections.ProductSpecs[0].weightCapacity).toBeNull();
  });
});
