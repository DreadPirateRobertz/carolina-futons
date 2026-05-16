import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock errorHandler ─────────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

// ── Mock wix-web-module ───────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_, fn) => fn,
}));

// ── Mock wix-members-backend ──────────────────────────────────────────────

const { mockGetMember } = vi.hoisted(() => ({ mockGetMember: vi.fn() }));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: mockGetMember },
}));

// ── Mock sanitize ─────────────────────────────────────────────────────────

const { mockSanitize } = vi.hoisted(() => ({ mockSanitize: vi.fn() }));
vi.mock('backend/utils/sanitize', () => ({
  sanitize: mockSanitize,
  validateSlug: vi.fn((s) => (typeof s === 'string' && s.trim() ? s.trim() : null)),
  validateId: vi.fn((s, max) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : null)),
  validateEmail: vi.fn((s) => (typeof s === 'string' && s.includes('@') ? s : null)),
}));

// ── wix-data mock ─────────────────────────────────────────────────────────

import { __reset as resetData, __seed, __setQueryError } from './__mocks__/wix-data.js';

// ── SUT imports ───────────────────────────────────────────────────────────

import { auditCatalog } from '../src/backend/pinterestCatalogSync.web.js';
import { getProductPinData } from '../src/backend/pinterestRichPins.web.js';
import { getRecentPointsHistory } from '../src/backend/pointsHistoryService.web.js';
import { checkMembershipStatus } from '../src/backend/premiumMembership.web.js';
import { getSubscribers } from '../src/backend/priceAlertService.web.js';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  vi.clearAllMocks();
  // Default: sanitize passthrough
  mockSanitize.mockImplementation((str, max = 1000) =>
    typeof str === 'string' ? str.trim().slice(0, max) : ''
  );
  // Default: authenticated member
  mockGetMember.mockResolvedValue({ _id: 'mem-test' });
});

// ════════════════════════════════════════════════════════════════════
// pinterestCatalogSync
// ════════════════════════════════════════════════════════════════════

describe('pinterestCatalogSync — logError on catch paths', () => {
  it('calls logError when Stores/Products query fails in auditCatalog', async () => {
    __setQueryError('Stores/Products', new Error('db error'));
    const r = await auditCatalog();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[pinterestCatalogSync]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// pinterestRichPins
// ════════════════════════════════════════════════════════════════════

describe('pinterestRichPins — logError on catch paths', () => {
  it('calls logError when sanitize throws in getProductPinData', async () => {
    mockSanitize.mockImplementationOnce(() => { throw new Error('sanitize crash'); });
    const r = await getProductPinData({ name: 'Test Futon', price: 499 });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[pinterestRichPins]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// pointsHistoryService
// ════════════════════════════════════════════════════════════════════

describe('pointsHistoryService — logError on catch paths', () => {
  it('calls logError when PointsTransactions query fails in getRecentPointsHistory', async () => {
    __setQueryError('PointsTransactions', new Error('db error'));
    const r = await getRecentPointsHistory('mem-test');
    expect(r).toMatchObject({ error: expect.any(String) });
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[pointsHistoryService]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// premiumMembership
// ════════════════════════════════════════════════════════════════════

describe('premiumMembership — logError on catch paths', () => {
  it('calls logError when PremiumMemberships query fails in checkMembershipStatus', async () => {
    __setQueryError('PremiumMemberships', new Error('db error'));
    const r = await checkMembershipStatus();
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[premiumMembership]'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// priceAlertService
// ════════════════════════════════════════════════════════════════════

describe('priceAlertService — logError on catch paths', () => {
  it('calls logError when PriceAlerts query fails in getSubscribers', async () => {
    __setQueryError('PriceAlerts', new Error('db error'));
    const r = await getSubscribers('prod-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('[priceAlertService]'),
      expect.any(Error),
    );
  });
});
