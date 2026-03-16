/**
 * Deep coverage tests for affiliateProgram.web.js — edge cases in commission
 * calculation, tier progression, payout thresholds, input validation, and
 * default value behavior not covered by the baseline test file.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  applyForAffiliate,
  getMyAffiliateAccount,
  createAffiliateLink,
  trackAffiliateClick,
  recordAffiliateConversion,
  getAffiliateDashboard,
  requestPayout,
  getMyPayouts,
  updatePaymentInfo,
  getMyAffiliateLinks,
  getMyCommissions,
} from '../src/backend/affiliateProgram.web.js';

const ACCOUNTS = 'AffiliateAccounts';
const LINKS = 'AffiliateLinks';
const COMMISSIONS = 'AffiliateCommissions';
const PAYOUTS = 'AffiliatePayouts';

beforeEach(() => {
  __seed(ACCOUNTS, []);
  __seed(LINKS, []);
  __seed(COMMISSIONS, []);
  __seed(PAYOUTS, []);
  __setMember(null);
});

// ── applyForAffiliate — deep edge cases ──────────────────────────────

describe('applyForAffiliate — deep edge cases', () => {
  it('uses firstName when name is missing', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'test@test.com', firstName: 'Alice' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'A blogger' });
    expect(inserted.displayName).toBe('Alice');
  });

  it('falls back to empty string when both name and firstName are missing', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'test@test.com' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'A blogger' });
    expect(inserted.displayName).toBe('');
  });

  it('falls back to empty string when loginEmail is missing', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', name: 'Bob' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'A blogger' });
    expect(inserted.email).toBe('');
  });

  it('rejects bio of only whitespace', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'x@x.com' });
    const result = await applyForAffiliate({ bio: '   ' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bio');
  });

  it('rejects null bio', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'x@x.com' });
    const result = await applyForAffiliate({ bio: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bio');
  });

  it('rejects undefined applicationData', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'x@x.com' });
    const result = await applyForAffiliate(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('bio');
  });

  it('blocks reapplication when status is pending', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'x@x.com', name: 'Re' });
    __seed(ACCOUNTS, [{
      _id: 'aff-pend',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'pending',
    }]);

    const result = await applyForAffiliate({ bio: 'Try again' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });

  it('blocks reapplication when status is suspended', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'x@x.com', name: 'Re' });
    __seed(ACCOUNTS, [{
      _id: 'aff-susp',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'suspended',
    }]);

    const result = await applyForAffiliate({ bio: 'Try again' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });

  it('updates fields on reapplication after rejection', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'new@x.com', name: 'NewName' });
    __seed(ACCOUNTS, [{
      _id: 'aff-rej',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'rejected',
      bio: 'Old bio',
      displayName: 'OldName',
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === ACCOUNTS) updated = item; });

    const result = await applyForAffiliate({ bio: 'New bio', socialLinks: 'https://x.com/me' });
    expect(result.success).toBe(true);
    expect(result.affiliateId).toBe('aff-rej');
    expect(updated.status).toBe('pending');
    expect(updated.displayName).toBe('NewName');
    expect(updated.bio).toContain('New bio');
  });

  it('sets initial commissionRate to 5 (starter tier)', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'a@b.com', name: 'A' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'test bio' });
    expect(inserted.commissionRate).toBe(5);
    expect(inserted.tier).toBe('starter');
  });

  it('initializes paypalEmail as empty string', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'a@b.com', name: 'A' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'test bio' });
    expect(inserted.paypalEmail).toBe('');
  });

  it('handles member with _id but no other fields', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    const result = await applyForAffiliate({ bio: 'minimal member' });
    expect(result.success).toBe(true);
    expect(inserted.displayName).toBe('');
    expect(inserted.email).toBe('');
  });
});

// ── getMyAffiliateAccount — deep edge cases ──────────────────────────

describe('getMyAffiliateAccount — deep edge cases', () => {
  it('computes availableBalance correctly when totalEarned/totalPaid are null', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-null',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      displayName: 'Test',
      email: 'a@b.com',
      tier: 'starter',
      status: 'active',
      commissionRate: 5,
      totalEarned: null,
      totalPaid: null,
      bio: 'bio',
      paypalEmail: '',
    }]);

    const result = await getMyAffiliateAccount();
    expect(result.success).toBe(true);
    expect(result.account.availableBalance).toBe(0);
  });

  it('computes availableBalance correctly when totalPaid is undefined', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-undef',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      displayName: 'Test',
      email: 'a@b.com',
      tier: 'starter',
      status: 'active',
      commissionRate: 5,
      totalEarned: 100,
      // totalPaid intentionally omitted
      bio: 'bio',
      paypalEmail: '',
    }]);

    const result = await getMyAffiliateAccount();
    expect(result.success).toBe(true);
    expect(result.account.availableBalance).toBe(100);
  });

  it('returns all expected fields in account object', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-full',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      displayName: 'Jane',
      email: 'jane@example.com',
      tier: 'elite',
      status: 'active',
      commissionRate: 12,
      totalEarned: 5000,
      totalPaid: 3000,
      bio: 'Top affiliate',
      socialLinks: 'https://ig.com/jane',
      paypalEmail: 'jane@paypal.com',
      _createdDate: new Date('2026-01-01'),
    }]);

    const result = await getMyAffiliateAccount();
    const acct = result.account;
    expect(acct.id).toBe('aff-full');
    expect(acct.displayName).toBe('Jane');
    expect(acct.email).toBe('jane@example.com');
    expect(acct.tier).toBe('elite');
    expect(acct.status).toBe('active');
    expect(acct.commissionRate).toBe(12);
    expect(acct.totalEarned).toBe(5000);
    expect(acct.totalPaid).toBe(3000);
    expect(acct.availableBalance).toBe(2000);
    expect(acct.bio).toBe('Top affiliate');
    expect(acct.socialLinks).toBe('https://ig.com/jane');
    expect(acct.paypalEmail).toBe('jane@paypal.com');
    expect(acct.createdDate).toEqual(new Date('2026-01-01'));
  });
});

// ── createAffiliateLink — deep edge cases ────────────────────────────

describe('createAffiliateLink — deep edge cases', () => {
  beforeEach(() => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      commissionRate: 5,
    }]);
  });

  it('strips special characters from custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === LINKS) inserted = item; });

    await createAffiliateLink('prod-1', 'My Link @#$!');
    // only lowercase alphanumeric and dashes survive
    expect(inserted.customSlug).toMatch(/^[a-z0-9-]+$/);
    expect(inserted.customSlug).not.toContain('@');
    expect(inserted.customSlug).not.toContain('$');
  });

  it('lowercases custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === LINKS) inserted = item; });

    await createAffiliateLink('prod-1', 'MY-AWESOME-LINK');
    expect(inserted.customSlug).toBe('my-awesome-link');
  });

  it('allows empty/no custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === LINKS) inserted = item; });

    const result = await createAffiliateLink('prod-1', '');
    expect(result.success).toBe(true);
    expect(inserted.customSlug).toBe('');
  });

  it('allows undefined custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === LINKS) inserted = item; });

    const result = await createAffiliateLink('prod-1');
    expect(result.success).toBe(true);
    expect(inserted.customSlug).toBe('');
  });

  it('rejects null productId', async () => {
    const result = await createAffiliateLink(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID');
  });

  it('fails for pending affiliate account', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'pending',
    }]);

    const result = await createAffiliateLink('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });
});

// ── trackAffiliateClick — deep edge cases ────────────────────────────

describe('trackAffiliateClick — deep edge cases', () => {
  it('normalizes lowercase input to uppercase for matching', async () => {
    __seed(LINKS, [{
      _id: 'link-lc',
      linkCode: 'ABCDEF1234',
      productId: 'prod-1',
      clicks: 0,
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === LINKS) updated = item; });

    const result = await trackAffiliateClick('abcdef1234');
    expect(result.success).toBe(true);
    expect(updated.clicks).toBe(1);
  });

  it('strips non-alphanumeric characters from link code', async () => {
    __seed(LINKS, [{
      _id: 'link-strip',
      linkCode: 'ABCDEF1234',
      productId: 'prod-1',
      clicks: 5,
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === LINKS) updated = item; });

    const result = await trackAffiliateClick('ABC-DEF-1234');
    expect(result.success).toBe(true);
    expect(updated.clicks).toBe(6);
  });

  it('handles null link code', async () => {
    const result = await trackAffiliateClick(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined link code', async () => {
    const result = await trackAffiliateClick(undefined);
    expect(result.success).toBe(false);
  });

  it('initializes clicks from null to 1', async () => {
    __seed(LINKS, [{
      _id: 'link-noclicks',
      linkCode: 'NULLCLICK1',
      productId: 'prod-1',
      clicks: null,
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === LINKS) updated = item; });

    const result = await trackAffiliateClick('NULLCLICK1');
    expect(result.success).toBe(true);
    expect(updated.clicks).toBe(1);
  });
});

// ── recordAffiliateConversion — commission calculation edge cases ─────

describe('recordAffiliateConversion — commission calculation edge cases', () => {
  beforeEach(() => {
    __seed(LINKS, [{
      _id: 'link-001',
      affiliateId: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'CONVTEST01',
      clicks: 10,
      conversions: 0,
      revenue: 0,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 0,
      totalPaid: 0,
    }]);
  });

  it('rounds commission to two decimal places', async () => {
    // 5% of 33.33 = 1.6665 -> rounds to 1.67
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-ROUND', 33.33);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(1.67);
  });

  it('rounds commission for small fractional amounts', async () => {
    // 5% of 0.01 = 0.0005 -> rounds to 0
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-TINY', 0.01);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(0);
  });

  it('rejects NaN orderTotal', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-NAN', NaN);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order total');
  });

  it('rejects negative orderTotal', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-NEG', -100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order total');
  });

  it('rejects null orderTotal', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-NULL', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order total');
  });

  it('rejects undefined orderTotal', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-UNDEF', undefined);
    expect(result.success).toBe(false);
  });

  it('accepts Infinity orderTotal (Infinity > 0 passes guard)', async () => {
    // Known gap: Infinity passes typeof + > 0 check
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-INF', Infinity);
    expect(result.success).toBe(true);
  });

  it('rejects missing orderId with valid code and total', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', '', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('calculates commission at pro rate (8%)', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'pro',
      commissionRate: 8,
      totalEarned: 0,
      totalPaid: 0,
    }]);

    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-PRO', 250);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(20); // 8% of 250
  });

  it('calculates commission at elite rate (12%)', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'elite',
      commissionRate: 12,
      totalEarned: 0,
      totalPaid: 0,
    }]);

    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-ELITE', 1000);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(120); // 12% of 1000
  });

  it('accumulates conversions on link across multiple orders', async () => {
    const linkUpdates = [];
    __onUpdate((col, item) => { if (col === LINKS) linkUpdates.push({ ...item }); });

    await recordAffiliateConversion('CONVTEST01', 'ORD-A', 100);
    await recordAffiliateConversion('CONVTEST01', 'ORD-B', 200);

    // After second conversion
    const lastUpdate = linkUpdates[linkUpdates.length - 1];
    expect(lastUpdate.conversions).toBe(2);
    expect(lastUpdate.revenue).toBe(300);
  });

  it('initializes link conversions from null', async () => {
    __seed(LINKS, [{
      _id: 'link-001',
      affiliateId: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'CONVTEST01',
      clicks: 10,
      conversions: null,
      revenue: null,
    }]);

    let linkUpdate = null;
    __onUpdate((col, item) => { if (col === LINKS) linkUpdate = item; });

    await recordAffiliateConversion('CONVTEST01', 'ORD-INIT', 100);
    expect(linkUpdate.conversions).toBe(1);
    expect(linkUpdate.revenue).toBe(100);
  });

  it('initializes account totalEarned from null', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: null,
      totalPaid: 0,
    }]);

    const accountUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) accountUpdates.push({ ...item }); });

    await recordAffiliateConversion('CONVTEST01', 'ORD-NULLTE', 200);
    const firstAcctUpdate = accountUpdates[0];
    expect(firstAcctUpdate.totalEarned).toBe(10); // 5% of 200
  });
});

// ── Tier progression edge cases ──────────────────────────────────────

describe('recordAffiliateConversion — tier progression', () => {
  it('upgrades from starter to pro at revenue threshold ($500)', async () => {
    __seed(LINKS, [{
      _id: 'link-tier',
      affiliateId: 'aff-tier',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'TIERTEST01',
      clicks: 100,
      conversions: 10,
      revenue: 490,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-tier',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 24.5,
      totalPaid: 0,
    }]);

    const accountUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) accountUpdates.push({ ...item }); });

    // Revenue goes from 490 to 500 -> triggers pro upgrade
    await recordAffiliateConversion('TIERTEST01', 'ORD-TIER', 10);

    const lastUpdate = accountUpdates[accountUpdates.length - 1];
    expect(lastUpdate.tier).toBe('pro');
    expect(lastUpdate.commissionRate).toBe(8);
  });

  it('upgrades from starter to pro at conversion threshold (20)', async () => {
    __seed(LINKS, [{
      _id: 'link-conv',
      affiliateId: 'aff-conv',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'CONVTHRS01',
      clicks: 200,
      conversions: 19,
      revenue: 400,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-conv',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 20,
      totalPaid: 0,
    }]);

    const accountUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) accountUpdates.push({ ...item }); });

    // Conversions go from 19 to 20 -> triggers pro upgrade
    await recordAffiliateConversion('CONVTHRS01', 'ORD-CONV', 50);

    const lastUpdate = accountUpdates[accountUpdates.length - 1];
    expect(lastUpdate.tier).toBe('pro');
    expect(lastUpdate.commissionRate).toBe(8);
  });

  it('upgrades from pro to elite at revenue threshold ($2000)', async () => {
    __seed(LINKS, [{
      _id: 'link-elite',
      affiliateId: 'aff-elite',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'ELITEREV01',
      clicks: 500,
      conversions: 30,
      revenue: 1990,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-elite',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'pro',
      commissionRate: 8,
      totalEarned: 159.2,
      totalPaid: 0,
    }]);

    const accountUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) accountUpdates.push({ ...item }); });

    await recordAffiliateConversion('ELITEREV01', 'ORD-ELITE2', 20);

    const lastUpdate = accountUpdates[accountUpdates.length - 1];
    expect(lastUpdate.tier).toBe('elite');
    expect(lastUpdate.commissionRate).toBe(12);
  });

  it('does not downgrade tier when below threshold after upgrade', async () => {
    // Already at elite; single link has low revenue but conversions met elite threshold
    __seed(LINKS, [{
      _id: 'link-nodown',
      affiliateId: 'aff-nodown',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'NODOWN0001',
      clicks: 500,
      conversions: 50,
      revenue: 100,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-nodown',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'elite',
      commissionRate: 12,
      totalEarned: 12,
      totalPaid: 0,
    }]);

    const accountUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) accountUpdates.push({ ...item }); });

    await recordAffiliateConversion('NODOWN0001', 'ORD-NODOWN', 10);

    // Conversions reach 51, revenue=110 — still elite via conversion threshold
    const lastUpdate = accountUpdates[accountUpdates.length - 1];
    expect(lastUpdate.tier).toBe('elite');
  });
});

// ── requestPayout — deep edge cases ──────────────────────────────────

describe('requestPayout — deep edge cases', () => {
  beforeEach(() => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-pay',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      totalEarned: 500,
      totalPaid: 100,
      paypalEmail: 'pay@paypal.com',
    }]);
  });

  it('succeeds at exactly minimum payout ($25)', async () => {
    const result = await requestPayout(25);
    expect(result.success).toBe(true);
  });

  it('fails at $24.99 (below minimum)', async () => {
    const result = await requestPayout(24.99);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Minimum');
  });

  it('succeeds for exact available balance', async () => {
    // available = 500 - 100 = 400
    const result = await requestPayout(400);
    expect(result.success).toBe(true);
  });

  it('fails for $0.01 over available balance', async () => {
    const result = await requestPayout(400.01);
    expect(result.success).toBe(false);
    expect(result.error).toContain('balance');
  });

  it('rejects NaN amount', async () => {
    const result = await requestPayout(NaN);
    expect(result.success).toBe(false);
  });

  it('rejects Infinity amount', async () => {
    const result = await requestPayout(Infinity);
    expect(result.success).toBe(false);
  });

  it('rejects null amount', async () => {
    const result = await requestPayout(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined amount', async () => {
    const result = await requestPayout(undefined);
    expect(result.success).toBe(false);
  });

  it('handles null totalEarned and totalPaid in balance calc', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-pay',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      totalEarned: null,
      totalPaid: null,
      paypalEmail: 'pay@paypal.com',
    }]);

    // available = (null||0) - (null||0) = 0 -> 25 > 0 -> fails
    const result = await requestPayout(25);
    expect(result.success).toBe(false);
    expect(result.error).toContain('balance');
  });

  it('allows payout after a prior completed (paid) payout', async () => {
    __seed(PAYOUTS, [{
      _id: 'pay-done',
      affiliateId: 'aff-pay',
      status: 'paid',
      amount: 50,
    }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(true);
  });

  it('blocks payout when a prior payout has status requested', async () => {
    __seed(PAYOUTS, [{
      _id: 'pay-pending',
      affiliateId: 'aff-pay',
      status: 'requested',
      amount: 50,
    }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('pending');
  });
});

// ── getAffiliateDashboard — deep edge cases ──────────────────────────

describe('getAffiliateDashboard — deep edge cases', () => {
  it('handles null clicks/conversions/revenue on links', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-dash',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 0,
      totalPaid: 0,
    }]);
    __seed(LINKS, [
      { _id: 'l-null', affiliateId: 'aff-dash', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', clicks: null, conversions: null, revenue: null },
    ]);
    __seed(COMMISSIONS, []);

    const result = await getAffiliateDashboard();
    expect(result.success).toBe(true);
    expect(result.dashboard.totalClicks).toBe(0);
    expect(result.dashboard.totalConversions).toBe(0);
    expect(result.dashboard.totalRevenue).toBe(0);
    expect(result.dashboard.conversionRate).toBe(0);
  });

  it('handles null commissionAmount in pending commissions', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-dash2',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 0,
      totalPaid: 0,
    }]);
    __seed(LINKS, []);
    __seed(COMMISSIONS, [
      { _id: 'c-null', affiliateId: 'aff-dash2', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: null, status: 'pending', _createdDate: new Date() },
    ]);

    const result = await getAffiliateDashboard();
    expect(result.success).toBe(true);
    expect(result.dashboard.pendingCommissions).toBe(0);
  });

  it('correctly separates pending vs approved commissions', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-sep',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'pro',
      commissionRate: 8,
      totalEarned: 100,
      totalPaid: 0,
    }]);
    __seed(LINKS, []);
    __seed(COMMISSIONS, [
      { _id: 'c-pend', affiliateId: 'aff-sep', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 30, status: 'pending', _createdDate: new Date() },
      { _id: 'c-appr', affiliateId: 'aff-sep', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 50, status: 'approved', _createdDate: new Date() },
      { _id: 'c-paid', affiliateId: 'aff-sep', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 20, status: 'paid', _createdDate: new Date() },
    ]);

    const result = await getAffiliateDashboard();
    expect(result.dashboard.pendingCommissions).toBe(30);
    expect(result.dashboard.approvedCommissions).toBe(50);
    // 'paid' status not included in either pending or approved
  });

  it('returns linkCount correctly', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-lc',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'starter',
      commissionRate: 5,
      totalEarned: 0,
      totalPaid: 0,
    }]);
    __seed(LINKS, [
      { _id: 'l1', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', clicks: 1, conversions: 0, revenue: 0 },
      { _id: 'l2', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', clicks: 2, conversions: 1, revenue: 50 },
      { _id: 'l3', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', clicks: 0, conversions: 0, revenue: 0 },
    ]);
    __seed(COMMISSIONS, []);

    const result = await getAffiliateDashboard();
    expect(result.dashboard.linkCount).toBe(3);
  });
});

// ── updatePaymentInfo — deep edge cases ──────────────────────────────

describe('updatePaymentInfo — deep edge cases', () => {
  beforeEach(() => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-pi',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      paypalEmail: '',
    }]);
  });

  it('rejects empty string email', async () => {
    const result = await updatePaymentInfo({ paypalEmail: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects null paypalEmail', async () => {
    const result = await updatePaymentInfo({ paypalEmail: null });
    expect(result.success).toBe(false);
  });

  it('rejects undefined paymentInfo', async () => {
    const result = await updatePaymentInfo(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects empty object paymentInfo', async () => {
    const result = await updatePaymentInfo({});
    expect(result.success).toBe(false);
  });
});

// ── getMyAffiliateLinks — deep edge cases ────────────────────────────

describe('getMyAffiliateLinks — deep edge cases', () => {
  it('defaults null fields to 0 or empty string in mapping', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(LINKS, [{
      _id: 'link-nulls',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      productId: 'prod-1',
      linkCode: 'NULLFLD001',
      customSlug: null,
      clicks: null,
      conversions: null,
      revenue: null,
      _createdDate: new Date('2026-03-01'),
    }]);

    const result = await getMyAffiliateLinks();
    expect(result.success).toBe(true);
    const link = result.links[0];
    expect(link.customSlug).toBe('');
    expect(link.clicks).toBe(0);
    expect(link.conversions).toBe(0);
    expect(link.revenue).toBe(0);
  });
});

// ── getMyPayouts — deep edge cases ───────────────────────────────────

describe('getMyPayouts — deep edge cases', () => {
  it('returns null for processedDate when not set', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(PAYOUTS, [{
      _id: 'pay-noproc',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      amount: 50,
      status: 'requested',
      paymentMethod: 'paypal',
      _createdDate: new Date('2026-03-01'),
    }]);

    const result = await getMyPayouts();
    expect(result.success).toBe(true);
    expect(result.payouts[0].processedDate).toBeNull();
  });

  it('returns processedDate when set', async () => {
    const procDate = new Date('2026-03-10');
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(PAYOUTS, [{
      _id: 'pay-proc',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      amount: 100,
      status: 'paid',
      paymentMethod: 'paypal',
      processedDate: procDate,
      _createdDate: new Date('2026-03-01'),
    }]);

    const result = await getMyPayouts();
    expect(result.payouts[0].processedDate).toEqual(procDate);
  });
});
