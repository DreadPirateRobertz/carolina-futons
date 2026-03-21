/**
 * Tests for CF-zf97: birthday field migration
 *
 * Covers:
 *  - _parseBirthdayMonthDay: correct UTC month/day extraction
 *  - wixMembers_onMemberUpdated: syncs birthday_month/birthday_day on update
 *  - wixMembers_onMemberUpdated: no-ops for missing/unparseable birthday
 *  - wixMembers_onMemberUpdated: logs warning for unparseable birthday
 *  - wixMembers_onMemberUpdated: logs error on wixData.update failure
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __onUpdate, __reset as __resetData } from './__mocks__/wix-data.js';

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
}));

vi.mock('backend/emailAutomation.web', () => ({
  triggerRestockNotifications: vi.fn().mockResolvedValue({}),
  triggerWelcomeSequence: vi.fn().mockResolvedValue({}),
  triggerPostPurchaseSequence: vi.fn().mockResolvedValue({}),
  cancelSequenceForOrder: vi.fn().mockResolvedValue({}),
}));

import {
  _parseBirthdayMonthDay,
  wixMembers_onMemberUpdated,
} from '../src/backend/events.js';

beforeEach(() => {
  __resetData();
  vi.clearAllMocks();
});

// ── _parseBirthdayMonthDay ────────────────────────────────────────────

describe('_parseBirthdayMonthDay', () => {
  it('returns correct month and day for ISO date string', () => {
    expect(_parseBirthdayMonthDay('1990-05-15')).toEqual({ month: 5, day: 15 });
  });

  it('returns correct month and day for ISO datetime string', () => {
    expect(_parseBirthdayMonthDay('1985-12-25T00:00:00.000Z')).toEqual({ month: 12, day: 25 });
  });

  it('returns correct values for January 1', () => {
    expect(_parseBirthdayMonthDay('2000-01-01')).toEqual({ month: 1, day: 1 });
  });

  it('returns correct values for December 31', () => {
    expect(_parseBirthdayMonthDay('1975-12-31')).toEqual({ month: 12, day: 31 });
  });

  it('uses UTC to avoid timezone shift (bare date string)', () => {
    // "1990-05-15" is midnight UTC — any local timezone should yield month=5, day=15
    const result = _parseBirthdayMonthDay('1990-05-15');
    expect(result.month).toBe(5);
    expect(result.day).toBe(15);
  });

  it('returns null for null', () => {
    expect(_parseBirthdayMonthDay(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(_parseBirthdayMonthDay(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(_parseBirthdayMonthDay('')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(_parseBirthdayMonthDay('not-a-date')).toBeNull();
  });

  it('returns null for random number', () => {
    expect(_parseBirthdayMonthDay(99999999999999999)).toBeNull();
  });

  it('handles Date object input', () => {
    const d = new Date('1990-05-15T00:00:00.000Z');
    expect(_parseBirthdayMonthDay(d)).toEqual({ month: 5, day: 15 });
  });
});

// ── wixMembers_onMemberUpdated ────────────────────────────────────────

describe('wixMembers_onMemberUpdated', () => {
  it('writes birthday_month and birthday_day when birthday is set (contactDetails)', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: {
        _id: 'member-1',
        contactDetails: { birthdate: '1990-05-15' },
      },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].col).toBe('Members/PrivateMembersData');
    expect(updated[0].item._id).toBe('member-1');
    expect(updated[0].item.birthday_month).toBe(5);
    expect(updated[0].item.birthday_day).toBe(15);
  });

  it('writes birthday_month and birthday_day when birthday is on event root (legacy shape)', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: {
        _id: 'member-2',
        birthdate: '1985-12-25',
      },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].item.birthday_month).toBe(12);
    expect(updated[0].item.birthday_day).toBe(25);
  });

  it('is a no-op when birthday is absent', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({ entity: { _id: 'member-3' } });

    expect(updated).toHaveLength(0);
  });

  it('is a no-op when birthday is null', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-4', contactDetails: { birthdate: null } },
    });

    expect(updated).toHaveLength(0);
  });

  it('logs warning and does not update for unparseable birthday', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-5', contactDetails: { birthdate: 'not-a-date' } },
    });

    expect(updated).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unparseable birthday'),
      'member-5',
      expect.anything(),
      'not-a-date',
    );
    warnSpy.mockRestore();
  });

  it('logs error and does not throw when wixData.update fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __onUpdate(() => { throw new Error('Wix Data unavailable'); });

    await expect(
      wixMembers_onMemberUpdated({
        entity: { _id: 'member-6', contactDetails: { birthdate: '1990-05-15' } },
      })
    ).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to sync birthday fields'),
      expect.stringContaining('Wix Data unavailable'),
    );
    errorSpy.mockRestore();
  });

  it('uses event.entity shape with contactDetails.birthdate', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-7', contactDetails: { birthdate: '2000-01-01' } },
    });

    expect(updated[0].item.birthday_month).toBe(1);
    expect(updated[0].item.birthday_day).toBe(1);
  });
});
