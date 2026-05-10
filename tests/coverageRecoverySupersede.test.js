/**
 * @file coverageRecoverySupersede.test.js
 * @description Targeted branch-coverage recovery after the cf-4x7e
 * SUPERSEDE pass (#1229). Goal: nudge the global branches metric back
 * over the 85% threshold without rewriting any of the SUPERSEDE'd
 * fixtures — instead, hit specific uncovered fallback paths in
 * already-instrumented modules.
 *
 * Each test below was selected by reading
 * `coverage/coverage-final.json` from the post-#1229 run and finding
 * `||` / `??` / `?:` fallbacks whose left-hand-truthy or right-hand-
 * fallback path was never exercised by the existing suite.
 *
 * If you find one of these tests redundant with an existing one, that
 * means coverage drift — keep the older test and remove this one.
 *
 * cf-4x7e Pass 2 chunk 8 follow-up.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { __reset as __resetData, __seed } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';

beforeEach(() => {
  __resetData();
  vi.clearAllMocks();
});

// ── events.js — empty-event early-return paths ───────────────────────────

describe('cf-4x7e cov: events.js empty-event fallbacks', () => {
  it('wixEcom_onOrderCreated({}) returns without throwing — exercises every || fallback (lines 215-222) plus the !email early return (line 230)', async () => {
    const { wixEcom_onOrderCreated } = await import('../src/backend/events.js');
    // Empty event → entity falls back to event; every nested optional
    // chain is undefined; lineItems array is empty; email is "" so the
    // function early-returns at the !email guard.
    await expect(wixEcom_onOrderCreated({})).resolves.toBeUndefined();
  });

  it('wixEcom_onOrderCanceled({}) returns without throwing — same fallback shape as orderCreated', async () => {
    const { wixEcom_onOrderCanceled } = await import('../src/backend/events.js');
    await expect(wixEcom_onOrderCanceled({})).resolves.toBeUndefined();
  });

  it('wixEcom_onAbandonedCheckoutCreated({}) skips when checkoutId is empty (line 79 guard)', async () => {
    const { wixEcom_onAbandonedCheckoutCreated } = await import('../src/backend/events.js');
    // Empty event → checkout = {} → checkoutId = '' → exercises the
    // empty-id early-return path that the existing 'skips if checkoutId
    // is empty' test in events.test.js covers via a slightly different
    // input shape; this one uses the most-empty fixture possible to
    // also exercise lineItems || [] and the chained || fallbacks.
    await expect(wixEcom_onAbandonedCheckoutCreated({})).resolves.toBeUndefined();
  });

  it('wixEcom_onAbandonedCheckoutRecovered({}) — same empty-event idempotent guard', async () => {
    const { wixEcom_onAbandonedCheckoutRecovered } = await import('../src/backend/events.js');
    await expect(wixEcom_onAbandonedCheckoutRecovered({})).resolves.toBeUndefined();
  });

  it('wixEcom_onOrderApproved({}) returns without throwing — exercises gamification empty-event branches', async () => {
    const { wixEcom_onOrderApproved } = await import('../src/backend/events.js');
    await expect(wixEcom_onOrderApproved({})).resolves.toBeUndefined();
  });

  it('wixEcom_onOrderDelivered({}) returns without throwing — exercises post-delivery empty-event branches', async () => {
    const { wixEcom_onOrderDelivered } = await import('../src/backend/events.js');
    await expect(wixEcom_onOrderDelivered({})).resolves.toBeUndefined();
  });

  it('wixMembers_onMemberCreated({}) returns without throwing — exercises empty-event member fallbacks', async () => {
    const { wixMembers_onMemberCreated } = await import('../src/backend/events.js');
    await expect(wixMembers_onMemberCreated({})).resolves.toBeUndefined();
  });
});

// ── orderTracking.web.js — fallback paths in subscribeToNotifications ─────

describe('cf-4x7e cov: orderTracking.web.js subscribeToNotifications', () => {
  it('treats order with `buyerInfo` undefined as "no email match" (line 207 fallback)', async () => {
    const { subscribeToNotifications } = await import('../src/backend/orderTracking.web.js');

    __seed('Stores/Orders', [
      // no buyerInfo at all — exercises `(order.buyerInfo?.email || '').toLowerCase()`
      // fallback to '' which then never matches the supplied email
      { _id: 'ord-cov-1', number: 'COV-001', _createdDate: new Date() },
    ]);

    const result = await subscribeToNotifications('COV-001', 'whoever@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });
});

// ── orderTracking.web.js — getTrackingTimeline error fallback ─────────────

describe('cf-4x7e cov: orderTracking.web.js getTrackingTimeline', () => {
  it('falls back to generic error string when trackShipment returns success:false with no error (line 304 fallback)', async () => {
    // Mock the dynamic-imported trackShipment helper to return a failure
    // shape with no `error` field — exercises the
    // `tracking.error || 'Unable to get tracking info'` right-hand path.
    vi.doMock('backend/ups-shipping.web', () => ({ // vi-domock-legacy
      trackShipment: vi.fn().mockResolvedValue({ success: false }),
    }));

    const { getTrackingTimeline } = await import(
      '../src/backend/orderTracking.web.js?cf-4x7e-cov-no-err'
    );

    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unable to get tracking info');

    vi.doUnmock('backend/ups-shipping.web');
  });

  it('falls back to STATUS_DISPLAY.UNKNOWN for an unrecognized statusCode (line 318 fallback)', async () => {
    // statusCode the module's lookup table doesn't recognize (e.g.,
    // 'X9') exercises `STATUS_DISPLAY[fulfillmentStatus] || STATUS_DISPLAY.UNKNOWN`.
    vi.doMock('backend/ups-shipping.web', () => ({ // vi-domock-legacy
      trackShipment: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 'X9-totally-unknown',
        status: 'Mystery in transit',
        // no `activities` field — also exercises line 332 `tracking.activities || []`
      }),
    }));

    const { getTrackingTimeline } = await import(
      '../src/backend/orderTracking.web.js?cf-4x7e-cov-unknown-status'
    );

    const result = await getTrackingTimeline('1Z999AA10123456785');
    expect(result.success).toBe(true);
    // Unknown status → still maps to a label, just the UNKNOWN one.
    expect(result.statusLabel).toBeDefined();
    expect(Array.isArray(result.activities)).toBe(true);
    expect(result.activities).toEqual([]);

    vi.doUnmock('backend/ups-shipping.web');
  });
});

// ── socialMediaKit.web.js — formattedPrice present, description fallback ──

describe('cf-4x7e cov: socialMediaKit.web.js fallbacks', () => {
  it('uses social-meta description fallback when description is empty (line 197 fallback)', async () => {
    const { getProductSocialMetaHtml } = await import('../src/backend/socialMediaKit.web.js');
    const html = await getProductSocialMetaHtml({
      slug: 'walnut-frame',
      name: 'Walnut Frame',
      description: '', // strips to '' → exercises `|| \`Shop ${product.name…}\`` fallback
      price: 999,
    });
    expect(html).toContain('Shop Walnut Frame');
  });

  it('falls back to "this product" when description AND name both empty (line 197 nested fallback)', async () => {
    const { getProductSocialMetaHtml } = await import('../src/backend/socialMediaKit.web.js');
    const html = await getProductSocialMetaHtml({
      slug: 'no-name',
      name: '',
      description: '',
      price: 0,
    });
    expect(html).toContain('Shop this product');
  });
});

// ── seoHelpers.web.js — generateAltText path coverage ────────────────────

describe('cf-4x7e cov: seoHelpers.web.js generateAltText', () => {
  it('returns empty string for null product (line 539 guard)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    const out = await generateAltText(null);
    expect(out).toBe('');
  });

  it('handles imageType="open" path (line 571-572)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    const product = {
      name: 'Cambridge Frame',
      collections: ['futon-frames'],
      options: { size: 'Queen' },
    };
    const out = await generateAltText(product, 'open');
    expect(out).toContain('open bed position');
    expect(out).toContain('Queen');
  });

  it('handles imageType="sofa" path (line 576-577)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    const product = {
      name: 'Asheville Frame',
      collections: ['futon-frames'],
      options: { color: 'Walnut' },
    };
    const out = await generateAltText(product, 'sofa');
    expect(out).toContain('upright sofa position');
    expect(out).toContain('Walnut');
  });

  it('handles imageType="gallery" path (line 581-582)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    // The brand-fallback subbranch is exercised even when detectProductBrand
    // resolves to a default — the `if (imageType === "gallery")` arm itself
    // is the line-581 cond-expr we're after.
    const product = { name: 'Sedona Frame', collections: ['futon-frames'] };
    const out = await generateAltText(product, 'gallery');
    expect(out).toContain('Sedona Frame');
    expect(out).toContain('additional view');
  });

  it('handles imageType="grid" path (line 587-593)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    const product = { name: 'Mesa Frame', collections: ['futon-frames'] };
    const out = await generateAltText(product, 'grid');
    expect(out).toContain('Mesa Frame');
    expect(out).toContain('Carolina Futons');
  });

  it('falls through to default alt text for unrecognized imageType (line 596 default)', async () => {
    const { generateAltText } = await import('../src/backend/seoHelpers.web.js');
    const product = { name: 'Wilderness', collections: ['futon-frames'] };
    const out = await generateAltText(product, 'totally-unknown-type');
    expect(out).toContain('Wilderness');
    expect(out).toContain('Hendersonville NC');
  });
});

// ── sizeGuide.web.js — getSmallestPassThroughDims via checkRoomFit ────────

describe('cf-4x7e cov: sizeGuide.web.js getSmallestPassThroughDims', () => {
  it('coerces missing closedWidth/Depth/Height to 0 (line 389-391 fallbacks)', async () => {
    const { checkRoomFit } = await import('../src/backend/sizeGuide.web.js');

    // Seed a product whose dimension row has no closed* fields. The
    // doorway-fit branch calls getSmallestPassThroughDims(dims), which
    // does `dims.closedWidth || 0` etc — uncov path 1 fires only when
    // each dim is falsy.
    __seed('ProductDimensions', [
      {
        _id: 'dim-cov-1',
        productId: 'prod-cov-falsy-dims',
        // no closedWidth / closedDepth / closedHeight
        openWidth: 80,
        openDepth: 60,
      },
    ]);

    const result = await checkRoomFit('prod-cov-falsy-dims', {
      doorwayWidth: 36,
      doorwayHeight: 80,
    });

    // Doorway check ran and found a "fits" since pass-through was
    // (0, 0, 0) — clearance = 36 and 80, both ≥ 0.
    expect(result.success).toBe(true);
    const doorway = result.checks.find((c) => c.check === 'doorway');
    expect(doorway).toBeDefined();
    expect(doorway.fits).toBe(true);
  });

  it('hallway-fit with both closedWidth and closedDepth missing → Math.min(Infinity, Infinity) (line 138 fallback)', async () => {
    const { checkRoomFit } = await import('../src/backend/sizeGuide.web.js');
    __seed('ProductDimensions', [
      {
        _id: 'dim-cov-2',
        productId: 'prod-cov-no-closed',
        openWidth: 80,
        openDepth: 60,
      },
    ]);

    const result = await checkRoomFit('prod-cov-no-closed', {
      hallwayWidth: 36,
    });

    // hallwayWidth - Infinity = -Infinity → fits=false branch fires.
    expect(result.success).toBe(true);
    const hallway = result.checks.find((c) => c.check === 'hallway');
    expect(hallway).toBeDefined();
    expect(hallway.fits).toBe(false);
  });

  it('room-fit with openWidth/openDepth both missing → 0 fallbacks (lines 152-153)', async () => {
    const { checkRoomFit } = await import('../src/backend/sizeGuide.web.js');
    __seed('ProductDimensions', [
      {
        _id: 'dim-cov-3',
        productId: 'prod-cov-no-open',
        // no openWidth / openDepth — falls back to closedWidth/closedDepth
        // which are also missing → final fallback to 0
        // closedWidth/Depth missing too
      },
    ]);

    const result = await checkRoomFit('prod-cov-no-open', {
      roomWidth: 120,
      roomDepth: 120,
    });

    // openWidth=0, openDepth=0 → both fits trivially (room - 0 ≥ 0).
    expect(result.success).toBe(true);
    const room = result.checks.find((c) => c.check === 'room');
    expect(room).toBeDefined();
    expect(room.fits).toBe(true);
  });
});

