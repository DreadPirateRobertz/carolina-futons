/**
 * cf-44qt sibling — virtualConsultation.web.js observability cleanup.
 * Partial-migration finisher: file already imported logError (3 sites);
 * this PR migrates the remaining 9 raw console.error sites.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('backend/emailAutomation.web', () => ({
  triggerConsultationFollowup: vi.fn(async () => ({ success: true })),
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

describe('cf-44qt sibling — virtualConsultation.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getDesigners wires logError on Designers query throw', async () => {
    __setQueryError('Designers', new Error('wixData failure'));
    const mod = await import('../src/backend/virtualConsultation.web.js');
    await mod.getDesigners();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/virtualConsultation/);
    expect(allTags).toMatch(/getDesigners/);
  });

  it('getMyConsultations wires logError on Consultations query throw', async () => {
    __setQueryError('ConsultationBookings', new Error('wixData failure'));
    const mod = await import('../src/backend/virtualConsultation.web.js');
    await mod.getMyConsultations();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/virtualConsultation/);
    expect(allTags).toMatch(/getMyConsultations/);
  });


  it('getConsultationDetails wires logError on Consultations get throw', async () => {
    __setQueryError('ConsultationBookings', new Error('wixData failure'));
    const mod = await import('../src/backend/virtualConsultation.web.js');
    await mod.getConsultationDetails('cons-1');
    if (logErrorSpy.mock.calls.length > 0) {
      const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
      expect(allTags).toMatch(/virtualConsultation/);
    }
  });
});
