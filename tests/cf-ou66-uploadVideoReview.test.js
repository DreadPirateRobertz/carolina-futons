/**
 * Tests for uploadVideoReview and getVideoReviewsForProduct
 * CF-ou66.1 — video upload backend
 *
 * Covers: duration>30s, invalid product, upload fail, duplicate, happy paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mediaManager } from 'wix-media-backend';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __setInsertError,
  __setQueryError,
} from 'wix-data';
import { __setMember } from 'wix-members-backend';

import {
  uploadVideoReview,
  getVideoReviewsForProduct,
} from '../src/backend/reviewsService.web.js';

const PRODUCT_ID = 'prod-abc';
const MEMBER_ID = 'member-xyz';
const VIDEO_BLOB = Buffer.from('fake-video-data');
const DURATION_OK = 15_000; // 15 s — within limit
const DURATION_OVER = 31_000; // 31 s — exceeds 30 s limit

function makeApprovedVideoReview(overrides = {}) {
  return {
    _id: `vr-${Math.random().toString(36).slice(2)}`,
    productId: PRODUCT_ID,
    memberId: MEMBER_ID,
    videoFileId: 'video_review_prod-abc_member-xyz.mp4',
    durationMs: DURATION_OK,
    status: 'approved',
    submittedAt: new Date('2026-03-01'),
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  __seed('VideoReviews', []);
  vi.restoreAllMocks();
  __setMember({ _id: MEMBER_ID });
});

// ── uploadVideoReview — happy path ────────────────────────────────────────────

describe('uploadVideoReview — happy path', () => {
  it('uploads blob and inserts pending_moderation record', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);

    expect(result.success).toBe(true);
    expect(result.reviewId).toBeTruthy();

    const inserted = __getInserted('VideoReviews');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].productId).toBe(PRODUCT_ID);
    expect(inserted[0].memberId).toBe(MEMBER_ID);
    expect(inserted[0].status).toBe('pending_moderation');
    expect(inserted[0].durationMs).toBe(DURATION_OK);
    expect(inserted[0].videoFileId).toBeTruthy();
  });

  it('stores submittedAt as a Date', async () => {
    await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].submittedAt).toBeInstanceOf(Date);
  });

  it('accepts video at exactly 30 s (boundary)', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, 30_000);
    expect(result.success).toBe(true);
  });
});

// ── uploadVideoReview — blob size guard ───────────────────────────────────────

describe('uploadVideoReview — blob size guard', () => {
  const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

  it('returns error when blob.size exceeds 100 MB (Blob-style)', async () => {
    const oversizedBlob = { size: MAX_BYTES + 1 };
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, oversizedBlob, DURATION_OK);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/100 MB/i);
  });

  it('returns error when blob.byteLength exceeds 100 MB (Buffer-style)', async () => {
    const oversizedBuffer = { byteLength: MAX_BYTES + 1 };
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, oversizedBuffer, DURATION_OK);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/100 MB/i);
  });

  it('accepts blob at exactly 100 MB (boundary)', async () => {
    vi.spyOn(mediaManager, 'upload').mockResolvedValue({ fileName: 'vid.mp4' });
    const exactBlob = { size: MAX_BYTES };
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, exactBlob, DURATION_OK);
    expect(result.success).toBe(true);
  });

  it('does not call mediaManager.upload for an oversized blob', async () => {
    const uploadSpy = vi.spyOn(mediaManager, 'upload');
    const oversizedBlob = { size: MAX_BYTES + 1 };
    await uploadVideoReview(PRODUCT_ID, MEMBER_ID, oversizedBlob, DURATION_OK);
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});

// ── uploadVideoReview — duration validation ───────────────────────────────────

describe('uploadVideoReview — duration > 30 s', () => {
  it('returns error when durationMs exceeds 30 000', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OVER);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/30 seconds/i);
  });

  it('returns error for durationMs = 30 001', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, 30_001);
    expect(result.success).toBe(false);
  });

  it('returns error for NaN duration', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, NaN);
    expect(result.success).toBe(false);
  });

  it('returns error when duration is a string', async () => {
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, '15000');
    expect(result.success).toBe(false);
  });
});

// ── uploadVideoReview — invalid product ──────────────────────────────────────

describe('uploadVideoReview — invalid product', () => {
  it('returns error for empty productId', async () => {
    const result = await uploadVideoReview('', MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product id/i);
  });

  it('returns error for null productId', async () => {
    const result = await uploadVideoReview(null, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
  });

  it('returns error for undefined productId', async () => {
    const result = await uploadVideoReview(undefined, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
  });
});

// ── uploadVideoReview — upload failure ───────────────────────────────────────

describe('uploadVideoReview — upload failure', () => {
  it('returns error when Wix Media Manager upload throws', async () => {
    vi.spyOn(mediaManager, 'upload').mockRejectedValueOnce(new Error('network error'));

    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/upload failed/i);
  });

  it('does not insert a record when upload fails', async () => {
    vi.spyOn(mediaManager, 'upload').mockRejectedValueOnce(new Error('timeout'));

    await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(__getInserted('VideoReviews')).toHaveLength(0);
  });

  it('returns error when DB insert throws after successful upload', async () => {
    __setInsertError('VideoReviews', new Error('DB write failed'));
    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
  });
});

// ── uploadVideoReview — duplicate ────────────────────────────────────────────

describe('uploadVideoReview — duplicate', () => {
  it('returns error when member already has a video review for the product', async () => {
    __seed('VideoReviews', [
      makeApprovedVideoReview({ productId: PRODUCT_ID, memberId: MEMBER_ID }),
    ]);

    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it('does not block a different member from submitting for the same product', async () => {
    __seed('VideoReviews', [
      makeApprovedVideoReview({ productId: PRODUCT_ID, memberId: 'other-member' }),
    ]);

    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(true);
  });

  it('does not block the same member from reviewing a different product', async () => {
    __seed('VideoReviews', [
      makeApprovedVideoReview({ productId: 'other-product', memberId: MEMBER_ID }),
    ]);

    const result = await uploadVideoReview(PRODUCT_ID, MEMBER_ID, VIDEO_BLOB, DURATION_OK);
    expect(result.success).toBe(true);
  });
});

// ── getVideoReviewsForProduct ─────────────────────────────────────────────────

describe('getVideoReviewsForProduct', () => {
  it('returns only approved reviews for the product', async () => {
    __seed('VideoReviews', [
      makeApprovedVideoReview({ _id: 'vr-1', status: 'approved' }),
      makeApprovedVideoReview({ _id: 'vr-2', status: 'pending_moderation' }),
      makeApprovedVideoReview({ _id: 'vr-3', status: 'rejected' }),
    ]);

    const result = await getVideoReviewsForProduct(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]._id).toBe('vr-1');
  });

  it('returns empty array when no approved reviews exist', async () => {
    const result = await getVideoReviewsForProduct(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toEqual([]);
  });

  it('does not return reviews for a different product', async () => {
    __seed('VideoReviews', [makeApprovedVideoReview({ productId: 'other-prod', status: 'approved' })]);

    const result = await getVideoReviewsForProduct(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(0);
  });

  it('returns error for empty productId', async () => {
    const result = await getVideoReviewsForProduct('');
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns error for null productId', async () => {
    const result = await getVideoReviewsForProduct(null);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns error on DB query failure', async () => {
    __setQueryError('VideoReviews', new Error('DB read failed'));
    const result = await getVideoReviewsForProduct(PRODUCT_ID);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });
});
