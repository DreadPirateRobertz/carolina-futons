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

let _products = [];

vi.mock('wix-data', () => {
  function buildQuery() {
    let _limit = 1000;
    let _skip = 0;
    const chain = {
      limit: (n) => { _limit = n; return chain; },
      skip: (n) => { _skip = n; return chain; },
      find: async () => {
        const items = _products.slice(_skip, _skip + _limit);
        return { items };
      },
    };
    return chain;
  }
  return {
    default: { query: () => buildQuery() },
  };
});

let mod;
beforeEach(async () => {
  _products = [];
  vi.resetModules();
  mod = await import('../src/backend/pinterestCatalogSync.web.js');
});

describe('validateCatalogProduct', () => {
  it('rejects null product', async () => {
    const r = await mod.validateCatalogProduct(null);
    expect(r.valid).toBe(false);
  });

  it('reports missing required fields', async () => {
    const r = await mod.validateCatalogProduct({ name: '', slug: '', price: 0 });
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('validates good product', async () => {
    const r = await mod.validateCatalogProduct({ name: 'Futon Frame', slug: 'futon-frame', price: 499, description: 'A great frame' });
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('warns on missing description', async () => {
    const r = await mod.validateCatalogProduct({ name: 'Futon', slug: 'futon', price: 499 });
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.field === 'description')).toBe(true);
  });

  it('warns on missing image', async () => {
    const r = await mod.validateCatalogProduct({ name: 'Futon', slug: 'futon', price: 499, description: 'desc' });
    expect(r.warnings.some(w => w.field === 'mainMedia')).toBe(true);
  });
});

describe('mapProductToBoard', () => {
  it('rejects null product', async () => {
    const r = await mod.mapProductToBoard(null);
    expect(r.success).toBe(false);
  });

  it('maps murphy bed to Murphy board', async () => {
    const r = await mod.mapProductToBoard({ collections: ['murphy-cabinet-beds'] });
    expect(r.board).toBe('Murphy & Cabinet Beds');
  });

  it('maps platform bed', async () => {
    const r = await mod.mapProductToBoard({ collections: ['platform-beds'] });
    expect(r.board).toBe('Platform Bed Inspiration');
  });

  it('maps futon to Futon Living Rooms', async () => {
    const r = await mod.mapProductToBoard({ collections: ['futon-frames'] });
    expect(r.board).toBe('Futon Living Rooms');
  });

  it('maps unfinished wood', async () => {
    const r = await mod.mapProductToBoard({ collections: ['unfinished-wood'] });
    expect(r.board).toBe('Handcrafted & Unfinished');
  });

  it('defaults to Futon Living Rooms for unknown', async () => {
    const r = await mod.mapProductToBoard({ collections: ['unknown-category'] });
    expect(r.board).toBe('Futon Living Rooms');
  });

  it('maps sale item with discountedPrice', async () => {
    const r = await mod.mapProductToBoard({ collections: ['sales'], discountedPrice: 399 });
    expect(r.board).toBe('Sale & Clearance');
  });
});

describe('generatePinContent', () => {
  it('rejects null product', async () => {
    const r = await mod.generatePinContent(null);
    expect(r.success).toBe(false);
  });

  it('generates title, description, hashtags, link', async () => {
    const r = await mod.generatePinContent({
      name: 'Classic Futon Frame', slug: 'classic-futon-frame', price: 499,
      description: 'A beautiful solid wood frame', collections: ['futon-frames'],
    });
    expect(r.success).toBe(true);
    expect(r.title).toBe('Classic Futon Frame');
    expect(r.description).toContain('$499.00');
    expect(r.description).toContain('Carolina Futons');
    expect(r.hashtags).toContain('#CarolinaFutons');
    expect(r.hashtags).toContain('#FutonFrame');
    expect(r.link).toContain('utm_source=pinterest');
    expect(r.link).toContain('classic-futon-frame');
  });

  it('shows sale price when discounted', async () => {
    const r = await mod.generatePinContent({
      name: 'Frame', slug: 'frame', price: 499, discountedPrice: 399,
    });
    expect(r.description).toContain('$399.00');
    expect(r.description).toContain('was $499.00');
  });

  it('uses site URL when no slug', async () => {
    const r = await mod.generatePinContent({ name: 'Frame', price: 100 });
    expect(r.link).not.toContain('/product-page/');
  });
});

describe('getBoardStructure', () => {
  it('returns all boards', async () => {
    const r = await mod.getBoardStructure();
    expect(r.success).toBe(true);
    expect(r.boards.length).toBe(7);
    expect(r.boards[0].name).toBe('Futon Living Rooms');
  });
});

describe('auditCatalog', () => {
  it('returns zeros for empty catalog', async () => {
    _products = [];
    const r = await mod.auditCatalog();
    expect(r.success).toBe(true);
    expect(r.totalProducts).toBe(0);
    expect(r.validCount).toBe(0);
  });

  it('counts valid and invalid products', async () => {
    _products = [
      { _id: 'p1', name: 'Valid', slug: 'valid', price: 499 },
      { _id: 'p2', name: '', slug: '', price: 0 },
    ];
    const r = await mod.auditCatalog();
    expect(r.totalProducts).toBe(2);
    expect(r.validCount).toBe(1);
    expect(r.invalidCount).toBe(1);
  });
});
