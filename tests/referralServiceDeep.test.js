import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      for (const cb of _updateCbs) cb(collection, item);
      return item;
    },
  },
}));

let _mockMember = { _id: 'member-abc', loginEmail: 'user@example.com', name: 'Test User' };
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => {
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _mockMember = { _id: 'member-abc', loginEmail: 'user@example.com', name: 'Test User' };
});

// ── Import under test ───────────────────────────────────────────────
const mod = await import('../src/backend/referralService.web.js');
const {
  getReferralLink,
  redeemReferralCode,
  completeReferral,
  getMyReferrals,
  getMyCredits,
  applyCredit,
  getReferralStats,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// getReferralLink
// ═════════════════════════════════════════════════════════════════════
describe('getReferralLink', () => {
  it('generates a new referral code', async () => {
    __seed('Referrals', []);
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBeTruthy();
    expect(result.referralCode.length).toBe(8);
    expect(result.alreadyExists).toBe(false);
  });

  it('returns existing pending code if member already has one', async () => {
    __seed('Referrals', [
      { referrerMemberId: 'member-abc', referralCode: 'ABCD1234', status: 'pending', _createdDate: new Date() },
    ]);
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBe('ABCD1234');
    expect(result.alreadyExists).toBe(true);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getReferralLink();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('creates referral record with correct credit amounts', async () => {
    __seed('Referrals', []);
    await getReferralLink();
    const record = _collections.Referrals[0];
    expect(record.referrerCredit).toBe(50);
    expect(record.refereeCredit).toBe(25);
    expect(record.status).toBe('pending');
    expect(record.referrerMemberId).toBe('member-abc');
  });

  it('stores referrer email and name', async () => {
    __seed('Referrals', []);
    await getReferralLink();
    const record = _collections.Referrals[0];
    expect(record.referrerEmail).toBe('user@example.com');
    expect(record.referrerName).toBe('Test User');
  });

  it('handles member with no email/name', async () => {
    _mockMember = { _id: 'member-abc' };
    __seed('Referrals', []);
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    const record = _collections.Referrals[0];
    expect(record.referrerEmail).toBe('');
    expect(record.referrerName).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// redeemReferralCode
// ═════════════════════════════════════════════════════════════════════
describe('redeemReferralCode', () => {
  it('redeems a valid referral code', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'pending', referrerName: 'Jane', referrerEmail: 'jane@example.com', referrerMemberId: 'other' },
    ]);
    const result = await redeemReferralCode('ABCD1234', { name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
    expect(result.refereeDiscount).toBe(25);
    expect(result.referrerName).toBe('Jane');
    const updated = _collections.Referrals.find(r => r._id === 'r1');
    expect(updated.status).toBe('signed_up');
    expect(updated.refereeEmail).toBe('bob@example.com');
  });

  it('rejects empty code', async () => {
    const result = await redeemReferralCode('', { email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejects null code', async () => {
    const result = await redeemReferralCode(null, { email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', async () => {
    const result = await redeemReferralCode('ABCD1234', { name: 'Bob' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects invalid email', async () => {
    const result = await redeemReferralCode('ABCD1234', { email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects non-existent code', async () => {
    __seed('Referrals', []);
    const result = await redeemReferralCode('ZZZZZZZZ', { email: 'a@b.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or expired');
  });

  it('prevents self-referral', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'SELFREF', status: 'pending', referrerEmail: 'user@example.com', referrerMemberId: 'member-abc' },
    ]);
    const result = await redeemReferralCode('SELFREF', { email: 'user@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own referral');
  });

  it('uppercases code for matching', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'pending', referrerName: 'X', referrerEmail: 'other@e.com', referrerMemberId: 'other' },
    ]);
    const result = await redeemReferralCode('abcd1234', { email: 'a@b.com' });
    expect(result.success).toBe(true);
  });

  it('strips non-alphanumeric chars from code', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'pending', referrerName: 'X', referrerEmail: 'other@e.com', referrerMemberId: 'other' },
    ]);
    const result = await redeemReferralCode('ABCD-1234!', { email: 'a@b.com' });
    expect(result.success).toBe(true);
  });

  it('lowercases email for matching', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'pending', referrerEmail: 'Owner@Example.com', referrerMemberId: 'other' },
    ]);
    // Self-referral check uses lowercase comparison
    const result = await redeemReferralCode('ABCD1234', { email: 'owner@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own referral');
  });
});

// ═════════════════════════════════════════════════════════════════════
// completeReferral
// ═════════════════════════════════════════════════════════════════════
describe('completeReferral', () => {
  it('completes a signed-up referral and issues credits', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'signed_up', referrerMemberId: 'referrer-1', refereeEmail: 'user@example.com', orderNumber: '' },
    ]);
    __seed('ReferralCredits', []);
    const result = await completeReferral('ABCD1234', 'ORD-001');
    expect(result.success).toBe(true);
    expect(result.referrerCredit).toBe(50);
    expect(result.refereeCredit).toBe(25);
    // Should create 2 credits
    expect(_collections.ReferralCredits).toHaveLength(2);
  });

  it('issues referrer_bonus and referee_bonus credits', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'signed_up', referrerMemberId: 'referrer-1', refereeEmail: 'user@example.com' },
    ]);
    __seed('ReferralCredits', []);
    await completeReferral('ABCD1234', 'ORD-001');
    const referrerCredit = _collections.ReferralCredits.find(c => c.source === 'referrer_bonus');
    const refereeCredit = _collections.ReferralCredits.find(c => c.source === 'referee_bonus');
    expect(referrerCredit.amount).toBe(50);
    expect(referrerCredit.memberId).toBe('referrer-1');
    expect(refereeCredit.amount).toBe(25);
    expect(refereeCredit.memberId).toBe('member-abc');
  });

  it('requires both code and order number', async () => {
    expect((await completeReferral('', 'ORD-001')).success).toBe(false);
    expect((await completeReferral('CODE', '')).success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await completeReferral('CODE', 'ORD-001');
    expect(result.success).toBe(false);
  });

  it('fails for non-existent referral', async () => {
    __seed('Referrals', []);
    const result = await completeReferral('ZZZZZZZZ', 'ORD-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('skips duplicate credit issuance (idempotent)', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'signed_up', referrerMemberId: 'referrer-1', refereeEmail: 'user@example.com' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'c1', referralId: 'r1', source: 'referrer_bonus', memberId: 'referrer-1', amount: 50 },
    ]);
    await completeReferral('ABCD1234', 'ORD-001');
    // Should not create duplicate referrer credit, but should add referee
    const referrerCredits = _collections.ReferralCredits.filter(c => c.source === 'referrer_bonus');
    expect(referrerCredits).toHaveLength(1);
  });

  it('sets credit expiry 90 days from now', async () => {
    __seed('Referrals', [
      { _id: 'r1', referralCode: 'ABCD1234', status: 'signed_up', referrerMemberId: 'referrer-1', refereeEmail: 'user@example.com' },
    ]);
    __seed('ReferralCredits', []);
    const before = Date.now();
    await completeReferral('ABCD1234', 'ORD-001');
    const credit = _collections.ReferralCredits[0];
    const expected = before + 90 * 24 * 60 * 60 * 1000;
    expect(credit.expiresAt.getTime()).toBeGreaterThanOrEqual(expected - 2000);
    expect(credit.expiresAt.getTime()).toBeLessThanOrEqual(expected + 2000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMyReferrals
// ═════════════════════════════════════════════════════════════════════
describe('getMyReferrals', () => {
  it('returns referrals for current member', async () => {
    __seed('Referrals', [
      { referrerMemberId: 'member-abc', referralCode: 'CODE1', refereeName: 'Bob', refereeEmail: 'bob@e.com', status: 'pending', referrerCredit: 50, orderNumber: '', _createdDate: new Date() },
      { referrerMemberId: 'other', referralCode: 'CODE2', status: 'pending', _createdDate: new Date() },
    ]);
    const result = await getMyReferrals();
    expect(result.success).toBe(true);
    expect(result.referrals).toHaveLength(1);
    expect(result.referrals[0].code).toBe('CODE1');
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getMyReferrals();
    expect(result.success).toBe(false);
  });

  it('returns empty list with no referrals', async () => {
    __seed('Referrals', []);
    const result = await getMyReferrals();
    expect(result.success).toBe(true);
    expect(result.referrals).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMyCredits
// ═════════════════════════════════════════════════════════════════════
describe('getMyCredits', () => {
  it('returns available credits for current member', async () => {
    __seed('ReferralCredits', [
      { memberId: 'member-abc', amount: 50, source: 'referrer_bonus', status: 'available', expiresAt: new Date('2026-06-01'), _createdDate: new Date() },
      { memberId: 'member-abc', amount: 25, source: 'referee_bonus', status: 'applied', expiresAt: new Date('2026-06-01'), _createdDate: new Date() },
    ]);
    const result = await getMyCredits();
    expect(result.success).toBe(true);
    expect(result.totalAvailable).toBe(50);
    expect(result.credits).toHaveLength(1);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getMyCredits();
    expect(result.success).toBe(false);
  });

  it('returns 0 with no credits', async () => {
    __seed('ReferralCredits', []);
    const result = await getMyCredits();
    expect(result.success).toBe(true);
    expect(result.totalAvailable).toBe(0);
    expect(result.credits).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// applyCredit
// ═════════════════════════════════════════════════════════════════════
describe('applyCredit', () => {
  it('applies an available credit', async () => {
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-abc', amount: 50, status: 'available', expiresAt: new Date('2027-01-01') },
    ]);
    const result = await applyCredit('c1');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
    const updated = _collections.ReferralCredits.find(c => c._id === 'c1');
    expect(updated.status).toBe('applied');
  });

  it('rejects empty creditId', async () => {
    const result = await applyCredit('');
    expect(result.success).toBe(false);
  });

  it('rejects non-existent credit', async () => {
    __seed('ReferralCredits', []);
    const result = await applyCredit('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects credit belonging to another member', async () => {
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'other-member', amount: 50, status: 'available' },
    ]);
    const result = await applyCredit('c1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('belong to you');
  });

  it('rejects already-applied credit', async () => {
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-abc', amount: 50, status: 'applied' },
    ]);
    const result = await applyCredit('c1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('rejects expired credit and marks it expired', async () => {
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-abc', amount: 50, status: 'available', expiresAt: new Date('2020-01-01') },
    ]);
    const result = await applyCredit('c1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
    const updated = _collections.ReferralCredits.find(c => c._id === 'c1');
    expect(updated.status).toBe('expired');
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await applyCredit('c1');
    expect(result.success).toBe(false);
  });

  it('applies credit with no expiresAt (no expiry)', async () => {
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-abc', amount: 25, status: 'available', expiresAt: null },
    ]);
    const result = await applyCredit('c1');
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getReferralStats
// ═════════════════════════════════════════════════════════════════════
describe('getReferralStats', () => {
  it('returns correct stats breakdown', async () => {
    __seed('Referrals', [
      { referrerMemberId: 'member-abc', status: 'pending' },
      { referrerMemberId: 'member-abc', status: 'signed_up' },
      { referrerMemberId: 'member-abc', status: 'credited' },
      { referrerMemberId: 'member-abc', status: 'purchased' },
    ]);
    __seed('ReferralCredits', [
      { memberId: 'member-abc', amount: 50, status: 'available' },
      { memberId: 'member-abc', amount: 25, status: 'applied' },
    ]);
    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(4);
    expect(result.stats.pendingReferrals).toBe(1);
    expect(result.stats.signedUpReferrals).toBe(1);
    expect(result.stats.completedReferrals).toBe(2); // purchased + credited
    expect(result.stats.totalEarned).toBe(75);
    expect(result.stats.totalAvailable).toBe(50);
    expect(result.stats.totalApplied).toBe(25);
  });

  it('returns zeros with no data', async () => {
    __seed('Referrals', []);
    __seed('ReferralCredits', []);
    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(0);
    expect(result.stats.totalEarned).toBe(0);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getReferralStats();
    expect(result.success).toBe(false);
  });

  it('only counts own referrals', async () => {
    __seed('Referrals', [
      { referrerMemberId: 'member-abc', status: 'pending' },
      { referrerMemberId: 'other', status: 'pending' },
    ]);
    __seed('ReferralCredits', []);
    const result = await getReferralStats();
    expect(result.stats.totalReferrals).toBe(1);
  });
});
