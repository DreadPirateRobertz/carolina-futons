import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
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

// ── Helpers ─────────────────────────────────────────────────────────

/** Return next date that falls on the given weekday (0=Sun..6=Sat). */
function nextDay(weekday, offsetWeeks = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7; // at least 1 day ahead
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/** A Wednesday in the future (valid delivery/appointment day). */
const futureWed = () => nextDay(3);
/** A Thursday in the future. */
const futureThu = () => nextDay(4);
/** A Monday in the future (NOT a delivery day). */
const futureMon = () => nextDay(1);

/** A date in the past (always a Wednesday). */
function pastWed() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 14);
  // Adjust to Wednesday
  const diff = ((3 - d.getDay()) + 7) % 7;
  d.setDate(d.getDate() + diff);
  // Make sure it's actually in the past
  if (d >= new Date()) d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

/** A date beyond the 21-day booking window. */
function farFutureWed() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 30);
  // Adjust to Wednesday
  const diff = ((3 - d.getDay()) + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

beforeEach(() => {
  resetData();
  resetMembers();
});

// ── getAvailableDeliverySlots ──────────────────────────────────────

describe('getAvailableDeliverySlots', () => {
  it('returns slots only on Wed-Sat', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    const days = slots.map(s => s.dayOfWeek);
    const validDays = ['Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => expect(validDays).toContain(d));
  });

  it('returns morning and afternoon windows', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    const windows = [...new Set(slots.map(s => s.timeWindow))];
    expect(windows).toContain('morning');
    expect(windows).toContain('afternoon');
  });

  it('includes time labels', async () => {
    const slots = await getAvailableDeliverySlots('standard');
    expect(slots.length).toBeGreaterThan(0);
    const morningSlot = slots.find(s => s.timeWindow === 'morning');
    const afternoonSlot = slots.find(s => s.timeWindow === 'afternoon');
    expect(morningSlot).toBeDefined();
    expect(afternoonSlot).toBeDefined();
    expect(morningSlot.timeLabel).toBe('9:00 AM - 12:00 PM');
    expect(afternoonSlot.timeLabel).toBe('1:00 PM - 5:00 PM');
  });

  it('defaults to standard type when none provided', async () => {
    const slots = await getAvailableDeliverySlots();
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach(s => expect(s.type).toBe('standard'));
  });

  it('shows reduced spots when some are booked', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { _id: 'd1', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
      { _id: 'd2', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);
    const slots = await getAvailableDeliverySlots('standard');
    const match = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(match).toBeDefined();
    expect(match.spotsLeft).toBe(2); // 4 max - 2 booked
  });

  it('excludes fully booked windows', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', Array.from({ length: 4 }, (_, i) => ({
      _id: `d${i}`, date, timeWindow: 'morning', type: 'standard', status: 'scheduled',
    })));
    const slots = await getAvailableDeliverySlots('standard');
    const match = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(match).toBeUndefined();
  });

  it('ignores cancelled bookings in slot count', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', Array.from({ length: 4 }, (_, i) => ({
      _id: `d${i}`, date, timeWindow: 'morning', type: 'standard', status: 'cancelled',
    })));
    const slots = await getAvailableDeliverySlots('standard');
    const match = slots.find(s => s.date === date && s.timeWindow === 'morning');
    expect(match).toBeDefined();
    expect(match.spotsLeft).toBe(4);
  });
});

// ── scheduleDelivery ───────────────────────────────────────────────

describe('scheduleDelivery', () => {
  it('schedules a delivery successfully', async () => {
    const date = futureWed();
    const result = await scheduleDelivery({
      orderId: 'order-123',
      date,
      timeWindow: 'morning',
      type: 'standard',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(true);
    expect(result.scheduleId).toBeDefined();
  });

  it('rejects missing orderId', async () => {
    const result = await scheduleDelivery({ date: futureWed(), timeWindow: 'morning' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects missing date', async () => {
    const result = await scheduleDelivery({ orderId: 'o1', timeWindow: 'morning' });
    expect(result.success).toBe(false);
  });

  it('rejects missing timeWindow', async () => {
    const result = await scheduleDelivery({ orderId: 'o1', date: futureWed() });
    expect(result.success).toBe(false);
  });

  it('rejects null data', async () => {
    const result = await scheduleDelivery(null);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', async () => {
    const result = await scheduleDelivery({
      orderId: 'o1', date: '03-15-2026', timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid date format');
  });

  it('rejects non-delivery day (Monday)', async () => {
    const result = await scheduleDelivery({
      orderId: 'o1', date: futureMon(), timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('rejects past dates', async () => {
    const result = await scheduleDelivery({
      orderId: 'o1', date: pastWed(), timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('future');
  });

  it('rejects dates beyond booking window', async () => {
    const result = await scheduleDelivery({
      orderId: 'o1', date: farFutureWed(), timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('21 days');
  });

  it('rejects duplicate order scheduling', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'order-dup', date, timeWindow: 'morning', type: 'standard', status: 'scheduled' },
    ]);
    const result = await scheduleDelivery({
      orderId: 'order-dup', date, timeWindow: 'afternoon',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('already scheduled');
  });

  it('allows scheduling if previous order was cancelled', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'order-resch', date, timeWindow: 'morning', type: 'standard', status: 'cancelled' },
    ]);
    const result = await scheduleDelivery({
      orderId: 'order-resch', date, timeWindow: 'morning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when slot is fully booked (race-fix rollback)', async () => {
    const date = futureWed();
    __seed('DeliverySchedule', Array.from({ length: 4 }, (_, i) => ({
      _id: `d${i}`, date, timeWindow: 'morning', type: 'standard', status: 'scheduled',
    })));
    const result = await scheduleDelivery({
      orderId: 'order-full', date, timeWindow: 'morning', type: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('defaults type to standard', async () => {
    const date = futureWed();
    const result = await scheduleDelivery({
      orderId: 'order-def', date, timeWindow: 'morning',
    });
    expect(result.success).toBe(true);
  });
});

// ── getMyDeliverySchedule ──────────────────────────────────────────

describe('getMyDeliverySchedule', () => {
  it('returns empty array when no member logged in', async () => {
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
  });

  it('returns deliveries for the current member email', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'alice@example.com' });
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'o1', date: '2026-04-01', timeWindow: 'morning', type: 'standard', status: 'scheduled', customerEmail: 'alice@example.com' },
      { _id: 's2', orderId: 'o2', date: '2026-04-02', timeWindow: 'afternoon', type: 'white_glove', status: 'scheduled', customerEmail: 'bob@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result.length).toBe(1);
    expect(result[0].orderId).toBe('o1');
    expect(result[0].timeLabel).toBe('9:00 AM - 12:00 PM');
  });

  it('excludes cancelled deliveries', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'alice@example.com' });
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'o1', date: '2026-04-01', timeWindow: 'morning', type: 'standard', status: 'cancelled', customerEmail: 'alice@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result.length).toBe(0);
  });

  it('returns formatted output fields', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'alice@example.com' });
    __seed('DeliverySchedule', [
      { _id: 's1', orderId: 'o1', date: '2026-04-01', timeWindow: 'afternoon', type: 'white_glove', status: 'scheduled', customerEmail: 'alice@example.com' },
    ]);
    const result = await getMyDeliverySchedule();
    expect(result[0]).toHaveProperty('_id');
    expect(result[0]).toHaveProperty('orderId');
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('timeWindow');
    expect(result[0]).toHaveProperty('timeLabel');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('status');
    expect(result[0].timeLabel).toBe('1:00 PM - 5:00 PM');
  });
});

// ── getAvailableAppointmentSlots ───────────────────────────────────

describe('getAvailableAppointmentSlots', () => {
  it('returns slots only on Wed-Sat', async () => {
    const slots = await getAvailableAppointmentSlots('browse');
    const validDays = ['Wed', 'Thu', 'Fri', 'Sat'];
    slots.forEach(s => expect(validDays).toContain(s.dayOfWeek));
  });

  it('returns empty for invalid visit type', async () => {
    const slots = await getAvailableAppointmentSlots('invalid');
    expect(slots).toEqual([]);
  });

  it('defaults to browse when no type given', async () => {
    const slots = await getAvailableAppointmentSlots();
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach(s => expect(s.visitType).toBe('browse'));
  });

  it('includes expected fields', async () => {
    const slots = await getAvailableAppointmentSlots('browse');
    expect(slots.length).toBeGreaterThan(0);
    const s = slots[0];
    expect(s).toHaveProperty('date');
    expect(s).toHaveProperty('dayOfWeek');
    expect(s).toHaveProperty('timeSlot');
    expect(s).toHaveProperty('timeLabel');
    expect(s).toHaveProperty('spotsLeft');
    expect(s).toHaveProperty('visitType');
    expect(s).toHaveProperty('visitLabel');
    expect(s).toHaveProperty('duration');
  });

  it('browse slots have 30-min duration', async () => {
    const slots = await getAvailableAppointmentSlots('browse');
    slots.forEach(s => expect(s.duration).toBe(30));
  });

  it('consultation slots have 60-min duration', async () => {
    const slots = await getAvailableAppointmentSlots('consultation');
    slots.forEach(s => expect(s.duration).toBe(60));
  });

  it('consultation does not offer last slot (16:30) since it would end after 17:00', async () => {
    const slots = await getAvailableAppointmentSlots('consultation');
    const timeSlots = slots.map(s => s.timeSlot);
    expect(timeSlots).not.toContain('16:30');
  });

  it('reduces spots when appointments exist', async () => {
    const date = futureWed();
    __seed('ShowroomAppointments', [
      { _id: 'a1', date, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
      { _id: 'a2', date, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed' },
    ]);
    const slots = await getAvailableAppointmentSlots('browse');
    const match = slots.find(s => s.date === date && s.timeSlot === '10:00');
    expect(match).toBeDefined();
    expect(match.spotsLeft).toBe(1); // 3 max - 2 booked
  });

  it('excludes fully booked slots', async () => {
    const date = futureWed();
    __seed('ShowroomAppointments', Array.from({ length: 3 }, (_, i) => ({
      _id: `a${i}`, date, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed',
    })));
    const slots = await getAvailableAppointmentSlots('browse');
    const match = slots.find(s => s.date === date && s.timeSlot === '10:00');
    expect(match).toBeUndefined();
  });
});

// ── bookAppointment ────────────────────────────────────────────────

describe('bookAppointment', () => {
  const validData = () => ({
    date: futureWed(),
    timeSlot: '10:00',
    visitType: 'browse',
    customerName: 'Alice Smith',
    customerEmail: 'alice@example.com',
  });

  it('books an appointment successfully', async () => {
    const result = await bookAppointment(validData());
    expect(result.success).toBe(true);
    expect(result.appointmentId).toBeDefined();
    expect(result.cancelToken).toBeDefined();
    expect(result.cancelToken.length).toBe(24);
    expect(result.confirmation).toBeDefined();
    expect(result.confirmation.address).toContain('Hendersonville');
  });

  it('rejects missing required fields', async () => {
    const cases = [
      null,
      {},
      { date: futureWed() },
      { date: futureWed(), timeSlot: '10:00' },
      { date: futureWed(), timeSlot: '10:00', visitType: 'browse' },
      { date: futureWed(), timeSlot: '10:00', visitType: 'browse', customerName: 'A' },
    ];
    for (const data of cases) {
      const result = await bookAppointment(data);
      expect(result.success).toBe(false);
    }
  });

  it('rejects invalid email', async () => {
    const data = validData();
    data.customerEmail = 'not-an-email';
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('email');
  });

  it('rejects invalid date format', async () => {
    const data = validData();
    data.date = '03/15/2026';
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid date');
  });

  it('rejects invalid time slot', async () => {
    const data = validData();
    data.timeSlot = '09:00'; // Not in APPOINTMENT_SLOTS
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid time slot');
  });

  it('rejects invalid visit type', async () => {
    const data = validData();
    data.visitType = 'spa';
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid visit type');
  });

  it('rejects non-appointment day (Monday)', async () => {
    const data = validData();
    data.date = futureMon();
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Wednesday through Saturday');
  });

  it('rejects past dates', async () => {
    const data = validData();
    data.date = pastWed();
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('future');
  });

  it('rejects when slot is fully booked (race-fix rollback)', async () => {
    const date = futureWed();
    __seed('ShowroomAppointments', Array.from({ length: 3 }, (_, i) => ({
      _id: `a${i}`, date, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed',
    })));
    const data = validData();
    data.date = date;
    const result = await bookAppointment(data);
    expect(result.success).toBe(false);
    expect(result.message).toContain('fully booked');
  });

  it('includes confirmation details on success', async () => {
    const result = await bookAppointment(validData());
    expect(result.success).toBe(true);
    const conf = result.confirmation;
    expect(conf.dayOfWeek).toBe('Wed');
    expect(conf.timeLabel).toContain('AM');
    expect(conf.visitLabel).toBe('Browse Showroom');
    expect(conf.phone).toBe('(828) 252-9449');
    expect(conf.mapUrl).toContain('google.com');
  });

  it('stores optional fields', async () => {
    const data = {
      ...validData(),
      customerPhone: '828-555-1234',
      productInterests: 'Futon frames',
      notes: 'Bringing measurements',
    };
    const result = await bookAppointment(data);
    expect(result.success).toBe(true);
  });
});

// ── cancelAppointment ──────────────────────────────────────────────

describe('cancelAppointment', () => {
  it('cancels an appointment with valid token', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'confirmed' },
    ]);
    const result = await cancelAppointment('apt-1', 'abc123def456ghi789jkl012');
    expect(result.success).toBe(true);
  });

  it('rejects missing appointmentId', async () => {
    const result = await cancelAppointment(null, 'some-token');
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects missing cancelToken', async () => {
    const result = await cancelAppointment('apt-1', null);
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects non-existent appointment', async () => {
    const result = await cancelAppointment('nonexistent', 'some-token-here-24chars00');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects wrong cancel token', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'confirmed' },
    ]);
    const result = await cancelAppointment('apt-1', 'wrong-token-not-matching0');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid cancel token');
  });

  it('rejects cancelling already-cancelled appointment', async () => {
    __seed('ShowroomAppointments', [
      { _id: 'apt-1', cancelToken: 'abc123def456ghi789jkl012', status: 'cancelled' },
    ]);
    const result = await cancelAppointment('apt-1', 'abc123def456ghi789jkl012');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already cancelled');
  });
});

// ── getUpcomingAppointments ────────────────────────────────────────

describe('getUpcomingAppointments', () => {
  it('returns confirmed future appointments', async () => {
    const futureDate = futureWed();
    __seed('ShowroomAppointments', [
      { _id: 'a1', date: futureDate, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'confirmed', customerName: 'Alice', customerEmail: 'a@b.com', customerPhone: '', productInterests: '', notes: '' },
    ]);
    const result = await getUpcomingAppointments();
    expect(result.length).toBe(1);
    expect(result[0].customerName).toBe('Alice');
  });

  it('excludes cancelled appointments', async () => {
    const futureDate = futureWed();
    __seed('ShowroomAppointments', [
      { _id: 'a1', date: futureDate, timeSlot: '10:00', duration: 30, visitType: 'browse', status: 'cancelled', customerName: 'Alice', customerEmail: 'a@b.com' },
    ]);
    const result = await getUpcomingAppointments();
    expect(result.length).toBe(0);
  });

  it('returns formatted fields', async () => {
    const futureDate = futureWed();
    __seed('ShowroomAppointments', [
      { _id: 'a1', date: futureDate, timeSlot: '14:00', duration: 60, visitType: 'consultation', status: 'confirmed', customerName: 'Bob', customerEmail: 'b@c.com', customerPhone: '555-1234', productInterests: 'Murphy beds', notes: 'First visit' },
    ]);
    const result = await getUpcomingAppointments();
    expect(result[0]).toHaveProperty('_id');
    expect(result[0]).toHaveProperty('timeLabel');
    expect(result[0].visitLabel).toBe('Design Consultation');
    expect(result[0].productInterests).toBe('Murphy beds');
  });

  it('returns empty array when no appointments', async () => {
    const result = await getUpcomingAppointments();
    expect(result).toEqual([]);
  });
});

// ── getVisitTypes ──────────────────────────────────────────────────

describe('getVisitTypes', () => {
  it('returns all four visit types', () => {
    const types = getVisitTypes();
    expect(types.length).toBe(4);
    const values = types.map(t => t.value);
    expect(values).toContain('browse');
    expect(values).toContain('consultation');
    expect(values).toContain('swatch');
    expect(values).toContain('pickup');
  });

  it('each type has value, label, and duration', () => {
    const types = getVisitTypes();
    types.forEach(t => {
      expect(t).toHaveProperty('value');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('duration');
      expect(typeof t.label).toBe('string');
      expect(typeof t.duration).toBe('number');
    });
  });

  it('consultation is 60 minutes, others are 30', () => {
    const types = getVisitTypes();
    const consultation = types.find(t => t.value === 'consultation');
    expect(consultation.duration).toBe(60);
    types.filter(t => t.value !== 'consultation').forEach(t => {
      expect(t.duration).toBe(30);
    });
  });
});
