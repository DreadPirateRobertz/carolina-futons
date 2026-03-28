/**
 * @file referralEmail.test.js
 * @description CF-6p0o: Tests for Day 14 referral email in post-purchase sequence.
 *
 * Covers:
 *  - _getReferralLinkForMember generates/retrieves referral codes
 *  - triggerPostPurchaseSequence includes referral variables at step 5
 *  - Template registry has post_purchase_referral entry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── _getReferralLinkForMember ───────────────────────────────────────

describe('_getReferralLinkForMember', () => {
  let _getReferralLinkForMember;

  beforeEach(async () => {
    ({ _getReferralLinkForMember } = await import('../src/backend/referralService.web.js'));
  });

  it('returns existing referral code for member with pending referral', async () => {
    __seed('Referrals', [{
      _id: 'ref-1',
      referrerMemberId: 'member-1',
      referralCode: 'ABC123',
      status: 'pending',
      _createdDate: new Date(),
    }]);

    const result = await _getReferralLinkForMember('member-1');
    expect(result).not.toBeNull();
    expect(result.referralCode).toBe('ABC123');
    expect(result.referralUrl).toContain('ABC123');
    expect(result.referralUrl).toContain('carolinafutons.com');
  });

  it('generates new referral code for member without existing referral', async () => {
    const result = await _getReferralLinkForMember('new-member');
    expect(result).not.toBeNull();
    expect(result.referralCode).toBeTruthy();
    expect(result.referralCode.length).toBeGreaterThan(0);
    expect(result.referralUrl).toContain(result.referralCode);

    // Verify it was inserted into Referrals collection
    const inserted = __getInserted('Referrals');
    expect(inserted.length).toBeGreaterThanOrEqual(1);
    const referral = inserted.find(r => r.referrerMemberId === 'new-member');
    expect(referral).toBeDefined();
    expect(referral.status).toBe('pending');
  });

  it('returns null for empty memberId', async () => {
    const result = await _getReferralLinkForMember('');
    expect(result).toBeNull();
  });

  it('returns null for null memberId', async () => {
    const result = await _getReferralLinkForMember(null);
    expect(result).toBeNull();
  });
});

// ── Template Registry ───────────────────────────────────────────────

describe('post_purchase_referral template', () => {
  it('exists in TEMPLATE_REGISTRY with correct fields', async () => {
    const { _TEMPLATE_REGISTRY } = await import('../src/backend/emailTemplates.web.js');
    const template = _TEMPLATE_REGISTRY.post_purchase_referral;

    expect(template).toBeDefined();
    expect(template.id).toBe('post_purchase_referral');
    expect(template.sequence).toBe('post_purchase');
    expect(template.step).toBe(5);
    expect(template.subjectLine).toContain('Share the love');
    expect(template.variables).toContain('referralUrl');
    expect(template.variables).toContain('referralCode');
    expect(template.variables).toContain('firstName');
    expect(template.variables).toContain('email');
  });
});

// ── Post-Purchase Sequence Integration ──────────────────────────────

describe('post-purchase sequence includes referral step', () => {
  it('SEQUENCES.post_purchase has step 5 (referral) at 360 hours (Day 15)', async () => {
    const { triggerPostPurchaseSequence } = await import('../src/backend/emailAutomation.web.js');

    const result = await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Jane', 'ORD-5678', 549,
      [{ name: 'Monterey Frame', quantity: 1, price: 549 }],
      { memberId: 'member-1' },
    );

    expect(result.success).toBe(true);
    expect(result.queued).toBeGreaterThanOrEqual(5); // At least 5 steps including referral

    // Check that referral template was queued
    const queued = __getInserted('EmailQueue');
    const referralEmail = queued.find(e => e.templateId === 'post_purchase_referral');
    expect(referralEmail).toBeDefined();
    expect(referralEmail.sequenceStep).toBe(5);
    expect(referralEmail.sequenceType).toBe('post_purchase');
  });

  it('queued referral email has referralUrl and referralCode variables', async () => {
    const { triggerPostPurchaseSequence } = await import('../src/backend/emailAutomation.web.js');

    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@test.com', 'Jane', 'ORD-5678', 549,
      [{ name: 'Monterey Frame', quantity: 1, price: 549 }],
      { memberId: 'member-1' },
    );

    const queued = __getInserted('EmailQueue');
    const referralEmail = queued.find(e => e.templateId === 'post_purchase_referral');
    expect(referralEmail).toBeDefined();
    expect(referralEmail.variables.referralUrl).toBeTruthy();
    expect(referralEmail.variables.referralCode).toBeTruthy();
  });

  it('uses sentinel defaults for guest checkouts (no memberId)', async () => {
    const { triggerPostPurchaseSequence } = await import('../src/backend/emailAutomation.web.js');

    await triggerPostPurchaseSequence(
      'contact-guest', 'guest@test.com', 'Guest', 'ORD-GUEST', 299,
      [{ name: 'Budget Frame', quantity: 1, price: 299 }],
    );

    const queued = __getInserted('EmailQueue');
    const referralEmail = queued.find(e => e.templateId === 'post_purchase_referral');
    expect(referralEmail).toBeDefined();
    expect(referralEmail.variables.referralUrl).toBe('https://www.carolinafutons.com/referral');
    expect(referralEmail.variables.referralCode).toBe('');
  });
});
