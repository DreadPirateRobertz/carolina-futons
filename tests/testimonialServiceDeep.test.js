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
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _mockMember = { _id: 'member1' };
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: async () => _mockMember },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[f.field]));
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1' };
  vi.resetModules();
  mod = await import('../src/backend/testimonialService.web.js');
});

// ── isFlaggedContent ─────────────────────────────────────────────

describe('isFlaggedContent', () => {
  it('returns false for clean text', () => {
    expect(mod.isFlaggedContent('Great futon, very comfortable')).toBe(false);
  });

  it('flags spam keywords', () => {
    expect(mod.isFlaggedContent('This is spam content')).toBe(true);
  });

  it('flags URLs', () => {
    expect(mod.isFlaggedContent('Visit https://example.com for deals')).toBe(true);
  });

  it('flags long numbers', () => {
    expect(mod.isFlaggedContent('Call 1234567890 now')).toBe(true);
  });

  it('returns false for null', () => {
    expect(mod.isFlaggedContent(null)).toBe(false);
  });
});

// ── submitTestimonial ────────────────────────────────────────────

describe('submitTestimonial', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.submitTestimonial({ name: 'Jane', story: 'Great futon experience!' });
    expect(r.success).toBe(false);
  });

  it('rejects short story', async () => {
    const r = await mod.submitTestimonial({ name: 'Jane', story: 'Short' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('10 characters');
  });

  it('submits valid testimonial', async () => {
    const r = await mod.submitTestimonial({
      name: 'Jane', story: 'I love my new futon from Carolina Futons!',
      rating: 5, productId: 'prod1', productName: 'Classic Futon',
    });
    expect(r.success).toBe(true);
    expect(r.id).toBeTruthy();
    expect(_collections['Testimonials']).toHaveLength(1);
    expect(_collections['Testimonials'][0].status).toBe('pending');
    expect(_collections['Testimonials'][0].memberId).toBe('member1');
  });

  it('auto-flags spam content', async () => {
    await mod.submitTestimonial({ name: 'Jane', story: 'Visit https://spam.com for free stuff right now' });
    expect(_collections['Testimonials'][0].status).toBe('flagged');
  });

  it('clamps rating to 1-5', async () => {
    await mod.submitTestimonial({ name: 'Jane', story: 'A perfectly fine futon experience', rating: 10 });
    expect(_collections['Testimonials'][0].rating).toBe(5);

    _collections = {};
    await mod.submitTestimonial({ name: 'Jane', story: 'A perfectly fine futon experience', rating: -1 });
    expect(_collections['Testimonials'][0].rating).toBe(1);
  });

  it('defaults name when empty', async () => {
    await mod.submitTestimonial({ name: '', story: 'A wonderful futon purchase experience' });
    expect(_collections['Testimonials'][0].name).toBe('Carolina Futons Customer');
  });

  it('defaults rating to 5 for non-number', async () => {
    await mod.submitTestimonial({ name: 'Jane', story: 'Great futon purchase experience' });
    expect(_collections['Testimonials'][0].rating).toBe(5);
  });

  it('caps photos to 5', async () => {
    await mod.submitTestimonial({
      name: 'Jane', story: 'Love this futon very much', source: 'thank_you',
    });
    expect(_collections['Testimonials'][0].source).toBe('thank_you');
  });
});

// ── getFeaturedTestimonials ──────────────────────────────────────

describe('getFeaturedTestimonials', () => {
  it('returns empty when no featured', async () => {
    __seed('Testimonials', []);
    const r = await mod.getFeaturedTestimonials();
    expect(r.success).toBe(true);
    expect(r.items).toHaveLength(0);
  });

  it('returns only featured testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't1', status: 'featured', approvedAt: new Date() },
      { _id: 't2', status: 'approved', approvedAt: new Date() },
      { _id: 't3', status: 'featured', approvedAt: new Date() },
    ]);
    const r = await mod.getFeaturedTestimonials();
    expect(r.items).toHaveLength(2);
  });

  it('caps limit at 20', async () => {
    const r = await mod.getFeaturedTestimonials(100);
    expect(r.success).toBe(true);
  });
});

// ── getTestimonialsByCategory ────────────────────────────────────

describe('getTestimonialsByCategory', () => {
  it('returns approved and featured', async () => {
    __seed('Testimonials', [
      { _id: 't1', status: 'approved', productCategory: 'futons' },
      { _id: 't2', status: 'featured', productCategory: 'futons' },
      { _id: 't3', status: 'pending', productCategory: 'futons' },
    ]);
    const r = await mod.getTestimonialsByCategory('futons');
    expect(r.items).toHaveLength(2);
  });

  it('returns all categories when no filter', async () => {
    __seed('Testimonials', [
      { _id: 't1', status: 'approved', productCategory: 'futons' },
      { _id: 't2', status: 'approved', productCategory: 'covers' },
    ]);
    const r = await mod.getTestimonialsByCategory();
    expect(r.items).toHaveLength(2);
  });
});

// ── getMyTestimonials ────────────────────────────────────────────

describe('getMyTestimonials', () => {
  it('returns only current member testimonials', async () => {
    __seed('Testimonials', [
      { _id: 't1', memberId: 'member1', story: 'Great' },
      { _id: 't2', memberId: 'other', story: 'Also great' },
    ]);
    const r = await mod.getMyTestimonials();
    expect(r.items).toHaveLength(1);
    expect(r.items[0]._id).toBe('t1');
  });

  it('rejects unauthenticated', async () => {
    _mockMember = null;
    const r = await mod.getMyTestimonials();
    expect(r.success).toBe(false);
  });
});

// ── getTestimonialSchema ─────────────────────────────────────────

describe('getTestimonialSchema', () => {
  it('returns empty for no testimonials', async () => {
    __seed('Testimonials', []);
    const r = await mod.getTestimonialSchema();
    expect(r).toBe('');
  });

  it('generates valid JSON-LD schema', async () => {
    __seed('Testimonials', [
      { _id: 't1', status: 'approved', name: 'Jane', story: 'Great!', rating: 5, approvedAt: new Date('2026-01-01') },
      { _id: 't2', status: 'featured', name: 'John', story: 'Love it!', rating: 4, approvedAt: new Date('2026-01-02') },
    ]);
    const r = await mod.getTestimonialSchema();
    const schema = JSON.parse(r);
    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema.aggregateRating.ratingValue).toBe('4.5');
    expect(schema.aggregateRating.reviewCount).toBe('2');
    expect(schema.review).toHaveLength(2);
  });

  it('caps reviews at 10 in schema', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      _id: `t${i}`, status: 'approved', name: `User ${i}`, story: 'Great', rating: 5,
    }));
    __seed('Testimonials', items);
    const r = await mod.getTestimonialSchema();
    const schema = JSON.parse(r);
    expect(schema.review).toHaveLength(10);
  });
});

// ── updateTestimonialStatus ──────────────────────────────────────

describe('updateTestimonialStatus', () => {
  it('rejects missing ID', async () => {
    const r = await mod.updateTestimonialStatus(null, 'approved');
    expect(r.success).toBe(false);
  });

  it('rejects invalid status', async () => {
    const r = await mod.updateTestimonialStatus('t1', 'invalid');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid status');
  });

  it('rejects non-existent testimonial', async () => {
    __seed('Testimonials', []);
    const r = await mod.updateTestimonialStatus('t1', 'approved');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('approves testimonial and sets approvedAt', async () => {
    __seed('Testimonials', [{ _id: 't1', status: 'pending', featured: false }]);
    const r = await mod.updateTestimonialStatus('t1', 'approved');
    expect(r.success).toBe(true);
    expect(_collections['Testimonials'][0].status).toBe('approved');
    expect(_collections['Testimonials'][0].approvedAt).toBeTruthy();
  });

  it('features testimonial and sets featured flag', async () => {
    __seed('Testimonials', [{ _id: 't1', status: 'pending', featured: false }]);
    await mod.updateTestimonialStatus('t1', 'featured');
    expect(_collections['Testimonials'][0].featured).toBe(true);
  });

  it('rejects testimonial without setting approvedAt', async () => {
    __seed('Testimonials', [{ _id: 't1', status: 'pending', featured: false }]);
    await mod.updateTestimonialStatus('t1', 'rejected');
    expect(_collections['Testimonials'][0].status).toBe('rejected');
    expect(_collections['Testimonials'][0].featured).toBe(false);
  });
});

// ── getPendingTestimonials ───────────────────────────────────────

describe('getPendingTestimonials', () => {
  it('returns only pending', async () => {
    __seed('Testimonials', [
      { _id: 't1', status: 'pending' },
      { _id: 't2', status: 'approved' },
      { _id: 't3', status: 'pending' },
    ]);
    const r = await mod.getPendingTestimonials();
    expect(r.items).toHaveLength(2);
  });

  it('caps limit at 50', async () => {
    __seed('Testimonials', []);
    const r = await mod.getPendingTestimonials(100);
    expect(r.success).toBe(true);
  });
});
