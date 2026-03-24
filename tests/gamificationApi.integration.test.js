/**
 * @file gamificationApi.integration.test.js
 * @description Integration tests for the gamification API pipeline.
 *
 * Unlike gamificationEvent.http.test.js, receiveGamificationEvent is NOT
 * mocked here. The full chain runs: post_gamificationEvent (HTTP layer) →
 * receiveGamificationEvent (business logic) → wixData (MemberPoints persist).
 *
 * Verifies:
 *  - Points actually land in MemberPoints on first-member insert
 *  - Points accumulate correctly on subsequent-member update
 *  - HTTP response newTotal == wixData totalPoints (no optimistic mismatch)
 *  - HTTP returns 500 when wixData insert fails (DB unavailable)
 *  - HTTP returns 500 when wixData update fails
 *  - order_complete event: orderTotal from payload becomes totalPoints in DB
 *  - Submit review: +50 pts base, +25 bonus with has_photo
 *
 * CF-bcho
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
  __setUpdateError,
} from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import { post_gamificationEvent } from '../src/backend/http-functions.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MEMBER = { _id: 'mem-int-1', loginEmail: 'tester@example.com' };

function makeRequest(body = {}) {
  return { body: { json: async () => body } };
}

function parseBody(res) {
  return JSON.parse(res.body);
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __resetMembers();
  // Rate-limit tables empty → all events allowed
  __seed('GamificationDailyCap', []);
  __seed('GamificationActionRateLimit', []);
  __setMember(MEMBER);
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('gamificationApi — points persist to MemberPoints (integration)', () => {
  it('inserts MemberPoints record on first event for a new member', async () => {
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    expect(res.status).toBe(200);
    const body = parseBody(res);
    expect(body.success).toBe(true);
    expect(body.newTotal).toBe(5);

    // Verify points actually landed in the collection
    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === MEMBER._id);
    expect(record).toBeDefined();
    expect(record.totalPoints).toBe(5);
  });

  it('HTTP response newTotal matches wixData totalPoints — no optimistic mismatch', async () => {
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    const body = parseBody(res);
    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === MEMBER._id);
    expect(body.newTotal).toBe(record.totalPoints);
  });

  it('updates existing MemberPoints record and accumulates points correctly', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-int-1', memberId: MEMBER._id, totalPoints: 100, tier: 'Trail Blazer',
    }]);

    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    expect(res.status).toBe(200);
    const body = parseBody(res);
    expect(body.newTotal).toBe(105);

    const updated = __getUpdated('MemberPoints');
    const record = updated.find(r => r.memberId === MEMBER._id);
    expect(record).toBeDefined();
    expect(record.totalPoints).toBe(105);
    // Response and DB are in sync
    expect(body.newTotal).toBe(record.totalPoints);
  });

  it('order_complete: orderTotal from payload becomes totalPoints in DB', async () => {
    const res = await post_gamificationEvent(
      makeRequest({
        eventName: 'gamification_order_complete',
        memberId: MEMBER._id,
        payload: { orderTotal: 250 },
      })
    );

    expect(res.status).toBe(200);
    const body = parseBody(res);
    expect(body.newTotal).toBe(250);

    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === MEMBER._id);
    expect(record.totalPoints).toBe(250);
    expect(body.newTotal).toBe(record.totalPoints);
  });

  it('submit_review: awards 50 pts base, 75 pts with has_photo', async () => {
    const resBase = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_submit_review', memberId: MEMBER._id })
    );
    expect(parseBody(resBase).newTotal).toBe(50);

    // Reset and re-run with has_photo to verify bonus
    __reset();
    __setMember(MEMBER);
    __seed('GamificationDailyCap', []);
    __seed('GamificationActionRateLimit', []);

    const resPhoto = await post_gamificationEvent(
      makeRequest({
        eventName: 'gamification_submit_review',
        memberId: MEMBER._id,
        payload: { has_photo: true },
      })
    );
    expect(parseBody(resPhoto).newTotal).toBe(75); // 50 base + 25 photo bonus
  });

  it('returns HTTP 500 when wixData insert fails — not a silent 200', async () => {
    __setInsertError('MemberPoints', new Error('DB unavailable'));

    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    expect(res.status).toBe(500);
    // No false-positive success in the response body
    const body = parseBody(res);
    expect(body.success).toBeUndefined();
  });

  it('returns HTTP 500 when wixData update fails — not a silent 200', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-int-1', memberId: MEMBER._id, totalPoints: 50, tier: 'Trail Blazer',
    }]);
    __setUpdateError('MemberPoints', new Error('DB update failed'));

    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    expect(res.status).toBe(500);
    const body = parseBody(res);
    expect(body.success).toBeUndefined();
  });

  it('MemberPoints record contains memberId field after first insert', async () => {
    await post_gamificationEvent(
      makeRequest({ eventName: 'gamification_add_to_cart', memberId: MEMBER._id })
    );

    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === MEMBER._id);
    expect(record).toBeDefined();
    expect(record.memberId).toBe(MEMBER._id);
    expect(typeof record.totalPoints).toBe('number');
  });
});
