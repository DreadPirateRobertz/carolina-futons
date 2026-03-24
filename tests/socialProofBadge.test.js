/**
 * @file socialProofBadge.test.js
 * Tests for getNeighborCount (cf-ic1).
 *
 * Pre-auth webMethod (Permissions.Anyone) that returns the count of opted-in
 * members in the given ZIP prefix, or the national total as fallback.
 * Used by PDPSocialProofBadge to render the "X members competing" badge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
  __getLastFindOptions,
} from './__mocks__/wix-data.js';
import { getNeighborCount } from '../src/backend/socialProofBadge.web.js';

beforeEach(() => {
  __reset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('getNeighborCount — input validation', () => {
  it('returns national count when zipPrefix is null', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
      { _id: 'mp-2', zipCode: '90210', leaderboardOptIn: true },
    ]);
    const result = await getNeighborCount(null);
    expect(result.isNational).toBe(true);
    expect(result.count).toBe(2);
  });

  it('returns national count when zipPrefix is empty string', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
    ]);
    const result = await getNeighborCount('');
    expect(result.isNational).toBe(true);
  });

  it('returns national count when zipPrefix is shorter than 3 chars', async () => {
    const result = await getNeighborCount('28');
    expect(result.isNational).toBe(true);
  });

  it('returns national count when zipPrefix is not a digit-only string', async () => {
    const result = await getNeighborCount('abc');
    expect(result.isNational).toBe(true);
  });
});

// ── ZIP-specific count ────────────────────────────────────────────────────────

describe('getNeighborCount — ZIP-specific', () => {
  beforeEach(() => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
      { _id: 'mp-2', zipCode: '28205', leaderboardOptIn: true },
      { _id: 'mp-3', zipCode: '28205', leaderboardOptIn: false }, // opted out
      { _id: 'mp-4', zipCode: '90210', leaderboardOptIn: true },  // different ZIP
    ]);
  });

  it('returns count of opted-in members in the ZIP prefix', async () => {
    const result = await getNeighborCount('282');
    expect(result.count).toBe(2);
    expect(result.zipPrefix).toBe('282');
    expect(result.isNational).toBe(false);
  });

  it('excludes members who have not opted in', async () => {
    const result = await getNeighborCount('282');
    expect(result.count).toBe(2); // mp-3 excluded (leaderboardOptIn: false)
  });

  it('returns zero count when no members match ZIP prefix', async () => {
    const result = await getNeighborCount('999');
    expect(result.count).toBe(0);
    expect(result.isNational).toBe(false);
  });

  it('normalizes zipPrefix to 3 chars when more are provided', async () => {
    const result = await getNeighborCount('28204');
    // Normalized to '282' — startsWith('282') matches both 28204 and 28205
    expect(result.count).toBe(2);
    expect(result.zipPrefix).toBe('282'); // normalized to 3 chars
  });
});

// ── National fallback ─────────────────────────────────────────────────────────

describe('getNeighborCount — national', () => {
  it('counts all opted-in members regardless of ZIP', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
      { _id: 'mp-2', zipCode: '90210', leaderboardOptIn: true },
      { _id: 'mp-3', zipCode: '10001', leaderboardOptIn: false },
    ]);
    const result = await getNeighborCount(null);
    expect(result.count).toBe(2);
    expect(result.isNational).toBe(true);
    expect(result.zipPrefix).toBeNull();
  });

  it('returns zero when no members have opted in', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: false },
    ]);
    const result = await getNeighborCount(null);
    expect(result.count).toBe(0);
  });
});

// ── suppressAuth ──────────────────────────────────────────────────────────────

describe('getNeighborCount — suppressAuth', () => {
  it('passes suppressAuth: true on the ZIP-specific query', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
    ]);
    await getNeighborCount('282');
    const opts = __getLastFindOptions('MemberPoints');
    expect(opts?.suppressAuth).toBe(true);
  });

  it('passes suppressAuth: true on the national query', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', zipCode: '28204', leaderboardOptIn: true },
    ]);
    await getNeighborCount(null);
    const opts = __getLastFindOptions('MemberPoints');
    expect(opts?.suppressAuth).toBe(true);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getNeighborCount — error handling', () => {
  it('returns { count: 0, isNational: true, error: true } gracefully on DB error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getNeighborCount('282');
    expect(result.count).toBe(0);
    expect(result.isNational).toBe(true);
    // error: true distinguishes DB failure from a real zero-member result
    expect(result.error).toBe(true);
  });
});
