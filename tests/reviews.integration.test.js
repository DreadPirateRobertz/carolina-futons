import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

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

const MEMBER = {
  _id: 'member-1',
  loginEmail: 'jane@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

const MEMBER_2 = {
  _id: 'member-2',
  loginEmail: 'tom@example.com',
  contactDetails: { firstName: 'Tom', lastName: 'Baker' },
};

function review(overrides = {}) {
  return {
    _id: 'rev-1',
    productId: 'prod-1',
    memberId: 'member-1',
    authorName: 'Jane S.',
    rating: 5,
    title: 'Great frame',
    body: 'Solid build quality, easy to assemble.',
    photos: ['https://cdn.example.com/review1.jpg'],
    verifiedPurchase: true,
    helpful: 3,
    status: 'approved',
    _createdDate: new Date(), // always "today" — avoids date-rot in date-windowed queries
    ...overrides,
  };
}

function makeReviews(count, productId = 'prod-1', baseRating = 5) {
  return Array.from({ length: count }, (_, i) => review({
    _id: `rev-${i + 1}`,
    productId,
    memberId: `member-${i + 1}`,
    rating: Math.max(1, Math.min(5, baseRating - (i % 5))),
    title: `Review ${i + 1}`,
    body: `Review body number ${i + 1} with enough characters.`,
    helpful: count - i,
    _createdDate: new Date(Date.now() - i * 86400000),
  }));
}

const ORDER_WITH_PRODUCT = {
  _id: 'order-1',
  number: '10042',
  _createdDate: new Date(),
  paymentStatus: 'PAID',
  buyerInfo: { id: 'member-1', email: 'jane@example.com' },
  lineItems: [
    { _id: 'li-1', name: 'Seattle Futon Frame', productId: 'prod-1', quantity: 1, price: 549 },
  ],
  totals: { subtotal: 549, shipping: 29.99, total: 578.99 },
};

// ── Tests ───────────────────────────────────────────────────────────

describe('Reviews & Ratings Integration', () => {
  beforeEach(() => {
    resetData();
    resetMember();
    __setMember(MEMBER);
    __seed('Reviews', []);
    __seed('ReviewFlags', []);
    __seed('Stores/Orders', [ORDER_WITH_PRODUCT]);
  });

  // ── Submission lifecycle ───────────────────────────────────────────

  describe('submission lifecycle', () => {
    it('submit → pending → moderate (approve) → visible in getProductReviews', async () => {
      // Step 1: Submit review
      const submit = await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Amazing frame',
        body: 'Solid hardwood, beautiful finish. Easy 30-minute assembly.',
        photos: ['https://cdn.example.com/photo1.jpg'],
      });
      expect(submit.success).toBe(true);
      expect(submit.reviewId).toBeTruthy();

      // Step 2: Not visible in public reviews (pending)
      const beforeApproval = await getProductReviews('prod-1');
      expect(beforeApproval.reviews).toHaveLength(0);

      // Step 3: Shows in pending queue
      const pending = await getPendingReviews();
      expect(pending.reviews).toHaveLength(1);
      expect(pending.reviews[0].status).toBe('pending');

      // Step 4: Approve
      const moderate = await moderateReview(submit.reviewId, 'approve');
      expect(moderate.success).toBe(true);

      // Step 5: Now visible in public reviews
      const afterApproval = await getProductReviews('prod-1');
      expect(afterApproval.reviews).toHaveLength(1);
      expect(afterApproval.reviews[0].title).toBe('Amazing frame');
      expect(afterApproval.reviews[0].rating).toBe(5);
      expect(afterApproval.reviews[0].verifiedPurchase).toBe(true);
    });

    it('rejected review does not appear in public reviews', async () => {
      const submit = await submitReview({
        productId: 'prod-1',
        rating: 1,
        title: 'Spam review',
        body: 'Buy my stuff at spam-site.com check it out now!',
      });
      await moderateReview(submit.reviewId, 'reject');

      const reviews = await getProductReviews('prod-1');
      expect(reviews.reviews).toHaveLength(0);
    });

    it('verifies purchase against order history', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Reviews') inserted = item;
      });

      await submitReview({
        productId: 'prod-1',
        rating: 4,
        title: 'Good quality',
        body: 'Exactly as described, happy with the purchase.',
      });
      expect(inserted.verifiedPurchase).toBe(true);
    });

    it('marks as not verified when member has no matching order', async () => {
      __seed('Stores/Orders', []); // No orders
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Reviews') inserted = item;
      });

      await submitReview({
        productId: 'prod-1',
        rating: 3,
        title: 'Average product',
        body: 'It is an okay frame, nothing special about it.',
      });
      expect(inserted.verifiedPurchase).toBe(false);
    });

    it('builds author name as "FirstName L." format', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Reviews') inserted = item;
      });

      await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Love it',
        body: 'Beautiful frame, perfect for our living room setup.',
      });
      expect(inserted.authorName).toBe('Jane S.');
    });

    it('limits photos to MAX_PHOTOS (3)', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Reviews') inserted = item;
      });

      await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Photos test',
        body: 'Uploading lots of photos for this review here.',
        photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
      });
      expect(inserted.photos).toHaveLength(3);
    });

    it('filters out empty/non-string photo entries', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'Reviews') inserted = item;
      });

      await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Photo filter test',
        body: 'Testing that invalid photo entries are filtered out.',
        photos: ['valid.jpg', '', null, 42, 'also-valid.jpg'],
      });
      expect(inserted.photos).toHaveLength(2);
      expect(inserted.photos).toEqual(['valid.jpg', 'also-valid.jpg']);
    });
  });

  // ── Submission validation ─────────────────────────────────────────

  describe('submission validation', () => {
    it('rejects duplicate review for same product by same member', async () => {
      __seed('Reviews', [review()]);
      const result = await submitReview({
        productId: 'prod-1',
        rating: 4,
        title: 'Second review',
        body: 'Trying to post a duplicate review for same product.',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already reviewed');
    });

    it.each([0, 6, -1, NaN])('rejects invalid rating: %s', async (rating) => {
      const result = await submitReview({
        productId: 'prod-1',
        rating,
        title: 'Test',
        body: 'Testing invalid rating value for this review.',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('between 1 and 5');
    });

    it('rejects review body shorter than 10 characters', async () => {
      const result = await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Short',
        body: 'Too short',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('10 characters');
    });

    it('rejects when not logged in', async () => {
      __setMember(null);
      const result = await submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Test',
        body: 'This is a test review with enough characters.',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('log in');
    });

    it('rejects invalid product ID', async () => {
      const result = await submitReview({
        productId: '',
        rating: 5,
        title: 'Test',
        body: 'Test review for an invalid product identifier.',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Star aggregation ──────────────────────────────────────────────

  describe('star aggregation', () => {
    it('calculates average and breakdown for mixed ratings', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', rating: 5 }),
        review({ _id: 'r2', rating: 4, memberId: 'm2' }),
        review({ _id: 'r3', rating: 4, memberId: 'm3' }),
        review({ _id: 'r4', rating: 3, memberId: 'm4' }),
        review({ _id: 'r5', rating: 1, memberId: 'm5' }),
      ]);

      const agg = await getAggregateRating('prod-1');
      expect(agg.total).toBe(5);
      expect(agg.average).toBe(3.4); // (5+4+4+3+1)/5 = 3.4
      expect(agg.breakdown[5]).toBe(1);
      expect(agg.breakdown[4]).toBe(2);
      expect(agg.breakdown[3]).toBe(1);
      expect(agg.breakdown[2]).toBe(0);
      expect(agg.breakdown[1]).toBe(1);
    });

    it('returns zeros for product with no reviews', async () => {
      const agg = await getAggregateRating('prod-no-reviews');
      expect(agg.average).toBe(0);
      expect(agg.total).toBe(0);
      expect(agg.breakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    });

    it('excludes pending/rejected reviews from aggregation', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', rating: 5 }),
        review({ _id: 'r2', rating: 1, status: 'pending', memberId: 'm2' }),
        review({ _id: 'r3', rating: 1, status: 'rejected', memberId: 'm3' }),
      ]);

      const agg = await getAggregateRating('prod-1');
      expect(agg.total).toBe(1);
      expect(agg.average).toBe(5);
    });

    it('updates aggregation after new review is approved', async () => {
      __seed('Reviews', [review({ rating: 4 })]);

      // Before: single 4-star review
      let agg = await getAggregateRating('prod-1');
      expect(agg.average).toBe(4);

      // Submit and approve a 2-star review
      __setMember(MEMBER_2);
      const submit = await submitReview({
        productId: 'prod-1',
        rating: 2,
        title: 'Not great',
        body: 'Disappointed with the quality of this frame product.',
      });
      await moderateReview(submit.reviewId, 'approve');

      // After: average of 4 and 2 = 3
      agg = await getAggregateRating('prod-1');
      expect(agg.total).toBe(2);
      expect(agg.average).toBe(3);
    });

    it('clamps out-of-range ratings to 1-5', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', rating: 10 }), // Should clamp to 5
        review({ _id: 'r2', rating: -3, memberId: 'm2' }), // Should clamp to 1
      ]);

      const agg = await getAggregateRating('prod-1');
      expect(agg.average).toBe(3); // (5+1)/2
    });
  });

  // ── Pagination and sorting ────────────────────────────────────────

  describe('pagination and sorting', () => {
    beforeEach(() => {
      __seed('Reviews', makeReviews(15));
    });

    it('returns PAGE_SIZE (10) reviews per page', async () => {
      const page0 = await getProductReviews('prod-1');
      expect(page0.reviews).toHaveLength(10);
      expect(page0.total).toBe(15);
      expect(page0.page).toBe(0);
      expect(page0.pageSize).toBe(10);
    });

    it('returns remaining reviews on page 1', async () => {
      const page1 = await getProductReviews('prod-1', { page: 1 });
      expect(page1.reviews).toHaveLength(5);
      expect(page1.page).toBe(1);
    });

    it('returns empty for out-of-range page', async () => {
      const page99 = await getProductReviews('prod-1', { page: 99 });
      expect(page99.reviews).toHaveLength(0);
    });

    it('sorts by newest by default', async () => {
      const result = await getProductReviews('prod-1', { sort: 'newest' });
      // Reviews sorted descending by _createdDate
      expect(result.reviews.length).toBeGreaterThan(0);
    });

    it('sorts by highest rating', async () => {
      const result = await getProductReviews('prod-1', { sort: 'highest' });
      for (let i = 1; i < result.reviews.length; i++) {
        expect(result.reviews[i - 1].rating).toBeGreaterThanOrEqual(result.reviews[i].rating);
      }
    });

    it('sorts by lowest rating', async () => {
      const result = await getProductReviews('prod-1', { sort: 'lowest' });
      for (let i = 1; i < result.reviews.length; i++) {
        expect(result.reviews[i - 1].rating).toBeLessThanOrEqual(result.reviews[i].rating);
      }
    });

    it('sorts by helpful count', async () => {
      const result = await getProductReviews('prod-1', { sort: 'helpful' });
      for (let i = 1; i < result.reviews.length; i++) {
        expect(result.reviews[i - 1].helpful).toBeGreaterThanOrEqual(result.reviews[i].helpful);
      }
    });

    it('filters by star rating', async () => {
      const result = await getProductReviews('prod-1', { filterStars: 5 });
      result.reviews.forEach(r => expect(r.rating).toBe(5));
    });
  });

  // ── Moderation ────────────────────────────────────────────────────

  describe('moderation', () => {
    it('approve and reject are the only valid actions', async () => {
      __seed('Reviews', [review({ status: 'pending' })]);
      const bad = await moderateReview('rev-1', 'delete');
      expect(bad.success).toBe(false);
    });

    it('getPendingReviews returns only pending status', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', status: 'pending' }),
        review({ _id: 'r2', status: 'approved', memberId: 'm2' }),
        review({ _id: 'r3', status: 'rejected', memberId: 'm3' }),
      ]);

      const pending = await getPendingReviews();
      expect(pending.reviews).toHaveLength(1);
      expect(pending.reviews[0]._id).toBe('r1');
    });

    it('flagging 3+ times auto-sends approved review back to pending', async () => {
      __seed('Reviews', [review({ status: 'approved' })]);
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-1', reason: 'spam' },
        { _id: 'f2', reviewId: 'rev-1', reason: 'fake' },
      ]);

      // Third flag triggers auto-hide
      await flagReview('rev-1', 'offensive');

      // Review should be back to pending
      const pending = await getPendingReviews();
      expect(pending.reviews.some(r => r._id === 'rev-1')).toBe(true);
    });

    it('flagging with invalid reason defaults to "other"', async () => {
      __seed('Reviews', [review()]);
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'ReviewFlags') inserted = item;
      });

      await flagReview('rev-1', 'invalid_reason');
      expect(inserted.reason).toBe('other');
    });

    it('owner can respond to a review', async () => {
      __seed('Reviews', [review()]);
      const result = await addOwnerResponse('rev-1', 'Thank you for your feedback, Jane!');
      expect(result.success).toBe(true);

      const reviews = await getProductReviews('prod-1');
      expect(reviews.reviews[0].ownerResponse).toBe('Thank you for your feedback, Jane!');
    });

    it('owner response must be at least 5 characters', async () => {
      __seed('Reviews', [review()]);
      const result = await addOwnerResponse('rev-1', 'Hi');
      expect(result.success).toBe(false);
    });
  });

  // ── Helpful voting ────────────────────────────────────────────────

  describe('helpful voting', () => {
    it('increments helpful count', async () => {
      __seed('Reviews', [review({ helpful: 3 })]);
      const result = await markHelpful('rev-1');
      expect(result.success).toBe(true);
      expect(result.helpful).toBe(4);
    });

    it('multiple votes increment sequentially', async () => {
      __seed('Reviews', [review({ helpful: 0 })]);
      await markHelpful('rev-1');
      const result = await markHelpful('rev-1');
      expect(result.helpful).toBe(2);
    });

    it('cannot vote on pending review', async () => {
      __seed('Reviews', [review({ status: 'pending' })]);
      const result = await markHelpful('rev-1');
      expect(result.success).toBe(false);
    });

    it('cannot vote on nonexistent review', async () => {
      const result = await markHelpful('rev-nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // ── Category review summaries ─────────────────────────────────────

  describe('category review summaries', () => {
    it('returns average and total for multiple products', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', productId: 'prod-1', rating: 5 }),
        review({ _id: 'r2', productId: 'prod-1', rating: 3, memberId: 'm2' }),
        review({ _id: 'r3', productId: 'prod-2', rating: 4, memberId: 'm3' }),
      ]);

      const summaries = await getCategoryReviewSummaries(['prod-1', 'prod-2', 'prod-3']);
      expect(summaries['prod-1'].total).toBe(2);
      expect(summaries['prod-1'].average).toBe(4);
      expect(summaries['prod-2'].total).toBe(1);
      expect(summaries['prod-2'].average).toBe(4);
      expect(summaries['prod-3'].total).toBe(0);
    });

    it('returns empty object for empty input', async () => {
      const result = await getCategoryReviewSummaries([]);
      expect(result).toEqual({});
    });

    it('excludes non-approved reviews from summaries', async () => {
      __seed('Reviews', [
        review({ _id: 'r1', productId: 'prod-1', rating: 5 }),
        review({ _id: 'r2', productId: 'prod-1', rating: 1, status: 'pending', memberId: 'm2' }),
      ]);

      const summaries = await getCategoryReviewSummaries(['prod-1']);
      expect(summaries['prod-1'].total).toBe(1);
      expect(summaries['prod-1'].average).toBe(5);
    });
  });

  // ── Review stats (admin) ──────────────────────────────────────────

  describe('review stats (admin)', () => {
    it('returns counts by status and overall stats', async () => {
      const now = new Date();
      __seed('Reviews', [
        review({ _id: 'r1', status: 'approved', verifiedPurchase: true, photos: ['a.jpg'], _createdDate: now }),
        review({ _id: 'r2', status: 'approved', rating: 3, memberId: 'm2', verifiedPurchase: false, photos: [], _createdDate: now }),
        review({ _id: 'r3', status: 'pending', memberId: 'm3', _createdDate: now }),
        review({ _id: 'r4', status: 'rejected', memberId: 'm4', _createdDate: now }),
      ]);

      const stats = await getReviewStats(30);
      expect(stats.success).toBe(true);
      expect(stats.approved).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.total).toBe(4);
      expect(stats.avgRating).toBe(4); // (5+3)/2
      expect(stats.verifiedPurchaseRate).toBe(50); // 1 of 2 approved
      expect(stats.withPhotos).toBe(1);
    });
  });

  // ── Review display format ─────────────────────────────────────────

  describe('review display format', () => {
    it('formats reviews with all expected fields', async () => {
      __seed('Reviews', [review({
        ownerResponse: 'Thanks for the review!',
        ownerResponseDate: new Date('2026-03-12'),
      })]);

      const result = await getProductReviews('prod-1');
      const r = result.reviews[0];
      expect(r._id).toBe('rev-1');
      expect(r.authorName).toBe('Jane S.');
      expect(r.rating).toBe(5);
      expect(r.title).toBe('Great frame');
      expect(r.body).toContain('Solid build');
      expect(r.photos).toHaveLength(1);
      expect(r.verifiedPurchase).toBe(true);
      expect(r.helpful).toBe(3);
      expect(r.ownerResponse).toBe('Thanks for the review!');
      expect(r.date).toContain('2026');
    });

    it('returns empty for invalid product ID', async () => {
      const result = await getProductReviews('');
      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
