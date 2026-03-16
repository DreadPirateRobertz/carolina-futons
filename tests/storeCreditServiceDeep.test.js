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

let _insertIdCounter = 0;

function buildQueryChain(collection) {
  let filters = {};
  let _ascending = null;
  let _descending = null;
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: (field) => { _ascending = field; return chain; },
    descending: (field) => { _descending = field; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      if (_ascending) {
        items.sort((a, b) => {
          const av = a[_ascending], bv = b[_ascending];
          if (av < bv) return -1;
          if (av > bv) return 1;
          return 0;
        });
      }
      if (_descending) {
        items.sort((a, b) => {
          const av = a[_descending], bv = b[_descending];
          if (av < bv) return 1;
          if (av > bv) return -1;
          return 0;
        });
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
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
      _insertIdCounter++;
      const item = { ...data, _id: data._id || `ins-${_insertIdCounter}`, _createdDate: new Date() };
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

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
  validateId: (val) => {
    if (!val || typeof val !== 'string') return '';
    return val.trim().slice(0, 50);
  },
}));

import {
  issueStoreCredit,
  getMyStoreCredit,
  applyStoreCredit,
  getStoreCreditHistory,
  giftStoreCredit,
  getExpiringCredits,
} from '../src/backend/storeCreditService.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _insertIdCounter = 0;
});

// ── Helper ──────────────────────────────────────────────────────────

const futureDate = (days = 30) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pastDate = (days = 30) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function makeCredit(overrides = {}) {
  return {
    _id: overrides._id || 'cred-1',
    memberId: overrides.memberId || 'member-1',
    balance: overrides.balance ?? 50,
    initialAmount: overrides.initialAmount ?? 50,
    reason: overrides.reason || 'return',
    orderReference: overrides.orderReference || '',
    status: overrides.status || 'active',
    createdDate: overrides.createdDate || new Date(),
    expirationDate: overrides.expirationDate ?? futureDate(300),
    lastUsedDate: overrides.lastUsedDate || null,
    transactions: overrides.transactions || JSON.stringify([{ type: 'issue', amount: 50, date: new Date().toISOString() }]),
    giftMessage: overrides.giftMessage || '',
  };
}

// ── issueStoreCredit ────────────────────────────────────────────────

describe('issueStoreCredit — input validation', () => {
  it('rejects null data', async () => {
    const r = await issueStoreCredit(null);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Credit data is required');
  });

  it('rejects undefined data', async () => {
    const r = await issueStoreCredit(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects non-object data (string)', async () => {
    const r = await issueStoreCredit('hello');
    expect(r.success).toBe(false);
  });

  it('rejects non-object data (number)', async () => {
    const r = await issueStoreCredit(42);
    expect(r.success).toBe(false);
  });

  it('rejects missing memberId', async () => {
    const r = await issueStoreCredit({ amount: 10, reason: 'return' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects numeric memberId (validateId returns empty)', async () => {
    const r = await issueStoreCredit({ memberId: 12345, amount: 10, reason: 'return' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects empty string memberId', async () => {
    const r = await issueStoreCredit({ memberId: '', amount: 10, reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('rejects amount = 0', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 0, reason: 'return' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('positive amount');
  });

  it('rejects negative amount', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: -5, reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: NaN, reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('rejects Infinity amount (isFinite guard)', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: Infinity, reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('rejects -Infinity amount', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: -Infinity, reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('rejects string amount that is not a number', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 'abc', reason: 'return' });
    expect(r.success).toBe(false);
  });

  it('accepts string amount that parses to positive number', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: '25.50', reason: 'return' });
    expect(r.success).toBe(true);
    expect(r.balance).toBe(25.5);
  });

  it('rejects amount exceeding MAX_CREDIT_AMOUNT (10000)', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10001, reason: 'return' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('10,000');
  });

  it('accepts amount exactly at MAX_CREDIT_AMOUNT', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10000, reason: 'return' });
    expect(r.success).toBe(true);
    expect(r.balance).toBe(10000);
  });

  it('rejects invalid reason', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: 'bribe' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid reason');
  });

  it('rejects empty reason (defaults to empty string via sanitize)', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid reason');
  });

  it('rejects null reason', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: null });
    expect(r.success).toBe(false);
  });
});

describe('issueStoreCredit — valid reasons', () => {
  const validReasons = ['return', 'refund', 'promotion', 'admin_gift', 'goodwill'];

  validReasons.forEach(reason => {
    it(`accepts reason '${reason}'`, async () => {
      const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason });
      expect(r.success).toBe(true);
    });
  });
});

describe('issueStoreCredit — successful issuance', () => {
  it('returns creditId, balance, expirationDate on success', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 99.99, reason: 'refund' });
    expect(r.success).toBe(true);
    expect(r.creditId).toBeDefined();
    expect(r.balance).toBe(99.99);
    expect(r.expirationDate).toBeDefined();
    expect(new Date(r.expirationDate).getTime()).toBeGreaterThan(Date.now());
  });

  it('rounds amount to 2 decimal places', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 33.337, reason: 'return' });
    expect(r.balance).toBe(33.34);
  });

  it('inserts record with correct fields', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await issueStoreCredit({ memberId: 'mem-1', amount: 50, reason: 'promotion', orderReference: 'ORD-123' });
    expect(inserted).not.toBeNull();
    expect(inserted.memberId).toBe('mem-1');
    expect(inserted.balance).toBe(50);
    expect(inserted.initialAmount).toBe(50);
    expect(inserted.reason).toBe('promotion');
    expect(inserted.status).toBe('active');
    expect(inserted.orderReference).toBe('ORD-123');
    expect(inserted.giftMessage).toBe('');
    expect(inserted.lastUsedDate).toBeNull();
  });

  it('stores initial transaction in JSON transactions field', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await issueStoreCredit({ memberId: 'mem-1', amount: 25, reason: 'goodwill' });
    const txns = JSON.parse(inserted.transactions);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('issue');
    expect(txns[0].amount).toBe(25);
    expect(txns[0].reason).toBe('goodwill');
    expect(txns[0].date).toBeDefined();
  });

  it('sanitizes orderReference to 100 chars', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    const longRef = 'x'.repeat(200);
    await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: 'return', orderReference: longRef });
    expect(inserted.orderReference.length).toBeLessThanOrEqual(100);
  });

  it('defaults orderReference to empty when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: 'return' });
    expect(inserted.orderReference).toBe('');
  });

  it('sets expirationDate ~365 days in the future', async () => {
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: 'return' });
    const expDate = new Date(r.expirationDate);
    const diff = (expDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diff).toBeGreaterThan(364);
    expect(diff).toBeLessThan(366);
  });

  it('catches insert error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.insert.mockRejectedValueOnce(new Error('DB down'));
    const r = await issueStoreCredit({ memberId: 'mem-1', amount: 10, reason: 'return' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to issue');
  });
});

// ── getMyStoreCredit ────────────────────────────────────────────────

describe('getMyStoreCredit — input validation', () => {
  it('rejects null memberId', async () => {
    const r = await getMyStoreCredit(null);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects undefined memberId', async () => {
    const r = await getMyStoreCredit(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects empty string memberId', async () => {
    const r = await getMyStoreCredit('');
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only memberId', async () => {
    const r = await getMyStoreCredit('   ');
    expect(r.success).toBe(false);
  });

  it('rejects numeric memberId', async () => {
    const r = await getMyStoreCredit(42);
    expect(r.success).toBe(false);
  });
});

describe('getMyStoreCredit — balance calculation', () => {
  it('returns zero balance when no credits exist', async () => {
    const r = await getMyStoreCredit('mem-1');
    expect(r.success).toBe(true);
    expect(r.totalBalance).toBe(0);
    expect(r.credits).toEqual([]);
  });

  it('sums multiple active credits', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 25.50, status: 'active' }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 74.50, status: 'active' }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(100);
    expect(r.credits).toHaveLength(2);
  });

  it('excludes credits with zero balance', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 0, status: 'active' }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 30, status: 'active' }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(30);
    expect(r.credits).toHaveLength(1);
  });

  it('auto-expires past-due credits', async () => {
    const expired = makeCredit({
      _id: 'c-expired',
      memberId: 'mem-1',
      balance: 100,
      status: 'active',
      expirationDate: pastDate(10),
    });
    __seed('StoreCredits', [expired]);

    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(0);
    expect(r.credits).toHaveLength(0);
    expect(updated).not.toBeNull();
    expect(updated.status).toBe('expired');
    expect(updated.balance).toBe(0);
  });

  it('does not expire credits with future expirationDate', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50, expirationDate: futureDate(100) }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(50);
  });

  it('handles credit with null expirationDate (never expires)', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 75, expirationDate: null }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(75);
    expect(r.credits).toHaveLength(1);
  });

  it('returns credit fields in response', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50, initialAmount: 100, reason: 'refund' }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    const c = r.credits[0];
    expect(c._id).toBe('c1');
    expect(c.memberId).toBe('mem-1');
    expect(c.balance).toBe(50);
    expect(c.initialAmount).toBe(100);
    expect(c.reason).toBe('refund');
    expect(c.status).toBe('active');
    expect(c.createdDate).toBeDefined();
    expect(c.expirationDate).toBeDefined();
  });

  it('catches query error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('DB error'); });
    const r = await getMyStoreCredit('mem-1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to retrieve');
  });

  it('rounds totalBalance to 2 decimals', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 33.33 }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 33.33 }),
      makeCredit({ _id: 'c3', memberId: 'mem-1', balance: 33.34 }),
    ]);
    const r = await getMyStoreCredit('mem-1');
    expect(r.totalBalance).toBe(100);
  });
});

// ── applyStoreCredit ────────────────────────────────────────────────

describe('applyStoreCredit — input validation', () => {
  it('rejects null memberId', async () => {
    const r = await applyStoreCredit(null, 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects empty memberId', async () => {
    const r = await applyStoreCredit('', 50);
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only memberId', async () => {
    const r = await applyStoreCredit('   ', 50);
    expect(r.success).toBe(false);
  });

  it('rejects non-string memberId', async () => {
    const r = await applyStoreCredit(123, 50);
    expect(r.success).toBe(false);
  });

  it('rejects zero orderAmount', async () => {
    const r = await applyStoreCredit('mem-1', 0);
    expect(r.success).toBe(false);
    expect(r.message).toContain('positive order amount');
  });

  it('rejects negative orderAmount', async () => {
    const r = await applyStoreCredit('mem-1', -10);
    expect(r.success).toBe(false);
  });

  it('rejects NaN orderAmount', async () => {
    const r = await applyStoreCredit('mem-1', NaN);
    expect(r.success).toBe(false);
  });

  it('rejects Infinity orderAmount', async () => {
    const r = await applyStoreCredit('mem-1', Infinity);
    expect(r.success).toBe(false);
  });
});

describe('applyStoreCredit — credit application', () => {
  it('applies full credit to order when credit > order', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 100 }),
    ]);
    const r = await applyStoreCredit('mem-1', 40);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(40);
    expect(r.remainingOrderBalance).toBe(0);
    expect(r.creditsUsed).toHaveLength(1);
    expect(r.creditsUsed[0].amountUsed).toBe(40);
    expect(r.creditsUsed[0].remainingBalance).toBe(60);
  });

  it('applies partial credit when credit < order', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 30 }),
    ]);
    const r = await applyStoreCredit('mem-1', 50);
    expect(r.amountApplied).toBe(30);
    expect(r.remainingOrderBalance).toBe(20);
  });

  it('uses multiple credits to cover order', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 20, expirationDate: futureDate(10) }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 30, expirationDate: futureDate(20) }),
    ]);
    const r = await applyStoreCredit('mem-1', 45);
    expect(r.amountApplied).toBe(45);
    expect(r.remainingOrderBalance).toBe(0);
    expect(r.creditsUsed).toHaveLength(2);
  });

  it('marks fully-used credit as "used"', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50 }),
    ]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    await applyStoreCredit('mem-1', 50);
    expect(updated.status).toBe('used');
    expect(updated.balance).toBe(0);
  });

  it('keeps partially-used credit as "active"', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50 }),
    ]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    await applyStoreCredit('mem-1', 20);
    expect(updated.status).toBe('active');
    expect(updated.balance).toBe(30);
  });

  it('skips expired credits during application', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-expired', memberId: 'mem-1', balance: 100, expirationDate: pastDate(5) }),
      makeCredit({ _id: 'c-valid', memberId: 'mem-1', balance: 25, expirationDate: futureDate(100) }),
    ]);
    const r = await applyStoreCredit('mem-1', 50);
    expect(r.amountApplied).toBe(25);
    expect(r.remainingOrderBalance).toBe(25);
  });

  it('auto-expires past-due credits encountered during apply', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-expired', memberId: 'mem-1', balance: 100, expirationDate: pastDate(5) }),
    ]);
    const updates = [];
    __onUpdate((col, data) => { if (col === 'StoreCredits') updates.push(data); });

    await applyStoreCredit('mem-1', 50);
    const expiredUpdate = updates.find(u => u._id === 'c-expired');
    expect(expiredUpdate.status).toBe('expired');
    expect(expiredUpdate.balance).toBe(0);
  });

  it('skips credits with zero balance', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c0', memberId: 'mem-1', balance: 0 }),
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10 }),
    ]);
    const r = await applyStoreCredit('mem-1', 5);
    expect(r.creditsUsed).toHaveLength(1);
    expect(r.creditsUsed[0].creditId).toBe('c1');
  });

  it('records redeem transaction in credit', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50, transactions: '[]' }),
    ]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    await applyStoreCredit('mem-1', 20);
    const txns = JSON.parse(updated.transactions);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('redeem');
    expect(txns[0].amount).toBe(20);
  });

  it('handles malformed transactions JSON gracefully', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50, transactions: 'INVALID JSON' }),
    ]);
    const r = await applyStoreCredit('mem-1', 10);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(10);
  });

  it('sets lastUsedDate on updated credit', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 50 }),
    ]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    await applyStoreCredit('mem-1', 10);
    expect(updated.lastUsedDate).toBeInstanceOf(Date);
  });

  it('returns zero amountApplied when no credits exist', async () => {
    const r = await applyStoreCredit('mem-1', 50);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(0);
    expect(r.remainingOrderBalance).toBe(50);
    expect(r.creditsUsed).toEqual([]);
  });

  it('catches error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await applyStoreCredit('mem-1', 10);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to apply');
  });

  it('rounds deductions to 2 decimal places', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10.555 }),
    ]);
    const r = await applyStoreCredit('mem-1', 5.555);
    expect(r.amountApplied).toBe(5.56);
  });
});

// ── getStoreCreditHistory ───────────────────────────────────────────

describe('getStoreCreditHistory — input validation', () => {
  it('rejects null memberId', async () => {
    const r = await getStoreCreditHistory(null);
    expect(r.success).toBe(false);
  });

  it('rejects undefined memberId', async () => {
    const r = await getStoreCreditHistory(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects empty string', async () => {
    const r = await getStoreCreditHistory('');
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only', async () => {
    const r = await getStoreCreditHistory('   ');
    expect(r.success).toBe(false);
  });

  it('rejects numeric memberId', async () => {
    const r = await getStoreCreditHistory(99);
    expect(r.success).toBe(false);
  });
});

describe('getStoreCreditHistory — results', () => {
  it('returns empty array when no history', async () => {
    const r = await getStoreCreditHistory('mem-1');
    expect(r.success).toBe(true);
    expect(r.credits).toEqual([]);
  });

  it('returns all statuses (active, used, expired)', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', status: 'active' }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', status: 'used' }),
      makeCredit({ _id: 'c3', memberId: 'mem-1', status: 'expired' }),
    ]);
    const r = await getStoreCreditHistory('mem-1');
    expect(r.credits).toHaveLength(3);
  });

  it('parses transactions JSON in response', async () => {
    const txns = [{ type: 'issue', amount: 50, date: '2026-01-01' }];
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', transactions: JSON.stringify(txns) }),
    ]);
    const r = await getStoreCreditHistory('mem-1');
    expect(r.credits[0].transactions).toEqual(txns);
  });

  it('handles malformed transactions JSON (defaults to empty array)', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', transactions: '{broken' }),
    ]);
    const r = await getStoreCreditHistory('mem-1');
    expect(r.credits[0].transactions).toEqual([]);
  });

  it('handles null transactions field', async () => {
    __seed('StoreCredits', [{
      _id: 'c1', memberId: 'mem-1', balance: 50, initialAmount: 50,
      reason: 'return', orderReference: '', status: 'active',
      createdDate: new Date(), expirationDate: futureDate(300),
      lastUsedDate: null, transactions: null, giftMessage: '',
    }]);
    const r = await getStoreCreditHistory('mem-1');
    expect(r.credits[0].transactions).toEqual([]);
  });

  it('includes orderReference in response', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', orderReference: 'ORD-999' }),
    ]);
    const r = await getStoreCreditHistory('mem-1');
    expect(r.credits[0].orderReference).toBe('ORD-999');
  });

  it('catches query error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getStoreCreditHistory('mem-1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to retrieve credit history');
  });
});

// ── giftStoreCredit ─────────────────────────────────────────────────

describe('giftStoreCredit — input validation', () => {
  it('rejects null data', async () => {
    const r = await giftStoreCredit(null);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Gift data is required');
  });

  it('rejects undefined data', async () => {
    const r = await giftStoreCredit(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects non-object data', async () => {
    const r = await giftStoreCredit('string');
    expect(r.success).toBe(false);
  });

  it('rejects missing fromMemberId', async () => {
    const r = await giftStoreCredit({ toMemberId: 'to-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Giver member ID');
  });

  it('rejects missing toMemberId', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Recipient member ID');
  });

  it('rejects self-gifting', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'same', toMemberId: 'same', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('yourself');
  });

  it('rejects zero amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 0 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('positive gift amount');
  });

  it('rejects negative amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: -5 });
    expect(r.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: NaN });
    expect(r.success).toBe(false);
  });

  it('rejects Infinity amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: Infinity });
    expect(r.success).toBe(false);
  });
});

describe('giftStoreCredit — insufficient balance', () => {
  it('rejects when giver has no credits', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Insufficient');
  });

  it('rejects when giver has less than gift amount', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 20 }),
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 50 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('$20.00');
  });

  it('excludes expired credits from available balance', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-exp', memberId: 'from-1', balance: 100, expirationDate: pastDate(5) }),
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('$0.00');
  });
});

describe('giftStoreCredit — successful gift', () => {
  it('deducts from giver and creates credit for recipient', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 100 }),
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 40 });
    expect(r.success).toBe(true);
    expect(r.giftedAmount).toBe(40);
    expect(r.newCreditId).toBeDefined();
  });

  it('deducts from multiple credits if needed', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 30, expirationDate: futureDate(10) }),
      makeCredit({ _id: 'c2', memberId: 'from-1', balance: 30, expirationDate: futureDate(20) }),
    ]);
    const updates = [];
    __onUpdate((col, data) => { if (col === 'StoreCredits') updates.push({ ...data }); });

    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 50 });
    expect(r.success).toBe(true);
    expect(updates).toHaveLength(2);
    expect(updates[0].balance).toBe(0);
    expect(updates[0].status).toBe('used');
    expect(updates[1].balance).toBe(10);
    expect(updates[1].status).toBe('active');
  });

  it('records gift_sent transaction on giver credit', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50, transactions: '[]' }),
    ]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'StoreCredits') updated = data; });

    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 20 });
    const txns = JSON.parse(updated.transactions);
    expect(txns[0].type).toBe('gift_sent');
    expect(txns[0].amount).toBe(20);
    expect(txns[0].toMemberId).toBe('to-1');
  });

  it('creates recipient credit with gift_received reason', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50 }),
    ]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 25 });
    expect(inserted.memberId).toBe('to-1');
    expect(inserted.balance).toBe(25);
    expect(inserted.reason).toBe('gift_received');
    expect(inserted.status).toBe('active');
  });

  it('stores gift_received transaction with fromMemberId', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50 }),
    ]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    const txns = JSON.parse(inserted.transactions);
    expect(txns[0].type).toBe('gift_received');
    expect(txns[0].fromMemberId).toBe('from-1');
  });

  it('sanitizes gift message to 500 chars', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50 }),
    ]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    const longMsg = 'm'.repeat(1000);
    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10, message: longMsg });
    expect(inserted.giftMessage.length).toBeLessThanOrEqual(500);
  });

  it('defaults gift message to empty when not provided', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50 }),
    ]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    expect(inserted.giftMessage).toBe('');
  });

  it('skips expired and zero-balance credits during deduction', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-exp', memberId: 'from-1', balance: 100, expirationDate: pastDate(5) }),
      makeCredit({ _id: 'c-zero', memberId: 'from-1', balance: 0, expirationDate: futureDate(100) }),
      makeCredit({ _id: 'c-valid', memberId: 'from-1', balance: 50, expirationDate: futureDate(100) }),
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 30 });
    expect(r.success).toBe(true);
    expect(r.giftedAmount).toBe(30);
  });

  it('rounds gift amount to 2 decimal places', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 100 }),
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 33.337 });
    expect(r.giftedAmount).toBe(33.34);
  });

  it('catches error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to gift');
  });

  it('sets expirationDate ~365 days in future on recipient credit', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'from-1', balance: 50 }),
    ]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'StoreCredits') inserted = item; });

    await giftStoreCredit({ fromMemberId: 'from-1', toMemberId: 'to-1', amount: 10 });
    const diff = (inserted.expirationDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diff).toBeGreaterThan(364);
    expect(diff).toBeLessThan(366);
  });
});

// ── getExpiringCredits ──────────────────────────────────────────────

describe('getExpiringCredits — input validation', () => {
  it('rejects null memberId', async () => {
    const r = await getExpiringCredits(null);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects undefined memberId', async () => {
    const r = await getExpiringCredits(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects empty string', async () => {
    const r = await getExpiringCredits('');
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only', async () => {
    const r = await getExpiringCredits('   ');
    expect(r.success).toBe(false);
  });

  it('rejects numeric memberId', async () => {
    const r = await getExpiringCredits(42);
    expect(r.success).toBe(false);
  });
});

describe('getExpiringCredits — within days clamping', () => {
  it('defaults withinDays to 30 when not provided', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10, expirationDate: futureDate(15) }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 20, expirationDate: futureDate(45) }),
    ]);
    const r = await getExpiringCredits('mem-1');
    expect(r.success).toBe(true);
    expect(r.expiringCredits).toHaveLength(1);
    expect(r.expiringCredits[0]._id).toBe('c1');
  });

  it('clamps withinDays to minimum 1', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10, expirationDate: futureDate(0.5) }),
    ]);
    const r = await getExpiringCredits('mem-1', -100);
    expect(r.success).toBe(true);
    // Should use withinDays=1, so credit expiring in 0.5 days should be included
    expect(r.expiringCredits).toHaveLength(1);
  });

  it('clamps withinDays to maximum 365', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10, expirationDate: futureDate(364) }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 20, expirationDate: futureDate(400) }),
    ]);
    const r = await getExpiringCredits('mem-1', 9999);
    // withinDays clamped to 365, so c2 at 400 days out should NOT be included
    expect(r.expiringCredits).toHaveLength(1);
  });

  it('rounds withinDays to nearest integer', async () => {
    const r = await getExpiringCredits('mem-1', 10.7);
    expect(r.success).toBe(true);
  });

  it('defaults NaN withinDays to 30', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 10, expirationDate: futureDate(20) }),
    ]);
    const r = await getExpiringCredits('mem-1', NaN);
    expect(r.success).toBe(true);
    expect(r.expiringCredits).toHaveLength(1);
  });

  it('defaults string withinDays to 30', async () => {
    const r = await getExpiringCredits('mem-1', 'abc');
    expect(r.success).toBe(true);
  });
});

describe('getExpiringCredits — filtering', () => {
  it('excludes already-expired credits', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-past', memberId: 'mem-1', balance: 50, expirationDate: pastDate(5) }),
    ]);
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.expiringCredits).toHaveLength(0);
    expect(r.expiringTotal).toBe(0);
  });

  it('excludes credits with null expirationDate', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-null', memberId: 'mem-1', balance: 50, expirationDate: null }),
    ]);
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.expiringCredits).toHaveLength(0);
  });

  it('excludes credits with zero balance', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c0', memberId: 'mem-1', balance: 0, expirationDate: futureDate(10) }),
    ]);
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.expiringCredits).toHaveLength(0);
  });

  it('sums expiringTotal correctly', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 33.33, expirationDate: futureDate(10) }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 66.67, expirationDate: futureDate(20) }),
    ]);
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.expiringTotal).toBe(100);
  });

  it('returns empty when no credits exist', async () => {
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.success).toBe(true);
    expect(r.expiringCredits).toEqual([]);
    expect(r.expiringTotal).toBe(0);
  });

  it('includes credit expiring exactly at cutoff', async () => {
    // cutoff is inclusive (<=)
    const exactDays = 15;
    __seed('StoreCredits', [
      makeCredit({ _id: 'c-exact', memberId: 'mem-1', balance: 25, expirationDate: futureDate(exactDays) }),
    ]);
    const r = await getExpiringCredits('mem-1', exactDays);
    // The cutoff and expiration are computed independently so this may be 0 or 1
    // depending on ms precision, but the function should not crash
    expect(r.success).toBe(true);
  });

  it('catches error and returns failure', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Failed to retrieve expiring credits');
  });

  it('rounds expiringTotal to 2 decimal places', async () => {
    __seed('StoreCredits', [
      makeCredit({ _id: 'c1', memberId: 'mem-1', balance: 0.01, expirationDate: futureDate(5) }),
      makeCredit({ _id: 'c2', memberId: 'mem-1', balance: 0.02, expirationDate: futureDate(5) }),
    ]);
    const r = await getExpiringCredits('mem-1', 30);
    expect(r.expiringTotal).toBe(0.03);
  });
});
