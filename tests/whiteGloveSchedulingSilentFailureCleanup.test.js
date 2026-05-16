/**
 * cf-44qt sibling — whiteGloveScheduling.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
  validatePhone: () => true,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/utils/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('backend/utils/validateSchema', () => ({
  validateSchema: vi.fn(() => []),
}));
vi.mock('backend/smsService.web', () => ({
  sendWhiteGloveConfirmationSMS: vi.fn(async () => ({ success: true })),
  sendWhiteGloveReminderSMS: vi.fn(async () => ({ success: true })),
  sendWhiteGloveDayOfSMS: vi.fn(async () => ({ success: true })),
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

describe('cf-44qt sibling — whiteGloveScheduling.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getWhiteGloveSlots wires logError on BlockedDeliveryDates query throw', async () => {
    __setQueryError('BlockedDeliveryDates', new Error('wixData failure'));
    const mod = await import('../src/backend/whiteGloveScheduling.web.js');
    await mod.getWhiteGloveSlots();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/whiteGloveScheduling/);
    expect(allTags).toMatch(/getWhiteGloveSlots/);
  });

  it('getBlockedDates wires logError on BlockedDeliveryDates query throw', async () => {
    __setQueryError('BlockedDeliveryDates', new Error('wixData failure'));
    const mod = await import('../src/backend/whiteGloveScheduling.web.js');
    await mod.getBlockedDates();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/whiteGloveScheduling/);
    expect(allTags).toMatch(/getBlockedDates/);
  });

  it('getAdminCalendar wires logError on WhiteGloveAppointments query throw', async () => {
    __setQueryError('WhiteGloveAppointments', new Error('wixData failure'));
    const mod = await import('../src/backend/whiteGloveScheduling.web.js');
    await mod.getAdminCalendar('2026-06-01', '2026-06-30');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/whiteGloveScheduling/);
    expect(allTags).toMatch(/getAdminCalendar/);
  });

  it('getMyWhiteGloveAppointment wires logError on query throw', async () => {
    __setQueryError('WhiteGloveAppointments', new Error('wixData failure'));
    const mod = await import('../src/backend/whiteGloveScheduling.web.js');
    await mod.getMyWhiteGloveAppointment('order-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/whiteGloveScheduling/);
    expect(allTags).toMatch(/getMyWhiteGloveAppointment/);
  });
});
