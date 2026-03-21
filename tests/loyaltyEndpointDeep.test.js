/**
 * Deeper boundary + auth tests for GET /_functions/loyalty/{memberId}
 * Bead: CF-efbi
 *
 * Covers gaps not in loyaltyEndpoint.test.js:
 * - IDOR guard: response body must not leak loyalty data on access-denied
 * - 404: content assertions for missing loyalty account
 * - nextTierAt: additional exact tier boundary values
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __setMember, __reset as __resetMember } from './__mocks__/wix-members-backend.js';
import {
  __setAccount,
  __setRewards,
  __reset as __resetLoyalty,
} from './__mocks__/wix-loyalty.v2.js';
import { get_loyalty } from '../src/backend/http-functions.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeRequest(memberId) {
  return { path: memberId != null ? [memberId] : [] };
}

const MEMBER_ID = 'member-target-789';

const mockAccount = {
  _id: 'acc-target',
  contactId: MEMBER_ID,
  points: { balance: 800 },
};

beforeEach(() => {
  __resetMember();
  __resetLoyalty();
});

// ── IDOR guard — no data leakage ──────────────────────────────────────
//
// An attacker who knows another member's ID must not receive any loyalty
// data in the response body — only an error field.

describe('GET /loyalty/{memberId} — IDOR guard no data leak', () => {
  it('response body does not include points when IDOR is attempted', async () => {
    __setMember({ _id: 'attacker-member-111' });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);

    expect(result.status).toBe(403);
    expect(body.points).toBeUndefined();
  });

  it('response body does not include tier when IDOR is attempted', async () => {
    __setMember({ _id: 'attacker-member-111' });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);

    expect(body.tier).toBeUndefined();
  });

  it('response body does not include rewards when IDOR is attempted', async () => {
    __setMember({ _id: 'attacker-member-111' });
    __setAccount(mockAccount);
    __setRewards([{ _id: 'rw-1', name: '5% Off', pointCost: 200 }]);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);

    expect(body.rewards).toBeUndefined();
  });

  it('response body does not include nextTierAt when IDOR is attempted', async () => {
    __setMember({ _id: 'attacker-member-111' });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);

    expect(body.nextTierAt).toBeUndefined();
  });

  it('IDOR rejected even when attacker uses a memberId only differing by one char', async () => {
    // Attacker guesses a nearby ID — must still be 403
    const nearlyRight = MEMBER_ID.slice(0, -1) + 'X';
    __setMember({ _id: nearlyRight });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(403);
  });

  it('IDOR rejected when attacker appends characters to the real memberId', async () => {
    __setMember({ _id: MEMBER_ID + '-extra' });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(403);
  });

  it('IDOR response has JSON Content-Type header', async () => {
    __setMember({ _id: 'attacker-member-111' });
    __setAccount(mockAccount);

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ── 404 — content assertions ──────────────────────────────────────────

describe('GET /loyalty/{memberId} — 404 content assertions', () => {
  it('404 error body has an error field', async () => {
    __setMember({ _id: MEMBER_ID });
    // No account set

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.status).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
  });

  it('404 response body does not include points', async () => {
    __setMember({ _id: MEMBER_ID });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.points).toBeUndefined();
  });

  it('404 response body does not include tier', async () => {
    __setMember({ _id: MEMBER_ID });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBeUndefined();
  });

  it('404 response has no-store cache header', async () => {
    __setMember({ _id: MEMBER_ID });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});

// ── nextTierAt — additional exact boundary values ────────────────────

describe('GET /loyalty/{memberId} — nextTierAt additional boundary conditions', () => {
  beforeEach(() => {
    __setMember({ _id: MEMBER_ID });
    __setRewards([]);
  });

  it('1 point → Bronze with nextTierAt=500', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 1 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Bronze');
    expect(body.nextTierAt).toBe(500);
  });

  it('exactly 1500 points → Gold with nextTierAt=null', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 1500 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Gold');
    expect(body.nextTierAt).toBeNull();
  });

  it('1501 points → Gold with nextTierAt=null (one above Gold threshold)', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 1501 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Gold');
    expect(body.nextTierAt).toBeNull();
  });

  it('very large point balance → Gold with nextTierAt=null', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 99999 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Gold');
    expect(body.nextTierAt).toBeNull();
  });

  it('0 points → Bronze with nextTierAt=500', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 0 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Bronze');
    expect(body.nextTierAt).toBe(500);
  });

  it('501 points → Silver with nextTierAt=1500 (one above Silver threshold)', async () => {
    __setAccount({ _id: 'acc-1', contactId: MEMBER_ID, points: { balance: 501 } });

    const result = await get_loyalty(makeRequest(MEMBER_ID));
    const body = JSON.parse(result.body);
    expect(body.tier).toBe('Silver');
    expect(body.nextTierAt).toBe(1500);
  });
});
