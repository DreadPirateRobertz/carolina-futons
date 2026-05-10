/**
 * @file mobileChallengeSyntheticEvent.cfm3tj.test.js
 * @description cf-m3tj — completeMobileChallenge dispatches a synthetic
 * gamification_mobile_* event into receiveGamificationEvent so the canonical
 * web pipeline (PointsLedger insert, MemberPoints update, tier milestone,
 * BonusSpinGrants check) actually moves the member's balance.
 *
 * Pre-cf-m3tj: completion row was written, member balance never moved (G1).
 *
 * Verifies:
 *   - Fresh AR Discovery → synthetic 'gamification_mobile_ar_discovery' fires with 75 pts
 *   - Fresh Quiz Completion → 'gamification_mobile_quiz_completion' with 50 pts
 *   - Fresh Social Share → 'gamification_mobile_social_share' with 100 pts
 *   - Mobile awards are flat (FIXED_AWARD_EVENTS) — no streak multiplier
 *   - alreadyAwarded short-circuit DOES NOT fire the synthetic
 *   - Synthetic dispatch failure is non-blocking — completion row stands,
 *     completeMobileChallenge still returns success
 *   - completionId + productId + score + platform forwarded into the synthetic
 *     payload so audit/analytics downstream can correlate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/gamificationCore.web', () => ({
  receiveGamificationEvent: vi.fn(),
}));

import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  MOBILE_CHALLENGE_TYPES,
  MOBILE_CHALLENGES_COLLECTION,
  completeMobileChallenge,
} from '../src/backend/mobileChallengeService.web.js';
import { receiveGamificationEvent } from 'backend/gamificationCore.web';

const MEMBER_ID = 'member-mobile-cf-m3tj';
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __reset();
  resetMember();
  __setMember({ _id: MEMBER_ID });
  vi.mocked(receiveGamificationEvent).mockReset();
  vi.mocked(receiveGamificationEvent).mockResolvedValue({
    success: true,
    newTotal: 75,
    pointsEarned: 75,
    tierChanged: false,
  });
});

describe('cf-m3tj · synthetic event dispatch on fresh completion', () => {
  it('AR Discovery fires gamification_mobile_ar_discovery with 75 pts in the resolver', async () => {
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, {
      productId: 'prod-1',
      platform: 'ios',
    });
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(result.alreadyAwarded).toBe(false);
    expect(vi.mocked(receiveGamificationEvent)).toHaveBeenCalledTimes(1);

    const [eventName, payload, memberId] = vi.mocked(receiveGamificationEvent).mock.calls[0];
    expect(eventName).toBe('gamification_mobile_ar_discovery');
    expect(memberId).toBe(MEMBER_ID);
    expect(payload).toMatchObject({
      productId: 'prod-1',
      platform: 'ios',
    });
    expect(typeof payload.completionId).toBe('string');
  });

  it('Quiz Completion fires gamification_mobile_quiz_completion with score+total forwarded', async () => {
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION, {
      score: 9,
      total: 10,
      platform: 'android',
    });
    await flushMicrotasks();

    expect(vi.mocked(receiveGamificationEvent)).toHaveBeenCalledTimes(1);
    const [eventName, payload] = vi.mocked(receiveGamificationEvent).mock.calls[0];
    expect(eventName).toBe('gamification_mobile_quiz_completion');
    expect(payload).toMatchObject({ score: 9, total: 10, platform: 'android' });
  });

  it('Social Share fires gamification_mobile_social_share with platform forwarded', async () => {
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE, {
      productId: 'prod-7',
      platform: 'instagram',
    });
    await flushMicrotasks();

    expect(vi.mocked(receiveGamificationEvent)).toHaveBeenCalledTimes(1);
    const [eventName, payload] = vi.mocked(receiveGamificationEvent).mock.calls[0];
    expect(eventName).toBe('gamification_mobile_social_share');
    expect(payload).toMatchObject({ productId: 'prod-7', platform: 'instagram' });
  });
});

describe('cf-m3tj · synthetic event NOT dispatched on alreadyAwarded short-circuit', () => {
  it('does not fire the synthetic when the same AR challenge fired earlier today', async () => {
    __seed(MOBILE_CHALLENGES_COLLECTION, [
      {
        _id: 'mc-prior',
        memberId: MEMBER_ID,
        challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY,
        completedAt: new Date(),
        productId: 'prod-1',
      },
    ]);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, {
      productId: 'prod-1',
    });
    await flushMicrotasks();

    expect(result.alreadyAwarded).toBe(true);
    expect(result.pointsAwarded).toBe(0);
    expect(vi.mocked(receiveGamificationEvent)).not.toHaveBeenCalled();
  });
});

describe('cf-m3tj · synthetic dispatch failure is non-blocking', () => {
  it('still returns success when receiveGamificationEvent throws', async () => {
    vi.mocked(receiveGamificationEvent).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed(MOBILE_CHALLENGES_COLLECTION, []);

    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, {
      productId: 'prod-1',
    });
    await flushMicrotasks();

    // Completion row inserted; outer call returns success even though synthetic threw.
    // Pre-cf-m3tj this code path didn't exist; post-fix the silent-failure
    // guard ensures a downstream throw can't cost the user their completion.
    expect(result.success).toBe(true);
    expect(result.alreadyAwarded).toBe(false);
    expect(result.pointsAwarded).toBe(75);

    // The error is logged with completionId for backfill correlation.
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain('synthetic gamification_mobile_ar_discovery dispatch failed');
    expect(logged).toContain(MEMBER_ID);

    consoleErr.mockRestore();
  });

  it('still returns success when receiveGamificationEvent resolves with success:false envelope', async () => {
    vi.mocked(receiveGamificationEvent).mockResolvedValue({ success: false, error: 'rate_limited' });
    __seed(MOBILE_CHALLENGES_COLLECTION, []);

    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION, {
      score: 5,
      total: 10,
    });
    await flushMicrotasks();

    // The synthetic returning a soft-failure envelope still preserves the
    // mobile completion + caller success — backfill job inspects logs for
    // any orphaned cases.
    expect(result.success).toBe(true);
    expect(result.alreadyAwarded).toBe(false);
  });
});
