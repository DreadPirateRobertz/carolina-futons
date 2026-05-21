/**
 * cf-gg0j — submitSwatchRequest new-visitor swatch confirmation fix.
 *
 * Root cause: the previous implementation used contacts.queryContacts() to find
 * an existing CRM contact before sending swatch_confirmation. New visitors have
 * no CRM contact yet — the query returned 0 items and the email was silently
 * skipped. Fix: use contacts.appendOrCreateContact (idempotent — dedupes by
 * email), which creates the contact on first visit and finds it on subsequent
 * visits, matching the _sendCustomerContactAutoReply pattern in the same file.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetCrm, __getEmailLog, __seedContacts } from './__mocks__/wix-crm-backend.js';
import { submitSwatchRequest } from '../src/backend/emailService.web.js';

const validRequest = {
  name: 'Dana New',
  email: 'dana-new@example.com',
  address: '456 Oak Ave, Asheville NC 28801',
  productId: 'eur-frame-01',
  productName: 'Eureka Futon Frame',
  swatchNames: ['Natural Oatmeal', 'Espresso Brown'],
};

beforeEach(() => {
  resetSecrets();
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-cid-123' });
  resetCrm();
  // No contacts seeded — simulates a brand-new visitor with no CRM record.
});

describe('cf-gg0j — submitSwatchRequest new-visitor swatch confirmation', () => {
  it('sends swatch_confirmation for a brand-new email (no prior CRM contact)', async () => {
    const result = await submitSwatchRequest(validRequest);
    expect(result.success).toBe(true);
    const emails = __getEmailLog();
    const confirmation = emails.find(e => e.templateId === 'VJBTzwh');
    expect(
      confirmation,
      'swatch_confirmation email should fire even when visitor has no prior CRM contact',
    ).toBeDefined();
  });

  it('sends swatch_confirmation for an existing CRM contact (idempotent path)', async () => {
    __seedContacts([{
      _id: 'existing-cid-456',
      primaryInfo: { email: 'dana-new@example.com' },
    }]);
    const result = await submitSwatchRequest(validRequest);
    expect(result.success).toBe(true);
    const emails = __getEmailLog();
    const confirmation = emails.find(e => e.templateId === 'VJBTzwh');
    expect(confirmation).toBeDefined();
  });

  it('includes correct template variables in swatch_confirmation', async () => {
    await submitSwatchRequest(validRequest);
    const emails = __getEmailLog();
    const confirmation = emails.find(e => e.templateId === 'VJBTzwh');
    expect(confirmation.options.variables.customerName).toBe('Dana New');
    expect(confirmation.options.variables.productName).toBe('Eureka Futon Frame');
    expect(confirmation.options.variables.swatchList).toContain('Natural Oatmeal');
    expect(confirmation.options.variables.swatchList).toContain('Espresso Brown');
    expect(confirmation.options.variables.estimatedArrival).toBeDefined();
  });

  it('does not throw when swatch_confirmation email fails (best-effort)', async () => {
    // Simulate appendOrCreateContact returning no contactId so the email is
    // silently skipped — the outer request must still succeed.
    const crm = await import('./__mocks__/wix-crm-backend.js');
    const real = crm.contacts.appendOrCreateContact;
    crm.contacts.appendOrCreateContact = async () => ({});
    try {
      const result = await submitSwatchRequest(validRequest);
      expect(result.success).toBe(true);
    } finally {
      crm.contacts.appendOrCreateContact = real;
    }
  });
});
