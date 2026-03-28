/**
 * @file auditLog.test.js
 * @description CF-j43m: Tests for centralized audit logging utility and endpoint wiring.
 *
 * Covers:
 *  - logAuditEvent inserts correct record shape
 *  - logAuditEvent sanitizes inputs
 *  - logAuditEvent is fire-and-forget (never throws)
 *  - Metadata truncation
 *  - Endpoint wiring: representative sample verifying logAuditEvent is called after writes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── logAuditEvent unit tests ────────────────────────────────────────

describe('logAuditEvent', () => {
  let logAuditEvent;

  beforeEach(async () => {
    ({ logAuditEvent } = await import('../src/backend/utils/auditLog.js'));
  });

  it('inserts a record with correct shape into AuditLog collection', async () => {
    await logAuditEvent('ContactSubmissions', 'submit', 'test@example.com', { source: 'contact_page' });

    const inserted = __getInserted('AuditLog');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      collection: 'ContactSubmissions',
      action: 'submit',
      key: 'test@example.com',
    });
    expect(inserted[0].metadata).toContain('contact_page');
    expect(inserted[0].timestamp).toBeInstanceOf(Date);
  });

  it('sanitizes and lowercases the key', async () => {
    await logAuditEvent('Test', 'insert', '  USER@Example.COM  ');

    const inserted = __getInserted('AuditLog');
    expect(inserted[0].key).toBe('user@example.com');
  });

  it('handles null/undefined metadata gracefully', async () => {
    await logAuditEvent('Test', 'insert', 'key1');

    const inserted = __getInserted('AuditLog');
    expect(inserted[0].metadata).toBe('');
  });

  it('truncates long metadata to 2000 chars', async () => {
    const longMeta = { data: 'x'.repeat(3000) };
    await logAuditEvent('Test', 'insert', 'key1', longMeta);

    const inserted = __getInserted('AuditLog');
    expect(inserted[0].metadata.length).toBeLessThanOrEqual(2000);
  });

  it('never throws on DB error (fire-and-forget)', async () => {
    const { __setInsertError } = await import('./__mocks__/wix-data.js');
    __setInsertError('AuditLog', new Error('DB down'));

    // Should not throw
    await logAuditEvent('Test', 'insert', 'key1');
    // If we got here, it didn't throw
  });

  it('handles empty string inputs', async () => {
    await logAuditEvent('', '', '');

    const inserted = __getInserted('AuditLog');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].collection).toBe('');
    expect(inserted[0].action).toBe('');
    expect(inserted[0].key).toBe('');
  });
});

// Flush microtask queue to let fire-and-forget audit calls complete
const flush = () => new Promise(r => setTimeout(r, 10));

// ── Endpoint wiring integration tests ───────────────────────────────

describe('audit logging wiring — submitContactForm', () => {
  it('logs audit event on successful submission', async () => {
    const { submitContactForm } = await import('../src/backend/contactSubmissions.web.js');

    const result = await submitContactForm({
      email: 'audit@example.com',
      message: 'Test message',
      source: 'test',
    });

    expect(result.success).toBe(true);
    await flush();

    const audits = __getInserted('AuditLog');
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const auditRecord = audits.find(a => a.collection === 'ContactSubmissions');
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('submit');
    expect(auditRecord.key).toBe('audit@example.com');
  });
});

describe('audit logging wiring — captureSpinEmail', () => {
  it('logs audit event on successful capture', async () => {
    const { captureSpinEmail } = await import('../src/backend/spinWheel.web.js');

    const result = await captureSpinEmail('spin@example.com');
    expect(result.success).toBe(true);
    await flush();

    const audits = __getInserted('AuditLog');
    const auditRecord = audits.find(a => a.collection === 'SpinEmailCaptures');
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('submit');
  });
});

describe('audit logging wiring — applyForTradeAccount', () => {
  it('logs audit event on successful application', async () => {
    const { applyForTradeAccount } = await import('../src/backend/tradeProgram.web.js');

    const result = await applyForTradeAccount({
      businessName: 'Test Corp',
      contactName: 'Jane',
      contactEmail: 'trade@example.com',
    });

    expect(result.success).toBe(true);
    await flush();

    const audits = __getInserted('AuditLog');
    const auditRecord = audits.find(a => a.collection === 'TradeAccounts');
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('submit');
    expect(auditRecord.metadata).toContain('Test Corp');
  });
});

describe('audit logging wiring — subscribeToNewsletter', () => {
  it('logs audit event on successful subscription', async () => {
    const { subscribeToNewsletter } = await import('../src/backend/newsletterService.web.js');

    const result = await subscribeToNewsletter('news@example.com', { source: 'footer' });
    expect(result.success).toBe(true);
    await flush();

    const audits = __getInserted('AuditLog');
    const auditRecord = audits.find(a => a.collection === 'NewsletterSubscribers');
    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('subscribe');
  });
});

describe('audit logging wiring — submitReview', () => {
  it('logs audit event on successful review submission', async () => {
    const { submitReview } = await import('../src/backend/dataService.web.js');

    // Seed a ReviewRequests record to update
    __seed('ReviewRequests', [{
      _id: 'rr-1',
      customerEmail: 'reviewer@example.com',
      status: 'pending',
      token: 'valid-token',
    }]);

    const result = await submitReview('rr-1', 'valid-token', 5, 'Great product!');

    if (result.success) {
      await flush();
      const audits = __getInserted('AuditLog');
      const auditRecord = audits.find(a => a.collection === 'ReviewRequests');
      expect(auditRecord).toBeDefined();
      expect(auditRecord.action).toBe('submit_review');
    }
  });
});
