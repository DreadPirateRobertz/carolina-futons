import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock errorHandler ─────────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

// ── Mock wix-web-module ───────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_, fn) => fn,
}));

// ── Mock wix-members-backend (challengeService) ───────────────────────────

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn() },
}));

// ── Mock trailPerkService (challengeService) ──────────────────────────────

vi.mock('backend/trailPerkService.web', () => ({
  deliverTrailPerk: vi.fn(),
}));

// ── Mock sanitize ─────────────────────────────────────────────────────────

vi.mock('backend/utils/sanitize', () => ({
  sanitize: vi.fn((str, max = 1000) => (typeof str === 'string' ? str.trim().slice(0, max) : '')),
  validateId: vi.fn((str, max) => (typeof str === 'string' && str.trim() ? str.trim().slice(0, max) : null)),
}));

// ── Mock chatbotContext (chatbotService) ──────────────────────────────────

vi.mock('backend/utils/chatbotContext', () => ({
  buildSystemPrompt: vi.fn(() => 'test-prompt'),
  buildCatalogSummary: vi.fn(() => ''),
  findSuggestedProducts: vi.fn(() => []),
  MAX_CATALOG_PRODUCTS: 50,
}));

// ── Mock wix-stores-backend (chatbotService._fetchProductCatalog) ─────────

vi.mock('wix-stores-backend', () => ({
  products: {
    queryProducts: vi.fn(() => ({
      limit: vi.fn(() => ({ find: vi.fn().mockResolvedValue({ items: [] }) })),
    })),
  },
}));

// ── wix-data / wix-fetch / wix-secrets mocks ─────────────────────────────

import {
  __reset as resetData,
  __seed,
  __setQueryError,
  __setInsertError,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

// ── SUT imports ───────────────────────────────────────────────────────────

import {
  _getTrailProgressForMember,
  getChallengeOfTheWeek,
} from '../src/backend/challengeService.web.js';
import { trackCheckoutStep, getAbandonmentRate } from '../src/backend/checkoutOptimization.web.js';
import { searchProducts } from '../src/backend/categorySearch.web.js';
import { listBundles } from '../src/backend/bundleDeals.web.js';
import { sendMessage } from '../src/backend/chatbotService.web.js';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetFetch();
  resetSecrets();
  vi.clearAllMocks();
  __setSecrets({ CHATBOT_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key' });
  __setHandler(() => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: 'reply' }],
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
  }));
});

// ════════════════════════════════════════════════════════════════════
// challengeService
// ════════════════════════════════════════════════════════════════════

describe('challengeService — logError on catch paths', () => {
  it('calls logError when MemberTrailProgress query fails', async () => {
    __setQueryError('MemberTrailProgress', new Error('db down'));
    const r = await _getTrailProgressForMember('mem-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[challengeService]'),
      expect.any(Error),
    );
  });

  it('calls logError when ChallengeOfTheWeek query fails', async () => {
    __setQueryError('ChallengeOfTheWeek', new Error('timeout'));
    const r = await getChallengeOfTheWeek();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[challengeService]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// checkoutOptimization
// ════════════════════════════════════════════════════════════════════

describe('checkoutOptimization — logError on catch paths', () => {
  it('calls logError when CheckoutAnalytics insert fails in trackCheckoutStep', async () => {
    __setInsertError('CheckoutAnalytics', new Error('insert error'));
    const r = await trackCheckoutStep({ sessionId: 'sess-1', step: 'start', cartTotal: 299, itemCount: 1 });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[checkoutOptimization]'),
      expect.any(Error),
    );
  });

  it('calls logError when CheckoutAnalytics query fails in getAbandonmentRate', async () => {
    __setQueryError('CheckoutAnalytics', new Error('query error'));
    const r = await getAbandonmentRate(7);
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[checkoutOptimization]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// categorySearch
// ════════════════════════════════════════════════════════════════════

describe('categorySearch — logError on catch paths', () => {
  it('calls logError when Stores/Products query fails in searchProducts', async () => {
    __setQueryError('Stores/Products', new Error('query failed'));
    const r = await searchProducts({});
    expect(r.items).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[categorySearch]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// bundleDeals
// ════════════════════════════════════════════════════════════════════

describe('bundleDeals — logError on catch paths', () => {
  it('calls logError when ProductBundle query fails in listBundles', async () => {
    __setQueryError('ProductBundle', new Error('db error'));
    const r = await listBundles();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[bundleDeals]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// chatbotService
// ════════════════════════════════════════════════════════════════════

describe('chatbotService — logError on catch paths', () => {
  it('calls logError when ChatSessions query fails', async () => {
    __setQueryError('ChatSessions', new Error('session db error'));
    const r = await sendMessage('sess-1', 'hello');
    expect(r).toMatchObject({ error: 'assistant_unavailable' });
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[chatbotService]'),
      expect.any(Error),
    );
  });

  it('calls logError on CMS write failure but still returns reply (non-fatal)', async () => {
    __seed('ChatSessions', [{
      _id: 'rec-1',
      sessionId: 'sess-1',
      sessionHistory: '[]',
      messageCount: 0,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    }]);
    __onUpdate((col) => {
      if (col === 'ChatSessions') throw new Error('write failed');
    });
    const r = await sendMessage('sess-1', 'hello');
    expect(r).toHaveProperty('reply');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[chatbotService]'),
      expect.any(Error),
    );
  });
});
