/**
 * Tests for CF-zkdy UGC photo review additions:
 *   - markHelpful — increment helpfulCount on an approved or featured review
 *   - reportPhotoReview — increment reportCount; escalate when threshold hit
 *   - getPendingReviews — admin moderation queue (pending status only)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __getUpdated } from './__mocks__/wix-data.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import {
  markHelpful,
  reportPhotoReview,
  getPendingReviews,
} from '../src/backend/photoReviews.web.js';

const REVIEW_APPROVED = {
  _id: 'rev-001',
  memberId: 'member-2',
  productId: 'prod-abc',
  reviewText: 'Great futon, love it!',
  rating: 5,
  photoUrl: 'wix:image://v1/abc.jpg/abc.jpg#originWidth=800&originHeight=600',
  status: 'approved',
  helpfulCount: 3,
  reportCount: 0,
  submittedAt: new Date('2026-01-01'),
};

const REVIEW_PENDING = {
  _id: 'rev-002',
  memberId: 'member-3',
  productId: 'prod-xyz',
  reviewText: 'Comfortable and stylish!',
  rating: 4,
  photoUrl: 'wix:image://v1/def.jpg/def.jpg#originWidth=800&originHeight=600',
  status: 'pending',
  helpfulCount: 0,
  reportCount: 0,
  submittedAt: new Date('2026-01-02'),
};

const REVIEW_PENDING_2 = {
  _id: 'rev-003',
  memberId: 'member-4',
  productId: 'prod-abc',
  reviewText: 'Amazing quality futon frame.',
  rating: 5,
  photoUrl: 'wix:image://v1/ghi.jpg/ghi.jpg#originWidth=800&originHeight=600',
  status: 'pending',
  helpfulCount: 0,
  reportCount: 0,
  submittedAt: new Date('2026-01-03'),
};

const REVIEW_FEATURED = {
  _id: 'rev-004',
  memberId: 'member-5',
  productId: 'prod-abc',
  reviewText: 'This futon is absolutely incredible!',
  rating: 5,
  photoUrl: 'wix:image://v1/jkl.jpg/jkl.jpg#originWidth=800&originHeight=600',
  status: 'featured',
  helpfulCount: 10,
  reportCount: 0,
  submittedAt: new Date('2026-01-04'),
};

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'admin@example.com' });
  __setRoles([{ _id: 'admin' }]);
  __seed('PhotoReviews', [REVIEW_APPROVED, REVIEW_PENDING, REVIEW_PENDING_2]);
});

// ── markHelpful ───────────────────────────────────────────────────────

describe('markHelpful', () => {
  it('increments helpfulCount on an approved review', async () => {
    const result = await markHelpful('rev-001');
    expect(result.success).toBe(true);
    const updated = __getUpdated('PhotoReviews').find(r => r._id === 'rev-001');
    expect(updated.helpfulCount).toBe(4);
  });

  it('returns the new helpfulCount', async () => {
    const result = await markHelpful('rev-001');
    expect(result.helpfulCount).toBe(4);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await markHelpful('rev-001');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent review', async () => {
    const result = await markHelpful('rev-not-found');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error for invalid review ID', async () => {
    const result = await markHelpful('');
    expect(result.success).toBe(false);
  });

  it('rejects if review is pending (only approved/featured can receive helpful votes)', async () => {
    const result = await markHelpful('rev-002');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it('does not allow marking own review as helpful', async () => {
    __seed('PhotoReviews', [{ ...REVIEW_APPROVED, memberId: 'member-1' }]);
    const result = await markHelpful('rev-001');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/own review/i);
  });

  it('accepts helpful votes on featured reviews', async () => {
    __seed('PhotoReviews', [REVIEW_FEATURED]);
    const result = await markHelpful('rev-004');
    expect(result.success).toBe(true);
    expect(result.helpfulCount).toBe(11);
  });
});

// ── reportPhotoReview ─────────────────────────────────────────────────

describe('reportPhotoReview', () => {
  it('increments reportCount on a review', async () => {
    const result = await reportPhotoReview('rev-001', 'inappropriate');
    expect(result.success).toBe(true);
    const updated = __getUpdated('PhotoReviews').find(r => r._id === 'rev-001');
    expect(updated.reportCount).toBe(1);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await reportPhotoReview('rev-001', 'spam');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent review', async () => {
    const result = await reportPhotoReview('rev-not-found', 'spam');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error for invalid review ID', async () => {
    const result = await reportPhotoReview('', 'spam');
    expect(result.success).toBe(false);
  });

  it('accepts valid report reasons', async () => {
    const validReasons = ['inappropriate', 'spam', 'fake', 'offensive', 'other'];
    for (const reason of validReasons) {
      resetData();
      __setMember({ _id: 'member-1' });
      __seed('PhotoReviews', [{ ...REVIEW_APPROVED }]);
      const result = await reportPhotoReview('rev-001', reason);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid report reason', async () => {
    const result = await reportPhotoReview('rev-001', 'i-made-this-up');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid reason/i);
  });

  it('escalates to pending when reportCount reaches threshold (5)', async () => {
    __seed('PhotoReviews', [{ ...REVIEW_APPROVED, reportCount: 4 }]);
    const result = await reportPhotoReview('rev-001', 'spam');
    expect(result.success).toBe(true);
    const updated = __getUpdated('PhotoReviews').find(r => r._id === 'rev-001');
    expect(updated.status).toBe('pending'); // escalated for re-moderation
    expect(updated.reportCount).toBe(5);
  });

  it('does not escalate when reportCount is below threshold', async () => {
    const result = await reportPhotoReview('rev-001', 'spam');
    expect(result.success).toBe(true);
    const updated = __getUpdated('PhotoReviews').find(r => r._id === 'rev-001');
    expect(updated.status).toBe('approved'); // no change
  });
});

// ── getPendingReviews ─────────────────────────────────────────────────

describe('getPendingReviews', () => {
  it('returns pending reviews for admin', async () => {
    const result = await getPendingReviews();
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews.every(r => r.status === 'pending')).toBe(true);
  });

  it('returns reviews sorted by submittedAt ascending (oldest first)', async () => {
    const result = await getPendingReviews();
    expect(result.success).toBe(true);
    const dates = result.reviews.map(r => new Date(r.submittedAt).getTime());
    expect(dates[0]).toBeLessThanOrEqual(dates[1]);
  });

  // Admin and auth enforcement is handled by Permissions.Admin at the Wix platform level;
  // not testable via unit tests since the webMethod mock strips permission wrappers.

  it('returns each review with expected fields', async () => {
    const result = await getPendingReviews();
    const review = result.reviews[0];
    expect(review).toHaveProperty('_id');
    expect(review).toHaveProperty('productId');
    expect(review).toHaveProperty('productName');
    expect(review).toHaveProperty('reviewText');
    expect(review).toHaveProperty('rating');
    expect(review).toHaveProperty('photoUrl');
    expect(review).toHaveProperty('submittedAt');
    expect(review).toHaveProperty('reportCount');
  });

  it('returns empty array when no pending reviews', async () => {
    __seed('PhotoReviews', [{ ...REVIEW_APPROVED }]);
    const result = await getPendingReviews();
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(0);
  });

  it('respects limit parameter without reducing totalCount', async () => {
    const result = await getPendingReviews(1);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(1);
    expect(result.totalCount).toBe(2);
  });

  it('includes totalCount matching the full pending set', async () => {
    const result = await getPendingReviews();
    expect(result).toHaveProperty('totalCount');
    expect(result.totalCount).toBeGreaterThanOrEqual(2);
  });
});
