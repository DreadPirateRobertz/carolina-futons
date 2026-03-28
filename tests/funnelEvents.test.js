import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent } from './__mocks__/wix-window-frontend.js';
import {
  fireQuizStarted,
  fireQuizCompleted,
  fireLeadCaptured,
  fireSwatchRequested,
  fireSwatchToPurchase,
  fireBundleViewed,
  fireBundleAdded,
  fireBundlePurchased,
  fireLoyaltyEnrolled,
  fireLoyaltyRedeemed,
  fireSpinPlayed,
  fireSpinWon,
  fireSpinConverted,
  fireReferralShared,
  fireReferralConverted,
  fireReviewSubmitted,
  fireReviewWithPhoto,
  fireFinancingCalculated,
  fireFinancingApplied,
  fireCompareStarted,
  fireCompareToCart,
  fireRoomPlannerUsed,
  fireRoomPlannerToCart,
} from '../src/public/funnelEvents.js';

beforeEach(() => {
  vi.clearAllMocks();
})

// ── Quiz ─────────────────────────────────────────────────────────────

describe('fireQuizStarted', () => {
  it('fires quiz_started with quiz_id', async () => {
    await fireQuizStarted({ quizId: 'q1' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', { event: 'quiz_started', quiz_id: 'q1' });
  });

  it('omits undefined fields from payload', async () => {
    await fireQuizStarted({});
    const call = trackEvent.mock.calls[0][1];
    expect(call.event).toBe('quiz_started');
    expect('quiz_id' in call).toBe(false);
  });

  it('fires with no args', async () => {
    await fireQuizStarted();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireQuizCompleted', () => {
  it('fires quiz_completed with quiz_id and result', async () => {
    await fireQuizCompleted({ quizId: 'q1', result: 'futon-frame' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'quiz_completed',
      quiz_id: 'q1',
      result: 'futon-frame',
    });
  });

  it('fires with no args', async () => {
    await fireQuizCompleted();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireLeadCaptured', () => {
  it('hashes email as SHA-256 before sending to GA4', async () => {
    await fireLeadCaptured({ quizId: 'q1', email: 'Test@Example.COM' });
    const call = trackEvent.mock.calls[0][1];
    expect(call.event).toBe('lead_captured');
    expect(call.quiz_id).toBe('q1');
    // SHA-256 of 'test@example.com' (lowercased, trimmed)
    expect(call.email_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect('email' in call).toBe(false);
  });

  it('omits email_sha256 when no email provided', async () => {
    await fireLeadCaptured({ quizId: 'q1' });
    const call = trackEvent.mock.calls[0][1];
    expect('email_sha256' in call).toBe(false);
    expect('email' in call).toBe(false);
  });

  it('fires with no args', async () => {
    await fireLeadCaptured();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

// ── Swatch ───────────────────────────────────────────────────────────

describe('fireSwatchRequested', () => {
  it('fires swatch_requested with product_id and swatch_name', async () => {
    await fireSwatchRequested({ productId: 'p1', swatchName: 'Cobalt Blue' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'swatch_requested',
      product_id: 'p1',
      swatch_name: 'Cobalt Blue',
    });
  });
});

describe('fireSwatchToPurchase', () => {
  it('fires swatch_to_purchase', async () => {
    await fireSwatchToPurchase({ productId: 'p1', swatchName: 'Forest Green' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'swatch_to_purchase',
      product_id: 'p1',
      swatch_name: 'Forest Green',
    });
  });

  it('fires with no args', async () => {
    await fireSwatchToPurchase();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

// ── Bundle ───────────────────────────────────────────────────────────

describe('fireBundleViewed', () => {
  it('fires bundle_viewed', async () => {
    await fireBundleViewed({ bundleId: 'b1', bundleName: 'Bedroom Set' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'bundle_viewed',
      bundle_id: 'b1',
      bundle_name: 'Bedroom Set',
    });
  });
});

describe('fireBundleAdded', () => {
  it('fires bundle_added with value', async () => {
    await fireBundleAdded({ bundleId: 'b1', bundleName: 'Bedroom Set', value: 499 });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'bundle_added',
      bundle_id: 'b1',
      bundle_name: 'Bedroom Set',
      value: 499,
    });
  });

  it('fires with no args', async () => {
    await fireBundleAdded();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireBundlePurchased', () => {
  it('fires bundle_purchased with all params', async () => {
    await fireBundlePurchased({ bundleId: 'b1', bundleName: 'Bedroom Set', value: 499, orderId: 'o99' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'bundle_purchased',
      bundle_id: 'b1',
      bundle_name: 'Bedroom Set',
      value: 499,
      order_id: 'o99',
    });
  });
});

// ── Loyalty ──────────────────────────────────────────────────────────

describe('fireLoyaltyEnrolled', () => {
  it('fires loyalty_enrolled with member_id and source', async () => {
    await fireLoyaltyEnrolled({ memberId: 'm1', source: 'checkout' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'loyalty_enrolled',
      member_id: 'm1',
      source: 'checkout',
    });
  });

  it('fires with no args', async () => {
    await fireLoyaltyEnrolled();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireLoyaltyRedeemed', () => {
  it('fires loyalty_redeemed with points and value', async () => {
    await fireLoyaltyRedeemed({ memberId: 'm1', points: 500, value: 5 });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'loyalty_redeemed',
      member_id: 'm1',
      points: 500,
      value: 5,
    });
  });
});

// ── Spin ─────────────────────────────────────────────────────────────

describe('fireSpinPlayed', () => {
  it('fires spin_played with member_id', async () => {
    await fireSpinPlayed({ memberId: 'm1' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', { event: 'spin_played', member_id: 'm1' });
  });

  it('fires with no args', async () => {
    await fireSpinPlayed();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireSpinWon', () => {
  it('fires spin_won with prize', async () => {
    await fireSpinWon({ memberId: 'm1', prize: '10% off' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'spin_won',
      member_id: 'm1',
      prize: '10% off',
    });
  });
});

describe('fireSpinConverted', () => {
  it('fires spin_converted with order_id', async () => {
    await fireSpinConverted({ memberId: 'm1', prize: '10% off', orderId: 'o1' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'spin_converted',
      member_id: 'm1',
      prize: '10% off',
      order_id: 'o1',
    });
  });
});

// ── Referral ─────────────────────────────────────────────────────────

describe('fireReferralShared', () => {
  it('fires referral_shared with channel', async () => {
    await fireReferralShared({ referrerId: 'm1', channel: 'email' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'referral_shared',
      referrer_id: 'm1',
      channel: 'email',
    });
  });

  it('fires with no args', async () => {
    await fireReferralShared();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireReferralConverted', () => {
  it('fires referral_converted with referrer, referee, and order', async () => {
    await fireReferralConverted({ referrerId: 'm1', refereeId: 'm2', orderId: 'o5' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'referral_converted',
      referrer_id: 'm1',
      referee_id: 'm2',
      order_id: 'o5',
    });
  });
});

// ── Review ───────────────────────────────────────────────────────────

describe('fireReviewSubmitted', () => {
  it('fires review_submitted with rating', async () => {
    await fireReviewSubmitted({ productId: 'p1', rating: 5 });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'review_submitted',
      product_id: 'p1',
      rating: 5,
    });
  });

  it('fires with no args', async () => {
    await fireReviewSubmitted();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireReviewWithPhoto', () => {
  it('fires review_with_photo', async () => {
    await fireReviewWithPhoto({ productId: 'p1', rating: 4 });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'review_with_photo',
      product_id: 'p1',
      rating: 4,
    });
  });
});

// ── Financing ────────────────────────────────────────────────────────

describe('fireFinancingCalculated', () => {
  it('fires financing_calculated with amount and term', async () => {
    await fireFinancingCalculated({ productId: 'p1', amount: 800, term: 12 });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'financing_calculated',
      product_id: 'p1',
      amount: 800,
      term: 12,
    });
  });

  it('fires with no args', async () => {
    await fireFinancingCalculated();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireFinancingApplied', () => {
  it('fires financing_applied with provider', async () => {
    await fireFinancingApplied({ productId: 'p1', amount: 800, provider: 'affirm' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'financing_applied',
      product_id: 'p1',
      amount: 800,
      provider: 'affirm',
    });
  });
});

// ── Compare ──────────────────────────────────────────────────────────

describe('fireCompareStarted', () => {
  it('fires compare_started with product_ids joined', async () => {
    await fireCompareStarted({ productIds: ['p1', 'p2', 'p3'] });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'compare_started',
      product_ids: 'p1,p2,p3',
    });
  });

  it('accepts a string product_ids passthrough', async () => {
    await fireCompareStarted({ productIds: 'p1,p2' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'compare_started',
      product_ids: 'p1,p2',
    });
  });

  it('omits product_ids when array is empty', async () => {
    await fireCompareStarted({ productIds: [] });
    const call = trackEvent.mock.calls[0][1];
    expect(call.event).toBe('compare_started');
    expect('product_ids' in call).toBe(false);
  });

  it('fires with no args without sending product_ids', async () => {
    await fireCompareStarted();
    const call = trackEvent.mock.calls[0][1];
    expect(call.event).toBe('compare_started');
    expect('product_ids' in call).toBe(false);
  });
});

describe('fireCompareToCart', () => {
  it('fires compare_to_cart with product_id', async () => {
    await fireCompareToCart({ productId: 'p2' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', { event: 'compare_to_cart', product_id: 'p2' });
  });
});

// ── Room Planner ─────────────────────────────────────────────────────

describe('fireRoomPlannerUsed', () => {
  it('fires room_planner_used with session_id', async () => {
    await fireRoomPlannerUsed({ sessionId: 'sess-abc' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'room_planner_used',
      session_id: 'sess-abc',
    });
  });

  it('fires with no args', async () => {
    await fireRoomPlannerUsed();
    expect(trackEvent).toHaveBeenCalledOnce();
  });
});

describe('fireRoomPlannerToCart', () => {
  it('fires room_planner_to_cart with session and product', async () => {
    await fireRoomPlannerToCart({ sessionId: 'sess-abc', productId: 'p1' });
    expect(trackEvent).toHaveBeenCalledWith('CustomEvent', {
      event: 'room_planner_to_cart',
      session_id: 'sess-abc',
      product_id: 'p1',
    });
  });
});

// ── Resilience ───────────────────────────────────────────────────────

describe('resilience', () => {
  it('does not throw when trackEvent throws', async () => {
    trackEvent.mockImplementationOnce(() => { throw new Error('GA4 offline'); });
    await expect(fireQuizStarted({ quizId: 'q1' })).resolves.toBeUndefined();
  });

  it('fires each event exactly once', async () => {
    await fireQuizStarted({ quizId: 'q1' });
    await fireSpinPlayed({ memberId: 'm1' });
    await fireBundlePurchased({ bundleId: 'b1', value: 99 });
    expect(trackEvent).toHaveBeenCalledTimes(3);
  });
});
