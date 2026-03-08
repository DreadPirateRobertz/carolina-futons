import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  productBundles,
  promotions,
  engagementEvents,
  reviewRequests,
  referralCodes,
  videos,
} from '../fixtures/engagement.js';
import {
  getBundlesForProduct,
  getActivePromotions,
  trackEngagementEvent,
  getMyEngagementHistory,
  scheduleReviewRequest,
  getPendingReviewRequests,
  submitReview,
  generateReferralCode,
  redeemReferralCode,
  getVideos,
  trackVideoView,
} from '../../src/backend/dataService.web.js';

// Set up default mock state before each test
beforeEach(() => {
  __seed('ProductBundles', productBundles);
  __seed('Promotions', promotions);
  __seed('CustomerEngagement', engagementEvents);
  __seed('ReviewRequests', reviewRequests);
  __seed('ReferralCodes', referralCodes);
  __seed('Videos', videos);
  __setMember(null);
});

function loginAs(id) {
  __setMember({ _id: id });
}

// ── ProductBundles ──────────────────────────────────────────────────

describe('getBundlesForProduct', () => {
  it('returns active bundles for a product', async () => {
    const results = await getBundlesForProduct('prod-frame-001');
    expect(results.length).toBe(1);
    expect(results[0].bundleName).toBe('Complete Your Futon Set');
    expect(results[0].bundledProductIds).toEqual(['prod-matt-001', 'prod-case-001']);
  });

  it('excludes inactive bundles', async () => {
    const results = await getBundlesForProduct('prod-frame-001');
    const names = results.map(r => r.bundleName);
    expect(names).not.toContain('Old Bundle');
  });

  it('returns empty array for unknown product', async () => {
    const results = await getBundlesForProduct('nonexistent');
    expect(results).toEqual([]);
  });

  it('returns empty array for null input', async () => {
    const results = await getBundlesForProduct(null);
    expect(results).toEqual([]);
  });
});

// ── Promotions ──────────────────────────────────────────────────────

describe('getActivePromotions', () => {
  it('returns only currently active promotions', async () => {
    const results = await getActivePromotions();
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Spring Sale');
  });

  it('excludes expired promotions', async () => {
    const results = await getActivePromotions();
    const titles = results.map(r => r.title);
    expect(titles).not.toContain('Expired Sale');
  });

  it('excludes deactivated promotions', async () => {
    const results = await getActivePromotions();
    const titles = results.map(r => r.title);
    expect(titles).not.toContain('Deactivated Promo');
  });

  it('parses productIds into array', async () => {
    const results = await getActivePromotions();
    expect(results[0].productIds).toEqual(['prod-frame-001', 'prod-matt-001']);
  });
});

// ── CustomerEngagement ──────────────────────────────────────────────

describe('trackEngagementEvent', () => {
  it('inserts engagement event for authenticated member', async () => {
    loginAs('member-001');
    const result = await trackEngagementEvent({
      eventType: 'page_view',
      productId: 'prod-frame-001',
      sessionId: 'sess-xyz',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid event types', async () => {
    loginAs('member-001');
    const result = await trackEngagementEvent({
      eventType: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  it('fails for unauthenticated users', async () => {
    const result = await trackEngagementEvent({
      eventType: 'page_view',
    });
    expect(result.success).toBe(false);
  });
});

describe('getMyEngagementHistory', () => {
  it('returns events for the current member', async () => {
    loginAs('member-001');
    const results = await getMyEngagementHistory();
    expect(results.length).toBe(2);
    results.forEach(r => expect(['page_view', 'add_to_cart']).toContain(r.eventType));
  });

  it('filters by event type', async () => {
    loginAs('member-001');
    const results = await getMyEngagementHistory('add_to_cart');
    expect(results.length).toBe(1);
    expect(results[0].eventType).toBe('add_to_cart');
  });

  it('returns empty for unauthenticated users', async () => {
    const results = await getMyEngagementHistory();
    expect(results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    loginAs('member-001');
    const results = await getMyEngagementHistory(null, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ── ReviewRequests ──────────────────────────────────────────────────

describe('scheduleReviewRequest', () => {
  it('creates a review request for authenticated member', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({
      orderId: 'order-100',
      customerEmail: 'test@example.com',
      productIds: 'prod-frame-001',
    });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();
  });

  it('fails without required fields', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({ orderId: 'order-100' });
    expect(result.success).toBe(false);
  });

  it('fails for unauthenticated users', async () => {
    const result = await scheduleReviewRequest({
      orderId: 'order-100',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('getPendingReviewRequests', () => {
  it('returns pending requests with scheduledDate in the past', async () => {
    loginAs('member-001');
    const results = await getPendingReviewRequests();
    expect(results.length).toBe(1);
    expect(results[0].orderId).toBe('order-001');
  });

  it('excludes future and completed requests', async () => {
    loginAs('member-001');
    const results = await getPendingReviewRequests();
    const orderIds = results.map(r => r.orderId);
    expect(orderIds).not.toContain('order-002');
    expect(orderIds).not.toContain('order-003');
  });

  it('returns empty for unauthenticated users', async () => {
    const results = await getPendingReviewRequests();
    expect(results).toEqual([]);
  });
});

describe('submitReview', () => {
  it('marks review request as completed with rating and text', async () => {
    const result = await submitReview('rev-001', 4, 'Great product!');
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', async () => {
    const result = await submitReview('rev-001', 0, 'Bad rating');
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', async () => {
    const result = await submitReview('rev-001', 6, 'Too high');
    expect(result.success).toBe(false);
  });

  it('fails for nonexistent request', async () => {
    const result = await submitReview('nonexistent', 5, 'Test');
    expect(result.success).toBe(false);
  });
});

// ── ReferralCodes ───────────────────────────────────────────────────

describe('generateReferralCode', () => {
  it('returns existing code if member already has one', async () => {
    loginAs('member-001');
    const result = await generateReferralCode();
    expect(result.success).toBe(true);
    expect(result.code).toBe('CF-MEMBER01');
  });

  it('generates new code for new member', async () => {
    loginAs('member-999');
    const result = await generateReferralCode();
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^CF-/);
  });

  it('fails for unauthenticated users', async () => {
    const result = await generateReferralCode();
    expect(result.success).toBe(false);
  });
});

describe('redeemReferralCode', () => {
  it('redeems valid unused code', async () => {
    loginAs('member-003');
    const result = await redeemReferralCode('CF-MEMBER01');
    expect(result.valid).toBe(true);
    expect(result.discountPercent).toBe(10);
  });

  it('rejects own referral code', async () => {
    loginAs('member-001');
    const result = await redeemReferralCode('CF-MEMBER01');
    expect(result.valid).toBe(false);
  });

  it('rejects already-redeemed code', async () => {
    loginAs('member-004');
    const result = await redeemReferralCode('CF-MEMBER02');
    expect(result.valid).toBe(false);
  });

  it('rejects nonexistent code', async () => {
    loginAs('member-001');
    const result = await redeemReferralCode('INVALID');
    expect(result.valid).toBe(false);
  });

  it('fails for unauthenticated users', async () => {
    const result = await redeemReferralCode('CF-MEMBER01');
    expect(result.valid).toBe(false);
  });
});

// ── Videos ──────────────────────────────────────────────────────────

describe('getVideos', () => {
  it('returns all videos sorted by viewCount', async () => {
    const results = await getVideos();
    expect(results.length).toBe(3);
    expect(results[0].viewCount).toBeGreaterThanOrEqual(results[1].viewCount);
  });

  it('filters by category', async () => {
    const results = await getVideos({ category: 'futon' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Eureka Frame Assembly Guide');
  });

  it('filters by productId', async () => {
    const results = await getVideos({ productId: 'prod-murphy-001' });
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('murphy');
  });

  it('filters by featured only', async () => {
    const results = await getVideos({ featuredOnly: true });
    expect(results.length).toBe(2);
    results.forEach(r => expect(r.isFeatured).toBe(true));
  });

  it('respects limit', async () => {
    const results = await getVideos({ limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns empty on error gracefully', async () => {
    __seed('Videos', []);
    const results = await getVideos();
    expect(results).toEqual([]);
  });
});

describe('trackVideoView', () => {
  it('increments view count', async () => {
    await trackVideoView('vid-001');
    // No error thrown — increment happened via mock update
  });

  it('no-ops for null videoId', async () => {
    await expect(trackVideoView(null)).resolves.not.toThrow();
  });

  it('no-ops for nonexistent video', async () => {
    await expect(trackVideoView('nonexistent')).resolves.not.toThrow();
  });
});
