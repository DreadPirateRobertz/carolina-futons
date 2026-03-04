import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  applyForAffiliate,
  getMyAffiliateAccount,
  createAffiliateLink,
  getMyAffiliateLinks,
  trackAffiliateClick,
  recordAffiliateConversion,
  getMyCommissions,
  getAffiliateDashboard,
  requestPayout,
  getMyPayouts,
  updatePaymentInfo,
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

// ── applyForAffiliate ────────────────────────────────────────────────

describe('applyForAffiliate', () => {
  it('creates an affiliate account for logged-in member', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'influencer@example.com', name: 'Jane' });
    let inserted = null;
    __onInsert((col, item) => {
      if (col === ACCOUNTS) inserted = item;
    });

    const result = await applyForAffiliate({
      bio: 'Home decor blogger',
      socialLinks: 'https://instagram.com/janedecor',
    });

    expect(result.success).toBe(true);
    expect(result.affiliateId).toBeTruthy();
    expect(inserted).not.toBeNull();
    expect(inserted.memberId).toBe('member-001');
    expect(inserted.email).toBe('influencer@example.com');
    expect(inserted.displayName).toBe('Jane');
    expect(inserted.tier).toBe('starter');
    expect(inserted.status).toBe('pending');
    expect(inserted.commissionRate).toBe(5);
    expect(inserted.totalEarned).toBe(0);
    expect(inserted.totalPaid).toBe(0);
  });

  it('fails when not logged in', async () => {
    const result = await applyForAffiliate({ bio: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('prevents duplicate applications', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'test@example.com', name: 'Jane' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
    }]);

    const result = await applyForAffiliate({ bio: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });

  it('allows reapplication after rejection', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'test@example.com', name: 'Jane' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'rejected',
    }]);

    const result = await applyForAffiliate({ bio: 'Updated bio' });
    expect(result.success).toBe(true);
  });

  it('sanitizes bio and social links', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'test@example.com', name: 'Jane' });
    let inserted = null;
    __onInsert((col, item) => {
      if (col === ACCOUNTS) inserted = item;
    });

    await applyForAffiliate({
      bio: '<script>alert(1)</script>Home blogger',
      socialLinks: '<img onerror=hack>instagram.com/jane',
    });

    expect(inserted.bio).not.toContain('<script>');
    expect(inserted.socialLinks).not.toContain('<img');
  });

  it('requires bio field', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'test@example.com', name: 'Jane' });

    const result = await applyForAffiliate({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('bio');
  });
});

// ── getMyAffiliateAccount ────────────────────────────────────────────

describe('getMyAffiliateAccount', () => {
  it('returns affiliate account for logged-in member', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      displayName: 'Jane',
      email: 'jane@example.com',
      tier: 'pro',
      status: 'active',
      commissionRate: 8,
      totalEarned: 500,
      totalPaid: 200,
      bio: 'Blogger',
      socialLinks: 'instagram.com/jane',
      paypalEmail: 'jane@paypal.com',
      _createdDate: new Date('2026-01-01'),
    }]);

    const result = await getMyAffiliateAccount();
    expect(result.success).toBe(true);
    expect(result.account.tier).toBe('pro');
    expect(result.account.commissionRate).toBe(8);
    expect(result.account.totalEarned).toBe(500);
    expect(result.account.totalPaid).toBe(200);
    expect(result.account.status).toBe('active');
  });

  it('fails when not logged in', async () => {
    const result = await getMyAffiliateAccount();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('returns not found for non-affiliate member', async () => {
    __setMember({ _id: 'member-001' });

    const result = await getMyAffiliateAccount();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── createAffiliateLink ─────────────────────────────────────────────

describe('createAffiliateLink', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      commissionRate: 5,
    }]);
  });

  it('creates an affiliate tracking link', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === LINKS) inserted = item;
    });

    const result = await createAffiliateLink('product-123');
    expect(result.success).toBe(true);
    expect(result.linkCode).toBeTruthy();
    expect(result.linkCode.length).toBe(10);
    expect(inserted).not.toBeNull();
    expect(inserted.affiliateId).toBe('aff-001');
    expect(inserted.memberId).toBe('member-001');
    expect(inserted.productId).toBe('product-123');
    expect(inserted.clicks).toBe(0);
    expect(inserted.conversions).toBe(0);
    expect(inserted.revenue).toBe(0);
  });

  it('creates a link with custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === LINKS) inserted = item;
    });

    const result = await createAffiliateLink('product-123', 'my-custom-link');
    expect(result.success).toBe(true);
    expect(inserted.customSlug).toBe('my-custom-link');
  });

  it('rejects duplicate custom slugs', async () => {
    __seed(LINKS, [{
      _id: 'link-001',
      affiliateId: 'aff-002',
      customSlug: 'taken-slug',
      linkCode: 'EXISTCODE01',
    }]);

    const result = await createAffiliateLink('product-123', 'taken-slug');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in use');
  });

  it('fails for inactive affiliate', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'suspended',
    }]);

    const result = await createAffiliateLink('product-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await createAffiliateLink('product-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('sanitizes custom slug', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === LINKS) inserted = item;
    });

    await createAffiliateLink('product-123', '<script>alert</script>my-link');
    expect(inserted.customSlug).not.toContain('<script>');
  });

  it('requires product ID', async () => {
    const result = await createAffiliateLink('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID');
  });

  it('creates general store link without product ID', async () => {
    const result = await createAffiliateLink('_store');
    expect(result.success).toBe(true);
    expect(result.linkCode).toBeTruthy();
  });
});

// ── getMyAffiliateLinks ─────────────────────────────────────────────

describe('getMyAffiliateLinks', () => {
  it('returns all links for logged-in affiliate', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(LINKS, [
      { _id: 'link-1', affiliateId: 'aff-001', memberId: 'member-001', productId: 'p1', linkCode: 'CODE000001', clicks: 50, conversions: 5, revenue: 250, _createdDate: new Date() },
      { _id: 'link-2', affiliateId: 'aff-001', memberId: 'member-001', productId: 'p2', linkCode: 'CODE000002', clicks: 10, conversions: 1, revenue: 80, _createdDate: new Date() },
    ]);

    const result = await getMyAffiliateLinks();
    expect(result.success).toBe(true);
    expect(result.links).toHaveLength(2);
    expect(result.links[0].clicks).toBe(50);
    expect(result.links[0].conversions).toBe(5);
  });

  it('does not return other affiliates links', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(LINKS, [
      { _id: 'link-999', affiliateId: 'aff-999', memberId: 'member-999', linkCode: 'OTHER00001', _createdDate: new Date() },
    ]);

    const result = await getMyAffiliateLinks();
    expect(result.links).toHaveLength(0);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMyAffiliateLinks();
    expect(result.success).toBe(false);
  });
});

// ── trackAffiliateClick ─────────────────────────────────────────────

describe('trackAffiliateClick', () => {
  it('increments click count for valid link code', async () => {
    __seed(LINKS, [{
      _id: 'link-001',
      linkCode: 'CODE000001',
      clicks: 10,
      conversions: 0,
      revenue: 0,
    }]);

    let updated = null;
    __onUpdate((col, item) => {
      if (col === LINKS) updated = item;
    });

    const result = await trackAffiliateClick('CODE000001');
    expect(result.success).toBe(true);
    expect(updated.clicks).toBe(11);
  });

  it('returns affiliate info for landing page', async () => {
    __seed(LINKS, [{
      _id: 'link-001',
      linkCode: 'CODE000001',
      productId: 'product-123',
      clicks: 10,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      displayName: 'Jane',
      status: 'active',
    }]);

    const result = await trackAffiliateClick('CODE000001');
    expect(result.success).toBe(true);
    expect(result.productId).toBe('product-123');
  });

  it('fails for invalid link code', async () => {
    const result = await trackAffiliateClick('INVALID001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for empty code', async () => {
    const result = await trackAffiliateClick('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('sanitizes link code input', async () => {
    const result = await trackAffiliateClick('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });
});

// ── recordAffiliateConversion ───────────────────────────────────────

describe('recordAffiliateConversion', () => {
  beforeEach(() => {
    __seed(LINKS, [{
      _id: 'link-001',
      affiliateId: 'aff-001',
      memberId: 'member-001',
      linkCode: 'CODE000001',
      clicks: 50,
      conversions: 5,
      revenue: 2500,
    }]);
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      commissionRate: 8,
      totalEarned: 200,
      totalPaid: 0,
    }]);
  });

  it('records a conversion and creates commission', async () => {
    const inserts = [];
    __onInsert((col, item) => {
      if (col === COMMISSIONS) inserts.push(item);
    });

    const result = await recordAffiliateConversion('CODE000001', 'ORD-500', 500);
    expect(result.success).toBe(true);
    expect(result.commissionAmount).toBe(40); // 8% of 500

    const commission = inserts[0];
    expect(commission.affiliateId).toBe('aff-001');
    expect(commission.orderId).toBe('ORD-500');
    expect(commission.orderTotal).toBe(500);
    expect(commission.commissionRate).toBe(8);
    expect(commission.commissionAmount).toBe(40);
    expect(commission.status).toBe('pending');
  });

  it('updates link conversions and revenue', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === LINKS) updated = item;
    });

    await recordAffiliateConversion('CODE000001', 'ORD-500', 500);
    expect(updated.conversions).toBe(6);
    expect(updated.revenue).toBe(3000);
  });

  it('updates affiliate totalEarned', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === ACCOUNTS) updated = item;
    });

    await recordAffiliateConversion('CODE000001', 'ORD-500', 500);
    expect(updated.totalEarned).toBe(240); // 200 + 40
  });

  it('prevents duplicate conversions for same order', async () => {
    __seed(COMMISSIONS, [{
      _id: 'comm-001',
      affiliateId: 'aff-001',
      orderId: 'ORD-500',
      status: 'pending',
    }]);

    const result = await recordAffiliateConversion('CODE000001', 'ORD-500', 500);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already recorded');
  });

  it('fails for invalid link code', async () => {
    const result = await recordAffiliateConversion('INVALID001', 'ORD-500', 500);
    expect(result.success).toBe(false);
  });

  it('fails for zero or negative order total', async () => {
    const result = await recordAffiliateConversion('CODE000001', 'ORD-500', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('order total');
  });

  it('fails for missing parameters', async () => {
    const result = await recordAffiliateConversion('', '', 0);
    expect(result.success).toBe(false);
  });

  it('handles suspended affiliate gracefully', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'suspended',
      commissionRate: 8,
      totalEarned: 200,
    }]);

    const result = await recordAffiliateConversion('CODE000001', 'ORD-500', 500);
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });
});

// ── getMyCommissions ────────────────────────────────────────────────

describe('getMyCommissions', () => {
  it('returns commissions for logged-in affiliate', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(COMMISSIONS, [
      { _id: 'c1', affiliateId: 'aff-001', memberId: 'member-001', orderId: 'ORD-1', orderTotal: 500, commissionRate: 8, commissionAmount: 40, status: 'pending', _createdDate: new Date() },
      { _id: 'c2', affiliateId: 'aff-001', memberId: 'member-001', orderId: 'ORD-2', orderTotal: 300, commissionRate: 8, commissionAmount: 24, status: 'approved', _createdDate: new Date() },
    ]);

    const result = await getMyCommissions();
    expect(result.success).toBe(true);
    expect(result.commissions).toHaveLength(2);
    expect(result.commissions[0].orderId).toBeTruthy();
    expect(result.commissions[0].commissionAmount).toBeGreaterThan(0);
  });

  it('does not return other affiliates commissions', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(COMMISSIONS, [
      { _id: 'c999', affiliateId: 'aff-999', memberId: 'member-999', _createdDate: new Date() },
    ]);

    const result = await getMyCommissions();
    expect(result.commissions).toHaveLength(0);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMyCommissions();
    expect(result.success).toBe(false);
  });
});

// ── getAffiliateDashboard ───────────────────────────────────────────

describe('getAffiliateDashboard', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      tier: 'pro',
      commissionRate: 8,
      totalEarned: 640,
      totalPaid: 200,
      _createdDate: new Date('2026-01-01'),
    }]);
    __seed(LINKS, [
      { _id: 'l1', affiliateId: 'aff-001', memberId: 'member-001', clicks: 100, conversions: 10, revenue: 5000, _createdDate: new Date() },
      { _id: 'l2', affiliateId: 'aff-001', memberId: 'member-001', clicks: 50, conversions: 5, revenue: 3000, _createdDate: new Date() },
    ]);
    __seed(COMMISSIONS, [
      { _id: 'c1', affiliateId: 'aff-001', memberId: 'member-001', commissionAmount: 400, status: 'approved', _createdDate: new Date() },
      { _id: 'c2', affiliateId: 'aff-001', memberId: 'member-001', commissionAmount: 240, status: 'pending', _createdDate: new Date() },
    ]);
  });

  it('returns comprehensive dashboard stats', async () => {
    const result = await getAffiliateDashboard();
    expect(result.success).toBe(true);
    expect(result.dashboard.tier).toBe('pro');
    expect(result.dashboard.commissionRate).toBe(8);
    expect(result.dashboard.totalEarned).toBe(640);
    expect(result.dashboard.totalPaid).toBe(200);
    expect(result.dashboard.availableBalance).toBe(440); // 640 - 200
    expect(result.dashboard.totalClicks).toBe(150);
    expect(result.dashboard.totalConversions).toBe(15);
    expect(result.dashboard.totalRevenue).toBe(8000);
    expect(result.dashboard.conversionRate).toBeCloseTo(10, 0); // 15/150 * 100
    expect(result.dashboard.pendingCommissions).toBe(240);
    expect(result.dashboard.approvedCommissions).toBe(400);
  });

  it('handles zero clicks for conversion rate', async () => {
    __seed(LINKS, []);

    const result = await getAffiliateDashboard();
    expect(result.success).toBe(true);
    expect(result.dashboard.conversionRate).toBe(0);
    expect(result.dashboard.totalClicks).toBe(0);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getAffiliateDashboard();
    expect(result.success).toBe(false);
  });

  it('fails for non-affiliate member', async () => {
    __seed(ACCOUNTS, []);
    const result = await getAffiliateDashboard();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── requestPayout ───────────────────────────────────────────────────

describe('requestPayout', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      totalEarned: 500,
      totalPaid: 100,
      paypalEmail: 'jane@paypal.com',
    }]);
    __seed(COMMISSIONS, [
      { _id: 'c1', affiliateId: 'aff-001', memberId: 'member-001', commissionAmount: 400, status: 'approved' },
    ]);
  });

  it('creates a payout request', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === PAYOUTS) inserted = item;
    });

    const result = await requestPayout(200);
    expect(result.success).toBe(true);
    expect(result.payoutId).toBeTruthy();
    expect(inserted.amount).toBe(200);
    expect(inserted.affiliateId).toBe('aff-001');
    expect(inserted.memberId).toBe('member-001');
    expect(inserted.status).toBe('requested');
    expect(inserted.paymentMethod).toBe('paypal');
    expect(inserted.paymentEmail).toBe('jane@paypal.com');
  });

  it('fails when requesting more than available balance', async () => {
    const result = await requestPayout(500); // Only 400 available (500 - 100)
    expect(result.success).toBe(false);
    expect(result.error).toContain('balance');
  });

  it('fails for zero or negative amount', async () => {
    const result = await requestPayout(0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('amount');

    const result2 = await requestPayout(-50);
    expect(result2.success).toBe(false);
  });

  it('enforces minimum payout of $25', async () => {
    const result = await requestPayout(10);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Minimum');
  });

  it('fails when no payment info configured', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      totalEarned: 500,
      totalPaid: 100,
      paypalEmail: '',
    }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('payment');
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await requestPayout(100);
    expect(result.success).toBe(false);
  });

  it('fails for suspended affiliate', async () => {
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'suspended',
      totalEarned: 500,
      totalPaid: 100,
      paypalEmail: 'jane@paypal.com',
    }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });

  it('prevents concurrent payout requests', async () => {
    __seed(PAYOUTS, [{
      _id: 'pay-001',
      affiliateId: 'aff-001',
      memberId: 'member-001',
      status: 'requested',
      amount: 100,
    }]);

    const result = await requestPayout(100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('pending');
  });
});

// ── getMyPayouts ────────────────────────────────────────────────────

describe('getMyPayouts', () => {
  it('returns payout history for logged-in affiliate', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(PAYOUTS, [
      { _id: 'pay-1', affiliateId: 'aff-001', memberId: 'member-001', amount: 200, status: 'paid', processedDate: new Date('2026-02-01'), _createdDate: new Date('2026-01-25') },
      { _id: 'pay-2', affiliateId: 'aff-001', memberId: 'member-001', amount: 100, status: 'requested', _createdDate: new Date('2026-02-15') },
    ]);

    const result = await getMyPayouts();
    expect(result.success).toBe(true);
    expect(result.payouts).toHaveLength(2);
    expect(result.payouts[0].amount).toBeGreaterThan(0);
    expect(result.payouts[0].status).toBeTruthy();
  });

  it('does not return other affiliates payouts', async () => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{ _id: 'aff-001', memberId: 'member-001', status: 'active' }]);
    __seed(PAYOUTS, [
      { _id: 'pay-999', affiliateId: 'aff-999', memberId: 'member-999', amount: 500, status: 'paid', _createdDate: new Date() },
    ]);

    const result = await getMyPayouts();
    expect(result.payouts).toHaveLength(0);
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMyPayouts();
    expect(result.success).toBe(false);
  });
});

// ── updatePaymentInfo ───────────────────────────────────────────────

describe('updatePaymentInfo', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-001' });
    __seed(ACCOUNTS, [{
      _id: 'aff-001',
      memberId: 'member-001',
      status: 'active',
      paypalEmail: '',
    }]);
  });

  it('updates PayPal email', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === ACCOUNTS) updated = item;
    });

    const result = await updatePaymentInfo({ paypalEmail: 'jane@paypal.com' });
    expect(result.success).toBe(true);
    expect(updated.paypalEmail).toBe('jane@paypal.com');
  });

  it('validates email format', async () => {
    const result = await updatePaymentInfo({ paypalEmail: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('sanitizes email input', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === ACCOUNTS) updated = item;
    });

    await updatePaymentInfo({ paypalEmail: '  Jane@PayPal.com  ' });
    expect(updated.paypalEmail).toBe('jane@paypal.com');
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await updatePaymentInfo({ paypalEmail: 'test@test.com' });
    expect(result.success).toBe(false);
  });

  it('fails for non-affiliate member', async () => {
    __seed(ACCOUNTS, []);
    const result = await updatePaymentInfo({ paypalEmail: 'test@test.com' });
    expect(result.success).toBe(false);
  });

  it('rejects XSS in email field', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === ACCOUNTS) updated = item;
    });

    const result = await updatePaymentInfo({ paypalEmail: '<script>x</script>@evil.com' });
    // Either fails validation or sanitizes
    if (result.success && updated) {
      expect(updated.paypalEmail).not.toContain('<script>');
    }
  });
});
