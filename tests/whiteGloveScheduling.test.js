/**
 * Tests for src/backend/whiteGloveScheduling.web.js
 *
 * Covers: getWhiteGloveSlots, bookWhiteGloveDelivery, getMyWhiteGloveAppointment,
 *         rescheduleWhiteGlove, blockDeliveryDate, unblockDeliveryDate,
 *         getBlockedDates, getAdminCalendar, getWindowLabels
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate, __onRemove } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getWhiteGloveSlots,
  bookWhiteGloveDelivery,
  getMyWhiteGloveAppointment,
  rescheduleWhiteGlove,
  blockDeliveryDate,
  unblockDeliveryDate,
  getBlockedDates,
  getAdminCalendar,
  getWindowLabels,
} from '../src/backend/whiteGloveScheduling.web.js';

const MEMBER = { _id: 'mem-1', loginEmail: 'brenda@example.com' };

beforeEach(() => {
  resetData();
  __setMember(MEMBER);
  __seed('WhiteGloveAppointments', []);
  __seed('BlockedDeliveryDates', []);
});

// ── helpers ───────────────────────────────────────────────────────────

function futureDate(offsetDays = 2) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Advance to next Mon-Sat if on Sunday
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function makeAppt(overrides = {}) {
  return {
    _id: 'appt-1',
    orderId: 'order-1',
    memberId: MEMBER._id,
    appointmentDate: futureDate(3),
    window: 'morning',
    status: 'confirmed',
    customerEmail: 'alice@example.com',
    customerPhone: '555-1234',
    address: '123 Main St',
    notes: '',
    rescheduleCount: 0,
    ...overrides,
  };
}

// ── getWindowLabels ───────────────────────────────────────────────────

describe('getWindowLabels', () => {
  it('returns all three windows with keys and labels', () => {
    const result = getWindowLabels();
    expect(result).toHaveLength(3);
    const keys = result.map(w => w.key);
    expect(keys).toContain('morning');
    expect(keys).toContain('midday');
    expect(keys).toContain('afternoon');
    result.forEach(w => {
      expect(w.label).toBeTruthy();
    });
  });
});

// ── getWhiteGloveSlots ────────────────────────────────────────────────

describe('getWhiteGloveSlots', () => {
  it('returns success with slots array', async () => {
    const result = await getWhiteGloveSlots(null);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.slots)).toBe(true);
  });

  it('returns only Mon-Sat slots (no Sundays)', async () => {
    const result = await getWhiteGloveSlots(null);
    for (const slot of result.slots) {
      const day = new Date(slot.date + 'T12:00:00').getDay();
      expect(day).not.toBe(0); // no Sunday
    }
  });

  it('includes three windows per available date', async () => {
    const result = await getWhiteGloveSlots(null);
    const dateMap = {};
    for (const slot of result.slots) {
      dateMap[slot.date] = (dateMap[slot.date] || []).concat(slot.window);
    }
    for (const [, windows] of Object.entries(dateMap)) {
      expect(windows).toContain('morning');
      expect(windows).toContain('midday');
      expect(windows).toContain('afternoon');
    }
  });

  it('marks slots as available when no bookings exist', async () => {
    const result = await getWhiteGloveSlots(null);
    for (const slot of result.slots) {
      expect(slot.available).toBe(true);
      expect(slot.spotsLeft).toBeGreaterThan(0);
    }
  });

  it('marks a slot as unavailable when fully booked', async () => {
    const result = await getWhiteGloveSlots(null);
    const firstSlot = result.slots[0];

    // Seed 3 bookings for that slot (MAX_PER_WINDOW = 3)
    __seed('WhiteGloveAppointments', [
      { _id: 'a1', appointmentDate: firstSlot.date, window: firstSlot.window, status: 'confirmed' },
      { _id: 'a2', appointmentDate: firstSlot.date, window: firstSlot.window, status: 'confirmed' },
      { _id: 'a3', appointmentDate: firstSlot.date, window: firstSlot.window, status: 'confirmed' },
    ]);

    const result2 = await getWhiteGloveSlots(null);
    const full = result2.slots.find(s => s.date === firstSlot.date && s.window === firstSlot.window);
    expect(full.available).toBe(false);
    expect(full.spotsLeft).toBe(0);
  });

  it('excludes blocked dates from results', async () => {
    const result = await getWhiteGloveSlots(null);
    const firstDate = result.slots[0]?.date;
    if (!firstDate) return; // no slots in test env — skip

    __seed('BlockedDeliveryDates', [
      { _id: 'b1', blockedDate: firstDate, reason: 'holiday' },
    ]);

    const result2 = await getWhiteGloveSlots(null);
    const found = result2.slots.some(s => s.date === firstDate);
    expect(found).toBe(false);
  });

  it('includes dayOfWeek and label in each slot', async () => {
    const result = await getWhiteGloveSlots(null);
    if (result.slots.length === 0) return;
    const slot = result.slots[0];
    expect(slot.dayOfWeek).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat/);
    expect(slot.label).toBeTruthy();
  });

  it('does not include past dates', async () => {
    const result = await getWhiteGloveSlots(null);
    // Use local-midnight string (same basis as the source) to avoid
    // UTC-vs-local mismatch: "tomorrow local" can equal "today UTC" on MT evenings.
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const today = todayLocal.toISOString().split('T')[0];
    for (const slot of result.slots) {
      expect(slot.date >= today).toBe(true);
    }
  });
});

// ── bookWhiteGloveDelivery ────────────────────────────────────────────

describe('bookWhiteGloveDelivery', () => {
  it('inserts confirmed appointment with valid data', async () => {
    const dateStr = futureDate(3);
    let inserted = null;
    let updated  = null;
    // Filter by collection — auditLog also calls insert and would overwrite otherwise
    __onInsert((col, item) => { if (col === 'WhiteGloveAppointments') inserted = item; });
    __onUpdate((col, item) => { if (col === 'WhiteGloveAppointments') updated = item; });

    const result = await bookWhiteGloveDelivery({
      orderId: 'order-1',
      appointmentDate: dateStr,
      window: 'morning',
      customerEmail: 'alice@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data.appointmentDate).toBe(dateStr);
    expect(result.data.window).toBe('morning');
    expect(result.data.windowLabel).toContain('10:00');
    expect(inserted?.status).toBe('pending');
    expect(updated?.status).toBe('confirmed');
  });

  it('returns error for missing required fields', async () => {
    const result = await bookWhiteGloveDelivery({ window: 'morning' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects invalid window', async () => {
    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: futureDate(2),
      window: 'midnighttrain',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('window');
  });

  it('rejects past dates', async () => {
    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: '2020-01-06', // Monday, definitely past
      window: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('future');
  });

  it('rejects Sunday dates', async () => {
    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: '2026-04-05', // verified Sunday
      window: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Monday');
  });

  it('rejects blocked dates', async () => {
    const dateStr = futureDate(3);
    __seed('BlockedDeliveryDates', [{ _id: 'b1', blockedDate: dateStr, reason: 'holiday' }]);

    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: dateStr,
      window: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('rejects duplicate bookings for the same order', async () => {
    const dateStr = futureDate(3);
    __seed('WhiteGloveAppointments', [makeAppt({ appointmentDate: dateStr })]);

    const result = await bookWhiteGloveDelivery({
      orderId: 'order-1',
      appointmentDate: dateStr,
      window: 'midday',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already booked');
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: futureDate(2),
      window: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated');
  });

  it('returns error for invalid date format', async () => {
    const result = await bookWhiteGloveDelivery({
      orderId: 'o1',
      appointmentDate: '13/01/2026',
      window: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('date');
  });

  it('rolls back pending insert when slot is full', async () => {
    const dateStr = futureDate(3);
    // Seed 3 existing bookings (MAX_PER_WINDOW = 3)
    __seed('WhiteGloveAppointments', [
      { _id: 'a1', appointmentDate: dateStr, window: 'morning', status: 'confirmed' },
      { _id: 'a2', appointmentDate: dateStr, window: 'morning', status: 'confirmed' },
      { _id: 'a3', appointmentDate: dateStr, window: 'morning', status: 'confirmed' },
    ]);

    let removedId = null;
    __onRemove((_col, id) => { removedId = id; });

    const result = await bookWhiteGloveDelivery({
      orderId: 'order-2',
      appointmentDate: dateStr,
      window: 'morning',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('full');
    expect(removedId).toBeTruthy(); // rollback happened
  });
});

// ── getMyWhiteGloveAppointment ────────────────────────────────────────

describe('getMyWhiteGloveAppointment', () => {
  it('returns null data when no appointment exists', async () => {
    const result = await getMyWhiteGloveAppointment('order-1');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns appointment data for matching order + member', async () => {
    const appt = makeAppt();
    __seed('WhiteGloveAppointments', [appt]);

    const result = await getMyWhiteGloveAppointment('order-1');
    expect(result.success).toBe(true);
    expect(result.data._id).toBe('appt-1');
    expect(result.data.windowLabel).toBeTruthy();
    expect(result.data.canReschedule).toBe(true);
  });

  it('canReschedule is false when rescheduleCount is at limit', async () => {
    __seed('WhiteGloveAppointments', [makeAppt({ rescheduleCount: 1 })]);
    const result = await getMyWhiteGloveAppointment('order-1');
    expect(result.data.canReschedule).toBe(false);
  });

  it('does not return cancelled appointments', async () => {
    __seed('WhiteGloveAppointments', [makeAppt({ status: 'cancelled' })]);
    const result = await getMyWhiteGloveAppointment('order-1');
    expect(result.data).toBeNull();
  });

  it('returns error for not authenticated', async () => {
    __setMember(null);
    const result = await getMyWhiteGloveAppointment('order-1');
    expect(result.success).toBe(false);
  });

  it('returns error for invalid order ID', async () => {
    const result = await getMyWhiteGloveAppointment('');
    expect(result.success).toBe(false);
  });
});

// ── rescheduleWhiteGlove ──────────────────────────────────────────────

describe('rescheduleWhiteGlove', () => {
  it('reschedules and increments rescheduleCount', async () => {
    const appt = makeAppt({ _id: 'appt-1', rescheduleCount: 0 });
    __seed('WhiteGloveAppointments', [appt]);
    let updated = null;
    __onUpdate((_col, item) => { updated = item; });

    const newDate = futureDate(5);
    const result = await rescheduleWhiteGlove('appt-1', newDate, 'afternoon');

    expect(result.success).toBe(true);
    expect(result.data.appointmentDate).toBe(newDate);
    expect(result.data.window).toBe('afternoon');
    expect(updated?.rescheduleCount).toBe(1);
  });

  it('blocks second reschedule (at limit)', async () => {
    __seed('WhiteGloveAppointments', [makeAppt({ rescheduleCount: 1 })]);
    const result = await rescheduleWhiteGlove('appt-1', futureDate(6), 'midday');
    expect(result.success).toBe(false);
    expect(result.error).toContain('reschedule');
  });

  it('returns error for appointment not found', async () => {
    const result = await rescheduleWhiteGlove('appt-99', futureDate(4), 'morning');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for cancelled appointment', async () => {
    __seed('WhiteGloveAppointments', [makeAppt({ status: 'cancelled' })]);
    const result = await rescheduleWhiteGlove('appt-1', futureDate(4), 'morning');
    expect(result.success).toBe(false);
  });

  it('rejects blocked date on reschedule', async () => {
    const appt = makeAppt({ rescheduleCount: 0 });
    const newDate = futureDate(5);
    __seed('WhiteGloveAppointments', [appt]);
    __seed('BlockedDeliveryDates', [{ _id: 'b1', blockedDate: newDate, reason: 'holiday' }]);

    const result = await rescheduleWhiteGlove('appt-1', newDate, 'morning');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await rescheduleWhiteGlove('appt-1', futureDate(4), 'morning');
    expect(result.success).toBe(false);
  });
});

// ── blockDeliveryDate ─────────────────────────────────────────────────

describe('blockDeliveryDate', () => {
  it('inserts a blocked date with reason', async () => {
    let inserted = null;
    __onInsert((_col, item) => { if (_col === 'BlockedDeliveryDates') inserted = item; });

    const result = await blockDeliveryDate('2026-07-04', 'Independence Day');

    expect(result.success).toBe(true);
    expect(result.data.blockedDate).toBe('2026-07-04');
    expect(inserted?.reason).toBe('Independence Day');
  });

  it('updates reason when date is already blocked', async () => {
    __seed('BlockedDeliveryDates', [
      { _id: 'b1', blockedDate: '2026-07-04', reason: 'Old reason' },
    ]);
    let updated = null;
    __onUpdate((_col, item) => { updated = item; });

    const result = await blockDeliveryDate('2026-07-04', 'New reason');
    expect(result.success).toBe(true);
    expect(updated?.reason).toBe('New reason');
  });

  it('returns error for invalid date format', async () => {
    const result = await blockDeliveryDate('07-04-2026', 'holiday');
    expect(result.success).toBe(false);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('allows empty reason', async () => {
    const result = await blockDeliveryDate('2026-12-25', '');
    expect(result.success).toBe(true);
  });
});

// ── unblockDeliveryDate ───────────────────────────────────────────────

describe('unblockDeliveryDate', () => {
  it('removes the blocked date', async () => {
    __seed('BlockedDeliveryDates', [
      { _id: 'b1', blockedDate: '2026-07-04', reason: 'holiday' },
    ]);
    let removedId = null;
    __onRemove((_col, id) => { removedId = id; });

    const result = await unblockDeliveryDate('2026-07-04');
    expect(result.success).toBe(true);
    expect(removedId).toBe('b1');
  });

  it('returns error when date is not blocked', async () => {
    const result = await unblockDeliveryDate('2026-07-04');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not blocked');
  });

  it('returns error for invalid date format', async () => {
    const result = await unblockDeliveryDate('notadate');
    expect(result.success).toBe(false);
  });
});

// ── getBlockedDates ───────────────────────────────────────────────────

describe('getBlockedDates', () => {
  it('returns empty array when none blocked', async () => {
    const result = await getBlockedDates();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('returns blocked dates in ascending order', async () => {
    __seed('BlockedDeliveryDates', [
      { _id: 'b1', blockedDate: '2026-07-04', reason: 'holiday' },
      { _id: 'b2', blockedDate: '2026-08-01', reason: 'inventory' },
    ]);
    const result = await getBlockedDates();
    expect(result.success).toBe(true);
    expect(result.data[0].blockedDate).toBe('2026-07-04');
    expect(result.data[1].blockedDate).toBe('2026-08-01');
  });

  it('includes blockedDate and reason in each item', async () => {
    __seed('BlockedDeliveryDates', [
      { _id: 'b1', blockedDate: '2026-07-04', reason: 'holiday' },
    ]);
    const result = await getBlockedDates();
    expect(result.data[0].blockedDate).toBe('2026-07-04');
    expect(result.data[0].reason).toBe('holiday');
  });
});

// ── getAdminCalendar ──────────────────────────────────────────────────

describe('getAdminCalendar', () => {
  it('returns appointments in date range', async () => {
    __seed('WhiteGloveAppointments', [
      makeAppt({ _id: 'a1', appointmentDate: '2026-07-10', window: 'morning', status: 'confirmed' }),
      makeAppt({ _id: 'a2', appointmentDate: '2026-07-15', window: 'afternoon', status: 'confirmed' }),
    ]);

    const result = await getAdminCalendar('2026-07-01', '2026-07-31');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('excludes cancelled appointments', async () => {
    __seed('WhiteGloveAppointments', [
      makeAppt({ _id: 'a1', appointmentDate: '2026-07-10', status: 'cancelled' }),
      makeAppt({ _id: 'a2', appointmentDate: '2026-07-11', status: 'confirmed' }),
    ]);
    const result = await getAdminCalendar('2026-07-01', '2026-07-31');
    expect(result.data).toHaveLength(1);
  });

  it('includes windowLabel, customerEmail, address in results', async () => {
    __seed('WhiteGloveAppointments', [
      makeAppt({ appointmentDate: '2026-07-10' }),
    ]);
    const result = await getAdminCalendar('2026-07-01', '2026-07-31');
    const a = result.data[0];
    expect(a.windowLabel).toBeTruthy();
    expect(a.customerEmail).toBe('alice@example.com');
    expect(a.address).toBe('123 Main St');
  });

  it('returns error for invalid date range', async () => {
    const result = await getAdminCalendar('bad-date', '2026-07-31');
    expect(result.success).toBe(false);
    expect(result.error).toContain('date');
  });

  it('returns empty data for date range with no appointments', async () => {
    const result = await getAdminCalendar('2026-01-01', '2026-01-02');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});
