import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { hashRateLimitKey } from '../src/backend/utils/rateLimit.js';
import { submitContactForm } from '../src/backend/contactSubmissions.web.js';

// ── submitContactForm ───────────────────────────────────────────────

describe('submitContactForm', () => {
  beforeEach(() => {
    __reset();
  });

  it('succeeds with valid email', async () => {
    const result = await submitContactForm({ email: 'customer@test.com' });
    expect(result.success).toBe(true);
  });

  it('persists submission to ContactSubmissions collection', async () => {
    await submitContactForm({
      email: 'customer@test.com',
      name: 'Jane Doe',
      source: 'exit_intent_popup',
    });

    const inserts = __getInserted('ContactSubmissions');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].email).toBe('customer@test.com');
    expect(inserts[0].name).toBe('Jane Doe');
    expect(inserts[0].source).toBe('exit_intent_popup');
  });

  it('normalizes email to lowercase', async () => {
    await submitContactForm({ email: 'USER@Example.COM' });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].email).toBe('user@example.com');
  });

  it('sanitizes name field (strips HTML)', async () => {
    await submitContactForm({
      email: 'user@test.com',
      name: '<script>alert("xss")</script>Jane',
    });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].name).not.toContain('<script>');
    expect(inserts[0].name).toContain('Jane');
  });

  it('rejects missing data', async () => {
    const result = await submitContactForm(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing email', async () => {
    const result = await submitContactForm({ name: 'No Email' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await submitContactForm({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rate-limits duplicate submissions when 3/hour limit is reached', async () => {
    // Seed rate limit record at max (3) within window
    __seed('ContactRateLimits', [{
      _id: 'rl-1',
      key: hashRateLimitKey('repeat@test.com'),
      count: 3,
      windowStart: new Date(Date.now() - 1000), // 1 second ago (within window)
    }]);

    const result = await submitContactForm({ email: 'repeat@test.com' });
    // Should return silent success but NOT insert to ContactSubmissions
    expect(result.success).toBe(true);
    expect(__getInserted('ContactSubmissions')).toHaveLength(0);
  });

  it('includes optional fields when provided', async () => {
    await submitContactForm({
      email: 'user@test.com',
      name: 'John',
      phone: '555-0123',
      source: 'back_in_stock',
      status: 'back_in_stock_request',
      notes: 'Interested in the Kodiak futon frame',
      productId: 'prod-abc',
      productName: 'Kodiak Futon Frame',
    });

    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].phone).toBe('555-0123');
    expect(inserts[0].source).toBe('back_in_stock');
    expect(inserts[0].status).toBe('back_in_stock_request');
    expect(inserts[0].productId).toBe('prod-abc');
    expect(inserts[0].productName).toBe('Kodiak Futon Frame');
  });

  it('strips img tag XSS vectors from name', async () => {
    await submitContactForm({
      email: 'user@test.com',
      name: '<img src=x onerror=alert(1)>John',
    });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].name).not.toContain('<img');
    expect(inserts[0].name).not.toContain('onerror');
    expect(inserts[0].name).toBe('John');
  });

  it('strips nested/malformed HTML tags from name', async () => {
    await submitContactForm({
      email: 'user@test.com',
      name: '<div><script>alert("xss")</script></div>Safe',
    });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].name).not.toContain('<div');
    expect(inserts[0].name).not.toContain('<script');
    expect(inserts[0].name).toContain('Safe');
  });

  it('strips event handler XSS from notes field', async () => {
    await submitContactForm({
      email: 'user@test.com',
      notes: 'Hello <iframe src="javascript:alert(1)">click</iframe> world',
    });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].notes).not.toContain('<iframe');
    expect(inserts[0].notes).not.toContain('javascript:');
    expect(inserts[0].notes).toContain('Hello');
    expect(inserts[0].notes).toContain('world');
  });

  it('strips SVG-based XSS vectors', async () => {
    await submitContactForm({
      email: 'user@test.com',
      name: '<svg onload=alert(1)>Bob</svg>',
    });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].name).not.toContain('<svg');
    expect(inserts[0].name).not.toContain('onload');
    expect(inserts[0].name).toContain('Bob');
  });

  it('defaults source to "unknown" when not provided', async () => {
    await submitContactForm({ email: 'user@test.com' });
    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].source).toBe('unknown');
  });

  it('sets submittedAt timestamp', async () => {
    const before = Date.now();
    await submitContactForm({ email: 'user@test.com' });
    const after = Date.now();

    const inserts = __getInserted('ContactSubmissions');
    expect(inserts[0].submittedAt).toBeInstanceOf(Date);
    expect(inserts[0].submittedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(inserts[0].submittedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
