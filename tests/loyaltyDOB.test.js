// Tests for cf-c5z6: loyalty DOB capture — saveBirthday + enrollMember MemberProfiles sync
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import {
  saveBirthday,
  enrollMember,
} from '../src/backend/loyaltyMarketing.web.js';

beforeEach(() => {
  __reset();
});

// ── saveBirthday ──────────────────────────────────────────────────────────────

describe('saveBirthday', () => {
  it('saves birthdayMonth and birthdayDay to MemberProfiles', async () => {
    __seed('LoyaltyAccounts', [{ _id: 'acc-1', memberId: 'mem-1', totalPoints: 100 }]);
    __seed('PointsHistory', []);

    const result = await saveBirthday('mem-1', 6, 15);

    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(50);
    const profiles = __getInserted('MemberProfiles');
    expect(profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: 'mem-1', birthdayMonth: 6, birthdayDay: 15 }),
    ]));
  });

  it('awards 50 bonus points and logs PointsHistory', async () => {
    __seed('LoyaltyAccounts', [{ _id: 'acc-1', memberId: 'mem-1', totalPoints: 100 }]);

    const result = await saveBirthday('mem-1', 3, 8);

    expect(result.pointsAwarded).toBe(50);
    const history = __getInserted('PointsHistory');
    const entry = history.find(h => h.source === 'birthday_enrollment');
    expect(entry).toBeDefined();
    expect(entry.points).toBe(50);
    expect(entry.memberId).toBe('mem-1');
  });

  it('updates LoyaltyAccounts.totalPoints', async () => {
    __seed('LoyaltyAccounts', [{ _id: 'acc-1', memberId: 'mem-1', totalPoints: 200 }]);

    await saveBirthday('mem-1', 12, 25);

    const updated = __getUpdated('LoyaltyAccounts');
    expect(updated[0].totalPoints).toBe(250);
  });

  it('returns already_set when birthdayMonth already in MemberProfiles', async () => {
    __seed('MemberProfiles', [{ memberId: 'mem-1', birthdayMonth: 4, birthdayDay: 10 }]);

    const result = await saveBirthday('mem-1', 6, 15);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_set');
  });

  it('does not double-award when PointsHistory already has birthday_enrollment', async () => {
    __seed('LoyaltyAccounts', [{ _id: 'acc-1', memberId: 'mem-1', totalPoints: 150 }]);
    __seed('PointsHistory', [{ memberId: 'mem-1', source: 'birthday_enrollment', points: 50 }]);

    const result = await saveBirthday('mem-1', 7, 4);

    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(0);
    // LoyaltyAccounts should NOT be updated
    expect(__getUpdated('LoyaltyAccounts')).toHaveLength(0);
  });

  it('saves birthday but awards 0 points when member not enrolled in loyalty', async () => {
    // No LoyaltyAccounts entry
    const result = await saveBirthday('mem-new', 5, 20);

    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(0);
    const profiles = __getInserted('MemberProfiles');
    expect(profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: 'mem-new', birthdayMonth: 5, birthdayDay: 20 }),
    ]));
  });

  it('returns invalid_month for month 0', async () => {
    const result = await saveBirthday('mem-1', 0, 15);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_month');
  });

  it('returns invalid_month for month 13', async () => {
    const result = await saveBirthday('mem-1', 13, 15);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_month');
  });

  it('returns invalid_day for day 0', async () => {
    const result = await saveBirthday('mem-1', 6, 0);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_day');
  });

  it('returns invalid_day for day 32', async () => {
    const result = await saveBirthday('mem-1', 6, 32);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_day');
  });

  it('returns invalid_member for empty memberId', async () => {
    const result = await saveBirthday('', 6, 15);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_member');
  });

  it('updates existing MemberProfiles record when profile exists without birthday', async () => {
    __seed('MemberProfiles', [{ _id: 'prof-1', memberId: 'mem-1', firstName: 'Alice' }]);
    __seed('LoyaltyAccounts', [{ _id: 'acc-1', memberId: 'mem-1', totalPoints: 100 }]);

    await saveBirthday('mem-1', 9, 30);

    const updated = __getUpdated('MemberProfiles');
    expect(updated[0]).toMatchObject({ memberId: 'mem-1', birthdayMonth: 9, birthdayDay: 30, firstName: 'Alice' });
  });
});

// ── enrollMember — MemberProfiles sync ───────────────────────────────────────

describe('enrollMember MemberProfiles sync', () => {
  it('writes birthdayMonth and birthdayDay to MemberProfiles when birthday provided', async () => {
    const result = await enrollMember({
      memberId: 'mem-2',
      email: 'member@example.com',
      birthday: '1990-06-15',
    });

    expect(result.success).toBe(true);
    const profiles = __getInserted('MemberProfiles');
    expect(profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: 'mem-2', birthdayMonth: 6, birthdayDay: 15 }),
    ]));
  });

  it('does not write to MemberProfiles when no birthday provided', async () => {
    await enrollMember({ memberId: 'mem-3', email: 'no-bday@example.com' });

    const profiles = __getInserted('MemberProfiles');
    expect(profiles.filter(p => p.memberId === 'mem-3')).toHaveLength(0);
  });

  it('does not overwrite existing MemberProfiles birthday on enrollment', async () => {
    __seed('MemberProfiles', [{ _id: 'prof-3', memberId: 'mem-4', birthdayMonth: 1, birthdayDay: 1 }]);

    await enrollMember({
      memberId: 'mem-4',
      email: 'existing@example.com',
      birthday: '1985-07-20',
    });

    // The existing profile has birthdayMonth=1 so it should NOT be overwritten
    const updated = __getUpdated('MemberProfiles');
    expect(updated).toHaveLength(0);
  });
});
