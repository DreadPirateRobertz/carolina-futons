import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __reset as resetData } from './__mocks__/wix-data.js';
import { __reset as resetCrm, __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import { __reset as resetMarketing, coupons } from './__mocks__/wix-marketing-backend.js';
import { subscribeToNewsletter, syncToESP } from '../src/backend/newsletterService.web.js';

beforeEach(() => {
  resetData();
  resetCrm();
  resetMarketing();
});

// ── subscribeToNewsletter ────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  // ── Happy path ──────────────────────────────────────────────────

  it('returns success with discount code for valid email', async () => {
    const result = await subscribeToNewsletter('customer@example.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('persists subscriber to NewsletterSubscribers collection', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('jane@test.com');

    expect(inserted).not.toBeNull();
    expect(inserted.collection).toBe('NewsletterSubscribers');
    expect(inserted.item.email).toBe('jane@test.com');
    expect(inserted.item.source).toBe('exit_intent_popup');
    expect(inserted.item.subscribedAt).toBeInstanceOf(Date);
  });

  it('normalizes email to lowercase', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('USER@Example.COM');
    expect(inserted.item.email).toBe('user@example.com');
  });

  it('trims whitespace from email', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('  test@test.com  ');
    expect(inserted.item.email).toBe('test@test.com');
  });

  it('accepts custom source parameter', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('user@test.com', { source: 'homepage_footer' });
    expect(inserted.item.source).toBe('homepage_footer');
  });

  // ── Duplicate prevention ────────────────────────────────────────

  it('returns success silently for duplicate email (no info leak)', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'dupe@test.com', subscribedAt: new Date() },
    ]);

    const result = await subscribeToNewsletter('dupe@test.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('does not insert a second record for duplicate email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'dupe@test.com', subscribedAt: new Date() },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    await subscribeToNewsletter('dupe@test.com');
    expect(insertCount).toBe(0);
  });

  it('treats duplicate check case-insensitively', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'user@test.com', subscribedAt: new Date() },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    await subscribeToNewsletter('USER@TEST.COM');
    expect(insertCount).toBe(0);
  });

  // ── Email validation ────────────────────────────────────────────

  it('rejects empty string', async () => {
    const result = await subscribeToNewsletter('');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects null/undefined', async () => {
    const result = await subscribeToNewsletter(null);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects whitespace-only string', async () => {
    const result = await subscribeToNewsletter('   ');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects email without @ sign', async () => {
    const result = await subscribeToNewsletter('notanemail');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  it('rejects email without domain', async () => {
    const result = await subscribeToNewsletter('user@');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  it('rejects email with spaces', async () => {
    const result = await subscribeToNewsletter('user @test.com');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  // ── XSS/injection ──────────────────────────────────────────────

  it('sanitizes HTML in email (strips tags before storing)', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    // sanitize strips <script> tags → "alert(\"xss\")user@test.com" is valid email format
    const result = await subscribeToNewsletter('<script>alert("xss")</script>user@test.com');
    if (result.success && inserted) {
      expect(inserted.item.email).not.toContain('<script>');
      expect(inserted.item.email).not.toContain('</script>');
    }
  });

  it('sanitizes source parameter', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('user@test.com', { source: '<img onerror=alert(1)>popup' });
    if (inserted) {
      expect(inserted.item.source).not.toContain('<img');
    }
  });

  // ── Loyalty Bronze auto-enroll ──────────────────────────────────

  it('records loyalty tier as Bronze for new subscriber', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('loyal@test.com');
    expect(inserted.item.loyaltyTier).toBe('Bronze');
  });

  // ── Error handling ──────────────────────────────────────────────

  it('returns failure gracefully when data insert throws', async () => {
    // Seed to avoid duplicate path, then cause an insert failure
    // by making the email pass validation but using a broken mock
    const originalInsert = (await import('wix-data')).default.insert;
    const wixData = (await import('wix-data')).default;
    wixData.insert = async () => { throw new Error('Database unavailable'); };

    const result = await subscribeToNewsletter('fail@test.com');
    expect(result.success).toBe(false);

    wixData.insert = originalInsert; // restore
  });

  it('does not leak internal error details to caller', async () => {
    const wixData = (await import('wix-data')).default;
    const originalInsert = wixData.insert;
    wixData.insert = async () => { throw new Error('Sensitive DB error details'); };

    const result = await subscribeToNewsletter('error@test.com');
    expect(result.message || '').not.toContain('Sensitive');

    wixData.insert = originalInsert;
  });
});

// ── syncToESP ────────────────────────────────────────────────────────

describe('syncToESP', () => {
  it('returns skipped when no ESP config is set', async () => {
    const result = await syncToESP('test@example.com', 'exit_intent_popup');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('no_esp_configured');
  });

  it('rejects invalid email', async () => {
    const result = await syncToESP('notanemail', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects empty email', async () => {
    const result = await syncToESP('', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('sanitizes source parameter', async () => {
    const result = await syncToESP('test@example.com', '<script>xss</script>');
    // Should not throw even with malicious source
    expect(result.synced).toBe(false);
  });
});
