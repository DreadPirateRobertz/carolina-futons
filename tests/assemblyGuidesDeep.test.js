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
    ascending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      return { items };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/assemblyGuides.web.js');
});

describe('getAssemblyGuide', () => {
  it('returns null for empty sku', async () => {
    const r = await mod.getAssemblyGuide('');
    expect(r).toBeNull();
  });

  it('returns null for unknown sku', async () => {
    __seed('AssemblyGuides', []);
    const r = await mod.getAssemblyGuide('UNKNOWN-SKU');
    expect(r).toBeNull();
  });

  it('returns guide for known sku', async () => {
    __seed('AssemblyGuides', [{
      _id: 'g1', sku: 'FRM-001', title: 'Futon Frame Assembly',
      pdfUrl: 'https://cdn.com/guide.pdf', videoUrl: 'https://youtube.com/watch?v=abc',
      estimatedTime: '30 minutes', steps: 'Step 1...', tips: 'Use a Phillips head',
      category: 'futon-frames',
    }]);
    const r = await mod.getAssemblyGuide('FRM-001');
    expect(r).not.toBeNull();
    expect(r.title).toBe('Futon Frame Assembly');
    expect(r.pdfUrl).toBe('https://cdn.com/guide.pdf');
    expect(r.estimatedTime).toBe('30 minutes');
  });
});

describe('getCareTips', () => {
  it('returns default tips for null category', async () => {
    const r = await mod.getCareTips(null);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].title).toBe('General Care');
  });

  it('returns futon frame tips', async () => {
    const r = await mod.getCareTips('futon-frames');
    expect(r.length).toBe(4);
    expect(r[0].title).toBe('Wood Care');
  });

  it('returns mattress tips', async () => {
    const r = await mod.getCareTips('mattresses');
    expect(r.length).toBe(4);
    expect(r[0].title).toBe('Rotation');
  });

  it('returns murphy bed tips', async () => {
    const r = await mod.getCareTips('murphy-cabinet-beds');
    expect(r.length).toBe(3);
    expect(r[0].title).toBe('Mechanism');
  });

  it('returns default for unknown category', async () => {
    const r = await mod.getCareTips('unknown-cat');
    expect(r[0].title).toBe('General Care');
  });
});

describe('listAssemblyGuides', () => {
  it('returns empty for no guides', async () => {
    __seed('AssemblyGuides', []);
    const r = await mod.listAssemblyGuides();
    expect(r).toEqual([]);
  });

  it('returns mapped guide list', async () => {
    __seed('AssemblyGuides', [
      { _id: 'g1', sku: 'FRM-001', title: 'Frame Guide', category: 'futon-frames', estimatedTime: '30 min', pdfUrl: 'pdf.pdf', videoUrl: '' },
      { _id: 'g2', sku: 'MAT-001', title: 'Mattress Guide', category: 'mattresses', estimatedTime: '10 min', pdfUrl: '', videoUrl: 'vid.mp4' },
    ]);
    const r = await mod.listAssemblyGuides();
    expect(r).toHaveLength(2);
    expect(r[0].hasPdf).toBe(true);
    expect(r[0].hasVideo).toBe(false);
    expect(r[1].hasPdf).toBe(false);
    expect(r[1].hasVideo).toBe(true);
  });
});
