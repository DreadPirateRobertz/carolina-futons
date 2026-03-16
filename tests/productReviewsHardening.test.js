import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  getReviewSummary,
  getUnifiedReviews,
  getReviewHighlights,
  getBatchReviewSummaries,
  getModerationQueue,
} from '../src/backend/productReviews.web.js';

const ADMIN_MEMBER = { _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' };

function seedPhotoReviews(items) { __seed('PhotoReviews', items); }
function seedReviews(items) { __seed('Reviews', items); }

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(ADMIN_MEMBER);
});

// ═══════════════════════════════════════════════════════════════════
// 1. COMBINED REVIEW SUMMARY NaN HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('getReviewSummary NaN hardening', () => {
  it('returns zeros when all reviews have NaN ratings', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: undefined, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: null, status: 'approved' },
    ]);
    seedPhotoReviews([]);
    const result = await getReviewSummary('prod-1');
    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('skips NaN ratings in mixed set', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 4, status: 'approved', photos: [] },
      { _id: 'r2', productId: 'prod-1', rating: undefined, status: 'approved', photos: [] },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 5, status: 'approved', photoUrl: 'img.jpg' },
    ]);
    const result = await getReviewSummary('prod-1');
    expect(result.totalReviews).toBe(2);
    expect(result.averageRating).toBe(4.5);
    expect(result.totalPhotos).toBe(1);
  });

  it('returns zeros for empty product ID', async () => {
    const result = await getReviewSummary('');
    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('returns correct recommend rate', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved', photos: [] },
      { _id: 'r2', productId: 'prod-1', rating: 4, status: 'approved', photos: [] },
      { _id: 'r3', productId: 'prod-1', rating: 2, status: 'approved', photos: [] },
    ]);
    seedPhotoReviews([]);
    const result = await getReviewSummary('prod-1');
    expect(result.recommendRate).toBe(67);
    expect(result.totalReviews).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. UNIFIED REVIEWS FEED
// ═══════════════════════════════════════════════════════════════════

describe('getUnifiedReviews sorting and pagination', () => {
  beforeEach(() => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved', authorName: 'A',
        body: 'Excellent!', title: 'Love it', photos: ['img1.jpg', 'img2.jpg'],
        verifiedPurchase: true, helpful: 10, _createdDate: new Date('2026-03-10') },
      { _id: 'r2', productId: 'prod-1', rating: 3, status: 'approved', authorName: 'B',
        body: 'OK product', title: 'Decent', photos: [],
        verifiedPurchase: false, helpful: 2, _createdDate: new Date('2026-03-15') },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 4, status: 'approved',
        reviewText: 'Nice!', photoUrl: 'photo.jpg', photoCaption: 'My futon',
        helpfulCount: 5, submittedAt: new Date('2026-03-12') },
    ]);
  });

  it('returns unified feed sorted by newest', async () => {
    const result = await getUnifiedReviews('prod-1', { sort: 'newest' });
    expect(result.reviews).toHaveLength(3);
    expect(result.reviews[0]._id).toBe('r2');
    expect(result.reviews[1]._id).toBe('pr1');
    expect(result.reviews[2]._id).toBe('r1');
  });

  it('sorts by highest rating', async () => {
    const result = await getUnifiedReviews('prod-1', { sort: 'highest' });
    expect(result.reviews[0].rating).toBe(5);
    expect(result.reviews[2].rating).toBe(3);
  });

  it('sorts by lowest rating', async () => {
    const result = await getUnifiedReviews('prod-1', { sort: 'lowest' });
    expect(result.reviews[0].rating).toBe(3);
  });

  it('sorts by helpful', async () => {
    const result = await getUnifiedReviews('prod-1', { sort: 'helpful' });
    expect(result.reviews[0].helpful).toBe(10);
  });

  it('sorts by photos count', async () => {
    const result = await getUnifiedReviews('prod-1', { sort: 'photos' });
    expect(result.reviews[0].photos.length).toBe(2);
  });

  it('paginates correctly', async () => {
    const page1 = await getUnifiedReviews('prod-1', { limit: 2, offset: 0 });
    expect(page1.reviews).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(3);

    const page2 = await getUnifiedReviews('prod-1', { limit: 2, offset: 2 });
    expect(page2.reviews).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });

  it('filters by star rating', async () => {
    const result = await getUnifiedReviews('prod-1', { filterStars: 5 });
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].rating).toBe(5);
  });

  it('returns empty for invalid product ID', async () => {
    const result = await getUnifiedReviews('');
    expect(result.reviews).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('clamps limit to max 50', async () => {
    const result = await getUnifiedReviews('prod-1', { limit: 100 });
    expect(result.reviews.length).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. REVIEW HIGHLIGHTS
// ═══════════════════════════════════════════════════════════════════

describe('getReviewHighlights', () => {
  it('returns top review and photo for a product', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved',
        authorName: 'Top R.', title: 'Best futon', body: 'Incredible quality and comfort.',
        verifiedPurchase: true, helpful: 20, photos: [], _createdDate: new Date() },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 4, status: 'featured',
        photoUrl: 'top-photo.jpg', reviewText: 'Beautiful!', helpfulCount: 15,
        submittedAt: new Date() },
    ]);
    const result = await getReviewHighlights('prod-1');
    expect(result.topReview).not.toBeNull();
    expect(result.topReview.authorName).toBe('Top R.');
    expect(result.topPhoto).not.toBeNull();
    expect(result.topPhoto.photoUrl).toBe('top-photo.jpg');
    expect(result.averageRating).toBeGreaterThan(0);
  });

  it('returns nulls when no reviews exist', async () => {
    const result = await getReviewHighlights('prod-empty');
    expect(result.topReview).toBeNull();
    expect(result.topPhoto).toBeNull();
    expect(result.averageRating).toBe(0);
  });

  it('returns null for empty product ID', async () => {
    const result = await getReviewHighlights('');
    expect(result.topReview).toBeNull();
  });

  it('truncates review body to 150 chars', async () => {
    const longBody = 'A'.repeat(300);
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved',
        authorName: 'Long', title: 'Review', body: longBody,
        verifiedPurchase: false, helpful: 1, photos: [], _createdDate: new Date() },
    ]);
    seedPhotoReviews([]);
    const result = await getReviewHighlights('prod-1');
    expect(result.topReview.body.length).toBe(150);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. MODERATION QUEUE
// ═══════════════════════════════════════════════════════════════════

describe('getModerationQueue', () => {
  it('combines text and photo pending reviews', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', status: 'pending', rating: 4,
        authorName: 'A', body: 'Good', _createdDate: new Date('2026-03-10') },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', status: 'pending', rating: 5,
        reviewText: 'Great!', photoUrl: 'img.jpg', submittedAt: new Date('2026-03-12') },
    ]);
    const result = await getModerationQueue();
    expect(result.reviews).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('excludes non-pending reviews', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', status: 'approved', rating: 4 },
      { _id: 'r2', productId: 'prod-1', status: 'pending', rating: 3,
        authorName: 'B', body: 'Meh', _createdDate: new Date() },
    ]);
    seedPhotoReviews([]);
    const result = await getModerationQueue();
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]._id).toBe('r2');
  });

  it('sorts combined queue by date descending', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', status: 'pending', rating: 4,
        _createdDate: new Date('2026-03-01') },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', status: 'pending', rating: 5,
        submittedAt: new Date('2026-03-15') },
    ]);
    const result = await getModerationQueue();
    expect(result.reviews[0]._id).toBe('pr1');
    expect(result.reviews[1]._id).toBe('r1');
  });

  it('respects limit parameter', async () => {
    seedReviews(
      Array.from({ length: 5 }, (_, i) => ({
        _id: `r${i}`, productId: 'prod-1', status: 'pending', rating: 3,
        _createdDate: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      }))
    );
    seedPhotoReviews([]);
    const result = await getModerationQueue(2);
    expect(result.reviews.length).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. BATCH REVIEW SUMMARIES + NaN HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('getBatchReviewSummaries', () => {
  it('returns summaries for multiple products', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-a', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-a', rating: 4, status: 'approved' },
      { _id: 'r3', productId: 'prod-b', rating: 3, status: 'approved' },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-a', rating: 5, status: 'approved' },
    ]);
    const result = await getBatchReviewSummaries(['prod-a', 'prod-b']);
    expect(result['prod-a'].totalReviews).toBe(3);
    expect(result['prod-b'].totalReviews).toBe(1);
  });

  it('returns empty for empty input', async () => {
    expect(await getBatchReviewSummaries([])).toEqual({});
    expect(await getBatchReviewSummaries(null)).toEqual({});
  });

  it('limits to 50 product IDs', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    const result = await getBatchReviewSummaries(ids);
    expect(Object.keys(result).length).toBeLessThanOrEqual(50);
  });

  it('skips NaN/null ratings in batch summaries', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-a', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-a', rating: undefined, status: 'approved' },
      { _id: 'r3', productId: 'prod-a', rating: null, status: 'approved' },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-a', rating: 4, status: 'approved' },
      { _id: 'pr2', productId: 'prod-a', rating: NaN, status: 'approved' },
    ]);
    const result = await getBatchReviewSummaries(['prod-a']);
    expect(result['prod-a'].totalReviews).toBe(2); // only 5 and 4 are valid
    expect(result['prod-a'].averageRating).toBe(4.5);
  });

  it('returns zero average when all batch ratings are invalid', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-a', rating: undefined, status: 'approved' },
    ]);
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-a', rating: null, status: 'approved' },
    ]);
    const result = await getBatchReviewSummaries(['prod-a']);
    expect(result['prod-a'].totalReviews).toBe(0);
    expect(result['prod-a'].averageRating).toBe(0);
  });
});
