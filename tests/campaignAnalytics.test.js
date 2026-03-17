/**
 * @file campaignAnalytics.test.js
 * @description Tests for campaign analytics dashboard endpoint:
 * - Email send/open/click rates per campaign
 * - Sequence completion rates
 * - Unsubscribe rate trending
 * - A/B test results summary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockFind, mockQuery } = vi.hoisted(() => {
  const mockFind = vi.fn().mockResolvedValue({ items: [] });
  const mockInsert = vi.fn().mockResolvedValue({ _id: 'mock-id' });
  const mockUpdate = vi.fn().mockResolvedValue({});
  const mockQuery = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    ge: vi.fn().mockReturnThis(),
    le: vi.fn().mockReturnThis(),
    ne: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    find: mockFind,
  }));
  return { mockInsert, mockUpdate, mockFind, mockQuery };
});

vi.mock('wix-data', () => ({
  default: {
    query: mockQuery,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn().mockResolvedValue({}) },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn().mockResolvedValue('TEST-SECRET'),
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, _max) => (str || '').replace(/<[^>]*>/g, ''),
  validateEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
}));

import {
  getCampaignAnalytics,
} from '../src/backend/emailAutomation.web.js';

function makeChain(findResult = { items: [] }) {
  const chain = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ge = vi.fn().mockReturnValue(chain);
  chain.le = vi.fn().mockReturnValue(chain);
  chain.ne = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.descending = vi.fn().mockReturnValue(chain);
  chain.find = vi.fn().mockResolvedValue(findResult);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockResolvedValue({ items: [] });
});

// ── getCampaignAnalytics ─────────────────────────────────────────────

describe('getCampaignAnalytics', () => {
  it('returns per-campaign send/open/click rates', async () => {
    const emailItems = [
      { _id: 'e1', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', abVariant: 'A', recipientEmail: 'a@t.com' },
      { _id: 'e2', sequenceType: 'welcome', sequenceStep: 2, status: 'sent', abVariant: null, recipientEmail: 'a@t.com' },
      { _id: 'e3', sequenceType: 'welcome', sequenceStep: 3, status: 'sent', abVariant: null, recipientEmail: 'a@t.com' },
      { _id: 'e4', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', abVariant: 'B', recipientEmail: 'b@t.com' },
      { _id: 'e5', sequenceType: 'cart_recovery', sequenceStep: 1, status: 'sent', abVariant: null, recipientEmail: 'c@t.com' },
      { _id: 'e6', sequenceType: 'cart_recovery', sequenceStep: 1, status: 'failed', abVariant: null, recipientEmail: 'd@t.com' },
    ];
    const eventItems = [
      { emailQueueId: 'e1', eventType: 'open' },
      { emailQueueId: 'e1', eventType: 'click' },
      { emailQueueId: 'e2', eventType: 'open' },
      { emailQueueId: 'e5', eventType: 'open' },
    ];
    const unsubItems = [
      { email: 'x@t.com', sequenceType: 'all', unsubscribedAt: new Date() },
    ];
    const abTests = [
      { _id: 'ab1', sequenceType: 'welcome', status: 'active', testStep: 1, variantA: { subjectLine: 'A' }, variantB: { subjectLine: 'B' } },
    ];

    mockQuery.mockImplementation((collection) => {
      const data = {
        EmailQueue: emailItems,
        EmailEvents: eventItems,
        Unsubscribes: unsubItems,
        AbTests: abTests,
      };
      return makeChain({ items: data[collection] || [] });
    });

    const result = await getCampaignAnalytics(30);

    expect(result.success).toBe(true);
    expect(result.campaigns.welcome).toBeDefined();
    expect(result.campaigns.welcome.sent).toBe(4);
    expect(result.campaigns.welcome.opens).toBe(2);
    expect(result.campaigns.cart_recovery).toBeDefined();
    expect(result.campaigns.cart_recovery.sent).toBe(1);
    expect(result.campaigns.cart_recovery.failed).toBe(1);
  });

  it('calculates sequence completion rates', async () => {
    const emailItems = [
      { _id: 'w1', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', recipientEmail: 'a@t.com' },
      { _id: 'w2', sequenceType: 'welcome', sequenceStep: 2, status: 'sent', recipientEmail: 'a@t.com' },
      { _id: 'w3', sequenceType: 'welcome', sequenceStep: 3, status: 'sent', recipientEmail: 'a@t.com' },
      { _id: 'w4', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', recipientEmail: 'b@t.com' },
      { _id: 'w5', sequenceType: 'welcome', sequenceStep: 2, status: 'cancelled', recipientEmail: 'b@t.com' },
    ];

    mockQuery.mockImplementation((collection) =>
      makeChain({ items: collection === 'EmailQueue' ? emailItems : [] })
    );

    const result = await getCampaignAnalytics(30);

    expect(result.completionRates).toBeDefined();
    expect(result.completionRates.welcome).toBeDefined();
    expect(result.completionRates.welcome.entered).toBe(2);
    expect(result.completionRates.welcome.completed).toBe(1);
    expect(result.completionRates.welcome.rate).toBeCloseTo(0.5, 1);
  });

  it('includes unsubscribe rate trending', async () => {
    const unsubItems = [
      { email: 'a@t.com', sequenceType: 'all', unsubscribedAt: new Date() },
      { email: 'b@t.com', sequenceType: 'welcome', unsubscribedAt: new Date() },
      { email: 'c@t.com', sequenceType: 'cart_recovery', unsubscribedAt: new Date() },
    ];

    mockQuery.mockImplementation((collection) =>
      makeChain({ items: collection === 'Unsubscribes' ? unsubItems : [] })
    );

    const result = await getCampaignAnalytics(30);

    expect(result.unsubscribes).toBeDefined();
    expect(result.unsubscribes.total).toBe(3);
    expect(result.unsubscribes.byType.all).toBe(1);
    expect(result.unsubscribes.byType.welcome).toBe(1);
  });

  it('includes A/B test results summary', async () => {
    const abTests = [
      { _id: 'ab1', sequenceType: 'welcome', status: 'resolved', winner: 'B', variantARate: 0.25, variantBRate: 0.42, testStep: 1 },
    ];

    mockQuery.mockImplementation((collection) =>
      makeChain({ items: collection === 'AbTests' ? abTests : [] })
    );

    const result = await getCampaignAnalytics(30);

    expect(result.abTestSummary).toHaveLength(1);
    expect(result.abTestSummary[0].winner).toBe('B');
    expect(result.abTestSummary[0].sequenceType).toBe('welcome');
  });

  it('returns empty data for zero-activity period', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getCampaignAnalytics(30);

    expect(result.success).toBe(true);
    expect(result.campaigns).toEqual({});
    expect(result.unsubscribes.total).toBe(0);
    expect(result.abTestSummary).toHaveLength(0);
  });

  it('defaults to 30-day lookback window', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getCampaignAnalytics();
    expect(result.success).toBe(true);
  });

  it('handles wixData errors gracefully', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('Database unavailable');
    });

    const result = await getCampaignAnalytics(30);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Database unavailable');
    expect(result.campaigns).toBeUndefined();
  });

  it('clamps days to valid range (1–365)', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const tooLow = await getCampaignAnalytics(0);
    expect(tooLow.periodDays).toBe(1);

    const tooHigh = await getCampaignAnalytics(9999);
    expect(tooHigh.periodDays).toBe(365);

    const negative = await getCampaignAnalytics(-5);
    expect(negative.periodDays).toBe(1);
  });

  it('handles NaN days by defaulting to 30', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getCampaignAnalytics('not-a-number');
    expect(result.periodDays).toBe(30);
  });
});

// ── Dashboard Endpoint Shape ─────────────────────────────────────────

describe('Campaign analytics response shape', () => {
  it('has all required top-level fields', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getCampaignAnalytics(30);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('campaigns');
    expect(result).toHaveProperty('completionRates');
    expect(result).toHaveProperty('unsubscribes');
    expect(result).toHaveProperty('abTestSummary');
    expect(result).toHaveProperty('periodDays');
  });

  it('campaign entry has correct shape', async () => {
    const emailItems = [
      { _id: 'e1', sequenceType: 'welcome', sequenceStep: 1, status: 'sent', recipientEmail: 'a@t.com' },
    ];

    mockQuery.mockImplementation((collection) =>
      makeChain({ items: collection === 'EmailQueue' ? emailItems : [] })
    );

    const result = await getCampaignAnalytics(30);

    const welcome = result.campaigns.welcome;
    expect(welcome).toHaveProperty('sent');
    expect(welcome).toHaveProperty('failed');
    expect(welcome).toHaveProperty('cancelled');
    expect(welcome).toHaveProperty('pending');
    expect(welcome).toHaveProperty('opens');
    expect(welcome).toHaveProperty('clicks');
    expect(welcome).toHaveProperty('openRate');
    expect(welcome).toHaveProperty('clickRate');
  });
});
