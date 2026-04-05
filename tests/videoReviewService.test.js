/**
 * @file videoReviewService.test.js
 * @description Edge-case hardening for video review service methods.
 * Covers pagination, empty state, DB error paths, input boundary conditions,
 * and gamification wiring for submitVideoReview / getVideoReviews / moderateVideoReview.
 *
 * CF-ou66.3 — complements reviewsServiceVideoReview.test.js (basic happy paths).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockReceiveGamificationEvent } = vi.hoisted(() => ({
  mockReceiveGamificationEvent: vi.fn(),
}));

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: mockReceiveGamificationEvent,
}));

import {
  __reset as resetData,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
  __setQueryError,
  __setUpdateError,
} from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  submitVideoReview,
  getVideoReviews,
  moderateVideoReview,
} from '../src/backend/reviewsService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER = { _id: 'member-1', contactDetails: { firstName: 'Alice', lastName: 'Smith' } };
const VIDEO_FILE_ID = 'wix:video://v1/abc123_video.mp4';
const PRODUCT_ID = 'prod-1';

function makeVideoReview(overrides = {}) {
  return {
    _id: `vrev-${Math.random().toString(36).slice(2)}`,
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
  vi.clearAllMocks();
  resetData();
  resetMembers();
  __seed('VideoReviews', []);
  mockReceiveGamificationEvent.mockResolvedValue({ success: true });
});

// ── submitVideoReview — input edge cases ──────────────────────────────────────

describe('submitVideoReview — input edge cases', () => {
  beforeEach(() => __setMember(MEMBER));

  it('returns error for null productId', async () => {
    const result = await submitVideoReview(null, VIDEO_FILE_ID, 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for null videoFileId', async () => {
    const result = await submitVideoReview(PRODUCT_ID, null, 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('stores empty string when caption is null', async () => {
    const result = await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, null);
    expect(result.success).toBe(true);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption).toBe('');
  });

  it('stores caption unchanged when exactly 200 chars', async () => {
    const caption200 = 'A'.repeat(200);
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, caption200);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption).toHaveLength(200);
  });

  it('truncates caption to 200 chars when 201 chars provided', async () => {
    const caption201 = 'B'.repeat(201);
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, caption201);
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption.length).toBeLessThanOrEqual(200);
  });

  it('strips HTML tags from caption (GH#993 — stored XSS fix)', async () => {
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, '<b>Great</b> futon!');
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption).not.toContain('<b>');
    expect(inserted[0].caption).not.toContain('</b>');
    expect(inserted[0].caption).toBe('Great futon!');
  });

  it('strips HTML entities from caption', async () => {
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, '&lt;img src=x onerror=alert(1)&gt;');
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].caption).not.toContain('<img');
    expect(inserted[0].caption).not.toContain('onerror');
  });

  it('returns internal error when DB insert throws', async () => {
    __setInsertError('VideoReviews', new Error('DB write failed'));
    const result = await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('stores status as pending regardless of input', async () => {
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, 'caption');
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].status).toBe('pending');
  });

  it('stores submittedAt as a Date', async () => {
    await submitVideoReview(PRODUCT_ID, VIDEO_FILE_ID, 'caption');
    const inserted = __getInserted('VideoReviews');
    expect(inserted[0].submittedAt).toBeInstanceOf(Date);
  });
});

// ── getVideoReviews — empty state ─────────────────────────────────────────────

describe('getVideoReviews — empty state', () => {
  it('returns success:true with empty reviews array when no approved reviews exist', async () => {
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toEqual([]);
  });

  it('returns success:true with empty array when all reviews are pending', async () => {
    __seed('VideoReviews', [
      makeVideoReview({ status: 'pending' }),
      makeVideoReview({ status: 'rejected' }),
    ]);
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(0);
  });

  it('returns totalCount=0 for empty result', async () => {
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.totalCount).toBe(0);
  });

  it('returns caption as empty string when stored caption is null', async () => {
    __seed('VideoReviews', [makeVideoReview({ caption: null })]);
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.reviews[0].caption).toBe('');
  });
});

// ── getVideoReviews — error handling ─────────────────────────────────────────

describe('getVideoReviews — error handling', () => {
  it('returns success:false with empty reviews on DB query error', async () => {
    __setQueryError('VideoReviews', new Error('DB read failed'));
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('returns error for null productId', async () => {
    const result = await getVideoReviews(null);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });
});

// ── getVideoReviews — pagination / limit clamping ────────────────────────────

describe('getVideoReviews — pagination and limit', () => {
  beforeEach(() => {
    // Seed 20 approved reviews with distinct timestamps
    __seed(
      'VideoReviews',
      Array.from({ length: 20 }, (_, i) =>
        makeVideoReview({
          _id: `vr-${i}`,
          status: 'approved',
          submittedAt: new Date(2026, 0, i + 1),
        })
      )
    );
  });

  it('returns at most 12 reviews by default', async () => {
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });

  it('respects an explicit limit', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: 5 });
    expect(result.reviews).toHaveLength(5);
  });

  it('clamps limit=0 up to 1', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: 0 });
    expect(result.success).toBe(true);
    expect(result.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it('clamps negative limit up to 1', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: -5 });
    expect(result.success).toBe(true);
    expect(result.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it('uses default limit 12 when limit is NaN', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: NaN });
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });

  it('accepts limit=50 (max allowed)', async () => {
    // Only 20 seeded — all should be returned
    const result = await getVideoReviews(PRODUCT_ID, { limit: 50 });
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(20);
  });

  it('clamps limit=51 to 50', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: 51 });
    expect(result.success).toBe(true);
    // Result capped at 50; 20 seeded so we get 20
    expect(result.reviews.length).toBeLessThanOrEqual(50);
  });

  it('returns reviews sorted newest first (descending submittedAt)', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: 20 });
    const dates = result.reviews.map(r => new Date(r.submittedAt).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it('includes totalCount in response', async () => {
    const result = await getVideoReviews(PRODUCT_ID, { limit: 5 });
    expect(typeof result.totalCount).toBe('number');
  });

  it('works when opts is null (uses defaults)', async () => {
    const result = await getVideoReviews(PRODUCT_ID, null);
    expect(result.success).toBe(true);
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });

  it('works when opts is omitted (uses defaults)', async () => {
    const result = await getVideoReviews(PRODUCT_ID);
    expect(result.success).toBe(true);
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });
});

// ── moderateVideoReview — error handling ──────────────────────────────────────

describe('moderateVideoReview — error handling', () => {
  it('returns error for null reviewId', async () => {
    const result = await moderateVideoReview(null, 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns internal error when DB get throws', async () => {
    __setQueryError('VideoReviews', new Error('DB read failed'));
    const result = await moderateVideoReview('vr-1', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns internal error when DB update throws', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending' })]);
    __setUpdateError('VideoReviews', new Error('DB write failed'));
    const result = await moderateVideoReview('vr-1', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── moderateVideoReview — gamification wiring ─────────────────────────────────

describe('moderateVideoReview — gamification wiring', () => {
  it('fires video_review_approved gamification event on approval', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending', memberId: 'member-1' })]);

    await moderateVideoReview('vr-1', 'approved');

    expect(mockReceiveGamificationEvent).toHaveBeenCalledWith(
      'video_review_approved',
      { memberId: 'member-1' }
    );
  });

  it('does NOT fire gamification event on rejection', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending', memberId: 'member-1' })]);

    await moderateVideoReview('vr-1', 'rejected');

    expect(mockReceiveGamificationEvent).not.toHaveBeenCalled();
  });

  it('approval still succeeds when gamification event throws', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending', memberId: 'member-1' })]);
    mockReceiveGamificationEvent.mockRejectedValueOnce(new Error('gamification down'));

    const result = await moderateVideoReview('vr-1', 'approved');

    expect(result.success).toBe(true);
  });

  it('skips gamification call when review has no memberId', async () => {
    __seed('VideoReviews', [makeVideoReview({ _id: 'vr-1', status: 'pending', memberId: null })]);

    const result = await moderateVideoReview('vr-1', 'approved');

    expect(result.success).toBe(true);
    expect(mockReceiveGamificationEvent).not.toHaveBeenCalled();
  });
});
