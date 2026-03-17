/**
 * @file emailAbTestDeep.test.js
 * @description Deep tests for extended A/B testing:
 * - Subject line variant support across sequences
 * - Send-time variant support
 * - Auto-winner selection based on open rates
 * - Variant result storage/retrieval
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock fns so vi.mock factory can reference them
const { mockInsert, mockUpdate, mockFind, mockQuery } = vi.hoisted(() => {
  const mockFind = vi.fn().mockResolvedValue({ items: [] });
  const mockInsert = vi.fn().mockResolvedValue({ _id: 'mock-id' });
  const mockUpdate = vi.fn().mockResolvedValue({});
  const mockQuery = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    ge: vi.fn().mockReturnThis(),
    le: vi.fn().mockReturnThis(),
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
  _selectABVariant,
  _SEQUENCES,
  getEmailAutomationStats,
  recordEmailEvent,
  getEmailEvents,
  createAbTest,
  resolveAbTestWinner,
  getAbTestResults,
  getAbTestConfig,
} from '../src/backend/emailAutomation.web.js';

function makeChain(findResult = { items: [] }) {
  const chain = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ge = vi.fn().mockReturnValue(chain);
  chain.le = vi.fn().mockReturnValue(chain);
  chain.find = vi.fn().mockResolvedValue(findResult);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockResolvedValue({ items: [] });
});

// ── selectABVariant ──────────────────────────────────────────────────

describe('selectABVariant', () => {
  it('returns A or B for any email', () => {
    const result = _selectABVariant('test@example.com');
    expect(['A', 'B']).toContain(result);
  });

  it('is deterministic — same email always gets same variant', () => {
    const a = _selectABVariant('repeat@test.com');
    const b = _selectABVariant('repeat@test.com');
    expect(a).toBe(b);
  });

  it('distributes across A and B for different emails', () => {
    const variants = new Set();
    for (let i = 0; i < 20; i++) {
      variants.add(_selectABVariant(`user${i}@test.com`));
    }
    expect(variants.size).toBe(2);
  });

  it('handles empty email gracefully', () => {
    const result = _selectABVariant('');
    expect(['A', 'B']).toContain(result);
  });
});

// ── Sequence A/B config ──────────────────────────────────────────────

describe('A/B test configuration', () => {
  it('welcome sequence has A/B variants defined', () => {
    expect(_SEQUENCES.welcome.abVariants).toBeDefined();
    expect(_SEQUENCES.welcome.abVariants.A).toBeDefined();
    expect(_SEQUENCES.welcome.abVariants.B).toBeDefined();
  });

  it('welcome A/B variants have subject lines', () => {
    expect(_SEQUENCES.welcome.abVariants.A.subjectLine).toBeTruthy();
    expect(_SEQUENCES.welcome.abVariants.B.subjectLine).toBeTruthy();
  });

  it('A and B subject lines are different', () => {
    expect(_SEQUENCES.welcome.abVariants.A.subjectLine)
      .not.toBe(_SEQUENCES.welcome.abVariants.B.subjectLine);
  });

  it('abTestStep references a valid step number', () => {
    const validSteps = _SEQUENCES.welcome.steps.map(s => s.step);
    expect(validSteps).toContain(_SEQUENCES.welcome.abTestStep);
  });
});

// ── createAbTest ─────────────────────────────────────────────────────

describe('createAbTest', () => {
  it('creates an A/B test config with subject line variants', async () => {
    const result = await createAbTest({
      sequenceType: 'cart_recovery',
      testStep: 1,
      variants: {
        A: { subjectLine: 'You left something behind!' },
        B: { subjectLine: 'Your cart is waiting, {firstName}' },
      },
      sampleSize: 200,
      metricField: 'openRate',
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      'AbTests',
      expect.objectContaining({
        sequenceType: 'cart_recovery',
        testStep: 1,
        status: 'active',
        sampleSize: 200,
        metricField: 'openRate',
      })
    );
  });

  it('creates an A/B test with send-time variants', async () => {
    const result = await createAbTest({
      sequenceType: 'welcome',
      testStep: 1,
      variants: {
        A: { sendTimeOffset: 0 },
        B: { sendTimeOffset: 4 },
      },
      sampleSize: 100,
      metricField: 'openRate',
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      'AbTests',
      expect.objectContaining({
        variantA: expect.objectContaining({ sendTimeOffset: 0 }),
        variantB: expect.objectContaining({ sendTimeOffset: 4 }),
      })
    );
  });

  it('rejects test with missing sequenceType', async () => {
    const result = await createAbTest({
      testStep: 1,
      variants: { A: { subjectLine: 'X' }, B: { subjectLine: 'Y' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects test with missing variants', async () => {
    const result = await createAbTest({
      sequenceType: 'welcome',
      testStep: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects test with only one variant', async () => {
    const result = await createAbTest({
      sequenceType: 'welcome',
      testStep: 1,
      variants: { A: { subjectLine: 'Only one' } },
    });
    expect(result.success).toBe(false);
  });

  it('defaults sampleSize to 100 when not specified', async () => {
    const result = await createAbTest({
      sequenceType: 'welcome',
      testStep: 1,
      variants: {
        A: { subjectLine: 'X' },
        B: { subjectLine: 'Y' },
      },
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      'AbTests',
      expect.objectContaining({ sampleSize: 100 })
    );
  });

  it('defaults metricField to openRate when not specified', async () => {
    const result = await createAbTest({
      sequenceType: 'welcome',
      testStep: 1,
      variants: { A: { subjectLine: 'X' }, B: { subjectLine: 'Y' } },
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      'AbTests',
      expect.objectContaining({ metricField: 'openRate' })
    );
  });
});

// ── resolveAbTestWinner ──────────────────────────────────────────────

describe('resolveAbTestWinner', () => {
  it('selects variant with higher open rate as winner', async () => {
    const mockTest = {
      _id: 'test-123',
      sequenceType: 'welcome',
      testStep: 1,
      status: 'active',
      sampleSize: 10,
      metricField: 'openRate',
      variantA: { subjectLine: 'Welcome A' },
      variantB: { subjectLine: 'Welcome B' },
    };

    const variantAItems = Array.from({ length: 10 }, (_, i) => ({
      _id: `a-${i}`, abVariant: 'A', status: 'sent', recipientEmail: `a${i}@test.com`,
    }));
    const variantBItems = Array.from({ length: 10 }, (_, i) => ({
      _id: `b-${i}`, abVariant: 'B', status: 'sent', recipientEmail: `b${i}@test.com`,
    }));

    const aOpenEvents = Array.from({ length: 3 }, (_, i) => ({
      emailQueueId: `a-${i}`, eventType: 'open',
    }));
    const bOpenEvents = Array.from({ length: 7 }, (_, i) => ({
      emailQueueId: `b-${i}`, eventType: 'open',
    }));

    let emailQueueCallNum = 0;
    mockQuery.mockImplementation((collection) => {
      if (collection === 'AbTests') {
        return makeChain({ items: [mockTest] });
      } else if (collection === 'EmailQueue') {
        emailQueueCallNum++;
        return makeChain({ items: emailQueueCallNum <= 1 ? variantAItems : variantBItems });
      } else if (collection === 'EmailEvents') {
        return makeChain({ items: [...aOpenEvents, ...bOpenEvents] });
      }
      return makeChain();
    });

    const result = await resolveAbTestWinner('test-123');

    expect(result.success).toBe(true);
    expect(result.winner).toBe('B');
    expect(result.variantARate).toBeCloseTo(0.3, 1);
    expect(result.variantBRate).toBeCloseTo(0.7, 1);
  });

  it('returns error for non-existent test', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await resolveAbTestWinner('nonexistent');
    expect(result.success).toBe(false);
  });

  it('returns error for already-resolved test', async () => {
    mockQuery.mockImplementation(() =>
      makeChain({ items: [{ _id: 'resolved-1', status: 'resolved', winner: 'A' }] })
    );

    const result = await resolveAbTestWinner('resolved-1');
    expect(result.success).toBe(false);
  });

  it('does not resolve if sample size not met', async () => {
    const mockTest = {
      _id: 'test-small',
      sequenceType: 'welcome',
      testStep: 1,
      status: 'active',
      sampleSize: 100,
      metricField: 'openRate',
      variantA: { subjectLine: 'A' },
      variantB: { subjectLine: 'B' },
    };

    mockQuery.mockImplementation((collection) => {
      if (collection === 'AbTests') {
        return makeChain({ items: [mockTest] });
      } else if (collection === 'EmailQueue') {
        return makeChain({ items: Array(5).fill({ status: 'sent' }) });
      }
      return makeChain();
    });

    const result = await resolveAbTestWinner('test-small');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/sample/i);
  });
});

// ── getAbTestResults ─────────────────────────────────────────────────

describe('getAbTestResults', () => {
  it('returns summary of all A/B tests', async () => {
    const tests = [
      { _id: 't1', sequenceType: 'welcome', status: 'resolved', winner: 'B', variantARate: 0.3, variantBRate: 0.7 },
      { _id: 't2', sequenceType: 'cart_recovery', status: 'active', winner: null },
    ];

    mockQuery.mockImplementation(() => makeChain({ items: tests }));

    const result = await getAbTestResults();
    expect(result.tests).toHaveLength(2);
    expect(result.tests[0].winner).toBe('B');
    expect(result.tests[1].status).toBe('active');
  });

  it('returns empty array when no tests exist', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getAbTestResults();
    expect(result.tests).toHaveLength(0);
  });
});

// ── getAbTestConfig ──────────────────────────────────────────────────

describe('getAbTestConfig', () => {
  it('returns active test config for a sequence type', async () => {
    const test = {
      _id: 'cfg-1',
      sequenceType: 'welcome',
      testStep: 1,
      status: 'active',
      variantA: { subjectLine: 'Welcome A' },
      variantB: { subjectLine: 'Welcome B' },
    };

    mockQuery.mockImplementation(() => makeChain({ items: [test] }));

    const result = await getAbTestConfig('welcome');
    expect(result.test).toBeDefined();
    expect(result.test.sequenceType).toBe('welcome');
  });

  it('returns null when no active test for sequence', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getAbTestConfig('cart_recovery');
    expect(result.test).toBeNull();
  });
});

// ── recordEmailEvent ─────────────────────────────────────────────────

describe('recordEmailEvent', () => {
  it('records an open event', async () => {
    const result = await recordEmailEvent({
      emailQueueId: 'q-123',
      eventType: 'open',
    });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      'EmailEvents',
      expect.objectContaining({ eventType: 'open', emailQueueId: 'q-123' })
    );
  });

  it('records a click event with URL', async () => {
    const result = await recordEmailEvent({
      emailQueueId: 'q-456',
      eventType: 'click',
      linkUrl: 'https://carolinafutons.com/shop',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing emailQueueId', async () => {
    const result = await recordEmailEvent({ eventType: 'open' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid eventType', async () => {
    const result = await recordEmailEvent({
      emailQueueId: 'q-789',
      eventType: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing eventType', async () => {
    const result = await recordEmailEvent({ emailQueueId: 'q-789' });
    expect(result.success).toBe(false);
  });
});

// ── getEmailEvents ───────────────────────────────────────────────────

describe('getEmailEvents', () => {
  it('returns opens and clicks within timeframe', async () => {
    const events = [
      { _id: 'e1', emailQueueId: 'q1', eventType: 'open', timestamp: new Date() },
      { _id: 'e2', emailQueueId: 'q2', eventType: 'click', linkUrl: '/shop', timestamp: new Date() },
      { _id: 'e3', emailQueueId: 'q3', eventType: 'open', timestamp: new Date() },
    ];

    mockQuery.mockImplementation(() => makeChain({ items: events }));

    const result = await getEmailEvents(undefined, 30);
    expect(result.opens).toBe(2);
    expect(result.clicks).toBe(1);
    expect(result.events).toHaveLength(3);
  });

  it('defaults to 30 days lookback', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getEmailEvents();
    expect(result.opens).toBe(0);
    expect(result.clicks).toBe(0);
  });
});

// ── getEmailAutomationStats ──────────────────────────────────────────

describe('getEmailAutomationStats', () => {
  it('returns stats grouped by sequence type', async () => {
    const items = [
      { sequenceType: 'welcome', status: 'sent', abVariant: 'A' },
      { sequenceType: 'welcome', status: 'sent', abVariant: 'B' },
      { sequenceType: 'welcome', status: 'pending', abVariant: null },
      { sequenceType: 'cart_recovery', status: 'sent', abVariant: null },
      { sequenceType: 'cart_recovery', status: 'failed', abVariant: null },
    ];

    mockQuery.mockImplementation(() => makeChain({ items }));

    const result = await getEmailAutomationStats();
    expect(result.stats.welcome.sent).toBe(2);
    expect(result.stats.welcome.pending).toBe(1);
    expect(result.stats.cart_recovery.sent).toBe(1);
    expect(result.stats.cart_recovery.failed).toBe(1);
    expect(result.abResults.A.sent).toBe(1);
    expect(result.abResults.B.sent).toBe(1);
  });

  it('returns empty stats when no emails exist', async () => {
    mockQuery.mockImplementation(() => makeChain());

    const result = await getEmailAutomationStats();
    expect(result.totalEmails).toBe(0);
  });
});
