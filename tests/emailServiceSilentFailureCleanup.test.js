/**
 * cf-44qt sibling — emailService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch calls
 * `logError('[emailService] <fn> failed', err)` instead of raw
 * `console.error`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateEmail: (s) => true,
}));
vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('backend/utils/validateSchema', () => ({
  validateSchema: vi.fn((schema, data) => ({ valid: true, data })),
}));
vi.mock('backend/emailTemplates.web', () => ({
  resolveTemplateId: vi.fn((k) => `tpl_${k}`),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => ''),
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));
vi.mock('backend/emailABService.web', () => ({
  assignVariant: vi.fn(() => 'A'),
  logABSend: vi.fn(async () => undefined),
}));

let emailContactFn;
vi.mock('wix-crm-backend', () => {
  emailContactFn = vi.fn(async () => { throw new Error('triggeredEmail failure'); });
  return {
    triggeredEmails: { emailContact: emailContactFn },
    contacts: { queryContacts: vi.fn(() => ({ eq: () => ({ find: async () => ({ items: [{ _id: 'c-1' }] }) }) })) },
  };
});

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — emailService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('sendOrderConfirmation wires logError on triggeredEmail throw', async () => {
    const mod = await import('../src/backend/emailService.web.js');
    await mod.sendOrderConfirmation({ contactId: 'c-1', email: 'buyer@example.com', orderNumber: 'ord-1', orderTotal: 99 });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/emailService/);
    expect(tag).toMatch(/sendOrderConfirmation/);
  });

  it('sendShippingNotification wires logError on triggeredEmail throw', async () => {
    const mod = await import('../src/backend/emailService.web.js');
    await mod.sendShippingNotification({ contactId: 'c-1', email: 'buyer@example.com', orderNumber: 'ord-1', trackingNumber: 'T-1' });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/emailService/);
    expect(tag).toMatch(/sendShippingNotification/);
  });

  it('sendFreightShippingNotification wires logError on triggeredEmail throw', async () => {
    const mod = await import('../src/backend/emailService.web.js');
    await mod.sendFreightShippingNotification({ contactId: 'c-1', email: 'buyer@example.com', orderNumber: 'ord-1' });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/emailService/);
    expect(tag).toMatch(/sendFreightShippingNotification/);
  });

  it('sendDeliveryConfirmation wires logError on triggeredEmail throw', async () => {
    const mod = await import('../src/backend/emailService.web.js');
    await mod.sendDeliveryConfirmation({ contactId: 'c-1', email: 'buyer@example.com', orderNumber: 'ord-1' });
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/emailService/);
    expect(tag).toMatch(/sendDeliveryConfirmation/);
  });

  it('sendABEmail wires logError on triggeredEmail throw', async () => {
    const mod = await import('../src/backend/emailService.web.js');
    await mod.sendABEmail('member-1', 'campaign-1', 'buyer@example.com', [
      { variant: 'A', templateId: 'tpl_A', variables: {} },
      { variant: 'B', templateId: 'tpl_B', variables: {} },
    ]);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/emailService/);
    expect(tag).toMatch(/sendABEmail/);
  });
});
