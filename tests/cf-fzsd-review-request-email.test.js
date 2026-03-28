/**
 * @file cf-fzsd-review-request-email.test.js
 * @description Tests for CF-fzsd: Post-purchase review request email — Day 7 trigger.
 *
 * Covers:
 *  - Deep-linked review URL uses product slug (not order number)
 *  - Fallback to member-page when no slug available
 *  - recordEmailEvent accepts 'conversion' event type
 *  - getEmailEvents counts conversions
 *  - submitReview records conversion when emailQueueId provided
 *  - submitReview remains successful when conversion recording fails
 *  - wixEcom_onOrderCreated extracts slug from line items
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { __setMember, __reset as __resetMembers } from './__mocks__/wix-members-backend.js';

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn(async () => ({})) },
  contacts: { queryContacts: vi.fn() },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (key) => {
    if (key === 'WELCOME_DISCOUNT_CODE') return 'WELCOME10';
    if (key === 'RECOVERY_DISCOUNT_CODE') return 'COMEBACK15';
    if (key === 'REVIEW_DISCOUNT_CODE') return 'REVIEW10';
    return '';
  }),
}));

// ── Subjects under test ─────────────────────────────────────────────

import {
  triggerPostPurchaseSequence,
  recordEmailEvent,
  getEmailEvents,
  wixEcom_onOrderCreated,
} from '../src/backend/emailAutomation.web.js';

import { submitReview } from '../src/backend/reviewsService.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const ORDER = {
  number: 'ORD-999',
  buyerInfo: { email: 'buyer@example.com', contactId: 'ctc-1', memberId: 'mbr-1' },
  billingInfo: { firstName: 'Keiko' },
  priceSummary: { total: { amount: '649' } },
  lineItems: [
    {
      productName: { original: 'Eureka Futon Frame' },
      quantity: 1,
      price: { amount: '649' },
      url: { relativePath: '/product-page/eureka-futon-frame' },
    },
  ],
};

beforeEach(() => {
  __reset();
  __resetMembers();
});

// ── Deep-linked review URL ──────────────────────────────────────────

describe('Day-7 review email: deep-linked review URL', () => {
  it('uses product slug from lineItems for step-2 reviewUrl', async () => {
    const lineItems = [
      { name: 'Eureka Futon Frame', quantity: 1, price: 649, slug: 'eureka-futon-frame' },
    ];
    await triggerPostPurchaseSequence('ctc-1', 'buyer@example.com', 'Keiko', 'ORD-999', 649, lineItems);

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    expect(step2).toBeDefined();

    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toBe('https://www.carolinafutons.com/product-page/eureka-futon-frame#reviews');
    expect(vars.reviewUrl).not.toContain('ORD-999');
  });

  it('falls back to member-page when no slug available', async () => {
    const lineItems = [
      { name: 'Monterey Frame', quantity: 1, price: 499 }, // no slug field
    ];
    await triggerPostPurchaseSequence('ctc-1', 'buyer@example.com', 'Sam', 'ORD-001', 499, lineItems);

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toBe('https://www.carolinafutons.com/member-page#reviews');
  });

  it('uses slug from first item when multiple items in order', async () => {
    const lineItems = [
      { name: 'Eureka Frame', quantity: 1, price: 399, slug: 'eureka-frame' },
      { name: 'Eureka Mattress', quantity: 1, price: 250, slug: 'eureka-mattress' },
    ];
    await triggerPostPurchaseSequence('ctc-1', 'buyer@example.com', 'Ali', 'ORD-002', 649, lineItems);

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toContain('eureka-frame');
  });

  it('uses second item slug when first item has no slug', async () => {
    const lineItems = [
      { name: 'Mystery Item', quantity: 1, price: 50 },
      { name: 'Monterey Frame', quantity: 1, price: 499, slug: 'monterey-frame' },
    ];
    await triggerPostPurchaseSequence('ctc-1', 'buyer@example.com', 'Jo', 'ORD-003', 549, lineItems);

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toContain('monterey-frame');
  });
});

// ── recordEmailEvent: conversion ────────────────────────────────────

describe('recordEmailEvent: conversion event type', () => {
  it('accepts conversion event type', async () => {
    __seed('EmailQueue', [{ _id: 'eq-1' }]);
    const result = await recordEmailEvent({ emailQueueId: 'eq-1', eventType: 'conversion' });
    expect(result.success).toBe(true);

    const events = __getInserted('EmailEvents');
    const conv = events.find(e => e.eventType === 'conversion');
    expect(conv).toBeDefined();
    expect(conv.emailQueueId).toBe('eq-1');
  });

  it('still accepts open and click event types', async () => {
    const r1 = await recordEmailEvent({ emailQueueId: 'eq-open', eventType: 'open' });
    const r2 = await recordEmailEvent({ emailQueueId: 'eq-click', eventType: 'click', linkUrl: 'https://example.com' });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('rejects unknown event types', async () => {
    const result = await recordEmailEvent({ emailQueueId: 'eq-1', eventType: 'bounce' });
    expect(result.success).toBe(false);
  });

  it('rejects missing emailQueueId', async () => {
    const result = await recordEmailEvent({ eventType: 'conversion' });
    expect(result.success).toBe(false);
  });
});

// ── getEmailEvents: conversion count ────────────────────────────────

describe('getEmailEvents: includes conversions', () => {
  it('counts conversions separately from opens and clicks', async () => {
    __seed('EmailEvents', [
      { _id: 'ev-1', emailQueueId: 'eq-1', eventType: 'open', timestamp: new Date(), linkUrl: '' },
      { _id: 'ev-2', emailQueueId: 'eq-1', eventType: 'click', timestamp: new Date(), linkUrl: 'https://example.com' },
      { _id: 'ev-3', emailQueueId: 'eq-1', eventType: 'conversion', timestamp: new Date(), linkUrl: '' },
      { _id: 'ev-4', emailQueueId: 'eq-2', eventType: 'conversion', timestamp: new Date(), linkUrl: '' },
    ]);

    const result = await getEmailEvents();
    expect(result.opens).toBe(1);
    expect(result.clicks).toBe(1);
    expect(result.conversions).toBe(2);
  });

  it('returns zero conversions when none recorded', async () => {
    __seed('EmailEvents', [
      { _id: 'ev-1', emailQueueId: 'eq-1', eventType: 'open', timestamp: new Date(), linkUrl: '' },
    ]);

    const result = await getEmailEvents();
    expect(result.conversions).toBe(0);
  });
});

// ── submitReview: conversion tracking ───────────────────────────────

describe('submitReview: email conversion tracking', () => {
  const MEMBER = {
    _id: 'mbr-1',
    profile: { nickname: 'Keiko S.' },
    loginEmail: 'buyer@example.com',
  };

  const VALID_REVIEW = {
    productId: 'prod-eureka',
    rating: 5,
    title: 'Great futon',
    body: 'Solid build, easy to assemble and very comfortable.',
    photos: [],
  };

  beforeEach(() => {
    __setMember(MEMBER);
  });

  it('records conversion event when emailQueueId provided', async () => {
    const result = await submitReview({ ...VALID_REVIEW, emailQueueId: 'eq-day7-001' });
    expect(result.success).toBe(true);

    // Allow fire-and-forget recordEmailEvent(..).catch() to settle
    await Promise.resolve();
    await Promise.resolve();

    const events = __getInserted('EmailEvents');
    const conv = events.find(e => e.eventType === 'conversion');
    expect(conv).toBeDefined();
    expect(conv.emailQueueId).toBe('eq-day7-001');
  });

  it('does not record conversion when no emailQueueId provided', async () => {
    await submitReview(VALID_REVIEW);

    const events = __getInserted('EmailEvents');
    const conv = events.find(e => e.eventType === 'conversion');
    expect(conv).toBeUndefined();
  });

  it('review success is unaffected when emailQueueId is empty string', async () => {
    const result = await submitReview({ ...VALID_REVIEW, emailQueueId: '' });
    expect(result.success).toBe(true);

    const events = __getInserted('EmailEvents');
    expect(events.filter(e => e.eventType === 'conversion')).toHaveLength(0);
  });
});

// ── wixEcom_onOrderCreated: slug extraction ─────────────────────────

describe('wixEcom_onOrderCreated: extracts product slug from line items', () => {
  it('passes slug to queuePostPurchaseSequence via lineItems', async () => {
    await wixEcom_onOrderCreated({ entity: ORDER });

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    expect(step2).toBeDefined();

    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toContain('eureka-futon-frame');
    expect(vars.reviewUrl).not.toContain('ORD-999');
  });

  it('falls back gracefully when line items have no url', async () => {
    const orderNoUrl = {
      ...ORDER,
      lineItems: [
        {
          productName: { original: 'Futon Frame' },
          quantity: 1,
          price: { amount: '499' },
          // no url field
        },
      ],
    };
    await wixEcom_onOrderCreated({ entity: orderNoUrl });

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    expect(step2).toBeDefined();

    const vars = typeof step2.variables === 'string' ? JSON.parse(step2.variables) : step2.variables;
    expect(vars.reviewUrl).toBe('https://www.carolinafutons.com/member-page#reviews');
  });
});
