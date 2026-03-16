/**
 * Cart Recovery + Email Automation Integration Tests
 *
 * Tests the full flow: abandon detection → record creation → recovery email
 * queuing → cooldown enforcement → unsubscribe → queue cancellation.
 *
 * Covers: cartRecovery.web.js + emailAutomation.web.js + emailService.web.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog } from './__mocks__/wix-crm-backend.js';
import {
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
} from '../src/backend/cartRecovery.web.js';
import {
  triggerAbandonedCartRecovery,
  triggerPostPurchaseSequence,
  unsubscribeContact,
  getEmailAutomationStats,
  processEmailQueue,
} from '../src/backend/emailAutomation.web.js';
import { sendEmail } from '../src/backend/emailService.web.js';

// ── Helpers ────────────────────────────────────────────────────────────

const wait = (ms = 50) => new Promise(r => setTimeout(r, ms));

function makeCheckoutEvent(overrides = {}) {
  return {
    entity: {
      _id: 'checkout-int-1',
      buyerInfo: { email: 'shopper@example.com', firstName: 'Alex' },
      payNow: { total: { amount: 899 } },
      lineItems: [
        {
          catalogReference: { catalogItemId: 'prod-seattle' },
          productName: { original: 'Seattle Futon Frame' },
          quantity: 1,
          price: { amount: 499 },
        },
        {
          catalogReference: { catalogItemId: 'prod-cover' },
          productName: { original: 'Denim Futon Cover' },
          quantity: 1,
          price: { amount: 400 },
        },
      ],
      ...overrides,
    },
  };
}

function seedAbandonedCart(overrides = {}) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return {
    _id: 'ac-flow-1',
    checkoutId: 'checkout-flow-1',
    buyerEmail: 'shopper@example.com',
    buyerName: 'Alex',
    cartTotal: 899,
    lineItems: [
      { productId: 'prod-seattle', name: 'Seattle Futon Frame', quantity: 1, price: 499 },
      { productId: 'prod-cover', name: 'Denim Futon Cover', quantity: 1, price: 400 },
    ],
    abandonedAt: twoHoursAgo,
    status: 'abandoned',
    recoveryEmailSent: false,
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  __setSecrets({
    SITE_OWNER_CONTACT_ID: 'owner-contact-123',
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  });
  __seed('AbandonedCarts', []);
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
  __seed('ContactSubmissions', []);
});

// ── Abandon Detection ──────────────────────────────────────────────────

describe('Abandon Detection Flow', () => {
  it('records abandoned cart from checkout event', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'AbandonedCarts') inserted = item;
    });

    wixEcom_onAbandonedCheckoutCreated(makeCheckoutEvent());
    await wait();

    expect(inserted).not.toBeNull();
    expect(inserted.checkoutId).toBe('checkout-int-1');
    expect(inserted.buyerEmail).toBe('shopper@example.com');
    expect(inserted.status).toBe('abandoned');
    expect(inserted.recoveryEmailSent).toBe(false);
    expect(inserted.cartTotal).toBe(899);

    const lineItems = JSON.parse(inserted.lineItems);
    expect(lineItems).toHaveLength(2);
    expect(lineItems[0].name).toBe('Seattle Futon Frame');
  });

  it('deduplicates same checkoutId when already abandoned', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart({ checkoutId: 'checkout-int-1' })]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated(makeCheckoutEvent());
    await wait();

    expect(insertCount).toBe(0);
  });

  it('allows re-abandonment after previous recovery', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({ checkoutId: 'checkout-int-1', status: 'recovered' }),
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated(makeCheckoutEvent());
    await wait();

    expect(insertCount).toBe(1);
  });

  it('handles checkout event without entity wrapper', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'AbandonedCarts') inserted = item;
    });

    wixEcom_onAbandonedCheckoutCreated({
      _id: 'checkout-direct',
      buyerInfo: { email: 'direct@example.com', firstName: 'Direct' },
      payNow: { total: { amount: 100 } },
      lineItems: [],
    });
    await wait();

    expect(inserted).not.toBeNull();
    expect(inserted.buyerEmail).toBe('direct@example.com');
  });

  it('sanitizes XSS in buyer info during abandon detection', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'AbandonedCarts') inserted = item;
    });

    wixEcom_onAbandonedCheckoutCreated(makeCheckoutEvent({
      _id: 'checkout-xss',
      buyerInfo: {
        email: '<script>alert(1)</script>xss@test.com',
        firstName: '<img onerror=hack>',
      },
    }));
    await wait();

    expect(inserted).not.toBeNull();
    expect(inserted.buyerEmail).not.toContain('<script>');
    expect(inserted.buyerName).not.toContain('<img');
  });
});

// ── Recovery Email Queuing ─────────────────────────────────────────────

describe('Recovery Email Queuing', () => {
  it('queues 3-step recovery sequence for eligible abandoned cart', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);

    const result = await triggerAbandonedCartRecovery();

    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBe(1);
  });

  it('skips carts abandoned less than 1 hour ago', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({ abandonedAt: new Date(Date.now() - 30 * 60 * 1000) }),
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('skips carts that already had recovery email sent', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({ recoveryEmailSent: true }),
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('skips recovered carts', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({ status: 'recovered' }),
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('marks recoveryEmailSent=true after queuing', async () => {
    const cart = seedAbandonedCart();
    __seed('AbandonedCarts', [cart]);

    let updatedCart = null;
    __onUpdate((col, item) => {
      if (col === 'AbandonedCarts' && item._id === 'ac-flow-1') updatedCart = item;
    });

    await triggerAbandonedCartRecovery();

    expect(updatedCart).not.toBeNull();
    expect(updatedCart.recoveryEmailSent).toBe(true);
    expect(updatedCart.recoveryEmailSentAt).toBeInstanceOf(Date);
  });

  it('includes discount code only in step 3 email', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);

    const queuedEmails = [];
    __onInsert((col, item) => {
      if (col === 'EmailQueue') queuedEmails.push(item);
    });

    await triggerAbandonedCartRecovery();

    expect(queuedEmails).toHaveLength(3);
    // Steps 1 and 2 should not have discount
    expect(queuedEmails[0].variables.discountCode).toBe('');
    expect(queuedEmails[0].variables.discountAvailable).toBe(false);
    expect(queuedEmails[1].variables.discountCode).toBe('');
    // Step 3 should have discount
    expect(queuedEmails[2].variables.discountCode).toBe('COMEBACK15');
    expect(queuedEmails[2].variables.discountAvailable).toBe(true);
  });

  it('handles missing discount secret gracefully', async () => {
    __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
    // RECOVERY_DISCOUNT_CODE not set — getSecret will throw
    __seed('AbandonedCarts', [seedAbandonedCart()]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBe(1);
  });

  it('skips carts with invalid buyer email', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({ buyerEmail: 'not-an-email' }),
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('processes multiple eligible carts', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [
      seedAbandonedCart({ _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'a@test.com' }),
      seedAbandonedCart({ _id: 'ac-2', checkoutId: 'ck-2', buyerEmail: 'b@test.com' }),
      seedAbandonedCart({ _id: 'ac-3', checkoutId: 'ck-3', buyerEmail: 'c@test.com' }),
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(3);
  });
});

// ── Cooldown / Dedup ───────────────────────────────────────────────────

describe('Cooldown and Dedup', () => {
  it('does not re-queue recovery for same cart if already queued', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);
    __seed('EmailQueue', [{
      _id: 'eq-existing',
      recipientEmail: 'shopper@example.com',
      sequenceType: 'cart_recovery',
      checkoutId: 'checkout-flow-1',
      status: 'pending',
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('getRecoverableCarts respects 1-hour cooldown window', async () => {
    __seed('AbandonedCarts', [
      seedAbandonedCart({
        _id: 'ac-recent',
        abandonedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      }),
    ]);

    const carts = await getRecoverableCarts();
    expect(carts).toHaveLength(0);
  });

  it('getRecoverableCarts returns carts past cooldown', async () => {
    // getRecoverableCarts uses .toISOString() in its query, so seed with ISO strings
    __seed('AbandonedCarts', [
      seedAbandonedCart({ abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
    ]);

    const carts = await getRecoverableCarts();
    expect(carts).toHaveLength(1);
    expect(carts[0].checkoutId).toBe('checkout-flow-1');
    expect(Array.isArray(carts[0].lineItems)).toBe(true);
  });
});

// ── Cart Recovery Event ────────────────────────────────────────────────

describe('Cart Recovery Event', () => {
  it('marks abandoned cart as recovered on checkout completion', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);

    let updatedItem = null;
    __onUpdate((col, item) => {
      if (col === 'AbandonedCarts') updatedItem = item;
    });

    wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-flow-1' },
    });
    await wait();

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.status).toBe('recovered');
    expect(updatedItem.recoveredAt).toBeTruthy();
  });

  it('cancels pending recovery emails when cart is recovered during queue processing', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart({ status: 'recovered' })]);
    __seed('EmailQueue', [{
      _id: 'eq-pending',
      recipientEmail: 'shopper@example.com',
      recipientContactId: 'contact-1',
      templateId: 'cart_recovery_2',
      sequenceType: 'cart_recovery',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      variables: { checkoutId: 'checkout-flow-1' },
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });
});

// ── Unsubscribe ────────────────────────────────────────────────────────

describe('Unsubscribe Flow', () => {
  it('unsubscribes from cart_recovery sequence', async () => {
    const result = await unsubscribeContact('shopper@example.com', 'cart_recovery');
    expect(result.success).toBe(true);
  });

  it('unsubscribes from all sequences', async () => {
    const result = await unsubscribeContact('shopper@example.com', 'all');
    expect(result.success).toBe(true);
  });

  it('cancels pending recovery emails on unsubscribe', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-1',
        recipientEmail: 'shopper@example.com',
        sequenceType: 'cart_recovery',
        sequenceStep: 1,
        status: 'pending',
        scheduledFor: new Date(Date.now() + 3600000),
      },
      {
        _id: 'eq-2',
        recipientEmail: 'shopper@example.com',
        sequenceType: 'cart_recovery',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(Date.now() + 86400000),
      },
    ]);

    let updatedItems = [];
    __onUpdate((col, item) => {
      if (col === 'EmailQueue') updatedItems.push(item);
    });

    await unsubscribeContact('shopper@example.com', 'cart_recovery');

    expect(updatedItems).toHaveLength(2);
    expect(updatedItems.every(i => i.status === 'cancelled')).toBe(true);
  });

  it('skips unsubscribed contacts during recovery queuing', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);
    __seed('Unsubscribes', [{
      _id: 'unsub-1',
      email: 'shopper@example.com',
      sequenceType: 'cart_recovery',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('global unsubscribe blocks all sequence types', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);
    __seed('Unsubscribes', [{
      _id: 'unsub-all',
      email: 'shopper@example.com',
      sequenceType: 'all',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('rejects invalid email on unsubscribe', async () => {
    const result = await unsubscribeContact('not-valid');
    expect(result.success).toBe(false);
  });

  it('rejects empty email on unsubscribe', async () => {
    const result = await unsubscribeContact('');
    expect(result.success).toBe(false);
  });

  it('cancels only matching sequence type, not others', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-cart',
        recipientEmail: 'shopper@example.com',
        sequenceType: 'cart_recovery',
        status: 'pending',
        scheduledFor: new Date(Date.now() + 3600000),
      },
      {
        _id: 'eq-welcome',
        recipientEmail: 'shopper@example.com',
        sequenceType: 'welcome',
        status: 'pending',
        scheduledFor: new Date(Date.now() + 3600000),
      },
    ]);

    let updatedIds = [];
    __onUpdate((col, item) => {
      if (col === 'EmailQueue') updatedIds.push(item._id);
    });

    await unsubscribeContact('shopper@example.com', 'cart_recovery');

    expect(updatedIds).toContain('eq-cart');
    expect(updatedIds).not.toContain('eq-welcome');
  });
});

// ── Stats ──────────────────────────────────────────────────────────────

describe('Cart Stats Integration', () => {
  it('reflects abandon + recovery in stats', async () => {
    // getAbandonedCartStats uses .toISOString() in its ge() query
    const now = Date.now();
    __seed('AbandonedCarts', [
      seedAbandonedCart({ _id: 'ac-s1', checkoutId: 'ck-s1', status: 'abandoned', abandonedAt: new Date(now - 3600000).toISOString() }),
      seedAbandonedCart({ _id: 'ac-s2', checkoutId: 'ck-s2', status: 'recovered', abandonedAt: new Date(now - 7200000).toISOString() }),
      seedAbandonedCart({ _id: 'ac-s3', checkoutId: 'ck-s3', status: 'abandoned', abandonedAt: new Date(now - 1800000).toISOString() }),
    ]);

    const stats = await getAbandonedCartStats();
    expect(stats.totalAbandoned).toBe(3);
    expect(stats.totalRecovered).toBe(1);
    expect(stats.recoveryRate).toBe(33);
    expect(stats.recentCarts).toHaveLength(3);
  });

  it('email automation stats reflect queued recovery emails', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'cart_recovery', sequenceStep: 1, status: 'pending', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'cart_recovery', sequenceStep: 2, status: 'pending', createdAt: new Date() },
      { _id: 'eq-3', sequenceType: 'cart_recovery', sequenceStep: 3, status: 'sent', createdAt: new Date() },
      { _id: 'eq-4', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', createdAt: new Date() },
    ]);

    const stats = await getEmailAutomationStats();
    expect(stats.stats.cart_recovery.pending).toBe(2);
    expect(stats.stats.cart_recovery.sent).toBe(1);
    expect(stats.stats.welcome.sent).toBe(1);
    expect(stats.totalEmails).toBe(4);
  });
});

// ── Post-Purchase Sequence ─────────────────────────────────────────────

describe('Post-Purchase Sequence', () => {
  it('queues 3-step post-purchase care sequence', async () => {
    const queuedEmails = [];
    __onInsert((col, item) => {
      if (col === 'EmailQueue') queuedEmails.push(item);
    });

    const result = await triggerPostPurchaseSequence(
      'contact-buyer',
      'buyer@example.com',
      'Alex',
      'ORD-1001',
      899,
      [{ name: 'Seattle Futon Frame', quantity: 1, price: 499 }],
    );

    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
    expect(queuedEmails).toHaveLength(3);
    expect(queuedEmails[0].templateId).toBe('post_purchase_1');
    expect(queuedEmails[1].templateId).toBe('post_purchase_2');
    expect(queuedEmails[2].templateId).toBe('post_purchase_3');
    expect(queuedEmails[0].variables.orderNumber).toBeTruthy();
    expect(queuedEmails[0].variables.firstName).toBe('Alex');
  });

  it('rejects post-purchase sequence for invalid email', async () => {
    const result = await triggerPostPurchaseSequence(
      'contact-1', 'bad-email', 'Alex', 'ORD-1', 100, [],
    );
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('skips post-purchase for unsubscribed contacts', async () => {
    __seed('Unsubscribes', [{
      _id: 'unsub-pp',
      email: 'buyer@example.com',
      sequenceType: 'post_purchase',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerPostPurchaseSequence(
      'contact-1', 'buyer@example.com', 'Alex', 'ORD-1', 100, [],
    );
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });
});

// ── Queue Processing ───────────────────────────────────────────────────

describe('Queue Processing', () => {
  it('cancels emails for unsubscribed recipients during processing', async () => {
    __seed('Unsubscribes', [{
      _id: 'unsub-proc',
      email: 'gone@example.com',
      sequenceType: 'all',
      unsubscribedAt: new Date(),
    }]);
    __seed('EmailQueue', [{
      _id: 'eq-proc',
      recipientEmail: 'gone@example.com',
      recipientContactId: 'contact-gone',
      templateId: 'cart_recovery_1',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      variables: {},
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('does not process future-scheduled emails', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-future',
      recipientEmail: 'future@example.com',
      recipientContactId: 'contact-future',
      templateId: 'cart_recovery_1',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() + 86400000), // tomorrow
      variables: {},
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    expect(result.sent).toBe(0);
    expect(result.cancelled).toBe(0);
  });

  it('sends email and marks as sent for valid queued item', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-send',
      recipientEmail: 'valid@example.com',
      recipientContactId: 'contact-valid',
      templateId: 'cart_recovery_1',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      variables: { buyerName: 'Valid' },
      attempt: 0,
    }]);

    let updatedItem = null;
    __onUpdate((col, item) => {
      if (col === 'EmailQueue' && item._id === 'eq-send') updatedItem = item;
    });

    const result = await processEmailQueue();
    expect(result.sent).toBe(1);
    expect(updatedItem).not.toBeNull();
    expect(updatedItem.status).toBe('sent');
    expect(updatedItem.sentAt).toBeInstanceOf(Date);

    const emailLog = __getEmailLog();
    expect(emailLog).toHaveLength(1);
    expect(emailLog[0].templateId).toBe('cart_recovery_1');
  });
});

// ── Email Service Contact Form ─────────────────────────────────────────

describe('Email Service Integration', () => {
  it('sendEmail works alongside cart recovery flow', async () => {
    // Verify emailService.web.js works in same test context
    const result = await sendEmail({
      name: 'Cart Abandoner',
      email: 'shopper@example.com',
      phone: '',
      subject: 'Question about my cart',
      message: 'I left items in my cart, can you help?',
    });

    expect(result.success).toBe(true);
    const emailLog = __getEmailLog();
    expect(emailLog).toHaveLength(1);
    expect(emailLog[0].templateId).toBe('contact_form_submission');
  });
});

// ── markRecoveryEmailSent ──────────────────────────────────────────────

describe('markRecoveryEmailSent Integration', () => {
  it('marks email sent and prevents re-queuing', async () => {
    __seed('AbandonedCarts', [seedAbandonedCart()]);

    const markResult = await markRecoveryEmailSent('ac-flow-1');
    expect(markResult.success).toBe(true);

    // Now recovery should skip this cart
    const recoveryResult = await triggerAbandonedCartRecovery();
    expect(recoveryResult.cartsProcessed).toBe(0);
  });
});

// ── End-to-End Flow ────────────────────────────────────────────────────

describe('End-to-End: Abandon → Queue → Recover → Cancel', () => {
  it('full lifecycle: abandon → queue recovery → customer recovers → cancel pending', async () => {
    // Step 1: Customer abandons checkout
    wixEcom_onAbandonedCheckoutCreated(makeCheckoutEvent({
      _id: 'ck-e2e',
    }));
    await wait();

    // Step 2: Trigger recovery (need to re-seed with proper timing)
    __seed('AbandonedCarts', [
      seedAbandonedCart({ checkoutId: 'ck-e2e' }),
    ]);

    const queuedEmails = [];
    __onInsert((col, item) => {
      if (col === 'EmailQueue') queuedEmails.push(item);
    });

    const recoveryResult = await triggerAbandonedCartRecovery();
    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.cartsProcessed).toBe(1);
    expect(queuedEmails.length).toBe(3);

    // Step 3: Customer comes back and completes purchase
    __seed('AbandonedCarts', [
      seedAbandonedCart({ checkoutId: 'ck-e2e', status: 'recovered', recoveryEmailSent: true }),
    ]);

    // Seed queue with pending recovery emails
    __seed('EmailQueue', queuedEmails.map((e, i) => ({
      ...e,
      _id: `eq-e2e-${i}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      variables: { ...e.variables, checkoutId: 'ck-e2e' },
    })));

    // Step 4: Process queue — should cancel because cart recovered
    const processResult = await processEmailQueue();
    expect(processResult.cancelled).toBe(3);
    expect(processResult.sent).toBe(0);
  });
});
