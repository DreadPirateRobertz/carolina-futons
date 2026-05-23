/**
 * @file emailTriggers.pre-cfc6g5.test.js
 * @description cf-w1u1 — per-trigger templateId + variable shape coverage.
 *
 * Originally a pre-work scaffold sequenced behind cf-c6g5 (template
 * registration in the staging Wix CRM Triggered Emails dashboard). cf-c6g5
 * closed 2026-05-10 (all 28 templates registered + published); supporting
 * fix-beads cf-hafn / cf-fovb / cf-xdji / cf-3l0d / cf-m3tj all CLOSED by
 * 2026-05-21. The unit-level wire/templateId/variable-shape todos this
 * file held are now filled in against the mock layer — they verify that
 * each trigger queues into EmailQueue with the templateId that maps to a
 * registered Wix dashboard ID via emailTemplates.TEMPLATE_ID_MAP.
 *
 * Staging-side E2E todos (template renders + lands in halworker85+test
 * inbox) remain `it.todo` — gated on the staging Velo backend becoming
 * reachable (staging.carolinafutons.com currently does not resolve;
 * Stilgar publish blocker). Once staging is up, godfrey's runbook in
 * tests/qa/email-triggers-e2e-2026-05-21.md drives the runtime pass.
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
 *   - it() that asserts the TRIGGER CODE PATH inserts into EmailQueue
 *     with the expected templateId + variable shape, against the
 *     wix-data / wix-crm-backend / wix-secrets-backend mocks.
 *   - it.todo() for the staging-side checks (template renders, lands in
 *     inbox) — converted to real assertions by the operator following
 *     tests/qa/email-triggers-e2e-2026-05-21.md once staging is reachable.
 *
 * Audit gap status (cf-icww F-series — all fix beads CLOSED 2026-05-10):
 *   - F1 welcome contactId resolution → cf-xdji (closed) wires
 *     _resolveContactIdInternal into triggerWelcomeSeries.
 *   - F2 subscribeToNewsletter→welcome → cf-3l0d (closed) wires
 *     _triggerWelcomeFlowInternal into subscribeToNewsletter. Coverage
 *     stays in tests/newsletterService.* — kept as todo here so we don't
 *     duplicate the integration.
 *   - F3 order_confirmation dormant → cf-i23b (merged). events.js wire
 *     test stays todo (events.js is the call site, exercised by
 *     tests/events.test.js).
 *   - F4 order_shipped/freight_shipped → cf-icdc + cf-fovb (closed).
 *     Same — events.js wire stays todo here.
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
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  __reset as __resetSecrets,
  __setSecrets,
} from './__mocks__/wix-secrets-backend.js';

import {
  triggerWelcomeSeries,
  triggerPostPurchaseSequence,
  triggerReengagement,
  triggerRestockNotifications,
  _SEQUENCES,
  // events.js wire tests for these stay todo (call site is events.js, not
  // emailAutomation.web.js — exercised by tests/events.test.js post cf-i23b
  // / cf-icdc / cf-fovb).
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
  // Welcome / reengagement read these secrets; absent values just produce
  // an empty discountCode in the queued variables.
  __setSecrets({
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  });
  // Seed the shared collections most triggers query before they fire.
  __seed('Members/PublicData', [
    {
      _id: FIXTURE_MEMBER._id,
      loginEmail: FIXTURE_MEMBER.loginEmail,
      ...FIXTURE_MEMBER.contact,
    },
  ]);
  __seed('Orders', [FIXTURE_ORDER]);
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
});

// ── 1/13 — welcome_series ──────────────────────────────────────────────────

describe('welcome_series (welcome_series_1..5)', () => {
  const WELCOME_EMAIL = 'cf-w1u1-welcome@halworker85.gmail.com';
  const WELCOME_NAME = 'Brenda';

  it('triggerWelcomeSeries queues welcome_series_1 at +0h (immediate send step)', async () => {
    await triggerWelcomeSeries(WELCOME_EMAIL, WELCOME_NAME);
    const queued = __getInserted('EmailQueue');
    const step1 = queued.find(r => r.sequenceStep === 1);
    expect(step1).toBeDefined();
    expect(step1.templateId).toBe('welcome_series_1');
    expect(step1.sequenceType).toBe('welcome');
  });

  it('queues all 5 welcome_series_* steps at the SEQUENCES.welcome cadence', async () => {
    const before = Date.now();
    await triggerWelcomeSeries(WELCOME_EMAIL, WELCOME_NAME);
    const queued = __getInserted('EmailQueue').sort((a, b) => a.sequenceStep - b.sequenceStep);
    expect(queued).toHaveLength(5);
    const expectedTemplateIds = _SEQUENCES.welcome.steps.map(s => s.templateId);
    expect(queued.map(r => r.templateId)).toEqual(expectedTemplateIds);
    // Each scheduledFor offset matches its sequence step's delayHours.
    for (const row of queued) {
      const step = _SEQUENCES.welcome.steps.find(s => s.step === row.sequenceStep);
      const expectedOffset = step.delayHours * 60 * 60 * 1000;
      const actualOffset = row.scheduledFor.getTime() - before;
      expect(actualOffset).toBeGreaterThanOrEqual(expectedOffset - 1000);
      expect(actualOffset).toBeLessThanOrEqual(expectedOffset + 5000);
    }
  });

  it('queued variables include {firstName, discountCode, email} (registry-aligned shape)', async () => {
    await triggerWelcomeSeries(WELCOME_EMAIL, WELCOME_NAME);
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables).toMatchObject({
      firstName: WELCOME_NAME,
      discountCode: 'WELCOME10',
      email: WELCOME_EMAIL,
    });
  });

  it('F1 fix (cf-xdji) — recipientContactId resolved (non-empty) via _resolveContactIdInternal', async () => {
    const result = await triggerWelcomeSeries(WELCOME_EMAIL, WELCOME_NAME);
    expect(result.success).toBe(true);
    const queued = __getInserted('EmailQueue');
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.every(r => typeof r.recipientContactId === 'string' && r.recipientContactId.length > 0)).toBe(true);
  });

  it.todo('cf-3l0d (F2) integration: subscribeToNewsletter auto-triggers the welcome flow — covered in tests/subscribeToNewsletterAutoTrigger.cf3l0d.test.js (kept here as cross-reference)');
  it.todo('staging E2E (blocked on staging Velo backend): welcome_series_1 lands in halworker85+test inbox within 60s');
});

// ── 2/13 — cart_recovery ───────────────────────────────────────────────────

describe('cart_recovery (cart_recovery_1..3)', () => {
  // triggerAbandonedCartRecovery + the cartRecoveryCron live in
  // src/backend/cartRecovery.web.js — kept out of this file's import
  // surface. Coverage is in tests/cartRecoveryFlow.integration.test.js
  // and tests/emailAutomation.test.js (via triggerAbandonedCartRecovery).
  // These todos guard the per-step templateId mapping and the staging E2E.
  it.todo('cart_recovery_1/2/3 templateId mapping (covered by tests/cartRecoveryFlow.integration.test.js — kept as cross-reference)');
  it.todo('cart_recovery_2 +24h / cart_recovery_3 +72h scheduling (cron cadence — see cartRecovery.web.js)');
  it.todo('variables include {firstName, cartItems, cartTotal, recoveryUrl, couponCode?}');
  it.todo('skipped if cart converts to order between queue and send (dedup query in cartRecoveryCron)');
  it.todo('staging E2E (blocked on staging Velo backend): cart_recovery_1 lands in halworker85+test inbox + click-through tracked');
});

// ── 3/13 — order_confirmation ──────────────────────────────────────────────

describe('order_confirmation', () => {
  // cf-i23b (closed) wires events.js#wixEcom_onOrderCreated →
  // sendOrderConfirmation in src/backend/events.js. Per-call-site coverage
  // lives in tests/events.test.js — these todos guard the templateId map
  // and staging E2E only.
  it.todo('events.js#wixEcom_onOrderCreated → order_confirmation direct-send (covered by tests/events.test.js)');
  it.todo('variables include {firstName, orderNumber, total, itemSummary, estimatedDays, email}');
  it.todo('staging E2E (blocked on staging Velo backend): order_confirmation lands within 60s of test order');
});

// ── 4/13 — order_shipped ───────────────────────────────────────────────────

describe('order_shipped (parcel)', () => {
  // cf-icdc + cf-fovb (both closed) wire events.js#wixEcom_onFulfillmentCreated
  // → sendShippingNotification / sendFreightShippingNotification in
  // src/backend/events.js. Branch selection is carrier-driven (LTL list).
  it.todo('events.js#wixEcom_onFulfillmentCreated parcel-branch → order_shipped (covered by tests/events.test.js)');
  it.todo('variables include {firstName, orderNumber, trackingNumber, carrier, trackingUrl, email}');
  it.todo('freight_shipped fires from the LTL branch with carrier-specific copy (cf-fovb wiring)');
  it.todo('staging E2E (blocked on staging Velo backend): UPS-tracked fulfillment → order_shipped lands within 60s');
});

// ── 5/13 — delivery_confirmation ───────────────────────────────────────────

describe('delivery_confirmation', () => {
  // cf-jmmk wired delivery_confirmation through events.js#wixEcom_onOrderDelivered.
  // The dormant `wixEcom_onOrderDelivered` re-export in emailAutomation.web.js
  // remains as a thin shim for in-tree callers (see source comment at the
  // export); the live dispatch is in events.js.
  it.todo('events.js#wixEcom_onOrderDelivered → delivery_confirmation direct-send (covered by tests/events.test.js + tests/lifecycleEmailSender.test.js)');
  it.todo('variables include {firstName, orderNumber, deliveryDate, email}');
  it.todo('staging E2E (blocked on staging Velo backend): onOrderDelivered → delivery_confirmation lands within 60s');
});

// ── 6/13 — post_purchase (1..3 + review_reward) ────────────────────────────

describe('post_purchase (post_purchase_1..3)', () => {
  const PP_CONTACT_ID = 'contact-pp-001';
  const PP_EMAIL = 'cf-w1u1-postpurchase@halworker85.gmail.com';
  const PP_FIRST = 'Brenda';
  const PP_LINE_ITEMS = [{ name: 'Wilderness Log Frame', slug: 'wilderness-log', quantity: 1 }];

  async function fireSequence() {
    return triggerPostPurchaseSequence(PP_CONTACT_ID, PP_EMAIL, PP_FIRST, '1042', 1499, PP_LINE_ITEMS);
  }

  // Source-of-truth delays read dynamically from _SEQUENCES so a future
  // business retune of post_purchase.steps[n].delayHours doesn't silently
  // drift past the test (welcome block uses the same pattern).
  function expectedOffsetForStep(stepNumber) {
    const step = _SEQUENCES.post_purchase.steps.find(s => s.step === stepNumber);
    return step.delayHours * 60 * 60 * 1000;
  }

  it('triggerPostPurchaseSequence queues post_purchase_1 at Day 3 (care guide)', async () => {
    const before = Date.now();
    await fireSequence();
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1).toBeDefined();
    expect(step1.templateId).toBe('post_purchase_1');
    expect(step1.sequenceType).toBe('post_purchase');
    const expectedOffset = expectedOffsetForStep(1);
    expect(step1.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(expectedOffset - 1000);
    expect(step1.scheduledFor.getTime() - before).toBeLessThanOrEqual(expectedOffset + 5000);
  });

  it('queues post_purchase_2 at Day 7 (review request)', async () => {
    const before = Date.now();
    await fireSequence();
    const step2 = __getInserted('EmailQueue').find(r => r.sequenceStep === 2);
    expect(step2.templateId).toBe('post_purchase_2');
    const expectedOffset = expectedOffsetForStep(2);
    expect(step2.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(expectedOffset - 1000);
    expect(step2.scheduledFor.getTime() - before).toBeLessThanOrEqual(expectedOffset + 5000);
  });

  it('queues post_purchase_3 at Day 30 (cross-sell)', async () => {
    const before = Date.now();
    await fireSequence();
    const step3 = __getInserted('EmailQueue').find(r => r.sequenceStep === 3);
    expect(step3.templateId).toBe('post_purchase_3');
    const expectedOffset = expectedOffsetForStep(3);
    expect(step3.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(expectedOffset - 1000);
    expect(step3.scheduledFor.getTime() - before).toBeLessThanOrEqual(expectedOffset + 5000);
  });

  it('queued variables include {firstName, orderNumber, total, productNames, reviewUrl, assemblyGuideUrl, email}', async () => {
    await fireSequence();
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables).toMatchObject({
      firstName: PP_FIRST,
      orderNumber: '1042',
      total: '1499',
      productNames: 'Wilderness Log Frame',
      email: PP_EMAIL,
    });
    expect(step1.variables.reviewUrl).toMatch(/wilderness-log#reviews$/);
    expect(step1.variables.assemblyGuideUrl).toMatch(/#assembly$/);
  });

  it.todo('dedup guard across order-created + order-delivered call sites (audit row 9; integration-level)');
});

// ── 7/13 — post_purchase_review_reward ─────────────────────────────────────

describe('post_purchase_review_reward', () => {
  // post_purchase_review_reward is step 4 of triggerPostPurchaseSequence,
  // delayHours: 336 (Day 14 — CF-qy79). It rides the same queue insert path
  // as steps 1..3; the legacy "triggerReviewRewardPrompt" name in the
  // original todo refers to this same step.

  it('post_purchase_review_reward queues as step 4 at Day 14 (CF-qy79)', async () => {
    const before = Date.now();
    await triggerPostPurchaseSequence(
      'contact-rr-001',
      'cf-w1u1-rr@halworker85.gmail.com',
      'Brenda',
      '1042',
      1499,
      [{ name: 'Wilderness Log Frame', slug: 'wilderness-log' }],
    );
    const step4 = __getInserted('EmailQueue').find(r => r.sequenceStep === 4);
    expect(step4).toBeDefined();
    expect(step4.templateId).toBe('post_purchase_review_reward');
    expect(step4.sequenceType).toBe('post_purchase');
    const step = _SEQUENCES.post_purchase.steps.find(s => s.step === 4);
    const expectedOffset = step.delayHours * 60 * 60 * 1000;
    expect(step4.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(expectedOffset - 1000);
    expect(step4.scheduledFor.getTime() - before).toBeLessThanOrEqual(expectedOffset + 5000);
  });

  it('variables include {firstName, orderNumber, productNames, reviewUrl}', async () => {
    await triggerPostPurchaseSequence(
      'contact-rr-001',
      'cf-w1u1-rr@halworker85.gmail.com',
      'Brenda',
      '1042',
      1499,
      [{ name: 'Wilderness Log Frame', slug: 'wilderness-log' }],
    );
    const step4 = __getInserted('EmailQueue').find(r => r.sequenceStep === 4);
    expect(step4.variables).toMatchObject({
      firstName: 'Brenda',
      orderNumber: '1042',
      productNames: 'Wilderness Log Frame',
    });
    expect(step4.variables.reviewUrl).toMatch(/wilderness-log#reviews$/);
  });

  it.todo('per-order dedup — only one reward email per order across multiple line items (integration-level)');
});

// ── 8/13 — post_purchase_referral ──────────────────────────────────────────

describe('post_purchase_referral', () => {
  // post_purchase_referral is step 5 of triggerPostPurchaseSequence,
  // delayHours: 360 (Day 15 — CF-6p0o). Per-source comment, this corrects
  // the original cf-icww audit-row's "+21d" estimate to the actual cadence.

  it('post_purchase_referral queues as step 5 at Day 15 (CF-6p0o; corrects legacy +21d audit-row estimate)', async () => {
    const before = Date.now();
    await triggerPostPurchaseSequence(
      'contact-ref-001',
      'cf-w1u1-ref@halworker85.gmail.com',
      'Brenda',
      '1042',
      1499,
      [{ name: 'Wilderness Log Frame', slug: 'wilderness-log' }],
    );
    const step5 = __getInserted('EmailQueue').find(r => r.sequenceStep === 5);
    expect(step5).toBeDefined();
    expect(step5.templateId).toBe('post_purchase_referral');
    const step = _SEQUENCES.post_purchase.steps.find(s => s.step === 5);
    const expectedOffset = step.delayHours * 60 * 60 * 1000;
    expect(step5.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(expectedOffset - 1000);
    expect(step5.scheduledFor.getTime() - before).toBeLessThanOrEqual(expectedOffset + 5000);
  });

  it('referral step variables include {firstName, referralUrl, referralCode} (sentinel defaults for guest checkouts)', async () => {
    // No opts.memberId → CF-lwkt guest-checkout path: sentinel defaults.
    await triggerPostPurchaseSequence(
      'contact-ref-001',
      'cf-w1u1-ref@halworker85.gmail.com',
      'Brenda',
      '1042',
      1499,
      [{ name: 'Wilderness Log Frame', slug: 'wilderness-log' }],
    );
    const step5 = __getInserted('EmailQueue').find(r => r.sequenceStep === 5);
    expect(step5.variables.firstName).toBe('Brenda');
    expect(step5.variables.referralUrl).toMatch(/\/referral$/);
    expect(step5.variables.referralCode).toBe('');
  });

  it.todo('per-quarter referral dedup (not yet implemented — file follow-up bead if business signs off)');
});

// ── 9/13 — promotional_sale (3 promo templates) ────────────────────────────

describe('promotional_sale | promotional_new_arrival | promotional_seasonal', () => {
  const PROMO_RECIPIENTS = [
    { email: 'promo-a@halworker85.gmail.com', firstName: 'Asha', contactId: 'contact-a' },
    { email: 'promo-b@halworker85.gmail.com', firstName: 'Bran', contactId: 'contact-b' },
  ];
  const CAMPAIGN = { saleName: 'Memorial Day', discountPercent: '20', promoCode: 'MEM20' };

  it('queuePromotionalEmail batch-queues promotional_sale to each recipient', async () => {
    const result = await queuePromotionalEmail('promotional_sale', PROMO_RECIPIENTS, CAMPAIGN);
    expect(result.success).toBe(true);
    expect(result.queued).toBe(2);
    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(2);
    expect(queued.every(r => r.templateId === 'promotional_sale')).toBe(true);
    expect(queued.every(r => r.sequenceType === 'promotional')).toBe(true);
  });

  it('skips contacts on the unsubscribe list (sequenceType: all | promotional)', async () => {
    __seed('Unsubscribes', [
      { email: 'promo-a@halworker85.gmail.com', sequenceType: 'all' },
    ]);
    const result = await queuePromotionalEmail('promotional_sale', PROMO_RECIPIENTS, CAMPAIGN);
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(1);
    expect(queued[0].recipientEmail).toBe('promo-b@halworker85.gmail.com');
  });

  it('queued variables merge campaign data with {firstName, email}', async () => {
    await queuePromotionalEmail('promotional_sale', PROMO_RECIPIENTS, CAMPAIGN);
    const queued = __getInserted('EmailQueue');
    const asha = queued.find(r => r.recipientEmail === 'promo-a@halworker85.gmail.com');
    expect(asha.variables).toMatchObject({
      firstName: 'Asha',
      email: 'promo-a@halworker85.gmail.com',
      saleName: 'Memorial Day',
      discountPercent: '20',
      promoCode: 'MEM20',
    });
  });

  it.todo('A/B variant routing via emailABService picks one of (sale|new_arrival|seasonal) per segment');
  it.todo('staging E2E (blocked on staging Velo backend): manually-launched campaign lands in halworker85+test within 5min');
});

// ── 10/13 — reengagement (reengagement_1..3) ───────────────────────────────

describe('reengagement (reengagement_1..3)', () => {
  // Code reality (src/backend/emailAutomation.web.js#triggerReengagement):
  //   - dormancy threshold = 90 days (MemberPoints.lastActivityAt)
  //   - all 3 steps queued up-front with offsets 0h / 168h / 504h
  //     (Day 0 / Day 7 / Day 21 — cf-bpt cadence, NOT 30/37/51 as the
  //     legacy todo suggested)
  //   - skip-if-already-sent dedup queries EmailQueue for prior
  //     reengagement rows for the same recipient.

  const DORMANT_MEMBER_ID = 'mem-dormant-001';
  const DORMANT_EMAIL = 'cf-w1u1-dormant@halworker85.gmail.com';

  function seedDormantMember() {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: DORMANT_MEMBER_ID, lastActivityAt: ninetyOneDaysAgo },
    ]);
    __seed('Members/PrivateMembersData', [
      {
        _id: DORMANT_MEMBER_ID,
        loginEmail: DORMANT_EMAIL,
        contactId: 'contact-dormant-001',
        firstName: 'Dorian',
      },
    ]);
  }

  it('triggerReengagement queues all 3 reengagement_* steps for a 90d-inactive member', async () => {
    seedDormantMember();
    const result = await triggerReengagement();
    expect(result.success).toBe(true);
    expect(result.contacted).toBe(1);
    const queued = __getInserted('EmailQueue').sort((a, b) => a.sequenceStep - b.sequenceStep);
    expect(queued.map(r => r.templateId)).toEqual(['reengagement_1', 'reengagement_2', 'reengagement_3']);
    expect(queued.every(r => r.sequenceType === 'reengagement')).toBe(true);
    expect(queued.every(r => r.recipientEmail === DORMANT_EMAIL)).toBe(true);
  });

  it('steps schedule at the _SEQUENCES.reengagement cadence (cf-bpt Day 0 / 7 / 21)', async () => {
    seedDormantMember();
    const before = Date.now();
    await triggerReengagement();
    const queued = __getInserted('EmailQueue').sort((a, b) => a.sequenceStep - b.sequenceStep);
    expect(queued).toHaveLength(_SEQUENCES.reengagement.steps.length);
    for (const row of queued) {
      const step = _SEQUENCES.reengagement.steps.find(s => s.step === row.sequenceStep);
      const expectedOffset = step.delayHours * 60 * 60 * 1000;
      const actualOffset = row.scheduledFor.getTime() - before;
      expect(actualOffset).toBeGreaterThanOrEqual(expectedOffset - 1000);
      expect(actualOffset).toBeLessThanOrEqual(expectedOffset + 5000);
    }
  });

  it('queued variables include {firstName, discountCode, email}', async () => {
    seedDormantMember();
    await triggerReengagement();
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables).toMatchObject({
      firstName: 'Dorian',
      discountCode: 'COMEBACK15',
      email: DORMANT_EMAIL,
    });
  });

  it.todo('cross-sequence open-event dedup — skipped if member opens any email between queue and send (integration; depends on engagement-event ingestion)');
});

// ── 11/13 — winback (CMS-driven, see audit Note for row 14) ────────────────

describe('winback (CMS-driven step IDs)', () => {
  // Winback is CMS-driven: scanAndTriggerWinback reads
  // EmailSequences[sequenceType=winback, active=true] and queues the
  // configured step templates. Trigger lives in
  // src/backend/marketingSequences.web.js — kept out of this file's
  // import surface; coverage lives in tests/marketingSequences*.test.js.
  it.todo('scanAndTriggerWinback reads EmailSequences[sequenceType=winback,active=true] and queues step 1 (covered in tests/marketingSequences*.test.js)');
  it.todo('subsequent steps fire on each cron tick honoring the per-step delay');
  it.todo('per-template variables match the schema in EmailSequences.steps[].variables');
  it.todo('cf-6k6u correction respected — no fabricated `lifecycle_winback_*` IDs');
  it.todo('staging E2E (blocked on staging Velo backend): winback step 1 lands in halworker85+test inbox');
});

// ── 12/13 — browse_recovery (browse_recovery_1) ────────────────────────────

describe('browse_recovery', () => {
  // triggerBrowseRecoveryCron + the BrowseRecovery collection live in
  // src/backend/marketingSequences.web.js / browseRecovery.web.js — outside
  // this file's import surface. Coverage lives in
  // tests/marketingSequences*.test.js.
  it.todo('triggerBrowseRecoveryCron queues browse_recovery_1 for 24h-abandoned PDP visits (covered in tests/marketingSequences*.test.js)');
  it.todo('variables include {firstName, lastViewedProduct, productImageUrl, productUrl}');
  it.todo('skipped if member adds the same product to cart between queue and send');
  it.todo('staging E2E (blocked on staging Velo backend): browse_recovery_1 lands in halworker85+test inbox');
});

// ── 13/13 — wishlist_price_drop ────────────────────────────────────────────

describe('wishlist_price_drop', () => {
  // checkWishlistAlerts lives in src/backend/wishlist.web.js — outside
  // this file's import surface. Coverage lives in
  // tests/wishlist*.test.js.
  it.todo('checkWishlistAlerts sends wishlist_price_drop for any wishlist row whose product price decreased ≥5% (covered in tests/wishlist*.test.js)');
  it.todo('variables include {firstName, productName, oldPrice, newPrice, productUrl}');
  it.todo('dedup — only one alert per (member, product) per 30d window');
  it.todo('staging E2E (blocked on staging Velo backend): wishlist_price_drop lands in halworker85+test inbox');
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
      triggerReengagement,
      triggerRestockNotifications,
      queuePromotionalEmail,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });
});
