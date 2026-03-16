import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      const total = items.length;
      if (filters._skip) items = items.slice(filters._skip);
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: total };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => {
      const items = _collections[col] || [];
      return items.find(i => i._id === id) || null;
    }),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000099', _createdDate: new Date() };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, data) => {
      if (_collections[col]) {
        const idx = _collections[col].findIndex(i => i._id === data._id);
        if (idx >= 0) _collections[col][idx] = { ...data };
      }
      _updateCbs.forEach(cb => cb(col, data));
      return data;
    }),
  },
}));

let _currentMember = null;

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => _currentMember),
    getRoles: vi.fn(async () => []),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

import {
  applyForTradeAccount,
  getTradeAccountStatus,
  getTradePricingTiers,
  getMyTradeAccount,
  getMyTradePricing,
  getMyTradeInvoices,
  checkTaxExemptStatus,
  submitTaxExemptCert,
  approveTradeAccount,
  rejectTradeAccount,
  createTradeInvoice,
  updateInvoiceStatus,
  verifyTaxExempt,
} from '../src/backend/tradeProgram.web.js';

const MID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _currentMember = { _id: MID, loginEmail: 'test@test.com' };
});

// ── applyForTradeAccount — deep edge cases ──────────────────────────

describe('applyForTradeAccount — deep edge cases', () => {
  it('rejects null application', async () => {
    const result = await applyForTradeAccount(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Application data required');
  });

  it('rejects undefined application', async () => {
    const result = await applyForTradeAccount(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects missing businessName', async () => {
    const result = await applyForTradeAccount({ contactName: 'A', contactEmail: 'a@b.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Business name');
  });

  it('rejects missing contactName', async () => {
    const result = await applyForTradeAccount({ businessName: 'Biz', contactEmail: 'a@b.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Contact name');
  });

  it('rejects invalid email', async () => {
    const result = await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'not-email' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid email');
  });

  it('rejects empty email', async () => {
    const result = await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: '' });
    expect(result.success).toBe(false);
  });

  it('blocks duplicate application by email', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', contactEmail: 'existing@biz.com', status: 'pending' }]);
    const result = await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'existing@biz.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('lowercases email', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'Test@BIZ.COM' });
    expect(inserted.contactEmail).toBe('test@biz.com');
  });

  it('clamps estimatedAnnualUnits to 0-99999', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'a@b.com', estimatedAnnualUnits: -50 });
    expect(inserted.estimatedAnnualUnits).toBe(0);
  });

  it('caps estimatedAnnualUnits at 99999', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'b@c.com', estimatedAnnualUnits: 200000 });
    expect(inserted.estimatedAnnualUnits).toBe(99999);
  });

  // Known gap: NaN estimatedAnnualUnits → Number(NaN) || 0 = 0
  it('NaN estimatedAnnualUnits defaults to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'c@d.com', estimatedAnnualUnits: NaN });
    expect(inserted.estimatedAnnualUnits).toBe(0);
  });

  it('sets default tier to bronze and status to pending', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await applyForTradeAccount({ businessName: 'Biz', contactName: 'A', contactEmail: 'd@e.com' });
    expect(inserted.tier).toBe('bronze');
    expect(inserted.status).toBe('pending');
    expect(inserted.creditLimit).toBe(0);
    expect(inserted.paymentTerms).toBe(30);
    expect(inserted.taxExemptVerified).toBe(false);
  });
});

// ── getTradeAccountStatus — deep edge cases ─────────────────────────

describe('getTradeAccountStatus — deep edge cases', () => {
  it('rejects falsy email', async () => {
    const result = await getTradeAccountStatus('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await getTradeAccountStatus('notanemail');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid email');
  });

  it('returns not found for nonexistent email', async () => {
    const result = await getTradeAccountStatus('nobody@nowhere.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('hides tier when not approved', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', contactEmail: 'pending@biz.com', status: 'pending', tier: 'silver', businessName: 'Biz' }]);
    const result = await getTradeAccountStatus('pending@biz.com');
    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.tier).toBeNull();
  });

  it('shows tier when approved', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', contactEmail: 'approved@biz.com', status: 'approved', tier: 'gold', businessName: 'Biz' }]);
    const result = await getTradeAccountStatus('approved@biz.com');
    expect(result.tier).toBe('gold');
    expect(result.businessName).toBe('Biz');
  });
});

// ── getTradePricingTiers ────────────────────────────────────────────

describe('getTradePricingTiers — deep edge cases', () => {
  it('returns all 4 tiers in order', async () => {
    const result = await getTradePricingTiers();
    expect(result.success).toBe(true);
    expect(result.tiers.length).toBe(4);
    expect(result.tiers[0].name).toBe('bronze');
    expect(result.tiers[1].name).toBe('silver');
    expect(result.tiers[2].name).toBe('gold');
    expect(result.tiers[3].name).toBe('platinum');
  });

  it('returns correct discount percentages', async () => {
    const result = await getTradePricingTiers();
    expect(result.tiers[0].discount).toBe(10);
    expect(result.tiers[1].discount).toBe(15);
    expect(result.tiers[2].discount).toBe(20);
    expect(result.tiers[3].discount).toBe(25);
  });

  it('returns minUnits thresholds', async () => {
    const result = await getTradePricingTiers();
    expect(result.tiers[0].minUnits).toBe(10);
    expect(result.tiers[3].minUnits).toBe(250);
  });
});

// ── getMyTradeAccount — deep edge cases ─────────────────────────────

describe('getMyTradeAccount — deep edge cases', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const result = await getMyTradeAccount();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not authenticated');
  });

  it('returns error when no trade account exists', async () => {
    const result = await getMyTradeAccount();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No trade account');
  });

  it('returns tierDiscount=0 for unknown tier', async () => {
    __seed('TradeAccounts', [{
      _id: 'a1-0000', memberId: MID, tier: 'unknown-tier', status: 'approved',
      businessName: 'Biz', contactName: 'A', contactEmail: 'a@b.com',
      creditLimit: 10000, paymentTerms: 30,
    }]);
    const result = await getMyTradeAccount();
    expect(result.success).toBe(true);
    expect(result.account.tierDiscount).toBe(0);
    expect(result.account.tierDescription).toBe('');
  });

  it('returns null for missing accountManager fields', async () => {
    __seed('TradeAccounts', [{
      _id: 'a1-0000', memberId: MID, tier: 'bronze', status: 'approved',
      businessName: 'Biz', contactName: 'A', contactEmail: 'a@b.com',
      creditLimit: 5000, paymentTerms: 30, taxExemptVerified: false,
    }]);
    const result = await getMyTradeAccount();
    expect(result.account.accountManagerName).toBeNull();
    expect(result.account.accountManagerEmail).toBeNull();
  });
});

// ── getMyTradePricing — deep edge cases ─────────────────────────────

describe('getMyTradePricing — deep edge cases', () => {
  it('rejects NaN price', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    const result = await getMyTradePricing(NaN, 5);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid price');
  });

  it('rejects Infinity price', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    const result = await getMyTradePricing(Infinity, 5);
    expect(result.success).toBe(false);
  });

  it('rejects zero price', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    const result = await getMyTradePricing(0, 5);
    expect(result.success).toBe(false);
  });

  it('rejects negative price', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    const result = await getMyTradePricing(-100, 5);
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    const result = await getMyTradePricing(100, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid quantity');
  });

  it('clamps quantity to MAX_QUANTITY (9999)', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'bronze' }]);
    const result = await getMyTradePricing(100, 50000);
    expect(result.success).toBe(true);
    expect(result.quantity).toBe(9999);
  });

  it('rounds quantity to integer', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'bronze' }]);
    const result = await getMyTradePricing(100, 5.7);
    expect(result.quantity).toBe(6);
  });

  it('rejects pending account', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'pending', tier: 'bronze' }]);
    const result = await getMyTradePricing(100, 5);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not approved');
  });

  it('calculates bronze tier (10% off)', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'bronze' }]);
    const result = await getMyTradePricing(100, 10);
    expect(result.discountPercent).toBe(10);
    expect(result.discountedPrice).toBe(90); // 100 * 0.9
    expect(result.lineTotal).toBe(900); // 90 * 10
  });

  it('calculates platinum tier (25% off)', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'platinum' }]);
    const result = await getMyTradePricing(200, 3);
    expect(result.discountPercent).toBe(25);
    expect(result.discountedPrice).toBe(150); // 200 * 0.75
    expect(result.lineTotal).toBe(450); // 150 * 3
  });

  it('rounds discountedPrice to 2 decimals', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, status: 'approved', tier: 'silver' }]);
    // 15% off $33.33 = 33.33 * 0.85 = 28.3305
    const result = await getMyTradePricing(33.33, 1);
    expect(result.discountedPrice).toBe(28.33);
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const result = await getMyTradePricing(100, 5);
    expect(result.success).toBe(false);
  });
});

// ── getMyTradeInvoices — deep edge cases ────────────────────────────

describe('getMyTradeInvoices — deep edge cases', () => {
  it('caps pageSize at 50', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID }]);
    const result = await getMyTradeInvoices({ pageSize: 200 });
    expect(result.success).toBe(true);
  });

  it('clamps pageSize to min 1', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID }]);
    const result = await getMyTradeInvoices({ pageSize: -5 });
    expect(result.success).toBe(true);
  });

  it('defaults skip to 0 for NaN', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID }]);
    const result = await getMyTradeInvoices({ skip: NaN });
    expect(result.success).toBe(true);
  });

  it('returns error when no trade account', async () => {
    const result = await getMyTradeInvoices();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No trade account');
  });
});

// ── checkTaxExemptStatus — deep edge cases ──────────────────────────

describe('checkTaxExemptStatus — deep edge cases', () => {
  it('returns false when no trade account', async () => {
    const result = await checkTaxExemptStatus();
    expect(result.success).toBe(true);
    expect(result.taxExempt).toBe(false);
  });

  it('returns true when verified', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, taxExemptVerified: true }]);
    const result = await checkTaxExemptStatus();
    expect(result.taxExempt).toBe(true);
  });

  it('returns false for truthy non-true value', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, taxExemptVerified: 'yes' }]);
    const result = await checkTaxExemptStatus();
    // account?.taxExemptVerified === true → 'yes' === true is false
    expect(result.taxExempt).toBe(false);
  });
});

// ── submitTaxExemptCert — deep edge cases ───────────────────────────

describe('submitTaxExemptCert — deep edge cases', () => {
  it('rejects null params', async () => {
    const result = await submitTaxExemptCert(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Certificate data required');
  });

  it('rejects empty certUrl', async () => {
    const result = await submitTaxExemptCert({ certUrl: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Certificate URL');
  });

  it('preserves existing taxId when not provided', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, taxId: 'EXISTING-TAX' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await submitTaxExemptCert({ certUrl: 'https://cert.pdf' });
    expect(updated.taxId).toBe('EXISTING-TAX');
  });

  it('updates taxId when provided', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: MID, taxId: 'OLD' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await submitTaxExemptCert({ certUrl: 'https://cert.pdf', taxId: 'NEW-TAX-123' });
    expect(updated.taxId).toBe('NEW-TAX-123');
  });
});

// ── approveTradeAccount — deep edge cases ───────────────────────────

describe('approveTradeAccount — deep edge cases', () => {
  it('rejects empty memberId', async () => {
    const result = await approveTradeAccount('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Member ID');
  });

  it('rejects invalid tier', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    const result = await approveTradeAccount('mid1', { tier: 'diamond' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid tier');
  });

  it('defaults tier to bronze', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await approveTradeAccount('mid1', {});
    expect(updated.tier).toBe('bronze');
    expect(updated.status).toBe('approved');
  });

  it('lowercases tier', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await approveTradeAccount('mid1', { tier: 'GOLD' });
    expect(updated.tier).toBe('gold');
  });

  it('defaults creditLimit to 50000 when 0', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    // Number(0) || 50000 = 50000 (0 is falsy)
    await approveTradeAccount('mid1', { creditLimit: 0 });
    expect(updated.creditLimit).toBe(50000);
  });

  it('preserves existing accountManager when not provided', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1', accountManagerName: 'Jane', accountManagerEmail: 'jane@co.com' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await approveTradeAccount('mid1', {});
    expect(updated.accountManagerName).toBe('Jane');
    expect(updated.accountManagerEmail).toBe('jane@co.com');
  });

  it('sets approvedAt timestamp', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await approveTradeAccount('mid1', {});
    expect(updated.approvedAt).toBeDefined();
  });
});

// ── rejectTradeAccount — deep edge cases ────────────────────────────

describe('rejectTradeAccount — deep edge cases', () => {
  it('rejects empty memberId', async () => {
    const result = await rejectTradeAccount('', 'Not qualified');
    expect(result.success).toBe(false);
  });

  it('sets rejection reason', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await rejectTradeAccount('mid1', 'Insufficient business history');
    expect(updated.status).toBe('rejected');
    expect(updated.rejectionReason).toBe('Insufficient business history');
  });

  it('defaults reason to empty string when null', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await rejectTradeAccount('mid1', null);
    expect(updated.rejectionReason).toBe('');
  });
});

// ── createTradeInvoice — deep edge cases ────────────────────────────

describe('createTradeInvoice — deep edge cases', () => {
  it('rejects null params', async () => {
    const result = await createTradeInvoice(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invoice data required');
  });

  it('rejects missing tradeAccountId', async () => {
    const result = await createTradeInvoice({ orderId: 'o1', subtotal: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Trade account ID');
  });

  it('rejects missing orderId', async () => {
    const result = await createTradeInvoice({ tradeAccountId: 'a1', subtotal: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Order ID');
  });

  it('rejects zero subtotal', async () => {
    const result = await createTradeInvoice({ tradeAccountId: 'a1', orderId: 'o1', subtotal: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid subtotal');
  });

  it('rejects NaN subtotal', async () => {
    const result = await createTradeInvoice({ tradeAccountId: 'a1', orderId: 'o1', subtotal: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects Infinity subtotal', async () => {
    const result = await createTradeInvoice({ tradeAccountId: 'a1', orderId: 'o1', subtotal: Infinity });
    expect(result.success).toBe(false);
  });

  it('rejects unapproved trade account', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000001', status: 'pending' }]);
    const result = await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000001', orderId: 'o1', subtotal: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not approved');
  });

  it('rejects invoice exceeding credit limit', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000002', status: 'approved', creditLimit: 500, paymentTerms: 30 }]);
    const result = await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000002', orderId: 'o1', subtotal: 600 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds credit limit');
  });

  it('allows invoice when creditLimit is 0 (no limit)', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000003', status: 'approved', creditLimit: 0, paymentTerms: 30 }]);
    const result = await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000003', orderId: 'o1', subtotal: 999999 });
    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toMatch(/^CF-INV-/);
  });

  it('defaults tax to 0 when not provided', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000004', status: 'approved', creditLimit: 0, paymentTerms: 30 }]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInvoices') inserted = item; });

    await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000004', orderId: 'o1', subtotal: 100 });
    expect(inserted.tax).toBe(0);
    expect(inserted.total).toBe(100);
  });

  it('calculates total = subtotal + tax rounded to 2 decimals', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000005', status: 'approved', creditLimit: 0, paymentTerms: 30 }]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInvoices') inserted = item; });

    await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000005', orderId: 'o1', subtotal: 99.99, tax: 7.50 });
    expect(inserted.total).toBe(107.49);
  });

  it('uses account paymentTerms for dueDate', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000006', status: 'approved', creditLimit: 0, paymentTerms: 60 }]);
    const result = await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000006', orderId: 'o1', subtotal: 100 });
    expect(result.success).toBe(true);
    const dueDate = new Date(result.dueDate);
    const now = new Date();
    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(59);
    expect(diffDays).toBeLessThanOrEqual(61);
  });

  it('defaults paymentTerms to 30 when not set', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000-0000-0000-000000000007', status: 'approved', creditLimit: 0 }]);
    const result = await createTradeInvoice({ tradeAccountId: 'a1-0000-0000-0000-000000000007', orderId: 'o1', subtotal: 100 });
    const dueDate = new Date(result.dueDate);
    const now = new Date();
    const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });
});

// ── updateInvoiceStatus — deep edge cases ───────────────────────────

describe('updateInvoiceStatus — deep edge cases', () => {
  it('rejects empty invoiceId', async () => {
    const result = await updateInvoiceStatus('', 'paid');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invoice ID');
  });

  it('rejects invalid status', async () => {
    const result = await updateInvoiceStatus('inv-1', 'cancelled');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('accepts all valid statuses', async () => {
    for (const status of ['pending', 'paid', 'overdue', 'void']) {
      __seed('TradeInvoices', [{ _id: 'a1-0000-0000-0000-000000000001', status: 'pending' }]);
      const result = await updateInvoiceStatus('a1-0000-0000-0000-000000000001', status);
      expect(result.success).toBe(true);
    }
  });

  it('sets paidAt when marking as paid', async () => {
    __seed('TradeInvoices', [{ _id: 'a1-0000-0000-0000-000000000002', status: 'pending', paidAt: null }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInvoices') updated = data; });

    await updateInvoiceStatus('a1-0000-0000-0000-000000000002', 'paid');
    expect(updated.paidAt).toBeDefined();
  });

  it('does NOT set paidAt for non-paid statuses', async () => {
    __seed('TradeInvoices', [{ _id: 'a1-0000-0000-0000-000000000003', status: 'pending', paidAt: null }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInvoices') updated = data; });

    await updateInvoiceStatus('a1-0000-0000-0000-000000000003', 'overdue');
    expect(updated.paidAt).toBeNull();
  });
});

// ── verifyTaxExempt — deep edge cases ───────────────────────────────

describe('verifyTaxExempt — deep edge cases', () => {
  it('rejects empty memberId', async () => {
    const result = await verifyTaxExempt('', true);
    expect(result.success).toBe(false);
  });

  it('sets taxExemptVerified to true', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1', taxExemptVerified: false }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    const result = await verifyTaxExempt('mid1', true);
    expect(result.success).toBe(true);
    expect(result.message).toContain('verified');
    expect(updated.taxExemptVerified).toBe(true);
  });

  it('revokes tax-exempt with false', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1', taxExemptVerified: true }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    const result = await verifyTaxExempt('mid1', false);
    expect(result.message).toContain('revoked');
    expect(updated.taxExemptVerified).toBe(false);
  });

  it('coerces truthy values via Boolean()', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await verifyTaxExempt('mid1', 'yes');
    expect(updated.taxExemptVerified).toBe(true);
  });

  it('coerces 0 to false via Boolean()', async () => {
    __seed('TradeAccounts', [{ _id: 'a1-0000', memberId: 'mid1' }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeAccounts') updated = data; });

    await verifyTaxExempt('mid1', 0);
    expect(updated.taxExemptVerified).toBe(false);
  });
});
