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
  recordAffiliateConversion,
  getAffiliateDashboard,
  requestPayout,
  getMyPayouts,
  updatePaymentInfo,
  getMyAffiliateLinks,
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

  it('initializes paypalEmail as empty string', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'a@b.com', name: 'A' });
    let inserted = null;
    __onInsert((col, item) => { if (col === ACCOUNTS) inserted = item; });

    await applyForAffiliate({ bio: 'test bio' });
    expect(inserted.paypalEmail).toBe('');
  });
});

// ── getMyAffiliateAccount — deep edge cases ──────────────────────────

describe('getMyAffiliateAccount — deep edge cases', () => {
  it('computes availableBalance as 0 when totalEarned/totalPaid are null', async () => {
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

  it('computes availableBalance when totalPaid is undefined', async () => {
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
      bio: 'bio',
      paypalEmail: '',
    }]);

    const result = await getMyAffiliateAccount();
    expect(result.account.availableBalance).toBe(100);
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

  it('strips special characters and lowercases custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === LINKS) inserted = item; });

    await createAffiliateLink('prod-1', 'My Link @#$!');
    expect(inserted.customSlug).toMatch(/^[a-z0-9-]+$/);
  });

  it('sets empty slug when undefined is passed', async () => {
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

  it('rounds commission to two decimal places (5% of 33.33 = 1.67)', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-ROUND', 33.33);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(1.67);
  });

  it('rounds sub-penny commission to zero (5% of 0.01)', async () => {
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

  // Known gap: Infinity > 0 is true, passes guard
  it('accepts Infinity orderTotal (guard bypass)', async () => {
    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-INF', Infinity);
    expect(result.success).toBe(true);
  });

  it('calculates 8% commission at pro tier', async () => {
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
    expect(result.commissionAmount).toBe(20);
  });

  it('calculates 12% commission at elite tier', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      tier: 'elite',
      commissionRate: 12,
      totalEarned: 0,
      totalPaid: 0,
    }]);

    const result = await recordAffiliateConversion('CONVTEST01', 'ORD-ELI', 1000);
    expect(result.commissionAmount).toBe(120);
  });

  it('initializes link conversions and revenue from null', async () => {
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

    const acctUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) acctUpdates.push({ ...item }); });

    await recordAffiliateConversion('CONVTEST01', 'ORD-NULTE', 200);
    expect(acctUpdates[0].totalEarned).toBe(10); // 5% of 200
  });
});

// ── Tier progression edge cases ──────────────────────────────────────

describe('recordAffiliateConversion — tier progression', () => {
  it('upgrades starter -> pro at $500 revenue', async () => {
    __seed(LINKS, [{
      _id: 'lnk-t', affiliateId: 'aff-t', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'TIERTEST01', clicks: 100, conversions: 10, revenue: 490,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-t', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'starter', commissionRate: 5, totalEarned: 24.5, totalPaid: 0,
    }]);

    const acctUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) acctUpdates.push({ ...item }); });

    await recordAffiliateConversion('TIERTEST01', 'ORD-T1', 10);
    const last = acctUpdates[acctUpdates.length - 1];
    expect(last.tier).toBe('pro');
    expect(last.commissionRate).toBe(8);
  });

  it('upgrades starter -> pro at 20 conversions', async () => {
    __seed(LINKS, [{
      _id: 'lnk-c', affiliateId: 'aff-c', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'CONVTHRS01', clicks: 200, conversions: 19, revenue: 400,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-c', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'starter', commissionRate: 5, totalEarned: 20, totalPaid: 0,
    }]);

    const acctUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) acctUpdates.push({ ...item }); });

    await recordAffiliateConversion('CONVTHRS01', 'ORD-C1', 50);
    const last = acctUpdates[acctUpdates.length - 1];
    expect(last.tier).toBe('pro');
    expect(last.commissionRate).toBe(8);
  });

  it('upgrades pro -> elite at $2000 revenue', async () => {
    __seed(LINKS, [{
      _id: 'lnk-e', affiliateId: 'aff-e', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'ELITEREV01', clicks: 500, conversions: 30, revenue: 1990,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-e', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'pro', commissionRate: 8, totalEarned: 159.2, totalPaid: 0,
    }]);

    const acctUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) acctUpdates.push({ ...item }); });

    await recordAffiliateConversion('ELITEREV01', 'ORD-E1', 20);
    const last = acctUpdates[acctUpdates.length - 1];
    expect(last.tier).toBe('elite');
    expect(last.commissionRate).toBe(12);
  });

  it('stays elite when already at threshold via conversions', async () => {
    __seed(LINKS, [{
      _id: 'lnk-n', affiliateId: 'aff-n', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      linkCode: 'NODOWN0001', clicks: 500, conversions: 50, revenue: 100,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-n', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'elite', commissionRate: 12, totalEarned: 12, totalPaid: 0,
    }]);

    const acctUpdates = [];
    __onUpdate((col, item) => { if (col === ACCOUNTS) acctUpdates.push({ ...item }); });

    await recordAffiliateConversion('NODOWN0001', 'ORD-N1', 10);
    const last = acctUpdates[acctUpdates.length - 1];
    expect(last.tier).toBe('elite');
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

  it('succeeds at exactly $25 (minimum payout)', async () => {
    const result = await requestPayout(25);
    expect(result.success).toBe(true);
  });

  it('fails at $24.99 (below minimum)', async () => {
    const result = await requestPayout(24.99);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Minimum');
  });

  it('succeeds for exact available balance ($400)', async () => {
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

  it('treats null totalEarned/totalPaid as zero in balance calc', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-pay',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active',
      totalEarned: null,
      totalPaid: null,
      paypalEmail: 'pay@paypal.com',
    }]);

    const result = await requestPayout(25);
    expect(result.success).toBe(false);
    expect(result.error).toContain('balance');
  });

  it('allows payout after a completed (paid) payout exists', async () => {
    __seed(PAYOUTS, [{ _id: 'pay-done', affiliateId: 'aff-pay', status: 'paid', amount: 50 }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(true);
  });
});

// ── getAffiliateDashboard — deep edge cases ──────────────────────────

describe('getAffiliateDashboard — deep edge cases', () => {
  it('handles null clicks/conversions/revenue on links', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-d', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'starter', commissionRate: 5, totalEarned: 0, totalPaid: 0,
    }]);
    __seed(LINKS, [
      { _id: 'l-n', affiliateId: 'aff-d', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', clicks: null, conversions: null, revenue: null },
    ]);

    const result = await getAffiliateDashboard();
    expect(result.dashboard.totalClicks).toBe(0);
    expect(result.dashboard.totalConversions).toBe(0);
    expect(result.dashboard.totalRevenue).toBe(0);
    expect(result.dashboard.conversionRate).toBe(0);
  });

  it('handles null commissionAmount in pending commissions', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-d2', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'starter', commissionRate: 5, totalEarned: 0, totalPaid: 0,
    }]);
    __seed(COMMISSIONS, [
      { _id: 'c-n', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: null, status: 'pending', _createdDate: new Date() },
    ]);

    const result = await getAffiliateDashboard();
    expect(result.dashboard.pendingCommissions).toBe(0);
  });

  it('excludes paid commissions from pending and approved totals', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-s', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'active', tier: 'pro', commissionRate: 8, totalEarned: 100, totalPaid: 0,
    }]);
    __seed(COMMISSIONS, [
      { _id: 'c1', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 30, status: 'pending', _createdDate: new Date() },
      { _id: 'c2', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 50, status: 'approved', _createdDate: new Date() },
      { _id: 'c3', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', commissionAmount: 20, status: 'paid', _createdDate: new Date() },
    ]);

    const result = await getAffiliateDashboard();
    expect(result.dashboard.pendingCommissions).toBe(30);
    expect(result.dashboard.approvedCommissions).toBe(50);
  });
});

// ── updatePaymentInfo — deep edge cases ──────────────────────────────

describe('updatePaymentInfo — deep edge cases', () => {
  beforeEach(() => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(ACCOUNTS, [{
      _id: 'aff-pi', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', status: 'active', paypalEmail: '',
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
  it('defaults null fields to 0/empty in response mapping', async () => {
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(LINKS, [{
      _id: 'lnk-nf', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      productId: 'p1', linkCode: 'NULLFLD001',
      customSlug: null, clicks: null, conversions: null, revenue: null,
      _createdDate: new Date('2026-03-01'),
    }]);

    const result = await getMyAffiliateLinks();
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
      _id: 'pay-np', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      amount: 50, status: 'requested', paymentMethod: 'paypal', _createdDate: new Date(),
    }]);

    const result = await getMyPayouts();
    expect(result.payouts[0].processedDate).toBeNull();
  });

  it('returns processedDate when set', async () => {
    const procDate = new Date('2026-03-10');
    __setMember({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' });
    __seed(PAYOUTS, [{
      _id: 'pay-p', memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      amount: 100, status: 'paid', paymentMethod: 'paypal', processedDate: procDate, _createdDate: new Date(),
    }]);

    const result = await getMyPayouts();
    expect(result.payouts[0].processedDate).toEqual(procDate);
  });
});
