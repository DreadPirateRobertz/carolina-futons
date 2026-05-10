/**
 * deliverySchedulingCoverage.test.js — CF-672y
 * Fills remaining coverage gaps in deliveryScheduling backend module.
 * Focuses on: catch blocks and error-throwing mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __reset as resetData } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

import {
  getAvailableDeliverySlots,
  scheduleDelivery,
  getMyDeliverySchedule,
  getAvailableAppointmentSlots,
  bookAppointment,
  cancelAppointment,
  getUpcomingAppointments,
} from '../src/backend/deliveryScheduling.web.js';

function nextDay(weekday, offsetWeeks = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = ((weekday - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().split('T')[0];
}
const futureWed = () => nextDay(3);

beforeEach(() => {
  resetData();
  resetMembers();
});

describe('deliveryScheduling — error catch paths', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('getAvailableDeliverySlots returns [] on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAvailableDeliverySlots('standard');
    expect(result).toEqual([]);
  });

  it('scheduleDelivery returns failure on unexpected error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await scheduleDelivery({
      orderId: 'o1', date: futureWed(), timeWindow: 'morning',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to schedule');
  });

  it('getMyDeliverySchedule returns [] on error', async () => {
    __setMember({ _id: 'm1', loginEmail: 'a@b.com' });
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getMyDeliverySchedule();
    expect(result).toEqual([]);
  });

  it('getAvailableAppointmentSlots returns [] on error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAvailableAppointmentSlots('browse');
    expect(result).toEqual([]);
  });

  it('bookAppointment returns rate-limit message when rate-limit DB throws (cf-3ldu.F2 fail-closed default)', async () => {
    // Pre-PR #1288 the rate-limit insert throwing failed open and the test
    // asserted on the outer catch-block message ("Failed to book"). cf-3ldu.F2
    // changed checkRateLimit to fail-CLOSED on db error: caller now hits the
    // !allowed branch with reason='db_error' and emits the rate-limit message.
    // The endpoint is in cf-lzkm KEEP — fail-closed is acceptable UX. This
    // test guards the new behavior.
    vi.spyOn(wixData, 'insert')
      .mockRejectedValueOnce(new Error('DB down')); // rate-limit insert → reason='db_error' → caller emits rate-limit message
    const result = await bookAppointment({
      date: futureWed(),
      timeSlot: '10:00',
      visitType: 'browse',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many');
  });

  it('cancelAppointment returns failure on unexpected error', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await cancelAppointment('apt-1', 'validtoken12345678901234');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to cancel');
  });

  it('getUpcomingAppointments returns [] on error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getUpcomingAppointments();
    expect(result).toEqual([]);
  });
});
