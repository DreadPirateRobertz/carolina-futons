import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import {
  getAvailableDeliveryWindows,
  reserveDeliveryWindow,
} from '../src/backend/deliveryScheduling.web.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Next occurrence of a given weekday that is in the future. */
function nextDay(weekday) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

const futureWed = () => nextDay(3);
const futureSat = () => nextDay(6);
const futureMon = () => nextDay(1); // Not a delivery day

function pastWed() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  const diff = ((3 - d.getDay()) + 7) % 7;
  d.setDate(d.getDate() + diff);
  if (d >= new Date()) d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

beforeEach(() => resetData());

// ── getAvailableDeliveryWindows ───────────────────────────────────────────────

describe('getAvailableDeliveryWindows', () => {
  it('returns slots only on Wed–Sat', async () => {
    const slots = await getAvailableDeliveryWindows('28792');
    const validDays = ['Wed', 'Thu', 'Fri', 'Sat'];
    slots.forEach(s => expect(validDays).toContain(s.dayOfWeek));
    expect(slots.length).toBeGreaterThan(0);
  });

  it('returns morning and afternoon slots', async () => {
    const slots = await getAvailableDeliveryWindows('28792');
    const timeSlots = [...new Set(slots.map(s => s.timeSlot))];
    expect(timeSlots).toContain('morning');
    expect(timeSlots).toContain('afternoon');
  });

  it('includes available, spotsLeft, and label fields', async () => {
    const slots = await getAvailableDeliveryWindows('28792');
    expect(slots.length).toBeGreaterThan(0);
    const slot = slots[0];
    expect(typeof slot.available).toBe('boolean');
    expect(typeof slot.spotsLeft).toBe('number');
    expect(typeof slot.label).toBe('string');
    expect(slot.label).toMatch(/AM|PM/);
  });

  it('marks a slot unavailable when at capacity', async () => {
    const date = futureWed();
    // Fill morning slot to capacity with white_glove + local combined
    __seed('DeliverySchedule', [
      { date, timeWindow: 'morning', type: 'white_glove', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'white_glove', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'local', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'local', status: 'scheduled' },
    ]);
    const slots = await getAvailableDeliveryWindows('28792');
    const morningOnDate = slots.find(s => s.date === date && s.timeSlot === 'morning');
    expect(morningOnDate).toBeDefined();
    expect(morningOnDate.available).toBe(false);
    expect(morningOnDate.spotsLeft).toBe(0);
  });

  it('works with empty zip (no zip-gating at this stage)', async () => {
    const slots = await getAvailableDeliveryWindows('');
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('returns empty array for invalid zip format', async () => {
    const slots = await getAvailableDeliveryWindows('INVALID');
    expect(slots).toEqual([]);
  });

  it('respects startDate parameter and skips past dates', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startStr = tomorrow.toISOString().split('T')[0];
    const slots = await getAvailableDeliveryWindows('28792', startStr);
    slots.forEach(s => {
      expect(new Date(s.date + 'T12:00:00') >= tomorrow).toBe(true);
    });
  });

  it('ignores cancelled bookings when counting capacity', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { date, timeWindow: 'morning', type: 'white_glove', status: 'cancelled' },
      { date, timeWindow: 'morning', type: 'white_glove', status: 'cancelled' },
      { date, timeWindow: 'morning', type: 'white_glove', status: 'cancelled' },
      { date, timeWindow: 'morning', type: 'white_glove', status: 'cancelled' },
    ]);
    const slots = await getAvailableDeliveryWindows('28792');
    const morningOnDate = slots.find(s => s.date === date && s.timeSlot === 'morning');
    // Cancelled don't count — slot should still be available
    expect(morningOnDate?.available).toBe(true);
  });
});

// ── reserveDeliveryWindow ─────────────────────────────────────────────────────

describe('reserveDeliveryWindow', () => {
  it('successfully reserves a valid white-glove window', async () => {
    const date = futureWed();
    const result = await reserveDeliveryWindow({
      orderId: 'order-001',
      date,
      timeSlot: 'morning',
      deliveryType: 'white_glove',
      customerEmail: 'customer@example.com',
    });
    expect(result.success).toBe(true);
    expect(result.reservationId).toBeDefined();
    expect(result.confirmation.timeSlot).toBe('morning');
    expect(result.confirmation.deliveryType).toBe('white_glove');
  });

  it('successfully reserves a valid local-delivery window', async () => {
    const date = futureSat();
    const result = await reserveDeliveryWindow({
      orderId: 'order-002',
      date,
      timeSlot: 'afternoon',
      deliveryType: 'local',
    });
    expect(result.success).toBe(true);
    expect(result.confirmation.timeSlot).toBe('afternoon');
  });

  it('rejects missing required fields', async () => {
    const result = await reserveDeliveryWindow({ orderId: 'x' });
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('rejects an invalid date format', async () => {
    const result = await reserveDeliveryWindow({
      orderId: 'order-003',
      date: '2026/04/01',
      timeSlot: 'morning',
      deliveryType: 'white_glove',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-delivery day (Monday)', async () => {
    const result = await reserveDeliveryWindow({
      orderId: 'order-004',
      date: futureMon(),
      timeSlot: 'morning',
      deliveryType: 'white_glove',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Wednesday through Saturday/i);
  });

  it('rejects a date in the past', async () => {
    const result = await reserveDeliveryWindow({
      orderId: 'order-005',
      date: pastWed(),
      timeSlot: 'morning',
      deliveryType: 'white_glove',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/future/i);
  });

  it('rejects an invalid timeSlot', async () => {
    const result = await reserveDeliveryWindow({
      orderId: 'order-006',
      date: futureWed(),
      timeSlot: 'evening',
      deliveryType: 'white_glove',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid deliveryType', async () => {
    const result = await reserveDeliveryWindow({
      orderId: 'order-007',
      date: futureWed(),
      timeSlot: 'morning',
      deliveryType: 'standard',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when the slot is fully booked', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { date, timeWindow: 'morning', type: 'white_glove', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'white_glove', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'local', status: 'scheduled' },
      { date, timeWindow: 'morning', type: 'local', status: 'scheduled' },
    ]);
    const result = await reserveDeliveryWindow({
      orderId: 'order-008',
      date,
      timeSlot: 'morning',
      deliveryType: 'white_glove',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/booked/i);
  });

  it('includes a dayOfWeek in the confirmation', async () => {
    const date = futureWed();
    const result = await reserveDeliveryWindow({
      orderId: 'order-009',
      date,
      timeSlot: 'afternoon',
      deliveryType: 'local',
    });
    expect(result.success).toBe(true);
    expect(result.confirmation.dayOfWeek).toBe('Wed');
  });

  it('stores the record as scheduled in DeliverySchedule', async () => {
    const date = futureWed();
    await reserveDeliveryWindow({
      orderId: 'order-010',
      date,
      timeSlot: 'morning',
      deliveryType: 'white_glove',
      customerEmail: 'test@example.com',
    });
    const updated = __getUpdated('DeliverySchedule');
    const confirmed = updated.find(r => r.orderId === 'order-010');
    expect(confirmed).toBeDefined();
    expect(confirmed.status).toBe('scheduled');
  });
});
