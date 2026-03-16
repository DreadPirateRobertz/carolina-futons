import { describe, it, expect, beforeEach, vi } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

// ── Module imports ──────────────────────────────────────────────────

import {
  getReviewSummary,
  getUnifiedReviews,
  getReviewHighlights,
  getBatchReviewSummaries,
  getModerationQueue,
} from '../src/backend/productReviews.web.js';

import {
  submitPhotoReview,
  getPhotoReviews,
  moderatePhotoReview,
  getPhotoGallery,
  getPhotoReviewStats,
} from '../src/backend/photoReviews.web.js';

import {
  submitTestimonial,
  getFeaturedTestimonials,
  getTestimonialsByCategory,
  getMyTestimonials,
  getTestimonialSchema,
  updateTestimonialStatus,
  getPendingTestimonials,
  isFlaggedContent,
} from '../src/backend/testimonialService.web.js';

import {
  getProductReviews,
  getAggregateRating,
  submitReview,
  markHelpful,
  flagReview,
  getPendingReviews,
  moderateReview,
  getReviewStats,
  addOwnerResponse,
  getCategoryReviewSummaries,
} from '../src/backend/reviewsService.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const ADMIN_MEMBER = { _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' };
const MEMBER_A = { _id: 'member-a', loginEmail: 'a@example.com', contactDetails: { firstName: 'Alice', lastName: 'Smith' } };

function seedPhotoReviews(items) { __seed('PhotoReviews', items); }
function seedReviews(items) { __seed('Reviews', items); }
function seedTestimonials(items) { __seed('Testimonials', items); }
function seedOrders(items) { __seed('Stores/Orders', items); }

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(ADMIN_MEMBER);
});

// ═══════════════════════════════════════════════════════════════════
// 1. PHOTO REVIEW MODERATION WORKFLOW
// ═══════════════════════════════════════════════════════════════════

describe('photoReviews moderation workflow', () => {
  const pendingReview = {
    _id: 'pr-001', productId: 'prod-1', memberId: 'member-x',
    reviewText: 'Great futon!', rating: 5, photoUrl: 'https://img/1.jpg',
    status: 'pending', submittedAt: new Date('2026-03-01'),
    helpfulCount: 0, reportCount: 0, photoCaption: '',
  };

  it('approves a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('approved');
  });

  it('rejects a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'reject');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('rejected');
  });

  it('features a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('featured');
  });

  it('features an already-approved review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('approved');
    expect(result.newStatus).toBe('featured');
  });

  it('blocks approving an already-approved review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('approved');
  });

  it('blocks featuring a rejected review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'rejected' }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('allows re-queuing a rejected review (reject → pending not exposed, but approve blocked)', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'rejected' }]);
    // Can't directly approve a rejected review — must go through pending first
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid action', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid action');
  });

  it('rejects an invalid review ID', async () => {
    const result = await moderatePhotoReview('', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid review ID');
  });

  it('returns error for non-existent review', async () => {
    const result = await moderatePhotoReview('nonexistent', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('can demote featured back to approved', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'featured' }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('featured');
    expect(result.newStatus).toBe('approved');
  });

  it('can reject a featured review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'featured' }]);
    const result = await moderatePhotoReview('pr-001', 'reject');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. TEXT REVIEW MODERATION WORKFLOW
// ═══════════════════════════════════════════════════════════════════

describe('reviewsService moderation workflow', () => {
  const pendingReview = {
    _id: 'rev-100', productId: 'prod-1', memberId: 'member-x',
    authorName: 'Test U.', rating: 4, title: 'Good',
    body: 'Solid product, well made.', photos: [],
    verifiedPurchase: false, helpful: 0, status: 'pending',
    _createdDate: new Date('2026-03-01'),
  };

  it('approves a pending review', async () => {
    seedReviews([{ ...pendingReview }]);
    const result = await moderateReview('rev-100', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('approved');
  });

  it('rejects a pending review', async () => {
    seedReviews([{ ...pendingReview }]);
    const result = await moderateReview('rev-100', 'reject');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('rejected');
  });

  it('blocks re-approving an already-approved review', async () => {
    seedReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderateReview('rev-100', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('approved');
  });

  it('allows rejecting an approved review', async () => {
    seedReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderateReview('rev-100', 'reject');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('approved');
    expect(result.newStatus).toBe('rejected');
  });

  it('blocks approving an already-rejected review', async () => {
    seedReviews([{ ...pendingReview, status: 'rejected' }]);
    const result = await moderateReview('rev-100', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('blocks re-rejecting a rejected review', async () => {
    seedReviews([{ ...pendingReview, status: 'rejected' }]);
    const result = await moderateReview('rev-100', 'reject');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('rejects invalid action', async () => {
    seedReviews([{ ...pendingReview }]);
    const result = await moderateReview('rev-100', 'feature');
    expect(result.success).toBe(false);
    expect(result.error).toContain('approve');
  });

  it('rejects invalid review ID', async () => {
    const result = await moderateReview('', 'approve');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent review', async () => {
    const result = await moderateReview('nonexistent', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. RATING AGGREGATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('getAggregateRating edge cases', () => {
  it('returns zeros for product with no reviews', async () => {
    const result = await getAggregateRating('prod-empty');
    expect(result.average).toBe(0);
    expect(result.total).toBe(0);
    expect(result.breakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  });

  it('handles all same rating (all 5s)', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: 5, status: 'approved' },
      { _id: 'r3', productId: 'prod-1', rating: 5, status: 'approved' },
    ]);
    const result = await getAggregateRating('prod-1');
    expect(result.average).toBe(5);
    expect(result.total).toBe(3);
    expect(result.breakdown[5]).toBe(3);
    expect(result.breakdown[4]).toBe(0);
  });

  it('handles all same rating (all 1s)', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 1, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: 1, status: 'approved' },
    ]);
    const result = await getAggregateRating('prod-1');
    expect(result.average).toBe(1);
    expect(result.total).toBe(2);
    expect(result.breakdown[1]).toBe(2);
  });

  it('skips reviews with NaN/undefined ratings', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: undefined, status: 'approved' },
      { _id: 'r3', productId: 'prod-1', rating: null, status: 'approved' },
      { _id: 'r4', productId: 'prod-1', rating: 'not-a-number', status: 'approved' },
      { _id: 'r5', productId: 'prod-1', rating: 3, status: 'approved' },
    ]);
    const result = await getAggregateRating('prod-1');
    expect(result.average).toBe(4); // (5+3)/2 = 4.0
    expect(result.total).toBe(2);
    expect(result.breakdown[5]).toBe(1);
    expect(result.breakdown[3]).toBe(1);
  });

  it('excludes non-approved reviews', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: 1, status: 'pending' },
      { _id: 'r3', productId: 'prod-1', rating: 1, status: 'rejected' },
    ]);
    const result = await getAggregateRating('prod-1');
    expect(result.average).toBe(5);
    expect(result.total).toBe(1);
  });

  it('clamps out-of-range ratings to 1-5', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-1', rating: 10, status: 'approved' },
      { _id: 'r2', productId: 'prod-1', rating: -3, status: 'approved' },
      { _id: 'r3', productId: 'prod-1', rating: 0, status: 'approved' },
    ]);
    const result = await getAggregateRating('prod-1');
    expect(result.breakdown[5]).toBe(1); // 10 clamped to 5
    expect(result.breakdown[1]).toBe(2); // -3 and 0 clamped to 1
  });

  it('returns zeros for invalid product ID', async () => {
    const result = await getAggregateRating('');
    expect(result.average).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. COMBINED REVIEW SUMMARY (productReviews) NaN HARDENING
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
    expect(result.totalReviews).toBe(2); // only 2 valid ratings
    expect(result.averageRating).toBe(4.5); // (4+5)/2
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
    // 2 out of 3 ratings >= 4
    expect(result.recommendRate).toBe(67);
    expect(result.totalReviews).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. BATCH REVIEW SUMMARIES NaN HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('getCategoryReviewSummaries NaN hardening', () => {
  it('skips NaN ratings in batch summaries', async () => {
    seedReviews([
      { _id: 'r1', productId: 'prod-a', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-a', rating: undefined, status: 'approved' },
      { _id: 'r3', productId: 'prod-b', rating: 3, status: 'approved' },
    ]);
    const result = await getCategoryReviewSummaries(['prod-a', 'prod-b']);
    expect(result['prod-a'].total).toBe(1);
    expect(result['prod-a'].average).toBe(5);
    expect(result['prod-b'].total).toBe(1);
    expect(result['prod-b'].average).toBe(3);
  });

  it('returns empty map for empty array', async () => {
    const result = await getCategoryReviewSummaries([]);
    expect(result).toEqual({});
  });

  it('returns zeros for products with no reviews', async () => {
    const result = await getCategoryReviewSummaries(['prod-none']);
    expect(result['prod-none']).toEqual({ average: 0, total: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. FEATURED TESTIMONIAL ROTATION
// ═══════════════════════════════════════════════════════════════════

describe('getFeaturedTestimonials rotation', () => {
  it('returns all items when pool is smaller than limit', async () => {
    seedTestimonials([
      { _id: 't1', status: 'featured', approvedAt: new Date('2026-03-01'), name: 'A', story: 'Great', rating: 5 },
      { _id: 't2', status: 'featured', approvedAt: new Date('2026-03-02'), name: 'B', story: 'Awesome', rating: 5 },
    ]);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('returns exactly limit items from a larger pool', async () => {
    const testimonials = Array.from({ length: 15 }, (_, i) => ({
      _id: `t-${i}`,
      status: 'featured',
      approvedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      name: `Person ${i}`,
      story: `Testimonial ${i}`,
      rating: 5,
    }));
    seedTestimonials(testimonials);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(6);
  });

  it('handles limit of 1', async () => {
    const testimonials = Array.from({ length: 5 }, (_, i) => ({
      _id: `t-${i}`,
      status: 'featured',
      approvedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      name: `Person ${i}`,
      story: `Testimonial ${i}`,
      rating: 5,
    }));
    seedTestimonials(testimonials);
    const result = await getFeaturedTestimonials(1);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('excludes non-featured testimonials', async () => {
    seedTestimonials([
      { _id: 't1', status: 'featured', approvedAt: new Date(), name: 'A', story: 'Great', rating: 5 },
      { _id: 't2', status: 'approved', approvedAt: new Date(), name: 'B', story: 'Also great', rating: 5 },
      { _id: 't3', status: 'pending', name: 'C', story: 'Pending', rating: 4 },
    ]);
    const result = await getFeaturedTestimonials(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]._id).toBe('t1');
  });

  it('returns empty array when no featured testimonials exist', async () => {
    seedTestimonials([
      { _id: 't1', status: 'approved', approvedAt: new Date(), name: 'A', story: 'Great', rating: 5 },
    ]);
    const result = await getFeaturedTestimonials(6);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. TESTIMONIAL STATUS UPDATE HARDENING
// ═══════════════════════════════════════════════════════════════════

describe('updateTestimonialStatus hardening', () => {
  const baseTestimonial = {
    _id: 'test-001', memberId: 'member-1', name: 'Jane',
    story: 'Wonderful product experience!', rating: 5,
    status: 'pending', featured: false,
    submittedAt: new Date('2026-03-01'),
  };

  it('approves a pending testimonial', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'approved');
    expect(result.success).toBe(true);
  });

  it('features a testimonial and sets featured flag', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'featured');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'deleted');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('rejects empty testimonial ID', async () => {
    const result = await updateTestimonialStatus('', 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects null testimonial ID', async () => {
    const result = await updateTestimonialStatus(null, 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects XSS in ID', async () => {
    const result = await updateTestimonialStatus('<script>alert(1)</script>', 'approved');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent testimonial', async () => {
    const result = await updateTestimonialStatus('nonexistent', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sets approvedAt when approving', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    await updateTestimonialStatus('test-001', 'approved');
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.approvedAt).toBeInstanceOf(Date);
    expect(updated.status).toBe('approved');
  });

  it('sets approvedAt when featuring', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    await updateTestimonialStatus('test-001', 'featured');
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.approvedAt).toBeInstanceOf(Date);
    expect(updated.featured).toBe(true);
  });

  it('flags a testimonial', async () => {
    seedTestimonials([{ ...baseTestimonial }]);
    const result = await updateTestimonialStatus('test-001', 'flagged');
    expect(result.success).toBe(true);
    const updated = await wixData.get('Testimonials', 'test-001');
    expect(updated.status).toBe('flagged');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. UNIFIED REVIEWS FEED
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
    expect(result.reviews[0]._id).toBe('r2'); // Mar 15
    expect(result.reviews[1]._id).toBe('pr1'); // Mar 12
    expect(result.reviews[2]._id).toBe('r1'); // Mar 10
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
    expect(result.reviews[0].photos.length).toBe(2); // r1 has 2 photos
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
// 9. REVIEW HIGHLIGHTS
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
// 10. MODERATION QUEUE
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
    expect(result.reviews[0]._id).toBe('pr1'); // newer
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
// 11. PHOTO REVIEW STATS
// ═══════════════════════════════════════════════════════════════════

describe('getPhotoReviewStats edge cases', () => {
  it('returns zeros for product with no photo reviews', async () => {
    const result = await getPhotoReviewStats('prod-empty');
    expect(result.success).toBe(true);
    expect(result.stats.totalReviews).toBe(0);
    expect(result.stats.averageRating).toBe(0);
  });

  it('counts featured reviews separately', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 5, status: 'featured', photoUrl: 'img1.jpg' },
      { _id: 'pr2', productId: 'prod-1', rating: 4, status: 'approved', photoUrl: 'img2.jpg' },
      { _id: 'pr3', productId: 'prod-1', rating: 3, status: 'approved', photoUrl: 'img3.jpg' },
    ]);
    const result = await getPhotoReviewStats('prod-1');
    expect(result.stats.featuredCount).toBe(1);
    expect(result.stats.totalReviews).toBe(3);
  });

  it('excludes rejected/pending from stats', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 5, status: 'approved', photoUrl: 'img.jpg' },
      { _id: 'pr2', productId: 'prod-1', rating: 1, status: 'rejected', photoUrl: 'bad.jpg' },
      { _id: 'pr3', productId: 'prod-1', rating: 2, status: 'pending', photoUrl: 'new.jpg' },
    ]);
    const result = await getPhotoReviewStats('prod-1');
    expect(result.stats.totalReviews).toBe(1);
    expect(result.stats.averageRating).toBe(5);
  });

  it('rejects invalid product ID', async () => {
    const result = await getPhotoReviewStats('');
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════════

describe('getPhotoGallery', () => {
  it('returns approved and featured photos', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', productName: 'Futon A', productCategory: 'frames',
        rating: 5, status: 'featured', photoUrl: 'img1.jpg', reviewText: 'Amazing!',
        submittedAt: new Date('2026-03-15') },
      { _id: 'pr2', productId: 'prod-2', productName: 'Futon B', productCategory: 'frames',
        rating: 4, status: 'approved', photoUrl: 'img2.jpg', reviewText: 'Good',
        submittedAt: new Date('2026-03-10') },
      { _id: 'pr3', productId: 'prod-3', productName: 'Futon C', productCategory: 'frames',
        rating: 2, status: 'rejected', photoUrl: 'bad.jpg', reviewText: 'No',
        submittedAt: new Date('2026-03-12') },
    ]);
    const result = await getPhotoGallery();
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2);
    expect(result.photos[0].featured).toBe(true);
  });

  it('filters by category', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', productCategory: 'frames', rating: 5,
        status: 'approved', photoUrl: 'img1.jpg', submittedAt: new Date() },
      { _id: 'pr2', productId: 'prod-2', productCategory: 'mattresses', rating: 4,
        status: 'approved', photoUrl: 'img2.jpg', submittedAt: new Date() },
    ]);
    const result = await getPhotoGallery('frames');
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].productId).toBe('prod-1');
  });

  it('truncates review text to 100 chars', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 5, status: 'approved',
        photoUrl: 'img.jpg', reviewText: 'X'.repeat(200), submittedAt: new Date() },
    ]);
    const result = await getPhotoGallery();
    expect(result.photos[0].reviewText.length).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. TESTIMONIAL SCHEMA (JSON-LD)
// ═══════════════════════════════════════════════════════════════════

describe('getTestimonialSchema', () => {
  it('returns valid JSON-LD for approved testimonials', async () => {
    seedTestimonials([
      { _id: 't1', status: 'approved', name: 'Alice', story: 'Love it!',
        rating: 5, approvedAt: new Date('2026-03-01') },
      { _id: 't2', status: 'featured', name: 'Bob', story: 'Best purchase!',
        rating: 4, approvedAt: new Date('2026-03-02') },
    ]);
    const schema = await getTestimonialSchema();
    expect(schema).toBeTruthy();
    const parsed = JSON.parse(schema);
    expect(parsed['@type']).toBe('LocalBusiness');
    expect(parsed.aggregateRating.ratingValue).toBe('4.5');
    expect(parsed.review).toHaveLength(2);
  });

  it('returns empty string when no testimonials', async () => {
    const schema = await getTestimonialSchema();
    expect(schema).toBe('');
  });

  it('limits reviews in schema to 10', async () => {
    const testimonials = Array.from({ length: 20 }, (_, i) => ({
      _id: `t-${i}`, status: 'approved', name: `Person ${i}`,
      story: `Story ${i}`, rating: 5, approvedAt: new Date(),
    }));
    seedTestimonials(testimonials);
    const schema = await getTestimonialSchema();
    const parsed = JSON.parse(schema);
    expect(parsed.review).toHaveLength(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 14. FLAGGED CONTENT DETECTION
// ═══════════════════════════════════════════════════════════════════

describe('isFlaggedContent', () => {
  it('flags spam keywords', () => {
    expect(isFlaggedContent('This is a spam review')).toBe(true);
    expect(isFlaggedContent('Visit my casino site')).toBe(true);
    expect(isFlaggedContent('Buy cheap viagra here')).toBe(true);
  });

  it('flags URLs', () => {
    expect(isFlaggedContent('Check out https://evil.com')).toBe(true);
    expect(isFlaggedContent('Visit http://spam.net')).toBe(true);
  });

  it('flags long digit sequences (phone spam)', () => {
    expect(isFlaggedContent('Call me at 1234567890')).toBe(true);
  });

  it('allows legitimate content', () => {
    expect(isFlaggedContent('Amazing futon, love the quality!')).toBe(false);
    expect(isFlaggedContent('Best furniture purchase ever')).toBe(false);
  });

  it('handles null/empty input', () => {
    expect(isFlaggedContent(null)).toBe(false);
    expect(isFlaggedContent('')).toBe(false);
    expect(isFlaggedContent(undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 15. BATCH REVIEW SUMMARIES (productReviews)
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
    // Should not crash, returns map for up to 50
    expect(Object.keys(result).length).toBeLessThanOrEqual(50);
  });
});
