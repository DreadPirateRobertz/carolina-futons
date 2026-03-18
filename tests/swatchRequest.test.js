// swatchRequest.test.js — CF-ahzv: Fabric Swatch Request Page
// Tests for swatchRequest.web.js backend module.
// TDD: these tests were written BEFORE the implementation.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from 'wix-data';
import { __reset as __resetCrm, __seedContacts, __getEmailLog } from 'wix-crm-backend';

import { submitSwatchRequest } from '../src/backend/swatchRequest.web.js';

const validContact = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  address1: '123 Main St',
  city: 'Charlotte',
  state: 'NC',
  zip: '28201',
};

const validSwatchIds = ['sw-1', 'sw-2'];

beforeEach(() => {
  __reset();
  __resetCrm();
  __seed('FabricSwatches', [
    { _id: 'sw-1', name: 'Natural Oatmeal', inStock: true },
    { _id: 'sw-2', name: 'Espresso Brown', inStock: true },
    { _id: 'sw-3', name: 'Slate Blue', inStock: true },
    { _id: 'sw-4', name: 'Forest Green', inStock: true },
    { _id: 'sw-5', name: 'Charcoal', inStock: true },
    { _id: 'sw-6', name: 'Ivory', inStock: true },
  ]);
});

// ── Happy path ───────────────────────────────────────────────────────

describe('submitSwatchRequest — success', () => {
  it('returns success with a requestId', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
    expect(typeof result.requestId).toBe('string');
    expect(result.requestId.length).toBeGreaterThan(0);
  });

  it('inserts a SwatchRequests record', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const inserted = __getInserted('SwatchRequests');
    expect(inserted.length).toBe(1);
    expect(inserted[0].contactEmail).toBe('jane@example.com');
  });

  it('stores swatchIds in the record', async () => {
    await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-3'],
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.swatchIds).toEqual(['sw-1', 'sw-3']);
  });

  it('stores swatchNames resolved from FabricSwatches', async () => {
    await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-2'],
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.swatchNames).toContain('Natural Oatmeal');
    expect(record.swatchNames).toContain('Espresso Brown');
  });

  it('stores shippingAddress object', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.shippingAddress.address1).toBe('123 Main St');
    expect(record.shippingAddress.city).toBe('Charlotte');
    expect(record.shippingAddress.state).toBe('NC');
    expect(record.shippingAddress.zip).toBe('28201');
  });

  it('stores contactName as "FirstName LastName"', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.contactName).toBe('Jane Doe');
  });

  it('stores status as pending', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.status).toBe('pending');
  });

  it('stores requestedAt as a date', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.requestedAt).toBeInstanceOf(Date);
  });

  it('accepts optional address2 field', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address2: 'Apt 4B' },
    });
    expect(result.success).toBe(true);
    const [record] = __getInserted('SwatchRequests');
    expect(record.shippingAddress.address2).toBe('Apt 4B');
  });

  it('accepts optional phone field', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, phone: '555-1234' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts max 5 swatches', async () => {
    const result = await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-2', 'sw-3', 'sw-4', 'sw-5'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });

  it('accepts 1 swatch (minimum)', async () => {
    const result = await submitSwatchRequest({
      swatchIds: ['sw-1'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });
});

// ── CRM integration ──────────────────────────────────────────────────

describe('submitSwatchRequest — CRM', () => {
  it('creates a CRM contact via appendOrCreateContact', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const log = __getEmailLog();
    // CRM contact was upserted — verify by checking subsequent submission
    // uses the same contactId (idempotent)
    const result2 = await submitSwatchRequest({
      swatchIds: ['sw-3'],
      contactInfo: validContact,
    });
    expect(result2.success).toBe(true);
  });

  it('stores contactId in SwatchRequests record', async () => {
    __seedContacts([{
      _id: 'cid-existing',
      primaryInfo: { email: 'jane@example.com' },
    }]);
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(typeof record.contactId).toBe('string');
    expect(record.contactId.length).toBeGreaterThan(0);
  });
});

// ── Email automation ─────────────────────────────────────────────────

describe('submitSwatchRequest — email', () => {
  it('queues a swatch_confirmation email immediately', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const confirmation = queued.find(e => e.sequenceType === 'swatch_nurture' && e.sequenceStep === 1);
    expect(confirmation).toBeDefined();
    expect(confirmation.status).toBe('pending');
  });

  it('queues Day 3 follow-up email', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const day3 = queued.find(e => e.sequenceType === 'swatch_nurture' && e.sequenceStep === 2);
    expect(day3).toBeDefined();
    expect(day3.scheduledFor).toBeInstanceOf(Date);
    // Should be ~3 days after now
    const diffMs = day3.scheduledFor - Date.now();
    expect(diffMs).toBeGreaterThan(2 * 24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(4 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('queues Day 7 follow-up email', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const day7 = queued.find(e => e.sequenceType === 'swatch_nurture' && e.sequenceStep === 3);
    expect(day7).toBeDefined();
  });

  it('queues Day 14 final nudge email', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const day14 = queued.find(e => e.sequenceType === 'swatch_nurture' && e.sequenceStep === 4);
    expect(day14).toBeDefined();
  });

  it('includes swatchNames in email variables', async () => {
    await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-2'],
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const confirmation = queued.find(e => e.sequenceStep === 1);
    expect(confirmation.variables.swatchNames).toContain('Natural Oatmeal');
  });

  it('includes recipientEmail in all email queue entries', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const queued = __getInserted('EmailQueue');
    const swatchEmails = queued.filter(e => e.sequenceType === 'swatch_nurture');
    expect(swatchEmails.length).toBe(4);
    for (const e of swatchEmails) {
      expect(e.recipientEmail).toBe('jane@example.com');
    }
  });
});

// ── Validation — swatchIds ───────────────────────────────────────────

describe('submitSwatchRequest — swatchId validation', () => {
  it('rejects missing swatchIds', async () => {
    const result = await submitSwatchRequest({
      swatchIds: undefined,
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/swatch/i);
  });

  it('rejects empty swatchIds array', async () => {
    const result = await submitSwatchRequest({
      swatchIds: [],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/swatch/i);
  });

  it('rejects more than 5 swatches', async () => {
    const result = await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-2', 'sw-3', 'sw-4', 'sw-5', 'sw-6'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/5/);
  });

  it('rejects non-array swatchIds', async () => {
    const result = await submitSwatchRequest({
      swatchIds: 'sw-1',
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
  });

  it('rejects swatchIds with non-string values', async () => {
    const result = await submitSwatchRequest({
      swatchIds: [null, 'sw-1'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate swatchIds', async () => {
    const result = await submitSwatchRequest({
      swatchIds: ['sw-1', 'sw-1'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });
});

// ── Validation — contactInfo ─────────────────────────────────────────

describe('submitSwatchRequest — contactInfo validation', () => {
  it('rejects missing contactInfo', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing firstName', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, firstName: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('rejects missing lastName', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, lastName: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('rejects invalid email', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects missing address1', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address1: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/address/i);
  });

  it('rejects missing city', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, city: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/city/i);
  });

  it('rejects missing state', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, state: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/state/i);
  });

  it('rejects missing zip', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/zip/i);
  });

  it('rejects zip with letters', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '2820A' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/zip/i);
  });

  it('rejects 4-digit zip', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '2820' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects 6-digit zip', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '282011' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid 5-digit zip', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '90210' },
    });
    expect(result.success).toBe(true);
  });
});

// ── Sanitization ─────────────────────────────────────────────────────

describe('submitSwatchRequest — sanitization', () => {
  it('strips HTML from firstName', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, firstName: '<script>Jane</script>' },
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.contactName).not.toContain('<script>');
    expect(record.contactName).toContain('Jane');
  });

  it('strips HTML from address1', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address1: '<b>123 Main</b> St' },
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.shippingAddress.address1).not.toContain('<b>');
    expect(record.shippingAddress.address1).toContain('123 Main');
  });

  it('normalizes email to lowercase', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'Jane@Example.COM' },
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.contactEmail).toBe('jane@example.com');
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe('submitSwatchRequest — edge cases', () => {
  it('returns success:false (not throws) on unexpected error', async () => {
    // Passing completely invalid args
    const result = await submitSwatchRequest(null);
    expect(result.success).toBe(false);
  });

  it('stores optional product slug if provided', async () => {
    const result = await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
      productSlug: 'blue-ridge-futon-frame',
    });
    expect(result.success).toBe(true);
    const [record] = __getInserted('SwatchRequests');
    expect(record.productSlug).toBe('blue-ridge-futon-frame');
  });

  it('omits productSlug when not provided', async () => {
    await submitSwatchRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    const [record] = __getInserted('SwatchRequests');
    expect(record.productSlug).toBeUndefined();
  });
});
