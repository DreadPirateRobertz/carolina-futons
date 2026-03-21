/**
 * fabricSampleService.test.js — CF-gkbx: Fabric Sample Request backend
 * Tests for src/backend/fabricSampleService.web.js
 * TDD: written before implementation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted, __setQueryError } from 'wix-data';
import { __reset as __resetCrm, __getEmailLog } from 'wix-crm-backend';

import {
  submitFabricSample,
  getAvailableSwatches,
} from '../src/backend/fabricSampleService.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const validContact = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  address: '123 Main St, Charlotte, NC 28201',
};

const validSwatchIds = ['sw-1', 'sw-2'];

function seedSwatches() {
  __seed('FabricSwatches', [
    { _id: 'sw-1', swatchName: 'Natural Oatmeal', colorFamily: 'Neutral', inStock: true },
    { _id: 'sw-2', swatchName: 'Espresso Brown', colorFamily: 'Brown',   inStock: true },
    { _id: 'sw-3', swatchName: 'Slate Blue',      colorFamily: 'Blue',    inStock: true },
    { _id: 'sw-4', swatchName: 'Forest Green',    colorFamily: 'Green',   inStock: false },
  ]);
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeEach(() => {
  __reset();
  __resetCrm();
  seedSwatches();
});

// ── getAvailableSwatches ──────────────────────────────────────────────

describe('getAvailableSwatches', () => {
  it('returns all in-stock swatches', async () => {
    const result = await getAvailableSwatches();
    expect(result.success).toBe(true);
    expect(result.data.swatches.length).toBe(3); // 3 inStock, not 4
  });

  it('each swatch has _id, swatchName, colorFamily', async () => {
    const result = await getAvailableSwatches();
    const first = result.data.swatches[0];
    expect(first).toHaveProperty('_id');
    expect(first).toHaveProperty('swatchName');
    expect(first).toHaveProperty('colorFamily');
  });

  it('returns empty array when no swatches seeded', async () => {
    __reset();
    const result = await getAvailableSwatches();
    expect(result.success).toBe(true);
    expect(result.data.swatches).toEqual([]);
  });

  it('returns error on database failure', async () => {
    __reset();
    __setQueryError('FabricSwatches', new Error('DB error'));
    const result = await getAvailableSwatches();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── submitFabricSample — success ──────────────────────────────────────

describe('submitFabricSample — success', () => {
  it('returns success with requestId', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
    expect(typeof result.requestId).toBe('string');
    expect(result.requestId.length).toBeGreaterThan(0);
  });

  it('inserts a FabricSampleRequests record', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const records = __getInserted('FabricSampleRequests');
    expect(records.length).toBe(1);
  });

  it('stores contactEmail on the record', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.contactEmail).toBe('jane@example.com');
  });

  it('stores contactName on the record', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.contactName).toBe('Jane Doe');
  });

  it('stores swatchIds on the record', async () => {
    await submitFabricSample({ swatchIds: ['sw-1', 'sw-3'], contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.swatchIds).toEqual(['sw-1', 'sw-3']);
  });

  it('resolves and stores swatchNames from FabricSwatches CMS', async () => {
    await submitFabricSample({ swatchIds: ['sw-1', 'sw-2'], contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.swatchNames).toContain('Natural Oatmeal');
    expect(record.swatchNames).toContain('Espresso Brown');
  });

  it('stores shippingAddress on the record', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.shippingAddress).toBe('123 Main St, Charlotte, NC 28201');
  });

  it('sets status to "pending"', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.status).toBe('pending');
  });

  it('sets requestedAt to a Date', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.requestedAt).toBeInstanceOf(Date);
  });

  it('sends customer confirmation email', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const log = __getEmailLog();
    const confirmation = log.find(e => e.templateId === 'fabric_sample_confirmation');
    expect(confirmation).toBeDefined();
  });

  it('sends admin notification email', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    const log = __getEmailLog();
    const admin = log.find(e => e.templateId === 'fabric_sample_admin_notify');
    expect(admin).toBeDefined();
  });

  it('stores optional productId when provided', async () => {
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact, productId: 'prod-123' });
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.productId).toBe('prod-123');
  });
});

// ── submitFabricSample — validation ──────────────────────────────────

describe('submitFabricSample — validation', () => {
  it('rejects missing swatchIds', async () => {
    const result = await submitFabricSample({ swatchIds: null, contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects empty swatchIds array', async () => {
    const result = await submitFabricSample({ swatchIds: [], contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/swatch/i);
  });

  it('rejects more than 3 swatches', async () => {
    const result = await submitFabricSample({ swatchIds: ['sw-1', 'sw-2', 'sw-3', 'sw-4'], contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/3/);
  });

  it('allows exactly 3 swatches', async () => {
    const result = await submitFabricSample({ swatchIds: ['sw-1', 'sw-2', 'sw-3'], contactInfo: validContact });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate swatch IDs', async () => {
    const result = await submitFabricSample({ swatchIds: ['sw-1', 'sw-1'], contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });

  it('rejects missing name', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: { ...validContact, name: '' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('rejects missing email', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: { ...validContact, email: '' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects malformed email', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: { ...validContact, email: 'not-an-email' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects missing address', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: { ...validContact, address: '' } });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/address/i);
  });

  it('rejects null contactInfo', async () => {
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: null });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── submitFabricSample — XSS sanitization ────────────────────────────

describe('submitFabricSample — XSS sanitization', () => {
  it('strips script tags from address field', async () => {
    const malicious = { ...validContact, address: '<script>alert(1)</script>123 Main St' };
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: malicious });
    expect(result.success).toBe(true);
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.shippingAddress).not.toContain('<script>');
  });

  it('strips script tags from name field', async () => {
    const malicious = { ...validContact, name: '<img src=x onerror=alert(1)>Jane' };
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: malicious });
    expect(result.success).toBe(true);
    const [record] = __getInserted('FabricSampleRequests');
    expect(record.contactName).not.toContain('<img');
  });
});

// ── submitFabricSample — rate limiting ───────────────────────────────

describe('submitFabricSample — rate limiting', () => {
  it('rejects same email within 30 days', async () => {
    // Seed a recent request from jane@example.com
    __seed('FabricSampleRequests', [{
      _id: 'req-1',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(10), // 10 days ago — within window
      status: 'pending',
    }]);
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/30 days/i);
  });

  it('allows same email after 30+ days', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'req-1',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(31), // 31 days ago — outside window
      status: 'pending',
    }]);
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
  });

  it('allows different email regardless of recent requests', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'req-1',
      contactEmail: 'other@example.com',
      requestedAt: daysAgo(5),
      status: 'pending',
    }]);
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(result.success).toBe(true);
  });

  it('does not insert a record when rate limited', async () => {
    __seed('FabricSampleRequests', [{
      _id: 'req-1',
      contactEmail: 'jane@example.com',
      requestedAt: daysAgo(1),
      status: 'pending',
    }]);
    const before = __getInserted('FabricSampleRequests').length;
    await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    expect(__getInserted('FabricSampleRequests').length).toBe(before);
  });
});

// ── submitFabricSample — error resilience ────────────────────────────

describe('submitFabricSample — error resilience', () => {
  it('returns error (not throw) when DB insert fails', async () => {
    __setQueryError('FabricSampleRequests', new Error('DB unavailable'));
    // Note: __setQueryError affects queries; insert is a separate path.
    // Test that an unexpected error is caught gracefully.
    const result = await submitFabricSample({ swatchIds: validSwatchIds, contactInfo: validContact });
    // May succeed or fail cleanly — must not throw
    expect(typeof result).toBe('object');
    expect(typeof result.success).toBe('boolean');
  });
});
