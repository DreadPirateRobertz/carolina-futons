/**
 * cf-44qt sibling — smsService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch calls
 * `logError('[smsService] <fn> failed', err)` instead of raw
 * `console.error`. Per melania directive 2026-05-16 06:00 MT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validatePhone: (s) => true,
  formatPhoneE164: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (k) => {
    if (k === 'TWILIO_ACCOUNT_SID') return 'AC_test';
    if (k === 'TWILIO_AUTH_TOKEN') return 'token_test';
    if (k === 'TWILIO_PHONE_NUMBER') return '+15555550100';
    return '';
  }),
}));
vi.mock('wix-fetch', () => ({
  fetch: vi.fn(async () => ({ ok: false, status: 500, text: async () => 'twilio error' })),
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — smsService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('updateSMSPreferences wires logError on SMSPreferences query throw', async () => {
    __setQueryError('SMSPreferences', new Error('wixData failure'));
    const mod = await import('../src/backend/smsService.web.js');
    const result = await mod.updateSMSPreferences({ phone: '+15555550100', smsEnabled: true });
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/smsService/);
    expect(tag).toMatch(/updateSMSPreferences/);
  });

  it('getSMSPreferences wires logError on SMSPreferences query throw', async () => {
    __setQueryError('SMSPreferences', new Error('wixData failure'));
    const mod = await import('../src/backend/smsService.web.js');
    await mod.getSMSPreferences();
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/smsService/);
    expect(tag).toMatch(/getSMSPreferences/);
  });

  it('sendOrderConfirmationSMS wires logError on SMSPreferences query throw', async () => {
    __setQueryError('SMSPreferences', new Error('wixData failure'));
    const mod = await import('../src/backend/smsService.web.js');
    await mod.sendOrderConfirmationSMS({ memberId: 'member-1', orderNumber: 'ord-1', orderTotal: 99 });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/smsService/);
    expect(tag).toMatch(/sendOrderConfirmationSMS/);
  });

  it('sendBackInStockSMS wires logError on SMSPreferences query throw', async () => {
    __setQueryError('SMSPreferences', new Error('wixData failure'));
    const mod = await import('../src/backend/smsService.web.js');
    await mod.sendBackInStockSMS({ memberId: 'member-1', productName: 'Test' });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/smsService/);
    expect(tag).toMatch(/sendBackInStockSMS/);
  });

  it('sendChallengeAlertSMS wires logError on SMSPreferences query throw', async () => {
    __setQueryError('SMSPreferences', new Error('wixData failure'));
    const mod = await import('../src/backend/smsService.web.js');
    await mod.sendChallengeAlertSMS({ memberId: 'member-1', message: 'Challenge alert' });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/smsService/);
    expect(tag).toMatch(/sendChallengeAlertSMS/);
  });
});
