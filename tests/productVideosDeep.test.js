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

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    contains: (field, val) => { filters[`${field}_contains`] = { type: 'contains', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'contains') items = items.filter(i => {
          const val = i[f.field];
          return typeof val === 'string' && val.includes(f.value);
        });
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
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
  vi.resetModules();
  mod = await import('../src/backend/productVideos.web.js');
});

// ── getProductVideos ─────────────────────────────────────────────

describe('getProductVideos', () => {
  it('rejects empty slug', async () => {
    const r = await mod.getProductVideos('');
    expect(r.success).toBe(false);
  });

  it('returns matching videos for slug', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'Assembly', brand: 'KD', type: 'assembly', productSlugs: '["classic-futon","other"]', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
      { videoId: 'v2', title: 'Demo', brand: 'KD', type: 'demo', productSlugs: '["other-futon"]', youtubeUrl: 'https://youtube.com/watch?v=def12345678' },
    ]);
    const r = await mod.getProductVideos('classic-futon');
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].videoId).toBe('v1');
    expect(r.data[0].youtubeId).toBe('abc12345678');
    expect(r.data[0].embedUrl).toContain('youtube.com/embed/abc12345678');
  });

  it('generates thumbnail from YouTube ID', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'Test', brand: 'KD', type: 'demo', productSlugs: '["test-futon"]', youtubeUrl: 'https://youtu.be/xyz12345678' },
    ]);
    const r = await mod.getProductVideos('test-futon');
    expect(r.data[0].thumbnailUrl).toContain('img.youtube.com/vi/xyz12345678');
  });
});

// ── getCategoryVideos ────────────────────────────────────────────

describe('getCategoryVideos', () => {
  it('rejects empty category', async () => {
    const r = await mod.getCategoryVideos('');
    expect(r.success).toBe(false);
  });

  it('rejects unknown category', async () => {
    const r = await mod.getCategoryVideos('unknown-cat');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Unknown category');
  });

  it('returns videos for valid category', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'Frame Assembly', brand: 'KD', type: 'assembly', category: 'futon-frames', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
      { videoId: 'v2', title: 'Cover Demo', brand: 'KD', type: 'demo', category: 'covers', youtubeUrl: 'https://youtube.com/watch?v=def12345678' },
    ]);
    const r = await mod.getCategoryVideos('futon-frames');
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].videoId).toBe('v1');
  });
});

// ── getBrandVideos ───────────────────────────────────────────────

describe('getBrandVideos', () => {
  it('rejects empty brand', async () => {
    const r = await mod.getBrandVideos('');
    expect(r.success).toBe(false);
  });

  it('returns videos for brand', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'KD Demo', brand: 'KD Frames', type: 'demo', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
      { videoId: 'v2', title: 'Night Day', brand: 'Night & Day', type: 'demo', youtubeUrl: 'https://youtube.com/watch?v=def12345678' },
    ]);
    const r = await mod.getBrandVideos('KD Frames');
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].brand).toBe('KD Frames');
  });
});

// ── getAssemblyVideo ─────────────────────────────────────────────

describe('getAssemblyVideo', () => {
  it('rejects empty slug', async () => {
    const r = await mod.getAssemblyVideo('');
    expect(r.success).toBe(false);
  });

  it('returns null when no assembly video', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', type: 'demo', productSlugs: '["test-futon"]', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
    ]);
    const r = await mod.getAssemblyVideo('test-futon');
    expect(r.success).toBe(true);
    expect(r.data).toBeNull();
  });

  it('returns assembly video for matching slug', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'Assembly', type: 'assembly', productSlugs: '["classic-futon"]', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
    ]);
    const r = await mod.getAssemblyVideo('classic-futon');
    expect(r.success).toBe(true);
    expect(r.data.videoId).toBe('v1');
    expect(r.data.type).toBe('assembly');
  });
});

// ── saveVideo ────────────────────────────────────────────────────

describe('saveVideo', () => {
  it('rejects null video', async () => {
    const r = await mod.saveVideo(null);
    expect(r.success).toBe(false);
  });

  it('rejects missing title', async () => {
    const r = await mod.saveVideo({ brand: 'KD', type: 'demo', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('title');
  });

  it('rejects invalid type', async () => {
    const r = await mod.saveVideo({ title: 'Test', brand: 'KD', type: 'invalid', youtubeUrl: 'url' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('type');
  });

  it('rejects missing both URLs', async () => {
    const r = await mod.saveVideo({ title: 'Test', brand: 'KD', type: 'demo' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('youtubeUrl or mp4Url');
  });

  it('saves new video', async () => {
    __seed('ProductVideos', []);
    const r = await mod.saveVideo({
      title: 'Assembly Guide', brand: 'KD Frames', type: 'assembly',
      youtubeUrl: 'https://youtube.com/watch?v=abc12345678',
      productSlugs: ['classic-futon'],
    });
    expect(r.success).toBe(true);
    expect(r.data.title).toBe('Assembly Guide');
    expect(r.data.youtubeId).toBe('abc12345678');
    expect(_collections['ProductVideos']).toHaveLength(1);
  });

  it('updates existing video', async () => {
    __seed('ProductVideos', [{ _id: 'v1', videoId: 'v1', title: 'Old', brand: 'KD', type: 'demo' }]);
    const r = await mod.saveVideo({
      _id: 'v1', title: 'Updated', brand: 'KD', type: 'demo',
      youtubeUrl: 'https://youtube.com/watch?v=abc12345678',
    });
    expect(r.success).toBe(true);
    expect(r.data.title).toBe('Updated');
  });
});

// ── getAllVideos ──────────────────────────────────────────────────

describe('getAllVideos', () => {
  it('returns empty for no videos', async () => {
    __seed('ProductVideos', []);
    const r = await mod.getAllVideos();
    expect(r.success).toBe(true);
    expect(r.data.videos).toEqual([]);
  });

  it('returns paginated videos', async () => {
    __seed('ProductVideos', [
      { videoId: 'v1', title: 'Video 1', brand: 'KD', type: 'demo', youtubeUrl: 'https://youtube.com/watch?v=abc12345678' },
      { videoId: 'v2', title: 'Video 2', brand: 'KD', type: 'assembly', youtubeUrl: 'https://youtube.com/watch?v=def12345678' },
    ]);
    const r = await mod.getAllVideos(0, 50);
    expect(r.data.videos).toHaveLength(2);
    expect(r.data.page).toBe(0);
  });

  it('caps pageSize at 100', async () => {
    __seed('ProductVideos', []);
    const r = await mod.getAllVideos(0, 200);
    expect(r.success).toBe(true);
    expect(r.data.pageSize).toBe(100);
  });
});
