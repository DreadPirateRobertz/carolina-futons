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
  // Stub — real isWixMediaUrl is exhaustively tested in ugcUploadHardening.test.js
  isWixMediaUrl: vi.fn(() => true),
}));

let _mockMember = { _id: 'member1', contactDetails: { firstName: 'TestUser' } };
let _mockRoles = [{ title: 'Admin', _id: 'admin' }];

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
    getRoles: async () => _mockRoles,
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
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ne: (field, val) => { filters[`${field}_ne`] = { type: 'ne', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        const fld = f.field || key;
        if (f.type === 'eq') items = items.filter(i => i[fld] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => {
          if (Array.isArray(i[f.field])) return i[f.field].some(v => f.value.includes(v));
          return f.value.includes(i[f.field]);
        });
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        const fld = f.field || key;
        if (f.type === 'eq') items = items.filter(i => i[fld] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => {
          if (Array.isArray(i[f.field])) return i[f.field].some(v => f.value.includes(v));
          return f.value.includes(i[f.field]);
        });
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
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
    remove: async (collection, id) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === id);
      if (idx >= 0) col.splice(idx, 1);
      return { _id: id };
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1', contactDetails: { firstName: 'TestUser' } };
  _mockRoles = [{ title: 'Admin', _id: 'admin' }];
  vi.resetModules();
  mod = await import('../src/backend/ugcService.web.js');
});

// ── submitUGCPhoto ────────────────────────────────────────────────

describe('submitUGCPhoto', () => {
  it('rejects null data', async () => {
    const r = await mod.submitUGCPhoto(null);
    expect(r.success).toBe(false);
    expect(r.error).toContain('data is required');
  });

  it('rejects non-object data', async () => {
    const r = await mod.submitUGCPhoto('string');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Authentication');
  });

  it('rejects missing photoUrl', async () => {
    const r = await mod.submitUGCPhoto({ roomType: 'bedroom' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Photo URL');
  });

  it('rejects invalid roomType', async () => {
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'garage' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid room type');
  });

  it('accepts all valid room types', async () => {
    for (const rt of ['living-room', 'bedroom', 'office', 'dorm', 'porch']) {
      _collections = {};
      const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: rt });
      expect(r.success).toBe(true);
    }
  });

  it('inserts record with correct defaults', async () => {
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom', caption: 'Nice' });
    expect(r.success).toBe(true);
    expect(r.data.memberId).toBe('member1');
    expect(r.data.status).toBe('pending');
    expect(r.data.voteCount).toBe(0);
    expect(r.data.reportCount).toBe(0);
    expect(r.data.caption).toBe('Nice');
  });

  it('sanitizes caption to 300 chars', async () => {
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom', caption: 'A'.repeat(500) });
    expect(r.data.caption.length).toBe(300);
  });

  it('sets optional fields to null when not provided', async () => {
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'office' });
    expect(r.data.productId).toBeNull();
    expect(r.data.productName).toBeNull();
    expect(r.data.socialSource).toBeNull();
    expect(r.data.socialPostUrl).toBeNull();
    expect(r.data.beforeAfterId).toBeNull();
    expect(r.data.beforeAfterType).toBeNull();
  });

  it('sets optional fields when provided', async () => {
    const r = await mod.submitUGCPhoto({
      photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'dorm',
      productId: 'p1', productName: 'Futon', tags: ['cozy'],
      socialSource: 'instagram', socialPostUrl: 'https://ig.com/post',
      beforeAfterId: 'pair1', beforeAfterType: 'before',
    });
    expect(r.data.productId).toBe('p1');
    expect(r.data.tags).toEqual(['cozy']);
    expect(r.data.socialSource).toBe('instagram');
    expect(r.data.beforeAfterId).toBe('pair1');
    expect(r.data.beforeAfterType).toBe('before');
  });

  it('defaults tags to empty array when not an array', async () => {
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom', tags: 'not-array' });
    expect(r.data.tags).toEqual([]);
  });

  it('uses member firstName as displayName', async () => {
    _mockMember = { _id: 'm2', contactDetails: { firstName: 'Alice' } };
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom' });
    expect(r.data.memberDisplayName).toBe('Alice');
  });

  it('defaults displayName when contactDetails missing', async () => {
    _mockMember = { _id: 'm2' };
    const r = await mod.submitUGCPhoto({ photoUrl: 'wix:image://v1/test/img.jpg', roomType: 'bedroom' });
    expect(r.data.memberDisplayName).toBe('');
  });
});

// ── getApprovedPhotos ─────────────────────────────────────────────

describe('getApprovedPhotos', () => {
  it('returns only approved and featured photos', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'bedroom', submittedAt: '2025-01-01' },
      { _id: 'p2', status: 'featured', roomType: 'office', submittedAt: '2025-02-01' },
      { _id: 'p3', status: 'pending', roomType: 'dorm', submittedAt: '2025-03-01' },
      { _id: 'p4', status: 'rejected', roomType: 'porch', submittedAt: '2025-04-01' },
    ]);
    const r = await mod.getApprovedPhotos();
    expect(r.success).toBe(true);
    expect(r.photos).toHaveLength(2);
  });

  it('filters by roomType', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'bedroom' },
      { _id: 'p2', status: 'approved', roomType: 'office' },
    ]);
    const r = await mod.getApprovedPhotos({ roomType: 'bedroom' });
    expect(r.photos).toHaveLength(1);
    expect(r.photos[0]._id).toBe('p1');
  });

  it('clamps limit to 1-50', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      _id: `p${i}`, status: 'approved', roomType: 'bedroom',
    }));
    __seed('UGCPhotos', items);
    const r = await mod.getApprovedPhotos({ limit: 100 });
    expect(r.photos.length).toBe(50);
  });

  it('defaults limit to 20', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      _id: `p${i}`, status: 'approved', roomType: 'bedroom',
    }));
    __seed('UGCPhotos', items);
    const r = await mod.getApprovedPhotos();
    expect(r.photos.length).toBe(20);
  });

  it('handles null opts', async () => {
    __seed('UGCPhotos', []);
    const r = await mod.getApprovedPhotos(null);
    expect(r.success).toBe(true);
    expect(r.photos).toEqual([]);
  });
});

// ── getBeforeAfterPairs ───────────────────────────────────────────

describe('getBeforeAfterPairs', () => {
  it('returns complete before/after pairs', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'before', roomType: 'bedroom' },
      { _id: 'p2', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'after', roomType: 'bedroom' },
    ]);
    const r = await mod.getBeforeAfterPairs();
    expect(r.success).toBe(true);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0].pairId).toBe('pair1');
    expect(r.pairs[0].before._id).toBe('p1');
    expect(r.pairs[0].after._id).toBe('p2');
  });

  it('excludes incomplete pairs (only before)', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'before', roomType: 'bedroom' },
    ]);
    const r = await mod.getBeforeAfterPairs();
    expect(r.pairs).toHaveLength(0);
  });

  it('excludes items without beforeAfterId', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', beforeAfterId: null, beforeAfterType: 'before', roomType: 'bedroom' },
    ]);
    const r = await mod.getBeforeAfterPairs();
    expect(r.pairs).toHaveLength(0);
  });

  it('filters by roomType', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'before', roomType: 'bedroom' },
      { _id: 'p2', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'after', roomType: 'bedroom' },
      { _id: 'p3', status: 'approved', beforeAfterId: 'pair2', beforeAfterType: 'before', roomType: 'office' },
      { _id: 'p4', status: 'approved', beforeAfterId: 'pair2', beforeAfterType: 'after', roomType: 'office' },
    ]);
    const r = await mod.getBeforeAfterPairs({ roomType: 'bedroom' });
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0].pairId).toBe('pair1');
  });

  it('excludes non-approved/featured photos', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'pending', beforeAfterId: 'pair1', beforeAfterType: 'before', roomType: 'bedroom' },
      { _id: 'p2', status: 'approved', beforeAfterId: 'pair1', beforeAfterType: 'after', roomType: 'bedroom' },
    ]);
    const r = await mod.getBeforeAfterPairs();
    expect(r.pairs).toHaveLength(0);
  });
});

// ── voteForPhoto ──────────────────────────────────────────────────

describe('voteForPhoto', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.voteForPhoto('photo1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Authentication');
  });

  it('rejects invalid photoId', async () => {
    const r = await mod.voteForPhoto(null);
    expect(r.success).toBe(false);
    expect(r.error).toContain('Valid photo ID');
  });

  it('rejects non-existent photo', async () => {
    __seed('UGCPhotos', []);
    __seed('UGCVotes', []);
    const r = await mod.voteForPhoto('nonexistent');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('adds vote (toggle on)', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', voteCount: 5 }]);
    __seed('UGCVotes', []);
    const r = await mod.voteForPhoto('photo1');
    expect(r.success).toBe(true);
    expect(r.voted).toBe(true);
    expect(r.voteCount).toBe(6);
  });

  it('removes vote (toggle off)', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', voteCount: 5 }]);
    __seed('UGCVotes', [{ _id: 'v1', memberId: 'member1', photoId: 'photo1' }]);
    const r = await mod.voteForPhoto('photo1');
    expect(r.success).toBe(true);
    expect(r.voted).toBe(false);
    expect(r.voteCount).toBe(4);
  });

  it('handles voteCount starting at 0 (undefined)', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1' }]);
    __seed('UGCVotes', []);
    const r = await mod.voteForPhoto('photo1');
    expect(r.voteCount).toBe(1);
  });

  it('treats duplicate insert (concurrent TOCTOU) as success with voted:true', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', voteCount: 3 }]);
    __seed('UGCVotes', []);
    const wixData = await import('wix-data');
    vi.spyOn(wixData.default, 'insert').mockRejectedValueOnce(new Error('duplicate key constraint'));
    const r = await mod.voteForPhoto('photo1');
    expect(r.success).toBe(true);
    expect(r.voted).toBe(true);
    expect(r.voteCount).toBe(3);
  });
});

// ── reportPhoto ───────────────────────────────────────────────────

describe('reportPhoto', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.reportPhoto('photo1', 'spam');
    expect(r.success).toBe(false);
  });

  it('rejects invalid photoId', async () => {
    const r = await mod.reportPhoto(null, 'spam');
    expect(r.success).toBe(false);
  });

  it('rejects empty reason', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1' }]);
    const r = await mod.reportPhoto('photo1', '');
    expect(r.success).toBe(false);
    expect(r.error).toContain('reason');
  });

  it('rejects non-existent photo', async () => {
    __seed('UGCPhotos', []);
    const r = await mod.reportPhoto('missing', 'spam');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('increments reportCount', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', reportCount: 2 }]);
    const r = await mod.reportPhoto('photo1', 'inappropriate');
    expect(r.success).toBe(true);
    expect(_collections['UGCPhotos'][0].reportCount).toBe(3);
  });

  it('handles missing reportCount (defaults to 0)', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1' }]);
    const r = await mod.reportPhoto('photo1', 'spam');
    expect(r.success).toBe(true);
    expect(_collections['UGCPhotos'][0].reportCount).toBe(1);
  });
});

// ── moderatePhoto ─────────────────────────────────────────────────

describe('moderatePhoto', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.moderatePhoto('photo1', 'approve');
    expect(r.success).toBe(false);
  });

  it('rejects non-admin user', async () => {
    _mockRoles = [{ title: 'Member', _id: 'member' }];
    __seed('UGCPhotos', [{ _id: 'photo1', status: 'pending' }]);
    const r = await mod.moderatePhoto('photo1', 'approve');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Admin');
  });

  it('rejects invalid photoId', async () => {
    const r = await mod.moderatePhoto(null, 'approve');
    expect(r.success).toBe(false);
  });

  it('rejects invalid action', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', status: 'pending' }]);
    const r = await mod.moderatePhoto('photo1', 'delete');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid action');
  });

  it('rejects non-existent photo', async () => {
    __seed('UGCPhotos', []);
    const r = await mod.moderatePhoto('missing', 'approve');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('approves photo — sets status to approved', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', status: 'pending' }]);
    const r = await mod.moderatePhoto('photo1', 'approve');
    expect(r.success).toBe(true);
    expect(_collections['UGCPhotos'][0].status).toBe('approved');
    expect(_collections['UGCPhotos'][0].moderatedAt).toBeTruthy();
  });

  it('rejects photo — sets status to rejected', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', status: 'pending' }]);
    const r = await mod.moderatePhoto('photo1', 'reject');
    expect(r.success).toBe(true);
    expect(_collections['UGCPhotos'][0].status).toBe('rejected');
  });

  it('features photo — sets status to featured', async () => {
    __seed('UGCPhotos', [{ _id: 'photo1', status: 'approved' }]);
    const r = await mod.moderatePhoto('photo1', 'feature');
    expect(r.success).toBe(true);
    expect(_collections['UGCPhotos'][0].status).toBe('featured');
  });
});

// ── getUGCStats ───────────────────────────────────────────────────

describe('getUGCStats', () => {
  it('returns zeros when no photos', async () => {
    __seed('UGCPhotos', []);
    const r = await mod.getUGCStats();
    expect(r.success).toBe(true);
    expect(r.stats.total).toBe(0);
    expect(r.stats.featured).toBe(0);
    expect(r.stats.byRoomType).toEqual({});
  });

  it('counts only approved and featured', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'bedroom' },
      { _id: 'p2', status: 'featured', roomType: 'office' },
      { _id: 'p3', status: 'pending', roomType: 'dorm' },
      { _id: 'p4', status: 'rejected', roomType: 'porch' },
    ]);
    const r = await mod.getUGCStats();
    expect(r.stats.total).toBe(2);
    expect(r.stats.featured).toBe(1);
  });

  it('breaks down by roomType', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'bedroom' },
      { _id: 'p2', status: 'approved', roomType: 'bedroom' },
      { _id: 'p3', status: 'featured', roomType: 'office' },
    ]);
    const r = await mod.getUGCStats();
    expect(r.stats.byRoomType.bedroom).toBe(2);
    expect(r.stats.byRoomType.office).toBe(1);
  });

  it('skips photos without roomType in breakdown', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved' },
    ]);
    const r = await mod.getUGCStats();
    expect(r.stats.total).toBe(1);
    expect(r.stats.byRoomType).toEqual({});
  });
});
