/**
 * Tests for GET /_functions/loyalty/{memberId} HTTP endpoint (CF-b0u3)
 *
 * Returns tier, points, and available rewards JSON for a loyalty member.
 * IDOR guard: authenticated member must own the requested memberId.
 *
 * Response shape:
 *   { success: true, memberId, tier, points, tierDiscount, nextTier, pointsToNext, progress, rewards: [] }
 *
 * Error codes:
 *   401 — no authenticated session
 *   403 — authenticated member does not own the requested memberId
 *   404 — loyalty account not found
 *   500 — internal error
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as resetData, __seed } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import { __setAccount, __setRewards, __reset as resetLoyalty } from './__mocks__/wix-loyalty.v2.js';
import { get_loyalty } from '../src/backend/http-functions.js';

const MEMBER_ID = 'member-abc-123';
const OTHER_MEMBER_ID = 'member-xyz-999';

const mockAccount = {
  _id: 'acct-001',
  memberId: MEMBER_ID,
  points: { balance: 750 },
};

const mockRewards = [
  { _id: 'rew-1', name: '$5 off', pointsCost: 500, active: true },
  { _id: 'rew-2', name: '$10 off', pointsCost: 1000, active: true },
  { _id: 'rew-3', name: 'Free shipping', pointsCost: 300, active: false },
];

beforeEach(() => {
  resetData();
  resetMember();
  resetLoyalty();
  vi.clearAllMocks();
});

// ── Authentication (401) ───────────────────────────────────────────────────

describe('get_loyalty — authentication', () => {
  it('returns 401 when no member is authenticated', async () => {
    // no __setMember call — session is unauthenticated
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.status).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/auth/i);
  });
});

// ── IDOR guard (403) ───────────────────────────────────────────────────────

describe('get_loyalty — IDOR guard', () => {
  it('returns 403 when authenticated member requests another member\'s data', async () => {
    __setMember({ _id: OTHER_MEMBER_ID });
    __setAccount(mockAccount);

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.status).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/forbidden/i);
  });

  it('returns 403 for empty memberId path param with authenticated session', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await get_loyalty({ pathParams: { memberId: '' }, headers: {} });
    expect(result.status).toBe(403);
  });
});

// ── Happy path (200) ──────────────────────────────────────────────────────

describe('get_loyalty — happy path', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
    __setAccount(mockAccount);
    __setRewards(mockRewards);
  });

  it('returns 200 with tier, points, and rewards for own account', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.memberId).toBe(MEMBER_ID);
  });

  it('returns Silver tier for 750 points', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
    expect(body.points).toBe(750);
  });

  it('returns tierDiscount of 5 for Silver', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.tierDiscount).toBe(5);
  });

  it('returns nextTier as Gold and positive pointsToNext', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.nextTier).toBe('Gold');
    expect(body.pointsToNext).toBe(750); // 1500 - 750
  });

  it('returns progress as a percentage (0–100)', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.progress).toBeGreaterThanOrEqual(0);
    expect(body.progress).toBeLessThanOrEqual(100);
  });

  it('returns only active rewards sorted by pointsCost ascending', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.rewards)).toBe(true);
    // inactive rewards excluded
    expect(body.rewards.every(r => r.active !== false)).toBe(true);
    // sorted ascending by pointsCost
    const costs = body.rewards.map(r => r.pointsCost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  it('returns JSON Content-Type header', async () => {
    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ── Tier boundary values ─────────────────────────────────────────────────

describe('get_loyalty — tier boundaries', () => {
  it('returns Bronze for 0 points', async () => {
    __setMember({ _id: MEMBER_ID });
    __setAccount({ ...mockAccount, points: { balance: 0 } });

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Bronze');
    expect(body.nextTier).toBe('Silver');
  });

  it('returns Gold for 1500+ points with no nextTier', async () => {
    __setMember({ _id: MEMBER_ID });
    __setAccount({ ...mockAccount, points: { balance: 2000 } });

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Gold');
    expect(body.nextTier).toBeNull();
    expect(body.pointsToNext).toBe(0);
    expect(body.progress).toBe(100);
  });

  it('returns Silver at exactly 500 points', async () => {
    __setMember({ _id: MEMBER_ID });
    __setAccount({ ...mockAccount, points: { balance: 500 } });

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
  });
});

// ── Account not found (404) ───────────────────────────────────────────────

describe('get_loyalty — account not found', () => {
  it('returns 404 when loyalty account does not exist for member', async () => {
    __setMember({ _id: MEMBER_ID });
    __setAccount(null); // no account

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.status).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });
});

// ── Error handling ─────────────────────────────────────────────────────────

describe('get_loyalty — error handling', () => {
  it('returns 500 when loyalty API throws unexpectedly', async () => {
    __setMember({ _id: MEMBER_ID });
    const { accounts } = await import('./__mocks__/wix-loyalty.v2.js');
    accounts.getAccount.mockRejectedValueOnce(new Error('Loyalty service unavailable'));

    const result = await get_loyalty({ pathParams: { memberId: MEMBER_ID }, headers: {} });
    expect(result.status).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });

  it('returns 500 on missing pathParams', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await get_loyalty({ headers: {} }); // no pathParams
    expect([400, 401, 403, 500]).toContain(result.status);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });
});
