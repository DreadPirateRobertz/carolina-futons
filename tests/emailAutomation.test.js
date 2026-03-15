import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  triggerWelcomeSequence,
  triggerPostPurchaseSequence,
  triggerAbandonedCartRecovery,
  triggerReengagement,
  processEmailQueue,
  unsubscribeContact,
  getEmailAutomationStats,
  recordEmailEvent,
  getEmailEvents,
  wixMembers_onMemberCreated,
  wixEcom_onOrderCreated,
  wixEcom_onOrderCanceled,
  _SEQUENCES,
  _MAX_RETRY_ATTEMPTS,
} from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __setSecrets({
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  });
});

// ── Sequence Definitions ────────────────────────────────────────────

describe('sequence definitions', () => {
  it('has welcome sequence with 3 steps', () => {
    expect(_SEQUENCES.welcome.steps).toHaveLength(3);
    expect(_SEQUENCES.welcome.steps[0].delayHours).toBe(0);
    expect(_SEQUENCES.welcome.steps[1].delayHours).toBe(72);
    expect(_SEQUENCES.welcome.steps[2].delayHours).toBe(168);
  });

  it('has cart_recovery sequence with 1h/24h/72h triggers', () => {
    expect(_SEQUENCES.cart_recovery.steps).toHaveLength(3);
    expect(_SEQUENCES.cart_recovery.steps[0].delayHours).toBe(1);
    expect(_SEQUENCES.cart_recovery.steps[1].delayHours).toBe(24);
    expect(_SEQUENCES.cart_recovery.steps[2].delayHours).toBe(72);
  });

  it('has post_purchase sequence with day 3/7/30 timing', () => {
    expect(_SEQUENCES.post_purchase.steps).toHaveLength(3);
    expect(_SEQUENCES.post_purchase.steps[0].delayHours).toBe(72);   // Day 3: Assembly follow-up
    expect(_SEQUENCES.post_purchase.steps[1].delayHours).toBe(168);  // Day 7: Review solicitation
    expect(_SEQUENCES.post_purchase.steps[2].delayHours).toBe(720);  // Day 30: Care guide + upsell
  });

  it('has post_purchase step descriptions matching day 3/7/30 redesign', () => {
    expect(_SEQUENCES.post_purchase.steps[0].description).toContain('Assembly follow-up');
    expect(_SEQUENCES.post_purchase.steps[1].description).toContain('Review solicitation');
    expect(_SEQUENCES.post_purchase.steps[2].description).toContain('Care guide');
  });

  it('has reengagement sequence with 1 step', () => {
    expect(_SEQUENCES.reengagement.steps).toHaveLength(1);
  });

  it('has A/B variants for welcome step 1', () => {
    expect(_SEQUENCES.welcome.abTestStep).toBe(1);
    expect(_SEQUENCES.welcome.abVariants.A.subjectLine).toBeTruthy();
    expect(_SEQUENCES.welcome.abVariants.B.subjectLine).toBeTruthy();
  });

  it('sets max retry attempts to 3', () => {
    expect(_MAX_RETRY_ATTEMPTS).toBe(3);
  });
});

// ── triggerWelcomeSequence ──────────────────────────────────────────

describe('triggerWelcomeSequence', () => {
  it('queues 3 welcome emails for a new member', async () => {
    const result = await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });

  it('includes discount code in variables', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');

    expect(insertedItems.length).toBe(3);
    expect(insertedItems[0].variables.discountCode).toBe('WELCOME10');
    expect(insertedItems[0].variables.discountAvailable).toBe(true);
  });

  it('sets discountAvailable false when secret missing', async () => {
    __resetSecrets();
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');

    expect(insertedItems[0].variables.discountCode).toBe('');
    expect(insertedItems[0].variables.discountAvailable).toBe(false);
  });

  it('sets A/B variant on step 1', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');

    const step1 = insertedItems.find(i => i.sequenceStep === 1);
    expect(step1.abVariant).toMatch(/^[AB]$/);
    expect(step1.variables.subjectLine).toBeTruthy();
  });

  it('does not set A/B variant on steps 2 and 3', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');

    const step2 = insertedItems.find(i => i.sequenceStep === 2);
    const step3 = insertedItems.find(i => i.sequenceStep === 3);
    expect(step2.abVariant).toBeNull();
    expect(step3.abVariant).toBeNull();
  });

  it('rejects invalid email', async () => {
    const result = await triggerWelcomeSequence('contact-1', 'not-an-email', 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('rejects empty email', async () => {
    const result = await triggerWelcomeSequence('contact-1', '', 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('prevents duplicate welcome sequence for same email', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-existing',
      recipientEmail: 'alice@test.com',
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
    }]);

    const result = await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('skips unsubscribed contacts', async () => {
    __seed('Unsubscribes', [{
      email: 'alice@test.com',
      sequenceType: 'welcome',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('skips contacts unsubscribed from all', async () => {
    __seed('Unsubscribes', [{
      email: 'alice@test.com',
      sequenceType: 'all',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('normalizes email to lowercase', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerWelcomeSequence('contact-1', 'Alice@Test.COM', 'Alice');

    expect(insertedItems[0].recipientEmail).toBe('alice@test.com');
  });

  it('schedules emails at correct delays', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    const before = Date.now();
    await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');

    const step1Time = new Date(insertedItems[0].scheduledFor).getTime();
    const step2Time = new Date(insertedItems[1].scheduledFor).getTime();
    const step3Time = new Date(insertedItems[2].scheduledFor).getTime();

    // Step 1: immediate (0h delay)
    expect(step1Time).toBeGreaterThanOrEqual(before);
    expect(step1Time).toBeLessThan(before + 5000);

    // Step 2: 72h delay
    expect(step2Time - step1Time).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000 - 1000);

    // Step 3: 168h delay
    expect(step3Time - step1Time).toBeGreaterThanOrEqual(168 * 60 * 60 * 1000 - 1000);
  });

  it('handles missing discount code secret gracefully', async () => {
    __setSecrets({}); // Clear secrets — getSecret will throw

    const result = await triggerWelcomeSequence('contact-1', 'alice@test.com', 'Alice');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });
});

// ── triggerPostPurchaseSequence ─────────────────────────────────────

describe('triggerPostPurchaseSequence', () => {
  it('queues 3 post-purchase emails', async () => {
    const result = await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 899, [
        { name: 'Eureka Frame', quantity: 1, price: 599 },
        { name: 'Mattress', quantity: 1, price: 300 },
      ]
    );
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });

  it('includes order details in email variables', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 899, [
        { name: 'Eureka Frame', quantity: 1, price: 599 },
      ]
    );

    expect(insertedItems[0].variables.orderNumber).toBe('ORD-001');
    expect(insertedItems[0].variables.total).toBe('899');
    expect(insertedItems[0].variables.productNames).toContain('Eureka Frame');
    expect(insertedItems[0].variables.firstName).toBe('Bob');
  });

  it('rejects invalid email', async () => {
    const result = await triggerPostPurchaseSequence(
      'contact-1', 'bad-email', 'Bob', 'ORD-001', 100, []
    );
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('skips unsubscribed contacts', async () => {
    __seed('Unsubscribes', [{
      email: 'buyer@test.com',
      sequenceType: 'post_purchase',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 100, []
    );
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('handles empty line items', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 100, []
    );

    expect(insertedItems[0].variables.productNames).toBe('');
  });

  it('schedules post-purchase at day 3/7/30 delays', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    const before = Date.now();
    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 100, []
    );

    const step1Time = new Date(insertedItems[0].scheduledFor).getTime();
    const step2Time = new Date(insertedItems[1].scheduledFor).getTime();
    const step3Time = new Date(insertedItems[2].scheduledFor).getTime();

    // Step 1: 72h (day 3) after queue time
    expect(step1Time - before).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000 - 1000);

    // Step 2: 168h (day 7) after queue time
    expect(step2Time - before).toBeGreaterThanOrEqual(168 * 60 * 60 * 1000 - 1000);

    // Step 3: 720h (day 30) after queue time
    expect(step3Time - before).toBeGreaterThanOrEqual(720 * 60 * 60 * 1000 - 1000);
  });

  it('includes assemblyGuideUrl and reviewUrl in post-purchase variables', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Bob', 'ORD-001', 899, [
        { name: 'Eureka Frame', quantity: 1, price: 599 },
      ]
    );

    // All steps should have assemblyGuideUrl and reviewUrl
    for (const item of insertedItems) {
      expect(item.variables).toHaveProperty('assemblyGuideUrl');
      expect(item.variables).toHaveProperty('reviewUrl');
      expect(item.variables.assemblyGuideUrl).toBeTruthy();
      expect(item.variables.reviewUrl).toBeTruthy();
    }
  });
});

// ── triggerAbandonedCartRecovery ────────────────────────────────────

describe('triggerAbandonedCartRecovery', () => {
  it('processes abandoned carts and queues recovery emails', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'shopper@test.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: [{ name: 'Eureka Frame', quantity: 1 }],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBe(1);
  });

  it('queues 3 recovery steps per cart', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'shopper@test.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: [{ name: 'Eureka Frame', quantity: 1 }],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerAbandonedCartRecovery();

    const recoveryEmails = insertedItems.filter(i => i.sequenceType === 'cart_recovery');
    expect(recoveryEmails).toHaveLength(3);
    expect(recoveryEmails[0].sequenceStep).toBe(1);
    expect(recoveryEmails[1].sequenceStep).toBe(2);
    expect(recoveryEmails[2].sequenceStep).toBe(3);
  });

  it('includes discount code only in step 3', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'shopper@test.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerAbandonedCartRecovery();

    const step1 = insertedItems.find(i => i.sequenceStep === 1);
    const step3 = insertedItems.find(i => i.sequenceStep === 3);
    expect(step1.variables.discountCode).toBe('');
    expect(step1.variables.discountAvailable).toBe(false);
    expect(step3.variables.discountCode).toBe('COMEBACK15');
    expect(step3.variables.discountAvailable).toBe(true);
  });

  it('marks cart as recovery email sent', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'shopper@test.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    await triggerAbandonedCartRecovery();

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.recoveryEmailSent).toBe(true);
    expect(updatedItem.recoveryEmailSentAt).toBeTruthy();
  });

  it('skips carts with invalid email', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'not-valid',
      buyerName: 'Bad',
      cartTotal: 100,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('skips unsubscribed contacts', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'unsub@test.com',
      buyerName: 'Unsub',
      cartTotal: 100,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    __seed('Unsubscribes', [{
      email: 'unsub@test.com',
      sequenceType: 'cart_recovery',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('skips carts already queued for recovery', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-1',
      buyerEmail: 'shopper@test.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    __seed('EmailQueue', [{
      _id: 'eq-1',
      recipientEmail: 'shopper@test.com',
      sequenceType: 'cart_recovery',
      checkoutId: 'ck-1',
      variables: { checkoutId: 'ck-1' },
      status: 'pending',
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('returns zero when no abandoned carts found', async () => {
    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBe(0);
  });
});

// ── triggerReengagement ────────────────────────────────────────────

describe('triggerReengagement', () => {
  it('queues reengagement for dormant contacts', async () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [{
      _id: 'eq-pp-1',
      recipientEmail: 'dormant@test.com',
      recipientContactId: 'contact-d1',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'sent',
      sentAt: ninetyOneDaysAgo,
      variables: { firstName: 'Dormant' },
    }]);

    const result = await triggerReengagement();
    expect(result.success).toBe(true);
    expect(result.contacted).toBe(1);
  });

  it('includes discount code in reengagement', async () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [{
      _id: 'eq-pp-1',
      recipientEmail: 'dormant@test.com',
      recipientContactId: 'contact-d1',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'sent',
      sentAt: ninetyOneDaysAgo,
      variables: { firstName: 'Dormant' },
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerReengagement();

    const reengagement = insertedItems.find(i => i.sequenceType === 'reengagement');
    expect(reengagement).toBeTruthy();
    expect(reengagement.variables.discountCode).toBe('COMEBACK15');
    expect(reengagement.variables.discountAvailable).toBe(true);
  });

  it('sets discountAvailable false when reengagement secret missing', async () => {
    __resetSecrets();
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [{
      _id: 'eq-pp-1',
      recipientEmail: 'dormant@test.com',
      recipientContactId: 'contact-d1',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'sent',
      sentAt: ninetyOneDaysAgo,
      variables: { firstName: 'Dormant' },
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await triggerReengagement();

    const reengagement = insertedItems.find(i => i.sequenceType === 'reengagement');
    expect(reengagement).toBeTruthy();
    expect(reengagement.variables.discountCode).toBe('');
    expect(reengagement.variables.discountAvailable).toBe(false);
  });

  it('skips contacts with recent reengagement', async () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [
      {
        _id: 'eq-pp-1',
        recipientEmail: 'dormant@test.com',
        recipientContactId: 'contact-d1',
        sequenceType: 'post_purchase',
        sequenceStep: 1,
        status: 'sent',
        sentAt: ninetyOneDaysAgo,
        variables: { firstName: 'Dormant' },
      },
      {
        _id: 'eq-re-1',
        recipientEmail: 'dormant@test.com',
        sequenceType: 'reengagement',
        sequenceStep: 1,
        status: 'sent',
      },
    ]);

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('skips unsubscribed contacts', async () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [{
      _id: 'eq-pp-1',
      recipientEmail: 'unsub@test.com',
      recipientContactId: 'contact-u1',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'sent',
      sentAt: ninetyOneDaysAgo,
      variables: { firstName: 'Unsub' },
    }]);
    __seed('Unsubscribes', [{
      email: 'unsub@test.com',
      sequenceType: 'reengagement',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('returns zero when no dormant contacts', async () => {
    const result = await triggerReengagement();
    expect(result.success).toBe(true);
    expect(result.contacted).toBe(0);
  });
});

// ── processEmailQueue ──────────────────────────────────────────────

describe('processEmailQueue', () => {
  it('sends pending emails whose scheduled time has passed', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_1',
      recipientEmail: 'alice@test.com',
      recipientContactId: 'contact-1',
      variables: { firstName: 'Alice' },
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.cancelled).toBe(0);

    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('welcome_series_1');
    expect(emails[0].contactId).toBe('contact-1');
  });

  it('cancels emails for unsubscribed recipients', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_2',
      recipientEmail: 'unsub@test.com',
      recipientContactId: 'contact-2',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);
    __seed('Unsubscribes', [{
      email: 'unsub@test.com',
      sequenceType: 'all',
      unsubscribedAt: new Date(),
    }]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('cancels cart recovery emails when cart is recovered', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'cart_recovery_2',
      recipientEmail: 'shopper@test.com',
      recipientContactId: 'contact-3',
      variables: { checkoutId: 'ck-recovered' },
      sequenceType: 'cart_recovery',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-recovered',
      status: 'recovered',
    }]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('retries failed sends with exponential backoff', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_1',
      recipientEmail: 'alice@test.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    const result = await processEmailQueue();
    expect(result.failed).toBe(1);
    expect(updatedItem.status).toBe('pending'); // Still pending for retry
    expect(updatedItem.attempt).toBe(1);
    expect(updatedItem.lastError).toBeTruthy();
  });

  it('marks as failed after max retry attempts', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_1',
      recipientEmail: 'alice@test.com',
      recipientContactId: 'contact-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 2, // Already retried twice
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    const result = await processEmailQueue();
    expect(result.failed).toBe(1);
    expect(updatedItem.status).toBe('failed'); // Permanently failed
    expect(updatedItem.attempt).toBe(3);
  });

  it('fails for items without contact ID', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_1',
      recipientEmail: 'nocontact@test.com',
      recipientContactId: '',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.failed).toBe(1);
  });

  it('returns zeros when queue is empty', async () => {
    const result = await processEmailQueue();
    expect(result).toEqual({ sent: 0, failed: 0, cancelled: 0 });
  });

  it('does not send emails scheduled for the future', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-future',
      templateId: 'welcome_series_2',
      recipientEmail: 'future@test.com',
      recipientContactId: 'contact-f',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date(Date.now() + 3600000),
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.sent).toBe(0);
  });
});

// ── unsubscribeContact ─────────────────────────────────────────────

describe('unsubscribeContact', () => {
  it('records unsubscribe and cancels pending emails', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', recipientEmail: 'unsub@test.com', sequenceType: 'welcome', status: 'pending' },
      { _id: 'eq-2', recipientEmail: 'unsub@test.com', sequenceType: 'welcome', status: 'sent' },
    ]);

    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Unsubscribes') insertedItem = item;
    });

    const result = await unsubscribeContact('unsub@test.com', 'all');
    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.email).toBe('unsub@test.com');
    expect(insertedItem.sequenceType).toBe('all');
  });

  it('cancels only matching sequence type pending emails', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', recipientEmail: 'user@test.com', sequenceType: 'welcome', status: 'pending' },
      { _id: 'eq-2', recipientEmail: 'user@test.com', sequenceType: 'cart_recovery', status: 'pending' },
    ]);

    let updatedIds = [];
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedIds.push(item._id);
    });

    await unsubscribeContact('user@test.com', 'welcome');

    // Only the welcome email should be cancelled
    expect(updatedIds).toContain('eq-1');
    expect(updatedIds).not.toContain('eq-2');
  });

  it('cancels all sequence types when type is "all"', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', recipientEmail: 'user@test.com', sequenceType: 'welcome', status: 'pending' },
      { _id: 'eq-2', recipientEmail: 'user@test.com', sequenceType: 'cart_recovery', status: 'pending' },
    ]);

    let updatedIds = [];
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedIds.push(item._id);
    });

    await unsubscribeContact('user@test.com', 'all');

    expect(updatedIds).toContain('eq-1');
    expect(updatedIds).toContain('eq-2');
  });

  it('defaults to "all" when no sequence type specified', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Unsubscribes') insertedItem = item;
    });

    await unsubscribeContact('user@test.com');
    expect(insertedItem.sequenceType).toBe('all');
  });

  it('rejects invalid email', async () => {
    const result = await unsubscribeContact('not-an-email');
    expect(result.success).toBe(false);
  });

  it('rejects empty email', async () => {
    const result = await unsubscribeContact('');
    expect(result.success).toBe(false);
  });

  it('normalizes email to lowercase', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Unsubscribes') insertedItem = item;
    });

    await unsubscribeContact('User@TEST.com');
    expect(insertedItem.email).toBe('user@test.com');
  });
});

// ── getEmailAutomationStats ────────────────────────────────────────

describe('getEmailAutomationStats', () => {
  it('returns stats grouped by sequence type and status', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'welcome', status: 'pending', createdAt: new Date() },
      { _id: 'eq-4', sequenceType: 'cart_recovery', status: 'sent', createdAt: new Date() },
      { _id: 'eq-5', sequenceType: 'cart_recovery', status: 'cancelled', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.stats.welcome.sent).toBe(2);
    expect(result.stats.welcome.pending).toBe(1);
    expect(result.stats.cart_recovery.sent).toBe(1);
    expect(result.stats.cart_recovery.cancelled).toBe(1);
    expect(result.totalEmails).toBe(5);
  });

  it('returns A/B test results for welcome series', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'sent', abVariant: 'A', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'sent', abVariant: 'A', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'welcome', status: 'sent', abVariant: 'B', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.abResults.A.sent).toBe(2);
    expect(result.abResults.B.sent).toBe(1);
  });

  it('returns empty stats when no emails', async () => {
    const result = await getEmailAutomationStats();
    expect(result.totalEmails).toBe(0);
    expect(result.stats).toBeDefined();
    expect(result.abResults.A.sent).toBe(0);
    expect(result.abResults.B.sent).toBe(0);
  });

  it('excludes emails older than 30 days', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    __seed('EmailQueue', [
      { _id: 'eq-old', sequenceType: 'welcome', status: 'sent', createdAt: oldDate },
      { _id: 'eq-new', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.totalEmails).toBe(1);
  });
});

// ── Event Handlers ─────────────────────────────────────────────────

describe('wixMembers_onMemberCreated', () => {
  it('triggers welcome sequence for new members', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    wixMembers_onMemberCreated({
      entity: {
        _id: 'member-1',
        loginEmail: 'newmember@test.com',
        contactDetails: { firstName: 'New' },
      },
    });

    // Wait for async fire-and-forget
    await new Promise(r => setTimeout(r, 100));

    const welcomeEmails = insertedItems.filter(i => i.sequenceType === 'welcome');
    expect(welcomeEmails).toHaveLength(3);
  });

  it('extracts email from contactDetails when loginEmail missing', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    wixMembers_onMemberCreated({
      entity: {
        _id: 'member-2',
        contactDetails: { emails: ['fallback@test.com'], firstName: 'Fallback' },
      },
    });

    await new Promise(r => setTimeout(r, 100));

    const welcomeEmails = insertedItems.filter(i => i.sequenceType === 'welcome');
    expect(welcomeEmails).toHaveLength(3);
    expect(welcomeEmails[0].recipientEmail).toBe('fallback@test.com');
  });

  it('does nothing when email is missing', async () => {
    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixMembers_onMemberCreated({
      entity: { _id: 'member-3', contactDetails: { firstName: 'NoEmail' } },
    });

    await new Promise(r => setTimeout(r, 100));
    expect(insertCount).toBe(0);
  });
});

describe('wixEcom_onOrderCreated', () => {
  it('triggers post-purchase sequence for new orders', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-100',
        buyerInfo: { email: 'buyer@test.com', contactId: 'contact-b1' },
        billingInfo: { firstName: 'Buyer' },
        totals: { total: 899 },
        lineItems: [
          { name: 'Eureka Frame', quantity: 1, price: 599 },
          { name: 'Moonshadow Mattress', quantity: 1, price: 300 },
        ],
      },
    });

    await new Promise(r => setTimeout(r, 100));

    const postPurchaseEmails = insertedItems.filter(i => i.sequenceType === 'post_purchase');
    expect(postPurchaseEmails).toHaveLength(3);
    expect(postPurchaseEmails[0].variables.orderNumber).toBe('ORD-100');
  });

  it('extracts total from priceSummary when totals missing', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-101',
        buyerInfo: { email: 'buyer@test.com', contactId: 'contact-b2', firstName: 'Buyer' },
        priceSummary: { total: { amount: 1299 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 100));

    const postPurchaseEmails = insertedItems.filter(i => i.sequenceType === 'post_purchase');
    expect(postPurchaseEmails).toHaveLength(3);
  });

  it('does nothing when buyer email is missing', async () => {
    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-102',
        buyerInfo: {},
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 100));
    expect(insertCount).toBe(0);
  });
});

// ── Order Cancellation ──────────────────────────────────────────────

describe('wixEcom_onOrderCanceled', () => {
  it('cancels pending post-purchase emails when order is cancelled', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-pp1', recipientEmail: 'cancel@test.com', sequenceType: 'post_purchase', sequenceStep: 1, status: 'sent', variables: { orderNumber: 'ORD-500' } },
      { _id: 'eq-pp2', recipientEmail: 'cancel@test.com', sequenceType: 'post_purchase', sequenceStep: 2, status: 'pending', variables: { orderNumber: 'ORD-500' } },
      { _id: 'eq-pp3', recipientEmail: 'cancel@test.com', sequenceType: 'post_purchase', sequenceStep: 3, status: 'pending', variables: { orderNumber: 'ORD-500' } },
    ]);

    let updatedItems = [];
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItems.push(item);
    });

    wixEcom_onOrderCanceled({
      entity: {
        number: 'ORD-500',
        buyerInfo: { email: 'cancel@test.com' },
      },
    });

    await new Promise(r => setTimeout(r, 100));

    // Only pending items should be cancelled (eq-pp2, eq-pp3), not sent (eq-pp1)
    expect(updatedItems).toHaveLength(2);
    expect(updatedItems.every(i => i.status === 'cancelled')).toBe(true);
    expect(updatedItems.every(i => i.lastError === 'Order cancelled')).toBe(true);
  });

  it('does not cancel emails for different orders', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-other', recipientEmail: 'cancel@test.com', sequenceType: 'post_purchase', sequenceStep: 2, status: 'pending', variables: { orderNumber: 'ORD-999' } },
    ]);

    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    wixEcom_onOrderCanceled({
      entity: {
        number: 'ORD-500',
        buyerInfo: { email: 'cancel@test.com' },
      },
    });

    await new Promise(r => setTimeout(r, 100));
    expect(updateCount).toBe(0);
  });

  it('does nothing when buyer email is missing', async () => {
    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    wixEcom_onOrderCanceled({
      entity: { number: 'ORD-500', buyerInfo: {} },
    });

    await new Promise(r => setTimeout(r, 100));
    expect(updateCount).toBe(0);
  });

  it('handles event without entity wrapper', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-direct', recipientEmail: 'direct@test.com', sequenceType: 'post_purchase', sequenceStep: 2, status: 'pending', variables: { orderNumber: 'ORD-600' } },
    ]);

    let updatedItems = [];
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItems.push(item);
    });

    wixEcom_onOrderCanceled({
      number: 'ORD-600',
      buyerInfo: { email: 'direct@test.com' },
    });

    await new Promise(r => setTimeout(r, 100));
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].status).toBe('cancelled');
  });
});

// ── Email Open/Click Tracking ─────────────────────────────────────────

describe('recordEmailEvent', () => {
  it('records an open event', async () => {
    __seed('EmailEvents', []);

    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'EmailEvents') insertedItem = item;
    });

    const result = await recordEmailEvent({
      emailQueueId: 'eq-1',
      eventType: 'open',
    });

    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.emailQueueId).toBe('eq-1');
    expect(insertedItem.eventType).toBe('open');
    expect(insertedItem.timestamp).toBeDefined();
  });

  it('records a click event with URL', async () => {
    __seed('EmailEvents', []);

    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'EmailEvents') insertedItem = item;
    });

    const result = await recordEmailEvent({
      emailQueueId: 'eq-2',
      eventType: 'click',
      linkUrl: 'https://carolinafutons.com/product/eureka',
    });

    expect(result.success).toBe(true);
    expect(insertedItem.eventType).toBe('click');
    expect(insertedItem.linkUrl).toContain('carolinafutons.com');
  });

  it('rejects invalid event types', async () => {
    const result = await recordEmailEvent({
      emailQueueId: 'eq-3',
      eventType: 'delete',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing emailQueueId', async () => {
    const result = await recordEmailEvent({
      eventType: 'open',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing eventType', async () => {
    const result = await recordEmailEvent({
      emailQueueId: 'eq-4',
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes emailQueueId length', async () => {
    __seed('EmailEvents', []);

    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'EmailEvents') insertedItem = item;
    });

    await recordEmailEvent({
      emailQueueId: 'x'.repeat(200),
      eventType: 'open',
    });

    expect(insertedItem.emailQueueId.length).toBeLessThanOrEqual(50);
  });
});

describe('getEmailEvents', () => {
  it('returns open and click counts', async () => {
    __seed('EmailEvents', [
      { _id: 'ev-1', emailQueueId: 'eq-1', eventType: 'open', timestamp: new Date() },
      { _id: 'ev-2', emailQueueId: 'eq-1', eventType: 'click', linkUrl: '/product', timestamp: new Date() },
      { _id: 'ev-3', emailQueueId: 'eq-2', eventType: 'open', timestamp: new Date() },
    ]);

    const result = await getEmailEvents();
    expect(result.opens).toBe(2);
    expect(result.clicks).toBe(1);
    expect(result.events).toHaveLength(3);
  });

  it('returns empty results when no events', async () => {
    __seed('EmailEvents', []);

    const result = await getEmailEvents();
    expect(result.opens).toBe(0);
    expect(result.clicks).toBe(0);
    expect(result.events).toEqual([]);
  });

  it('filters by sequence type', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-w1', sequenceType: 'welcome', status: 'sent' },
      { _id: 'eq-c1', sequenceType: 'cart_recovery', status: 'sent' },
    ]);
    __seed('EmailEvents', [
      { _id: 'ev-w1', emailQueueId: 'eq-w1', eventType: 'open', timestamp: new Date() },
      { _id: 'ev-c1', emailQueueId: 'eq-c1', eventType: 'open', timestamp: new Date() },
    ]);

    const result = await getEmailEvents('welcome');
    expect(result.opens).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].emailQueueId).toBe('eq-w1');
  });

  it('includes event fields in output', async () => {
    __seed('EmailEvents', [
      { _id: 'ev-f', emailQueueId: 'eq-f', eventType: 'click', linkUrl: '/test', timestamp: new Date(), extraField: 'hidden' },
    ]);

    const result = await getEmailEvents();
    const ev = result.events[0];
    expect(ev).toHaveProperty('_id');
    expect(ev).toHaveProperty('emailQueueId');
    expect(ev).toHaveProperty('eventType');
    expect(ev).toHaveProperty('linkUrl');
    expect(ev).toHaveProperty('timestamp');
    expect(ev).not.toHaveProperty('extraField');
  });
});
