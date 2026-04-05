/**
 * rewardEngineHardening.test.js
 * CF-znpj — validateId guard on deliverTierPerks (mobile edge case: invalid memberId).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockItems = [];
const mockInsert = vi.fn(async (_coll, record) => {
  if (mockItems.find(i => i._id === record._id)) {
    throw new Error('duplicate key: already exists');
  }
  mockItems.push(record);
  return record;
});
const mockQuery = vi.fn(() => ({
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: [...mockItems] })),
}));

vi.mock('wix-data', () => ({
  default: {
    insert: (...args) => mockInsert(...args),
    query: (...args) => mockQuery(...args),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const c = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(c) ? c : '';
  },
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLen);
  },
}));

const mockEmailMember = vi.fn(async () => {});
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: (...args) => mockEmailMember(...args) },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'm1' })) },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { deliverTierPerks, getMemberDeliveredPerks } = await import(
  '../src/backend/rewardEngine.web.js'
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deliverTierPerks — validateId guard (CF-znpj hardening)', () => {
  beforeEach(() => {
    mockItems.length = 0;
    mockInsert.mockClear();
    mockEmailMember.mockClear();
    mockQuery.mockClear();
  });

  it('returns empty for null memberId (mobile: unauthenticated call)', async () => {
    const result = await deliverTierPerks(null, null, 'Mountain Guide');
    expect(result).toEqual({ delivered: [], skipped: [], failed: [] });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns empty for path-traversal memberId', async () => {
    const result = await deliverTierPerks('../../etc/passwd', null, 'Mountain Guide');
    expect(result).toEqual({ delivered: [], skipped: [], failed: [] });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns empty for script-injection memberId', async () => {
    const result = await deliverTierPerks('<script>alert(1)</script>', null, 'Mountain Guide');
    expect(result).toEqual({ delivered: [], skipped: [], failed: [] });
  });

  it('returns empty when newTier is missing', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', null);
    expect(result).toEqual({ delivered: [], skipped: [], failed: [] });
  });

  it('uses sanitized cleanId in insert record _id (not raw memberId)', async () => {
    await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(mockInsert).toHaveBeenCalledWith(
      'TierPerkDeliveries',
      expect.objectContaining({ _id: 'm1_ACCESSORY_DISCOUNT', memberId: 'm1' }),
      { suppressAuth: true }
    );
  });

  it('delivers perks for valid memberId (existing behaviour preserved)', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(result.delivered).toHaveLength(2);
    expect(result.delivered.map(d => d.type)).toContain('ACCESSORY_DISCOUNT');
  });
});
