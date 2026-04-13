import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  SPIN_GRANTS_COLLECTION,
  grantSpin,
  redeemSpin,
  getPendingSpins,
} from '../src/backend/spinRedemptionService.web.js';

const MEMBER_ID = 'member-spin-1';
function setMember() { __setMember({ _id: MEMBER_ID }); }

beforeEach(() => { __reset(); resetMember(); });

// ── SPIN_GRANTS_COLLECTION ────────────────────────────────────────────────────

describe('SPIN_GRANTS_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof SPIN_GRANTS_COLLECTION).toBe('string');
    expect(SPIN_GRANTS_COLLECTION.length).toBeGreaterThan(0);
  });

  it('equals SpinGrants', () => {
    expect(SPIN_GRANTS_COLLECTION).toBe('SpinGrants');
  });
});

// ── grantSpin ─────────────────────────────────────────────────────────────────

describe('grantSpin', () => {
  it('inserts a pending spin grant and returns success: true', async () => {
    setMember();
    const result = await grantSpin(MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.spinId).toBeTruthy();
  });

  it('returned spinId is a string', async () => {
    setMember();
    const result = await grantSpin(MEMBER_ID);
    expect(typeof result.spinId).toBe('string');
  });

  it('rejects missing memberId', async () => {
    const result = await grantSpin('');
    expect(result.success).toBe(false);
  });
});

// ── getPendingSpins ───────────────────────────────────────────────────────────

describe('getPendingSpins', () => {
  it('returns empty array when no pending spins', async () => {
    setMember();
    __seed(SPIN_GRANTS_COLLECTION, []);
    const spins = await getPendingSpins(MEMBER_ID);
    expect(spins).toEqual([]);
  });

  it('returns only pending (non-expired) spins for the member', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 's1', memberId: MEMBER_ID, status: 'pending', expiresAt: future },
      { _id: 's2', memberId: MEMBER_ID, status: 'redeemed', expiresAt: future },
      { _id: 's3', memberId: 'other', status: 'pending', expiresAt: future },
    ]);
    const spins = await getPendingSpins(MEMBER_ID);
    expect(spins).toHaveLength(1);
    expect(spins[0]._id).toBe('s1');
  });

  it('does not return spins belonging to another member', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 's1', memberId: 'other-member', status: 'pending', expiresAt: future },
    ]);
    const spins = await getPendingSpins(MEMBER_ID);
    expect(spins).toEqual([]);
  });
});

// ── redeemSpin ────────────────────────────────────────────────────────────────

describe('redeemSpin', () => {
  it('marks spin as redeemed and returns success: true', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 'spin-1', memberId: MEMBER_ID, status: 'pending', expiresAt: future },
    ]);
    const result = await redeemSpin(MEMBER_ID, 'spin-1', { reward: 'bonus_points', rewardValue: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects redemption of already-redeemed spin', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 'spin-2', memberId: MEMBER_ID, status: 'redeemed', expiresAt: future },
    ]);
    const result = await redeemSpin(MEMBER_ID, 'spin-2', { reward: 'bonus_points', rewardValue: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already redeemed/i);
  });

  it('rejects redemption of another member\'s spin (IDOR guard)', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 'spin-3', memberId: 'other-member', status: 'pending', expiresAt: future },
    ]);
    const result = await redeemSpin(MEMBER_ID, 'spin-3', { reward: 'coupon', rewardValue: '10OFF' });
    expect(result.success).toBe(false);
  });

  it('returns success: false when spin not found', async () => {
    setMember();
    __seed(SPIN_GRANTS_COLLECTION, []);
    const result = await redeemSpin(MEMBER_ID, 'spin-missing', { reward: 'bonus_points', rewardValue: 50 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects expired spin', async () => {
    setMember();
    const past = new Date(Date.now() - 86400000);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 'spin-4', memberId: MEMBER_ID, status: 'pending', expiresAt: past },
    ]);
    const result = await redeemSpin(MEMBER_ID, 'spin-4', { reward: 'free_ship', rewardValue: null });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expir/i);
  });

  it('redeemed spin no longer appears in getPendingSpins', async () => {
    setMember();
    const future = new Date(Date.now() + 86400000 * 7);
    __seed(SPIN_GRANTS_COLLECTION, [
      { _id: 'spin-5', memberId: MEMBER_ID, status: 'pending', expiresAt: future },
    ]);
    await redeemSpin(MEMBER_ID, 'spin-5', { reward: 'bonus_points', rewardValue: 75 });
    const spins = await getPendingSpins(MEMBER_ID);
    expect(spins).toEqual([]);
  });
});
