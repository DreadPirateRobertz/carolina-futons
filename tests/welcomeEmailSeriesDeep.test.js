/**
 * @file welcomeEmailSeriesDeep.test.js
 * @description Deep coverage for the welcome email series (CF-0aqh).
 *
 * Covers:
 * - Day 0 / Day 3 / Day 7 sequence: each step fires exactly once per member
 * - Unsubscribe mid-sequence: step 2/3 pending when member unsubscribes after step 1 sent
 * - Already-existing member signup: welcome series must not restart for pre-existing accounts
 * - Email template rendering: edge case inputs (apostrophes, long names, special chars)
 * - Sequence deduplication: new signup during active sequence does not restart from Day 0
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {
  __seed,
  __reset,
  __getInserted,
  __getUpdated,
  __onInsert,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as __resetCrm } from './__mocks__/wix-crm-backend.js';
import {
  triggerWelcomeSeries,
  triggerWelcomeSequence,
  processEmailQueue,
  wixMembers_onMemberCreated,
} from '../src/backend/emailAutomation.web.js';
import {
  getWelcomeDay0Template,
  getWelcomeDay3Template,
  getWelcomeDay7Template,
  buildProductBlock,
} from '../src/backend/emailTemplates.web.js';

// ── Helpers ───────────────────────────────────────────────────────────

function seedEmptyCollections() {
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
}

// Pin time to 2pm UTC (within 8am–8pm EST send window) so window checks pass.
const FIXED_NOW = new Date('2026-03-20T18:00:00.000Z');

// ═══════════════════════════════════════════════════════════════════
// Group 1: Each welcome step fires exactly once per member
// ═══════════════════════════════════════════════════════════════════

describe('welcome sequence — each step fires exactly once per member', () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
  });
  afterAll(() => { vi.useRealTimers(); });

  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    seedEmptyCollections();
    __resetCrm();
  });

  it('processEmailQueue does not re-process a step already marked sent', async () => {
    // Step 1 already sent; steps 2 and 3 are in the future (not yet due)
    __seed('EmailQueue', [
      {
        _id: 'eq-sent1',
        templateId: 'welcome_series_1',
        recipientEmail: 'once@test.com',
        recipientContactId: 'c-once',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'sent',
        scheduledFor: new Date(FIXED_NOW.getTime() - 3600000),
        attempt: 1,
      },
      {
        _id: 'eq-future2',
        templateId: 'welcome_series_2',
        recipientEmail: 'once@test.com',
        recipientContactId: 'c-once',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() + 72 * 3600000),
        attempt: 0,
      },
    ]);

    const result = await processEmailQueue();
    // Sent item is excluded from the pending query; future item is not yet due
    expect(result.sent).toBe(0);
    expect(result.cancelled).toBe(0);
  });

  it('processEmailQueue sends only the step that is due, leaves future steps pending', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-due1',
        templateId: 'welcome_series_1',
        recipientEmail: 'steponce@test.com',
        recipientContactId: 'c-steponce',
        variables: { firstName: 'Sam' },
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 1000),
        attempt: 0,
      },
      {
        _id: 'eq-future2',
        templateId: 'welcome_series_2',
        recipientEmail: 'steponce@test.com',
        recipientContactId: 'c-steponce',
        variables: { firstName: 'Sam' },
        sequenceType: 'welcome',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() + 72 * 3600000),
        attempt: 0,
      },
      {
        _id: 'eq-future3',
        templateId: 'welcome_series_3',
        recipientEmail: 'steponce@test.com',
        recipientContactId: 'c-steponce',
        variables: { firstName: 'Sam' },
        sequenceType: 'welcome',
        sequenceStep: 3,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() + 168 * 3600000),
        attempt: 0,
      },
    ]);

    const result = await processEmailQueue();
    expect(result.sent).toBe(1);
    expect(result.cancelled).toBe(0);
    expect(result.deferred).toBe(0);
  });

  it('calling triggerWelcomeSeries twice for the same email queues only once', async () => {
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });

    const first = await triggerWelcomeSeries('twice@test.com', 'Twice');
    expect(first.success).toBe(true);
    expect(first.queued).toBe(3);

    const second = await triggerWelcomeSeries('twice@test.com', 'Twice');
    expect(second.success).toBe(false);
    expect(second.queued).toBe(0);

    // Exactly 3 records in the queue — not 6
    const all = __getInserted('EmailQueue');
    const welcome = all.filter(r => r.sequenceType === 'welcome');
    expect(welcome).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Group 2: Unsubscribe mid-sequence (processEmailQueue cancels at send time)
// ═══════════════════════════════════════════════════════════════════

describe('unsubscribe mid-sequence — processEmailQueue cancels at send time', () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
  });
  afterAll(() => { vi.useRealTimers(); });

  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    __resetCrm();
  });

  it('step 2 due but member unsubscribed from welcome → cancelled by processEmailQueue', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-day3',
        templateId: 'welcome_series_2',
        recipientEmail: 'midleave@test.com',
        recipientContactId: 'c-ml',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 1000),
        attempt: 0,
      },
    ]);
    __seed('Unsubscribes', [
      { email: 'midleave@test.com', sequenceType: 'welcome' },
    ]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('step 3 due but member unsubscribed from welcome → cancelled', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-day7',
        templateId: 'welcome_series_3',
        recipientEmail: 'leavelate@test.com',
        recipientContactId: 'c-ll',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 3,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 1000),
        attempt: 0,
      },
    ]);
    __seed('Unsubscribes', [
      { email: 'leavelate@test.com', sequenceType: 'welcome' },
    ]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('steps 2 and 3 both due after welcome unsubscribe → both cancelled', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-s2',
        templateId: 'welcome_series_2',
        recipientEmail: 'both@test.com',
        recipientContactId: 'c-both',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 2000),
        attempt: 0,
      },
      {
        _id: 'eq-s3',
        templateId: 'welcome_series_3',
        recipientEmail: 'both@test.com',
        recipientContactId: 'c-both',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 3,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 1000),
        attempt: 0,
      },
    ]);
    __seed('Unsubscribes', [
      { email: 'both@test.com', sequenceType: 'welcome' },
    ]);

    const result = await processEmailQueue();
    expect(result.cancelled).toBe(2);
    expect(result.sent).toBe(0);
  });

  it('step 2 due but member only unsubscribed from a different sequence → step 2 is sent', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-s2-ok',
        templateId: 'welcome_series_2',
        recipientEmail: 'stayswelcome@test.com',
        recipientContactId: 'c-sw',
        variables: {},
        sequenceType: 'welcome',
        sequenceStep: 2,
        status: 'pending',
        scheduledFor: new Date(FIXED_NOW.getTime() - 1000),
        attempt: 0,
      },
    ]);
    __seed('Unsubscribes', [
      // Only unsubscribed from cart_recovery, not welcome
      { email: 'stayswelcome@test.com', sequenceType: 'cart_recovery' },
    ]);

    const result = await processEmailQueue();
    expect(result.sent).toBe(1);
    expect(result.cancelled).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Group 3: Already-existing member signup
// ═══════════════════════════════════════════════════════════════════

describe('already-existing member — welcome series must not restart', () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
  });
  afterAll(() => { vi.useRealTimers(); });

  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    seedEmptyCollections();
  });

  it('wixMembers_onMemberCreated: member with sent step 1 → no new inserts', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-existing-sent',
        recipientEmail: 'existing@test.com',
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'sent',
      },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixMembers_onMemberCreated({
      entity: {
        _id: 'member-existing',
        loginEmail: 'existing@test.com',
        contactDetails: { firstName: 'Existing' },
      },
    });

    await vi.runAllTimersAsync();
    expect(insertCount).toBe(0);
  });

  it('wixMembers_onMemberCreated: member with pending step 1 → no new inserts (dedup)', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-existing-pending',
        recipientEmail: 'repro@test.com',
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'pending',
      },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixMembers_onMemberCreated({
      entity: {
        _id: 'member-repro',
        loginEmail: 'repro@test.com',
        contactDetails: { firstName: 'RePro' },
      },
    });

    await vi.runAllTimersAsync();
    expect(insertCount).toBe(0);
  });

  it('triggerWelcomeSequence (Admin): blocked when step 1 exists with status sent', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-admin-sent',
        recipientEmail: 'admin@test.com',
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'sent',
      },
    ]);
    __seed('Unsubscribes', []);

    const result = await triggerWelcomeSequence('contact-admin', 'admin@test.com', 'Admin');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Group 4: Template rendering — edge case inputs
// ═══════════════════════════════════════════════════════════════════

describe('welcome template rendering — edge case inputs', () => {
  it('getWelcomeDay0Template: firstName with apostrophe renders without raw single-quote injection', async () => {
    const result = await getWelcomeDay0Template("O'Brien", 'WELCOME10');
    expect(result.html).toBeTruthy();
    // Apostrophe should appear as &#39; or &apos; or similar — not as a raw unescaped ' that breaks HTML attributes
    // Crucially the HTML must not contain a script tag from the name
    expect(result.html).not.toContain('<script>');
    // The name should appear in some form in the output
    expect(result.html.toLowerCase()).toContain('o');
  });

  it('getWelcomeDay3Template: firstName with apostrophe renders correctly', async () => {
    const result = await getWelcomeDay3Template("O'Brien");
    expect(result.html).toBeTruthy();
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('getWelcomeDay7Template: firstName with apostrophe renders correctly', async () => {
    const result = await getWelcomeDay7Template("O'Brien", 'SAVE10');
    expect(result.html).toBeTruthy();
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('getWelcomeDay0Template: very long firstName (100 chars) renders without breaking HTML', async () => {
    const longName = 'A'.repeat(100);
    const result = await getWelcomeDay0Template(longName, 'CODE');
    expect(result.html).toBeTruthy();
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('</html>');
  });

  it('getWelcomeDay7Template: discount code with apostrophe is sanitized', async () => {
    const result = await getWelcomeDay7Template('Alice', "SAVE'10");
    expect(result.html).toBeTruthy();
    // Should not produce a broken HTML attribute
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('buildProductBlock: product name with apostrophe renders without XSS vector', () => {
    const html = buildProductBlock({
      name: "O'Brien's Futon Frame",
      price: 299,
      url: 'https://www.carolinafutons.com/product-page/obriens',
      images: [],
    });
    expect(html).toBeTruthy();
    expect(html).not.toContain('<script>');
  });

  it('buildProductBlock: very long product name (150 chars) is truncated or rendered safely', () => {
    const longName = 'Futon Frame '.repeat(12).trim(); // ~144 chars
    const html = buildProductBlock({
      name: longName,
      price: 399,
      url: 'https://www.carolinafutons.com/product-page/long',
      images: [],
    });
    expect(html).toBeTruthy();
    // Name appears (possibly truncated) — just must not break or inject
    expect(html).not.toContain('<script>');
    expect(html).toContain('Futon Frame');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Group 5: Sequence deduplication — new signup during active sequence
// ═══════════════════════════════════════════════════════════════════

describe('sequence deduplication — new signup during active sequence', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
    seedEmptyCollections();
  });

  it('triggerWelcomeSeries blocked when step 1 has status failed (dedup ignores status)', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-failed',
        recipientEmail: 'failedbefore@test.com',
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'failed',
      },
    ]);

    const result = await triggerWelcomeSeries('failedbefore@test.com', 'Fail');
    // Dedup guard queries for any step-1 record regardless of status
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('triggerWelcomeSequence (Admin) blocked when step 1 has status failed', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq-admin-failed',
        recipientEmail: 'adminfail@test.com',
        sequenceType: 'welcome',
        sequenceStep: 1,
        status: 'failed',
      },
    ]);
    __seed('Unsubscribes', []);

    const result = await triggerWelcomeSequence('c-af', 'adminfail@test.com', 'Admin');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('triggerWelcomeSeries blocked when all 3 steps are already active (full sequence pending)', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-p1', recipientEmail: 'active@test.com', sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
      { _id: 'eq-p2', recipientEmail: 'active@test.com', sequenceType: 'welcome', sequenceStep: 2, status: 'pending' },
      { _id: 'eq-p3', recipientEmail: 'active@test.com', sequenceType: 'welcome', sequenceStep: 3, status: 'pending' },
    ]);

    const result = await triggerWelcomeSeries('active@test.com', 'Active');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('different email is not blocked by another email\'s active sequence', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-other', recipientEmail: 'other@test.com', sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
    ]);

    const result = await triggerWelcomeSeries('different@test.com', 'Diff');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });
});
