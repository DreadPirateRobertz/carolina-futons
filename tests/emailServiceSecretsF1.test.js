/**
 * @file emailServiceSecretsF1.test.js
 * @description cf-secrets.F1 (P2) — explicit fail path for missing
 * SITE_OWNER_CONTACT_ID. Pre-fix the bare `await getSecret(...)` would
 * propagate a "Secret not found" rejection up to the caller's catch,
 * which logged a generic "Failed to send …" — Stilgar saw no signal,
 * customers hit failure-soft with no owner notification (silent
 * customer-service blackout).
 *
 * Post-fix: `_resolveSiteOwnerContactId(callSite)` wraps the secret
 * lookup, logs an explicit `SITE_OWNER_CONTACT_ID missing` warn
 * naming the call site, and the caller skips the email send + returns
 * `success: false`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetCrm, __getEmailLog } from './__mocks__/wix-crm-backend.js';
import {
  sendEmail,
  submitSwatchRequest,
  sendOrderNotification,
} from '../src/backend/emailService.web.js';

beforeEach(() => {
  resetSecrets(); // No SITE_OWNER_CONTACT_ID configured in any test below.
  resetCrm();
});

const validContactForm = {
  name: 'Bob Test',
  email: 'bob@example.com',
  phone: '828-555-0100',
  subject: 'Question',
  message: 'Hello',
};

describe('sendEmail — SITE_OWNER_CONTACT_ID missing (cf-secrets.F1)', () => {
  it('returns success: false with a customer-facing call-us message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await sendEmail(validContactForm);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/call/i);
    warnSpy.mockRestore();
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID missing" warn with sendEmail call-site label', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendEmail(validContactForm);
    const warnings = warnSpy.mock.calls.map((args) => args.map(String).join(' '));
    const found = warnings.find(
      (w) => w.includes('SITE_OWNER_CONTACT_ID missing') && w.includes('sendEmail'),
    );
    expect(found, `expected explicit warn naming sendEmail; got: ${JSON.stringify(warnings)}`).toBeDefined();
    warnSpy.mockRestore();
  });

  it('does NOT emit any owner-notification email (no triggeredEmails.emailContact call)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendEmail(validContactForm);
    expect(__getEmailLog()).toHaveLength(0);
    warnSpy.mockRestore();
  });
});

describe('submitSwatchRequest — SITE_OWNER_CONTACT_ID missing (cf-secrets.F1)', () => {
  const validRequest = {
    name: 'Alice Test',
    email: 'alice@example.com',
    swatches: ['ESP-1'],
    productName: 'Eureka Frame',
    productId: 'p-1',
    address: '123 Main St',
  };

  it('returns success: false with a customer-facing call-us message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await submitSwatchRequest(validRequest);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/call/i);
    warnSpy.mockRestore();
  });

  it('logs the warn naming the submitSwatchRequest call site', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await submitSwatchRequest(validRequest);
    const found = warnSpy.mock.calls
      .map((args) => args.map(String).join(' '))
      .find((w) => w.includes('SITE_OWNER_CONTACT_ID missing') && w.includes('submitSwatchRequest'));
    expect(found).toBeDefined();
    warnSpy.mockRestore();
  });
});

describe('sendOrderNotification — SITE_OWNER_CONTACT_ID missing (cf-secrets.F1)', () => {
  const validOrder = {
    number: 'CF-12345',
    buyerName: 'Order Buyer',
    total: '$100.00',
    lineItems: [{}],
  };

  it('returns success: false (silent failure to caller) without throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await sendOrderNotification(validOrder);
    expect(res).toEqual({ success: false });
    warnSpy.mockRestore();
  });

  it('logs the warn naming the sendOrderNotification call site', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendOrderNotification(validOrder);
    const found = warnSpy.mock.calls
      .map((args) => args.map(String).join(' '))
      .find((w) => w.includes('SITE_OWNER_CONTACT_ID missing') && w.includes('sendOrderNotification'));
    expect(found).toBeDefined();
    warnSpy.mockRestore();
  });
});
