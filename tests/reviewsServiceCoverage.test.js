/**
 * reviewsServiceCoverage.test.js
 *
 * Focused v8 coverage tests for reviewsService.web.js.
 * Exercises every exported function and internal helper path to ensure
 * v8 traces through all function bodies (addressing webMethod wrapper artifacts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

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

// ── Fixtures ────────────────────────────────────────────────────────

const NOW = new Date('2026-03-10T12:00:00Z');

const approvedReviews = [
  {
    _id: 'r1', productId: 'p1', memberId: 'm1', authorName: 'Alice B.',
    rating: 5, title: 'Love it', body: 'Great quality futon, very comfortable.',
    photos: ['https://img.example.com/1.jpg'], verifiedPurchase: true,
    helpful: 10, status: 'approved', _createdDate: new Date('2026-03-01'),
  },
  {
    _id: 'r2', productId: 'p1', memberId: 'm2', authorName: 'Bob C.',
    rating: 3, title: 'Okay', body: 'Decent build but assembly was hard.',
    photos: [], verifiedPurchase: false,
    helpful: 2, status: 'approved', _createdDate: new Date('2026-02-20'),
  },
  {
    _id: 'r3', productId: 'p1', memberId: 'm3', authorName: 'Carol D.',
    rating: 1, title: 'Disappointed', body: 'Arrived damaged, waiting on replacement.',
    photos: [], verifiedPurchase: true,
    helpful: 0, status: 'approved', _createdDate: new Date('2026-02-15'),
  },
  {
    _id: 'r4', productId: 'p2', memberId: 'm4', authorName: 'Dave E.',
    rating: 4, title: 'Solid', body: 'Really nice frame, good finish overall.',
    photos: ['https://img.example.com/2.jpg'], verifiedPurchase: true,
    helpful: 5, status: 'approved', _createdDate: new Date('2026-03-05'),
  },
  {
    _id: 'r5', productId: 'p1', memberId: 'm5', authorName: 'Eve F.',
    rating: 5, title: 'Perfect', body: 'Exactly what I was looking for in a futon.',
    photos: [], verifiedPurchase: false,
    helpful: 7, status: 'approved', _createdDate: new Date('2026-03-08'),
  },
];

const pendingReview = {
  _id: 'r-pend', productId: 'p1', memberId: 'm6', authorName: 'Frank G.',
  rating: 4, title: 'Pending', body: 'Good futon, waiting for moderation.',
  photos: [], verifiedPurchase: false,
  helpful: 0, status: 'pending', _createdDate: new Date('2026-03-09'),
};

const rejectedReview = {
  _id: 'r-rej', productId: 'p1', memberId: 'm7', authorName: 'Grace H.',
  rating: 2, title: 'Rejected', body: 'This review was rejected for spam content.',
  photos: [], verifiedPurchase: false,
  helpful: 0, status: 'rejected', _createdDate: new Date('2026-03-07'),
};

function seedAll() {
  __seed('Reviews', [...approvedReviews, pendingReview, rejectedReview]);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('reviewsService — v8 coverage', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    seedAll();
  });

  // ── getProductReviews ─────────────────────────────────────────────

  describe('getProductReviews', () => {
    it('returns approved reviews with default sort (newest)', async () => {
      const res = await getProductReviews('p1');
      expect(res.reviews).toBeInstanceOf(Array);
      expect(res.total).toBeGreaterThan(0);
      expect(res.page).toBe(0);
      expect(res.pageSize).toBe(10);
      // All returned reviews should be formatted (no status field)
      for (const r of res.reviews) {
        expect(r).toHaveProperty('authorName');
        expect(r).toHaveProperty('date');
        expect(r).not.toHaveProperty('status');
        expect(r).not.toHaveProperty('memberId');
      }
    });

    it('sorts by highest rating', async () => {
      const res = await getProductReviews('p1', { sort: 'highest' });
      expect(res.reviews.length).toBeGreaterThan(0);
      // First review should have highest rating
      expect(res.reviews[0].rating).toBe(5);
    });

    it('sorts by lowest rating', async () => {
      const res = await getProductReviews('p1', { sort: 'lowest' });
      expect(res.reviews.length).toBeGreaterThan(0);
      expect(res.reviews[0].rating).toBe(1);
    });

    it('sorts by helpful count', async () => {
      const res = await getProductReviews('p1', { sort: 'helpful' });
      expect(res.reviews.length).toBeGreaterThan(0);
      expect(res.reviews[0].helpful).toBe(10);
    });

    it('filters by star rating', async () => {
      const res = await getProductReviews('p1', { filterStars: 5 });
      for (const r of res.reviews) {
        expect(r.rating).toBe(5);
      }
    });

    it('returns empty for invalid productId', async () => {
      const res = await getProductReviews('');
      expect(res.reviews).toEqual([]);
      expect(res.total).toBe(0);
    });

    it('handles pagination with page param', async () => {
      const res = await getProductReviews('p1', { page: 1 });
      expect(res.page).toBe(1);
    });

    it('clamps negative page to 0', async () => {
      const res = await getProductReviews('p1', { page: -5 });
      expect(res.page).toBe(0);
    });
  });

  // ── getAggregateRating ────────────────────────────────────────────

  describe('getAggregateRating', () => {
    it('computes average and breakdown for a product', async () => {
      const res = await getAggregateRating('p1');
      expect(res.total).toBe(4); // 4 approved reviews for p1
      expect(res.average).toBeGreaterThan(0);
      expect(res.breakdown).toHaveProperty('5');
      expect(res.breakdown).toHaveProperty('1');
      // sum: 5+3+1+5 = 14, avg = 14/4 = 3.5
      expect(res.average).toBe(3.5);
      expect(res.breakdown[5]).toBe(2);
      expect(res.breakdown[3]).toBe(1);
      expect(res.breakdown[1]).toBe(1);
    });

    it('returns zeros for invalid product', async () => {
      const res = await getAggregateRating('');
      expect(res.average).toBe(0);
      expect(res.total).toBe(0);
    });

    it('returns zeros for product with no reviews', async () => {
      const res = await getAggregateRating('no-such-product');
      expect(res.average).toBe(0);
      expect(res.total).toBe(0);
    });
  });

  // ── submitReview ──────────────────────────────────────────────────

  describe('submitReview', () => {
    it('submits a review with full member name (firstName + lastName)', async () => {
      __setMember({ _id: 'mx', contactDetails: { firstName: 'John', lastName: 'Doe' } });
      // Seed an order so checkVerifiedPurchase finds it
      __seed('Stores/Orders', [
        { _id: 'ord1', buyerInfo: { id: 'mx' }, lineItems: [{ productId: 'p-new' }] },
      ]);
      const res = await submitReview({
        productId: 'p-new',
        rating: 4,
        title: 'Nice futon',
        body: 'Really solid frame, comfortable cushion material.',
      });
      expect(res.success).toBe(true);
      expect(res.reviewId).toBeTruthy();
    });

    it('builds author name with firstName only', async () => {
      __setMember({ _id: 'my', contactDetails: { firstName: 'Maria' } });
      const res = await submitReview({
        productId: 'p-new2',
        rating: 5,
        title: 'Excellent',
        body: 'Best futon I have ever owned, highly recommend it.',
      });
      expect(res.success).toBe(true);
    });

    it('falls back to "Customer" when no name provided', async () => {
      __setMember({ _id: 'mz', contactDetails: {} });
      const res = await submitReview({
        productId: 'p-new3',
        rating: 3,
        title: 'OK product',
        body: 'Decent quality, nothing spectacular but gets the job done.',
      });
      expect(res.success).toBe(true);
    });

    it('rejects duplicate review for same product and member', async () => {
      __setMember({ _id: 'm1', contactDetails: { firstName: 'Alice', lastName: 'B' } });
      // m1 already has r1 for p1 in seeded data
      const res = await submitReview({
        productId: 'p1',
        rating: 5,
        title: 'Again',
        body: 'Trying to review the same product a second time here.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already reviewed/i);
    });

    it('rejects when no member is logged in', async () => {
      // resetMembers already cleared member
      const res = await submitReview({
        productId: 'p1',
        rating: 5,
        title: 'No auth',
        body: 'Should not work without being logged in to the site.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/log in/i);
    });

    it('rejects invalid rating', async () => {
      __setMember({ _id: 'mx2', contactDetails: { firstName: 'Test' } });
      const res = await submitReview({
        productId: 'p-new4',
        rating: 0,
        title: 'Bad rating',
        body: 'This should fail because rating is out of range.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/rating/i);
    });

    it('rejects body shorter than 10 characters', async () => {
      __setMember({ _id: 'mx3', contactDetails: { firstName: 'Test' } });
      const res = await submitReview({
        productId: 'p-new5',
        rating: 4,
        title: 'Short',
        body: 'Too short',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 10/i);
    });

    it('rejects invalid productId', async () => {
      __setMember({ _id: 'mx4', contactDetails: { firstName: 'Test' } });
      const res = await submitReview({
        productId: '',
        rating: 4,
        title: 'No product',
        body: 'This should fail because the product ID is empty.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid product/i);
    });

    it('sanitizes photos array', async () => {
      __setMember({ _id: 'mx5', contactDetails: { firstName: 'Snap' } });
      const res = await submitReview({
        productId: 'p-photo',
        rating: 5,
        title: 'With photos',
        body: 'Submitting review with multiple photo attachments here.',
        photos: ['https://img/a.jpg', '', 'https://img/b.jpg', null, 'https://img/c.jpg', 'https://img/d.jpg'],
      });
      expect(res.success).toBe(true);
    });

    it('handles checkVerifiedPurchase when no orders exist', async () => {
      __setMember({ _id: 'mx6', contactDetails: { firstName: 'New' } });
      // No Stores/Orders seeded for this member
      const res = await submitReview({
        productId: 'p-noverify',
        rating: 4,
        title: 'Not verified',
        body: 'This review comes from a member who has not purchased.',
      });
      expect(res.success).toBe(true);
    });
  });

  // ── markHelpful ───────────────────────────────────────────────────

  describe('markHelpful', () => {
    it('increments helpful count on approved review', async () => {
      const res = await markHelpful('r2');
      expect(res.success).toBe(true);
      expect(res.helpful).toBe(3); // was 2, now 3
    });

    it('fails for pending review', async () => {
      const res = await markHelpful('r-pend');
      expect(res.success).toBe(false);
    });

    it('fails for invalid review ID', async () => {
      const res = await markHelpful('');
      expect(res.success).toBe(false);
    });

    it('fails for non-existent review', async () => {
      const res = await markHelpful('no-such-review');
      expect(res.success).toBe(false);
    });
  });

  // ── flagReview ────────────────────────────────────────────────────

  describe('flagReview', () => {
    it('flags a review with a valid reason', async () => {
      const res = await flagReview('r1', 'spam');
      expect(res.success).toBe(true);
    });

    it('normalizes unknown reason to "other"', async () => {
      const res = await flagReview('r1', 'nonsense-reason');
      expect(res.success).toBe(true);
    });

    it('flags with each valid reason type', async () => {
      for (const reason of ['spam', 'offensive', 'fake', 'other']) {
        const res = await flagReview('r2', reason);
        expect(res.success).toBe(true);
      }
    });

    it('auto-hides review after 3+ flags', async () => {
      // Flag r1 three times to trigger auto-hide
      await flagReview('r1', 'spam');
      await flagReview('r1', 'fake');
      const res = await flagReview('r1', 'offensive');
      expect(res.success).toBe(true);
      // After 3 flags, review should be set back to pending
      // Verify by trying to markHelpful (which only works on approved)
      const helpful = await markHelpful('r1');
      expect(helpful.success).toBe(false);
    });

    it('returns error for invalid review ID', async () => {
      const res = await flagReview('', 'spam');
      expect(res.success).toBe(false);
    });

    it('returns error for non-existent review', async () => {
      const res = await flagReview('nonexistent', 'spam');
      expect(res.success).toBe(false);
    });
  });

  // ── getPendingReviews ─────────────────────────────────────────────

  describe('getPendingReviews', () => {
    it('returns pending reviews', async () => {
      const res = await getPendingReviews();
      expect(res.success).toBe(true);
      expect(res.reviews.length).toBeGreaterThan(0);
      for (const r of res.reviews) {
        expect(r.status).toBe('pending');
      }
    });

    it('respects limit parameter', async () => {
      const res = await getPendingReviews(1);
      expect(res.success).toBe(true);
      expect(res.reviews.length).toBeLessThanOrEqual(1);
    });

    it('clamps limit to valid range', async () => {
      const res = await getPendingReviews(999);
      expect(res.success).toBe(true);
    });
  });

  // ── moderateReview ────────────────────────────────────────────────

  describe('moderateReview', () => {
    it('approves a pending review', async () => {
      const res = await moderateReview('r-pend', 'approve');
      expect(res.success).toBe(true);
      // Now it should show up in approved queries
      const reviews = await getProductReviews('p1');
      const found = reviews.reviews.find(r => r._id === 'r-pend');
      expect(found).toBeTruthy();
    });

    it('rejects a review', async () => {
      const res = await moderateReview('r-pend', 'reject');
      expect(res.success).toBe(true);
    });

    it('fails for invalid action', async () => {
      const res = await moderateReview('r-pend', 'delete');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/approve.*reject/i);
    });

    it('fails for invalid review ID', async () => {
      const res = await moderateReview('', 'approve');
      expect(res.success).toBe(false);
    });

    it('fails for non-existent review', async () => {
      const res = await moderateReview('no-review', 'approve');
      expect(res.success).toBe(false);
    });
  });

  // ── getReviewStats ────────────────────────────────────────────────

  describe('getReviewStats', () => {
    it('returns stats with default 30-day period', async () => {
      const res = await getReviewStats();
      expect(res.success).toBe(true);
      expect(res.period).toBe('30 days');
      expect(res).toHaveProperty('total');
      expect(res).toHaveProperty('approved');
      expect(res).toHaveProperty('pending');
      expect(res).toHaveProperty('rejected');
      expect(res).toHaveProperty('avgRating');
      expect(res).toHaveProperty('verifiedPurchaseRate');
      expect(res).toHaveProperty('withPhotos');
    });

    it('returns stats with custom period', async () => {
      const res = await getReviewStats(7);
      expect(res.success).toBe(true);
      expect(res.period).toBe('7 days');
    });

    it('clamps days to valid range', async () => {
      const res = await getReviewStats(999);
      expect(res.success).toBe(true);
      expect(res.period).toBe('365 days');
    });

    it('handles period with no reviews', async () => {
      resetData();
      __seed('Reviews', []);
      const res = await getReviewStats(1);
      expect(res.success).toBe(true);
      expect(res.avgRating).toBe(0);
    });
  });

  // ── addOwnerResponse ──────────────────────────────────────────────

  describe('addOwnerResponse', () => {
    it('adds an owner response to a review', async () => {
      const res = await addOwnerResponse('r1', 'Thank you for your wonderful review!');
      expect(res.success).toBe(true);
    });

    it('fails for invalid review ID', async () => {
      const res = await addOwnerResponse('', 'Thanks for feedback!');
      expect(res.success).toBe(false);
    });

    it('fails for response shorter than 5 chars', async () => {
      const res = await addOwnerResponse('r1', 'Thx');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 5/i);
    });

    it('fails for non-existent review', async () => {
      const res = await addOwnerResponse('nope', 'Thank you very much!');
      expect(res.success).toBe(false);
    });
  });

  // ── getCategoryReviewSummaries ────────────────────────────────────

  describe('getCategoryReviewSummaries', () => {
    it('returns summaries for multiple products', async () => {
      const res = await getCategoryReviewSummaries(['p1', 'p2']);
      expect(res.p1).toBeDefined();
      expect(res.p2).toBeDefined();
      expect(res.p1.total).toBe(4); // 4 approved for p1
      expect(res.p2.total).toBe(1); // 1 approved for p2
      expect(res.p1.average).toBeGreaterThan(0);
      expect(res.p2.average).toBe(4);
    });

    it('returns empty for empty array', async () => {
      const res = await getCategoryReviewSummaries([]);
      expect(res).toEqual({});
    });

    it('returns empty for non-array input', async () => {
      const res = await getCategoryReviewSummaries(null);
      expect(res).toEqual({});
    });

    it('returns zero averages for products with no reviews', async () => {
      const res = await getCategoryReviewSummaries(['no-product']);
      expect(res['no-product'].total).toBe(0);
      expect(res['no-product'].average).toBe(0);
    });

    it('handles mix of products with and without reviews', async () => {
      const res = await getCategoryReviewSummaries(['p1', 'p-empty']);
      expect(res.p1.total).toBeGreaterThan(0);
      expect(res['p-empty'].total).toBe(0);
    });
  });

  // ── formatReview (indirectly via getProductReviews) ───────────────

  describe('formatReview (indirect)', () => {
    it('formats ownerResponse and ownerResponseDate', async () => {
      // Add an owner response then fetch
      await addOwnerResponse('r1', 'Thanks for your feedback, we appreciate it!');
      const res = await getProductReviews('p1');
      const review = res.reviews.find(r => r._id === 'r1');
      expect(review.ownerResponse).toBeTruthy();
      expect(review.ownerResponseDate).toBeTruthy();
    });

    it('returns null for missing ownerResponse', async () => {
      const res = await getProductReviews('p1');
      const review = res.reviews.find(r => r._id === 'r2');
      expect(review.ownerResponse).toBeNull();
      expect(review.ownerResponseDate).toBeNull();
    });

    it('includes verifiedPurchase boolean', async () => {
      const res = await getProductReviews('p1');
      const r1 = res.reviews.find(r => r._id === 'r1');
      const r2 = res.reviews.find(r => r._id === 'r2');
      expect(r1.verifiedPurchase).toBe(true);
      expect(r2.verifiedPurchase).toBe(false);
    });

    it('includes photos array', async () => {
      const res = await getProductReviews('p1');
      const r1 = res.reviews.find(r => r._id === 'r1');
      expect(r1.photos).toBeInstanceOf(Array);
      expect(r1.photos.length).toBe(1);
    });
  });
});
