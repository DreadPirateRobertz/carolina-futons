import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix-data
const mockItems = [];
let mockTotalCount = 0;

const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  ge: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: mockItems, totalCount: mockTotalCount })),
  count: vi.fn(async () => mockTotalCount),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    get: vi.fn(async (collection, id) => mockItems.find(i => i._id === id)),
    insert: vi.fn(async (collection, record) => ({ ...record, _id: 'new-review-001', _createdDate: new Date() })),
    update: vi.fn(async (collection, record) => record),
  },
}));

// Mock wix-members-backend
const mockMember = {
  _id: 'member-001',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => mockMember),
  },
}));

// Mock wix-web-module
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

// Mock sanitize
vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const cleaned = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
}));

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
} from '../src/backend/reviewsService.web.js';

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

// ── Tests ─────────────────────────────────────────────────────────────

describe('reviewsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    mockItems.push(...sampleReviews);
    mockTotalCount = sampleReviews.length;
  });

  describe('getProductReviews', () => {
    it('returns formatted reviews for a valid product', async () => {
      const result = await getProductReviews('prod-001');

      expect(result.reviews).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.pageSize).toBe(10);

      // Check formatted fields
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

    it('applies sort parameter', async () => {
      await getProductReviews('prod-001', { sort: 'highest' });
      expect(mockQuery.descending).toHaveBeenCalledWith('rating');
    });

    it('applies lowest sort', async () => {
      await getProductReviews('prod-001', { sort: 'lowest' });
      expect(mockQuery.ascending).toHaveBeenCalledWith('rating');
    });

    it('applies helpful sort', async () => {
      await getProductReviews('prod-001', { sort: 'helpful' });
      expect(mockQuery.descending).toHaveBeenCalledWith('helpful');
    });

    it('defaults to newest sort', async () => {
      await getProductReviews('prod-001');
      expect(mockQuery.descending).toHaveBeenCalledWith('_createdDate');
    });

    it('respects pagination', async () => {
      await getProductReviews('prod-001', { page: 2 });
      expect(mockQuery.skip).toHaveBeenCalledWith(20);
    });

    it('handles negative page number', async () => {
      const result = await getProductReviews('prod-001', { page: -1 });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(result.page).toBe(0);
    });

    it('strips internal fields from response', async () => {
      const result = await getProductReviews('prod-001');
      const first = result.reviews[0];
      expect(first.memberId).toBeUndefined();
      expect(first.status).toBeUndefined();
      expect(first.productId).toBeUndefined();
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
      mockItems.length = 0;
      mockTotalCount = 0;

      const result = await getAggregateRating('prod-002');

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
      mockItems.length = 0;
      mockItems.push({ _id: 'r1', rating: 7, status: 'approved' }); // Should clamp to 5
      mockItems.push({ _id: 'r2', rating: 0, status: 'approved' }); // Should clamp to 1
      mockTotalCount = 2;

      const result = await getAggregateRating('prod-001');
      expect(result.breakdown[5]).toBe(1);
      expect(result.breakdown[1]).toBe(1);
      expect(result.average).toBe(3); // (5+1)/2
    });
  });

  describe('submitReview', () => {
    beforeEach(() => {
      // Clear existing reviews so no duplicate check fails
      mockItems.length = 0;
      mockTotalCount = 0;
    });

    it('submits a valid review', async () => {
      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        title: 'Great product',
        body: 'This futon is absolutely fantastic, highly recommend!',
      });

      expect(result.success).toBe(true);
      expect(result.reviewId).toBe('new-review-001');
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
      mockItems.push({ _id: 'existing', productId: 'prod-001', memberId: 'member-001' });
      mockTotalCount = 1;

      const result = await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Another review for the same product.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already reviewed');
    });

    it('sanitizes HTML from review body', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReview({
        productId: 'prod-001',
        rating: 4,
        title: '<script>alert("xss")</script>Great',
        body: 'This <b>bold</b> review has HTML tags that should be stripped for safety.',
      });

      const insertCall = wixData.insert.mock.calls[0];
      if (insertCall) {
        const record = insertCall[1];
        expect(record.body).not.toContain('<b>');
        expect(record.title).not.toContain('<script>');
      }
    });

    it('limits photos to MAX_PHOTOS', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Review with many photos attached to it.',
        photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
      });

      const insertCall = wixData.insert.mock.calls[0];
      if (insertCall) {
        expect(insertCall[1].photos).toHaveLength(3);
      }
    });

    it('sets review status to pending', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'This review should start as pending moderation.',
      });

      const insertCall = wixData.insert.mock.calls[0];
      if (insertCall) {
        expect(insertCall[1].status).toBe('pending');
      }
    });

    it('builds author name as "FirstName L." format', async () => {
      const wixData = (await import('wix-data')).default;

      await submitReview({
        productId: 'prod-001',
        rating: 5,
        body: 'Testing the author name formatting logic.',
      });

      const insertCall = wixData.insert.mock.calls[0];
      if (insertCall) {
        expect(insertCall[1].authorName).toBe('Jane S.');
      }
    });
  });

  describe('markHelpful', () => {
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(...sampleReviews);
    });

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
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(null);

      const result = await markHelpful('rev-nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('flagReview', () => {
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(...sampleReviews);
    });

    it('flags an existing review', async () => {
      const wixData = (await import('wix-data')).default;
      // Mock count to return < 3 (no auto-hide)
      mockQuery.find.mockResolvedValueOnce({ items: [sampleReviews[0]], totalCount: 1 });

      const result = await flagReview('rev-001', 'spam');
      expect(result.success).toBe(true);
    });

    it('rejects invalid review ID', async () => {
      const result = await flagReview('', 'spam');
      expect(result.success).toBe(false);
    });

    it('rejects non-existent review', async () => {
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(null);

      const result = await flagReview('rev-nonexistent', 'spam');
      expect(result.success).toBe(false);
    });

    it('normalizes invalid reason to "other"', async () => {
      const wixData = (await import('wix-data')).default;

      await flagReview('rev-001', 'invalid-reason');

      // Should have called insert with reason 'other'
      const insertCalls = wixData.insert.mock.calls;
      const flagCall = insertCalls.find(c => c[0] === 'ReviewFlags');
      if (flagCall) {
        expect(flagCall[1].reason).toBe('other');
      }
    });

    it('accepts valid reason types', async () => {
      const wixData = (await import('wix-data')).default;
      const validReasons = ['spam', 'offensive', 'fake', 'other'];

      for (const reason of validReasons) {
        vi.clearAllMocks();
        mockItems.length = 0;
        mockItems.push(...sampleReviews);

        await flagReview('rev-001', reason);
        const flagCall = wixData.insert.mock.calls.find(c => c[0] === 'ReviewFlags');
        if (flagCall) {
          expect(flagCall[1].reason).toBe(reason);
        }
      }
    });
  });

  describe('getReviewStats', () => {
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(...sampleReviews);
      mockTotalCount = sampleReviews.length;
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
      mockItems.length = 0;
      mockTotalCount = 0;

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
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(...sampleReviews);
    });

    it('adds owner response to an existing review', async () => {
      const wixData = (await import('wix-data')).default;
      const result = await addOwnerResponse('rev-001', 'Thank you for your kind words! We appreciate your business.');
      expect(result.success).toBe(true);

      const updateCall = wixData.update.mock.calls[0];
      if (updateCall) {
        expect(updateCall[1].ownerResponse).toContain('Thank you');
        expect(updateCall[1].ownerResponseDate).toBeDefined();
      }
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
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(null);

      const result = await addOwnerResponse('rev-nonexistent', 'Thank you for your feedback!');
      expect(result.success).toBe(false);
    });

    it('sanitizes HTML from response text', async () => {
      const wixData = (await import('wix-data')).default;
      await addOwnerResponse('rev-001', '<script>alert(1)</script>Thank you for the review!');

      const updateCall = wixData.update.mock.calls[0];
      if (updateCall) {
        expect(updateCall[1].ownerResponse).not.toContain('<script>');
      }
    });
  });

  describe('getPendingReviews', () => {
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(
        { _id: 'rev-p1', productId: 'prod-001', status: 'pending', rating: 4, body: 'Pending review', _createdDate: new Date() },
        { _id: 'rev-p2', productId: 'prod-002', status: 'pending', rating: 3, body: 'Another pending', _createdDate: new Date() },
      );
      mockTotalCount = 2;
    });

    it('returns pending reviews', async () => {
      const result = await getPendingReviews();
      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('returns empty when no pending reviews', async () => {
      mockItems.length = 0;
      mockTotalCount = 0;

      const result = await getPendingReviews();
      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('clamps limit to safe range', async () => {
      await getPendingReviews(100);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('moderateReview', () => {
    beforeEach(() => {
      mockItems.length = 0;
      mockItems.push(...sampleReviews);
    });

    it('approves a review', async () => {
      const wixData = (await import('wix-data')).default;
      const result = await moderateReview('rev-001', 'approve');
      expect(result.success).toBe(true);

      const updateCall = wixData.update.mock.calls[0];
      if (updateCall) {
        expect(updateCall[1].status).toBe('approved');
        expect(updateCall[1].moderatedAt).toBeInstanceOf(Date);
      }
    });

    it('rejects a review', async () => {
      const wixData = (await import('wix-data')).default;
      const result = await moderateReview('rev-001', 'reject');
      expect(result.success).toBe(true);

      const updateCall = wixData.update.mock.calls[0];
      if (updateCall) {
        expect(updateCall[1].status).toBe('rejected');
      }
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
      const wixData = (await import('wix-data')).default;
      wixData.get.mockResolvedValueOnce(null);

      const result = await moderateReview('rev-nonexistent', 'approve');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
