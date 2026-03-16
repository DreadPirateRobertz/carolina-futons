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
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _mockMember = { _id: 'member1', loginEmail: 'test@test.com', contactDetails: { firstName: 'John', lastName: 'Doe' } };

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
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
  _mockMember = { _id: 'member1', loginEmail: 'test@test.com', contactDetails: { firstName: 'John', lastName: 'Doe' } };
  vi.resetModules();
  mod = await import('../src/backend/priceMatchService.web.js');
});

// ── submitPriceMatchRequest ───────────────────────────────────────

describe('submitPriceMatchRequest', () => {
  const validData = {
    productId: 'prod1',
    productName: 'Futon Sofa',
    ourPrice: 500,
    competitorName: 'Wayfair',
    competitorUrl: 'https://wayfair.com/product',
    competitorPrice: 400,
  };

  it('rejects null data', async () => {
    const r = await mod.submitPriceMatchRequest(null);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.submitPriceMatchRequest(validData);
    expect(r.success).toBe(false);
    expect(r.message).toContain('logged in');
  });

  it('rejects invalid productId', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, productId: '' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('product ID');
  });

  it('rejects missing competitorName', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorName: '' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Competitor name');
  });

  it('rejects invalid competitorUrl (non-string)', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorUrl: 123 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('URL must be a string');
  });

  it('rejects invalid competitorUrl (not http/https)', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorUrl: 'ftp://bad.com' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('valid http');
  });

  it('accepts empty competitorUrl', async () => {
    __seed('PriceMatches', []);
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorUrl: '' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid ourPrice (NaN)', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, ourPrice: NaN });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Our price');
  });

  it('rejects ourPrice above MAX_PRICE (50000)', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, ourPrice: 60000 });
    expect(r.success).toBe(false);
  });

  it('rejects zero ourPrice', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, ourPrice: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects negative competitorPrice', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorPrice: -10 });
    expect(r.success).toBe(false);
  });

  it('rejects competitor price >= our price', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorPrice: 500 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('lower');
  });

  it('rejects competitor price > our price', async () => {
    const r = await mod.submitPriceMatchRequest({ ...validData, competitorPrice: 600 });
    expect(r.success).toBe(false);
  });

  it('rejects duplicate pending request', async () => {
    __seed('PriceMatches', [{
      _id: 'pm1', productId: 'prod1', competitorName: 'wayfair', memberId: 'member1', status: 'pending',
    }]);
    const r = await mod.submitPriceMatchRequest(validData);
    expect(r.success).toBe(false);
    expect(r.message).toContain('pending');
  });

  it('succeeds with valid data', async () => {
    __seed('PriceMatches', []);
    const r = await mod.submitPriceMatchRequest(validData);
    expect(r.success).toBe(true);
    expect(r.request.claimNumber).toMatch(/^PM-/);
    expect(r.request.priceDifference).toBe(100);
    expect(r.request.status).toBe('pending');
  });

  it('calculates priceDifference correctly with decimals', async () => {
    __seed('PriceMatches', []);
    const r = await mod.submitPriceMatchRequest({ ...validData, ourPrice: 499.99, competitorPrice: 399.50 });
    expect(r.request.priceDifference).toBe(100.49);
  });

  it('builds memberName from first + last', async () => {
    __seed('PriceMatches', []);
    const r = await mod.submitPriceMatchRequest(validData);
    const stored = _collections['PriceMatches'][0];
    expect(stored.memberName).toBe('John Doe');
  });

  it('handles member without contactDetails', async () => {
    _mockMember = { _id: 'member1', loginEmail: 'x@x.com' };
    __seed('PriceMatches', []);
    const r = await mod.submitPriceMatchRequest(validData);
    expect(r.success).toBe(true);
    const stored = _collections['PriceMatches'][0];
    expect(stored.memberName).toBe('');
  });
});

// ── getMyPriceMatches ─────────────────────────────────────────────

describe('getMyPriceMatches', () => {
  it('returns empty for unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.getMyPriceMatches();
    expect(r.requests).toEqual([]);
  });

  it('returns formatted requests', async () => {
    __seed('PriceMatches', [{
      _id: 'pm1', memberId: 'member1', claimNumber: 'PM-ABCD-1234',
      productName: 'Sofa', competitorName: 'Wayfair',
      ourPrice: 500, competitorPrice: 400, priceDifference: 100,
      status: 'approved', creditAmount: 100, adminNotes: 'OK',
      _createdDate: '2025-01-01',
    }]);
    const r = await mod.getMyPriceMatches();
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0].claimNumber).toBe('PM-ABCD-1234');
    expect(r.requests[0].creditAmount).toBe(100);
  });

  it('only shows adminNotes for denied requests', async () => {
    __seed('PriceMatches', [
      { _id: 'pm1', memberId: 'member1', status: 'denied', adminNotes: 'Not eligible', creditAmount: 0 },
      { _id: 'pm2', memberId: 'member1', status: 'approved', adminNotes: 'Internal note', creditAmount: 50 },
    ]);
    const r = await mod.getMyPriceMatches();
    expect(r.requests.find(x => x._id === 'pm1').adminNotes).toBe('Not eligible');
    expect(r.requests.find(x => x._id === 'pm2').adminNotes).toBe('');
  });

  it('defaults creditAmount to 0', async () => {
    __seed('PriceMatches', [
      { _id: 'pm1', memberId: 'member1', status: 'pending' },
    ]);
    const r = await mod.getMyPriceMatches();
    expect(r.requests[0].creditAmount).toBe(0);
  });
});

// ── getPriceMatchById ─────────────────────────────────────────────

describe('getPriceMatchById', () => {
  it('rejects invalid ID', async () => {
    const r = await mod.getPriceMatchById(null);
    expect(r.success).toBe(false);
  });

  it('returns not found for missing record', async () => {
    __seed('PriceMatches', []);
    const r = await mod.getPriceMatchById('missing');
    expect(r.success).toBe(false);
    expect(r.message).toContain('not found');
  });

  it('returns formatted request', async () => {
    __seed('PriceMatches', [{
      _id: 'pm1', claimNumber: 'PM-XXXX-YYYY', productName: 'Chair',
      competitorName: 'IKEA', competitorUrl: 'https://ikea.com/chair',
      ourPrice: 200, competitorPrice: 150, priceDifference: 50,
      notes: 'Please match', status: 'pending', creditAmount: 0,
      adminNotes: '', _createdDate: '2025-01-01',
    }]);
    const r = await mod.getPriceMatchById('pm1');
    expect(r.success).toBe(true);
    expect(r.request.claimNumber).toBe('PM-XXXX-YYYY');
    expect(r.request.competitorUrl).toBe('https://ikea.com/chair');
  });
});

// ── reviewPriceMatchRequest ───────────────────────────────────────

describe('reviewPriceMatchRequest', () => {
  it('rejects invalid requestId', async () => {
    const r = await mod.reviewPriceMatchRequest(null, 'approved');
    expect(r.success).toBe(false);
  });

  it('rejects invalid decision', async () => {
    __seed('PriceMatches', [{ _id: 'pm1', status: 'pending' }]);
    const r = await mod.reviewPriceMatchRequest('pm1', 'maybe');
    expect(r.success).toBe(false);
    expect(r.message).toContain('approved');
  });

  it('rejects missing record', async () => {
    __seed('PriceMatches', []);
    const r = await mod.reviewPriceMatchRequest('missing', 'approved');
    expect(r.success).toBe(false);
  });

  it('rejects non-pending request', async () => {
    __seed('PriceMatches', [{ _id: 'pm1', status: 'approved' }]);
    const r = await mod.reviewPriceMatchRequest('pm1', 'approved');
    expect(r.success).toBe(false);
    expect(r.message).toContain('pending');
  });

  it('approves and sets creditAmount to priceDifference', async () => {
    __seed('PriceMatches', [{ _id: 'pm1', status: 'pending', priceDifference: 75 }]);
    const r = await mod.reviewPriceMatchRequest('pm1', 'approved', 'Verified');
    expect(r.success).toBe(true);
    expect(r.request.status).toBe('approved');
    expect(r.request.creditAmount).toBe(75);
    expect(r.request.adminNotes).toBe('Verified');
  });

  it('denies and sets creditAmount to 0', async () => {
    __seed('PriceMatches', [{ _id: 'pm1', status: 'pending', priceDifference: 75 }]);
    const r = await mod.reviewPriceMatchRequest('pm1', 'denied', 'Not eligible');
    expect(r.success).toBe(true);
    expect(r.request.status).toBe('denied');
    expect(r.request.creditAmount).toBe(0);
  });

  it('sets reviewedDate on review', async () => {
    __seed('PriceMatches', [{ _id: 'pm1', status: 'pending', priceDifference: 50 }]);
    await mod.reviewPriceMatchRequest('pm1', 'approved');
    expect(_collections['PriceMatches'][0].reviewedDate).toBeTruthy();
  });
});

// ── getCompetitorSources ──────────────────────────────────────────

describe('getCompetitorSources', () => {
  it('returns list of approved competitors', async () => {
    const r = await mod.getCompetitorSources();
    expect(r.competitors.length).toBe(10);
    expect(r.competitors[0]).toHaveProperty('name');
    expect(r.competitors[0]).toHaveProperty('domain');
  });

  it('includes known competitors', async () => {
    const r = await mod.getCompetitorSources();
    const names = r.competitors.map(c => c.name);
    expect(names).toContain('Wayfair');
    expect(names).toContain('Amazon');
    expect(names).toContain('IKEA');
  });
});

// ── getPriceMatchStats ────────────────────────────────────────────

describe('getPriceMatchStats', () => {
  it('returns zeros when no records', async () => {
    __seed('PriceMatches', []);
    const r = await mod.getPriceMatchStats();
    expect(r.stats.total).toBe(0);
    expect(r.stats.pending).toBe(0);
    expect(r.stats.totalCreditIssued).toBe(0);
  });

  it('calculates status breakdown', async () => {
    __seed('PriceMatches', [
      { _id: 'pm1', status: 'pending' },
      { _id: 'pm2', status: 'approved', creditAmount: 50 },
      { _id: 'pm3', status: 'denied' },
      { _id: 'pm4', status: 'credited', creditAmount: 30 },
      { _id: 'pm5', status: 'approved', creditAmount: 20 },
    ]);
    const r = await mod.getPriceMatchStats();
    expect(r.stats.total).toBe(5);
    expect(r.stats.pending).toBe(1);
    expect(r.stats.approved).toBe(2);
    expect(r.stats.denied).toBe(1);
    expect(r.stats.credited).toBe(1);
    expect(r.stats.totalCreditIssued).toBe(100); // 50+30+20
  });

  it('handles missing creditAmount', async () => {
    __seed('PriceMatches', [
      { _id: 'pm1', status: 'approved' },
    ]);
    const r = await mod.getPriceMatchStats();
    expect(r.stats.totalCreditIssued).toBe(0);
  });
});
