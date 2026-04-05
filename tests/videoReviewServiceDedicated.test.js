/**
 * @file videoReviewServiceDedicated.test.js
 * @description TDD tests for CF-q5hq: videoReviewService.web.js — dedicated
 * video review upload API for cross-platform consumption (web + Dallas mobile).
 *
 * Covers:
 *  - submitVideoReview: mediaUrl validation (Wix-only), auth, caption cap, DB insert
 *  - Non-Wix URI rejection: http, https, data:, javascript:, relative paths
 *  - Accepted Wix URI schemes: wix:video://, wix:image://, static.wixstatic.com, wixmp.com
 *  - getVideoReviews: approved-only, pagination, limit clamping, field shape
 *  - moderateVideoReview: approve, reject, gamification wiring, error paths
 *  - API contract constants exported for mobile SDK consumption
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
  __setQueryError,
  __setUpdateError,
} from './__mocks__/wix-data.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';

// ── Gamification mock ─────────────────────────────────────────────────────────

const { mockReceiveGamificationEvent } = vi.hoisted(() => ({
  mockReceiveGamificationEvent: vi.fn(),
}));

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: mockReceiveGamificationEvent,
}));

import {
  submitVideoReview,
  getVideoReviews,
  moderateVideoReview,
  VIDEO_REVIEWS_COLLECTION,
  VALID_VIDEO_URI_SCHEMES,
} from '../src/backend/videoReviewService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER   = { _id: 'member-1', contactDetails: { firstName: 'Alice' } };
const PROD_ID  = 'prod-futon-1';
const WIX_VIDEO_URL = 'wix:video://v1/abc123_review.mp4/abc123_review.mp4#origFileName=review.mp4';
const WIX_IMG_URL   = 'wix:image://v1/abc123/photo.jpg';
const CDN_URL       = 'https://static.wixstatic.com/media/abc~mv2.jpg';
const WIXMP_URL     = 'https://video.wixmp.com/files/abc123/review.mp4';

function makeReview(overrides = {}) {
  return {
    _id: `rev-${Math.random().toString(36).slice(2)}`,
    productId: PROD_ID,
    memberId: 'member-1',
    mediaUrl: WIX_VIDEO_URL,
    caption: 'Great futon!',
    status: 'approved',
    submittedAt: new Date('2026-03-01'),
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  __reset();
  resetMembers();
  __seed(VIDEO_REVIEWS_COLLECTION, []);
  mockReceiveGamificationEvent.mockResolvedValue({ success: true });
});

// ── Exported constants ────────────────────────────────────────────────────────

describe('videoReviewService — API contract constants', () => {
  it('exports VIDEO_REVIEWS_COLLECTION string', () => {
    expect(typeof VIDEO_REVIEWS_COLLECTION).toBe('string');
    expect(VIDEO_REVIEWS_COLLECTION).toBe('VideoReviews');
  });

  it('exports VALID_VIDEO_URI_SCHEMES array with wix:video scheme', () => {
    expect(Array.isArray(VALID_VIDEO_URI_SCHEMES)).toBe(true);
    expect(VALID_VIDEO_URI_SCHEMES.some(s => s.includes('wix:video'))).toBe(true);
  });
});

// ── submitVideoReview — Wix URI acceptance ────────────────────────────────────

describe('submitVideoReview — accepted Wix media URIs', () => {
  beforeEach(() => __setMember(MEMBER));

  it('accepts wix:video:// URI', async () => {
    const result = await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'Great');
    expect(result.success).toBe(true);
    expect(result.reviewId).toBeTruthy();
  });

  it('accepts wix:image:// URI (photo review)', async () => {
    const result = await submitVideoReview(PROD_ID, WIX_IMG_URL, '');
    expect(result.success).toBe(true);
  });

  it('accepts static.wixstatic.com CDN URL', async () => {
    const result = await submitVideoReview(PROD_ID, CDN_URL, '');
    expect(result.success).toBe(true);
  });

  it('accepts *.wixmp.com CDN URL', async () => {
    const result = await submitVideoReview(PROD_ID, WIXMP_URL, '');
    expect(result.success).toBe(true);
  });
});

// ── submitVideoReview — non-Wix URI rejection ─────────────────────────────────

describe('submitVideoReview — non-Wix URI rejection', () => {
  beforeEach(() => __setMember(MEMBER));

  it('rejects arbitrary https:// URL', async () => {
    const result = await submitVideoReview(PROD_ID, 'https://youtube.com/watch?v=abc', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });

  it('rejects arbitrary http:// URL', async () => {
    const result = await submitVideoReview(PROD_ID, 'http://attacker.com/video.mp4', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });

  it('rejects javascript: URI', async () => {
    const result = await submitVideoReview(PROD_ID, 'javascript:alert(1)', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });

  it('rejects data: URI', async () => {
    const result = await submitVideoReview(PROD_ID, 'data:video/mp4;base64,AAAA', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });

  it('rejects relative path', async () => {
    const result = await submitVideoReview(PROD_ID, '../uploads/video.mp4', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });

  it('rejects URL that looks like wixstatic but is not', async () => {
    const result = await submitVideoReview(PROD_ID, 'https://evil.com/wixstatic.com/video.mp4', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/wix media/i);
  });
});

// ── submitVideoReview — input validation ──────────────────────────────────────

describe('submitVideoReview — input validation', () => {
  beforeEach(() => __setMember(MEMBER));

  it('rejects missing productId', async () => {
    const result = await submitVideoReview(null, WIX_VIDEO_URL, '');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects empty mediaUrl', async () => {
    const result = await submitVideoReview(PROD_ID, '', '');
    expect(result.success).toBe(false);
  });

  it('rejects missing mediaUrl (undefined)', async () => {
    const result = await submitVideoReview(PROD_ID, undefined, '');
    expect(result.success).toBe(false);
  });

  it('rejects when member not authenticated', async () => {
    resetMembers();
    const result = await submitVideoReview(PROD_ID, WIX_VIDEO_URL, '');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('stores caption as empty string when null provided', async () => {
    await submitVideoReview(PROD_ID, WIX_VIDEO_URL, null);
    const inserted = __getInserted(VIDEO_REVIEWS_COLLECTION);
    expect(inserted[0].caption).toBe('');
  });

  it('truncates caption to 200 chars', async () => {
    const long = 'x'.repeat(300);
    await submitVideoReview(PROD_ID, WIX_VIDEO_URL, long);
    const inserted = __getInserted(VIDEO_REVIEWS_COLLECTION);
    expect(inserted[0].caption.length).toBeLessThanOrEqual(200);
  });

  it('stores status as pending regardless of caller input', async () => {
    await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'caption');
    const inserted = __getInserted(VIDEO_REVIEWS_COLLECTION);
    expect(inserted[0].status).toBe('pending');
  });

  it('stores submittedAt as a Date', async () => {
    await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'caption');
    const inserted = __getInserted(VIDEO_REVIEWS_COLLECTION);
    expect(inserted[0].submittedAt).toBeInstanceOf(Date);
  });

  it('stores mediaUrl (not videoFileId) in the record', async () => {
    await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'caption');
    const inserted = __getInserted(VIDEO_REVIEWS_COLLECTION);
    expect(inserted[0].mediaUrl).toBe(WIX_VIDEO_URL);
  });

  it('returns reviewId on success', async () => {
    const result = await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'caption');
    expect(result.success).toBe(true);
    expect(result.reviewId).toBeTruthy();
  });

  it('returns error on DB insert failure', async () => {
    __setInsertError(VIDEO_REVIEWS_COLLECTION, new Error('DB error'));
    const result = await submitVideoReview(PROD_ID, WIX_VIDEO_URL, 'caption');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── getVideoReviews ───────────────────────────────────────────────────────────

describe('getVideoReviews', () => {
  it('returns approved reviews for a product', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [
      makeReview({ _id: 'r1', status: 'approved' }),
      makeReview({ _id: 'r2', status: 'approved' }),
      makeReview({ _id: 'r3', status: 'pending' }),
    ]);
    const result = await getVideoReviews(PROD_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(2);
  });

  it('does not return pending or rejected reviews', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [
      makeReview({ _id: 'r1', status: 'pending' }),
      makeReview({ _id: 'r2', status: 'rejected' }),
    ]);
    const result = await getVideoReviews(PROD_ID);
    expect(result.reviews).toHaveLength(0);
  });

  it('returns empty array for product with no reviews', async () => {
    const result = await getVideoReviews(PROD_ID);
    expect(result.success).toBe(true);
    expect(result.reviews).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('review objects include mediaUrl field', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ status: 'approved' })]);
    const result = await getVideoReviews(PROD_ID);
    expect(result.reviews[0]).toHaveProperty('mediaUrl');
    expect(result.reviews[0]).toHaveProperty('caption');
    expect(result.reviews[0]).toHaveProperty('submittedAt');
    expect(result.reviews[0]).toHaveProperty('_id');
  });

  it('defaults limit to 12', async () => {
    const reviews = Array.from({ length: 20 }, (_, i) =>
      makeReview({ _id: `r${i}`, status: 'approved' })
    );
    __seed(VIDEO_REVIEWS_COLLECTION, reviews);
    const result = await getVideoReviews(PROD_ID);
    expect(result.reviews.length).toBeLessThanOrEqual(12);
  });

  it('respects explicit limit', async () => {
    const reviews = Array.from({ length: 20 }, (_, i) =>
      makeReview({ _id: `r${i}`, status: 'approved' })
    );
    __seed(VIDEO_REVIEWS_COLLECTION, reviews);
    const result = await getVideoReviews(PROD_ID, { limit: 5 });
    expect(result.reviews).toHaveLength(5);
  });

  it('clamps limit to max 50', async () => {
    const reviews = Array.from({ length: 20 }, (_, i) =>
      makeReview({ _id: `r${i}`, status: 'approved' })
    );
    __seed(VIDEO_REVIEWS_COLLECTION, reviews);
    const result = await getVideoReviews(PROD_ID, { limit: 200 });
    expect(result.reviews.length).toBeLessThanOrEqual(50);
  });

  it('returns success:false for invalid productId', async () => {
    const result = await getVideoReviews(null);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns success:false on DB error', async () => {
    __setQueryError(VIDEO_REVIEWS_COLLECTION, new Error('DB read failed'));
    const result = await getVideoReviews(PROD_ID);
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
  });

  it('returns totalCount', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ status: 'approved' })]);
    const result = await getVideoReviews(PROD_ID);
    expect(typeof result.totalCount).toBe('number');
  });
});

// ── moderateVideoReview ───────────────────────────────────────────────────────

describe('moderateVideoReview', () => {
  it('approves a pending review', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending' })]);
    const result = await moderateVideoReview('r1', 'approved');
    expect(result.success).toBe(true);
    const updated = __getUpdated(VIDEO_REVIEWS_COLLECTION);
    expect(updated[0].status).toBe('approved');
  });

  it('rejects a pending review', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending' })]);
    const result = await moderateVideoReview('r1', 'rejected');
    expect(result.success).toBe(true);
    const updated = __getUpdated(VIDEO_REVIEWS_COLLECTION);
    expect(updated[0].status).toBe('rejected');
  });

  it('fires video_review_approved gamification event on approval', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending', memberId: 'member-1' })]);
    await moderateVideoReview('r1', 'approved');
    expect(mockReceiveGamificationEvent).toHaveBeenCalledWith(
      'video_review_approved', { memberId: 'member-1' }
    );
  });

  it('does not fire gamification event on rejection', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending', memberId: 'member-1' })]);
    await moderateVideoReview('r1', 'rejected');
    expect(mockReceiveGamificationEvent).not.toHaveBeenCalled();
  });

  it('approval succeeds when gamification throws', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending' })]);
    mockReceiveGamificationEvent.mockRejectedValueOnce(new Error('gamification down'));
    const result = await moderateVideoReview('r1', 'approved');
    expect(result.success).toBe(true);
  });

  it('returns error for invalid reviewId', async () => {
    const result = await moderateVideoReview(null, 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for invalid action', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending' })]);
    const result = await moderateVideoReview('r1', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/approved.*rejected|action/i);
  });

  it('returns error when review not found', async () => {
    const result = await moderateVideoReview('nonexistent', 'approved');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error on DB update failure', async () => {
    __seed(VIDEO_REVIEWS_COLLECTION, [makeReview({ _id: 'r1', status: 'pending' })]);
    __setUpdateError(VIDEO_REVIEWS_COLLECTION, new Error('DB write failed'));
    const result = await moderateVideoReview('r1', 'approved');
    expect(result.success).toBe(false);
  });
});

// ── subscriberDeviceToken integration ────────────────────────────────────────
// Verifies that priceAlertService.subscribe stores and returns the
// subscriberDeviceToken field — the cross-platform field used by dallas mobile
// for FCM/APNs push notifications on price drops.

import {
  subscribe,
  getSubscribers,
} from '../src/backend/priceAlertService.web.js';

describe('PriceAlerts — subscriberDeviceToken integration (CF-q5hq)', () => {
  beforeEach(() => __reset());

  it('subscribe stores subscriberDeviceToken when provided', async () => {
    await subscribe('prod-1', 'buyer@example.com', 'fcm-token-abc123');
    const inserted = __getInserted('PriceAlerts');
    expect(inserted[0].subscriberDeviceToken).toBe('fcm-token-abc123');
  });

  it('subscribe stores null when no deviceToken provided', async () => {
    await subscribe('prod-1', 'buyer@example.com');
    const inserted = __getInserted('PriceAlerts');
    expect(inserted[0].subscriberDeviceToken).toBeNull();
  });

  it('subscribe stores null for empty-string deviceToken', async () => {
    await subscribe('prod-1', 'buyer@example.com', '');
    const inserted = __getInserted('PriceAlerts');
    expect(inserted[0].subscriberDeviceToken).toBeNull();
  });

  it('subscribe truncates deviceToken to 500 chars', async () => {
    const longToken = 'x'.repeat(600);
    await subscribe('prod-1', 'buyer@example.com', longToken);
    const inserted = __getInserted('PriceAlerts');
    expect(inserted[0].subscriberDeviceToken).toHaveLength(500);
  });

  it('getSubscribers includes subscriberDeviceToken in each record', async () => {
    __seed('PriceAlerts', [{
      _id: 's1',
      productId: 'prod-1',
      email: 'buyer@example.com',
      active: true,
      subscribedAt: new Date(),
      subscriberDeviceToken: 'fcm-token-xyz',
    }]);
    const result = await getSubscribers('prod-1');
    expect(result.success).toBe(true);
    expect(result.subscribers[0].subscriberDeviceToken).toBe('fcm-token-xyz');
  });

  it('getSubscribers returns null subscriberDeviceToken for web-only subscriber', async () => {
    __seed('PriceAlerts', [{
      _id: 's1',
      productId: 'prod-1',
      email: 'web@example.com',
      active: true,
      subscribedAt: new Date(),
      subscriberDeviceToken: null,
    }]);
    const result = await getSubscribers('prod-1');
    expect(result.subscribers[0].subscriberDeviceToken).toBeNull();
  });

  it('subscriber payload shape matches dallas webhook contract', async () => {
    __seed('PriceAlerts', [{
      _id: 's1',
      productId: 'prod-1',
      email: 'mobile@example.com',
      active: true,
      subscribedAt: new Date(),
      subscriberDeviceToken: 'apns-token-abc',
    }]);
    const result = await getSubscribers('prod-1');
    const sub = result.subscribers[0];
    // Dallas webhook contract: { email, productId, subscribedAt, subscriberDeviceToken }
    expect(sub).toHaveProperty('email');
    expect(sub).toHaveProperty('productId');
    expect(sub).toHaveProperty('subscribedAt');
    expect(sub).toHaveProperty('subscriberDeviceToken');
  });
});
