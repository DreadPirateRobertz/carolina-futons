/**
 * rewardEngine.test.js
 * CF-c6el.2 — Tier perk auto-delivery on promotion
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
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

const mockEmailMember = vi.fn(async () => {});
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: (...args) => mockEmailMember(...args) },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

const { deliverTierPerks, getMemberDeliveredPerks } = await import(
  '../src/backend/rewardEngine.web.js'
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deliverTierPerks', () => {
  beforeEach(() => {
    mockItems.length = 0;
    mockInsert.mockClear();
    mockEmailMember.mockClear();
  });

  it('returns empty when memberId is falsy', async () => {
    const result = await deliverTierPerks(null, 'Trail Blazer', 'Mountain Guide');
    expect(result).toEqual({ delivered: [], skipped: [] });
  });

  it('returns empty when newTier is falsy', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', null);
    expect(result).toEqual({ delivered: [], skipped: [] });
  });

  it('delivers new perks on Trail Blazer → Mountain Guide', async () => {
    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    // New perks: ACCESSORY_DISCOUNT (coupon), PRIORITY_SUPPORT (flag)
    expect(result.delivered).toHaveLength(2);
    const types = result.delivered.map(d => d.type);
    expect(types).toContain('ACCESSORY_DISCOUNT');
    expect(types).toContain('PRIORITY_SUPPORT');
    // ACCESSORY_DISCOUNT should have a coupon code
    const accessory = result.delivered.find(d => d.type === 'ACCESSORY_DISCOUNT');
    expect(accessory.couponCode).toMatch(/^CF-[A-Z0-9]{8}$/);
  });

  it('inserts delivery records with computed _id for dedup', async () => {
    await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(mockInsert).toHaveBeenCalledWith(
      'TierPerkDeliveries',
      expect.objectContaining({ _id: 'm1_ACCESSORY_DISCOUNT', memberId: 'm1' }),
      { suppressAuth: true }
    );
  });

  it('sends tier perk email after delivery', async () => {
    await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(mockEmailMember).toHaveBeenCalledWith(
      'tier_perk_unlock',
      'm1',
      expect.objectContaining({
        variables: expect.objectContaining({ tierName: 'Mountain Guide' }),
      })
    );
  });

  it('skips already-delivered perks (idempotent)', async () => {
    // Pre-populate as if ACCESSORY_DISCOUNT was already delivered
    mockItems.push({ _id: 'm1_ACCESSORY_DISCOUNT', memberId: 'm1', perkType: 'ACCESSORY_DISCOUNT' });

    const result = await deliverTierPerks('m1', 'Trail Blazer', 'Mountain Guide');
    expect(result.skipped).toContain('ACCESSORY_DISCOUNT');
    // Only PRIORITY_SUPPORT should be delivered
    expect(result.delivered).toHaveLength(1);
    expect(result.delivered[0].type).toBe('PRIORITY_SUPPORT');
  });

  it('handles duplicate insert gracefully (race condition)', async () => {
    // First call succeeds, second gets duplicate error
    mockInsert.mockImplementationOnce(async (_coll, record) => {
      mockItems.push(record);
      return record;
    }).mockImplementationOnce(async () => {
      throw new Error('duplicate key: already exists');
    });

    const result = await deliverTierPerks('m2', 'Trail Blazer', 'Mountain Guide');
    // First perk delivered, second skipped due to race
    expect(result.delivered.length + result.skipped.length).toBe(2);
  });

  it('delivers styling call with booking URL for Summit Master', async () => {
    const result = await deliverTierPerks('m1', 'Mountain Guide', 'Summit Master');
    const styling = result.delivered.find(d => d.type === 'STYLING_CALL');
    expect(styling).toBeDefined();
    expect(styling.bookingUrl).toContain('calendly.com');
  });

  it('Summit Master → Blue Ridge Legend delivers nothing (same perks)', async () => {
    const result = await deliverTierPerks('m1', 'Summit Master', 'Blue Ridge Legend');
    expect(result.delivered).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('does not send email when no perks are delivered', async () => {
    await deliverTierPerks('m1', 'Summit Master', 'Blue Ridge Legend');
    expect(mockEmailMember).not.toHaveBeenCalled();
  });
});

describe('getMemberDeliveredPerks', () => {
  beforeEach(() => {
    mockItems.length = 0;
  });

  it('returns empty array for no deliveries', async () => {
    const result = await getMemberDeliveredPerks('m1');
    // mockQuery returns mockItems which is empty
    expect(result).toEqual([]);
  });

  it('returns empty array for falsy memberId', async () => {
    const result = await getMemberDeliveredPerks(null);
    expect(result).toEqual([]);
  });
});
