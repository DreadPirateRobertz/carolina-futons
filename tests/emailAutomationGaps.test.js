/**
 * Tests for emailAutomation.web.js — Gap 2 (restock) + Gap 4 (review thanks)
 * + Gap 5 (jobs.config) + sequence definitions for new sequences.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as __resetData } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog } from './__mocks__/wix-crm-backend.js';
import {
  triggerRestockNotifications,
  triggerReviewThanks,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __resetData();
  __resetSecrets();
  __setSecrets({
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
    REVIEW_DISCOUNT_CODE: 'REVIEW10',
  });
  vi.clearAllMocks();
});

// ── New Sequence Definitions ────────────────────────────────────────

describe('new sequence definitions', () => {
  it('has restock sequence with 1 immediate step', () => {
    expect(_SEQUENCES.restock.steps).toHaveLength(1);
    expect(_SEQUENCES.restock.steps[0].templateId).toBe('restock_notification');
    expect(_SEQUENCES.restock.steps[0].delayHours).toBe(0);
  });

  it('has review_thanks sequence with 1 immediate step', () => {
    expect(_SEQUENCES.review_thanks.steps).toHaveLength(1);
    expect(_SEQUENCES.review_thanks.steps[0].templateId).toBe('review_thank_you');
    expect(_SEQUENCES.review_thanks.steps[0].delayHours).toBe(0);
  });
});

// ── triggerRestockNotifications ──────────────────────────────────────

describe('triggerRestockNotifications', () => {
  it('queues restock emails for each subscriber', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', []);
    __seed('BackInStockSignups', []);

    const result = await triggerRestockNotifications('prod-1', [
      { _id: 'sub-1', email: 'alice@test.com', contactId: 'c1', productName: 'Eureka Futon' },
      { _id: 'sub-2', email: 'bob@test.com', contactId: 'c2', productName: 'Eureka Futon' },
    ]);

    expect(result.success).toBe(true);
    expect(result.notified).toBe(2);

    const emailQueueInserts = inserted.filter(i => i.col === 'EmailQueue');
    expect(emailQueueInserts).toHaveLength(2);
    expect(emailQueueInserts[0].item.templateId).toBe('restock_notification');
    expect(emailQueueInserts[0].item.sequenceType).toBe('restock');
    expect(emailQueueInserts[0].item.variables.productName).toBe('Eureka Futon');
    expect(emailQueueInserts[0].item.variables.productId).toBe('prod-1');
  });

  it('marks subscribers as notified', async () => {
    const updated = [];
    __onInsert(() => {});
    __onUpdate((col, item) => updated.push({ col, item }));
    __seed('Unsubscribes', []);
    __seed('BackInStockSignups', []);

    await triggerRestockNotifications('prod-1', [
      { _id: 'sub-1', email: 'alice@test.com', productName: 'Futon' },
    ]);

    const signupUpdates = updated.filter(u => u.col === 'BackInStockSignups');
    expect(signupUpdates).toHaveLength(1);
    expect(signupUpdates[0].item.notified).toBe(true);
    expect(signupUpdates[0].item.notifiedAt).toBeInstanceOf(Date);
  });

  it('skips unsubscribed contacts', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', [
      { email: 'unsub@test.com', sequenceType: 'restock' },
    ]);

    const result = await triggerRestockNotifications('prod-1', [
      { _id: 'sub-1', email: 'unsub@test.com', productName: 'Futon' },
    ]);

    expect(result.notified).toBe(0);
    expect(inserted.filter(i => i.col === 'EmailQueue')).toHaveLength(0);
  });

  it('skips invalid emails', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', []);

    const result = await triggerRestockNotifications('prod-1', [
      { _id: 'sub-1', email: 'not-an-email', productName: 'Futon' },
      { _id: 'sub-2', email: '', productName: 'Futon' },
    ]);

    expect(result.notified).toBe(0);
  });

  it('returns failure for empty subscriber list', async () => {
    const result = await triggerRestockNotifications('prod-1', []);
    expect(result.success).toBe(false);
    expect(result.notified).toBe(0);
  });

  it('returns failure for missing productId', async () => {
    const result = await triggerRestockNotifications('', [
      { email: 'alice@test.com' },
    ]);
    expect(result.success).toBe(false);
  });

  it('returns failure for null subscribers', async () => {
    const result = await triggerRestockNotifications('prod-1', null);
    expect(result.success).toBe(false);
  });
});

// ── triggerReviewThanks ─────────────────────────────────────────────

describe('triggerReviewThanks', () => {
  it('queues a review thank-you email with discount code', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', []);

    const result = await triggerReviewThanks('c1', 'alice@test.com', 'Alice', 'Eureka Futon');

    expect(result.success).toBe(true);

    const emailInserts = inserted.filter(i => i.col === 'EmailQueue');
    expect(emailInserts).toHaveLength(1);
    expect(emailInserts[0].item.templateId).toBe('review_thank_you');
    expect(emailInserts[0].item.sequenceType).toBe('review_thanks');
    expect(emailInserts[0].item.variables.firstName).toBe('Alice');
    expect(emailInserts[0].item.variables.productName).toBe('Eureka Futon');
    expect(emailInserts[0].item.variables.discountCode).toBe('REVIEW10');
  });

  it('sends email without discount when secret is unavailable', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', []);
    __resetSecrets(); // No REVIEW_DISCOUNT_CODE available

    const result = await triggerReviewThanks('c1', 'bob@test.com', 'Bob', 'Night Frame');

    expect(result.success).toBe(true);
    const emailInserts = inserted.filter(i => i.col === 'EmailQueue');
    expect(emailInserts[0].item.variables.discountCode).toBe('');
  });

  it('skips unsubscribed contacts', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', [
      { email: 'unsub@test.com', sequenceType: 'review_thanks' },
    ]);

    const result = await triggerReviewThanks('c1', 'unsub@test.com', 'Unsub', 'Futon');
    expect(result.success).toBe(false);
    expect(inserted.filter(i => i.col === 'EmailQueue')).toHaveLength(0);
  });

  it('returns failure for invalid email', async () => {
    const result = await triggerReviewThanks('c1', 'bad-email', 'Test', 'Futon');
    expect(result.success).toBe(false);
  });

  it('returns failure for empty email', async () => {
    const result = await triggerReviewThanks('c1', '', 'Test', 'Futon');
    expect(result.success).toBe(false);
  });

  it('sanitizes input values', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('Unsubscribes', []);

    await triggerReviewThanks(
      '<script>alert(1)</script>',
      'clean@test.com',
      '<b>XSS</b>',
      '<img onerror=alert(1)>'
    );

    const emailInserts = inserted.filter(i => i.col === 'EmailQueue');
    expect(emailInserts[0].item.variables.firstName).not.toContain('<script>');
    expect(emailInserts[0].item.recipientContactId).not.toContain('<script>');
  });
});

// ── jobs.config ─────────────────────────────────────────────────────

describe('jobs.config', () => {
  it('exports a config function with 3 scheduled jobs', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    expect(jobs).toHaveProperty('processEmailQueue');
    expect(jobs).toHaveProperty('triggerAbandonedCartRecovery');
    expect(jobs).toHaveProperty('triggerReengagement');
  });

  it('processEmailQueue runs every 15 minutes', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    expect(jobs.processEmailQueue.executionConfig.cronExpression).toBe('*/15 * * * *');
  });

  it('triggerAbandonedCartRecovery runs every hour', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    expect(jobs.triggerAbandonedCartRecovery.executionConfig.cronExpression).toBe('0 * * * *');
  });

  it('triggerReengagement runs weekly on Monday', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    expect(jobs.triggerReengagement.executionConfig.cronExpression).toMatch(/\* 1$/);
  });

  it('checkBrowseAbandonment runs every 2 hours', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    expect(jobs.checkBrowseAbandonment).toBeDefined();
    expect(jobs.checkBrowseAbandonment.executionConfig.cronExpression).toBe('0 */2 * * *');
    expect(jobs.checkBrowseAbandonment.functionLocation).toContain('browseAbandonment.web.js');
  });

  it('all email automation jobs reference emailAutomation.web.js', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();

    const emailJobs = Object.values(jobs).filter(j =>
      j.functionLocation?.includes('emailAutomation')
    );
    expect(emailJobs.length).toBeGreaterThan(0);
    for (const job of emailJobs) {
      expect(job.functionLocation).toContain('emailAutomation.web.js');
    }
  });
});
