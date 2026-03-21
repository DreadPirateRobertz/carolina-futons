/**
 * Tests for CF-gkbx: fabricSampleService.web.js
 *   - submitFabricSampleRequest: validate, rate-limit, store, trigger automation
 *   - Rate limit: 1 request per email per 30 days
 *   - Max 3 swatches per request
 *   - XSS/injection protection in address fields
 *   - Wix Automation: customer confirmation + fulfillment notification
 *   - Duplicate prevention within rate-limit window
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted, __setInsertError } from 'wix-data';
import { __reset as __resetCrm, __getEmailLog, __failNextEmail } from 'wix-crm-backend';
import { submitFabricSampleRequest } from '../src/backend/fabricSampleService.web.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

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

const SWATCHES = [
  { _id: 'sw-1', name: 'Natural Oatmeal', inStock: true },
  { _id: 'sw-2', name: 'Espresso Brown', inStock: true },
  { _id: 'sw-3', name: 'Slate Blue', inStock: true },
];

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeEach(() => {
  __reset();
  __resetCrm();
  __seed('FabricSwatches', SWATCHES);
});

// ── Input validation ─────────────────────────────────────────────────────────

describe('input validation', () => {
  it('rejects missing params object', async () => {
    const result = await submitFabricSampleRequest(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects empty swatchIds array', async () => {
    const result = await submitFabricSampleRequest({ swatchIds: [], contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/swatch/i);
  });

  it('rejects more than 3 swatchIds', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-1', 'sw-2', 'sw-3', 'extra-4'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/3|maximum/i);
  });

  it('accepts exactly 3 swatchIds', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-1', 'sw-2', 'sw-3'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate swatchIds', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-1', 'sw-1'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });

  it('rejects invalid swatch ID (empty string)', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-1', ''],
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-array swatchIds', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: 'sw-1',
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing contactInfo', async () => {
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/contact|required/i);
  });

  it('rejects missing firstName', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, firstName: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('rejects missing lastName', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, lastName: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('rejects invalid email', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects missing address1', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address1: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/address/i);
  });

  it('rejects missing city', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, city: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/city/i);
  });

  it('rejects missing state', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, state: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/state/i);
  });

  it('rejects invalid ZIP (non-numeric)', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: 'ABCDE' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/zip/i);
  });

  it('rejects ZIP with fewer than 5 digits', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, zip: '1234' },
    });
    expect(result.success).toBe(false);
  });
});

// ── XSS / injection protection ───────────────────────────────────────────────

describe('XSS and injection protection', () => {
  it('strips HTML tags from address1', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address1: '<script>bad</script>123 Main St' },
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted('FabricSampleRequests')[0];
    // sanitize() strips tags but preserves text content — ensure no HTML tags remain
    expect(inserted.shippingAddress.address1).not.toContain('<script>');
    expect(inserted.shippingAddress.address1).not.toContain('</script>');
    expect(inserted.shippingAddress.address1).toContain('123 Main St');
  });

  it('strips HTML from firstName', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, firstName: '<b>Jane</b>' },
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted('FabricSampleRequests')[0];
    expect(inserted.contactName).not.toContain('<b>');
  });

  it('strips HTML from city', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, city: 'Charlotte<img src=x onerror=alert(1)>' },
    });
    expect(result.success).toBe(true);
    const inserted = __getInserted('FabricSampleRequests')[0];
    expect(inserted.shippingAddress.city).not.toContain('<img');
  });

  it('rejects address that becomes empty after stripping', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, address1: '<b></b>' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/address/i);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('rate limiting (1 per email per 30 days)', () => {
  it('accepts first request from an email', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });

  it('rejects second request from same email within 30 days', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'prev-001',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(5),
      status: 'pending',
    }]);
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/30 days|recently|rate/i);
  });

  it('allows request from same email after 30 days', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'old-001',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(31),
      status: 'fulfilled',
    }]);
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });

  it('allows request from a different email even if another was just submitted', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'prev-002',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(1),
      status: 'pending',
    }]);
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'other@example.com' },
    });
    expect(result.success).toBe(true);
  });

  it('rate limit check is case-insensitive on email (uppercase input normalizes to match)', async () => {
    // Storage always normalizes emails to lowercase; uppercase input must still be blocked
    __seed('FabricSampleRequests', [{
      _id: 'prev-003',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(2),
      status: 'pending',
    }]);
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'JANE@EXAMPLE.COM' },
    });
    expect(result.success).toBe(false);
  });

  it('blocks request at exactly 30 days (rate limit boundary is inclusive)', async () => {
    // Seed 1 second inside the 30-day window to avoid a race between the seed
    // timestamp and the service's cutoff computation (both use Date.now()).
    const thirtyDaysAgoWithBuffer = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 1000);
    __seed('FabricSampleRequests', [{
      _id: 'boundary-001',
      contactEmail: 'jane@example.com',
      requestedAt: thirtyDaysAgoWithBuffer,
      status: 'pending',
    }]);
    const result = await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
    });
    expect(result.success).toBe(false);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe('persistence', () => {
  it('inserts a record into FabricSampleRequests', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const inserted = __getInserted('FabricSampleRequests');
    expect(inserted).toHaveLength(1);
  });

  it('returns requestId matching inserted record _id', async () => {
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();
    const inserted = __getInserted('FabricSampleRequests')[0];
    expect(result.requestId).toBe(inserted._id);
  });

  it('stores contactEmail, contactName, swatchIds, shippingAddress, status=pending', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.contactEmail).toBe('jane@example.com');
    expect(record.contactName).toBe('Jane Doe');
    expect(record.swatchIds).toEqual(validSwatchIds);
    expect(record.status).toBe('pending');
    expect(record.shippingAddress.address1).toBe('123 Main St');
    expect(record.shippingAddress.city).toBe('Charlotte');
    expect(record.shippingAddress.state).toBe('NC');
    expect(record.shippingAddress.zip).toBe('28201');
  });

  it('stores resolved swatch names in the record', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.swatchNames).toEqual(['Natural Oatmeal', 'Espresso Brown']);
  });

  it('stores requestedAt as a Date', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.requestedAt).toBeInstanceOf(Date);
  });

  it('stores optional productSlug when provided', async () => {
    await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: validContact,
      productSlug: 'eureka-futon-frame',
    });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.productSlug).toBe('eureka-futon-frame');
  });

  it('does not store productSlug field when not provided', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record).not.toHaveProperty('productSlug');
  });
});

// ── Wix Automation (triggered emails) ────────────────────────────────────────

describe('Wix Automation email triggers', () => {
  it('triggers customer confirmation email after successful submit', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const emailLog = __getEmailLog();
    const confirmEmail = emailLog.find(e => e.templateId === 'fabric_sample_confirmation');
    expect(confirmEmail).toBeTruthy();
  });

  it('triggers fulfillment notification email after successful submit', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const emailLog = __getEmailLog();
    const fulfillmentEmail = emailLog.find(e => e.templateId === 'fabric_sample_fulfillment');
    expect(fulfillmentEmail).toBeTruthy();
  });

  it('passes swatchNames and address in fulfillment email options', async () => {
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    const emailLog = __getEmailLog();
    const fulfillmentEmail = emailLog.find(e => e.templateId === 'fabric_sample_fulfillment');
    expect(fulfillmentEmail.options?.variables?.swatchNames).toEqual(['Natural Oatmeal', 'Espresso Brown']);
    expect(fulfillmentEmail.options?.variables?.shippingAddress).toBeTruthy();
  });

  it('still saves the record even if automation email fails', async () => {
    __failNextEmail();
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
    const inserted = __getInserted('FabricSampleRequests');
    expect(inserted).toHaveLength(1);
  });

  it('fulfillment email still fires when confirmation email fails', async () => {
    __failNextEmail(); // fails the FIRST email (confirmation)
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    // Drain microtasks so the fire-and-forget completes before asserting
    await Promise.resolve();
    const emailLog = __getEmailLog();
    const fulfillmentEmail = emailLog.find(e => e.templateId === 'fabric_sample_fulfillment');
    expect(fulfillmentEmail).toBeTruthy();
  });

  it('does not trigger emails when validation fails', async () => {
    await submitFabricSampleRequest({ swatchIds: [], contactInfo: validContact });
    expect(__getEmailLog()).toHaveLength(0);
  });

  it('does not trigger emails when rate-limited', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'prev',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(3),
      status: 'pending',
    }]);
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(__getEmailLog()).toHaveLength(0);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns success:true and a requestId on valid submission', async () => {
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();
  });

  it('normalizes email to lowercase before storing', async () => {
    await submitFabricSampleRequest({
      swatchIds: validSwatchIds,
      contactInfo: { ...validContact, email: 'JANE@EXAMPLE.COM' },
    });
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.contactEmail).toBe('jane@example.com');
  });

  it('single swatch submission works', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-1'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
  });

  it('falls back to swatch ID when swatch not found in CMS', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: ['sw-unknown'],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.swatchNames[0]).toBe('sw-unknown');
  });

  it('strips leading/trailing whitespace from swatchIds', async () => {
    const result = await submitFabricSampleRequest({
      swatchIds: [' sw-1 ', ' sw-2 '],
      contactInfo: validContact,
    });
    expect(result.success).toBe(true);
    const record = __getInserted('FabricSampleRequests')[0];
    expect(record.swatchIds).toEqual(['sw-1', 'sw-2']);
  });
});

// ── DB failure ────────────────────────────────────────────────────────────────

describe('database failure handling', () => {
  it('returns success:false when FabricSampleRequests insert fails', async () => {
    __setInsertError('FabricSampleRequests', new Error('DB write failed'));
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.requestId).toBeUndefined();
  });

  it('does not expose raw DB error message to client on insert failure', async () => {
    __setInsertError('FabricSampleRequests', new Error('Internal Wix CMS error: schema mismatch'));
    const result = await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.error).not.toContain('Internal Wix CMS error');
  });

  it('does not trigger emails when DB insert fails', async () => {
    __setInsertError('FabricSampleRequests', new Error('DB write failed'));
    await submitFabricSampleRequest({ swatchIds: validSwatchIds, contactInfo: validContact });
    await Promise.resolve();
    expect(__getEmailLog()).toHaveLength(0);
  });
});
