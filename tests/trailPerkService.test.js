/**
 * Tests for trailPerkService.web.js — CF-mcyh.2
 * Perk delivery for Blue Ridge Trail completions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
} from './__mocks__/wix-data.js';
import {
  deliverTrailPerk,
  _VALID_PERK_IDS,
  _PERK_EMAIL_TEMPLATES,
  _TRAIL_PERKS_COLLECTION,
} from '../src/backend/trailPerkService.web.js';

beforeEach(() => {
  __reset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('deliverTrailPerk — input validation', () => {
  it('returns error for missing memberId', async () => {
    const r = await deliverTrailPerk(null, 'perk-free-shipping', 'test@example.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/memberId/i);
  });

  it('returns error for unknown perkId', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-unknown', 'test@example.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unknown perkid/i);
  });

  it('returns error for missing recipientEmail', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', null);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/recipientEmail/i);
  });
});

// ── perk-free-shipping ────────────────────────────────────────────────────────

describe('deliverTrailPerk — perk-free-shipping', () => {
  it('inserts a MemberTrailPerks record', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    expect(r.success).toBe(true);
    const inserted = __getInserted(_TRAIL_PERKS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].perkId).toBe('perk-free-shipping');
    expect(inserted[0].memberId).toBe('mem-1');
  });

  it('generates a TRAIL- coupon code', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    expect(r.couponCode).toMatch(/^TRAIL-/);
  });

  it('uses computed _id for idempotency', async () => {
    await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    const inserted = __getInserted(_TRAIL_PERKS_COLLECTION);
    expect(inserted[0]._id).toBe('mem-1_perk-free-shipping');
  });

  it('queues trail_perk_free_shipping email', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('trail_perk_free_shipping');
    expect(emails[0].recipientEmail).toBe('a@b.com');
    expect(emails[0].variables.couponCode).toBe(r.couponCode);
  });

  it('returns alreadyDelivered:false on first delivery', async () => {
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    expect(r.alreadyDelivered).toBe(false);
  });

  it('returns alreadyDelivered:true when perk already exists', async () => {
    __seed(_TRAIL_PERKS_COLLECTION, [{
      _id: 'mem-1_perk-free-shipping',
      memberId: 'mem-1',
      perkId: 'perk-free-shipping',
      couponCode: 'TRAIL-EXISTING',
    }]);
    const before = __getInserted(_TRAIL_PERKS_COLLECTION).length;
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    expect(r.success).toBe(true);
    expect(r.alreadyDelivered).toBe(true);
    expect(r.couponCode).toBe('TRAIL-EXISTING');
    // Should not insert another record or email
    expect(__getInserted(_TRAIL_PERKS_COLLECTION)).toHaveLength(before);
    expect(__getInserted('EmailQueue')).toHaveLength(0);
  });
});

// ── perk-early-access ─────────────────────────────────────────────────────────

describe('deliverTrailPerk — perk-early-access', () => {
  it('succeeds without generating a coupon code', async () => {
    const r = await deliverTrailPerk('mem-2', 'perk-early-access', 'b@b.com');
    expect(r.success).toBe(true);
    expect(r.couponCode).toBeNull();
  });

  it('queues trail_perk_early_access email', async () => {
    await deliverTrailPerk('mem-2', 'perk-early-access', 'b@b.com');
    const emails = __getInserted('EmailQueue');
    expect(emails[0].templateId).toBe('trail_perk_early_access');
  });
});

// ── perk-styling-call ─────────────────────────────────────────────────────────

describe('deliverTrailPerk — perk-styling-call', () => {
  it('queues trail_perk_styling_call email', async () => {
    await deliverTrailPerk('mem-3', 'perk-styling-call', 'c@c.com');
    const emails = __getInserted('EmailQueue');
    expect(emails[0].templateId).toBe('trail_perk_styling_call');
  });
});

// ── Email failure is non-fatal ────────────────────────────────────────────────

describe('deliverTrailPerk — email queue failure is non-fatal', () => {
  it('still returns success when EmailQueue insert throws', async () => {
    __setInsertError('EmailQueue', new Error('email queue unavailable'));
    const r = await deliverTrailPerk('mem-1', 'perk-free-shipping', 'a@b.com');
    // Perk record was saved; email failure is best-effort
    expect(r.success).toBe(true);
  });
});
