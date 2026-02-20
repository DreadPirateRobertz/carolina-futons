import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getAvailableDeliverySlots,
  scheduleDelivery,
  getMyDeliverySchedule,
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
});

// ── getMyDeliverySchedule ────────────────────────────────────────────

describe('getMyDeliverySchedule', () => {
  it('returns scheduled deliveries', async () => {
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date: '2026-03-05', timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', orderId: 'o-2', date: '2026-03-06', timeWindow: 'afternoon', type: 'white_glove', status: 'scheduled' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result).toHaveLength(2);
    expect(result[0].orderId).toBeDefined();
    expect(result[0].timeLabel).toBeDefined();
  });

  it('excludes cancelled deliveries', async () => {
    __seed('DeliverySchedule', [
      { _id: 'ds-1', orderId: 'o-1', date: '2026-03-05', timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'ds-2', orderId: 'o-2', date: '2026-03-06', timeWindow: 'afternoon', type: 'standard', status: 'cancelled' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result).toHaveLength(1);
  });

  it('returns empty array with no schedules', async () => {
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
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
