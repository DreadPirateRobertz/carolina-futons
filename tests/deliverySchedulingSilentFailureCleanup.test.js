/**
 * cf-44qt sibling — deliveryScheduling.web.js observability cleanup.
 *
 * Pins post-migration contract: catches call logError('[deliveryScheduling] <fn> failed', err).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: () => true,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  hashRateLimitKey: (s) => s,
}));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('backend/utils/validateSchema', () => ({
  validateSchema: vi.fn((schema, data) => ({ valid: true, data })),
}));
vi.mock('backend/deliveryNotifications.web', () => ({
  sendDeliveryBookingConfirmationSms: vi.fn(async () => ({ success: true })),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — deliveryScheduling.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getAvailableDeliveryWindows wires logError on DeliverySchedule query throw', async () => {
    __setQueryError('DeliverySchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/deliveryScheduling.web.js');
    await mod.getAvailableDeliveryWindows();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/deliveryScheduling/);
    expect(tag).toMatch(/getAvailableDeliveryWindows/);
  });

  it('getAvailableDeliverySlots wires logError on DeliverySchedule query throw', async () => {
    __setQueryError('DeliverySchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/deliveryScheduling.web.js');
    await mod.getAvailableDeliverySlots('2026-06-01', '2026-06-30');
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/deliveryScheduling/);
    expect(tag).toMatch(/getAvailableDeliverySlots/);
  });

  it('getMyDeliverySchedule wires logError on DeliverySchedule query throw', async () => {
    __setQueryError('DeliverySchedule', new Error('wixData failure'));
    const mod = await import('../src/backend/deliveryScheduling.web.js');
    await mod.getMyDeliverySchedule('cust@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/deliveryScheduling/);
    expect(tag).toMatch(/getMyDeliverySchedule/);
  });

  it('getAvailableAppointmentSlots wires logError on ShowroomAppointments query throw', async () => {
    __setQueryError('ShowroomAppointments', new Error('wixData failure'));
    const mod = await import('../src/backend/deliveryScheduling.web.js');
    await mod.getAvailableAppointmentSlots('browse');
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/deliveryScheduling/);
    expect(tag).toMatch(/getAvailableAppointmentSlots/);
  });

  it('getUpcomingAppointments wires logError on ShowroomAppointments query throw', async () => {
    __setQueryError('ShowroomAppointments', new Error('wixData failure'));
    const mod = await import('../src/backend/deliveryScheduling.web.js');
    await mod.getUpcomingAppointments('cust@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/deliveryScheduling/);
    expect(tag).toMatch(/getUpcomingAppointments/);
  });
});
