import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from '../__mocks__/wix-data.js';
import { submitContactForm } from '../../src/backend/contactSubmissions.web.js';

// ── submitContactForm ───────────────────────────────────────────────

describe('submitContactForm', () => {
  it('succeeds with valid email', async () => {
    const result = await submitContactForm({ email: 'customer@test.com' });
    expect(result.success).toBe(true);
  });

  it('persists submission to ContactSubmissions collection', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'customer@test.com',
      name: 'Jane Doe',
      source: 'exit_intent_popup',
    });

    expect(inserted).not.toBeNull();
    expect(inserted.collection).toBe('ContactSubmissions');
    expect(inserted.item.email).toBe('customer@test.com');
    expect(inserted.item.name).toBe('Jane Doe');
    expect(inserted.item.source).toBe('exit_intent_popup');
  });

  it('normalizes email to lowercase', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({ email: 'USER@Example.COM' });
    expect(inserted.item.email).toBe('user@example.com');
  });

  it('sanitizes name field (strips HTML)', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'user@test.com',
      name: '<script>alert("xss")</script>Jane',
    });
    expect(inserted.item.name).not.toContain('<script>');
    expect(inserted.item.name).toContain('Jane');
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

  it('rate-limits duplicate submissions within 60 seconds', async () => {
    // Seed a recent submission
    __seed('ContactSubmissions', [{
      _id: 'cs-1',
      email: 'repeat@test.com',
      submittedAt: new Date(), // just now
    }]);

    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    const result = await submitContactForm({ email: 'repeat@test.com' });
    // Should return silent success but NOT insert
    expect(result.success).toBe(true);
    expect(inserted).toBeNull();
  });

  it('includes optional fields when provided', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

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

    expect(inserted.item.phone).toBe('555-0123');
    expect(inserted.item.source).toBe('back_in_stock');
    expect(inserted.item.status).toBe('back_in_stock_request');
    expect(inserted.item.productId).toBe('prod-abc');
    expect(inserted.item.productName).toBe('Kodiak Futon Frame');
  });

  it('strips img tag XSS vectors from name', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'user@test.com',
      name: '<img src=x onerror=alert(1)>John',
    });
    expect(inserted.item.name).not.toContain('<img');
    expect(inserted.item.name).not.toContain('onerror');
    expect(inserted.item.name).toBe('John');
  });

  it('strips nested/malformed HTML tags from name', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'user@test.com',
      name: '<div><script>alert("xss")</script></div>Safe',
    });
    expect(inserted.item.name).not.toContain('<div');
    expect(inserted.item.name).not.toContain('<script');
    expect(inserted.item.name).toContain('Safe');
  });

  it('strips event handler XSS from notes field', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'user@test.com',
      notes: 'Hello <iframe src="javascript:alert(1)">click</iframe> world',
    });
    expect(inserted.item.notes).not.toContain('<iframe');
    expect(inserted.item.notes).not.toContain('javascript:');
    expect(inserted.item.notes).toContain('Hello');
    expect(inserted.item.notes).toContain('world');
  });

  it('strips SVG-based XSS vectors', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({
      email: 'user@test.com',
      name: '<svg onload=alert(1)>Bob</svg>',
    });
    expect(inserted.item.name).not.toContain('<svg');
    expect(inserted.item.name).not.toContain('onload');
    expect(inserted.item.name).toContain('Bob');
  });

  it('defaults source to "unknown" when not provided', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await submitContactForm({ email: 'user@test.com' });
    expect(inserted.item.source).toBe('unknown');
  });

  it('sets submittedAt timestamp', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    const before = Date.now();
    await submitContactForm({ email: 'user@test.com' });
    const after = Date.now();

    expect(inserted.item.submittedAt).toBeInstanceOf(Date);
    expect(inserted.item.submittedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(inserted.item.submittedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
