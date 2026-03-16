import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  getAggregateRating,
  moderateReview,
  getCategoryReviewSummaries,
} from '../src/backend/reviewsService.web.js';

const ADMIN_MEMBER = { _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' };

function seedReviews(items) { __seed('Reviews', items); }

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(ADMIN_MEMBER);
});

// ═══════════════════════════════════════════════════════════════════
// 1. TEXT REVIEW MODERATION WORKFLOW
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
// 2. MODERATION WITH MISSING/CORRUPT STATUS FIELDS
// ═══════════════════════════════════════════════════════════════════

describe('text review moderation with missing status field', () => {
  it('text review with undefined status falls back to pending and can be approved', async () => {
    seedReviews([{
      _id: 'rev-nostatus', productId: 'prod-1', memberId: 'member-x',
      authorName: 'Test', rating: 4, title: 'OK', body: 'Decent product.',
      status: undefined, _createdDate: new Date(),
    }]);
    const result = await moderateReview('rev-nostatus', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('approved');
  });

  it('text review with null status falls back to pending', async () => {
    seedReviews([{
      _id: 'rev-null', productId: 'prod-1', memberId: 'member-x',
      authorName: 'Test', rating: 3, title: 'Meh', body: 'Average quality.',
      status: null, _createdDate: new Date(),
    }]);
    const result = await moderateReview('rev-null', 'reject');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
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
// 4. CATEGORY REVIEW SUMMARIES NaN HARDENING
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
