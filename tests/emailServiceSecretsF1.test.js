/**
 * @file emailServiceSecretsF1.test.js
 * @description cf-d8ta (cf-7pd6 F1) — explicit logging + correct caller
 * behaviour when SITE_OWNER_CONTACT_ID is missing from Secrets Manager.
 *
 * Pre-fix: bare `await getSecret(...)` propagated a "Secret not found"
 * rejection to each caller's catch, which logged a generic "Failed to
 * send …" — no signal that the root cause was secret misconfiguration.
 *
 * Post-fix (rennala / cf-d8ta):
 * - `sendEmail` + `submitSwatchRequest`: skip owner notification but
 *   CONTINUE — customer CMS insert + auto-reply still run (customer path
 *   preserved when only the owner secret is missing).
 * - `sendOrderNotification`: returns { success: false, reason:
 *   'site_owner_contact_id_missing' } — owner notify IS the only side
 *   effect, so structured failure aids cutover-night observability.
 * - All three log an explicit '[emailService] SITE_OWNER_CONTACT_ID
 *   secret missing or unreadable' warn via _resolveSiteOwnerContactId.
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

describe('sendEmail — SITE_OWNER_CONTACT_ID missing (cf-d8ta)', () => {
  it('returns success: true — customer path continues even when owner secret is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await sendEmail(validContactForm);
    expect(res.success).toBe(true);
    warnSpy.mockRestore();
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendEmail(validContactForm);
    const warnings = warnSpy.mock.calls.map((args) => args.map(String).join(' '));
    const found = warnings.find((w) => w.includes('SITE_OWNER_CONTACT_ID'));
    expect(found, `expected explicit SITE_OWNER_CONTACT_ID warn; got: ${JSON.stringify(warnings)}`).toBeDefined();
    warnSpy.mockRestore();
  });

  it('does NOT emit an owner-notification email (customer auto-reply may still fire)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendEmail(validContactForm);
    // With rennala's "continue customer path" behavior, the customer auto-reply
    // can fire even when the owner secret is missing. Only the owner email is
    // skipped. If owner email were also sent, log would have 2 entries.
    expect(__getEmailLog().length).toBeLessThanOrEqual(1);
    warnSpy.mockRestore();
  });
});

describe('submitSwatchRequest — SITE_OWNER_CONTACT_ID missing (cf-d8ta)', () => {
  const validRequest = {
    name: 'Alice Test',
    email: 'alice@example.com',
    swatches: ['ESP-1'],
    productName: 'Eureka Frame',
    productId: 'p-1',
    address: '123 Main St',
  };

  it('returns success: true — customer path continues even when owner secret is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await submitSwatchRequest(validRequest);
    expect(res.success).toBe(true);
    warnSpy.mockRestore();
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await submitSwatchRequest(validRequest);
    const found = warnSpy.mock.calls
      .map((args) => args.map(String).join(' '))
      .find((w) => w.includes('SITE_OWNER_CONTACT_ID'));
    expect(found).toBeDefined();
    warnSpy.mockRestore();
  });
});

describe('sendOrderNotification — SITE_OWNER_CONTACT_ID missing (cf-d8ta)', () => {
  const validOrder = {
    number: 'CF-12345',
    buyerName: 'Order Buyer',
    total: '$100.00',
    lineItems: [{}],
  };

  it('returns { success: false, reason: "site_owner_contact_id_missing" } without throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await sendOrderNotification(validOrder);
    expect(res).toEqual({ success: false, reason: 'site_owner_contact_id_missing' });
    warnSpy.mockRestore();
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendOrderNotification(validOrder);
    const found = warnSpy.mock.calls
      .map((args) => args.map(String).join(' '))
      .find((w) => w.includes('SITE_OWNER_CONTACT_ID'));
    expect(found).toBeDefined();
    warnSpy.mockRestore();
  });
});
