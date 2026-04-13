/**
 * @file crossRigEventReceiver.test.js
 * @description TDD tests for cf-87tn: crossRigEvent webMethod.
 *
 * Covers:
 *  - schema validation (missing event, unknown event, missing schemaVersion)
 *  - unauthenticated caller returns 401
 *  - streak_extended: logs analytics event with correct memberId + eventType
 *  - challenge_started: logs analytics event with challengeId in payload
 *  - redemption_initiated: logs analytics event with delta + newTotal in payload
 *  - analytics write failure returns { success: false }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __setInsertError,
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  __reset as __resetMembers,
  __setMember,
} from './__mocks__/wix-members-backend.js';
import { crossRigEvent } from '../src/backend/crossRigEventReceiver.web.js';
import { ANALYTICS_EVENTS_COLLECTION } from '../src/backend/utils/analyticsEvents.js';

vi.mock('backend/utils/crossRigSyncUtils', () => ({
  syncBadgeEarnedToPush: vi.fn(async () => ({ success: true, pushSent: 1 })),
}));

vi.mock('backend/pushNotificationService.web', () => ({
  sendPushToMember: vi.fn(async () => ({ sent: 1, failed: 0 })),
  PUSH_EVENTS: {
    BADGE_EARNED: 'badge_earned',
    TIER_CHANGED: 'tier_changed',
  },
}));

vi.mock('backend/mobileChallengeService.web', () => ({
  completeMobileChallenge: vi.fn(async () => ({ success: true, alreadyAwarded: false, pointsAwarded: 75 })),
  MOBILE_CHALLENGE_TYPES: {
    AR_DISCOVERY: 'ar_discovery',
    QUIZ_COMPLETION: 'quiz_completion',
    SOCIAL_SHARE: 'social_share',
  },
}));

beforeEach(() => {
  __reset();
  __resetMembers();
  vi.clearAllMocks();
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe('crossRigEvent — schema validation', () => {
  it('returns 400 when event field is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ schemaVersion: '1.0', delta: 0, newTotal: 0 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 when event is unknown', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'mystery_event', schemaVersion: '1.0' });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 when schemaVersion is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'streak_extended', streak: 3, delta: 1, newTotal: 50 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('error message mentions the unsupported event name', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({ event: 'bad_event', schemaVersion: '1.0' });
    expect(result.error).toMatch(/bad_event/);
  });
});

// ── Unauthenticated ───────────────────────────────────────────────────────────

describe('crossRigEvent — unauthenticated', () => {
  it('returns 401 when no member session', async () => {
    // __setMember not called — default null member
    const result = await crossRigEvent({
      eventId: 'ev-1',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 2,
      delta: 1,
      newTotal: 50,
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  it('does not log analytics when unauthenticated', async () => {
    await crossRigEvent({
      eventId: 'ev-2',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 2,
      delta: 1,
      newTotal: 50,
    });
    expect(__getInserted(ANALYTICS_EVENTS_COLLECTION)).toHaveLength(0);
  });
});

// ── streak_extended ───────────────────────────────────────────────────────────

describe('crossRigEvent — streak_extended', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await crossRigEvent({
      eventId: 'ev-3',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 5,
      delta: 1,
      newTotal: 100,
      source: 'mobile',
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].eventType).toBe('streak_extended');
    expect(inserted[0].memberId).toBe('mem-1');
  });

  it('stores streak count in analytics payload', async () => {
    __setMember({ _id: 'mem-1' });
    await crossRigEvent({
      eventId: 'ev-4',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 7,
      delta: 1,
      newTotal: 200,
    });
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const payload = JSON.parse(inserted[0].payload);
    expect(payload.streak).toBe(7);
    expect(payload.delta).toBe(1);
    expect(payload.newTotal).toBe(200);
  });
});

// ── challenge_started ─────────────────────────────────────────────────────────

describe('crossRigEvent — challenge_started', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-2' });
    const result = await crossRigEvent({
      eventId: 'ev-5',
      schemaVersion: '1.0',
      event: 'challenge_started',
      challengeId: 'ch-abc',
      delta: 0,
      newTotal: 300,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('challenge_started');
    expect(inserted[0].memberId).toBe('mem-2');
  });

  it('stores challengeId in analytics payload', async () => {
    __setMember({ _id: 'mem-2' });
    await crossRigEvent({
      eventId: 'ev-6',
      schemaVersion: '1.0',
      event: 'challenge_started',
      challengeId: 'ch-xyz',
      delta: 0,
      newTotal: 300,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.challengeId).toBe('ch-xyz');
  });
});

// ── redemption_initiated ──────────────────────────────────────────────────────

describe('crossRigEvent — redemption_initiated', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-3' });
    const result = await crossRigEvent({
      eventId: 'ev-7',
      schemaVersion: '1.0',
      event: 'redemption_initiated',
      delta: -50,
      newTotal: 150,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('redemption_initiated');
    expect(inserted[0].memberId).toBe('mem-3');
  });

  it('stores negative delta in analytics payload', async () => {
    __setMember({ _id: 'mem-3' });
    await crossRigEvent({
      eventId: 'ev-8',
      schemaVersion: '1.0',
      event: 'redemption_initiated',
      delta: -75,
      newTotal: 25,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.delta).toBe(-75);
    expect(payload.newTotal).toBe(25);
  });
});

// ── quiz_completed ────────────────────────────────────────────────────────────

describe('crossRigEvent — quiz_completed', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-5' });
    const result = await crossRigEvent({
      eventId: 'ev-q1',
      schemaVersion: '1.0',
      event: 'quiz_completed',
      quizId: 'sommelier-v2',
      resultSlug: 'cozy-minimalist',
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].eventType).toBe('quiz_completed');
    expect(inserted[0].memberId).toBe('mem-5');
  });

  it('stores quizId and resultSlug in payload', async () => {
    __setMember({ _id: 'mem-5' });
    await crossRigEvent({
      eventId: 'ev-q2',
      schemaVersion: '1.0',
      event: 'quiz_completed',
      quizId: 'style-quiz-v1',
      resultSlug: 'bold-industrial',
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.quizId).toBe('style-quiz-v1');
    expect(payload.resultSlug).toBe('bold-industrial');
  });

  it('returns 400 when quizId is missing', async () => {
    __setMember({ _id: 'mem-5' });
    const result = await crossRigEvent({
      eventId: 'ev-q-bad',
      schemaVersion: '1.0',
      event: 'quiz_completed',
      resultSlug: 'cozy-minimalist',
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 when resultSlug is missing', async () => {
    __setMember({ _id: 'mem-5' });
    const result = await crossRigEvent({
      eventId: 'ev-q-bad2',
      schemaVersion: '1.0',
      event: 'quiz_completed',
      quizId: 'sommelier-v2',
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});

// ── product_favorited ─────────────────────────────────────────────────────────

describe('crossRigEvent — product_favorited', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-6' });
    const result = await crossRigEvent({
      eventId: 'ev-pf1',
      schemaVersion: '1.0',
      event: 'product_favorited',
      productId: 'prod-abc123',
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('product_favorited');
    expect(inserted[0].memberId).toBe('mem-6');
  });

  it('stores productId in payload', async () => {
    __setMember({ _id: 'mem-6' });
    await crossRigEvent({
      eventId: 'ev-pf2',
      schemaVersion: '1.0',
      event: 'product_favorited',
      productId: 'prod-xyz789',
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.productId).toBe('prod-xyz789');
  });

  it('returns 400 when productId is missing', async () => {
    __setMember({ _id: 'mem-6' });
    const result = await crossRigEvent({
      eventId: 'ev-pf-bad',
      schemaVersion: '1.0',
      event: 'product_favorited',
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});

// ── cart_abandoned ────────────────────────────────────────────────────────────

describe('crossRigEvent — cart_abandoned', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-7' });
    const result = await crossRigEvent({
      eventId: 'ev-ca1',
      schemaVersion: '1.0',
      event: 'cart_abandoned',
      cartId: 'cart-111',
      cartTotal: 499.99,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('cart_abandoned');
    expect(inserted[0].memberId).toBe('mem-7');
  });

  it('stores cartId and cartTotal in payload', async () => {
    __setMember({ _id: 'mem-7' });
    await crossRigEvent({
      eventId: 'ev-ca2',
      schemaVersion: '1.0',
      event: 'cart_abandoned',
      cartId: 'cart-222',
      cartTotal: 1299.00,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.cartId).toBe('cart-222');
    expect(payload.cartTotal).toBe(1299.00);
  });

  it('returns 400 when cartId is missing', async () => {
    __setMember({ _id: 'mem-7' });
    const result = await crossRigEvent({
      eventId: 'ev-ca-bad',
      schemaVersion: '1.0',
      event: 'cart_abandoned',
      cartTotal: 499.99,
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('accepts cartTotal of 0 (valid value)', async () => {
    __setMember({ _id: 'mem-7' });
    const result = await crossRigEvent({
      eventId: 'ev-ca-zero',
      schemaVersion: '1.0',
      event: 'cart_abandoned',
      cartId: 'cart-empty',
      cartTotal: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ── loyalty_tier_reached ──────────────────────────────────────────────────────

describe('crossRigEvent — loyalty_tier_reached', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-8' });
    const result = await crossRigEvent({
      eventId: 'ev-lt1',
      schemaVersion: '1.0',
      event: 'loyalty_tier_reached',
      tier: 'Gold',
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('loyalty_tier_reached');
    expect(inserted[0].memberId).toBe('mem-8');
  });

  it('stores tier in payload', async () => {
    __setMember({ _id: 'mem-8' });
    await crossRigEvent({
      eventId: 'ev-lt2',
      schemaVersion: '1.0',
      event: 'loyalty_tier_reached',
      tier: 'Silver',
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.tier).toBe('Silver');
  });

  it('returns 400 when tier is missing', async () => {
    __setMember({ _id: 'mem-8' });
    const result = await crossRigEvent({
      eventId: 'ev-lt-bad',
      schemaVersion: '1.0',
      event: 'loyalty_tier_reached',
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});

// ── review_submitted ──────────────────────────────────────────────────────────

describe('crossRigEvent — review_submitted', () => {
  it('returns success and logs analytics event', async () => {
    __setMember({ _id: 'mem-9' });
    const result = await crossRigEvent({
      eventId: 'ev-rs1',
      schemaVersion: '1.0',
      event: 'review_submitted',
      productId: 'prod-sofa-1',
      rating: 5,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe('review_submitted');
    expect(inserted[0].memberId).toBe('mem-9');
  });

  it('stores productId and rating in payload', async () => {
    __setMember({ _id: 'mem-9' });
    await crossRigEvent({
      eventId: 'ev-rs2',
      schemaVersion: '1.0',
      event: 'review_submitted',
      productId: 'prod-bed-2',
      rating: 4,
    });
    const payload = JSON.parse(__getInserted(ANALYTICS_EVENTS_COLLECTION)[0].payload);
    expect(payload.productId).toBe('prod-bed-2');
    expect(payload.rating).toBe(4);
  });

  it('returns 400 when productId is missing', async () => {
    __setMember({ _id: 'mem-9' });
    const result = await crossRigEvent({
      eventId: 'ev-rs-bad',
      schemaVersion: '1.0',
      event: 'review_submitted',
      rating: 5,
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('accepts rating of 0', async () => {
    __setMember({ _id: 'mem-9' });
    const result = await crossRigEvent({
      eventId: 'ev-rs-zero',
      schemaVersion: '1.0',
      event: 'review_submitted',
      productId: 'prod-sofa-3',
      rating: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ── Analytics write failure ───────────────────────────────────────────────────

describe('crossRigEvent — analytics write failure', () => {
  it('returns { success: false } when analytics insert fails', async () => {
    __setMember({ _id: 'mem-4' });
    __setInsertError(ANALYTICS_EVENTS_COLLECTION, new Error('DB write failed'));
    const result = await crossRigEvent({
      eventId: 'ev-9',
      schemaVersion: '1.0',
      event: 'streak_extended',
      streak: 3,
      delta: 1,
      newTotal: 60,
    });
    expect(result.success).toBe(false);
  });
});

// ── New events: cf-l8xt (badge_earned, tier_changed, sommelier_completed, price_drop_watching, wishlist_synced) ──

describe('crossRigEvent — new mobile events (cf-l8xt)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-5' }); });

  it.each([
    ['badge_earned',         { badgeId: 'badge-001' }],
    ['tier_changed',         { newTier: 'gold', prevTier: 'silver' }],
    ['sommelier_completed',  { resultId: 'res-abc', style: 'contemporary' }],
    ['price_drop_watching',  { productId: 'prod-999', targetPrice: 399 }],
    ['wishlist_synced',      { itemCount: 5 }],
  ])('%s returns success and logs to analytics', async (eventType, extras) => {
    const result = await crossRigEvent({
      eventId: `ev-new-${eventType}`,
      schemaVersion: '1.0',
      event: eventType,
      ...extras,
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(inserted[0].eventType).toBe(eventType);
    expect(inserted[0].memberId).toBe('mem-5');
  });

  it('unknown event is still rejected with 400', async () => {
    const result = await crossRigEvent({
      eventId: 'ev-reject',
      schemaVersion: '1.0',
      event: 'not_a_real_event',
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });
});

// ── cf-bdl: badge_earned + tier_changed fire push notifications ───────────

describe('crossRigEvent — badge_earned push dispatch (cf-bdl)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-push-1' }); vi.clearAllMocks(); });

  it('calls syncBadgeEarnedToPush with memberId and badgeId', async () => {
    const { syncBadgeEarnedToPush } = await import('backend/utils/crossRigSyncUtils');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'badge_earned',
      badgeId: 'first_purchase',
    });
    expect(syncBadgeEarnedToPush).toHaveBeenCalledWith('mem-push-1', 'first_purchase');
  });

  it('still returns success even if push dispatch throws', async () => {
    const { syncBadgeEarnedToPush } = await import('backend/utils/crossRigSyncUtils');
    syncBadgeEarnedToPush.mockRejectedValueOnce(new Error('push service down'));
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'badge_earned',
      badgeId: 'streak_7',
    });
    expect(result.success).toBe(true);
  });

  it('does not call syncBadgeEarnedToPush when badgeId is missing', async () => {
    const { syncBadgeEarnedToPush } = await import('backend/utils/crossRigSyncUtils');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'badge_earned',
    });
    expect(syncBadgeEarnedToPush).not.toHaveBeenCalled();
  });
});

describe('crossRigEvent — tier_changed push dispatch (cf-bdl)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-push-2' }); vi.clearAllMocks(); });

  it('calls sendPushToMember with TIER_CHANGED and newTier', async () => {
    const { sendPushToMember, PUSH_EVENTS } = await import('backend/pushNotificationService.web');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'tier_changed',
      newTier: 'gold',
      prevTier: 'silver',
    });
    expect(sendPushToMember).toHaveBeenCalledWith(
      'mem-push-2',
      PUSH_EVENTS.TIER_CHANGED,
      { tier: 'gold' }
    );
  });

  it('still returns success even if tier push throws', async () => {
    const { sendPushToMember } = await import('backend/pushNotificationService.web');
    sendPushToMember.mockRejectedValueOnce(new Error('FCM down'));
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'tier_changed',
      newTier: 'silver',
      prevTier: 'bronze',
    });
    expect(result.success).toBe(true);
  });

  it('does not call sendPushToMember when newTier is missing', async () => {
    const { sendPushToMember } = await import('backend/pushNotificationService.web');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'tier_changed',
    });
    expect(sendPushToMember).not.toHaveBeenCalled();
  });
});

// ── cf-cn2: mobile challenge events wire to completeMobileChallenge ───────────

describe('crossRigEvent — quiz_completed routes to completeMobileChallenge (cf-cn2)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-quiz-1' }); vi.clearAllMocks(); });

  it('calls completeMobileChallenge with QUIZ_COMPLETION type and score', async () => {
    const { completeMobileChallenge, MOBILE_CHALLENGE_TYPES } = await import('backend/mobileChallengeService.web');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'quiz_completed',
      quizId: 'q-001',
      resultSlug: 'result-a',
      score: 3,
      total: 3,
    });
    expect(completeMobileChallenge).toHaveBeenCalledWith(
      'mem-quiz-1',
      MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION,
      expect.objectContaining({ score: 3, total: 3 })
    );
  });

  it('still returns success if completeMobileChallenge throws', async () => {
    const { completeMobileChallenge } = await import('backend/mobileChallengeService.web');
    completeMobileChallenge.mockRejectedValueOnce(new Error('db down'));
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'quiz_completed',
      quizId: 'q-002',
      resultSlug: 'result-b',
    });
    expect(result.success).toBe(true);
  });
});

describe('crossRigEvent — ar_discovery_completed routes to completeMobileChallenge (cf-cn2)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-ar-1' }); vi.clearAllMocks(); });

  it('accepts ar_discovery_completed event', async () => {
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'ar_discovery_completed',
      productId: 'prod-123',
    });
    expect(result.success).toBe(true);
    expect(result.status).not.toBe(400);
  });

  it('calls completeMobileChallenge with AR_DISCOVERY type and productId', async () => {
    const { completeMobileChallenge, MOBILE_CHALLENGE_TYPES } = await import('backend/mobileChallengeService.web');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'ar_discovery_completed',
      productId: 'prod-456',
    });
    expect(completeMobileChallenge).toHaveBeenCalledWith(
      'mem-ar-1',
      MOBILE_CHALLENGE_TYPES.AR_DISCOVERY,
      expect.objectContaining({ productId: 'prod-456' })
    );
  });

  it('still returns success if completeMobileChallenge throws', async () => {
    const { completeMobileChallenge } = await import('backend/mobileChallengeService.web');
    completeMobileChallenge.mockRejectedValueOnce(new Error('service error'));
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'ar_discovery_completed',
      productId: 'prod-789',
    });
    expect(result.success).toBe(true);
  });
});

describe('crossRigEvent — social_share_completed routes to completeMobileChallenge (cf-cn2)', () => {
  beforeEach(() => { __setMember({ _id: 'mem-social-1' }); vi.clearAllMocks(); });

  it('accepts social_share_completed event', async () => {
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'social_share_completed',
      platform: 'instagram',
    });
    expect(result.success).toBe(true);
    expect(result.status).not.toBe(400);
  });

  it('calls completeMobileChallenge with SOCIAL_SHARE type and platform', async () => {
    const { completeMobileChallenge, MOBILE_CHALLENGE_TYPES } = await import('backend/mobileChallengeService.web');
    await crossRigEvent({
      schemaVersion: '1.0',
      event: 'social_share_completed',
      platform: 'tiktok',
    });
    expect(completeMobileChallenge).toHaveBeenCalledWith(
      'mem-social-1',
      MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE,
      expect.objectContaining({ platform: 'tiktok' })
    );
  });

  it('still returns success if completeMobileChallenge throws', async () => {
    const { completeMobileChallenge } = await import('backend/mobileChallengeService.web');
    completeMobileChallenge.mockRejectedValueOnce(new Error('challenge svc down'));
    const result = await crossRigEvent({
      schemaVersion: '1.0',
      event: 'social_share_completed',
      platform: 'instagram',
    });
    expect(result.success).toBe(true);
  });
});
