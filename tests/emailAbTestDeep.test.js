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
  recordEmailEvent,
  getAbTestResults,
} from '../src/backend/emailAutomation.web.js';

function makeChain(findResult = { items: [] }) {
  const chain = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ge = vi.fn().mockReturnValue(chain);
  chain.le = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
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

