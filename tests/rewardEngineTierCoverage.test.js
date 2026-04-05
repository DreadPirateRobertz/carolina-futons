/**
 * @file rewardEngineTierCoverage.test.js
 * @description Coverage gaps for deliverTierPerks — all tier transitions,
 * delivery-type handling, and edge cases. CF-c6el.2.
 *
 * Complements rewardEngine.test.js (happy-path Trail Blazer → Mountain Guide)
 * and rewardEngineHardening.test.js (validateId guards).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

const mockEmailMember = vi.fn(async () => {});
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: (...args) => mockEmailMember(...args) },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'm1' })) },
}));

const { deliverTierPerks } = await import('../src/backend/rewardEngine.web.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function reset() {
  mockItems.length = 0;
  mockInsert.mockClear();
  mockEmailMember.mockClear();
  mockQuery.mockClear();
}

beforeEach(reset);

// ── null → Trail Blazer (new member, first tier unlock) ───────────────────────

describe('deliverTierPerks — null → Trail Blazer (new member)', () => {
  it('delivers BIRTHDAY_DISCOUNT perk for new member entering Trail Blazer', async () => {
    const result = await deliverTierPerks('m1', null, 'Trail Blazer');
    expect(result.delivered).toHaveLength(1);
    expect(result.delivered[0].type).toBe('BIRTHDAY_DISCOUNT');
  });

  it('generates a coupon code for BIRTHDAY_DISCOUNT (coupon_email delivery)', async () => {
    const result = await deliverTierPerks('m1', null, 'Trail Blazer');
    expect(result.delivered[0].couponCode).toMatch(/^CF-[A-Z0-9]{8}$/);
  });

  it('inserts delivery record with correct _id and tier', async () => {
    await deliverTierPerks('m1', null, 'Trail Blazer');
    expect(mockInsert).toHaveBeenCalledWith(
      'TierPerkDeliveries',
      expect.objectContaining({
        _id: 'm1_BIRTHDAY_DISCOUNT',
        memberId: 'm1',
        tier: 'Trail Blazer',
      }),
      { suppressAuth: true }
    );
  });

  it('sends tier perk email on first-tier entry', async () => {
    await deliverTierPerks('m1', null, 'Trail Blazer');
    expect(mockEmailMember).toHaveBeenCalledWith(
      'tier_perk_unlock',
      'm1',
      expect.objectContaining({
        variables: expect.objectContaining({ tierName: 'Trail Blazer' }),
      })
    );
  });
});

// ── null → Mountain Guide (skip Trail Blazer) ────────────────────────────────

describe('deliverTierPerks — null → Mountain Guide', () => {
  it('delivers all 3 Mountain Guide perks when entering from no prior tier', async () => {
    const result = await deliverTierPerks('m1', null, 'Mountain Guide');
    const types = result.delivered.map(d => d.type);
    expect(types).toContain('BIRTHDAY_DISCOUNT');
    expect(types).toContain('ACCESSORY_DISCOUNT');
    expect(types).toContain('PRIORITY_SUPPORT');
  });
});

// ── Trail Blazer → Summit Master (tier skip) ──────────────────────────────────

describe('deliverTierPerks — Trail Blazer → Summit Master (tier skip)', () => {
  it('delivers all Mountain Guide + Summit Master new perks', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Summit Master');
    const types = result.delivered.map(d => d.type);
    expect(types).toContain('ACCESSORY_DISCOUNT');
    expect(types).toContain('PRIORITY_SUPPORT');
    expect(types).toContain('FREE_WHITE_GLOVE');
    expect(types).toContain('EARLY_ACCESS');
    expect(types).toContain('STYLING_CALL');
  });

  it('does not re-deliver BIRTHDAY_DISCOUNT already in Trail Blazer', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Summit Master');
    const types = result.delivered.map(d => d.type);
    expect(types).not.toContain('BIRTHDAY_DISCOUNT');
  });

  it('includes booking URL for STYLING_CALL', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Summit Master');
    const styling = result.delivered.find(d => d.type === 'STYLING_CALL');
    expect(styling?.bookingUrl).toContain('calendly.com');
  });
});

// ── Mountain Guide → Blue Ridge Legend (skipping Summit Master) ───────────────

describe('deliverTierPerks — Mountain Guide → Blue Ridge Legend', () => {
  it('delivers Summit Master perks on skip to Blue Ridge Legend', async () => {
    const result = await deliverTierPerks('m1', 'Mountain Guide', 'Blue Ridge Legend');
    const types = result.delivered.map(d => d.type);
    expect(types).toContain('FREE_WHITE_GLOVE');
    expect(types).toContain('EARLY_ACCESS');
    expect(types).toContain('STYLING_CALL');
  });
});

// ── Same-tier no-op ───────────────────────────────────────────────────────────

describe('deliverTierPerks — same tier (no promotion)', () => {
  it('delivers nothing when prevTier equals newTier', async () => {
    const result = await deliverTierPerks('m1', 'Mountain Guide', 'Mountain Guide');
    expect(result.delivered).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('does not send email when there is no promotion', async () => {
    await deliverTierPerks('m1', 'Mountain Guide', 'Mountain Guide');
    expect(mockEmailMember).not.toHaveBeenCalled();
  });
});

// ── Unknown / invalid tier ────────────────────────────────────────────────────

describe('deliverTierPerks — unknown tier names', () => {
  it('delivers nothing for an unknown newTier', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Unknown Tier XYZ');
    expect(result.delivered).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('treats unknown prevTier same as null (all newTier perks are new)', async () => {
    const result = await deliverTierPerks('m1', 'Unknown Prev Tier', 'Trail Blazer');
    // Unknown prev → TIER_PERKS[unknown] = [] → all Trail Blazer perks are new
    expect(result.delivered).toHaveLength(1);
    expect(result.delivered[0].type).toBe('BIRTHDAY_DISCOUNT');
  });
});

// ── Delivery type: flag (no coupon, no bookingUrl) ────────────────────────────

describe('deliverTierPerks — flag delivery type (PRIORITY_SUPPORT)', () => {
  it('delivers PRIORITY_SUPPORT without a couponCode', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    const support = result.delivered.find(d => d.type === 'PRIORITY_SUPPORT');
    expect(support).toBeDefined();
    expect(support.couponCode).toBeUndefined();
  });

  it('delivers PRIORITY_SUPPORT without a bookingUrl', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    const support = result.delivered.find(d => d.type === 'PRIORITY_SUPPORT');
    expect(support.bookingUrl).toBeUndefined();
  });
});

// ── Delivery type: shipping_rule (FREE_WHITE_GLOVE) ───────────────────────────

describe('deliverTierPerks — shipping_rule delivery type (FREE_WHITE_GLOVE)', () => {
  it('delivers FREE_WHITE_GLOVE without a couponCode', async () => {
    const result = await deliverTierPerks('m1', 'Mountain Guide', 'Summit Master');
    const wg = result.delivered.find(d => d.type === 'FREE_WHITE_GLOVE');
    expect(wg).toBeDefined();
    expect(wg.couponCode).toBeUndefined();
  });

  it('delivers FREE_WHITE_GLOVE without a bookingUrl', async () => {
    const result = await deliverTierPerks('m1', 'Mountain Guide', 'Summit Master');
    const wg = result.delivered.find(d => d.type === 'FREE_WHITE_GLOVE');
    expect(wg.bookingUrl).toBeUndefined();
  });
});

// ── Email failure is non-fatal ────────────────────────────────────────────────

describe('deliverTierPerks — email failure does not block delivery', () => {
  it('returns delivered perks even when email throws', async () => {
    mockEmailMember.mockRejectedValueOnce(new Error('email service down'));
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(result.delivered).toHaveLength(2);
    expect(result.failed).toEqual([]);
  });
});

// ── Blue Ridge Legend same perks as Summit Master (already covered, guard) ────

describe('deliverTierPerks — Summit Master → Blue Ridge Legend (confirmed no-op)', () => {
  it('skips all perks already delivered at Summit Master level', async () => {
    // Pre-load all Summit Master perks as already delivered
    const smPerks = ['BIRTHDAY_DISCOUNT', 'ACCESSORY_DISCOUNT', 'PRIORITY_SUPPORT',
                     'FREE_WHITE_GLOVE', 'EARLY_ACCESS', 'STYLING_CALL'];
    for (const perkType of smPerks) {
      mockItems.push({ _id: `m1_${perkType}`, memberId: 'm1', perkType });
    }
    const result = await deliverTierPerks('m1', 'Summit Master', 'Blue Ridge Legend');
    expect(result.delivered).toEqual([]);
    expect(result.skipped).toHaveLength(0); // same perks → nothing to skip either
  });
});
