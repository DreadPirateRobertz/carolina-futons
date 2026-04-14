/**
 * cf-fsm — runReviewRequestEmails daily cron.
 * Scans Stores/Orders placed 6–8 days ago (±1 day tolerance around day 7) and
 * invokes triggerReviewRequestSequence for each order with a valid email+contactId.
 * Dedup is delegated to enqueueEmail (via EmailQueue), so repeat firings for the
 * same order within its window are safe and return skipped.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __reset as resetCRM } from './__mocks__/wix-crm-backend.js';

import {
  runReviewRequestEmails,
  EMAIL_SEQUENCES_COLLECTION,
} from '../src/backend/marketingSequences.web.js';
import { EMAIL_QUEUE_COLLECTION } from '../src/backend/emailQueueService.web.js';

const ORDERS_COLLECTION = 'Stores/Orders';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function makeOrder(overrides = {}) {
  return {
    _id: `order-${Math.random().toString(36).slice(2, 8)}`,
    _createdDate: daysAgo(7),
    buyerInfo: {
      email: 'buyer@example.com',
      contactId: 'contact-1',
      memberId: 'mem-1',
      firstName: 'Buyer',
    },
    ...overrides,
  };
}

function seedReviewRequestStep() {
  __seed(EMAIL_SEQUENCES_COLLECTION, [{
    _id: 'seq-rr-1',
    sequenceType: 'review_request',
    step: 1,
    templateId: 'tpl-review-1',
    delayHours: 168,
    subject: 'How are you liking it?',
    active: true,
  }]);
}

beforeEach(() => {
  resetData();
  resetCRM();
});

describe('runReviewRequestEmails — daily cron (cf-fsm)', () => {
  it('triggers review request for orders placed 7 days ago', async () => {
    seedReviewRequestStep();
    __seed(ORDERS_COLLECTION, [makeOrder({ _id: 'order-a', _createdDate: daysAgo(7) })]);

    const result = await runReviewRequestEmails();

    expect(result.success).toBe(true);
    expect(result.ordersScanned).toBe(1);
    expect(result.triggered).toBe(1);

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued).toHaveLength(1);
    expect(queued[0].sequenceType).toBe('review_request');
    expect(queued[0].recipientEmail).toBe('buyer@example.com');
  });

  it('fires within ±1 day window (6 and 8 days)', async () => {
    seedReviewRequestStep();
    __seed(ORDERS_COLLECTION, [
      makeOrder({ _id: 'order-6d', _createdDate: daysAgo(6), buyerInfo: { email: 'a@x.com', contactId: 'c-a' } }),
      makeOrder({ _id: 'order-8d', _createdDate: daysAgo(8), buyerInfo: { email: 'b@x.com', contactId: 'c-b' } }),
    ]);

    const result = await runReviewRequestEmails();
    expect(result.triggered).toBe(2);
  });

  it('skips orders outside the window (5 and 9 days)', async () => {
    seedReviewRequestStep();
    __seed(ORDERS_COLLECTION, [
      makeOrder({ _id: 'order-5d', _createdDate: daysAgo(5), buyerInfo: { email: 'a@x.com', contactId: 'c-a' } }),
      makeOrder({ _id: 'order-9d', _createdDate: daysAgo(9), buyerInfo: { email: 'b@x.com', contactId: 'c-b' } }),
    ]);

    const result = await runReviewRequestEmails();
    expect(result.triggered).toBe(0);
    expect(__getInserted(EMAIL_QUEUE_COLLECTION)).toHaveLength(0);
  });

  it('skips orders missing email or contactId', async () => {
    seedReviewRequestStep();
    __seed(ORDERS_COLLECTION, [
      makeOrder({ _id: 'order-noemail', buyerInfo: { contactId: 'c-x' } }),
      makeOrder({ _id: 'order-nocontact', buyerInfo: { email: 'a@x.com' } }),
      makeOrder({ _id: 'order-ok', buyerInfo: { email: 'ok@x.com', contactId: 'c-ok' } }),
    ]);

    const result = await runReviewRequestEmails();
    expect(result.triggered).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it('is idempotent — second run within the same window is a no-op (dedup in enqueueEmail)', async () => {
    seedReviewRequestStep();
    __seed(ORDERS_COLLECTION, [makeOrder({ _id: 'order-dup', buyerInfo: { email: 'dup@x.com', contactId: 'c-dup' } })]);

    await runReviewRequestEmails();
    await runReviewRequestEmails();

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued).toHaveLength(1);
  });

  it('returns success:false on unexpected failure', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError(ORDERS_COLLECTION, new Error('boom'));

    const result = await runReviewRequestEmails();
    expect(result.success).toBe(false);
  });
});
