/**
 * @file challengeOfWeek.test.js
 * @description Tests for getChallengeOfTheWeek webMethod.
 *
 * Covers:
 *  1. Returns most recent week's challenge when record exists
 *  2. Falls back to most recent record when no current-week record exists
 *  3. Returns { success: false } on query error
 *  4. Returns { success: false, error: 'no_challenges' } when collection empty
 *
 * cf-3z1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from 'wix-data';

// ── Helpers ──────────────────────────────────────────────────────────

/** Most recent Sunday <= today (2026-04-16 is a Thursday → Sunday = 2026-04-12) */
function getMostRecentSunday(ref = new Date()) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function makeChallenge(overrides = {}) {
  return {
    _id: 'cotw-1',
    challengeId: 'cotw-apr-w3',
    weekStart: getMostRecentSunday(),
    title: 'Share a Room Photo',
    description: 'Post your futon setup and earn points!',
    pointValue: 200,
    imageUrl: 'https://example.com/challenge.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
});

// Import AFTER mocks are registered by vitest config
import { getChallengeOfTheWeek } from '../src/backend/challengeService.web.js';

// ── Tests ────────────────────────────────────────────────────────────

describe('getChallengeOfTheWeek (cf-3z1)', () => {
  it('returns most recent week\'s challenge when record exists', async () => {
    const sunday = getMostRecentSunday();
    __seed('ChallengeOfTheWeek', [makeChallenge({ weekStart: sunday })]);

    const result = await getChallengeOfTheWeek();

    expect(result.success).toBe(true);
    expect(result.challenge).toBeDefined();
    expect(result.challenge.challengeId).toBe('cotw-apr-w3');
    expect(result.challenge.title).toBe('Share a Room Photo');
    expect(result.challenge.description).toBe('Post your futon setup and earn points!');
    expect(result.challenge.pointValue).toBe(200);
    expect(result.challenge.imageUrl).toBe('https://example.com/challenge.jpg');
    expect(result.challenge.weekStart).toEqual(sunday);
  });

  it('falls back to most recent record when no current-week record exists', async () => {
    // Only an old challenge — no record for current week's Sunday
    const oldSunday = new Date('2026-03-29');
    __seed('ChallengeOfTheWeek', [
      makeChallenge({ weekStart: oldSunday, challengeId: 'cotw-mar-w5', title: 'Old Challenge' }),
    ]);

    const result = await getChallengeOfTheWeek();

    expect(result.success).toBe(true);
    expect(result.challenge.challengeId).toBe('cotw-mar-w5');
    expect(result.challenge.title).toBe('Old Challenge');
  });

  it('returns { success: false } on query error', async () => {
    __setQueryError('ChallengeOfTheWeek', new Error('DB down'));

    const result = await getChallengeOfTheWeek();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns { success: false, error: "no_challenges" } when collection empty', async () => {
    __seed('ChallengeOfTheWeek', []);

    const result = await getChallengeOfTheWeek();

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_challenges');
  });
});
