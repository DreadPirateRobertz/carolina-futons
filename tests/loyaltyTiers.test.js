import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getTier,
  updateTier,
  calculateRewards,
  getAllTiers,
  getCustomerTierHistory,
} from '../src/backend/loyaltyTiers.web.js';

const DEFAULT_TIERS = [
  { _id: 't-1', name: 'Bronze', minSpend: 0, discountPercent: 0, freeShippingThreshold: 150, earlyAccess: false, sortOrder: 0 },
  { _id: 't-2', name: 'Silver', minSpend: 500, discountPercent: 5, freeShippingThreshold: 100, earlyAccess: false, sortOrder: 1 },
  { _id: 't-3', name: 'Gold', minSpend: 1500, discountPercent: 10, freeShippingThreshold: 50, earlyAccess: true, sortOrder: 2 },
  { _id: 't-4', name: 'Platinum', minSpend: 3000, discountPercent: 15, freeShippingThreshold: 0, earlyAccess: true, sortOrder: 3 },
];

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', contactDetails: { firstName: 'Alice' } });
  __seed('LoyaltyTiers', DEFAULT_TIERS);
});

// ── getTier ─────────────────────────────────────────────────────────

describe('getTier', () => {
  it('returns Bronze for new customer with no history', async () => {
    __seed('CustomerTierHistory', []);

    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Bronze');
    expect(result.data.lifetimeSpend).toBe(0);
    expect(result.data.discountPercent).toBe(0);
    expect(result.data.nextTier).toBe('Silver');
    expect(result.data.spendToNext).toBe(500);
  });

  it('returns correct tier for Silver member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 750,
      currentTier: 'Silver', previousTier: 'Bronze', tierChangedAt: new Date(),
    }]);

    const result = await getTier();
    expect(result.data.tier).toBe('Silver');
    expect(result.data.discountPercent).toBe(5);
    expect(result.data.freeShippingThreshold).toBe(100);
    expect(result.data.nextTier).toBe('Gold');
    expect(result.data.spendToNext).toBe(750);
  });

  it('returns correct tier for Gold member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 2000,
      currentTier: 'Gold', previousTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await getTier();
    expect(result.data.tier).toBe('Gold');
    expect(result.data.discountPercent).toBe(10);
    expect(result.data.earlyAccess).toBe(true);
    expect(result.data.nextTier).toBe('Platinum');
  });

  it('returns null nextTier for Platinum member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 5000,
      currentTier: 'Platinum', tierChangedAt: new Date(),
    }]);

    const result = await getTier();
    expect(result.data.tier).toBe('Platinum');
    expect(result.data.discountPercent).toBe(15);
    expect(result.data.freeShippingThreshold).toBe(0);
    expect(result.data.nextTier).toBeNull();
    expect(result.data.spendToNext).toBe(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    __seed('CustomerTierHistory', []);

    const result = await getTier();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not authenticated');
  });

  it('creates Bronze record for new customer', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'CustomerTierHistory') inserted = item; });
    __seed('CustomerTierHistory', []);

    await getTier();
    expect(inserted).not.toBeNull();
    expect(inserted.currentTier).toBe('Bronze');
    expect(inserted.lifetimeSpend).toBe(0);
  });

  it('uses default tiers when CMS is empty', async () => {
    __seed('LoyaltyTiers', []);
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 600,
      currentTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await getTier();
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Silver');
    expect(result.data.discountPercent).toBe(5);
  });
});

// ── updateTier ──────────────────────────────────────────────────────

describe('updateTier', () => {
  it('adds order amount to lifetime spend', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 200,
      currentTier: 'Bronze', previousTier: null, tierChangedAt: new Date(),
    }]);

    const result = await updateTier('member-1', 100);
    expect(result.success).toBe(true);
    expect(result.data.lifetimeSpend).toBe(300);
    expect(result.data.tierChanged).toBe(false);
    expect(updated.lifetimeSpend).toBe(300);
  });

  it('promotes from Bronze to Silver at 500 spend', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 400,
      currentTier: 'Bronze', previousTier: null, tierChangedAt: new Date('2026-01-01'),
    }]);

    const result = await updateTier('member-1', 150);
    expect(result.success).toBe(true);
    expect(result.data.currentTier).toBe('Silver');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.previousTier).toBe('Bronze');
    expect(result.data.discountPercent).toBe(5);
    expect(updated.currentTier).toBe('Silver');
  });

  it('promotes from Silver to Gold at 1500 spend', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 1400,
      currentTier: 'Silver', previousTier: 'Bronze', tierChangedAt: new Date(),
    }]);

    const result = await updateTier('member-1', 200);
    expect(result.data.currentTier).toBe('Gold');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.discountPercent).toBe(10);
  });

  it('promotes from Gold to Platinum at 3000 spend', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 2800,
      currentTier: 'Gold', previousTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await updateTier('member-1', 300);
    expect(result.data.currentTier).toBe('Platinum');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.discountPercent).toBe(15);
  });

  it('does not demote when no new spend', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 1500,
      currentTier: 'Gold', previousTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await updateTier('member-1', 0);
    expect(result.data.currentTier).toBe('Gold');
    expect(result.data.tierChanged).toBe(false);
  });

  it('creates record for new customer on first order', async () => {
    const inserts = [];
    __onInsert((col, item) => { inserts.push({ col, item }); });
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('CustomerTierHistory', []);

    const result = await updateTier('new-member', 600);
    expect(result.success).toBe(true);
    expect(result.data.currentTier).toBe('Silver');
    expect(result.data.tierChanged).toBe(true);
  });

  it('rejects invalid member ID', async () => {
    const result = await updateTier('', 100);
    expect(result.success).toBe(false);
  });

  it('rejects null member ID', async () => {
    const result = await updateTier(null, 100);
    expect(result.success).toBe(false);
  });

  it('rejects negative order amount', async () => {
    const result = await updateTier('member-1', -50);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  it('rejects non-number order amount', async () => {
    const result = await updateTier('member-1', 'fifty');
    expect(result.success).toBe(false);
  });

  it('skips multiple tiers on large order', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 0,
      currentTier: 'Bronze', previousTier: null, tierChangedAt: new Date(),
    }]);

    const result = await updateTier('member-1', 3500);
    expect(result.data.currentTier).toBe('Platinum');
    expect(result.data.tierChanged).toBe(true);
    expect(result.data.previousTier).toBe('Bronze');
  });
});

// ── calculateRewards ────────────────────────────────────────────────

describe('calculateRewards', () => {
  it('returns zero discount for Bronze member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 100,
      currentTier: 'Bronze', tierChangedAt: new Date(),
    }]);

    const result = await calculateRewards( 200);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Bronze');
    expect(result.data.discountPercent).toBe(0);
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.finalTotal).toBe(200);
    expect(result.data.freeShipping).toBe(true); // 200 >= 150
  });

  it('returns 5% discount for Silver member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 700,
      currentTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await calculateRewards( 100);
    expect(result.data.discountPercent).toBe(5);
    expect(result.data.discountAmount).toBe(5);
    expect(result.data.finalTotal).toBe(95);
    expect(result.data.freeShipping).toBe(true); // 100 >= 100
  });

  it('returns 10% discount for Gold member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 2000,
      currentTier: 'Gold', tierChangedAt: new Date(),
    }]);

    const result = await calculateRewards( 300);
    expect(result.data.discountPercent).toBe(10);
    expect(result.data.discountAmount).toBe(30);
    expect(result.data.finalTotal).toBe(270);
    expect(result.data.earlyAccess).toBe(true);
  });

  it('returns 15% discount for Platinum member', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 5000,
      currentTier: 'Platinum', tierChangedAt: new Date(),
    }]);

    const result = await calculateRewards( 400);
    expect(result.data.discountPercent).toBe(15);
    expect(result.data.discountAmount).toBe(60);
    expect(result.data.finalTotal).toBe(340);
    expect(result.data.freeShipping).toBe(true); // threshold 0
  });

  it('returns Bronze defaults for unknown member', async () => {
    __seed('CustomerTierHistory', []);

    const result = await calculateRewards( 200);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('Bronze');
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.finalTotal).toBe(200);
  });

  it('correctly computes free shipping flag', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 100,
      currentTier: 'Bronze', tierChangedAt: new Date(),
    }]);

    // Bronze threshold is 150, order of 100 should NOT qualify
    const result = await calculateRewards( 100);
    expect(result.data.freeShipping).toBe(false);
  });

  it('rejects invalid member ID', async () => {
    __setMember(null);
    const result = await calculateRewards(100);
    expect(result.success).toBe(false);
  });

  it('rejects negative order total', async () => {
    const result = await calculateRewards( -50);
    expect(result.success).toBe(false);
  });

  it('handles zero order total', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 700,
      currentTier: 'Silver', tierChangedAt: new Date(),
    }]);

    const result = await calculateRewards( 0);
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.finalTotal).toBe(0);
  });
});

// ── getAllTiers ──────────────────────────────────────────────────────

describe('getAllTiers', () => {
  it('returns all tier definitions', async () => {
    const result = await getAllTiers();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4);
    expect(result.data[0].name).toBe('Bronze');
    expect(result.data[3].name).toBe('Platinum');
    expect(result.data[3].discountPercent).toBe(15);
  });

  it('returns default tiers when CMS is empty', async () => {
    __seed('LoyaltyTiers', []);
    const result = await getAllTiers();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4);
  });

  it('includes earlyAccess flag', async () => {
    const result = await getAllTiers();
    expect(result.data[0].earlyAccess).toBe(false); // Bronze
    expect(result.data[2].earlyAccess).toBe(true);  // Gold
  });

  it('includes freeShippingThreshold', async () => {
    const result = await getAllTiers();
    expect(result.data[0].freeShippingThreshold).toBe(150); // Bronze
    expect(result.data[3].freeShippingThreshold).toBe(0);   // Platinum (free always)
  });
});

// ── getCustomerTierHistory ──────────────────────────────────────────

describe('getCustomerTierHistory', () => {
  it('returns customer tier history', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 800,
      currentTier: 'Silver', previousTier: 'Bronze',
      tierChangedAt: new Date('2026-02-01'), _createdDate: new Date('2026-01-01'),
    }]);

    const result = await getCustomerTierHistory('member-1');
    expect(result.success).toBe(true);
    expect(result.data.memberId).toBe('member-1');
    expect(result.data.lifetimeSpend).toBe(800);
    expect(result.data.currentTier).toBe('Silver');
    expect(result.data.previousTier).toBe('Bronze');
    expect(result.data.discountPercent).toBe(5);
  });

  it('returns not found for unknown customer', async () => {
    __seed('CustomerTierHistory', []);

    const result = await getCustomerTierHistory('unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects invalid member ID', async () => {
    const result = await getCustomerTierHistory('');
    expect(result.success).toBe(false);
  });

  it('rejects null member ID', async () => {
    const result = await getCustomerTierHistory(null);
    expect(result.success).toBe(false);
  });

  it('includes tier benefits in response', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'h-1', memberId: 'member-1', lifetimeSpend: 3500,
      currentTier: 'Platinum', previousTier: 'Gold', tierChangedAt: new Date(),
    }]);

    const result = await getCustomerTierHistory('member-1');
    expect(result.data.discountPercent).toBe(15);
    expect(result.data.freeShippingThreshold).toBe(0);
    expect(result.data.earlyAccess).toBe(true);
  });
});
