/**
 * @file emailServiceAB.test.js
 * @description CF-sn8n: Tests for sendABEmail in emailService.web.js.
 *
 * Covers:
 *  - Valid call: picks deterministic variant, sends triggered email, logs to EmailABLog
 *  - Returns { sent: true, variant } on success
 *  - Falls back to first variant when assigned variant not in array
 *  - Input validation: missing params, invalid email
 *  - Error handling: triggeredEmails failure → { sent: false, reason: 'send_failed' }
 *  - Logging: EmailABLog record inserted with correct fields after send
 */

import { describe, it, expect, vi } from 'vitest';
import { __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import { __getInserted } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

// Import sendABEmail directly from source — dynamic imports inside are resolved
// via vitest alias (backend/emailABService.web → src/backend/emailABService.web.js).
import { sendABEmail } from '../src/backend/emailService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const MEMBER_ID = 'member-abc123';
const CAMPAIGN_ID = 'welcome_step1';
const RECIPIENT = 'buyer@test.com';

const VARIANTS = [
  {
    variant: 'A',
    templateId: 'welcome_series_1_a',
    variables: { subjectLine: "Welcome — here's 10% off", firstName: 'Test' },
  },
  {
    variant: 'B',
    templateId: 'welcome_series_1_b',
    variables: { subjectLine: 'Your 10% gift is inside', firstName: 'Test' },
  },
];

// ── sendABEmail — success ─────────────────────────────────────────────────────

describe('sendABEmail — success path', () => {
  it('returns { sent: true, variant } on success', async () => {
    const result = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    expect(result.sent).toBe(true);
    expect(['A', 'B']).toContain(result.variant);
  });

  it('calls triggeredEmails.emailContact with chosen templateId and memberId', async () => {
    const result = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const log = __getEmailLog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    const last = log[log.length - 1];
    expect(last.contactId).toBe(MEMBER_ID);
    const chosen = VARIANTS.find(v => v.variant === result.variant);
    expect(last.templateId).toBe(chosen.templateId);
  });

  it('passes variant variables to triggeredEmails', async () => {
    const result = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const log = __getEmailLog();
    const last = log[log.length - 1];
    const chosen = VARIANTS.find(v => v.variant === result.variant);
    expect(last.options.variables).toMatchObject(chosen.variables);
  });

  it('inserts an EmailABLog record after sending', async () => {
    await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const records = __getInserted('EmailABLog');
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it('EmailABLog record has correct memberId, campaignId, and variant', async () => {
    const result = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const records = __getInserted('EmailABLog');
    const record = records[records.length - 1];
    expect(record.memberId).toBe(MEMBER_ID);
    expect(record.campaignId).toBe(CAMPAIGN_ID);
    expect(record.variant).toBe(result.variant);
  });

  it('EmailABLog record stores lowercased recipientEmail', async () => {
    await sendABEmail(MEMBER_ID, CAMPAIGN_ID, '  Buyer@TEST.com  ', VARIANTS);
    const records = __getInserted('EmailABLog');
    const record = records[records.length - 1];
    expect(record.recipientEmail).toBe('buyer@test.com');
  });

  it('variant assignment is deterministic — same memberId+campaignId always same variant', async () => {
    const r1 = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const r2 = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    expect(r1.variant).toBe(r2.variant);
  });

  it('falls back to first variant when assigned variant is not in variants array', async () => {
    // Only provide variant B — if A is assigned, fall back to B
    const onlyB = [{ variant: 'B', templateId: 'tpl-b', variables: {} }];
    const result = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, onlyB);
    expect(result.sent).toBe(true);
    expect(result.variant).toBe('B');
  });
});

// ── sendABEmail — input validation ────────────────────────────────────────────

describe('sendABEmail — invalid inputs', () => {
  it('returns invalid_params for missing memberId', async () => {
    const r = await sendABEmail('', CAMPAIGN_ID, RECIPIENT, VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_params for null memberId', async () => {
    const r = await sendABEmail(null, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_params for missing campaignId', async () => {
    const r = await sendABEmail(MEMBER_ID, '', RECIPIENT, VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_params for missing recipientEmail', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, '', VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_params when variants is not an array', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, null);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_params for empty variants array', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, []);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_params');
  });

  it('returns invalid_email for malformed email address', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, 'not-an-email', VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });

  it('returns invalid_email for email with no domain', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, 'user@', VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });

  it('returns invalid_email for email with no local part', async () => {
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, '@example.com', VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });
});

// ── sendABEmail — error handling ──────────────────────────────────────────────

describe('sendABEmail — error handling', () => {
  it('returns { sent: false, reason: "send_failed" } when triggeredEmails throws', async () => {
    __failNextEmail();
    const r = await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('send_failed');
  });

  it('does not insert EmailABLog record when send fails', async () => {
    __failNextEmail();
    await sendABEmail(MEMBER_ID, CAMPAIGN_ID, RECIPIENT, VARIANTS);
    const records = __getInserted('EmailABLog');
    expect(records.length).toBe(0);
  });
});
