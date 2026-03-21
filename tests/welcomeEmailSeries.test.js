/**
 * @file welcomeEmailSeries.test.js
 * @description Tests for triggerWelcomeSeries (CF-4mof T3).
 *
 * triggerWelcomeSeries: SiteMember webMethod — enqueues all 3 welcome email
 * steps in EmailQueue with dedup guard. Member-accessible entry point for the
 * welcome sequence (no contactId required).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __seed,
  __reset,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { triggerWelcomeSeries } from '../src/backend/emailAutomation.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const EMAIL = 'alice@example.com';
const FIRST_NAME = 'Alice';

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — happy path
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — happy path', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('returns success:true on valid email', async () => {
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(true);
  });

  it('returns queued:3 (all three welcome steps)', async () => {
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.queued).toBe(3);
  });

  it('inserts 3 records into EmailQueue', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const records = __getInserted('EmailQueue');
    expect(records).toHaveLength(3);
  });

  it('queued records have sequenceType:welcome', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const records = __getInserted('EmailQueue');
    expect(records.every(r => r.sequenceType === 'welcome')).toBe(true);
  });

  it('queued records have sequenceSteps 1, 2, 3', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const steps = __getInserted('EmailQueue').map(r => r.sequenceStep).sort();
    expect(steps).toEqual([1, 2, 3]);
  });

  it('queued records have correct recipientEmail', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const records = __getInserted('EmailQueue');
    expect(records.every(r => r.recipientEmail === EMAIL)).toBe(true);
  });

  it('step 1 scheduledFor is approximately now (0h delay)', async () => {
    const before = Date.now();
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const after = Date.now();
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.scheduledFor.getTime()).toBeGreaterThanOrEqual(before);
    expect(step1.scheduledFor.getTime()).toBeLessThanOrEqual(after + 100);
  });

  it('step 2 scheduledFor is approximately 72h from now', async () => {
    const before = Date.now();
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const step2 = __getInserted('EmailQueue').find(r => r.sequenceStep === 2);
    const expected = 72 * 60 * 60 * 1000;
    const actual = step2.scheduledFor.getTime() - before;
    expect(actual).toBeGreaterThanOrEqual(expected - 1000);
    expect(actual).toBeLessThanOrEqual(expected + 5000);
  });

  it('step 3 scheduledFor is approximately 168h from now', async () => {
    const before = Date.now();
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const step3 = __getInserted('EmailQueue').find(r => r.sequenceStep === 3);
    const expected = 168 * 60 * 60 * 1000;
    const actual = step3.scheduledFor.getTime() - before;
    expect(actual).toBeGreaterThanOrEqual(expected - 1000);
    expect(actual).toBeLessThanOrEqual(expected + 5000);
  });

  it('step 1 variables include firstName and discountCode', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables.firstName).toBe(FIRST_NAME);
    expect(step1.variables.discountCode).toBe('WELCOME10');
  });

  it('normalises email to lowercase', async () => {
    await triggerWelcomeSeries('ALICE@EXAMPLE.COM', FIRST_NAME);
    const records = __getInserted('EmailQueue');
    expect(records.every(r => r.recipientEmail === 'alice@example.com')).toBe(true);
  });

  it('all records have status:pending', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const records = __getInserted('EmailQueue');
    expect(records.every(r => r.status === 'pending')).toBe(true);
  });

  it('works without firstName — stores empty string in variables', async () => {
    const result = await triggerWelcomeSeries(EMAIL);
    expect(result.success).toBe(true);
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables.firstName).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — dedup guard
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — dedup guard', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __seed('Unsubscribes', []);
  });

  it('returns success:false when step 1 already in EmailQueue', async () => {
    __seed('EmailQueue', [
      { recipientEmail: EMAIL, sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
    ]);
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('does not insert additional records when already queued', async () => {
    __seed('EmailQueue', [
      { recipientEmail: EMAIL, sequenceType: 'welcome', sequenceStep: 1, status: 'sent' },
    ]);
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    // __getInserted returns all items in the store (seeded + inserted).
    // Seeded 1, should still be 1 (dedup guard prevented new inserts).
    const all = __getInserted('EmailQueue');
    expect(all).toHaveLength(1);
  });

  it('allows a second email to be queued even if first was already queued', async () => {
    __seed('EmailQueue', [
      { recipientEmail: EMAIL, sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
    ]);
    const result = await triggerWelcomeSeries('bob@example.com', 'Bob');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — unsubscribe check
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — unsubscribe check', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __seed('EmailQueue', []);
  });

  it('returns success:false when email is unsubscribed from welcome', async () => {
    __seed('Unsubscribes', [{ email: EMAIL, sequenceType: 'welcome' }]);
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('returns success:false when email is unsubscribed from all', async () => {
    __seed('Unsubscribes', [{ email: EMAIL, sequenceType: 'all' }]);
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(false);
  });

  it('proceeds when unsubscribe is for a different sequence type', async () => {
    __seed('Unsubscribes', [{ email: EMAIL, sequenceType: 'cart_recovery' }]);
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — input validation
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — input validation', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('returns success:false when email is missing', async () => {
    const result = await triggerWelcomeSeries();
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('returns success:false when email is empty string', async () => {
    const result = await triggerWelcomeSeries('', FIRST_NAME);
    expect(result.success).toBe(false);
  });

  it('returns success:false for invalid email format', async () => {
    const result = await triggerWelcomeSeries('not-an-email', FIRST_NAME);
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('returns success:false for email missing domain', async () => {
    const result = await triggerWelcomeSeries('alice@', FIRST_NAME);
    expect(result.success).toBe(false);
  });

  it('accepts valid email and queues successfully', async () => {
    const result = await triggerWelcomeSeries('valid@test.com', 'Test');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — discount secret fallback
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — discount secret fallback', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('succeeds when WELCOME_DISCOUNT_CODE secret is not set', async () => {
    // No secrets set — getSecret will throw
    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });

  it('stores empty discountCode when secret is unavailable', async () => {
    await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    const step1 = __getInserted('EmailQueue').find(r => r.sequenceStep === 1);
    expect(step1.variables.discountCode).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — error resilience
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — error resilience', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('returns success:false when DB insert throws', async () => {
    const wixData = await import('./__mocks__/wix-data.js');
    const realInsert = wixData.default.insert;
    wixData.default.insert = async () => { throw new Error('DB unavailable'); };

    const result = await triggerWelcomeSeries(EMAIL, FIRST_NAME);
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);

    wixData.default.insert = realInsert;
  });
});
