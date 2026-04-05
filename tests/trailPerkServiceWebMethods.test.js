/**
 * @file trailPerkServiceWebMethods.test.js
 * @description CF-mcyh.3 — TDD for trailPerkService webMethod layer:
 *   getAvailableTrailPerks()           [Anyone]
 *   getPublicTrailPerkStatus(memberId) [Anyone]
 *   claimTrailPerk(perkId)             [SiteMember]
 *
 * sanitize(id, 50) applied to all caller-supplied IDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  __reset as resetMembers,
  __setMember,
  __resetMember,
} from './__mocks__/wix-members-backend.js';

import {
  getAvailableTrailPerks,
  getPublicTrailPerkStatus,
  claimTrailPerk,
  _VALID_PERK_IDS,
  _TRAIL_PERKS_COLLECTION,
} from '../src/backend/trailPerkService.web.js';

const COLLECTION = 'MemberTrailPerks';
const MEMBER_ID = 'mem-trail-001';

beforeEach(() => {
  resetData();
  resetMembers();
  vi.clearAllMocks();
});

// ── getAvailableTrailPerks [Anyone] ──────────────────────────────────────────

describe('getAvailableTrailPerks', () => {
  it('returns a list of available perk IDs', async () => {
    const result = await getAvailableTrailPerks();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.perks)).toBe(true);
    expect(result.perks.length).toBeGreaterThan(0);
  });

  it('each perk has an id field', async () => {
    const result = await getAvailableTrailPerks();
    for (const perk of result.perks) {
      expect(perk).toHaveProperty('id');
      expect(typeof perk.id).toBe('string');
    }
  });

  it('all returned perk IDs are valid', async () => {
    const result = await getAvailableTrailPerks();
    for (const perk of result.perks) {
      expect(_VALID_PERK_IDS.has(perk.id)).toBe(true);
    }
  });
});

// ── getPublicTrailPerkStatus(memberId) [Anyone] ─────────────────────────────

describe('getPublicTrailPerkStatus', () => {
  it('returns perks for a valid memberId', async () => {
    __seed(COLLECTION, [{
      _id: `${MEMBER_ID}_perk-free-shipping`,
      memberId: MEMBER_ID,
      perkId: 'perk-free-shipping',
      deliveredAt: new Date('2026-03-15'),
      couponCode: 'TRAIL-SECRET99',
    }]);

    const result = await getPublicTrailPerkStatus(MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.perks).toHaveLength(1);
    expect(result.perks[0].perkId).toBe('perk-free-shipping');
    expect(result.perks[0]).toHaveProperty('deliveredAt');
  });

  it('never exposes couponCode in public response', async () => {
    __seed(COLLECTION, [{
      _id: `${MEMBER_ID}_perk-free-shipping`,
      memberId: MEMBER_ID,
      perkId: 'perk-free-shipping',
      deliveredAt: new Date('2026-03-15'),
      couponCode: 'TRAIL-SECRET99',
    }]);

    const result = await getPublicTrailPerkStatus(MEMBER_ID);
    expect(result.perks[0]).not.toHaveProperty('couponCode');
  });

  it('returns empty perks array for member with no perks', async () => {
    const result = await getPublicTrailPerkStatus('mem-unknown');
    expect(result.success).toBe(true);
    expect(result.perks).toEqual([]);
  });

  it('returns error for empty memberId', async () => {
    const result = await getPublicTrailPerkStatus('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for non-string memberId', async () => {
    const result = await getPublicTrailPerkStatus(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes memberId — strips HTML tags, returns empty for no match', async () => {
    // HTML tags stripped by sanitize → 'alert(1)' → no matching member
    const result = await getPublicTrailPerkStatus('<script>alert(1)</script>');
    expect(result.success).toBe(true);
    expect(result.perks).toEqual([]);
  });
});

// ── claimTrailPerk(perkId) [SiteMember] ─────────────────────────────────────

describe('claimTrailPerk', () => {
  it('returns auth error when caller is not authenticated', async () => {
    __resetMember();
    const result = await claimTrailPerk('perk-free-shipping');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('returns error for unknown perkId', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('perk-nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown|invalid/i);
  });

  it('returns error for empty perkId', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('');
    expect(result.success).toBe(false);
  });

  it('returns error for non-string perkId', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk(null);
    expect(result.success).toBe(false);
  });

  it('claims a valid perk and returns success', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('perk-free-shipping');
    expect(result.success).toBe(true);
    expect(result.alreadyClaimed).toBe(false);
  });

  it('generates a coupon code for perk-free-shipping', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('perk-free-shipping');
    expect(result.couponCode).toMatch(/^TRAIL-[A-Z0-9]{8}$/);
  });

  it('does not generate coupon code for non-shipping perks', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('perk-early-access');
    expect(result.success).toBe(true);
    expect(result.couponCode).toBeNull();
  });

  it('is idempotent — returns existing record if already claimed', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(COLLECTION, [{
      _id: `${MEMBER_ID}_perk-free-shipping`,
      memberId: MEMBER_ID,
      perkId: 'perk-free-shipping',
      deliveredAt: new Date('2026-03-01'),
      couponCode: 'TRAIL-EXISTING',
    }]);

    const result = await claimTrailPerk('perk-free-shipping');
    expect(result.success).toBe(true);
    expect(result.alreadyClaimed).toBe(true);
    expect(result.couponCode).toBe('TRAIL-EXISTING');
  });

  it('inserts record into MemberTrailPerks on first claim', async () => {
    __setMember({ _id: MEMBER_ID });
    await claimTrailPerk('perk-early-access');

    const inserted = __getInserted(COLLECTION);
    const record = inserted.find(r => r.perkId === 'perk-early-access');
    expect(record).toBeDefined();
    expect(record.memberId).toBe(MEMBER_ID);
    expect(record.deliveredAt).toBeDefined();
  });

  it('sanitizes perkId — strips HTML', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await claimTrailPerk('<img src=x onerror=alert(1)>');
    expect(result.success).toBe(false);
  });
});
