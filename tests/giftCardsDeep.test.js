import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: {
    emailContact: vi.fn().mockResolvedValue({}),
  },
  contacts: {
    appendOrCreateContact: vi.fn().mockResolvedValue({ contactId: 'contact1' }),
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
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
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/giftCards.web.js');
});

// ── purchaseGiftCard ──────────────────────────────────────────────

describe('purchaseGiftCard', () => {
  const validData = {
    amount: 100,
    purchaserEmail: 'buyer@test.com',
    recipientEmail: 'recipient@test.com',
    recipientName: 'Jane',
    message: 'Happy Birthday!',
  };

  it('rejects null data', async () => {
    const r = await mod.purchaseGiftCard(null);
    expect(r.success).toBe(false);
  });

  it('rejects missing amount', async () => {
    const r = await mod.purchaseGiftCard({ purchaserEmail: 'a@b.com', recipientEmail: 'c@d.com' });
    expect(r.success).toBe(false);
  });

  it('rejects missing purchaserEmail', async () => {
    const r = await mod.purchaseGiftCard({ amount: 100, recipientEmail: 'c@d.com' });
    expect(r.success).toBe(false);
  });

  it('rejects missing recipientEmail', async () => {
    const r = await mod.purchaseGiftCard({ amount: 100, purchaserEmail: 'a@b.com' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid amount (not in allowed list)', async () => {
    const r = await mod.purchaseGiftCard({ ...validData, amount: 75 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('must be one of');
  });

  it('rejects NaN amount', async () => {
    const r = await mod.purchaseGiftCard({ ...validData, amount: NaN });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const r = await mod.purchaseGiftCard({ ...validData, purchaserEmail: 'not-an-email' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('email');
  });

  it('succeeds with valid data', async () => {
    const r = await mod.purchaseGiftCard(validData);
    expect(r.success).toBe(true);
    expect(r.code).toMatch(/^CF-/);
    expect(r.amount).toBe(100);
    expect(r.expirationDate).toBeTruthy();
  });

  it('accepts all valid amounts', async () => {
    for (const amount of [25, 50, 100, 150, 200, 500]) {
      _collections = {};
      const r = await mod.purchaseGiftCard({ ...validData, amount });
      expect(r.success).toBe(true);
      expect(r.amount).toBe(amount);
    }
  });

  it('stores card with correct initial balance', async () => {
    await mod.purchaseGiftCard(validData);
    const card = _collections['GiftCards'][0];
    expect(card.balance).toBe(100);
    expect(card.initialAmount).toBe(100);
    expect(card.status).toBe('active');
  });

  it('lowercases emails', async () => {
    await mod.purchaseGiftCard({ ...validData, purchaserEmail: 'BUYER@TEST.COM', recipientEmail: 'RECV@TEST.COM' });
    const card = _collections['GiftCards'][0];
    expect(card.purchaserEmail).toBe('buyer@test.com');
    expect(card.recipientEmail).toBe('recv@test.com');
  });

  it('sanitizes recipientName and message', async () => {
    await mod.purchaseGiftCard({ ...validData, recipientName: '<script>xss</script>Jane', message: '<b>bold</b>' });
    const card = _collections['GiftCards'][0];
    expect(card.recipientName).not.toContain('<script>');
    expect(card.message).not.toContain('<b>');
  });
});

// ── checkBalance ──────────────────────────────────────────────────

describe('checkBalance', () => {
  it('returns not found for empty code', async () => {
    const r = await mod.checkBalance('');
    expect(r.found).toBe(false);
  });

  it('returns not found for null code', async () => {
    const r = await mod.checkBalance(null);
    expect(r.found).toBe(false);
  });

  it('returns not found for non-existent code', async () => {
    __seed('GiftCards', []);
    const r = await mod.checkBalance('CF-XXXX-YYYY-ZZZZ-AAAA');
    expect(r.found).toBe(false);
  });

  it('returns balance for active card', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-ABCD-EFGH-JKLM-NPQR', balance: 75, initialAmount: 100,
      status: 'active', expirationDate: future,
    }]);
    const r = await mod.checkBalance('cf-abcd-efgh-jklm-npqr'); // lowercased input, uppercased in code
    expect(r.found).toBe(true);
    expect(r.balance).toBe(75);
    expect(r.status).toBe('active');
    expect(r.initialAmount).toBe(100);
  });

  it('marks expired card and returns balance 0', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-ABCD-EFGH-JKLM-NPQR', balance: 50, initialAmount: 100,
      status: 'active', expirationDate: past,
    }]);
    const r = await mod.checkBalance('CF-ABCD-EFGH-JKLM-NPQR');
    expect(r.found).toBe(true);
    expect(r.balance).toBe(0);
    expect(r.status).toBe('expired');
    // Should have updated the record
    expect(_collections['GiftCards'][0].status).toBe('expired');
  });

  it('does not re-update already expired card', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-ABCD-EFGH-JKLM-NPQR', balance: 0, initialAmount: 100,
      status: 'expired', expirationDate: past,
    }]);
    const r = await mod.checkBalance('CF-ABCD-EFGH-JKLM-NPQR');
    expect(r.found).toBe(true);
    expect(r.status).toBe('expired');
  });
});

// ── redeemGiftCard ────────────────────────────────────────────────

describe('redeemGiftCard', () => {
  it('rejects missing code', async () => {
    const r = await mod.redeemGiftCard('', 50);
    expect(r.success).toBe(false);
  });

  it('rejects missing amount', async () => {
    const r = await mod.redeemGiftCard('CF-XXXX', 0);
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const r = await mod.redeemGiftCard('CF-XXXX', -10);
    expect(r.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const r = await mod.redeemGiftCard('CF-XXXX', NaN);
    expect(r.success).toBe(false);
  });

  it('rejects non-existent card', async () => {
    __seed('GiftCards', []);
    const r = await mod.redeemGiftCard('CF-XXXX', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('not found');
  });

  it('rejects inactive card (redeemed status)', async () => {
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 0, status: 'redeemed',
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 50);
    expect(r.success).toBe(false);
  });

  it('rejects expired card', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 100, status: 'active',
      expirationDate: past,
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('expired');
  });

  it('rejects zero balance card', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 0, status: 'active',
      expirationDate: future,
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('no remaining balance');
  });

  it('redeems partial amount', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 100, status: 'active',
      expirationDate: future, claimId: null,
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 30);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(30);
    expect(r.remainingBalance).toBe(70);
  });

  it('redeems full balance and sets status to redeemed', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 50, status: 'active',
      expirationDate: future, claimId: null,
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 50);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(50);
    expect(r.remainingBalance).toBe(0);
    expect(_collections['GiftCards'][0].status).toBe('redeemed');
  });

  it('caps amount at available balance (overpay)', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 30, status: 'active',
      expirationDate: future, claimId: null,
    }]);
    const r = await mod.redeemGiftCard('CF-XXXX', 100);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(30);
    expect(r.remainingBalance).toBe(0);
  });

  it('uppercases code for matching', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    __seed('GiftCards', [{
      _id: 'gc1', code: 'CF-XXXX', balance: 50, status: 'active',
      expirationDate: future, claimId: null,
    }]);
    const r = await mod.redeemGiftCard('cf-xxxx', 10);
    expect(r.success).toBe(true);
  });
});

// ── getGiftCardOptions ────────────────────────────────────────────

describe('getGiftCardOptions', () => {
  it('returns all 6 denominations', async () => {
    const r = await mod.getGiftCardOptions();
    expect(r).toHaveLength(6);
    expect(r[0]).toEqual({ amount: 25, label: '$25' });
    expect(r[5]).toEqual({ amount: 500, label: '$500' });
  });

  it('includes $100 option', async () => {
    const r = await mod.getGiftCardOptions();
    expect(r.find(o => o.amount === 100)).toBeTruthy();
  });
});

// ── getMyGiftCards ────────────────────────────────────────────────

describe('getMyGiftCards', () => {
  it('rejects empty email', async () => {
    const r = await mod.getMyGiftCards('');
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const r = await mod.getMyGiftCards('not-email');
    expect(r.success).toBe(false);
  });

  it('returns purchased and received cards', async () => {
    __seed('GiftCards', [
      { _id: 'gc1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 100, initialAmount: 100, status: 'active', purchaserEmail: 'me@test.com', recipientEmail: 'them@test.com', expirationDate: '2027-01-01', createdDate: '2026-01-01' },
      { _id: 'gc2', code: 'CF-EEEE-FFFF-GGGG-HHHH', balance: 50, initialAmount: 50, status: 'active', purchaserEmail: 'other@test.com', recipientEmail: 'me@test.com', expirationDate: '2027-01-01', createdDate: '2026-02-01' },
    ]);
    const r = await mod.getMyGiftCards('me@test.com');
    expect(r.success).toBe(true);
    expect(r.purchased).toHaveLength(1);
    expect(r.received).toHaveLength(1);
    // Cards should have masked codes
    expect(r.purchased[0].maskedCode).toContain('****');
    expect(r.received[0].maskedCode).toContain('****');
  });

  it('returns empty arrays when no cards', async () => {
    __seed('GiftCards', []);
    const r = await mod.getMyGiftCards('nobody@test.com');
    expect(r.success).toBe(true);
    expect(r.purchased).toEqual([]);
    expect(r.received).toEqual([]);
  });

  it('lowercases email for lookup', async () => {
    __seed('GiftCards', [
      { _id: 'gc1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 25, initialAmount: 25, status: 'active', purchaserEmail: 'me@test.com', recipientEmail: 'x@y.com', createdDate: '2026-01-01' },
    ]);
    const r = await mod.getMyGiftCards('ME@TEST.COM');
    expect(r.purchased).toHaveLength(1);
  });
});
