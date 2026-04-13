/**
 * @file videoReviewServiceGetMethods.test.js
 * @description TDD tests for getProductVideoReviews and getVideoReviewCount
 * in videoReviewService.web.js — CF-ou66.3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  __reset as resetData,
  __seed,
  __setQueryError,
} from 'wix-data';

import {
  getProductVideoReviews,
  getVideoReviewCount,
} from '../src/backend/videoReviewService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT_ID = 'prod-abc';

function makeVideoReview(overrides = {}) {
  return {
    _id: `vr-${Math.random().toString(36).slice(2)}`,
    productId: PRODUCT_ID,
    memberId: 'member-1',
    mediaUrl: 'wix:video://v1/abc123_video.mp4',
    caption: 'Great futon!',
    reviewerName: 'Alice',
    status: 'approved',
    submittedAt: new Date('2026-03-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetData();
  __seed('VideoReviews', []);
});

// ── getProductVideoReviews — basic happy path ─────────────────────────────────

describe('getProductVideoReviews — happy path', () => {
  it('returns success:true with reviews array for a valid product', async () => {
    __seed('VideoReviews', [makeVideoReview()]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.reviews)).toBe(true);
    expect(result.reviews).toHaveLength(1);
  });

  it('returns only approved reviews', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ status: 'approved' }),
      makeVideoReview({ status: 'pending' }),
      makeVideoReview({ status: 'rejected' }),
    ]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews).toHaveLength(1);
  });

  it('returns reviews sorted newest-first', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ _id: 'vr-old', submittedAt: new Date('2026-01-01') }),
      makeVideoReview({ _id: 'vr-new', submittedAt: new Date('2026-03-15') }),
      makeVideoReview({ _id: 'vr-mid', submittedAt: new Date('2026-02-01') }),
    ]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    const dates = result.reviews.map(r => new Date(r.submittedAt).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it('returns at most 10 reviews', async () => {
    __seed(
      'VideoReviews',
      Array.from({ length: 15 }, (_, i) =>
        makeVideoReview({ _id: `vr-${i}`, submittedAt: new Date(2026, 0, i + 1) })
      )
    );
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews.length).toBeLessThanOrEqual(10);
  });

  it('returns empty array when no approved reviews exist', async () => {
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toEqual([]);
  });
});

// ── getProductVideoReviews — response shape ───────────────────────────────────

describe('getProductVideoReviews — response shape', () => {
  it('includes _id on each review', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-shape' })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0]._id).toBe('vr-shape');
  });

  it('includes mediaUrl on each review', async () => {
    __seed('VideoReviews', [makeVideoReview({ mediaUrl: 'wix:video://v1/test.mp4' })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].mediaUrl).toBe('wix:video://v1/test.mp4');
  });

  it('includes submittedAt on each review', async () => {
    const date = new Date('2026-03-10');
    __seed('VideoReviews', [makeVideoReview({ submittedAt: date })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].submittedAt).toBeTruthy();
  });

  it('includes reviewerName falling back to Customer when missing', async () => {
    __seed('VideoReviews', [makeVideoReview({ reviewerName: undefined })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].reviewerName).toBe('Customer');
  });

  it('includes reviewerName from the record', async () => {
    __seed('VideoReviews', [makeVideoReview({ reviewerName: 'Bob' })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].reviewerName).toBe('Bob');
  });

  it('includes caption defaulting to empty string when null', async () => {
    __seed('VideoReviews', [makeVideoReview({ caption: null })]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].caption).toBe('');
  });
});

// ── getProductVideoReviews — input validation ─────────────────────────────────

describe('getProductVideoReviews — input validation', () => {
  it('returns success:false for null productId', async () => {
    const result = await getProductVideoReviews(null);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns success:false for empty string productId', async () => {
    const result = await getProductVideoReviews('');
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns success:false for undefined productId', async () => {
    const result = await getProductVideoReviews(undefined);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });
});

// ── getProductVideoReviews — cross-product isolation ─────────────────────────

describe('getProductVideoReviews — cross-product isolation', () => {
  it('excludes reviews belonging to a different product', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ productId: PRODUCT_ID, status: 'approved' }),
      makeVideoReview({ productId: 'other-prod', status: 'approved' }),
    ]);
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].productId).toBe(PRODUCT_ID);
  });
});

// ── getProductVideoReviews — error handling ───────────────────────────────────

describe('getProductVideoReviews — error handling', () => {
  it('returns success:false on DB query error', async () => {
    __setQueryError('VideoReviews', new Error('DB read failed'));
    const result = await getProductVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

// ── getVideoReviewCount — happy path ──────────────────────────────────────────

describe('getVideoReviewCount — happy path', () => {
  it('returns count of approved reviews for a product', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ status: 'approved' }),
      makeVideoReview({ status: 'approved' }),
      makeVideoReview({ status: 'pending' }),
    ]);
    const result = await getVideoReviewCount(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('returns count:0 when no approved reviews', async () => {
    const result = await getVideoReviewCount(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
  });

  it('only counts reviews for the specified product', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ productId: PRODUCT_ID, status: 'approved' }),
      makeVideoReview({ productId: 'other-prod', status: 'approved' }),
    ]);
    const result = await getVideoReviewCount(PRODUCT_ID);
    expect(result.count).toBe(1);
  });

  it('returns count as a number', async () => {
    __seed('VideoReviews', [makeVideoReview()]);
    const result = await getVideoReviewCount(PRODUCT_ID);
    expect(typeof result.count).toBe('number');
  });
});

// ── getVideoReviewCount — input validation ────────────────────────────────────

describe('getVideoReviewCount — input validation', () => {
  it('returns success:false for null productId', async () => {
    const result = await getVideoReviewCount(null);
    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
  });

  it('returns success:false for empty string productId', async () => {
    const result = await getVideoReviewCount('');
    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
  });
});

// ── getVideoReviewCount — error handling ──────────────────────────────────────

describe('getVideoReviewCount — error handling', () => {
  it('returns success:false on DB query error', async () => {
    __setQueryError('VideoReviews', new Error('DB read failed'));
    const result = await getVideoReviewCount(PRODUCT_ID);
    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toBeTruthy();
  });
});
