/**
 * arDiscoveryBackend.test.js
 * CF-0gly — gamification_ar_discovery event: one-time 25pt bonus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __seedQueryError,
  __setQueryError,
} from './__mocks__/wix-data.js';

const MEMBER_ID = 'mem-ar-1';

// We need to import after mocks are set up
const { receiveGamificationEvent } = await import('../src/backend/gamificationCore.web.js');

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  // Seed a member with 100 points
  __seed('MemberPoints', [{
    _id: 'mp-1',
    memberId: MEMBER_ID,
    totalPoints: 100,
    currentStreakDays: 0,
    streakStartDate: null,
    lastActivityDate: null,
    streakMultiplier: 1,
    milestoneBonus: 0,
    graceTokenUsedDate: null,
    graceApplied: false,
  }]);
});

describe('gamification_ar_discovery — one-time bonus (CF-0gly)', () => {
  it('awards 25 points on first AR discovery', async () => {
    // No prior ar_discovery events
    __seed('AnalyticsEvents', []);
    const result = await receiveGamificationEvent('gamification_ar_discovery', {}, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(25);
    expect(result.newTotal).toBe(125);
  });

  it('awards 0 points when AR discovery already happened', async () => {
    // Prior ar_discovery event exists
    __seed('AnalyticsEvents', [
      { memberId: MEMBER_ID, eventType: 'ar_discovery' },
    ]);
    const result = await receiveGamificationEvent('gamification_ar_discovery', {}, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(0);
  });

  it('awards 0 points when cap check fails (fail closed)', async () => {
    __setQueryError('AnalyticsEvents', new Error('DB unavailable'));
    const result = await receiveGamificationEvent('gamification_ar_discovery', {}, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(0);
  });
});
