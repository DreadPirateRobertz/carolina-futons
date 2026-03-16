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
}));

let _mockMember = { _id: 'member1' };
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: async () => _mockMember },
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
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
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
  _mockMember = { _id: 'member1' };
  vi.resetModules();
  mod = await import('../src/backend/loyaltyTiers.web.js');
});

// ── getTier ────────────────────────────────────────────────────────

describe('getTier', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.getTier();
    expect(r.success).toBe(false);
  });

  it('creates Bronze record for new customer', async () => {
    const r = await mod.getTier();
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('Bronze');
    expect(r.data.lifetimeSpend).toBe(0);
    expect(r.data.discountPercent).toBe(0);
  });

  it('returns existing tier record', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 600, currentTier: 'Silver' }]);
    const r = await mod.getTier();
    expect(r.data.tier).toBe('Silver');
    expect(r.data.lifetimeSpend).toBe(600);
    expect(r.data.discountPercent).toBe(5);
  });

  it('shows next tier info', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 600, currentTier: 'Silver' }]);
    const r = await mod.getTier();
    expect(r.data.nextTier).toBe('Gold');
    expect(r.data.spendToNext).toBe(900); // 1500 - 600
  });

  it('shows null next tier for Platinum', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 5000, currentTier: 'Platinum' }]);
    const r = await mod.getTier();
    expect(r.data.nextTier).toBeNull();
    expect(r.data.spendToNext).toBe(0);
  });

  it('includes free shipping threshold', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 2000, currentTier: 'Gold' }]);
    const r = await mod.getTier();
    expect(r.data.freeShippingThreshold).toBe(50);
    expect(r.data.earlyAccess).toBe(true);
  });
});

// ── updateTier ─────────────────────────────────────────────────────

describe('updateTier', () => {
  it('rejects invalid member ID', async () => {
    const r = await mod.updateTier(null, 500);
    expect(r.success).toBe(false);
  });

  it('rejects negative order amount', async () => {
    const r = await mod.updateTier('member1', -100);
    expect(r.success).toBe(false);
  });

  it('rejects non-number order amount', async () => {
    const r = await mod.updateTier('member1', 'abc');
    expect(r.success).toBe(false);
  });

  it('creates Bronze record and adds spend for new customer', async () => {
    const r = await mod.updateTier('member1', 200);
    expect(r.success).toBe(true);
    expect(r.data.lifetimeSpend).toBe(200);
    expect(r.data.currentTier).toBe('Bronze');
    expect(r.data.tierChanged).toBe(false);
  });

  it('upgrades tier when threshold crossed', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 400, currentTier: 'Bronze' }]);
    const r = await mod.updateTier('member1', 200);
    expect(r.success).toBe(true);
    expect(r.data.lifetimeSpend).toBe(600);
    expect(r.data.currentTier).toBe('Silver');
    expect(r.data.tierChanged).toBe(true);
    expect(r.data.previousTier).toBe('Bronze');
    expect(r.data.discountPercent).toBe(5);
  });

  it('stays in same tier when threshold not crossed', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 100, currentTier: 'Bronze' }]);
    const r = await mod.updateTier('member1', 50);
    expect(r.data.currentTier).toBe('Bronze');
    expect(r.data.tierChanged).toBe(false);
  });

  it('accumulates spend across updates', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 1400, currentTier: 'Silver' }]);
    const r = await mod.updateTier('member1', 200);
    expect(r.data.lifetimeSpend).toBe(1600);
    expect(r.data.currentTier).toBe('Gold');
  });
});

// ── calculateRewards ───────────────────────────────────────────────

describe('calculateRewards', () => {
  it('rejects negative order total', async () => {
    const r = await mod.calculateRewards(-100);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.calculateRewards(500);
    expect(r.success).toBe(false);
  });

  it('returns Bronze defaults for new customer', async () => {
    const r = await mod.calculateRewards(500);
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('Bronze');
    expect(r.data.discountPercent).toBe(0);
    expect(r.data.discountAmount).toBe(0);
    expect(r.data.finalTotal).toBe(500);
  });

  it('calculates Gold discount correctly', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 2000, currentTier: 'Gold' }]);
    const r = await mod.calculateRewards(500);
    expect(r.data.tier).toBe('Gold');
    expect(r.data.discountPercent).toBe(10);
    expect(r.data.discountAmount).toBe(50);
    expect(r.data.finalTotal).toBe(450);
  });

  it('determines free shipping based on tier threshold', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 2000, currentTier: 'Gold' }]);
    const r = await mod.calculateRewards(60);
    expect(r.data.freeShipping).toBe(true); // Gold threshold is $50
  });

  it('no free shipping below threshold', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 100, currentTier: 'Bronze' }]);
    const r = await mod.calculateRewards(100);
    expect(r.data.freeShipping).toBe(false); // Bronze threshold is $150
  });

  it('Platinum gets free shipping always', async () => {
    __seed('CustomerTierHistory', [{ _id: 'cth1', memberId: 'member1', lifetimeSpend: 5000, currentTier: 'Platinum' }]);
    const r = await mod.calculateRewards(1);
    expect(r.data.freeShipping).toBe(true); // Platinum threshold is $0
    expect(r.data.discountPercent).toBe(15);
  });
});

// ── getAllTiers ─────────────────────────────────────────────────────

describe('getAllTiers', () => {
  it('returns default tiers when CMS is empty', async () => {
    const r = await mod.getAllTiers();
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(4);
    expect(r.data[0].name).toBe('Bronze');
    expect(r.data[3].name).toBe('Platinum');
  });

  it('includes all tier benefits', async () => {
    const r = await mod.getAllTiers();
    const gold = r.data.find(t => t.name === 'Gold');
    expect(gold.discountPercent).toBe(10);
    expect(gold.freeShippingThreshold).toBe(50);
    expect(gold.earlyAccess).toBe(true);
    expect(gold.minSpend).toBe(1500);
  });
});

// ── getCustomerTierHistory ─────────────────────────────────────────

describe('getCustomerTierHistory', () => {
  it('rejects invalid member ID', async () => {
    const r = await mod.getCustomerTierHistory(null);
    expect(r.success).toBe(false);
  });

  it('returns not found for unknown customer', async () => {
    const r = await mod.getCustomerTierHistory('unknown');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('returns customer tier data', async () => {
    __seed('CustomerTierHistory', [{
      _id: 'cth1', memberId: 'member1', lifetimeSpend: 1600,
      currentTier: 'Gold', previousTier: 'Silver', tierChangedAt: new Date(),
    }]);
    const r = await mod.getCustomerTierHistory('member1');
    expect(r.success).toBe(true);
    expect(r.data.currentTier).toBe('Gold');
    expect(r.data.previousTier).toBe('Silver');
    expect(r.data.discountPercent).toBe(10);
    expect(r.data.earlyAccess).toBe(true);
  });
});
