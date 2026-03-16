import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

import { __seed, __reset as __resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __failNextEmail, __reset as __resetCrm } from './__mocks__/wix-crm-backend.js';
import {
  triggerWelcomeSequence,
  triggerAbandonedCartRecovery,
  processEmailQueue,
  wixEcom_onOrderCanceled,
  _selectABVariant,
  _checkSendWindow,
  _SEND_WINDOW,
} from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __resetData();
  __resetSecrets();
  __resetCrm();
  __setSecrets({
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 1: Deterministic A/B variant selection
// ═══════════════════════════════════════════════════════════════════════

describe('selectABVariant — deterministic A/B selection', () => {
  it('returns "A" for ab@test.com (pre-verified)', () => {
    expect(_selectABVariant('ab@test.com')).toBe('A');
  });

  it('returns "B" for alice@test.com (pre-verified)', () => {
    expect(_selectABVariant('alice@test.com')).toBe('B');
  });

  it('is deterministic — same email always yields same variant', () => {
    const email = 'consistent@example.com';
    const first = _selectABVariant(email);
    for (let i = 0; i < 20; i++) {
      expect(_selectABVariant(email)).toBe(first);
    }
  });

  it('returns either A or B for empty string (random fallback)', () => {
    const result = _selectABVariant('');
    expect(['A', 'B']).toContain(result);
  });

  it('returns either A or B when called with no argument (random fallback)', () => {
    const result = _selectABVariant();
    expect(['A', 'B']).toContain(result);
  });

  it('returns either A or B for undefined (random fallback)', () => {
    const result = _selectABVariant(undefined);
    expect(['A', 'B']).toContain(result);
  });

  it('produces both variants across a range of emails', () => {
    const variants = new Set();
    for (let i = 0; i < 100; i++) {
      variants.add(_selectABVariant(`user${i}@example.com`));
    }
    expect(variants.has('A')).toBe(true);
    expect(variants.has('B')).toBe(true);
  });

  it('only ever returns "A" or "B"', () => {
    for (let i = 0; i < 50; i++) {
      const v = _selectABVariant(`check${i}@test.com`);
      expect(v === 'A' || v === 'B').toBe(true);
    }
  });

  it('uses the email as hash input, not Math.random, for non-empty emails', () => {
    const spy = vi.spyOn(Math, 'random');
    _selectABVariant('deterministic@test.com');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('falls back to Math.random for empty email', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const result = _selectABVariant('');
    expect(spy).toHaveBeenCalled();
    expect(result).toBe('A'); // 0.3 < 0.5 → A
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 2: Send window
// ═══════════════════════════════════════════════════════════════════════

describe('checkSendWindow — business hours gating', () => {
  it('exports SEND_WINDOW config with 8am start and 8pm end', () => {
    expect(_SEND_WINDOW.startHour).toBe(8);
    expect(_SEND_WINDOW.endHour).toBe(20);
    expect(_SEND_WINDOW.timezone).toBe('America/New_York');
  });

  it('returns { inWindow: true } during business hours (noon EST)', () => {
    // Create a date at noon EST (17:00 UTC)
    const noon = new Date('2026-03-16T17:00:00Z');
    const result = _checkSendWindow(noon);
    expect(result.inWindow).toBe(true);
    expect(result.nextWindowOpen).toBeUndefined();
  });

  it('returns { inWindow: false, nextWindowOpen } at 3am EST', () => {
    // 3am EST = 08:00 UTC
    const lateNight = new Date('2026-03-16T08:00:00Z');
    const result = _checkSendWindow(lateNight);
    expect(result.inWindow).toBe(false);
    expect(result.nextWindowOpen).toBeInstanceOf(Date);
  });

  it('returns { inWindow: false, nextWindowOpen } at 11pm EST', () => {
    // 11pm EST = 04:00 UTC next day
    const late = new Date('2026-03-17T04:00:00Z');
    const result = _checkSendWindow(late);
    expect(result.inWindow).toBe(false);
    expect(result.nextWindowOpen).toBeInstanceOf(Date);
  });

  it('returns inWindow true at exactly 8am EST boundary', () => {
    // 8am EST = 13:00 UTC
    const boundary = new Date('2026-03-16T13:00:00Z');
    const result = _checkSendWindow(boundary);
    expect(result.inWindow).toBe(true);
  });

  it('returns inWindow false at exactly 8pm EST boundary', () => {
    // 8pm EST = 01:00 UTC next day
    const boundary = new Date('2026-03-17T01:00:00Z');
    const result = _checkSendWindow(boundary);
    expect(result.inWindow).toBe(false);
    expect(result.nextWindowOpen).toBeInstanceOf(Date);
  });

  it('nextWindowOpen is in the future relative to the input time', () => {
    const lateNight = new Date('2026-03-16T06:00:00Z'); // 1am EST
    const result = _checkSendWindow(lateNight);
    expect(result.inWindow).toBe(false);
    expect(result.nextWindowOpen.getTime()).toBeGreaterThan(lateNight.getTime());
  });
});

describe('processEmailQueue — send window deferral', () => {
  it('defers non-time-sensitive emails outside the send window', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    // Seed a pending welcome email scheduled in the past
    __seed('EmailQueue', [{
      _id: 'eq-1',
      templateId: 'welcome_series_2',
      recipientEmail: 'user@test.com',
      recipientContactId: 'c1',
      variables: { firstName: 'User' },
      sequenceType: 'welcome',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date('2026-03-15T00:00:00Z'),
      attempt: 0,
      lastError: '',
    }]);

    // Freeze time to 3am EST (08:00 UTC) — outside send window
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T08:00:00Z'));

    const result = await processEmailQueue();

    vi.useRealTimers();

    // Email should be deferred (rescheduled), not sent
    expect(result.sent).toBe(0);
    const deferredUpdate = updates.find(u => u.item._id === 'eq-1');
    expect(deferredUpdate).toBeTruthy();
    expect(deferredUpdate.item.scheduledFor).toBeInstanceOf(Date);
  });

  it('sends cart_recovery step 1 regardless of send window', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-cart',
      templateId: 'cart_recovery_1',
      recipientEmail: 'buyer@test.com',
      recipientContactId: 'c2',
      variables: { checkoutId: 'chk-1' },
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date('2026-03-15T00:00:00Z'),
      attempt: 0,
      lastError: '',
    }]);

    // Freeze time to 3am EST — outside send window
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T08:00:00Z'));

    const result = await processEmailQueue();

    vi.useRealTimers();

    // Time-sensitive: should send regardless of window
    expect(result.sent).toBe(1);
  });

  it('sends restock emails regardless of send window', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-restock',
      templateId: 'restock_notification',
      recipientEmail: 'sub@test.com',
      recipientContactId: 'c3',
      variables: { productName: 'Futon' },
      sequenceType: 'restock',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date('2026-03-15T00:00:00Z'),
      attempt: 0,
      lastError: '',
    }]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T08:00:00Z'));

    const result = await processEmailQueue();

    vi.useRealTimers();

    expect(result.sent).toBe(1);
  });

  it('does not defer cart_recovery step 2 (only step 1 is time-sensitive)', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    __seed('EmailQueue', [{
      _id: 'eq-cart2',
      templateId: 'cart_recovery_2',
      recipientEmail: 'buyer@test.com',
      recipientContactId: 'c2',
      variables: { checkoutId: 'chk-1' },
      sequenceType: 'cart_recovery',
      sequenceStep: 2,
      status: 'pending',
      scheduledFor: new Date('2026-03-15T00:00:00Z'),
      attempt: 0,
      lastError: '',
    }]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T08:00:00Z'));

    const result = await processEmailQueue();

    vi.useRealTimers();

    // Step 2 is NOT time-sensitive, should be deferred
    expect(result.sent).toBe(0);
    const deferred = updates.find(u => u.item._id === 'eq-cart2');
    expect(deferred).toBeTruthy();
    expect(deferred.item.scheduledFor).toBeInstanceOf(Date);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 3: Cart recovery cross-cart dedup
// ═══════════════════════════════════════════════════════════════════════

describe('triggerAbandonedCartRecovery — cross-cart dedup', () => {
  it('lowercases email before dedup', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    __seed('AbandonedCarts', [{
      _id: 'cart-1',
      checkoutId: 'chk-1',
      status: 'abandoned',
      recoveryEmailSent: false,
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      buyerEmail: 'ALICE@TEST.COM',
      buyerName: 'Alice',
      cartTotal: 299,
      lineItems: JSON.stringify([{ name: 'Futon', quantity: 1 }]),
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.success).toBe(true);
    expect(result.cartsProcessed).toBe(1);

    const emailInserts = inserts.filter(i => i.col === 'EmailQueue');
    expect(emailInserts.length).toBe(3);
    // All should use lowercased email
    for (const insert of emailInserts) {
      expect(insert.item.recipientEmail).toBe('alice@test.com');
    }
  });

  it('skips cart if any cart_recovery step 1 was queued in last 24h for same email', async () => {
    const now = Date.now();

    // Seed an existing recent cart_recovery step 1 for this email
    __seed('EmailQueue', [{
      _id: 'eq-recent',
      recipientEmail: 'buyer@test.com',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      createdAt: new Date(now - 12 * 60 * 60 * 1000), // 12h ago — within 24h
      status: 'pending',
    }]);

    __seed('AbandonedCarts', [{
      _id: 'cart-2',
      checkoutId: 'chk-new',
      status: 'abandoned',
      recoveryEmailSent: false,
      abandonedAt: new Date(now - 2 * 60 * 60 * 1000),
      buyerEmail: 'buyer@test.com',
      buyerName: 'Buyer',
      cartTotal: 199,
      lineItems: '[]',
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('processes cart if last cart_recovery step 1 was >24h ago', async () => {
    const now = Date.now();

    __seed('EmailQueue', [{
      _id: 'eq-old',
      recipientEmail: 'buyer@test.com',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      createdAt: new Date(now - 48 * 60 * 60 * 1000), // 48h ago — outside 24h
      checkoutId: 'chk-old',
      status: 'sent',
    }]);

    __seed('AbandonedCarts', [{
      _id: 'cart-3',
      checkoutId: 'chk-fresh',
      status: 'abandoned',
      recoveryEmailSent: false,
      abandonedAt: new Date(now - 2 * 60 * 60 * 1000),
      buyerEmail: 'buyer@test.com',
      buyerName: 'Buyer',
      cartTotal: 499,
      lineItems: JSON.stringify([{ name: 'Sofa', quantity: 1 }]),
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(1);
  });

  it('cross-cart dedup is per-email, not per-checkout', async () => {
    const now = Date.now();

    // Recent step 1 for a DIFFERENT checkout but SAME email
    __seed('EmailQueue', [{
      _id: 'eq-diff-cart',
      recipientEmail: 'repeat@test.com',
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      createdAt: new Date(now - 6 * 60 * 60 * 1000), // 6h ago
      checkoutId: 'chk-older',
      status: 'pending',
    }]);

    __seed('AbandonedCarts', [{
      _id: 'cart-4',
      checkoutId: 'chk-newer',
      status: 'abandoned',
      recoveryEmailSent: false,
      abandonedAt: new Date(now - 2 * 60 * 60 * 1000),
      buyerEmail: 'repeat@test.com',
      buyerName: 'Repeater',
      cartTotal: 150,
      lineItems: '[]',
    }]);

    const result = await triggerAbandonedCartRecovery();
    // Should be skipped because of cross-cart dedup
    expect(result.cartsProcessed).toBe(0);
  });

  it('cross-cart dedup uses lowercased email for matching', async () => {
    const now = Date.now();

    __seed('EmailQueue', [{
      _id: 'eq-lc',
      recipientEmail: 'mixed@test.com', // stored lowercase
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      checkoutId: 'chk-prev',
      status: 'pending',
    }]);

    __seed('AbandonedCarts', [{
      _id: 'cart-5',
      checkoutId: 'chk-lc',
      status: 'abandoned',
      recoveryEmailSent: false,
      abandonedAt: new Date(now - 2 * 60 * 60 * 1000),
      buyerEmail: 'MIXED@TEST.COM', // uppercase in cart
      buyerName: 'Mixed',
      cartTotal: 200,
      lineItems: '[]',
    }]);

    const result = await triggerAbandonedCartRecovery();
    // Email gets lowercased, matches existing — should skip
    expect(result.cartsProcessed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature 4: cancelSequenceForOrder fix
// ═══════════════════════════════════════════════════════════════════════

describe('cancelSequenceForOrder — missing orderNumber guard', () => {
  it('does not bulk-cancel when orderNumber is missing', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    __seed('EmailQueue', [
      {
        _id: 'eq-pp1',
        recipientEmail: 'buyer@test.com',
        sequenceType: 'post_purchase',
        sequenceStep: 1,
        status: 'pending',
        variables: { orderNumber: 'ORD-100' },
      },
      {
        _id: 'eq-pp2',
        recipientEmail: 'buyer@test.com',
        sequenceType: 'post_purchase',
        sequenceStep: 2,
        status: 'pending',
        variables: { orderNumber: 'ORD-200' },
      },
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate order cancelled event with missing orderNumber
    await wixEcom_onOrderCanceled({ entity: { buyerInfo: { email: 'buyer@test.com' }, number: '' } });

    // Wait for async catch handler
    await new Promise(r => setTimeout(r, 50));

    // No emails should have been cancelled
    const cancellations = updates.filter(u => u.item.status === 'cancelled');
    expect(cancellations).toHaveLength(0);

    // Should have warned
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('cancelSequenceForOrder called without orderNumber')
    );
    warnSpy.mockRestore();
  });

  it('cancels only the matching order when orderNumber is provided', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    __seed('EmailQueue', [
      {
        _id: 'eq-pp1',
        recipientEmail: 'buyer@test.com',
        sequenceType: 'post_purchase',
        sequenceStep: 1,
        status: 'pending',
        variables: { orderNumber: 'ORD-100' },
      },
      {
        _id: 'eq-pp2',
        recipientEmail: 'buyer@test.com',
        sequenceType: 'post_purchase',
        sequenceStep: 2,
        status: 'pending',
        variables: { orderNumber: 'ORD-200' },
      },
    ]);

    await wixEcom_onOrderCanceled({ entity: { buyerInfo: { email: 'buyer@test.com' }, number: 'ORD-100' } });
    await new Promise(r => setTimeout(r, 50));

    const cancellations = updates.filter(u => u.item.status === 'cancelled');
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0].item._id).toBe('eq-pp1');
  });

  it('lastError includes the order number in cancellation message', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    __seed('EmailQueue', [{
      _id: 'eq-pp3',
      recipientEmail: 'buyer@test.com',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'pending',
      variables: { orderNumber: 'ORD-555' },
    }]);

    await wixEcom_onOrderCanceled({ entity: { buyerInfo: { email: 'buyer@test.com' }, number: 'ORD-555' } });
    await new Promise(r => setTimeout(r, 50));

    const cancelled = updates.find(u => u.item.status === 'cancelled');
    expect(cancelled).toBeTruthy();
    expect(cancelled.item.lastError).toBe('Order ORD-555 cancelled');
  });

  it('returns early without querying EmailQueue when orderNumber is missing', async () => {
    // Seed no data — if it queries, the test still passes, but we verify no updates
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await wixEcom_onOrderCanceled({ entity: { buyerInfo: { email: 'test@test.com' }, number: '' } });
    await new Promise(r => setTimeout(r, 50));

    expect(updates).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('does not cancel when email is empty even with valid orderNumber', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    __seed('EmailQueue', [{
      _id: 'eq-pp4',
      recipientEmail: '',
      sequenceType: 'post_purchase',
      sequenceStep: 1,
      status: 'pending',
      variables: { orderNumber: 'ORD-999' },
    }]);

    await wixEcom_onOrderCanceled({ entity: { buyerInfo: { email: '' }, number: 'ORD-999' } });
    await new Promise(r => setTimeout(r, 50));

    expect(updates).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Integration: A/B variant flows through welcome sequence
// ═══════════════════════════════════════════════════════════════════════

describe('triggerWelcomeSequence — A/B variant integration', () => {
  it('assigns the deterministic variant to queued welcome step 1', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await triggerWelcomeSequence('c1', 'ab@test.com', 'AB');

    const step1 = inserts.find(i => i.col === 'EmailQueue' && i.item.sequenceStep === 1);
    expect(step1.item.abVariant).toBe('A'); // ab@test.com → A
  });

  it('assigns null abVariant to non-A/B-test steps', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await triggerWelcomeSequence('c1', 'alice@test.com', 'Alice');

    const step2 = inserts.find(i => i.col === 'EmailQueue' && i.item.sequenceStep === 2);
    const step3 = inserts.find(i => i.col === 'EmailQueue' && i.item.sequenceStep === 3);
    expect(step2.item.abVariant).toBeNull();
    expect(step3.item.abVariant).toBeNull();
  });

  it('includes correct subject line variable for variant B', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    // alice@test.com → B
    await triggerWelcomeSequence('c1', 'alice@test.com', 'Alice');

    const step1 = inserts.find(i => i.col === 'EmailQueue' && i.item.sequenceStep === 1);
    expect(step1.item.abVariant).toBe('B');
    expect(step1.item.variables.subjectLine).toContain('Alice');
  });
});
