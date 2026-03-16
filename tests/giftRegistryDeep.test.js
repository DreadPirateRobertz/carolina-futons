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
  validateSlug: (s) => s && typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100) : null,
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
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2,6)}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    },
    remove: async (collection, id) => {
      _collections[collection] = (_collections[collection] || []).filter(i => i._id !== id);
    },
  },
}));

let _mockMember = { _id: 'member-abc' };
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
  _mockMember = { _id: 'member-abc' };
});

const mod = await import('../src/backend/giftRegistry.web.js');
const { createRegistry, getMyRegistries, getRegistry, getPublicRegistry, addRegistryItem, removeRegistryItem, markItemPurchased, deleteRegistry } = mod;

// ═════════════════════════════════════════════════════════════════════
// createRegistry
// ═════════════════════════════════════════════════════════════════════
describe('createRegistry', () => {
  it('creates a registry with valid data', async () => {
    __seed('GiftRegistries', []);
    const result = await createRegistry({ title: 'My Wedding', occasion: 'wedding', isPublic: true, message: 'Help us!' });
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('My Wedding');
    expect(result.data.slug).toBeTruthy();
  });

  it('rejects null data', async () => {
    const result = await createRegistry(null);
    expect(result.success).toBe(false);
  });

  it('requires title', async () => {
    const result = await createRegistry({ occasion: 'wedding' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title');
  });

  it('defaults to "other" for invalid occasion', async () => {
    __seed('GiftRegistries', []);
    await createRegistry({ title: 'Test', occasion: 'invalid' });
    const record = _collections.GiftRegistries[0];
    expect(record.occasion).toBe('other');
  });

  it('accepts all valid occasions', async () => {
    for (const occ of ['wedding', 'housewarming', 'dorm', 'baby', 'holiday', 'other']) {
      _collections = {};
      __seed('GiftRegistries', []);
      await createRegistry({ title: 'T', occasion: occ });
      expect(_collections.GiftRegistries[0].occasion).toBe(occ);
    }
  });

  it('enforces max 10 registries per member', async () => {
    __seed('GiftRegistries', Array.from({ length: 10 }, (_, i) => ({ _id: `r${i}`, memberId: 'member-abc' })));
    const result = await createRegistry({ title: 'One More' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await createRegistry({ title: 'Test' });
    expect(result.success).toBe(false);
  });

  it('coerces isPublic to boolean', async () => {
    __seed('GiftRegistries', []);
    await createRegistry({ title: 'Test', isPublic: 1 });
    expect(_collections.GiftRegistries[0].isPublic).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMyRegistries
// ═════════════════════════════════════════════════════════════════════
describe('getMyRegistries', () => {
  it('returns member registries with item counts', async () => {
    __seed('GiftRegistries', [
      { _id: 'r1', memberId: 'member-abc', title: 'Wedding', slug: 'wedding-123', occasion: 'wedding', isPublic: true, _createdDate: new Date() },
    ]);
    __seed('GiftRegistryItems', [
      { registryId: 'r1', productName: 'Futon' },
      { registryId: 'r1', productName: 'Cover' },
    ]);
    const result = await getMyRegistries();
    expect(result.success).toBe(true);
    expect(result.data.registries).toHaveLength(1);
    expect(result.data.registries[0].itemCount).toBe(2);
  });

  it('only returns own registries', async () => {
    __seed('GiftRegistries', [
      { _id: 'r1', memberId: 'member-abc', title: 'Mine', _createdDate: new Date() },
      { _id: 'r2', memberId: 'other', title: 'Theirs', _createdDate: new Date() },
    ]);
    __seed('GiftRegistryItems', []);
    const result = await getMyRegistries();
    expect(result.data.registries).toHaveLength(1);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getMyRegistries();
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getRegistry
// ═════════════════════════════════════════════════════════════════════
describe('getRegistry', () => {
  it('returns registry with items', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc', title: 'Wedding' }]);
    __seed('GiftRegistryItems', [
      { _id: 'i1', registryId: 'r1', productId: 'p1', productName: 'Futon', productPrice: 399, quantity: 2, purchasedQuantity: 1, priority: 1, notes: 'Walnut' },
    ]);
    const result = await getRegistry('r1');
    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].quantity).toBe(2);
    expect(result.data.items[0].purchasedQuantity).toBe(1);
  });

  it('rejects invalid registryId', async () => {
    const result = await getRegistry('');
    expect(result.success).toBe(false);
  });

  it('rejects registry owned by another member', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'other' }]);
    const result = await getRegistry('r1');
    expect(result.success).toBe(false);
  });

  it('defaults quantity to 1 and priority to 2', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', [{ _id: 'i1', registryId: 'r1', productName: 'Test' }]);
    const result = await getRegistry('r1');
    expect(result.data.items[0].quantity).toBe(1);
    expect(result.data.items[0].priority).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getPublicRegistry
// ═════════════════════════════════════════════════════════════════════
describe('getPublicRegistry', () => {
  it('returns public registry with remaining calculation', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', slug: 'wedding-abc', isPublic: true, title: 'Wedding', occasion: 'wedding', message: 'Hello!' }]);
    __seed('GiftRegistryItems', [
      { _id: 'i1', registryId: 'r1', productName: 'Futon', quantity: 3, purchasedQuantity: 1, priority: 1 },
    ]);
    const result = await getPublicRegistry('wedding-abc');
    expect(result.success).toBe(true);
    expect(result.data.items[0].remaining).toBe(2);
  });

  it('rejects empty slug', async () => {
    const result = await getPublicRegistry('');
    expect(result.success).toBe(false);
  });

  it('hides private registries', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', slug: 'private-reg', isPublic: false }]);
    const result = await getPublicRegistry('private-reg');
    expect(result.success).toBe(false);
  });

  it('returns not found for non-existent slug', async () => {
    __seed('GiftRegistries', []);
    const result = await getPublicRegistry('nonexistent');
    expect(result.success).toBe(false);
  });

  it('remaining never goes below 0', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', slug: 'test', isPublic: true }]);
    __seed('GiftRegistryItems', [
      { _id: 'i1', registryId: 'r1', productName: 'X', quantity: 1, purchasedQuantity: 5 },
    ]);
    const result = await getPublicRegistry('test');
    expect(result.data.items[0].remaining).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// addRegistryItem
// ═════════════════════════════════════════════════════════════════════
describe('addRegistryItem', () => {
  it('adds item to registry', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    const result = await addRegistryItem('r1', { productName: 'Futon Frame', productPrice: 399, quantity: 2, priority: 1 });
    expect(result.success).toBe(true);
    expect(result.data.productName).toBe('Futon Frame');
    expect(result.data.quantity).toBe(2);
  });

  it('requires productName', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    const result = await addRegistryItem('r1', { productPrice: 100 });
    expect(result.success).toBe(false);
  });

  it('clamps quantity to 1-10', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    await addRegistryItem('r1', { productName: 'X', quantity: 20 });
    expect(_collections.GiftRegistryItems[0].quantity).toBe(10);
  });

  it('defaults quantity to 1', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    await addRegistryItem('r1', { productName: 'X' });
    expect(_collections.GiftRegistryItems[0].quantity).toBe(1);
  });

  it('defaults priority to 2 for invalid values', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    await addRegistryItem('r1', { productName: 'X', priority: 5 });
    expect(_collections.GiftRegistryItems[0].priority).toBe(2);
  });

  it('accepts valid priorities 1, 2, 3', async () => {
    for (const p of [1, 2, 3]) {
      _collections = {};
      __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
      __seed('GiftRegistryItems', []);
      await addRegistryItem('r1', { productName: 'X', priority: p });
      expect(_collections.GiftRegistryItems[0].priority).toBe(p);
    }
  });

  it('enforces max 50 items per registry', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', Array.from({ length: 50 }, (_, i) => ({ _id: `i${i}`, registryId: 'r1' })));
    const result = await addRegistryItem('r1', { productName: 'One More' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('clamps negative productPrice to 0', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', []);
    await addRegistryItem('r1', { productName: 'X', productPrice: -50 });
    expect(_collections.GiftRegistryItems[0].productPrice).toBe(0);
  });

  it('rejects registry owned by another member', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'other' }]);
    __seed('GiftRegistryItems', []);
    const result = await addRegistryItem('r1', { productName: 'X' });
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// removeRegistryItem
// ═════════════════════════════════════════════════════════════════════
describe('removeRegistryItem', () => {
  it('removes item from registry', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', [{ _id: 'i1', registryId: 'r1' }]);
    const result = await removeRegistryItem('r1', 'i1');
    expect(result.success).toBe(true);
    expect(_collections.GiftRegistryItems).toHaveLength(0);
  });

  it('rejects invalid IDs', async () => {
    const result = await removeRegistryItem('', '');
    expect(result.success).toBe(false);
  });

  it('rejects item from wrong registry', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', [{ _id: 'i1', registryId: 'r2' }]);
    const result = await removeRegistryItem('r1', 'i1');
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// markItemPurchased
// ═════════════════════════════════════════════════════════════════════
describe('markItemPurchased', () => {
  it('marks item as purchased', async () => {
    __seed('GiftRegistryItems', [{ _id: 'i1', quantity: 3, purchasedQuantity: 0 }]);
    const result = await markItemPurchased('i1', { buyerName: 'Jane', quantity: 2 });
    expect(result.success).toBe(true);
    expect(result.data.purchasedQuantity).toBe(2);
    expect(result.data.remaining).toBe(1);
  });

  it('clamps purchase quantity to remaining', async () => {
    __seed('GiftRegistryItems', [{ _id: 'i1', quantity: 2, purchasedQuantity: 1 }]);
    const result = await markItemPurchased('i1', { quantity: 5 });
    expect(result.data.purchasedQuantity).toBe(1); // only 1 remaining
  });

  it('rejects when fully purchased', async () => {
    __seed('GiftRegistryItems', [{ _id: 'i1', quantity: 1, purchasedQuantity: 1 }]);
    const result = await markItemPurchased('i1', { quantity: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('fully purchased');
  });

  it('defaults buyerName to Anonymous', async () => {
    __seed('GiftRegistryItems', [{ _id: 'i1', quantity: 1, purchasedQuantity: 0 }]);
    await markItemPurchased('i1', {});
    const updated = _collections.GiftRegistryItems.find(i => i._id === 'i1');
    expect(updated.purchasedBy).toBe('Anonymous');
  });

  it('defaults purchase quantity to 1', async () => {
    __seed('GiftRegistryItems', [{ _id: 'i1', quantity: 5, purchasedQuantity: 0 }]);
    const result = await markItemPurchased('i1', {});
    expect(result.data.purchasedQuantity).toBe(1);
  });

  it('rejects invalid itemId', async () => {
    const result = await markItemPurchased('', {});
    expect(result.success).toBe(false);
  });

  it('rejects non-existent item', async () => {
    __seed('GiftRegistryItems', []);
    const result = await markItemPurchased('nonexistent', {});
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// deleteRegistry
// ═════════════════════════════════════════════════════════════════════
describe('deleteRegistry', () => {
  it('deletes registry and all items', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'member-abc' }]);
    __seed('GiftRegistryItems', [
      { _id: 'i1', registryId: 'r1' },
      { _id: 'i2', registryId: 'r1' },
    ]);
    const result = await deleteRegistry('r1');
    expect(result.success).toBe(true);
    expect(_collections.GiftRegistries).toHaveLength(0);
    expect(_collections.GiftRegistryItems).toHaveLength(0);
  });

  it('rejects invalid registryId', async () => {
    const result = await deleteRegistry('');
    expect(result.success).toBe(false);
  });

  it('rejects registry owned by another member', async () => {
    __seed('GiftRegistries', [{ _id: 'r1', memberId: 'other' }]);
    const result = await deleteRegistry('r1');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await deleteRegistry('r1');
    expect(result.success).toBe(false);
  });
});
