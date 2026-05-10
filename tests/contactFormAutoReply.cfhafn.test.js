/**
 * @file contactFormAutoReply.cfhafn.test.js
 * @description cf-hafn (cf-icww F6) — sendEmail fires a customer-side auto-reply
 * via the `contact_form_auto_reply` triggered email after the owner notification.
 * Closes the silent-confirmation gap surfaced in the cf-icww email audit.
 *
 * Verifies:
 *   - Template registered in emailTemplates.web.js#TEMPLATE_REGISTRY
 *   - Successful sendEmail dispatches BOTH the owner notification AND the
 *     customer auto-reply
 *   - Auto-reply uses the resolved customer contactId, the customer's name,
 *     the submitted subject + message, and the static replyEta + supportPhone
 *   - Auto-reply is non-blocking — a failure in the customer-side path does
 *     NOT flip the overall result to failure
 *   - Empty contactId from appendOrCreateContact short-circuits without raising
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  __getEmailLog,
  __reset as resetCrm,
  __seedContacts,
} from './__mocks__/wix-crm-backend.js';

import { sendEmail } from '../src/backend/emailService.web.js';

const flushMicrotasks = async () => {
  // Drain multiple turns: cf-hafn auto-reply does
  // await contacts.appendOrCreateContact → await triggeredEmails.emailContact,
  // and each macrotask boundary may not catch both depending on the runtime.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

beforeEach(() => {
  resetData();
  resetSecrets();
  resetCrm();
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
});

const validSubmission = () => ({
  name: 'Asheville Andy',
  email: 'andy@example.com',
  phone: '828-555-0100',
  subject: 'Eureka availability',
  message: 'Do you have the Eureka in slate blue?',
});

describe('cf-hafn · contact_form_auto_reply template registration', () => {
  it('exposes contact_form_auto_reply in the template registry with the right variables', async () => {
    // The internal-only test export lets us pin the template shape so a
    // future maintainer doesn't drop the registration silently.
    const { getTemplate } = await import('../src/backend/emailTemplates.web.js');
    const meta = await getTemplate('contact_form_auto_reply');
    expect(meta).toBeTruthy();
    expect(meta.id).toBe('contact_form_auto_reply');
    expect(meta.category).toBe('transactional');
    expect(meta.variables).toEqual(
      expect.arrayContaining(['customerName', 'subject', 'message', 'replyEta', 'supportPhone', 'email']),
    );
  });
});

describe('cf-hafn · sendEmail customer auto-reply', () => {
  it('dispatches both owner notification AND customer auto-reply on success', async () => {
    const result = await sendEmail(validSubmission());
    await flushMicrotasks();

    expect(result.success).toBe(true);
    const log = __getEmailLog();

    const ownerEmail = log.find((e) => e.templateId === 'contact_form_submission');
    const customerEmail = log.find((e) => e.templateId === 'VJBOnfD');

    expect(ownerEmail).toBeDefined();
    expect(ownerEmail.contactId).toBe('owner-contact-123');

    expect(customerEmail).toBeDefined();
    // appendOrCreateContact mock generates a contact-* id when no prior contact
    expect(typeof customerEmail.contactId).toBe('string');
    expect(customerEmail.contactId).toMatch(/^contact-/);
  });

  it('passes customerName, subject, message, replyEta, and supportPhone to the auto-reply template', async () => {
    await sendEmail(validSubmission());
    await flushMicrotasks();

    const customerEmail = __getEmailLog().find((e) => e.templateId === 'VJBOnfD');
    expect(customerEmail.options.variables).toMatchObject({
      customerName: 'Asheville Andy',
      subject: 'Eureka availability',
      message: 'Do you have the Eureka in slate blue?',
      replyEta: 'within 1 business day',
      supportPhone: '(828) 252-9449',
      email: 'andy@example.com',
    });
  });

  it('reuses an existing CRM contact when one already exists for the email', async () => {
    __seedContacts([
      { _id: 'contact-existing-9', primaryInfo: { email: 'andy@example.com' } },
    ]);
    await sendEmail(validSubmission());
    await flushMicrotasks();

    const customerEmail = __getEmailLog().find((e) => e.templateId === 'VJBOnfD');
    // appendOrCreateContact dedupes by email; mock returns the existing _id.
    expect(customerEmail.contactId).toBe('contact-existing-9');
  });
});

describe('cf-hafn · auto-reply is non-blocking', () => {
  it('still returns success when the auto-reply triggered email fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Fail the SECOND emailContact call (the auto-reply) but let the first
    // (owner notification) succeed. Without skip-count support in the mock,
    // simulate via spying on the imported triggeredEmails.
    const crm = await import('wix-crm-backend');
    const original = crm.triggeredEmails.emailContact;
    let callCount = 0;
    vi.spyOn(crm.triggeredEmails, 'emailContact').mockImplementation(async (...args) => {
      callCount += 1;
      if (callCount === 2) throw new Error('Triggered Emails service unavailable');
      return original.apply(crm.triggeredEmails, args);
    });

    const result = await sendEmail(validSubmission());
    await flushMicrotasks();

    expect(result.success).toBe(true); // owner email + CMS row already happened
    expect(__getEmailLog().some((e) => e.templateId === 'contact_form_submission')).toBe(true);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('customer auto-reply failed'),
      expect.any(String),
    );
    consoleWarn.mockRestore();
    vi.restoreAllMocks();
  });

  it('skips auto-reply when appendOrCreateContact returns empty', async () => {
    const crm = await import('wix-crm-backend');
    vi.spyOn(crm.contacts, 'appendOrCreateContact').mockResolvedValue({});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendEmail(validSubmission());
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(__getEmailLog().some((e) => e.templateId === 'VJBOnfD')).toBe(false);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('customer auto-reply skipped'),
      expect.any(Object),
    );
    consoleWarn.mockRestore();
    vi.restoreAllMocks();
  });
});
