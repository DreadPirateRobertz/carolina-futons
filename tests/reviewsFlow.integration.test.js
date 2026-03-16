import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import {
  submitReview, getProductReviews, getAggregateRating,
  getPendingReviews, moderateReview,
} from '../src/backend/reviewsService.web.js';
import { submitPhotoReview, getPhotoReviews, moderatePhotoReview } from '../src/backend/photoReviews.web.js';

describe('Reviews Flow', () => {
  beforeEach(() => {
    resetData();
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
    __setRoles([{ _id: 'admin' }]);
    __seed('Reviews', [
      {
        _id: 'rev-1', productId: 'prod-1', memberId: 'member-1',
        authorName: 'Jane S.', rating: 5, title: 'Amazing futon',
        body: 'Solid build.', photos: [], verifiedPurchase: true,
        helpful: 3, status: 'approved', _createdDate: new Date(),
      },
    ]);
    __seed('PhotoReviews', []);
  });

  describe('review display', () => {
    it('returns aggregate rating', async () => {
      const agg = await getAggregateRating('prod-1');
      expect(agg).toHaveProperty('average');
      expect(agg).toHaveProperty('total');
    });

    it('returns product reviews', async () => {
      const reviews = await getProductReviews('prod-1');
      expect(reviews).toHaveProperty('reviews');
      expect(reviews).toHaveProperty('total');
    });
  });

  describe('review submission', () => {
    it('submits text review with rating', async () => {
      const result = await submitReview({
        productId: 'prod-1', rating: 5,
        title: 'Great futon frame',
        body: 'Very sturdy and easy to assemble.',
      });
      expect(result).toBeDefined();
    });

    it('rejects review without rating', async () => {
      const result = await submitReview({ productId: 'prod-1', title: 'No rating', body: 'Forgot' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('photo reviews', () => {
    it('submits photo review', async () => {
      const result = await submitPhotoReview({
        productId: 'prod-1', rating: 4,
        body: 'Looks great', photoUrls: ['https://example.com/photo.jpg'],
      });
      expect(result).toBeDefined();
    });

    it('moderates inappropriate photo', async () => {
      const submitted = await submitPhotoReview({
        productId: 'prod-1', rating: 1,
        body: 'Bad', photoUrls: ['https://example.com/bad.jpg'],
      });
      const result = await moderatePhotoReview(submitted._id, 'rejected');
      expect(result).toBeDefined();
    });
  });

  describe('moderation', () => {
    beforeEach(() => {
      __seed('Reviews', [
        {
          _id: 'rev-pending-1', productId: 'prod-1', memberId: 'member-2',
          authorName: 'Bob T.', rating: 4, title: 'Nice frame',
          body: 'Good quality.', photos: [], verifiedPurchase: false,
          helpful: 0, status: 'pending', _createdDate: new Date(),
        },
      ]);
    });

    it('returns pending reviews queue', async () => {
      const result = await getPendingReviews();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.reviews)).toBe(true);
    });

    it('approves review', async () => {
      const result = await moderateReview('rev-pending-1', 'approved');
      expect(result).toBeDefined();
    });

    it('rejects review', async () => {
      const result = await moderateReview('rev-pending-1', 'rejected');
      expect(result).toBeDefined();
    });
  });
});
