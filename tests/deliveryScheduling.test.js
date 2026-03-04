import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getAvailableDeliverySlots,
  scheduleDelivery,
  getMyDeliverySchedule,
  getAvailableAppointmentSlots,
  bookAppointment,
  cancelAppointment,
  getUpcomingAppointments,
  getVisitTypes,
} from '../src/backend/deliveryScheduling.web.js';

// ── getAvailableDeliverySlots ────────────────────────────────────────

describe('getAvailableDeliverySlots', () => {
  it('returns slots only on Wed-Sat', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    expect(slots.length).toBeGreaterThan(0);
    const validDays = ['Wed', 'Thu', 'Fri', 'Sat'];
    for (const slot of slots) {
      expect(validDays).toContain(slot.dayOfWeek);
    }
  });

  it('returns morning and afternoon windows', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    const windows = new Set(slots.map(s => s.timeWindow));
    expect(windows.has('morning')).toBe(true);
    expect(windows.has('afternoon')).toBe(true);
  });

  it('shows human-readable time labels', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    const morningSlot = slots.find(s => s.timeWindow === 'morning');
    const afternoonSlot = slots.find(s => s.timeWindow === 'afternoon');
    if (morningSlot) expect(morningSlot.timeLabel).toBe('9:00 AM - 12:00 PM');
    if (afternoonSlot) expect(afternoonSlot.timeLabel).toBe('1:00 PM - 5:00 PM');
  });

  it('limits to 21-day booking window', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 22); // 21 + 1 for safety
    for (const slot of slots) {
      expect(new Date(slot.date) <= maxDate).toBe(true);
    }
  });

  it('respects max slots per window', async () => {
    // Seed 4 bookings for a specific slot (max capacity)
    const nextWed = getNextDayOfWeek(3); // Wednesday
    const dateStr = nextWed.toISOString().split('T')[0];
    __seed('DeliverySchedule', [
      { _id: 'ds-1', date: dateStr, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', date: dateStr, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-3', date: dateStr, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-4', date: dateStr, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);
    const slots = await getAvailableDeliverySlots('standard');
    const bookedSlot = slots.find(s => s.date === dateStr && s.timeWindow === 'morning');
    expect(bookedSlot).toBeUndefined(); // Should not appear (full)
  });

  it('returns empty array on error', async () => {
    // Default with no seeds should still work
    const slots = await getAvailableDeliverySlots('white_glove');
    expect(Array.isArray(slots)).toBe(true);
  });
});

// ── scheduleDelivery ─────────────────────────────────────────────────

describe('scheduleDelivery', () => {
  it('schedules successfully with valid data', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    const result = await scheduleDelivery({
      orderId: 'order-123',
      date: dateStr,
      timeWindow: 'morning',
      type: 'standard',
      customerEmail: 'test@test.com',
      notes: 'Ring doorbell',
    });
    expect(result.success).toBe(true);
    expect(result.scheduleId).toBeDefined();
  });

  it('rejects missing orderId', async () => {
    const result = await scheduleDelivery({
      date: '2026-03-04',
      timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing date', async () => {
    const result = await scheduleDelivery({
      orderId: 'order-123',
      timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', async () => {
    const result = await scheduleDelivery({
      orderId: 'order-123',
      date: 'March 4th',
      timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid date');
  });

  it('rejects fully booked slot', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    __seed('DeliverySchedule', [
      { _id: 'ds-1', date: dateStr, timeWindow: 'afternoon', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', date: dateStr, timeWindow: 'afternoon', type: 'standard', status: 'scheduled' },
      { _id: 'ds-3', date: dateStr, timeWindow: 'afternoon', type: 'standard', status: 'scheduled' },
      { _id: 'ds-4', date: dateStr, timeWindow: 'afternoon', type: 'standard', status: 'scheduled' },
    ]);
    const result = await scheduleDelivery({
      orderId: 'order-new',
      date: dateStr,
      timeWindow: 'afternoon',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('rejects duplicate scheduling for same order', async () => {
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'order-123', date: '2026-03-04', timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);
    const result = await scheduleDelivery({
      orderId: 'order-123',
      date: '2026-03-05',
      timeWindow: 'afternoon',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('already scheduled');
  });

  it('rejects null data', async () => {
    const result = await scheduleDelivery(null);
    expect(result.success).toBe(false);
  });

  it('rejects past dates', async () => {
    const result = await scheduleDelivery({
      orderId: 'order-past',
      date: '2020-01-15',
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('future');
  });

  it('rejects non-delivery days (Sunday)', async () => {
    const nextSun = getNextDayOfWeek(0); // Sunday
    const dateStr = nextSun.toISOString().split('T')[0];
    const result = await scheduleDelivery({
      orderId: 'order-sun',
      date: dateStr,
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('rejects non-delivery days (Monday)', async () => {
    const nextMon = getNextDayOfWeek(1); // Monday
    const dateStr = nextMon.toISOString().split('T')[0];
    const result = await scheduleDelivery({
      orderId: 'order-mon',
      date: dateStr,
      timeWindow: 'afternoon',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('rejects dates beyond booking window (>21 days)', async () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 60);
    // Ensure it's a Wed-Sat so only the window check fails
    while (![3, 4, 5, 6].includes(farFuture.getDay())) {
      farFuture.setDate(farFuture.getDate() + 1);
    }
    // Format as local date (not UTC via toISOString) to match implementation's
    // new Date(date + 'T12:00:00') parsing which interprets as local time
    const dateStr = `${farFuture.getFullYear()}-${String(farFuture.getMonth() + 1).padStart(2, '0')}-${String(farFuture.getDate()).padStart(2, '0')}`;
    const result = await scheduleDelivery({
      orderId: 'order-far',
      date: dateStr,
      timeWindow: 'morning',
      type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('21 days');
  });

  it('accepts valid future Wed-Sat date', async () => {
    const nextThu = getNextDayOfWeek(4); // Thursday
    const dateStr = nextThu.toISOString().split('T')[0];
    const result = await scheduleDelivery({
      orderId: 'order-thu',
      date: dateStr,
      timeWindow: 'afternoon',
      type: 'white_glove',
    });
    expect(result.success).toBe(true);
  });
});

// ── getMyDeliverySchedule ────────────────────────────────────────────

describe('getMyDeliverySchedule', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('returns scheduled deliveries', async () => {
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date: '2026-03-05', timeWindow: 'morning', type: 'standard', status: 'scheduled', customerEmail: 'test@example.com' },
      { _id: 'ds-2', orderId: 'o-2', date: '2026-03-06', timeWindow: 'afternoon', type: 'white_glove', status: 'scheduled', customerEmail: 'test@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result).toHaveLength(2);
    expect(result[0].orderId).toBeDefined();
    expect(result[0].timeLabel).toBeDefined();
  });

  it('excludes cancelled deliveries', async () => {
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date: '2026-03-05', timeWindow: 'morning', type: 'standard', status: 'scheduled', customerEmail: 'test@example.com' },
      { _id: 'ds-2', orderId: 'o-2', date: '2026-03-06', timeWindow: 'afternoon', type: 'standard', status: 'cancelled', customerEmail: 'test@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result).toHaveLength(1);
  });

  it('returns empty array with no schedules', async () => {
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
  });
});

// ── getAvailableAppointmentSlots ──────────────────────────────────────

describe('getAvailableAppointmentSlots', () => {
  it('returns slots only on Wed-Sat', async () => {
    const slots = await getAvailableAppointmentSlots('browse');
    expect(slots.length).toBeGreaterThan(0);
    const validDays = ['Wed', 'Thu', 'Fri', 'Sat'];
    for (const slot of slots) {
      expect(validDays).toContain(slot.dayOfWeek);
    }
  });

  it('returns 30-min slots within business hours', async () => {
    const slots = await getAvailableAppointmentSlots('browse');
    for (const slot of slots) {
      const [h] = slot.timeSlot.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(10);
      expect(h).toBeLessThanOrEqual(16);
    }
  });

  it('returns empty array for invalid visit type', async () => {
    const slots = await getAvailableAppointmentSlots('invalid');
    expect(slots).toEqual([]);
  });

  it('includes visit type info in each slot', async () => {
    const slots = await getAvailableAppointmentSlots('consultation');
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.visitType).toBe('consultation');
      expect(slot.visitLabel).toBe('Design Consultation');
      expect(slot.duration).toBe(60);
    }
  });

  it('respects max concurrent visits (3)', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    __seed('ShowroomAppointments', [
      { _id: 'a-1', date: dateStr, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a-2', date: dateStr, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a-3', date: dateStr, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
    ]);
    const slots = await getAvailableAppointmentSlots('browse');
    const bookedSlot = slots.find(s => s.date === dateStr && s.timeSlot === '10:00');
    expect(bookedSlot).toBeUndefined();
  });

  it('does not count cancelled appointments toward capacity', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    __seed('ShowroomAppointments', [
      { _id: 'a-1', date: dateStr, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a-2', date: dateStr, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'cancelled' },
    ]);
    const slots = await getAvailableAppointmentSlots('browse');
    const slot = slots.find(s => s.date === dateStr && s.timeSlot === '10:00');
    expect(slot).toBeDefined();
    expect(slot.spotsLeft).toBe(2);
  });
});

// ── bookAppointment ──────────────────────────────────────────────────

describe('bookAppointment', () => {
  it('books successfully with valid data', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    const result = await bookAppointment({
      date: dateStr,
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      customerPhone: '828-555-0123',
      productInterests: 'Queen futon frames',
    });
    expect(result.success).toBe(true);
    expect(result.appointmentId).toBeDefined();
    expect(result.cancelToken).toBeDefined();
    expect(result.cancelToken.length).toBe(24);
    expect(result.confirmation).toBeDefined();
    expect(result.confirmation.address).toContain('Hendersonville');
    expect(result.confirmation.visitLabel).toBe('Browse Showroom');
  });

  it('rejects missing required fields', async () => {
    const result = await bookAppointment({
      date: '2026-03-04',
      timeSlot: '10:00',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects invalid date format', async () => {
    const result = await bookAppointment({
      date: 'March 4th',
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid date');
  });

  it('rejects invalid time slot', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    const result = await bookAppointment({
      date: dateStr,
      timeSlot: '09:00', // Before business hours
      visitType: 'browse',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid time slot');
  });

  it('rejects invalid visit type', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    const result = await bookAppointment({
      date: dateStr,
      timeSlot: '10:00',
      visitType: 'invalid',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid visit type');
  });

  it('rejects non-business days (Mon-Tue, Sun)', async () => {
    const nextMon = getNextDayOfWeek(1);
    const dateStr = nextMon.toISOString().split('T')[0];
    const result = await bookAppointment({
      date: dateStr,
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('rejects past dates', async () => {
    const result = await bookAppointment({
      date: '2020-01-01',
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('future');
  });

  it('rejects fully booked slots', async () => {
    const nextWed = getNextDayOfWeek(3);
    const dateStr = nextWed.toISOString().split('T')[0];
    __seed('ShowroomAppointments', [
      { _id: 'a-1', date: dateStr, timeSlot: '14:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a-2', date: dateStr, timeSlot: '14:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a-3', date: dateStr, timeSlot: '14:00', duration: 30, visitType: 'browse', status: 'confirmed' },
    ]);
    const result = await bookAppointment({
      date: dateStr,
      timeSlot: '14:00',
      visitType: 'browse',
      customerName: 'John',
      customerEmail: 'john@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('rejects null data', async () => {
    const result = await bookAppointment(null);
    expect(result.success).toBe(false);
  });
});

// ── cancelAppointment ────────────────────────────────────────────────

describe('cancelAppointment', () => {
  it('cancels with valid token', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'appt-1', date: '2026-03-04', timeSlot: '10:00', visitType: 'browse', status: 'confirmed', cancelToken: 'abc123def456ghi789jkl012' },
    ]);
    const result = await cancelAppointment('appt-1', 'abc123def456ghi789jkl012');
    expect(result.success).toBe(true);
  });

  it('rejects wrong cancel token', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'appt-1', date: '2026-03-04', timeSlot: '10:00', visitType: 'browse', status: 'confirmed', cancelToken: 'abc123def456ghi789jkl012' },
    ]);
    const result = await cancelAppointment('appt-1', 'wrong-token-value-here-xx');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid cancel token');
  });

  it('rejects already cancelled appointment', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'appt-1', date: '2026-03-04', timeSlot: '10:00', visitType: 'browse', status: 'cancelled', cancelToken: 'abc123def456ghi789jkl012' },
    ]);
    const result = await cancelAppointment('appt-1', 'abc123def456ghi789jkl012');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already cancelled');
  });

  it('rejects missing parameters', async () => {
    const result = await cancelAppointment(null, null);
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects non-existent appointment', async () => {
    const result = await cancelAppointment('nonexistent', 'sometoken12345678901234');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

// ── getVisitTypes ────────────────────────────────────────────────────

describe('getVisitTypes', () => {
  it('returns all visit type options', async () => {
    const types = await getVisitTypes();
    expect(types).toHaveLength(4);
    const values = types.map(t => t.value);
    expect(values).toContain('browse');
    expect(values).toContain('consultation');
    expect(values).toContain('swatch');
    expect(values).toContain('pickup');
  });

  it('includes label and duration for each type', async () => {
    const types = await getVisitTypes();
    for (const type of types) {
      expect(type.label).toBeDefined();
      expect(type.duration).toBeGreaterThan(0);
    }
  });

  it('consultation is 60 minutes', async () => {
    const types = await getVisitTypes();
    const consultation = types.find(t => t.value === 'consultation');
    expect(consultation.duration).toBe(60);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

function getNextDayOfWeek(dayOfWeek) {
  const today = new Date();
  const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}
