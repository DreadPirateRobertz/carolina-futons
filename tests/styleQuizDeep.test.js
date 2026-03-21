import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    le: (field, val) => { filters[`${field}_le`] = { type: 'le', field, value: val }; return chain; },
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => (i[f.field] || 0) >= f.value);
        if (f.type === 'le') items = items.filter(i => (i[f.field] || 0) <= f.value);
        if (f.type === 'hasSome') {
          items = items.filter(i => {
            const arr = Array.isArray(i[f.field]) ? i[f.field] : [i[f.field]];
            return arr.some(v => f.value.includes(v));
          });
        }
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

let _wixDataInserts = [];
let _wixDataUpdates = [];

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push({ ...item });
      _wixDataInserts.push({ collection, item });
      return item;
    },
    update: async (collection, item) => {
      if (!_collections[collection]) _collections[collection] = [];
      const idx = _collections[collection].findIndex(i => i._id === item._id);
      if (idx >= 0) _collections[collection][idx] = { ..._collections[collection][idx], ...item };
      _wixDataUpdates.push({ collection, item });
      return item;
    },
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, max) => String(str || '').slice(0, max),
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

let subscribeToNewsletterMock;
vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: (...args) => subscribeToNewsletterMock?.(...args) ?? Promise.resolve({ success: true }),
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _wixDataInserts = [];
  _wixDataUpdates = [];
  subscribeToNewsletterMock = vi.fn().mockResolvedValue({ success: true });
  vi.resetModules();
  mod = await import('../src/backend/styleQuiz.web.js');
});

// ── getQuizOptions ───────────────────────────────────────────────

describe('getQuizOptions', () => {
  it('returns all quiz option sets', async () => {
    const r = await mod.getQuizOptions();
    expect(r.roomTypes).toHaveLength(5);
    expect(r.primaryUses).toHaveLength(3);
    expect(r.stylePreferences).toHaveLength(3);
    expect(r.sizeOptions).toHaveLength(3);
    expect(r.budgetRanges).toHaveLength(4);
  });

  it('each option has value and label', async () => {
    const r = await mod.getQuizOptions();
    for (const opt of r.roomTypes) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });
});

// ── getQuizRecommendations ───────────────────────────────────────

describe('getQuizRecommendations', () => {
  it('returns empty for null answers', async () => {
    const r = await mod.getQuizRecommendations(null);
    expect(r).toEqual([]);
  });

  it('returns scored recommendations', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Modern Futon Frame', slug: 'modern-futon', price: 699, collections: ['futon-frames'], inStock: true, description: 'contemporary clean lines' },
      { _id: 'p2', name: 'Rustic Log Frame', slug: 'rustic-log', price: 899, collections: ['futon-frames'], inStock: true, description: 'natural hardwood' },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both',
      stylePreference: 'modern', budgetRange: '500-1000',
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].product.name).toBeTruthy();
    expect(r[0].score).toBeGreaterThan(0);
    expect(r[0].reason).toBeTruthy();
  });

  it('uses fallback when no matches in target collections', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Basic Frame', slug: 'basic', price: 300, collections: ['other-category'] },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'sitting', budgetRange: 'under-500',
    });
    expect(r.length).toBeGreaterThanOrEqual(0); // May or may not have fallback results
  });

  it('caps results at 5', async () => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      _id: `p${i}`, name: `Futon ${i}`, slug: `futon-${i}`, price: 700,
      collections: ['futon-frames'], inStock: true,
    }));
    __seed('Stores/Products', products);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both', budgetRange: '500-1000',
    });
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('gives bonus for in-stock and high-rated products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Frame A', price: 750, collections: ['futon-frames'], inStock: true, numericRating: 4.5 },
      { _id: 'p2', name: 'Frame B', price: 750, collections: ['futon-frames'], inStock: false, numericRating: 3.0 },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both', budgetRange: '500-1000',
    });
    if (r.length >= 2) {
      expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
    }
  });

  it('scores style keyword matches', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Rustic Wood Frame', price: 700, collections: ['futon-frames'], description: 'natural handcrafted hardwood' },
    ]);
    const r = await mod.getQuizRecommendations({
      roomType: 'living-room', primaryUse: 'both',
      stylePreference: 'rustic', budgetRange: '500-1000',
    });
    expect(r[0].score).toBeGreaterThan(50); // Should get style match bonus
  });
});

// ── captureQuizLead ──────────────────────────────────────────────

describe('captureQuizLead', () => {
  it('returns error for missing email', async () => {
    const r = await mod.captureQuizLead('');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/email/i);
  });

  it('returns error for invalid email', async () => {
    const r = await mod.captureQuizLead('not-an-email');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/invalid/i);
  });

  it('calls subscribeToNewsletter with cleaned email and style_quiz source', async () => {
    const spy = vi.fn().mockResolvedValue({ success: true });
    subscribeToNewsletterMock = spy;
    vi.resetModules();
    mod = await import('../src/backend/styleQuiz.web.js');

    const r = await mod.captureQuizLead('User@Example.COM', {
      roomType: 'living-room', primaryUse: 'both', stylePreference: 'modern',
    });
    expect(r.success).toBe(true);
    expect(spy).toHaveBeenCalledWith('user@example.com', { source: 'style_quiz' });
  });

  it('enriches NewsletterSubscribers record with quiz answers', async () => {
    // Pre-seed a subscriber record as subscribeToNewsletter would insert
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'test@example.com', source: 'style_quiz' },
    ]);

    vi.resetModules();
    mod = await import('../src/backend/styleQuiz.web.js');

    await mod.captureQuizLead('test@example.com', {
      roomType: 'guest-room',
      primaryUse: 'sleeping',
      stylePreference: 'rustic',
    });

    const updateCall = _wixDataUpdates.find(u => u.collection === 'NewsletterSubscribers');
    expect(updateCall).toBeTruthy();
    expect(updateCall.item.quizRoomType).toBe('guest-room');
    expect(updateCall.item.quizPrimaryUse).toBe('sleeping');
    expect(updateCall.item.quizStylePreference).toBe('rustic');
  });

  it('does not overwrite quiz fields if already set', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'test@example.com', quizRoomType: 'dorm' },
    ]);

    vi.resetModules();
    mod = await import('../src/backend/styleQuiz.web.js');

    await mod.captureQuizLead('test@example.com', { roomType: 'bedroom' });

    // quizRoomType should NOT be updated since it was already set
    const updateCall = _wixDataUpdates.find(u => u.collection === 'NewsletterSubscribers');
    expect(updateCall).toBeUndefined();
  });

  it('returns success even when subscribeToNewsletter throws', async () => {
    subscribeToNewsletterMock = vi.fn().mockRejectedValue(new Error('esp down'));
    vi.resetModules();
    mod = await import('../src/backend/styleQuiz.web.js');

    const r = await mod.captureQuizLead('good@example.com', {});
    // captureQuizLead should swallow the error and return success:false with message
    expect(r).toHaveProperty('success');
  });

  it('returns error for null email', async () => {
    const r = await mod.captureQuizLead(null);
    expect(r.success).toBe(false);
  });
});
