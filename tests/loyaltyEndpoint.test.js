/**
 * TDD tests for GET /_functions/loyalty/{memberId}
 * Bead: CF-b0u3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __setMember, __reset as __resetMember } from './__mocks__/wix-members-backend.js';
import {
  __setAccount,
  __setRewards,
  __reset as __resetLoyalty,
  rewards as loyaltyRewardsMock,
} from './__mocks__/wix-loyalty.v2.js';
import { get_loyalty } from '../src/backend/http-functions.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeRequest(memberId) {
  return { path: memberId ? [memberId] : [] };
}

const MEMBER_ID = 'member-abc123';

const mockAccount = {
  _id: 'acc-1',
  contactId: MEMBER_ID,
  points: { balance: 750 },
};

const mockRewards = [
  { _id: 'rw-1', name: '5% Off', pointCost: 200 },
  { _id: 'rw-2', name: 'Free Shipping', pointCost: 500 },
];

beforeEach(() => {
  __resetMember();
  __resetLoyalty();
});

// ── 200 — Valid authenticated member owning the memberId ──────────────

describe('GET /loyalty/{memberId} — 200 success', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
    __setAccount(mockAccount);
    __setRewards(mockRewards);
  });

  it('returns 200', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(200);
  });

  it('response body includes memberId', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.memberId).toBe(MEMBER_ID);
  });

  it('response body includes points balance', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.points).toBe(750);
  });

  it('response body includes correct tier (Silver at 750 pts)', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
  });

  it('response body includes nextTierAt (Gold threshold = 1500)', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.nextTierAt).toBe(1500);
  });

  it('response body includes rewards array', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.rewards)).toBe(true);
    expect(body.rewards).toHaveLength(2);
  });

  it('reward entries have expected shape', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    const [first] = body.rewards;
    expect(first).toHaveProperty('_id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('pointCost');
  });

  it('returns JSON content-type header', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('returns no-store cache header', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('returns null nextTierAt when member is at max tier (Gold at 1500+)', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 1500 } });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Gold');
    expect(body.nextTierAt).toBeNull();
  });

  it('returns Bronze tier and nextTierAt=500 for zero-point member', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 0 } });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Bronze');
    expect(body.nextTierAt).toBe(500);
  });

  it('returns empty rewards array when no rewards exist', async () => {
    __setRewards([]);
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.rewards).toEqual([]);
  });
});

// ── 401 — Not authenticated ───────────────────────────────────────────

describe('GET /loyalty/{memberId} — 401 not authenticated', () => {
  it('returns 401 when no member is authenticated', async () => {
    // __setMember not called — currentMember.getMember() returns null
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(401);
  });

  it('returns JSON error body for unauthenticated', async () => {
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });
});

// ── 403 — IDOR guard ─────────────────────────────────────────────────

describe('GET /loyalty/{memberId} — 403 IDOR guard', () => {
  it('returns 403 when authenticated member does not own the requested memberId', async () => {
    __setMember({ _id: 'different-member-456' });
    __setAccount(mockAccount);
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(403);
  });

  it('returns JSON error body for IDOR attempt', async () => {
    __setMember({ _id: 'different-member-456' });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });
});

// ── 400 — Bad request ─────────────────────────────────────────────────

describe('GET /loyalty/{memberId} — 400 bad request', () => {
  it('returns 400 when memberId path param is missing', async () => {
    const result = await get_loyalty(makeRequest(null));
    expect(result.status).toBe(400);
  });

  it('returns JSON error body for missing memberId', async () => {
    const result = await get_loyalty(makeRequest(null));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for empty-string memberId', async () => {
    const result = await get_loyalty(makeRequest(''));
    expect(result.status).toBe(400);
  });
});

// ── 404 — Unknown member ──────────────────────────────────────────────

describe('GET /loyalty/{memberId} — 404 unknown member', () => {
  it('returns 404 when loyalty account does not exist for the member', async () => {
    __setMember({ _id: MEMBER_ID });
    // __setAccount not called — getMyAccount returns null
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(404);
  });

  it('returns JSON error body for unknown member', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });
});

// ── 500 — Internal error ──────────────────────────────────────────────

describe('GET /loyalty/{memberId} — 500 internal error', () => {
  it('returns 500 when accounts.getMyAccount throws', async () => {
    __setMember({ _id: MEMBER_ID });
    const { accounts } = await import('./__mocks__/wix-loyalty.v2.js');
    accounts.getMyAccount.mockRejectedValueOnce(new Error('wix-loyalty service unavailable'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(500);
  });

  it('returns JSON error body on 500', async () => {
    __setMember({ _id: MEMBER_ID });
    const { accounts } = await import('./__mocks__/wix-loyalty.v2.js');
    accounts.getMyAccount.mockRejectedValueOnce(new Error('wix-loyalty service unavailable'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

  it('returns 500 when currentMember.getMember() throws', async () => {
    const { currentMember } = await import('./__mocks__/wix-members-backend.js');
    currentMember.getMember.mockRejectedValueOnce(new Error('Wix members SDK unavailable'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(500);
  });

  it('returns JSON error body when getMember() throws', async () => {
    const { currentMember } = await import('./__mocks__/wix-members-backend.js');
    currentMember.getMember.mockRejectedValueOnce(new Error('Wix members SDK unavailable'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });
});

// ── Graceful degradation — listRewards failure ────────────────────────

describe('GET /loyalty/{memberId} — listRewards failure degrades gracefully', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
    __setAccount(mockAccount);
  });

  it('returns 200 (not 500) when listRewards throws', async () => {
    loyaltyRewardsMock.listRewards.mockRejectedValueOnce(new Error('rewards service down'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(200);
  });

  it('returns empty rewards when listRewards throws', async () => {
    loyaltyRewardsMock.listRewards.mockRejectedValueOnce(new Error('rewards service down'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.rewards).toEqual([]);
  });

  it('still returns correct points and tier when listRewards throws', async () => {
    loyaltyRewardsMock.listRewards.mockRejectedValueOnce(new Error('rewards service down'));
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.points).toBe(750);
    expect(body.tier).toBe('Silver');
  });
});

// ── Tier boundary conditions ───────────────────────────────────────────

describe('GET /loyalty/{memberId} — tier boundary conditions', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
    __setRewards([]);
  });

  it('499 points → Bronze with nextTierAt=500', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 499 } });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Bronze');
    expect(body.nextTierAt).toBe(500);
  });

  it('exactly 500 points → Silver with nextTierAt=1500', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 500 } });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
    expect(body.nextTierAt).toBe(1500);
  });

  it('1499 points → Silver with nextTierAt=1500', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 1499 } });
    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
    expect(body.nextTierAt).toBe(1500);
  });
});
