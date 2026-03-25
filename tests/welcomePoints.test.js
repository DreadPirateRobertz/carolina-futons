/**
 * welcomePoints.test.js
 * CF-9swp — Endowed progress: seed welcome points on first member creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __setQueryError,
  __onInsert,
} from './__mocks__/wix-data.js';

import { seedWelcomePoints } from '../src/backend/gamificationEventReceiver.web.js';

const MEMBER_ID = 'mem-welcome-1';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

describe('seedWelcomePoints (CF-9swp)', () => {
  it('creates MemberPoints record with 50 welcome points for new member', async () => {
    const result = await seedWelcomePoints(MEMBER_ID);
    expect(result.seeded).toBe(true);
    expect(result.points).toBe(50);

    const inserted = __getInserted('MemberPoints');
    const welcome = inserted.find(r => r.memberId === MEMBER_ID);
    expect(welcome).toBeDefined();
    expect(welcome.totalPoints).toBe(50);
  });

  it('does not create a record if member already has one', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-existing',
      memberId: MEMBER_ID,
      totalPoints: 200,
    }]);

    const result = await seedWelcomePoints(MEMBER_ID);
    expect(result.seeded).toBe(false);
    expect(result.points).toBe(200);
  });

  it('accepts custom welcome points amount', async () => {
    const result = await seedWelcomePoints(MEMBER_ID, 100);
    expect(result.seeded).toBe(true);
    expect(result.points).toBe(100);

    const inserted = __getInserted('MemberPoints');
    const welcome = inserted.find(r => r.memberId === MEMBER_ID);
    expect(welcome.totalPoints).toBe(100);
  });

  it('returns { seeded: false, points: 0 } when memberId is falsy', async () => {
    const result = await seedWelcomePoints('');
    expect(result.seeded).toBe(false);
    expect(result.points).toBe(0);
  });

  it('returns { seeded: false, points: 0 } on DB error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await seedWelcomePoints(MEMBER_ID);
    expect(result.seeded).toBe(false);
    expect(result.points).toBe(0);
  });

  it('sets initial streak and tier fields correctly', async () => {
    await seedWelcomePoints(MEMBER_ID);
    const inserted = __getInserted('MemberPoints');
    const welcome = inserted.find(r => r.memberId === MEMBER_ID);
    expect(welcome.currentStreakDays).toBe(0);
    expect(welcome.streakMultiplier).toBe(1);
    expect(welcome.bonusSpinsAvailable).toBe(0);
  });

  it('is idempotent — second call returns existing record', async () => {
    const first = await seedWelcomePoints(MEMBER_ID);
    expect(first.seeded).toBe(true);

    // Seed the record that was just "inserted" so the second call finds it
    __seed('MemberPoints', [{ _id: 'mp-new', memberId: MEMBER_ID, totalPoints: 50 }]);
    const second = await seedWelcomePoints(MEMBER_ID);
    expect(second.seeded).toBe(false);
    expect(second.points).toBe(50);
  });
});
