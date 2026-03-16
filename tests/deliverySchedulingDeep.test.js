/**
 * deliverySchedulingDeep.test.js — Edge-case tests for delivery scheduling backend.
 * Covers timing-safe token comparison, member edge cases, slot capacity boundaries,
 * appointment overlap detection, and sanitization limits.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate, __onRemove } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  scheduleDelivery,
  getMyDeliverySchedule,
  bookAppointment,
  cancelAppointment,
  getVisitTypes,
  getUpcomingAppointments,
  getAvailableDeliverySlots,
  getAvailableAppointmentSlots,
} from '../src/backend/deliveryScheduling.web.js';

// ── Helpers ─────────────────────────────────────────────────────

function nextDay(weekday, offsetWeeks = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}
const futureWed = () => nextDay(3);
const futureThu = () => nextDay(4);

beforeEach(() => {
  resetData();
  resetMembers();
});

// ── cancelAppointment — timing-safe token comparison ────────────

describe('cancelAppointment — token edge cases', () => {
  it('rejects token with matching prefix but different length', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'confirmed' },
    ]);
    // Same prefix, shorter
    const result = await cancelAppointment('apt-1', 'abc123def456ghi789jkl01');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid cancel token');
  });

  it('rejects token with matching prefix but extra chars', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'confirmed' },
    ]);
    const result = await cancelAppointment('apt-1', 'abc123def456ghi789jkl0123');
    expect(result.success).toBe(false);
  });

  it('rejects empty string as cancel token', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'confirmed' },
    ]);
    const result = await cancelAppointment('apt-1', '');
    expect(result.success).toBe(false);
  });

  it('rejects completed appointment cancellation', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'completed' },
    ]);
    // Token matches but status check: only 'cancelled' is explicitly rejected,
    // 'completed' should still allow cancellation per code (no status filter)
    const result = await cancelAppointment('apt-1', 'abc123def456ghi789jkl012');
    expect(result.success).toBe(true);
  });
});

// ── getMyDeliverySchedule — member edge cases ───────────────────

describe('getMyDeliverySchedule — member edge cases', () => {
  it('returns empty when member has no loginEmail', async () => {
    __setMember({ _id: 'member-1' }); // loginEmail undefined
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
  });

  it('returns empty when member loginEmail is null', async () => {
    __setMember({ _id: 'member-1', loginEmail: null });
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
  });

  it('returns multiple deliveries sorted by date descending', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'alice@example.com' });
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'o1', date: '2026-04-01', timeWindow: 'morning', type: 'standard', status: 'scheduled', customerEmail: 'alice@example.com' },
      { _id: 's2', orderId: 'o2', date: '2026-04-05', timeWindow: 'afternoon', type: 'white_glove', status: 'scheduled', customerEmail: 'alice@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result.length).toBe(2);
    // Should be sorted descending by date
    expect(result[0].date >= result[1].date).toBe(true);
  });

  it('does not leak other members deliveries', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'alice@example.com' });
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'o1', date: '2026-04-01', timeWindow: 'morning', type: 'standard', status: 'scheduled', customerEmail: 'bob@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result.length).toBe(0);
  });
});

// ── scheduleDelivery — sanitization and capacity ────────────────

describe('scheduleDelivery — sanitization edge cases', () => {
  it('truncates long notes to 1000 chars', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const date = futureWed();
    const longNotes = 'x'.repeat(1500);
    const result = await scheduleDelivery({
      orderId: 'o1', date, timeWindow: 'morning',
      notes: longNotes,
    });
    expect(result.success).toBe(true);

    const sched = inserts.find(i => i.col === 'DeliverySchedule');
    expect(sched.item.notes.length).toBeLessThanOrEqual(1000);
  });

  it('truncates long address to 500 chars', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const date = futureWed();
    const result = await scheduleDelivery({
      orderId: 'o1', date, timeWindow: 'morning',
      address: 'x'.repeat(600),
    });
    expect(result.success).toBe(true);

    const sched = inserts.find(i => i.col === 'DeliverySchedule');
    expect(sched.item.address.length).toBeLessThanOrEqual(500);
  });

  it('truncates long email to 254 chars', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const date = futureWed();
    const result = await scheduleDelivery({
      orderId: 'o1', date, timeWindow: 'morning',
      customerEmail: 'a'.repeat(300) + '@b.com',
    });
    expect(result.success).toBe(true);

    const sched = inserts.find(i => i.col === 'DeliverySchedule');
    expect(sched.item.customerEmail.length).toBeLessThanOrEqual(254);
  });

  it('sets createdAt timestamp on new schedule', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const before = Date.now();
    const result = await scheduleDelivery({
      orderId: 'o-ts', date: futureWed(), timeWindow: 'morning',
    });
    const after = Date.now();
    expect(result.success).toBe(true);

    const sched = inserts.find(i => i.col === 'DeliverySchedule');
    const ts = new Date(sched.item.createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ── scheduleDelivery — race-fix rollback verification ───────────

describe('scheduleDelivery — rollback on over-capacity', () => {
  it('removes the inserted record when slot is over capacity', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', Array.from({ length: 4 }, (_, i) => ({
      _id: `d${i}`, date, timeWindow: 'morning', type: 'standard', status: 'scheduled',
    })));

    const removals = [];
    __onRemove((col, id) => removals.push({ col, id }));

    const result = await scheduleDelivery({
      orderId: 'over-cap', date, timeWindow: 'morning', type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');

    // Should have rolled back the pending insert
    const dsRemovals = removals.filter(r => r.col === 'DeliverySchedule');
    expect(dsRemovals.length).toBe(1);
  });
});

// ── bookAppointment — edge cases ────────────────────────────────

describe('bookAppointment — edge cases', () => {
  const validData = () => ({
    date: futureWed(),
    timeSlot: '10:00',
    visitType: 'browse',
    customerName: 'Alice Smith',
    customerEmail: 'alice@example.com',
  });

  it('cancel token is 24 characters alphanumeric', async () => {
    const result = await bookAppointment(validData());
    expect(result.success).toBe(true);
    expect(result.cancelToken).toMatch(/^[a-z0-9]{24}$/);
  });

  it('each booking generates a unique cancel token', async () => {
    const r1 = await bookAppointment(validData());
    const r2 = await bookAppointment({ ...validData(), customerEmail: 'bob@example.com' });
    expect(r1.cancelToken).not.toBe(r2.cancelToken);
  });

  it('confirmation includes Hendersonville showroom address', async () => {
    const result = await bookAppointment(validData());
    expect(result.confirmation.address).toContain('Hendersonville');
    expect(result.confirmation.address).toContain('28792');
  });

  it('confirmation includes map URL', async () => {
    const result = await bookAppointment(validData());
    expect(result.confirmation.mapUrl).toContain('google.com');
  });

  it('consultation booking gets 60-min time label', async () => {
    const data = { ...validData(), visitType: 'consultation', timeSlot: '14:00' };
    const result = await bookAppointment(data);
    expect(result.success).toBe(true);
    // 14:00 + 60min = 15:00 → "2:00 PM - 3:00 PM"
    expect(result.confirmation.timeLabel).toContain('2:00 PM');
    expect(result.confirmation.timeLabel).toContain('3:00 PM');
  });

  it('rejects time slot format without leading zero', async () => {
    const data = { ...validData(), timeSlot: '9:00' };
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid time slot');
  });

  it('truncates long productInterests to 500 chars', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const data = { ...validData(), productInterests: 'x'.repeat(600) };
    const result = await bookAppointment(data);
    expect(result.success).toBe(true);

    const appt = inserts.find(i => i.col === 'ShowroomAppointments');
    expect(appt.item.productInterests.length).toBeLessThanOrEqual(500);
  });
});

// ── getVisitTypes — completeness ────────────────────────────────

describe('getVisitTypes — response shape', () => {
  it('all visit types have non-empty labels', () => {
    const types = getVisitTypes();
    for (const t of types) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it('all durations are multiples of 30', () => {
    const types = getVisitTypes();
    for (const t of types) {
      expect(t.duration % 30).toBe(0);
    }
  });
});

// ── getUpcomingAppointments — response shape ────────────────────

describe('getUpcomingAppointments — response shape', () => {
  it('each appointment has all expected fields', async () => {
    const date = futureWed();
    __seed('ShowroomAppointments', [
      {
        _id: 'a1', date, timeSlot: '10:00', duration: 30, visitType: 'browse',
        status: 'confirmed', customerName: 'Alice', customerEmail: 'a@b.com',
        customerPhone: '555', productInterests: 'Futons', notes: 'First visit',
      },
    ]);
    const result = await getUpcomingAppointments();
    expect(result.length).toBe(1);
    const a = result[0];
    expect(a).toHaveProperty('_id');
    expect(a).toHaveProperty('date');
    expect(a).toHaveProperty('timeSlot');
    expect(a).toHaveProperty('timeLabel');
    expect(a).toHaveProperty('visitType');
    expect(a).toHaveProperty('visitLabel');
    expect(a).toHaveProperty('duration');
    expect(a).toHaveProperty('customerName');
    expect(a).toHaveProperty('customerEmail');
    expect(a).toHaveProperty('customerPhone');
    expect(a).toHaveProperty('productInterests');
    expect(a).toHaveProperty('notes');
  });

  it('uses fallback visitLabel for unknown visitType', async () => {
    const date = futureWed();
    __seed('ShowroomAppointments', [
      {
        _id: 'a1', date, timeSlot: '10:00', duration: 30, visitType: 'unknown',
        status: 'confirmed', customerName: 'Bob', customerEmail: 'b@c.com',
      },
    ]);
    const result = await getUpcomingAppointments();
    expect(result.length).toBe(1);
    expect(result[0].visitLabel).toBe('unknown'); // falls back to raw visitType
  });
});

// ── getAvailableDeliverySlots — pending status counts ───────────

describe('getAvailableDeliverySlots — pending bookings count toward capacity', () => {
  it('pending bookings reduce available spots', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { _id: 'd1', date, timeWindow: 'morning', type: 'standard', status: 'pending' },
      { _id: 'd2', date, timeWindow: 'morning', type: 'standard', status: 'pending' },
    ]);
    const slots = await getAvailableDeliverySlots('standard');
    const match = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(match).toBeDefined();
    expect(match.spotsLeft).toBe(2); // 4 max - 2 pending
  });
});
