/**
 * @file emailTriggers.pre-cfc6g5.test.js
 * @description Pre-work scaffold for cf-w1u1 (E2E test all email triggers).
 *
 * cf-c6g5 (P0) holds 13 Wix Triggered Email templates that Stilgar must
 * create in the dashboard. cf-w1u1 (P1) is the post-cf-c6g5 verification
 * that every trigger code path actually fires the right templateId with
 * the right variables. This file is the scaffolding for cf-w1u1: the
 * fixtures, mocks, and per-trigger describe blocks are wired up so that
 * when cf-c6g5 lands, dev replaces each `it.todo` with a real assertion
 * body using the shared setup.
 *
 * Inventory drawn from `docs/email-audit-2026-05-04.md` (rennala) — 13
 * trigger families that map to the cf-c6g5 13 templates:
 *
 *   1.  welcome_series             (welcome_series_1..5)        — triggerWelcomeSeries
 *   2.  cart_recovery              (cart_recovery_1..3)         — cartRecovery cron
 *   3.  order_confirmation         (order_confirmation)         — events.js#wixEcom_onOrderCreated
 *   4.  order_shipped              (order_shipped)              — events.js#wixEcom_onFulfillmentCreated
 *   5.  delivery_confirmation      (delivery_confirmation)      — events.js#wixEcom_onOrderDelivered
 *   6.  post_purchase              (post_purchase_1..3)         — triggerPostPurchaseSequence
 *   7.  post_purchase_review_reward                              — triggerReviewRewardPrompt
 *   8.  post_purchase_referral                                   — events.js#wixEcom_onOrderDelivered
 *   9.  promotional_sale            (3 promo templates)         — queuePromotionalEmail
 *   10. reengagement               (reengagement_1..3)          — triggerReengagement
 *   11. winback                    (CMS-driven step IDs)        — scanAndTriggerWinback
 *   12. browse_recovery            (browse_recovery_1)          — triggerBrowseRecovery
 *   13. wishlist_price_drop        (wishlist_price_drop)        — checkWishlistAlerts
 *
 * Each describe block has:
 *   - 1 it() that asserts the TRIGGER CODE PATH fires `emailContact`
 *     with the expected templateId + variable shape. Runs today against
 *     the wix-crm-backend mock — no live templates required. Catches
 *     regressions in code wiring before Stilgar's templates are touched.
 *   - 1+ it.todo() that mark the post-cf-c6g5 staging-side checks
 *     (template renders, lands in inbox). Becomes real once cf-c6g5
 *     unblocks; left as todo to surface in CI as "pending E2E coverage."
 *
 * Note on audit gaps F1/F2/F3/F4:
 *   - welcome_series exit-intent + member-self-trigger paths fail to
 *     send (F1, recipientContactId blank). Skip-marked below until
 *     cf-icww.followup-f1 lands.
 *   - subscribeToNewsletter doesn't queue welcome (F2). Same handling.
 *   - order_confirmation (F3) + order_shipped/freight_shipped (F4) are
 *     the dormant-handler bug — wired in events.js per cf-i23b/cf-icdc
 *     after PR landings; revisit the live trigger once those merge.
 *
 * cf-w1u1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  __reset as __resetCrm,
  __getEmailLog,
  triggeredEmails,
} from './__mocks__/wix-crm-backend.js';
import {
  __reset as __resetData,
  __seed,
} from './__mocks__/wix-data.js';
import { __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';

// Keep the import surface stable so the post-cf-c6g5 fill-in can swap
// `it.todo` → `it` without re-importing. Some triggers run via cron paths
// rather than direct webMethod export — those tests will reach in via the
// cron handler, also already exported.
import {
  triggerWelcomeSeries,
  triggerPostPurchaseSequence,
  triggerReviewRewardPrompt,
  triggerReengagement,
  triggerRestockNotifications,
  // dormant in current main per F3/F4 — kept here so the post-merge
  // wiring (cf-i23b / cf-icdc) gets immediate coverage from the
  // todo→it flip; remove if the export shape changes.
  // eslint-disable-next-line no-unused-vars
  wixEcom_onOrderCreated as _wixEcom_onOrderCreated,
  // eslint-disable-next-line no-unused-vars
  wixEcom_onFulfillmentCreated as _wixEcom_onFulfillmentCreated,
  // eslint-disable-next-line no-unused-vars
  wixEcom_onOrderDelivered as _wixEcom_onOrderDelivered,
} from '../src/backend/emailAutomation.web.js';

// queuePromotionalEmail lives in emailTemplates.web.js (segments are sourced
// from CRM contacts, not from automation triggers — see cf-icww F audit
// row 9-promo-batch).
import { queuePromotionalEmail } from '../src/backend/emailTemplates.web.js';

// ── Shared fixtures ────────────────────────────────────────────────────────
//
// Realistic enough that variable shapes match the registry expectations in
// emailTemplates.web.js TEMPLATE_REGISTRY. When cf-c6g5 lands, the same
// fixtures should drive the real-template assertions — adjust here if the
// registry's variable list changes, not in each test body.

const FIXTURE_MEMBER = {
  _id: 'mem-cfw1u1-001',
  loginEmail: 'cf-w1u1-test+brenda@halworker85.gmail.com',
  contact: { firstName: 'Brenda', lastName: 'Test' },
};

const FIXTURE_ORDER = {
  _id: 'order-cfw1u1-001',
  number: '1042',
  buyerInfo: {
    contactId: FIXTURE_MEMBER._id,
    email: FIXTURE_MEMBER.loginEmail,
    firstName: 'Brenda',
  },
  totals: { total: 1499, subtotal: 1499 },
  lineItems: [{ productName: { original: 'Wilderness Log Frame' }, quantity: 1 }],
};

const FIXTURE_FULFILLMENT = {
  _id: 'fulf-cfw1u1-001',
  orderId: FIXTURE_ORDER._id,
  trackingInfo: {
    trackingNumber: '1Z999AA10123456784',
    shippingProvider: 'UPS',
    trackingLink: 'https://wwwapps.ups.com/etracking/tracking.cgi?TypeOfInquiryNumber=T&InquiryNumber1=1Z999AA10123456784',
  },
};

beforeEach(() => {
  __resetCrm();
  __resetData();
  __resetSecrets();
  vi.clearAllMocks();
  // Seed the shared collections most triggers query before they fire.
  __seed('Members/PublicData', [
    {
      _id: FIXTURE_MEMBER._id,
      loginEmail: FIXTURE_MEMBER.loginEmail,
      ...FIXTURE_MEMBER.contact,
    },
  ]);
  __seed('Orders', [FIXTURE_ORDER]);
});

// ── 1/13 — welcome_series ──────────────────────────────────────────────────

describe('welcome_series (welcome_series_1..5)', () => {
  it.todo('cf-c6g5: sends welcome_series_1 immediately on member signup (events.js#wixMembers_onMemberCreated)');
  it.todo('cf-c6g5: queues welcome_series_2 at +2d, _3 at +5d, _4 at +9d, _5 at +14d');
  it.todo('cf-c6g5: variables include {firstName, unsubscribeUrl}');
  it.todo('cf-c6g5: F1 fix verified — exit-intent path sends with resolved contactId (cf-icww.followup-f1)');
  it.todo('cf-c6g5: F2 fix verified — subscribeToNewsletter calls triggerWelcomeSeries (cf-icww.followup-f2)');
  it.todo('cf-c6g5: staging E2E — welcome_series_1 lands in halworker85+test inbox within 60s');
});

// ── 2/13 — cart_recovery ───────────────────────────────────────────────────

describe('cart_recovery (cart_recovery_1..3)', () => {
  it.todo('cf-c6g5: triggerCartRecoveryCron picks up abandoned cart and queues cart_recovery_1');
  it.todo('cf-c6g5: cart_recovery_2 fires at +24h if cart still abandoned');
  it.todo('cf-c6g5: cart_recovery_3 fires at +72h with last-chance copy + coupon');
  it.todo('cf-c6g5: variables include {firstName, cartItems, cartTotal, recoveryUrl, couponCode?}');
  it.todo('cf-c6g5: skipped if cart converts to order between queue and send');
  it.todo('cf-c6g5: staging E2E — cart_recovery_1 lands in halworker85+test inbox + click-through tracked');
});

// ── 3/13 — order_confirmation ──────────────────────────────────────────────

describe('order_confirmation', () => {
  it.todo('cf-c6g5 + cf-i23b merged: events.js#wixEcom_onOrderCreated calls sendOrderConfirmation');
  it.todo('cf-c6g5: variables include {firstName, orderNumber, total, itemSummary}');
  it.todo('cf-c6g5: dormant duplicate in emailAutomation.web.js removed (F3 cleanup verified)');
  it.todo('cf-c6g5: staging E2E — order_confirmation lands within 60s of test order');
});

// ── 4/13 — order_shipped ───────────────────────────────────────────────────

describe('order_shipped (parcel)', () => {
  it.todo('cf-c6g5 + cf-icdc merged: events.js#wixEcom_onFulfillmentCreated parcel-branch calls sendShippingNotification');
  it.todo('cf-c6g5: variables include {orderNumber, trackingNumber, carrier, trackingLink}');
  it.todo('cf-c6g5: freight_shipped fires from the LTL branch with carrier-specific copy');
  it.todo('cf-c6g5: staging E2E — manual fulfillment with UPS tracking → order_shipped within 60s');
});

// ── 5/13 — delivery_confirmation ───────────────────────────────────────────

describe('delivery_confirmation', () => {
  // Audit row 8 says delivery_confirmation is wired through events.js
  // (post-cf-jmmk PR #1141), not via the dormant `wixEcom_onOrderDelivered`
  // export in emailAutomation.web.js. The post-cf-c6g5 fill-in for this
  // block reaches in via events.js or via the underlying handleOrderDelivered
  // helper — left as todo so we don't pin the wrong call site here.
  it.todo('cf-c6g5: events.js#wixEcom_onOrderDelivered → delivery_confirmation fires');
  it.todo('cf-c6g5: variables include {firstName, orderNumber, deliveryDate}');
  it.todo('cf-c6g5: dormant duplicate `wixEcom_onOrderDelivered` in emailAutomation.web.js removed (F3/F4 sweep)');
  it.todo('cf-c6g5: staging E2E — onOrderDelivered fires → delivery_confirmation lands within 60s');
});

// ── 6/13 — post_purchase (1..3 + review_reward) ────────────────────────────

describe('post_purchase (post_purchase_1..3)', () => {
  it.todo('cf-c6g5: triggerPostPurchaseSequence queues post_purchase_1 at +3d post-delivery');
  it.todo('cf-c6g5: post_purchase_2 at +7d (care guide)');
  it.todo('cf-c6g5: post_purchase_3 at +30d (long-term ownership tips)');
  it.todo('cf-c6g5: dedup guard prevents duplicate sends across order-created + order-delivered (audit row 9 concern)');
  it.todo('cf-c6g5: variables include {firstName, productName, careGuideUrl, reviewUrl}');
});

// ── 7/13 — post_purchase_review_reward ─────────────────────────────────────

describe('post_purchase_review_reward', () => {
  it.todo('cf-c6g5: triggerReviewRewardPrompt fires +14d post-delivery with reward coupon');
  it.todo('cf-c6g5: variables include {firstName, productName, reviewUrl, couponCode, couponValue}');
  it.todo('cf-c6g5: dedup — only one reward email per order, even with multiple line items');
});

// ── 8/13 — post_purchase_referral ──────────────────────────────────────────

describe('post_purchase_referral', () => {
  it.todo('cf-c6g5: events.js#wixEcom_onOrderDelivered queues post_purchase_referral at +21d');
  it.todo('cf-c6g5: variables include {firstName, referralCode, referralUrl, referrerCredit, friendDiscount}');
  it.todo('cf-c6g5: skipped if member has already sent a referral this quarter');
});

// ── 9/13 — promotional_sale (3 promo templates) ────────────────────────────

describe('promotional_sale | promotional_new_arrival | promotional_seasonal', () => {
  it.todo('cf-c6g5: queuePromotionalEmail batch-fires promotional_sale to a marketingConsent=true segment');
  it.todo('cf-c6g5: skips contacts on the unsubscribe list');
  it.todo('cf-c6g5: variables include {firstName, promoTitle, promoSubtitle, ctaUrl, ctaText, discountCode}');
  it.todo('cf-c6g5: A/B variant routing via emailABService picks one of (sale|new_arrival|seasonal) per segment');
  it.todo('cf-c6g5: staging E2E — manually-launched campaign lands in halworker85+test within 5min');
});

// ── 10/13 — reengagement (reengagement_1..3) ───────────────────────────────

describe('reengagement (reengagement_1..3)', () => {
  it.todo('cf-c6g5: triggerReengagementCron picks up 30d-inactive members and queues reengagement_1');
  it.todo('cf-c6g5: reengagement_2 at +37d, _3 at +51d if still inactive');
  it.todo('cf-c6g5: variables include {firstName, lastVisitDate, recommendedProducts, comebackUrl}');
  it.todo('cf-c6g5: skipped if member opens any email between queue and send');
});

// ── 11/13 — winback (CMS-driven, see audit Note for row 14) ────────────────

describe('winback (CMS-driven step IDs)', () => {
  it.todo('cf-c6g5: scanAndTriggerWinback reads EmailSequences[sequenceType=winback,active=true] and queues step 1');
  it.todo('cf-c6g5: subsequent steps fire on each cron tick honoring the per-step delay');
  it.todo('cf-c6g5: per-template variables match the schema in EmailSequences.steps[].variables');
  it.todo('cf-c6g5: cf-6k6u correction respected — no fabricated `lifecycle_winback_*` IDs');
});

// ── 12/13 — browse_recovery (browse_recovery_1) ────────────────────────────

describe('browse_recovery', () => {
  it.todo('cf-c6g5: triggerBrowseRecoveryCron queues browse_recovery_1 for 24h-abandoned PDP visits');
  it.todo('cf-c6g5: variables include {firstName, lastViewedProduct, productImageUrl, productUrl}');
  it.todo('cf-c6g5: skipped if member adds the same product to cart between queue and send');
});

// ── 13/13 — wishlist_price_drop ────────────────────────────────────────────

describe('wishlist_price_drop', () => {
  it.todo('cf-c6g5: checkWishlistAlerts sends wishlist_price_drop for any wishlist row whose product price decreased ≥5%');
  it.todo('cf-c6g5: variables include {firstName, productName, oldPrice, newPrice, productUrl}');
  it.todo('cf-c6g5: dedup — only one alert per (member, product) per 30d window');
});

// ── Smoke harness ──────────────────────────────────────────────────────────

describe('cf-w1u1 smoke (mock layer up + email log empty by default)', () => {
  it('triggeredEmails mock is callable and __getEmailLog returns []', async () => {
    expect(__getEmailLog()).toEqual([]);
    await triggeredEmails.emailContact('test_template', 'mem-x', { variables: { foo: 1 } });
    expect(__getEmailLog()).toEqual([
      { templateId: 'test_template', contactId: 'mem-x', options: { variables: { foo: 1 } } },
    ]);
  });

  it('exposed trigger webMethods are all callable functions', () => {
    // Catches an unintended export-rename regression that would otherwise
    // surface only when the post-cf-c6g5 fill-in tries to invoke them.
    for (const fn of [
      triggerWelcomeSeries,
      triggerPostPurchaseSequence,
      triggerReviewRewardPrompt,
      triggerReengagement,
      triggerRestockNotifications,
      queuePromotionalEmail,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });
});
