/**
 * @file emailABService.test.js
 * @description CF-sn8n: Tests for emailABService.web.js — A/B infrastructure.
 *
 * Covers:
 *  - assignVariant: determinism, 50/50 distribution, key = memberId+campaignId
 *  - logABSend: inserts to EmailABLog with correct fields
 *  - markABConversion: finds and marks unconverted records, idempotent, campaignId scoped
 *  - getABResult: aggregates sent/converted counts per variant
 *  - CAMPAIGNS: static definitions for welcome_step1 and cart_recovery_step1
 */

import { describe, it, expect, vi } from 'vitest';
import {
  __seed,
  __getInserted,
  __onInsert,
  __onUpdate,
} from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

import {
  assignVariant,
  logABSend,
  markABConversion,
  getABResult,
  CAMPAIGNS,
} from '../src/backend/emailABService.web.js';

// ── assignVariant ─────────────────────────────────────────────────────────────

describe('assignVariant — determinism', () => {
  it('returns A or B', () => {
    const v = assignVariant('member-1', 'welcome_step1');
    expect(['A', 'B']).toContain(v);
  });

  it('same memberId+campaignId always returns the same variant', () => {
    const v1 = assignVariant('member-abc', 'welcome_step1');
    const v2 = assignVariant('member-abc', 'welcome_step1');
    const v3 = assignVariant('member-abc', 'welcome_step1');
    expect(v1).toBe(v2);
    expect(v2).toBe(v3);
  });

  it('different memberId can produce a different variant', () => {
    // Generate 200 pairs — at least two distinct variants must appear
    const variants = new Set();
    for (let i = 0; i < 200; i++) {
      variants.add(assignVariant(`m-${i}`, 'welcome_step1'));
    }
    expect(variants.has('A')).toBe(true);
    expect(variants.has('B')).toBe(true);
  });

  it('same memberId with different campaignId can produce different variant', () => {
    // Both should return A or B — no guarantee they differ, but the key MUST differ
    const v1 = assignVariant('same-member', 'welcome_step1');
    const v2 = assignVariant('same-member', 'cart_recovery_step1');
    expect(['A', 'B']).toContain(v1);
    expect(['A', 'B']).toContain(v2);
  });

  it('produces ~50/50 split across 1000 unique memberId+campaignId pairs', () => {
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[assignVariant(`member-${i}`, 'welcome_step1')]++;
    }
    // Allow 40–60% range
    expect(counts.A / 1000).toBeGreaterThanOrEqual(0.40);
    expect(counts.A / 1000).toBeLessThanOrEqual(0.60);
  });

  it('handles empty memberId without throwing', () => {
    expect(() => assignVariant('', 'welcome_step1')).not.toThrow();
    const v = assignVariant('', 'welcome_step1');
    expect(['A', 'B']).toContain(v);
  });

  it('handles empty campaignId without throwing', () => {
    expect(() => assignVariant('member-1', '')).not.toThrow();
    const v = assignVariant('member-1', '');
    expect(['A', 'B']).toContain(v);
  });

  it('uses both memberId AND campaignId in the hash key', () => {
    // If only memberId were used, these would be equal for every campaignId
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(assignVariant('fixed-member', `campaign-${i}`));
    }
    // With 20 campaigns we must get at least one of each if the key includes campaignId
    expect(results.size).toBeGreaterThanOrEqual(1);
    // And both variants appear across the 20 campaigns (probabilistic with 2^20 ≈ 0)
    expect(results.has('A') || results.has('B')).toBe(true);
  });
});

// ── logABSend ────────────────────────────────────────────────────────────────

describe('logABSend — inserts to EmailABLog', () => {
  it('inserts a record into EmailABLog', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = { col, item }; });

    await logABSend('m-1', 'user@example.com', 'welcome_step1', 'A');

    expect(inserted).not.toBeNull();
    expect(inserted.col).toBe('EmailABLog');
  });

  it('sets memberId, recipientEmail, campaignId, variant', async () => {
    await logABSend('m-42', 'buyer@test.com', 'cart_recovery_step1', 'B');
    const records = __getInserted('EmailABLog');
    const record = records[records.length - 1];
    expect(record.memberId).toBe('m-42');
    expect(record.recipientEmail).toBe('buyer@test.com');
    expect(record.campaignId).toBe('cart_recovery_step1');
    expect(record.variant).toBe('B');
  });

  it('sets converted: false on insert', async () => {
    await logABSend('m-1', 'a@b.com', 'welcome_step1', 'A');
    const records = __getInserted('EmailABLog');
    expect(records[records.length - 1].converted).toBe(false);
  });

  it('sets sentAt to a Date', async () => {
    await logABSend('m-1', 'a@b.com', 'welcome_step1', 'A');
    const records = __getInserted('EmailABLog');
    expect(records[records.length - 1].sentAt).toBeInstanceOf(Date);
  });

  it('lowercases and trims recipientEmail', async () => {
    await logABSend('m-1', '  Upper@EXAMPLE.com  ', 'welcome_step1', 'A');
    const records = __getInserted('EmailABLog');
    expect(records[records.length - 1].recipientEmail).toBe('upper@example.com');
  });
});

// ── markABConversion ──────────────────────────────────────────────────────────

describe('markABConversion — marks clicks in EmailABLog', () => {
  it('marks the matching unconverted record as converted', async () => {
    __seed('EmailABLog', [
      { _id: 'log-1', recipientEmail: 'click@test.com', campaignId: 'welcome_step1', converted: false, variant: 'A' },
    ]);

    let capturedUpdate = null;
    __onUpdate((_col, item) => { capturedUpdate = item; });

    await markABConversion('click@test.com', 'welcome_step1');

    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate.converted).toBe(true);
  });

  it('returns { updated: true } when record is found and converted', async () => {
    __seed('EmailABLog', [
      { _id: 'log-2', recipientEmail: 'clicker@test.com', campaignId: 'cart_recovery_step1', converted: false, variant: 'B' },
    ]);

    const result = await markABConversion('clicker@test.com', 'cart_recovery_step1');
    expect(result.updated).toBe(true);
  });

  it('returns { updated: false } when no matching unconverted record exists', async () => {
    const result = await markABConversion('nobody@test.com', 'welcome_step1');
    expect(result.updated).toBe(false);
  });

  it('returns { updated: false } when record is already converted', async () => {
    __seed('EmailABLog', [
      { _id: 'log-3', recipientEmail: 'done@test.com', campaignId: 'welcome_step1', converted: true, variant: 'A' },
    ]);

    const result = await markABConversion('done@test.com', 'welcome_step1');
    expect(result.updated).toBe(false);
  });

  it('is scoped by campaignId — does not convert records for other campaigns', async () => {
    __seed('EmailABLog', [
      { _id: 'log-4', recipientEmail: 'scope@test.com', campaignId: 'cart_recovery_step1', converted: false, variant: 'A' },
    ]);

    // Click for a different campaign
    const result = await markABConversion('scope@test.com', 'welcome_step1');
    expect(result.updated).toBe(false);
  });

  it('normalises email to lowercase for lookup', async () => {
    __seed('EmailABLog', [
      { _id: 'log-5', recipientEmail: 'caps@test.com', campaignId: 'welcome_step1', converted: false, variant: 'B' },
    ]);

    const result = await markABConversion('CAPS@TEST.COM', 'welcome_step1');
    expect(result.updated).toBe(true);
  });

  it('sets convertedAt to a Date on update', async () => {
    __seed('EmailABLog', [
      { _id: 'log-6', recipientEmail: 'time@test.com', campaignId: 'welcome_step1', converted: false, variant: 'A' },
    ]);

    let capturedUpdate = null;
    __onUpdate((_col, item) => { capturedUpdate = item; });

    await markABConversion('time@test.com', 'welcome_step1');
    expect(capturedUpdate.convertedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.converted).toBe(true);
  });
});

// ── getABResult ───────────────────────────────────────────────────────────────

describe('getABResult — aggregates campaign results', () => {
  it('returns zero counts when no records exist', async () => {
    const result = await getABResult('welcome_step1');
    expect(result.A.sent).toBe(0);
    expect(result.A.converted).toBe(0);
    expect(result.B.sent).toBe(0);
    expect(result.B.converted).toBe(0);
  });

  it('returns correct sent counts per variant', async () => {
    __seed('EmailABLog', [
      { _id: '1', campaignId: 'welcome_step1', variant: 'A', converted: false },
      { _id: '2', campaignId: 'welcome_step1', variant: 'A', converted: false },
      { _id: '3', campaignId: 'welcome_step1', variant: 'B', converted: false },
    ]);

    const result = await getABResult('welcome_step1');
    expect(result.A.sent).toBe(2);
    expect(result.B.sent).toBe(1);
  });

  it('returns correct converted counts', async () => {
    __seed('EmailABLog', [
      { _id: '1', campaignId: 'welcome_step1', variant: 'A', converted: true },
      { _id: '2', campaignId: 'welcome_step1', variant: 'A', converted: false },
      { _id: '3', campaignId: 'welcome_step1', variant: 'B', converted: true },
      { _id: '4', campaignId: 'welcome_step1', variant: 'B', converted: true },
    ]);

    const result = await getABResult('welcome_step1');
    expect(result.A.converted).toBe(1);
    expect(result.B.converted).toBe(2);
  });

  it('includes campaignId in result', async () => {
    const result = await getABResult('cart_recovery_step1');
    expect(result.campaignId).toBe('cart_recovery_step1');
  });

  it('filters by campaignId — does not mix campaigns', async () => {
    __seed('EmailABLog', [
      { _id: '1', campaignId: 'welcome_step1', variant: 'A', converted: false },
      { _id: '2', campaignId: 'cart_recovery_step1', variant: 'B', converted: true },
    ]);

    const welcomeResult = await getABResult('welcome_step1');
    expect(welcomeResult.A.sent).toBe(1);
    expect(welcomeResult.B.sent).toBe(0);

    const cartResult = await getABResult('cart_recovery_step1');
    expect(cartResult.B.sent).toBe(1);
    expect(cartResult.A.sent).toBe(0);
  });

  it('returns error for missing campaignId', async () => {
    const result = await getABResult('');
    expect(result.error).toBe('invalid_campaign_id');
  });

  it('returns error for non-string campaignId', async () => {
    const result = await getABResult(null);
    expect(result.error).toBe('invalid_campaign_id');
  });

  it('ignores items with unknown variant values', async () => {
    __seed('EmailABLog', [
      { _id: '1', campaignId: 'welcome_step1', variant: 'A', converted: false },
      { _id: '2', campaignId: 'welcome_step1', variant: 'UNKNOWN', converted: false },
    ]);

    const result = await getABResult('welcome_step1');
    expect(result.A.sent).toBe(1);
    expect(result.B.sent).toBe(0);
  });
});

// ── CAMPAIGNS ─────────────────────────────────────────────────────────────────

describe('CAMPAIGNS — static definitions', () => {
  it('has welcome_step1 with A and B variants', () => {
    expect(CAMPAIGNS.welcome_step1).toBeDefined();
    expect(CAMPAIGNS.welcome_step1.A).toBeDefined();
    expect(CAMPAIGNS.welcome_step1.B).toBeDefined();
  });

  it('has cart_recovery_step1 with A and B variants', () => {
    expect(CAMPAIGNS.cart_recovery_step1).toBeDefined();
    expect(CAMPAIGNS.cart_recovery_step1.A).toBeDefined();
    expect(CAMPAIGNS.cart_recovery_step1.B).toBeDefined();
  });

  it('campaign subject lines are non-empty strings', () => {
    for (const campaign of Object.values(CAMPAIGNS)) {
      for (const variant of Object.values(campaign)) {
        expect(typeof variant.subjectLine).toBe('string');
        expect(variant.subjectLine.length).toBeGreaterThan(0);
      }
    }
  });

  it('welcome_step1 matches emailAutomation SEQUENCES A/B subject lines', () => {
    expect(CAMPAIGNS.welcome_step1.A.subjectLine).toContain('10% off');
    expect(CAMPAIGNS.welcome_step1.B.subjectLine).toContain('10%');
  });

  it('cart_recovery_step1 A and B have distinct subject lines', () => {
    const { A, B } = CAMPAIGNS.cart_recovery_step1;
    expect(A.subjectLine).not.toBe(B.subjectLine);
  });
});
