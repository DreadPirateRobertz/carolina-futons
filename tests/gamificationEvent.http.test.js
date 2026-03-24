/**
 * @file gamificationEvent.http.test.js
 * @description CF-xr8: TDD tests for post_gamificationEvent HTTP endpoint.
 *
 * Covers:
 *  - Authentication: 401 when unauthenticated
 *  - Validation: 400 for missing eventName/memberId, member mismatch, invalid JSON
 *  - Rate limiting: 429 at 20 req/min, allows below limit, resets on expired window
 *  - Success: 200 with { success, newTotal, tierChanged, newTier }, tier change, payload defaults
 *  - Error handling: 500 on receiveGamificationEvent failure, unexpected exception
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as __resetData, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember } from './__mocks__/wix-members-backend.js';

// Mock the gamification receiver to isolate HTTP layer
vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn(),
}));

import { receiveGamificationEvent } from 'backend/gamificationEventReceiver.web';
import { post_gamificationEvent } from '../src/backend/http-functions.js';

const VALID_MEMBER = { _id: 'member-abc', loginEmail: 'gamer@example.com' };

function makeRequest(body = {}) {
  return {
    body: {
      json: async () => body,
    },
  };
}

function makeRateLimitRecord(key, count, windowStart = Date.now() - 5_000) {
  return {
    _id: `rl-${key}`,
    key,
    count,
    windowStart: new Date(windowStart),
  };
}

beforeEach(() => {
  __resetData();
  __resetMembers();
  vi.clearAllMocks();
  __seed('GamificationDailyCap', []);
  __seed('GamificationActionRateLimit', []);
  receiveGamificationEvent.mockResolvedValue({
    success: true,
    newTotal: 150,
    tierChanged: false,
    newTier: 'bronze',
  });
});

// ── Authentication ───────────────────────────────────────────────────────────

describe('post_gamificationEvent — authentication', () => {
  it('returns 401 when no member is authenticated', async () => {
    const req = makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} });
    const res = await post_gamificationEvent(req);
    expect(res.status).toBe(401);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('post_gamificationEvent — validation', () => {
  beforeEach(() => {
    __setMember(VALID_MEMBER);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const req = { body: { json: async () => { throw new Error('JSON parse error'); } } };
    const res = await post_gamificationEvent(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/invalid/i);
  });

  it('returns 400 when eventName is missing', async () => {
    const res = await post_gamificationEvent(makeRequest({ memberId: 'member-abc', payload: {} }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/eventName/i);
  });

  it('returns 400 when eventName is whitespace-only', async () => {
    const res = await post_gamificationEvent(makeRequest({ eventName: '   ', memberId: 'member-abc', payload: {} }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/eventName/i);
  });

  it('returns 400 when memberId is missing', async () => {
    const res = await post_gamificationEvent(makeRequest({ eventName: 'product_viewed', payload: {} }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/memberId/i);
  });

  it('returns 401 when memberId in body does not match authenticated member', async () => {
    const res = await post_gamificationEvent(makeRequest({
      eventName: 'product_viewed',
      memberId: 'member-different',
      payload: {},
    }));
    expect(res.status).toBe(401);
  });
});

// ── Rate limiting ────────────────────────────────────────────────────────────

import { GAMIFICATION_DAILY_CAP } from '../src/backend/utils/gamificationRateLimit.js';

describe('post_gamificationEvent — rate limiting', () => {
  beforeEach(() => {
    __setMember(VALID_MEMBER);
  });

  it('returns 429 when global daily cap is exceeded', async () => {
    // product_viewed has no per-action limit → only daily cap applies
    __seed('GamificationDailyCap', [makeRateLimitRecord('member-abc', GAMIFICATION_DAILY_CAP.max)]);
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body).error).toMatch(/rate limit/i);
  });

  it('allows request when daily cap count is below the limit', async () => {
    __seed('GamificationDailyCap', [makeRateLimitRecord('member-abc', GAMIFICATION_DAILY_CAP.max - 1)]);
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    expect(res.status).toBe(200);
  });

  it('allows request when daily cap window has expired', async () => {
    const EXPIRED = Date.now() - (GAMIFICATION_DAILY_CAP.windowMs + 1000);
    __seed('GamificationDailyCap', [makeRateLimitRecord('member-abc', GAMIFICATION_DAILY_CAP.max, EXPIRED)]);
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    expect(res.status).toBe(200);
  });
});

// ── Success ──────────────────────────────────────────────────────────────────

describe('post_gamificationEvent — success', () => {
  beforeEach(() => {
    __setMember(VALID_MEMBER);
  });

  it('returns 200 with success, newTotal, tierChanged, newTier', async () => {
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: { productId: 'prod-123' } })
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.newTotal).toBe(150);
    expect(body.tierChanged).toBe(false);
    expect(body.newTier).toBe('bronze');
  });

  it('returns tierChanged: true when tier changes', async () => {
    receiveGamificationEvent.mockResolvedValueOnce({
      success: true, newTotal: 1000, tierChanged: true, newTier: 'silver',
    });
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.tierChanged).toBe(true);
    expect(body.newTier).toBe('silver');
  });

  it('calls receiveGamificationEvent with eventName, payload, and memberId', async () => {
    await post_gamificationEvent(
      makeRequest({ eventName: 'wishlist_add', memberId: 'member-abc', payload: { productId: 'prod-456' } })
    );
    expect(receiveGamificationEvent).toHaveBeenCalledWith(
      'wishlist_add',
      { productId: 'prod-456' },
      'member-abc',
    );
  });

  it('defaults payload to {} when not provided in body', async () => {
    await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc' })
    );
    expect(receiveGamificationEvent).toHaveBeenCalledWith(
      'product_viewed',
      {},
      'member-abc',
    );
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('post_gamificationEvent — error handling', () => {
  beforeEach(() => {
    __setMember(VALID_MEMBER);
  });

  it('returns 500 when receiveGamificationEvent returns { success: false }', async () => {
    receiveGamificationEvent.mockResolvedValueOnce({
      success: false, error: 'Failed to retrieve points',
    });
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    expect(res.status).toBe(500);
  });

  it('returns 500 on unexpected exception from receiveGamificationEvent', async () => {
    receiveGamificationEvent.mockRejectedValueOnce(new Error('Unexpected DB failure'));
    const res = await post_gamificationEvent(
      makeRequest({ eventName: 'product_viewed', memberId: 'member-abc', payload: {} })
    );
    expect(res.status).toBe(500);
  });
});
