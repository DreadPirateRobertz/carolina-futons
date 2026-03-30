/**
 * Tests for video review methods in reviewsService.web.js
 * submitVideoReview, getVideoReviews, moderateVideoReview
 *
 * CF-ou66.1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted, __getUpdated } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  submitVideoReview,
  getVideoReviews,
  moderateVideoReview,
} from '../src/backend/reviewsService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const MEMBER = { _id: 'member-1', contactDetails: { firstName: 'Alice', lastName: 'Smith' } };
const VIDEO_FILE_ID = 'wix:video://v1/abc123_video.mp4';
const PRODUCT_ID = 'prod-1';

function makeVideoReview(overrides = {}) {
  return {
    _id: 'vrev-1',
    productId: PRODUCT_ID,
    memberId: 'member-1',
    videoFileId: VIDEO_FILE_ID,
    caption: 'Great futon!',
    status: 'approved',
    submittedAt: new Date('2026-03-01'),
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  resetMembers();
  __seed('VideoReviews', []);
  __seed('Reviews', []);
  __seed('Stores/Orders', []);
});

// ── submitVideoReview ─────────────────────────────────────────────────

describe('submitVideoReview', () => {
  beforeEach(() => {
    __setMember(MEMBER);
  });

  it('inserts a pending video review', async () => {
    const result = await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, 'Our setup!');
    expect(result.success).toBe(true);
    expect(result.reviewId).toBeTruthy();

    const inserted = __getInserted('VideoReviews');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].productId).toBe(PRODUCT_ID);
    expect(inserted[0].memberId).toBe('member-1');
    expect(inserted[0].videoFileId).toBe(VIDEO_FILE_ID);
    expect(inserted[0].status).toBe('pending');
  });

  it('saves caption trimmed to 200 chars', async () => {
    const longCaption = 'A'.repeat(300);
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, longCaption);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption.length).toBeLessThanOrEqual(200);
  });

  it('allows empty caption', async () => {
    const result = await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, '');
    expect(result.success).toBe(true);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption).toBe('');
  });

  it('returns error for empty productId', async () => {
    const result = await submitVideoReview('', VIDEO_FILE_ID, 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product id/i);
  });

  it('returns error for missing videoFileId', async () => {
    const result = await submitVideoReview(PRODUCT_ID, '', 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/video file/i);
  });

  it('returns error for invalid video URL (not wix: scheme)', async () => {
    const result = await submitVideoReview(PRODUCT_ID, 'https://youtube.com/video', 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns error when member not logged in', async () => {
    resetMembers(); // no member set
    const result = await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, 'caption');
    expect(result.success).toBe(false);
  });
});

// ── getVideoReviews ───────────────────────────────────────────────────

describe('getVideoReviews', () => {
  it('returns approved video reviews for a product', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ _id: 'vr-1', status: 'approved' }),
      makeVideoReview({ _id: 'vr-2', status: 'pending' }),
    ]);

    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]._id).toBe('vr-1');
  });

  it('does not return reviews for a different product', async () => {
    __seed('VideoReviews', [makeVideoReview({ productId: 'other-prod', status: 'approved' })]);
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(0);
  });

  it('returns correct shape per review', async () => {
    __seed('VideoReviews', [makeVideoReview()]);
    const result = await getVideoReviews(PRODUCT_ID);
    const r = result.reviews[0];
    expect(r).toHaveProperty('_id');
    expect(r).toHaveProperty('videoFileId');
    expect(r).toHaveProperty('caption');
    expect(r).toHaveProperty('submittedAt');
    expect(r).not.toHaveProperty('memberId'); // not exposed
  });

  it('defaults limit to 12', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeVideoReview({ _id: `vr-${i}`, status: 'approved' })
    );
    __seed('VideoReviews', many);
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });

  it('clamps limit to 50 max', async () => {
    __seed('VideoReviews', []);
    const result = await getVideoReviews(PRODUCT_ID, { limit: 999 });
    expect(result.success).toBe(true);
  });

  it('returns error for empty productId', async () => {
    const result = await getVideoReviews('');
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });
});

// ── moderateVideoReview ───────────────────────────────────────────────

describe('moderateVideoReview', () => {
  it('approves a pending video review', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending', memberId: 'member-1' })]);

    const result = await moderateVideoReview('vr-1', 'approved');
    expect(result.success).toBe(true);

    const updated = __getUpdated('VideoReviews');
    expect(updated[0].status).toBe('approved');
  });

  it('rejects a pending video review', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending' })]);

    const result = await moderateVideoReview('vr-1', 'rejected');
    expect(result.success).toBe(true);

    const updated = __getUpdated('VideoReviews');
    expect(updated[0].status).toBe('rejected');
  });

  it('returns error for invalid action', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1' })]);
    const result = await moderateVideoReview('vr-1', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/approved.*rejected/i);
  });

  it('returns error for empty reviewId', async () => {
    const result = await moderateVideoReview('', 'approved');
    expect(result.success).toBe(false);
  });

  it('returns error when review not found', async () => {
    const result = await moderateVideoReview('nonexistent', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
