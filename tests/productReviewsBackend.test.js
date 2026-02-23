import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getReviewSummary,
  getUnifiedReviews,
  getReviewHighlights,
  getBatchReviewSummaries,
  getModerationQueue,
} from '../src/backend/productReviews.web.js';

const now = new Date();
const dayAgo = new Date(Date.now() - 86400000);
const weekAgo = new Date(Date.now() - 7 * 86400000);

const textReviews = [
  { _id: 'rev-1', productId: 'prod-frame-001', memberId: 'm1', authorName: 'Jane S.', rating: 5, title: 'Excellent!', body: 'Love this frame, solid build.', photos: ['https://img1.jpg'], verifiedPurchase: true, helpful: 12, status: 'approved', _createdDate: now, ownerResponse: 'Thank you!' },
  { _id: 'rev-2', productId: 'prod-frame-001', memberId: 'm2', authorName: 'Tom B.', rating: 4, title: 'Great value', body: 'Good frame for the price.', photos: [], verifiedPurchase: true, helpful: 5, status: 'approved', _createdDate: dayAgo },
  { _id: 'rev-3', productId: 'prod-frame-001', memberId: 'm3', authorName: 'Bob K.', rating: 2, title: 'Slow shipping', body: 'Product is fine but shipping was slow.', photos: [], verifiedPurchase: false, helpful: 1, status: 'approved', _createdDate: weekAgo },
  { _id: 'rev-4', productId: 'prod-frame-001', memberId: 'm4', authorName: 'Sue P.', rating: 5, title: 'Pending review', body: 'Waiting for approval.', photos: [], verifiedPurchase: true, helpful: 0, status: 'pending', _createdDate: now },
  { _id: 'rev-5', productId: 'prod-matt-001', memberId: 'm5', authorName: 'Amy L.', rating: 4, title: 'Comfy mattress', body: 'Very comfortable.', photos: [], verifiedPurchase: true, helpful: 8, status: 'approved', _createdDate: now },
];

const photoReviews = [
  { _id: 'pr-1', productId: 'prod-frame-001', memberId: 'm6', reviewText: 'Beautiful in our den!', rating: 5, photoUrl: 'https://photo1.jpg', photoCaption: 'Living room setup', status: 'approved', submittedAt: now, helpfulCount: 7 },
  { _id: 'pr-2', productId: 'prod-frame-001', memberId: 'm7', reviewText: 'Great frame, easy assembly.', rating: 4, photoUrl: 'https://photo2.jpg', photoCaption: '', status: 'featured', submittedAt: dayAgo, helpfulCount: 15 },
  { _id: 'pr-3', productId: 'prod-frame-001', memberId: 'm8', reviewText: 'Pending photo review.', rating: 3, photoUrl: 'https://photo3.jpg', photoCaption: '', status: 'pending', submittedAt: now, helpfulCount: 0 },
  { _id: 'pr-4', productId: 'prod-matt-001', memberId: 'm9', reviewText: 'Mattress is soft!', rating: 5, photoUrl: 'https://photo4.jpg', photoCaption: '', status: 'approved', submittedAt: now, helpfulCount: 3 },
];

beforeEach(() => {
  __seed('Reviews', textReviews);
  __seed('PhotoReviews', photoReviews);
});

// ── getReviewSummary ────────────────────────────────────────────────

describe('getReviewSummary', () => {
  it('aggregates ratings from both text and photo reviews', async () => {
    const summary = await getReviewSummary('prod-frame-001');
    // Text: 5, 4, 2 (approved) + Photo: 5, 4 (approved/featured) = 5 reviews
    expect(summary.totalReviews).toBe(5);
    expect(summary.averageRating).toBe(4); // (5+4+2+5+4)/5 = 20/5 = 4.0
  });

  it('calculates star breakdown', async () => {
    const summary = await getReviewSummary('prod-frame-001');
    expect(summary.breakdown[5]).toBe(2);
    expect(summary.breakdown[4]).toBe(2);
    expect(summary.breakdown[2]).toBe(1);
    expect(summary.breakdown[3]).toBe(0);
    expect(summary.breakdown[1]).toBe(0);
  });

  it('calculates recommend rate (4+ stars)', async () => {
    const summary = await getReviewSummary('prod-frame-001');
    // 4 out of 5 are 4+ stars = 80%
    expect(summary.recommendRate).toBe(80);
  });

  it('counts total photos', async () => {
    const summary = await getReviewSummary('prod-frame-001');
    // Text: rev-1 has 1 photo; Photo: pr-1 and pr-2 = 2 photos → total 3
    expect(summary.totalPhotos).toBe(3);
  });

  it('excludes pending reviews', async () => {
    const summary = await getReviewSummary('prod-frame-001');
    // rev-4 (pending) and pr-3 (pending) should not count
    expect(summary.totalReviews).toBe(5);
  });

  it('returns zeros for invalid productId', async () => {
    const summary = await getReviewSummary('');
    expect(summary.totalReviews).toBe(0);
    expect(summary.averageRating).toBe(0);
  });

  it('returns zeros for product with no reviews', async () => {
    const summary = await getReviewSummary('prod-no-reviews');
    expect(summary.totalReviews).toBe(0);
    expect(summary.averageRating).toBe(0);
    expect(summary.recommendRate).toBe(0);
  });
});

// ── getUnifiedReviews ───────────────────────────────────────────────

describe('getUnifiedReviews', () => {
  it('combines text and photo reviews', async () => {
    const result = await getUnifiedReviews('prod-frame-001');
    expect(result.total).toBe(5); // 3 approved text + 2 approved/featured photo
    expect(result.reviews.length).toBeLessThanOrEqual(10);
  });

  it('normalizes review format', async () => {
    const result = await getUnifiedReviews('prod-frame-001');
    for (const review of result.reviews) {
      expect(review).toHaveProperty('_id');
      expect(review).toHaveProperty('type');
      expect(review).toHaveProperty('rating');
      expect(review).toHaveProperty('body');
      expect(review).toHaveProperty('photos');
      expect(review).toHaveProperty('helpful');
      expect(['text', 'photo']).toContain(review.type);
    }
  });

  it('sorts by newest by default', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'newest' });
    for (let i = 1; i < result.reviews.length; i++) {
      const prev = result.reviews[i - 1].date ? new Date(result.reviews[i - 1].date).getTime() : 0;
      const curr = result.reviews[i].date ? new Date(result.reviews[i].date).getTime() : 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('sorts by highest rating', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'highest' });
    for (let i = 1; i < result.reviews.length; i++) {
      expect(result.reviews[i - 1].rating).toBeGreaterThanOrEqual(result.reviews[i].rating);
    }
  });

  it('sorts by lowest rating', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'lowest' });
    for (let i = 1; i < result.reviews.length; i++) {
      expect(result.reviews[i - 1].rating).toBeLessThanOrEqual(result.reviews[i].rating);
    }
  });

  it('sorts by helpful', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'helpful' });
    for (let i = 1; i < result.reviews.length; i++) {
      expect(result.reviews[i - 1].helpful).toBeGreaterThanOrEqual(result.reviews[i].helpful);
    }
  });

  it('sorts by photos (most photos first)', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'photos' });
    for (let i = 1; i < result.reviews.length; i++) {
      expect(result.reviews[i - 1].photos.length).toBeGreaterThanOrEqual(result.reviews[i].photos.length);
    }
  });

  it('filters by star rating', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { filterStars: 5 });
    for (const review of result.reviews) {
      expect(review.rating).toBe(5);
    }
  });

  it('paginates with limit and offset', async () => {
    const page1 = await getUnifiedReviews('prod-frame-001', { limit: 2, offset: 0 });
    const page2 = await getUnifiedReviews('prod-frame-001', { limit: 2, offset: 2 });
    expect(page1.reviews).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page2.reviews).toHaveLength(2);
  });

  it('returns hasMore=false when no more', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { limit: 50 });
    expect(result.hasMore).toBe(false);
  });

  it('returns empty for invalid productId', async () => {
    const result = await getUnifiedReviews('');
    expect(result.reviews).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('includes owner response for text reviews', async () => {
    const result = await getUnifiedReviews('prod-frame-001', { sort: 'helpful' });
    const withResponse = result.reviews.find(r => r.ownerResponse);
    expect(withResponse).toBeDefined();
    expect(withResponse.ownerResponse).toBe('Thank you!');
  });

  it('marks featured photo reviews', async () => {
    const result = await getUnifiedReviews('prod-frame-001');
    const featured = result.reviews.find(r => r.featured);
    expect(featured).toBeDefined();
    expect(featured.type).toBe('photo');
  });
});

// ── getReviewHighlights ─────────────────────────────────────────────

describe('getReviewHighlights', () => {
  it('returns top text review by helpful count', async () => {
    const highlights = await getReviewHighlights('prod-frame-001');
    expect(highlights.topReview).not.toBeNull();
    expect(highlights.topReview.authorName).toBe('Jane S.');
    expect(highlights.topReview.rating).toBe(5);
  });

  it('returns top photo review', async () => {
    const highlights = await getReviewHighlights('prod-frame-001');
    expect(highlights.topPhoto).not.toBeNull();
    expect(highlights.topPhoto.photoUrl).toBeDefined();
  });

  it('includes average rating and count', async () => {
    const highlights = await getReviewHighlights('prod-frame-001');
    expect(highlights.averageRating).toBe(4);
    expect(highlights.reviewCount).toBe(5);
  });

  it('truncates review body to 150 chars', async () => {
    const highlights = await getReviewHighlights('prod-frame-001');
    expect(highlights.topReview.body.length).toBeLessThanOrEqual(150);
  });

  it('returns nulls for product with no reviews', async () => {
    const highlights = await getReviewHighlights('prod-no-reviews');
    expect(highlights.topReview).toBeNull();
    expect(highlights.topPhoto).toBeNull();
    expect(highlights.averageRating).toBe(0);
  });

  it('returns nulls for invalid productId', async () => {
    const highlights = await getReviewHighlights('');
    expect(highlights.topReview).toBeNull();
    expect(highlights.topPhoto).toBeNull();
  });
});

// ── getBatchReviewSummaries ─────────────────────────────────────────

describe('getBatchReviewSummaries', () => {
  it('returns summaries for multiple products', async () => {
    const summaries = await getBatchReviewSummaries(['prod-frame-001', 'prod-matt-001']);
    expect(summaries['prod-frame-001']).toBeDefined();
    expect(summaries['prod-matt-001']).toBeDefined();
    expect(summaries['prod-frame-001'].totalReviews).toBe(5);
    expect(summaries['prod-matt-001'].totalReviews).toBe(2);
  });

  it('calculates average per product', async () => {
    const summaries = await getBatchReviewSummaries(['prod-frame-001']);
    expect(summaries['prod-frame-001'].averageRating).toBe(4);
  });

  it('returns empty for empty array', async () => {
    const summaries = await getBatchReviewSummaries([]);
    expect(summaries).toEqual({});
  });

  it('returns empty for null input', async () => {
    const summaries = await getBatchReviewSummaries(null);
    expect(summaries).toEqual({});
  });

  it('returns zeros for product with no reviews', async () => {
    const summaries = await getBatchReviewSummaries(['prod-no-reviews']);
    expect(summaries['prod-no-reviews'].totalReviews).toBe(0);
    expect(summaries['prod-no-reviews'].averageRating).toBe(0);
  });

  it('filters invalid product IDs', async () => {
    const summaries = await getBatchReviewSummaries(['prod-frame-001', '']);
    expect(Object.keys(summaries)).toHaveLength(1);
  });
});

// ── getModerationQueue ──────────────────────────────────────────────

describe('getModerationQueue', () => {
  it('returns combined pending text and photo reviews', async () => {
    const queue = await getModerationQueue();
    // rev-4 (pending text) + pr-3 (pending photo) = 2
    expect(queue.total).toBe(2);
    expect(queue.reviews).toHaveLength(2);
  });

  it('includes type field for each review', async () => {
    const queue = await getModerationQueue();
    const types = queue.reviews.map(r => r.type);
    expect(types).toContain('text');
    expect(types).toContain('photo');
  });

  it('sorts by date descending', async () => {
    const queue = await getModerationQueue();
    for (let i = 1; i < queue.reviews.length; i++) {
      const prev = queue.reviews[i - 1].date ? new Date(queue.reviews[i - 1].date).getTime() : 0;
      const curr = queue.reviews[i].date ? new Date(queue.reviews[i].date).getTime() : 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('respects limit', async () => {
    const queue = await getModerationQueue(1);
    expect(queue.reviews).toHaveLength(1);
  });

  it('returns empty when no pending reviews', async () => {
    __seed('Reviews', textReviews.filter(r => r.status !== 'pending'));
    __seed('PhotoReviews', photoReviews.filter(r => r.status !== 'pending'));
    const queue = await getModerationQueue();
    expect(queue.total).toBe(0);
    expect(queue.reviews).toEqual([]);
  });

  it('includes photo URL for photo reviews', async () => {
    const queue = await getModerationQueue();
    const photoReview = queue.reviews.find(r => r.type === 'photo');
    expect(photoReview.photos.length).toBeGreaterThan(0);
  });
});
