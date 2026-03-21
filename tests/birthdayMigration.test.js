/**
 * Tests for CF-zf97: birthday field migration
 *
 * Covers:
 *  - _parseBirthdayMonthDay: correct UTC month/day extraction
 *  - wixMembers_onMemberUpdated: syncs birthday_month/birthday_day on update
 *  - wixMembers_onMemberUpdated: preserves existing fields (get+spread pattern)
 *  - wixMembers_onMemberUpdated: no-ops for missing ID/birthday/record
 *  - wixMembers_onMemberUpdated: logs warning for unparseable birthday
 *  - wixMembers_onMemberUpdated: logs error + logFailedEvent on wixData failure
 *  - wixMembers_onMemberUpdated: contactDetails.birthdate takes priority over root
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __onUpdate, __reset as __resetData, __seed } from './__mocks__/wix-data.js';

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

  it('uses UTC to avoid timezone shift (date at timezone boundary)', () => {
    // 1990-05-16T02:30:00+05:30 is midnight UTC on May 15 minus 2.5h = May 15 in UTC.
    // A US Eastern midnight (UTC-5) for '1990-05-15' would be May 15 20:00 UTC.
    // Use an explicit UTC time to verify UTC extraction is used.
    const result = _parseBirthdayMonthDay('1990-05-15T23:59:59Z');
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
    expect(_parseBirthdayMonthDay(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it('handles Date object input', () => {
    const d = new Date('1990-05-15T00:00:00.000Z');
    expect(_parseBirthdayMonthDay(d)).toEqual({ month: 5, day: 15 });
  });
});

// ── wixMembers_onMemberUpdated ────────────────────────────────────────

describe('wixMembers_onMemberUpdated', () => {
  it('writes birthday_month and birthday_day when birthday is set (contactDetails)', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-1', loginEmail: 'a@b.com' }]);
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

  it('preserves existing fields on the member record (get+spread)', async () => {
    __seed('Members/PrivateMembersData', [
      { _id: 'member-1', loginEmail: 'a@b.com', phone: '+15550001234', customField: 'keep-me' },
    ]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-1', contactDetails: { birthdate: '1990-05-15' } },
    });

    expect(updated[0].item.loginEmail).toBe('a@b.com');
    expect(updated[0].item.phone).toBe('+15550001234');
    expect(updated[0].item.customField).toBe('keep-me');
  });

  it('writes birthday_month and birthday_day when birthday is on event root (legacy shape)', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-2', loginEmail: 'b@b.com' }]);
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

  it('contactDetails.birthdate takes priority over root birthdate', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-x' }]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: {
        _id: 'member-x',
        contactDetails: { birthdate: '2000-03-10' },
        birthdate: '1999-11-25', // root should be ignored
      },
    });

    expect(updated[0].item.birthday_month).toBe(3);
    expect(updated[0].item.birthday_day).toBe(10);
  });

  it('falls back to root birthdate when contactDetails.birthdate is null', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-y' }]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: {
        _id: 'member-y',
        contactDetails: { birthdate: null },
        birthdate: '1988-07-04',
      },
    });

    expect(updated[0].item.birthday_month).toBe(7);
    expect(updated[0].item.birthday_day).toBe(4);
  });

  it('is a no-op when memberId is absent', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { contactDetails: { birthdate: '1990-05-15' } }, // no _id
    });

    expect(updated).toHaveLength(0);
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

  it('is a no-op when no PrivateMembersData record exists for member', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    // No __seed — wixData.get returns null
    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-ghost', contactDetails: { birthdate: '1990-05-15' } },
    });

    expect(updated).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no PrivateMembersData record'),
      'member-ghost',
    );
    warnSpy.mockRestore();
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

  it('logs error with memberId and does not throw when wixData.update fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed('Members/PrivateMembersData', [{ _id: 'member-6' }]);
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

  it('calls logFailedEvent (inserts to FailedEvents) when wixData.update fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed('Members/PrivateMembersData', [{ _id: 'member-6b' }]);
    __onUpdate(() => { throw new Error('timeout'); });

    const inserted = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => inserted.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-6b', contactDetails: { birthdate: '1990-05-15' } },
    });

    const dlq = inserted.filter(i => i.col === 'FailedEvents');
    expect(dlq).toHaveLength(1);
    expect(dlq[0].item.handler).toBe('wixMembers_onMemberUpdated');
    vi.restoreAllMocks();
  });

  it('uses event.entity shape with contactDetails.birthdate', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-7' }]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixMembers_onMemberUpdated({
      entity: { _id: 'member-7', contactDetails: { birthdate: '2000-01-01' } },
    });

    expect(updated[0].item.birthday_month).toBe(1);
    expect(updated[0].item.birthday_day).toBe(1);
  });
});
