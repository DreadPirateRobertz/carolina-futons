import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from '../__mocks__/wix-data.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __failNextEmail } from '../__mocks__/wix-crm-backend.js';
import {
  sendSwatchConfirmationEmail,
} from '../../src/backend/emailService.web.js';

beforeEach(() => {
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
});

// ── sendSwatchConfirmationEmail ─────────────────────────────────────

describe('sendSwatchConfirmationEmail', () => {
  it('sends confirmation email to customer contact', async () => {
    const result = await sendSwatchConfirmationEmail({
      contactId: 'customer-contact-456',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      swatchNames: ['Ocean Blue', 'Forest Green', 'Crimson Red'],
      productName: 'Eureka Futon Frame',
      estimatedDays: 7,
    });

    expect(result).toEqual({ success: true });
    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('swatch_confirmation');
    expect(emails[0].contactId).toBe('customer-contact-456');
  });

  it('includes swatch names in template variables', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Bob',
      email: 'bob@test.com',
      swatchNames: ['Navy', 'Sand'],
      productName: 'Dillon Frame',
      estimatedDays: 5,
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.swatchList).toContain('Navy');
    expect(emails[0].options.variables.swatchList).toContain('Sand');
  });

  it('includes product name in template variables', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Eureka Futon Frame',
      estimatedDays: 7,
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.productName).toBe('Eureka Futon Frame');
  });

  it('includes customer name in template variables', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Alice Johnson',
      email: 'alice@test.com',
      swatchNames: ['Red'],
      productName: 'Product',
      estimatedDays: 5,
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerName).toBe('Alice Johnson');
  });

  it('includes estimated arrival in template variables', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Product',
      estimatedDays: 7,
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.estimatedArrival).toContain('7');
  });

  it('defaults to 5-7 business days when estimatedDays not provided', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Product',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.estimatedArrival).toContain('5-7');
  });

  it('sanitizes customer name', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: '<script>alert("xss")</script>',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Product',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerName).not.toContain('<script>');
  });

  it('sanitizes swatch names', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['<img onerror="hack()">', 'Normal'],
      productName: 'Product',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.swatchList).not.toContain('<img');
  });

  it('returns success: false on email failure', async () => {
    __failNextEmail();
    const result = await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Product',
    });
    expect(result.success).toBe(false);
  });

  it('handles empty swatchNames array', async () => {
    const result = await sendSwatchConfirmationEmail({
      contactId: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: [],
      productName: 'Product',
    });
    expect(result).toEqual({ success: true });
  });

  it('handles missing contactId gracefully', async () => {
    const result = await sendSwatchConfirmationEmail({
      contactId: '',
      name: 'Test',
      email: 'test@test.com',
      swatchNames: ['Blue'],
      productName: 'Product',
    });
    expect(result.success).toBe(false);
  });
});
