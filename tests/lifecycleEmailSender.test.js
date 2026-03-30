/**
 * @file lifecycleEmailSender.test.js
 * @description TDD tests for CF-3izl.3: Wire lifecycle cron to email send.
 *
 * Tests:
 *   - sendLifecycleEmails: queues correct EmailQueue entries per milestone
 *   - Dedup: skips orderId+milestone already in SentLifecycleMails
 *   - Year 1: queues entry with couponCode: ANNIVERSARY15
 *   - Records each send in SentLifecycleMails
 *   - Returns counts: totalScanned, queued, skipped
 *   - Error handling: returns safe fallback on DB failure
 *   - No-op when no milestones found
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, {
  __seed,
  __reset as resetData,
  __getInserted,
  __onInsert,
} from './__mocks__/wix-data.js';

// ── Mock: lifecycleCron (scanLifecycleMilestones) ──────────────────────────────

vi.mock('../src/backend/lifecycleCron.web.js', () => ({
  scanLifecycleMilestones: vi.fn(),
}));
import { scanLifecycleMilestones } from '../src/backend/lifecycleCron.web.js';

import {
  sendLifecycleEmails,
  SENT_LIFECYCLE_MAILS_COLLECTION,
  LIFECYCLE_EMAIL_QUEUE_TYPE,
} from '../src/backend/lifecycleEmailSender.web.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DAY7_RESULT = {
  orderId: 'order-d7',
  memberId: 'mem-1',
  email: 'alice@example.com',
  milestone: 'day_7',
  orderDate: new Date('2026-01-01'),
  productName: 'Java Full XL Futon Frame',
  buyerName: 'Alice',
};

const MONTH1_RESULT = {
  orderId: 'order-m1',
  memberId: 'mem-2',
  email: 'bob@example.com',
  milestone: 'month_1',
  orderDate: new Date('2026-02-01'),
  productName: 'Zen Sofa Futon Frame',
  buyerName: 'Bob',
};

const YEAR1_RESULT = {
  orderId: 'order-y1',
  memberId: 'mem-3',
  email: 'carol@example.com',
  milestone: 'year_1',
  orderDate: new Date('2025-03-01'),
  productName: 'Night and Day Futon',
  buyerName: 'Carol',
};

function successScan(results) {
  scanLifecycleMilestones.mockResolvedValue({
    success: true,
    ordersScanned: results.length,
    milestonesFound: results.length,
    results,
  });
}

function failedScan() {
  scanLifecycleMilestones.mockResolvedValue({
    success: false,
    ordersScanned: 0,
    milestonesFound: 0,
    results: [],
  });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('module constants', () => {
  it('SENT_LIFECYCLE_MAILS_COLLECTION is a non-empty string', () => {
    expect(typeof SENT_LIFECYCLE_MAILS_COLLECTION).toBe('string');
    expect(SENT_LIFECYCLE_MAILS_COLLECTION.length).toBeGreaterThan(0);
  });

  it('LIFECYCLE_EMAIL_QUEUE_TYPE is a non-empty string', () => {
    expect(typeof LIFECYCLE_EMAIL_QUEUE_TYPE).toBe('string');
    expect(LIFECYCLE_EMAIL_QUEUE_TYPE.length).toBeGreaterThan(0);
  });
});

// ── sendLifecycleEmails — no milestones ───────────────────────────────────────

describe('sendLifecycleEmails — no milestones', () => {
  it('returns success true with zero counts when no milestones found', async () => {
    successScan([]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);

    const result = await sendLifecycleEmails();

    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('queues nothing when scan returns no results', async () => {
    successScan([]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    await sendLifecycleEmails();

    expect(insertCount).toBe(0);
  });
});

// ── sendLifecycleEmails — queuing behavior ────────────────────────────────────

describe('sendLifecycleEmails — queue entries', () => {
  it('inserts an EmailQueue entry for a day_7 milestone', async () => {
    successScan([DAY7_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(1);
    expect(queued[0].sequenceType).toBe(LIFECYCLE_EMAIL_QUEUE_TYPE);
    expect(queued[0].templateId).toBe('lifecycle_day_7');
    expect(queued[0].recipientEmail).toBe('alice@example.com');
  });

  it('inserts an EmailQueue entry for a month_1 milestone', async () => {
    successScan([MONTH1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(1);
    expect(queued[0].templateId).toBe('lifecycle_month_1');
    expect(queued[0].recipientEmail).toBe('bob@example.com');
  });

  it('inserts an EmailQueue entry for a year_1 milestone', async () => {
    successScan([YEAR1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(1);
    expect(queued[0].templateId).toBe('lifecycle_year_1');
    expect(queued[0].recipientEmail).toBe('carol@example.com');
  });

  it('queues all three milestones when all present', async () => {
    successScan([DAY7_RESULT, MONTH1_RESULT, YEAR1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.queued).toBe(3);
    expect(__getInserted('EmailQueue')).toHaveLength(3);
  });

  it('EmailQueue entry includes name, productName, orderDate in variables', async () => {
    successScan([DAY7_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const entry = __getInserted('EmailQueue')[0];
    expect(entry.variables).toBeDefined();
    expect(entry.variables.name).toBe('Alice');
    expect(entry.variables.productName).toBe('Java Full XL Futon Frame');
    expect(entry.variables.orderDate).toBeDefined();
  });
});

// ── sendLifecycleEmails — ANNIVERSARY15 coupon (year_1) ──────────────────────

describe('sendLifecycleEmails — year_1 ANNIVERSARY15', () => {
  it('year_1 queue entry includes couponCode ANNIVERSARY15', async () => {
    successScan([YEAR1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const entry = __getInserted('EmailQueue')[0];
    expect(entry.variables.couponCode).toBe('ANNIVERSARY15');
  });

  it('day_7 queue entry does not include couponCode', async () => {
    successScan([DAY7_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const entry = __getInserted('EmailQueue')[0];
    expect(entry.variables.couponCode).toBeUndefined();
  });
});

// ── sendLifecycleEmails — SentLifecycleMails recording ───────────────────────

describe('sendLifecycleEmails — SentLifecycleMails recording', () => {
  it('records a SentLifecycleMails entry for each queued email', async () => {
    successScan([DAY7_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const sent = __getInserted(SENT_LIFECYCLE_MAILS_COLLECTION);
    expect(sent).toHaveLength(1);
    expect(sent[0].orderId).toBe('order-d7');
    expect(sent[0].milestone).toBe('day_7');
    expect(sent[0].email).toBe('alice@example.com');
    expect(sent[0].sentAt).toBeInstanceOf(Date);
  });

  it('records a SentLifecycleMails entry for each of multiple queued emails', async () => {
    successScan([DAY7_RESULT, YEAR1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    await sendLifecycleEmails();

    const sent = __getInserted(SENT_LIFECYCLE_MAILS_COLLECTION);
    expect(sent).toHaveLength(2);
  });
});

// ── sendLifecycleEmails — deduplication ──────────────────────────────────────

describe('sendLifecycleEmails — deduplication', () => {
  it('skips order+milestone already in SentLifecycleMails', async () => {
    successScan([DAY7_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, [
      {
        _id: 'sent-1',
        orderId: 'order-d7',
        milestone: 'day_7',
        email: 'alice@example.com',
        sentAt: new Date('2026-03-22'),
      },
    ]);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
    expect(__getInserted('EmailQueue')).toHaveLength(0);
  });

  it('sends new milestone even if same order has a different milestone already sent', async () => {
    successScan([MONTH1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, [
      // Same order, but day_7 was already sent — month_1 has not
      {
        _id: 'sent-d7',
        orderId: 'order-m1',
        milestone: 'day_7',
        email: 'bob@example.com',
        sentAt: new Date('2026-02-24'),
      },
    ]);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips multiple already-sent, queues only new ones', async () => {
    successScan([DAY7_RESULT, MONTH1_RESULT, YEAR1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, [
      { _id: 's1', orderId: 'order-d7', milestone: 'day_7', email: 'alice@example.com', sentAt: new Date() },
      { _id: 's2', orderId: 'order-y1', milestone: 'year_1', email: 'carol@example.com', sentAt: new Date() },
    ]);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(2);
    const queued = __getInserted('EmailQueue');
    expect(queued[0].recipientEmail).toBe('bob@example.com');
  });
});

// ── sendLifecycleEmails — result shape ────────────────────────────────────────

describe('sendLifecycleEmails — result shape', () => {
  it('returns totalScanned matching ordersScanned from cron', async () => {
    successScan([DAY7_RESULT, MONTH1_RESULT]);
    __seed(SENT_LIFECYCLE_MAILS_COLLECTION, []);
    __seed('EmailQueue', []);

    const result = await sendLifecycleEmails();

    expect(result.totalScanned).toBe(2);
  });
});

// ── sendLifecycleEmails — error handling ──────────────────────────────────────

describe('sendLifecycleEmails — error handling', () => {
  it('returns success false when scan fails', async () => {
    failedScan();

    const result = await sendLifecycleEmails();

    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('returns success false when DB throws', async () => {
    successScan([DAY7_RESULT]);
    vi.spyOn(wixData, 'query').mockImplementation(() => {
      throw new Error('DB error');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendLifecycleEmails();

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
