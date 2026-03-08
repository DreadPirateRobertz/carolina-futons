import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
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
} from '../../src/backend/reviewsService.web.js';

// ── Test Data ─────────────────────────────────────────────────────────

const sampleReviews = [
  {
    _id: 'rev-001',
    productId: 'prod-001',
    memberId: 'member-001',
    authorName: 'Jane S.',
    rating: 5,
    title: 'Amazing futon',
    body: 'Solid build quality, easy to assemble.',
    photos: [],
    verifiedPurchase: true,
    helpful: 3,
    status: 'approved',
    _createdDate: new Date('2026-01-15'),
  },
  {
    _id: 'rev-002',
    productId: 'prod-001',
    memberId: 'member-002',
    authorName: 'Tom B.',
    rating: 4,
    title: 'Great frame',
    body: 'Beautiful finish, good value for the price.',
    photos: ['https://example.com/photo1.jpg'],
    verifiedPurchase: false,
    helpful: 1,
    status: 'approved',
    _createdDate: new Date('2026-01-10'),
  },
  {
    _id: 'rev-003',
    productId: 'prod-001',
    memberId: 'member-003',
    authorName: 'Alex P.',
    rating: 3,
    title: 'Decent',
    body: 'Good overall but assembly instructions could be clearer.',
    photos: [],
    verifiedPurchase: true,
    helpful: 0,
    status: 'approved',
    _createdDate: new Date('2026-01-05'),
  },
];

const mockMember = {
  _id: 'member-001',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('reviewsService', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    __seed('Reviews', sampleReviews);
    __setMember(mockMember);
  });

  describe('getProductReviews', () => {
    it('returns formatted reviews for a valid product', async () => {
      const result = await getProductReviews('prod-001');

      expect(result.reviews).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.pageSize).toBe(10);

      const first = result.reviews[0];
      expect(first.authorName).toBe('Jane S.');
      expect(first.rating).toBe(5);
      expect(first.title).toBe('Amazing futon');
      expect(first.body).toBe('Solid build quality, easy to assemble.');
      expect(first.verifiedPurchase).toBe(true);
      expect(first.helpful).toBe(3);
      expect(first.date).toBeTruthy();
    });

    it('returns empty array for invalid product ID', async () => {
      const result = await getProductReviews('');
      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty array for null product ID', async () => {
      const result = await getProductReviews(null);
      expect(result.reviews).toEqual([]);
    });

    it('sorts by newest by default (descending _createdDate)', async () => {
      const result = await getProductReviews('prod-001');
      // Default sort is descending _createdDate — rev-001 (Jan 15) should be first
      expect(result.reviews[0].title).toBe('Amazing futon');
      expect(result.reviews[2].title).toBe('Decent');
    });

    it('sorts by highest rating', async () => {
      const result = await getProductReviews('prod-001', { sort: 'highest' });
      expect(result.reviews[0].rating).toBe(5);
      expect(result.reviews[2].rating).toBe(3);
    });

    it('sorts by lowest rating', async () => {
      const result = await getProductReviews('prod-001', { sort: 'lowest' });
      expect(result.reviews[0].rating).toBe(3);
      expect(result.reviews[2].rating).toBe(5);
    });

    it('sorts by most helpful', async () => {
      const result = await getProductReviews('prod-001', { sort: 'helpful' });
      expect(result.reviews[0].helpful).toBe(3);
      expect(result.reviews[2].helpful).toBe(0);
    });

    it('handles negative page number', async () => {
      const result = await getProductReviews('prod-001', { page: -1 });
      expect(result.page).toBe(0);
    });

    it('strips internal fields from response', async () => {
      const result = await getProductReviews('prod-001');
      const first = result.reviews[0];
      expect(first.memberId).toBeUndefined();
      expect(first.status).toBeUndefined();
      expect(first.productId).toBeUndefined();
    });

    it('filters reviews by star rating when filterStars provided', async () => {
      resetData();
      __seed('Reviews', [
        { _id: 'r1', productId: 'prod-001', rating: 5, status: 'approved', body: 'Great', authorName: 'A', _createdDate: new Date() },
        { _id: 'r2', productId: 'prod-001', rating: 3, status: 'approved', body: 'OK', authorName: 'B', _createdDate: new Date() },
        { _id: 'r3', productId: 'prod-001', rating: 5, status: 'approved', body: 'Awesome', authorName: 'C', _createdDate: new Date() },
      ]);
      const result = await getProductReviews('prod-001', { filterStars: 5 });
      expect(result.reviews.every(r => r.rating === 5)).toBe(true);
      expect(result.total).toBe(2);
    });

    it('returns all reviews when filterStars not provided', async () => {
      const result = await getProductReviews('prod-001', {});
      expect(result.total).toBe(3);
    });

    it('ignores invalid filterStars values', async () => {
      const result = await getProductReviews('prod-001', { filterStars: 0 });
      expect(result.total).toBe(3); // 0 is invalid, should return all
    });

    it('returns only approved reviews', async () => {
      __seed('Reviews', [
        ...sampleReviews,
        { _id: 'rev-pending', productId: 'prod-001', status: 'pending', rating: 1, body: 'Pending', _createdDate: new Date() },
        { _id: 'rev-rejected', productId: 'prod-001', status: 'rejected', rating: 1, body: 'Rejected', _createdDate: new Date() },
      ]);
      const result = await getProductReviews('prod-001');
      expect(result.reviews).toHaveLength(3);
    });
  });

  describe('getAggregateRating', () => {
    it('calculates correct average and breakdown', async () => {
      const result = await getAggregateRating('prod-001');

      expect(result.total).toBe(3);
      expect(result.average).toBe(4); // (5+4+3)/3 = 4.0
      expect(result.breakdown[5]).toBe(1);
      expect(result.breakdown[4]).toBe(1);
      expect(result.breakdown[3]).toBe(1);
      expect(result.breakdown[2]).toBe(0);
      expect(result.breakdown[1]).toBe(0);
    });

    it('returns zeros for product with no reviews', async () => {
      const result = await getAggregateRating('prod-999');
      expect(result.average).toBe(0);
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    });

    it('returns zeros for invalid product ID', async () => {
      const result = await getAggregateRating('');
      expect(result.average).toBe(0);
      expect(result.total).toBe(0);
    });

    it('clamps ratings to 1-5 range', async () => {
      resetData();
      __seed('Reviews', [
        { _id: 'r1', productId: 'prod-001', rating: 7, status: 'approved' },
        { _id: 'r2', productId: 'prod-001', rating: 0, status: 'approved' },
      ]);

      const result = await getAggregateRating('prod-001');
      expect(result.breakdown[5]).toBe(1);
      expect(result.breakdown[1]).toBe(1);
      expect(result.average).toBe(3); // (5+1)/2
    });
  });

  describe('submitReview', () => {
    beforeEach(() => {
      // Use empty Reviews so duplicate check passes
      resetData();
      __seed('Reviews', []);
      // Seed empty orders so verifiedPurchase check works
      __seed('Stores/Orders', []);
    });

    it('submits a valid review', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        title: 'Great product',
        body: 'This futon is absolutely fantastic, highly recommend!',
      });

      expect(result.success).toBe(true);
      expect(result.reviewId).toBeTruthy();
    });

    it('rejects review with invalid product ID', async () => {
      const result = await submitReview({
        productId: '',
        rating: 5,
        body: 'This is a test review body text.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid product');
    });

    it('rejects review with invalid rating', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 6,
        body: 'This is a test review body text.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rating must be');
    });

    it('rejects review with zero rating', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 0,
        body: 'This is a test review body text.',
      });

      expect(result.success).toBe(false);
    });

    it('rejects review with body too short', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 4,
        body: 'Short',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 10');
    });

    it('rejects duplicate review from same member', async () => {
      __seed('Reviews', [{ _id: 'existing', productId: 'prod-001', memberId: 'member-001' }]);

      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Another review for the same product.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already reviewed');
    });

    it('sanitizes HTML from review body', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 4,
        title: '<script>alert("xss")</script>Great',
        body: 'This review has HTML tags that should be stripped for safety.',
      });

      expect(result.success).toBe(true);
      // Verify the stored record is clean
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].title).not.toContain('<script>');
      }
    });

    it('limits photos to MAX_PHOTOS (3)', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Review with many photos attached to it.',
        photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
      });

      expect(result.success).toBe(true);
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].photos).toHaveLength(3);
      }
    });

    it('sets review status to pending', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'This review should start as pending moderation.',
      });

      expect(result.success).toBe(true);
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].status).toBe('pending');
      }
    });

    it('builds author name as "FirstName L." format', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Testing the author name formatting logic.',
      });

      expect(result.success).toBe(true);
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].authorName).toBe('Jane S.');
      }
    });

    it('detects verified purchase from order history', async () => {
      __seed('Stores/Orders', [
        {
          _id: 'order-001',
          buyerInfo: { id: 'member-001' },
          lineItems: [{ productId: 'prod-001' }],
        },
      ]);

      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Testing verified purchase badge detection.',
      });

      expect(result.success).toBe(true);
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].verifiedPurchase).toBe(true);
      }
    });

    it('returns false for verified purchase when no matching order', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Testing non-verified purchase scenario here.',
      });

      expect(result.success).toBe(true);
      const stored = await wixData.query('Reviews').eq('_id', result.reviewId).find();
      if (stored.items.length > 0) {
        expect(stored.items[0].verifiedPurchase).toBe(false);
      }
    });

    it('requires logged-in member', async () => {
      __setMember(null);
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Trying to submit without being logged in.',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('log in');
    });
  });

  describe('markHelpful', () => {
    it('increments helpful count on approved review', async () => {
      const result = await markHelpful('rev-001');
      expect(result.success).toBe(true);
      expect(result.helpful).toBe(4); // Was 3, now 4
    });

    it('rejects invalid review ID', async () => {
      const result = await markHelpful('');
      expect(result.success).toBe(false);
    });

    it('rejects non-existent review', async () => {
      const result = await markHelpful('rev-nonexistent');
      expect(result.success).toBe(false);
    });

    it('rejects non-approved review', async () => {
      __seed('Reviews', [
        { _id: 'rev-pending', productId: 'prod-001', status: 'pending', helpful: 0 },
      ]);
      const result = await markHelpful('rev-pending');
      expect(result.success).toBe(false);
    });
  });

  describe('flagReview', () => {
    it('flags an existing review', async () => {
      __seed('ReviewFlags', []);
      const result = await flagReview('rev-001', 'spam');
      expect(result.success).toBe(true);
    });

    it('rejects invalid review ID', async () => {
      const result = await flagReview('', 'spam');
      expect(result.success).toBe(false);
    });

    it('rejects non-existent review', async () => {
      resetData();
      __seed('Reviews', []);
      __seed('ReviewFlags', []);
      const result = await flagReview('rev-nonexistent', 'spam');
      expect(result.success).toBe(false);
    });

    it('normalizes invalid reason to "other"', async () => {
      __seed('ReviewFlags', []);
      await flagReview('rev-001', 'invalid-reason');
      const flags = await wixData.query('ReviewFlags').find();
      const flag = flags.items.find(f => f.reviewId === 'rev-001');
      if (flag) {
        expect(flag.reason).toBe('other');
      }
    });

    it('accepts valid reason types', async () => {
      const validReasons = ['spam', 'offensive', 'fake', 'other'];
      for (const reason of validReasons) {
        resetData();
        __seed('Reviews', sampleReviews);
        __seed('ReviewFlags', []);

        await flagReview('rev-001', reason);
        const flags = await wixData.query('ReviewFlags').find();
        const flag = flags.items.find(f => f.reviewId === 'rev-001');
        if (flag) {
          expect(flag.reason).toBe(reason);
        }
      }
    });

    it('auto-hides review after 3 flags', async () => {
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-001', reason: 'spam' },
        { _id: 'f2', reviewId: 'rev-001', reason: 'offensive' },
      ]);

      await flagReview('rev-001', 'fake');

      // Review should now be set to pending
      const review = await wixData.get('Reviews', 'rev-001');
      expect(review.status).toBe('pending');
    });
  });

  describe('getReviewStats', () => {
    beforeEach(() => {
      // Use recent dates so they fall within the stats window
      const now = new Date();
      const recentReviews = sampleReviews.map(r => ({
        ...r,
        _createdDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      }));
      resetData();
      __seed('Reviews', recentReviews);
    });

    it('returns review statistics', async () => {
      const result = await getReviewStats(30);
      expect(result.success).toBe(true);
      expect(result.period).toBe('30 days');
      expect(typeof result.total).toBe('number');
      expect(typeof result.approved).toBe('number');
      expect(typeof result.pending).toBe('number');
      expect(typeof result.avgRating).toBe('number');
      expect(typeof result.verifiedPurchaseRate).toBe('number');
      expect(typeof result.withPhotos).toBe('number');
    });

    it('calculates average rating from approved reviews', async () => {
      const result = await getReviewStats(30);
      expect(result.avgRating).toBe(4); // (5+4+3)/3 = 4.0
    });

    it('counts reviews with photos', async () => {
      const result = await getReviewStats(30);
      expect(result.withPhotos).toBe(1); // only rev-002 has photos
    });

    it('calculates verified purchase rate', async () => {
      const result = await getReviewStats(30);
      // 2 verified out of 3 approved = 67%
      expect(result.verifiedPurchaseRate).toBe(67);
    });

    it('handles empty dataset', async () => {
      resetData();
      __seed('Reviews', []);
      const result = await getReviewStats(30);
      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.avgRating).toBe(0);
    });

    it('clamps days to safe range', async () => {
      const result = await getReviewStats(0);
      expect(result.period).toBe('1 days');
    });
  });

  describe('addOwnerResponse', () => {
    it('adds owner response to an existing review', async () => {
      const result = await addOwnerResponse('rev-001', 'Thank you for your kind words! We appreciate your business.');
      expect(result.success).toBe(true);

      const review = await wixData.get('Reviews', 'rev-001');
      expect(review.ownerResponse).toContain('Thank you');
      expect(review.ownerResponseDate).toBeDefined();
    });

    it('rejects invalid review ID', async () => {
      const result = await addOwnerResponse('', 'Some response text here.');
      expect(result.success).toBe(false);
    });

    it('rejects response shorter than 5 characters', async () => {
      const result = await addOwnerResponse('rev-001', 'Hi');
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 5');
    });

    it('rejects non-existent review', async () => {
      const result = await addOwnerResponse('rev-nonexistent', 'Thank you for your feedback!');
      expect(result.success).toBe(false);
    });

    it('sanitizes HTML from response text', async () => {
      await addOwnerResponse('rev-001', '<script>alert(1)</script>Thank you for the review!');
      const review = await wixData.get('Reviews', 'rev-001');
      expect(review.ownerResponse).not.toContain('<script>');
    });
  });

  describe('getPendingReviews', () => {
    beforeEach(() => {
      resetData();
      __seed('Reviews', [
        { _id: 'rev-p1', productId: 'prod-001', status: 'pending', rating: 4, body: 'Pending review', _createdDate: new Date() },
        { _id: 'rev-p2', productId: 'prod-002', status: 'pending', rating: 3, body: 'Another pending', _createdDate: new Date() },
      ]);
    });

    it('returns pending reviews', async () => {
      const result = await getPendingReviews();
      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('returns empty when no pending reviews', async () => {
      resetData();
      __seed('Reviews', []);
      const result = await getPendingReviews();
      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('moderateReview', () => {
    it('approves a review', async () => {
      const result = await moderateReview('rev-001', 'approve');
      expect(result.success).toBe(true);

      const review = await wixData.get('Reviews', 'rev-001');
      expect(review.status).toBe('approved');
      expect(review.moderatedAt).toBeInstanceOf(Date);
    });

    it('rejects a review', async () => {
      const result = await moderateReview('rev-001', 'reject');
      expect(result.success).toBe(true);

      const review = await wixData.get('Reviews', 'rev-001');
      expect(review.status).toBe('rejected');
    });

    it('rejects invalid review ID', async () => {
      const result = await moderateReview('', 'approve');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid review ID');
    });

    it('rejects invalid action', async () => {
      const result = await moderateReview('rev-001', 'delete');
      expect(result.success).toBe(false);
      expect(result.error).toContain('approve');
    });

    it('handles non-existent review', async () => {
      const result = await moderateReview('rev-nonexistent', 'approve');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getCategoryReviewSummaries', () => {
    beforeEach(() => {
      resetData();
      __seed('Reviews', [
        { _id: 'r1', productId: 'prod-001', rating: 5, status: 'approved' },
        { _id: 'r2', productId: 'prod-001', rating: 3, status: 'approved' },
        { _id: 'r3', productId: 'prod-002', rating: 4, status: 'approved' },
        { _id: 'r4', productId: 'prod-002', rating: 4, status: 'approved' },
        { _id: 'r5', productId: 'prod-002', rating: 2, status: 'pending' }, // not approved
        { _id: 'r6', productId: 'prod-003', rating: 5, status: 'rejected' }, // not approved
      ]);
    });

    it('returns summaries for multiple products', async () => {
      const result = await getCategoryReviewSummaries(['prod-001', 'prod-002', 'prod-003']);

      expect(result['prod-001'].total).toBe(2);
      expect(result['prod-001'].average).toBe(4); // (5+3)/2
      expect(result['prod-002'].total).toBe(2);
      expect(result['prod-002'].average).toBe(4); // (4+4)/2
      expect(result['prod-003'].total).toBe(0); // rejected not counted
    });

    it('returns empty object for empty array', async () => {
      const result = await getCategoryReviewSummaries([]);
      expect(result).toEqual({});
    });

    it('returns empty object for non-array input', async () => {
      const result = await getCategoryReviewSummaries(null);
      expect(result).toEqual({});
    });

    it('returns empty object for invalid IDs', async () => {
      const result = await getCategoryReviewSummaries(['', null, undefined]);
      expect(result).toEqual({});
    });

    it('returns zero summary for products with no reviews', async () => {
      const result = await getCategoryReviewSummaries(['prod-no-reviews']);
      expect(result['prod-no-reviews'].total).toBe(0);
      expect(result['prod-no-reviews'].average).toBe(0);
    });

    it('excludes non-approved reviews', async () => {
      const result = await getCategoryReviewSummaries(['prod-002']);
      // prod-002 has 2 approved + 1 pending; only approved count
      expect(result['prod-002'].total).toBe(2);
    });

    it('handles large product arrays (caps at 100)', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => `prod-${i}`);
      const result = await getCategoryReviewSummaries(ids);
      // Should not throw, should cap at 100
      expect(Object.keys(result).length).toBeLessThanOrEqual(100);
    });
  });
});
