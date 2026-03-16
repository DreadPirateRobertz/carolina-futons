import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _products = [];
let _updatedFields = [];
vi.mock('wix-stores-backend', () => ({
  products: {
    queryProducts: () => ({
      skip: () => ({
        limit: () => ({
          find: async () => ({ items: _products }),
        }),
      }),
    }),
    getProduct: async (id) => _products.find(p => p._id === id) || null,
    updateProductFields: vi.fn(async (id, fields) => {
      _updatedFields.push({ id, fields });
    }),
  },
}));

let mod;
beforeEach(async () => {
  _products = [];
  _updatedFields = [];
  vi.resetModules();
  mod = await import('../src/backend/batchAltText.web.js');
});

// ── runBatchAltTextUpdate ────────────────────────────────────────

describe('runBatchAltTextUpdate', () => {
  it('skips products with no media', async () => {
    _products = [{ _id: 'p1', name: 'Futon', mediaItems: [], collections: [] }];
    const r = await mod.runBatchAltTextUpdate();
    expect(r.skipped).toBe(1);
    expect(r.updated).toBe(0);
  });

  it('generates alt text for products', async () => {
    _products = [{
      _id: 'p1', name: 'Classic Frame', collections: ['futon-frames'],
      mediaItems: [{ src: 'https://cdn.com/img.jpg' }],
    }];
    const r = await mod.runBatchAltTextUpdate();
    expect(r.updated).toBe(1);
    expect(_updatedFields).toHaveLength(1);
    expect(_updatedFields[0].fields.mediaItems[0].altText).toContain('Classic Frame');
  });

  it('skips media with existing alt text (no force)', async () => {
    _products = [{
      _id: 'p1', name: 'Futon', collections: [],
      mediaItems: [{ src: 'img.jpg', title: 'Existing good alt text that is long enough' }],
    }];
    const r = await mod.runBatchAltTextUpdate({ force: false });
    expect(r.skipped).toBe(1);
  });

  it('overwrites with force option', async () => {
    _products = [{
      _id: 'p1', name: 'Futon', collections: [],
      mediaItems: [{ src: 'img.jpg', title: 'Existing good alt text that is long enough' }],
    }];
    const r = await mod.runBatchAltTextUpdate({ force: true });
    expect(r.updated).toBe(1);
  });

  it('dry run does not write', async () => {
    _products = [{
      _id: 'p1', name: 'Futon', collections: ['futon-frames'],
      mediaItems: [{ src: 'img.jpg' }],
    }];
    const r = await mod.runBatchAltTextUpdate({ dryRun: true });
    expect(r.updated).toBe(1);
    expect(r.previews).toHaveLength(1);
    expect(_updatedFields).toHaveLength(0);
  });

  it('detects brand from collections', async () => {
    _products = [{
      _id: 'p1', name: 'Frame', collections: ['wall-hugger-frames'],
      mediaItems: [{ src: 'img.jpg' }],
    }];
    const r = await mod.runBatchAltTextUpdate({ dryRun: true });
    expect(r.previews[0].alts[0]).toContain('Strata Furniture');
  });

  it('detects image context from URL', async () => {
    _products = [{
      _id: 'p1', name: 'Futon', collections: [],
      mediaItems: [{ src: 'https://cdn.com/lifestyle-room-scene.jpg' }],
    }];
    const r = await mod.runBatchAltTextUpdate({ dryRun: true });
    expect(r.previews[0].alts[0]).toContain('Lifestyle Room Setting');
  });
});

// ── previewProductAltText ────────────────────────────────────────

describe('previewProductAltText', () => {
  it('returns error for missing product', async () => {
    const r = await mod.previewProductAltText('nonexistent');
    expect(r.error).toBeTruthy();
  });

  it('returns alt text preview', async () => {
    _products = [{
      _id: 'p1', name: 'Classic Frame', collections: ['futon-frames'],
      mediaItems: [
        { src: 'https://cdn.com/main.jpg' },
        { src: 'https://cdn.com/detail-closeup.jpg' },
      ],
    }];
    const r = await mod.previewProductAltText('p1');
    expect(r.name).toBe('Classic Frame');
    expect(r.brand).toBe('Night & Day Furniture');
    expect(r.category).toBe('Futon Frame');
    expect(r.media).toHaveLength(2);
    expect(r.media[0].newAlt).toContain('Main Product Image');
    expect(r.media[1].newAlt).toContain('Detail Close-up');
  });
});
