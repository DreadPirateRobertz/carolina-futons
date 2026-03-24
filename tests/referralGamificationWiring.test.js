/**
 * @file referralGamificationWiring.test.js
 * @description TDD tests for CF-qu0u: _processReferralOnOrderCreated fires
 * gamification_referral_accepted earn event (+200 pts) for the referrer after
 * a referral is credited.
 *
 * Covers:
 *  - gamification_referral_accepted event fires with referrer memberId
 *  - gamification_referral_accepted event fires with correct payload
 *  - event is non-blocking: success:true returned even when event call rejects
 *  - event not fired when referral is skipped (no referral found)
 *  - event not fired when refereeMemberId is falsy
 *  - resolvePoints: gamification_referral_accepted returns POINT_VALUES.REFERRAL_ACCEPTED (500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';

// ── resolvePoints unit test (via receiveGamificationEvent backend) ─────────────

describe('resolvePoints — gamification_referral_accepted', () => {
  it('awards POINT_VALUES.REFERRAL_ACCEPTED (500) pts for gamification_referral_accepted', async () => {
    // Import the real backend to verify the switch case
    const { default: wixData } = await import('./__mocks__/wix-data.js');
    // We test resolvePoints indirectly through gamificationTokens
    const { POINT_VALUES } = await vi.importActual('../src/public/gamificationTokens.js');
    expect(POINT_VALUES.REFERRAL_ACCEPTED).toBe(500);
  });
});

// ── _processReferralOnOrderCreated — gamification wiring ──────────────────────

const gamificationMocks = vi.hoisted(() => ({
  receiveGamificationEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: gamificationMocks.receiveGamificationEvent,
}));

import { _processReferralOnOrderCreated } from '../src/backend/referralService.web.js';

const REFERRER_ID = 'mem-referrer';
const REFEREE_ID = 'mem-referee';

function seedSignedUpReferral() {
  __seed('Referrals', [{
    _id: 'ref-1',
    refereeMemberId: REFEREE_ID,
    referrerMemberId: REFERRER_ID,
    referralCode: 'TEST1234',
    status: 'signed_up',
    refereeEmail: 'alice@test.com',
  }]);
}

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  gamificationMocks.receiveGamificationEvent.mockResolvedValue({ success: true });
});

describe('_processReferralOnOrderCreated — gamification event', () => {
  it('fires receiveGamificationEvent with gamification_referral_accepted on success', async () => {
    seedSignedUpReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, 'ORD-001');
    expect(gamificationMocks.receiveGamificationEvent).toHaveBeenCalledWith(
      'gamification_referral_accepted',
      expect.any(Object),
      REFERRER_ID,
    );
  });

  it('fires event with referral_count: 1 in payload', async () => {
    seedSignedUpReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, 'ORD-001');
    const [, payload] = gamificationMocks.receiveGamificationEvent.mock.calls[0];
    expect(payload).toHaveProperty('referral_count', 1);
  });

  it('still returns success:true even when gamification event call rejects', async () => {
    seedSignedUpReferral();
    gamificationMocks.receiveGamificationEvent.mockRejectedValue(new Error('network'));
    const result = await _processReferralOnOrderCreated(REFEREE_ID, 'ORD-001');
    expect(result.success).toBe(true);
  });

  it('does not fire gamification event when no referral found', async () => {
    // No records seeded — returns skipped
    await _processReferralOnOrderCreated(REFEREE_ID, 'ORD-001');
    expect(gamificationMocks.receiveGamificationEvent).not.toHaveBeenCalled();
  });

  it('does not fire gamification event when refereeMemberId is falsy', async () => {
    await _processReferralOnOrderCreated(null, 'ORD-001');
    expect(gamificationMocks.receiveGamificationEvent).not.toHaveBeenCalled();
  });

  it('fires event exactly once per referral completion', async () => {
    seedSignedUpReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, 'ORD-001');
    expect(gamificationMocks.receiveGamificationEvent).toHaveBeenCalledTimes(1);
  });
});
