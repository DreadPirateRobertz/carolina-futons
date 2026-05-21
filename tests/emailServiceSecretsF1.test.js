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

// cf-n4wy: emailService migrated console.warn (SITE_OWNER_CONTACT_ID secret)
// → canonical logError. Mock the errorHandler module so this test asserts
// the tag namespace instead of console.warn.
vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

import {
  sendEmail,
  submitSwatchRequest,
  sendOrderNotification,
} from '../src/backend/emailService.web.js';
import { logError } from '../src/backend/utils/errorHandler.js';

beforeEach(() => {
  resetSecrets(); // No SITE_OWNER_CONTACT_ID configured in any test below.
  resetCrm();
  vi.mocked(logError).mockClear();
});

// Helper: assert that a logError call's tag contains the SITE_OWNER signal.
function expectOwnerSecretTagLogged() {
  const found = vi.mocked(logError).mock.calls.find(
    (call) =>
      typeof call[0] === 'string' &&
      call[0].includes('emailService:resolveSiteOwnerContactId'),
  );
  expect(found, `expected a resolveSiteOwnerContactId logError; got: ${JSON.stringify(vi.mocked(logError).mock.calls)}`).toBeDefined();
}

const validContactForm = {
  name: 'Bob Test',
  email: 'bob@example.com',
  phone: '828-555-0100',
  subject: 'Question',
  message: 'Hello',
};

describe('sendEmail — SITE_OWNER_CONTACT_ID missing (cf-d8ta)', () => {
  it('returns success: true — customer path continues even when owner secret is missing', async () => {
    const res = await sendEmail(validContactForm);
    expect(res.success).toBe(true);
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn (via canonical logError tag)', async () => {
    await sendEmail(validContactForm);
    expectOwnerSecretTagLogged();
  });

  it('does NOT emit an owner-notification email (customer auto-reply may still fire)', async () => {
    await sendEmail(validContactForm);
    // With rennala's "continue customer path" behavior, the customer auto-reply
    // can fire even when the owner secret is missing. Only the owner email is
    // skipped. If owner email were also sent, log would have 2 entries.
    expect(__getEmailLog().length).toBeLessThanOrEqual(1);
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
    const res = await submitSwatchRequest(validRequest);
    expect(res.success).toBe(true);
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn (via canonical logError tag)', async () => {
    await submitSwatchRequest(validRequest);
    expectOwnerSecretTagLogged();
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
    const res = await sendOrderNotification(validOrder);
    expect(res).toEqual({ success: false, reason: 'site_owner_contact_id_missing' });
  });

  it('logs the explicit "SITE_OWNER_CONTACT_ID" warn (via canonical logError tag)', async () => {
    await sendOrderNotification(validOrder);
    expectOwnerSecretTagLogged();
  });
});
