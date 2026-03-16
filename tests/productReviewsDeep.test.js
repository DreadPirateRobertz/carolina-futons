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
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/productReviews.web.js');
});

// ── getReviewSummary ──────────────────────────────────────────────

describe('getReviewSummary', () => {
  it('returns zeros for invalid productId (null)', async () => {
    const r = await mod.getReviewSummary(null);
    expect(r.averageRating).toBe(0);
    expect(r.totalReviews).toBe(0);
    expect(r.totalPhotos).toBe(0);
    expect(r.recommendRate).toBe(0);
    expect(r.breakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  });

  it('returns zeros for empty string productId', async () => {
    const r = await mod.getReviewSummary('');
    expect(r.totalReviews).toBe(0);
  });

  it('returns zeros when no reviews exist', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.averageRating).toBe(0);
    expect(r.totalReviews).toBe(0);
  });

  it('aggregates text reviews only', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(2);
    expect(r.averageRating).toBe(4); // (5+3)/2 = 4
    expect(r.breakdown[5]).toBe(1);
    expect(r.breakdown[3]).toBe(1);
  });

  it('aggregates photo reviews only', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 4, photoUrl: 'img.jpg' },
      { _id: 'p2', productId: 'prod1', status: 'featured', rating: 5, photoUrl: 'img2.jpg' },
    ]);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(2);
    expect(r.totalPhotos).toBe(2);
    expect(r.averageRating).toBe(4.5);
  });

  it('combines text and photo reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: ['a.jpg', 'b.jpg'] },
    ]);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 3, photoUrl: 'c.jpg' },
    ]);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(2);
    expect(r.totalPhotos).toBe(3); // 2 text photos + 1 photo review
    expect(r.averageRating).toBe(4); // (5+3)/2
  });

  it('clamps ratings to 1-5 for breakdown', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 10, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: -3, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.breakdown[5]).toBe(1); // 10 clamped to 5
    expect(r.breakdown[1]).toBe(1); // -3 clamped to 1
    expect(r.averageRating).toBe(3); // (5+1)/2
  });

  it('calculates recommendRate from ratings >= 4', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 4, photos: [] },
      { _id: 'r3', productId: 'prod1', status: 'approved', rating: 2, photos: [] },
      { _id: 'r4', productId: 'prod1', status: 'approved', rating: 1, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.recommendRate).toBe(50); // 2 out of 4 are >= 4
  });

  it('excludes non-approved text reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'pending', rating: 1, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(1);
    expect(r.averageRating).toBe(5);
  });

  it('includes featured photo reviews', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'featured', rating: 5, photoUrl: 'x.jpg' },
      { _id: 'p2', productId: 'prod1', status: 'rejected', rating: 1, photoUrl: 'y.jpg' },
    ]);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(1); // only featured, not rejected
  });

  it('counts photos correctly from text reviews without photos array', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 4 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalPhotos).toBe(0); // no photos property → 0
  });

  it('counts photos from photo reviews without photoUrl', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalPhotos).toBe(0); // no photoUrl → not counted
    expect(r.totalReviews).toBe(1);
  });

  it('rounds fractional ratings in breakdown', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 4.6, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.breakdown[5]).toBe(1); // Math.round(4.6) = 5
  });

  it('filters by productId (ignores other products)', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: [] },
      { _id: 'r2', productId: 'prod2', status: 'approved', rating: 1, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewSummary('prod1');
    expect(r.totalReviews).toBe(1);
    expect(r.averageRating).toBe(5);
  });
});

// ── getUnifiedReviews ─────────────────────────────────────────────

describe('getUnifiedReviews', () => {
  it('returns empty for invalid productId', async () => {
    const r = await mod.getUnifiedReviews(null);
    expect(r.reviews).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.hasMore).toBe(false);
  });

  it('returns empty when no reviews', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('normalizes text reviews into unified format', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, authorName: 'Alice', title: 'Great', body: 'Love it', photos: ['a.jpg'], verifiedPurchase: true, helpful: 10, ownerResponse: 'Thanks!', _createdDate: '2025-01-01' },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews).toHaveLength(1);
    const review = r.reviews[0];
    expect(review.type).toBe('text');
    expect(review.authorName).toBe('Alice');
    expect(review.title).toBe('Great');
    expect(review.body).toBe('Love it');
    expect(review.photos).toEqual(['a.jpg']);
    expect(review.verifiedPurchase).toBe(true);
    expect(review.helpful).toBe(10);
    expect(review.ownerResponse).toBe('Thanks!');
  });

  it('normalizes photo reviews into unified format', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'featured', rating: 4, photoUrl: 'img.jpg', photoCaption: 'Nice', reviewText: 'Good quality', helpfulCount: 5, submittedAt: '2025-02-01' },
    ]);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews).toHaveLength(1);
    const review = r.reviews[0];
    expect(review.type).toBe('photo');
    expect(review.authorName).toBe('Customer');
    expect(review.photos).toEqual(['img.jpg']);
    expect(review.photoCaption).toBe('Nice');
    expect(review.body).toBe('Good quality');
    expect(review.helpful).toBe(5);
    expect(review.featured).toBe(true);
    expect(review.ownerResponse).toBe(null);
  });

  it('defaults authorName for text reviews without one', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews[0].authorName).toBe('Customer');
  });

  it('defaults missing fields on text reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews[0].title).toBe('');
    expect(r.reviews[0].body).toBe('');
    expect(r.reviews[0].photos).toEqual([]);
    expect(r.reviews[0].verifiedPurchase).toBe(false);
    expect(r.reviews[0].helpful).toBe(0);
    expect(r.reviews[0].ownerResponse).toBe(null);
  });

  it('photo review without photoUrl gives empty photos array', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews[0].photos).toEqual([]);
  });

  it('sorts by newest (default)', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3, _createdDate: '2025-01-01' },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 5, _createdDate: '2025-06-01' },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews[0]._id).toBe('r2'); // newer first
  });

  it('sorts by highest rating', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 2 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 5 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { sort: 'highest' });
    expect(r.reviews[0]._id).toBe('r2');
  });

  it('sorts by lowest rating', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 1 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { sort: 'lowest' });
    expect(r.reviews[0]._id).toBe('r2');
  });

  it('sorts by helpful count', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3, helpful: 2 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3, helpful: 20 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { sort: 'helpful' });
    expect(r.reviews[0]._id).toBe('r2');
  });

  it('sorts by photos count', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3, photos: ['a.jpg', 'b.jpg', 'c.jpg'] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { sort: 'photos' });
    expect(r.reviews[0]._id).toBe('r2');
  });

  it('clamps limit to 1-50 range', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      _id: `r${i}`, productId: 'prod1', status: 'approved', rating: 3,
    }));
    __seed('Reviews', items);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { limit: 100 });
    expect(r.reviews.length).toBe(50); // clamped to 50
    expect(r.total).toBe(60);
    expect(r.hasMore).toBe(true);
  });

  it('handles limit below 1', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { limit: -5 });
    expect(r.reviews.length).toBe(1); // min limit = 1
  });

  it('paginates with offset', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, _createdDate: '2025-03-01' },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 4, _createdDate: '2025-02-01' },
      { _id: 'r3', productId: 'prod1', status: 'approved', rating: 3, _createdDate: '2025-01-01' },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { limit: 1, offset: 1 });
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0]._id).toBe('r2'); // second item after newest sort
    expect(r.hasMore).toBe(true);
  });

  it('handles negative offset as 0', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { offset: -10 });
    expect(r.reviews).toHaveLength(1);
  });

  it('filterStars filters by exact star rating', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3 },
      { _id: 'r3', productId: 'prod1', status: 'approved', rating: 5 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1', { filterStars: 5 });
    expect(r.total).toBe(2);
  });

  it('filterStars outside 1-5 is ignored (no filter applied)', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    // filterStars=0 → 0 >= 1 is false, so no filter
    const r = await mod.getUnifiedReviews('prod1', { filterStars: 0 });
    expect(r.total).toBe(2);
  });

  it('handles default options', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getUnifiedReviews('prod1');
    expect(r.reviews).toHaveLength(1);
  });
});

// ── getReviewHighlights ───────────────────────────────────────────

describe('getReviewHighlights', () => {
  it('returns nulls for invalid productId', async () => {
    const r = await mod.getReviewHighlights(null);
    expect(r.topReview).toBeNull();
    expect(r.topPhoto).toBeNull();
    expect(r.averageRating).toBe(0);
    expect(r.reviewCount).toBe(0);
  });

  it('returns nulls when no reviews exist', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.topReview).toBeNull();
    expect(r.topPhoto).toBeNull();
  });

  it('returns topReview with truncated body at 150 chars', async () => {
    const longBody = 'A'.repeat(200);
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, authorName: 'Bob', title: 'Wow', body: longBody, verifiedPurchase: true, helpful: 10 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.topReview).not.toBeNull();
    expect(r.topReview.body.length).toBe(150);
    expect(r.topReview.authorName).toBe('Bob');
    expect(r.topReview.verifiedPurchase).toBe(true);
  });

  it('returns topPhoto with truncated body at 100 chars', async () => {
    const longText = 'B'.repeat(150);
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 4, photoUrl: 'img.jpg', reviewText: longText, helpfulCount: 5 },
    ]);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.topPhoto).not.toBeNull();
    expect(r.topPhoto.body.length).toBe(100);
    expect(r.topPhoto.photoUrl).toBe('img.jpg');
  });

  it('includes averageRating and reviewCount from summary', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5, photos: [] },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3, photos: [] },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.averageRating).toBe(4);
    expect(r.reviewCount).toBe(2);
  });

  it('defaults authorName to Customer if missing', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 4, helpful: 1 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.topReview.authorName).toBe('Customer');
  });

  it('defaults missing title and body on topReview', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 4, helpful: 1 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getReviewHighlights('prod1');
    expect(r.topReview.title).toBe('');
    expect(r.topReview.body).toBe('');
  });
});

// ── getBatchReviewSummaries ───────────────────────────────────────

describe('getBatchReviewSummaries', () => {
  it('returns empty object for null input', async () => {
    const r = await mod.getBatchReviewSummaries(null);
    expect(r).toEqual({});
  });

  it('returns empty object for empty array', async () => {
    const r = await mod.getBatchReviewSummaries([]);
    expect(r).toEqual({});
  });

  it('returns empty object if all IDs are invalid', async () => {
    const r = await mod.getBatchReviewSummaries([null, '', undefined]);
    expect(r).toEqual({});
  });

  it('summarizes multiple products', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'r2', productId: 'prod1', status: 'approved', rating: 3 },
      { _id: 'r3', productId: 'prod2', status: 'approved', rating: 4 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getBatchReviewSummaries(['prod1', 'prod2']);
    expect(r.prod1.totalReviews).toBe(2);
    expect(r.prod1.averageRating).toBe(4); // (5+3)/2
    expect(r.prod2.totalReviews).toBe(1);
    expect(r.prod2.averageRating).toBe(4);
  });

  it('includes photo reviews in batch summaries', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'p2', productId: 'prod1', status: 'featured', rating: 3 },
    ]);
    const r = await mod.getBatchReviewSummaries(['prod1']);
    expect(r.prod1.totalReviews).toBe(2);
  });

  it('returns zero averageRating for products with no reviews', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getBatchReviewSummaries(['prod1']);
    expect(r.prod1.averageRating).toBe(0);
    expect(r.prod1.totalReviews).toBe(0);
  });

  it('caps productIds at 50', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod${i}`);
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getBatchReviewSummaries(ids);
    expect(Object.keys(r).length).toBe(50);
  });

  it('clamps ratings in batch aggregation', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 10 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getBatchReviewSummaries(['prod1']);
    expect(r.prod1.averageRating).toBe(5); // clamped to 5
  });
});

// ── getModerationQueue ────────────────────────────────────────────

describe('getModerationQueue', () => {
  it('returns empty when no pending reviews', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', []);
    const r = await mod.getModerationQueue();
    expect(r.reviews).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('returns pending text reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'pending', rating: 3, authorName: 'Eve', title: 'Ok', body: 'Fine', photos: [], verifiedPurchase: true, _createdDate: '2025-01-01' },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getModerationQueue();
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].type).toBe('text');
    expect(r.reviews[0].authorName).toBe('Eve');
  });

  it('returns pending photo reviews', async () => {
    __seed('Reviews', []);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'pending', rating: 4, photoUrl: 'img.jpg', photoCaption: 'Look', reviewText: 'Nice', submittedAt: '2025-02-01' },
    ]);
    const r = await mod.getModerationQueue();
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].type).toBe('photo');
    expect(r.reviews[0].photos).toEqual(['img.jpg']);
    expect(r.reviews[0].photoCaption).toBe('Look');
  });

  it('excludes approved/featured/rejected reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'approved', rating: 5 },
      { _id: 'r2', productId: 'prod1', status: 'pending', rating: 3, _createdDate: '2025-01-01' },
    ]);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'featured', rating: 4 },
    ]);
    const r = await mod.getModerationQueue();
    expect(r.total).toBe(1);
    expect(r.reviews[0]._id).toBe('r2');
  });

  it('sorts combined queue by date descending', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'pending', rating: 3, _createdDate: '2025-01-01' },
    ]);
    __seed('PhotoReviews', [
      { _id: 'p1', productId: 'prod1', status: 'pending', rating: 4, submittedAt: '2025-06-01' },
    ]);
    const r = await mod.getModerationQueue();
    expect(r.reviews[0]._id).toBe('p1'); // newer first
  });

  it('clamps limit to 1-50', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      _id: `r${i}`, productId: 'prod1', status: 'pending', rating: 3, _createdDate: `2025-01-${String(i + 1).padStart(2, '0')}`,
    }));
    __seed('Reviews', items);
    __seed('PhotoReviews', []);
    const r = await mod.getModerationQueue(100);
    expect(r.reviews.length).toBe(50); // clamped
  });

  it('defaults missing fields on text pending reviews', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod1', status: 'pending', rating: 3 },
    ]);
    __seed('PhotoReviews', []);
    const r = await mod.getModerationQueue();
    expect(r.reviews[0].authorName).toBe('Customer');
    expect(r.reviews[0].title).toBe('');
    expect(r.reviews[0].body).toBe('');
    expect(r.reviews[0].photos).toEqual([]);
    expect(r.reviews[0].verifiedPurchase).toBe(false);
  });

  it('defaults limit to 20', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      _id: `r${i}`, productId: 'prod1', status: 'pending', rating: 3, _createdDate: `2025-01-${String(i + 1).padStart(2, '0')}`,
    }));
    __seed('Reviews', items);
    __seed('PhotoReviews', []);
    const r = await mod.getModerationQueue();
    // Query fetches with limit(20) from each collection, so combined.length = 20
    expect(r.reviews.length).toBe(20);
    expect(r.total).toBe(20);
  });
});
