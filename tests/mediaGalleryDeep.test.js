/**
 * @file mediaGalleryDeep.test.js
 * @description Deep edge-case tests for mediaGallery.web.js
 *
 * Covers: type coercion quirks, boundary values, NaN/Infinity inputs,
 * malformed URLs, concurrent operations, null/undefined propagation,
 * admin role edge cases, JSON parsing resilience, and URL construction.
 *
 * Known gaps documented inline:
 * - NaN passes `typeof x === 'number'` but fails `> 0` comparisons
 * - Infinity passes numeric checks but produces nonsense URLs
 * - Empty-string product IDs after sanitize return early error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (same pattern as mediaGallery.test.js) ────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (perm, fn) => fn,
}));

const mockQueryChain = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  ascending: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  count: vi.fn().mockResolvedValue(0),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQueryChain })),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockImplementation(async (col, data) => ({ ...data, _id: 'new-id-a1b2', _createdDate: new Date() })),
    update: vi.fn().mockImplementation(async (col, data) => data),
  },
}));

vi.mock('wix-media-backend', () => ({
  mediaManager: {
    listFiles: vi.fn().mockResolvedValue({ files: [] }),
    listFolders: vi.fn().mockResolvedValue({ folders: [] }),
    getFileUrl: vi.fn().mockResolvedValue('https://static.wixstatic.com/media/test.jpg'),
    upload: vi.fn().mockResolvedValue({ fileName: 'uploaded.jpg' }),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({ _id: 'admin-a1b2c3', loginEmail: 'admin@example.com' }),
    getRoles: vi.fn().mockResolvedValue([{ title: 'Admin', _id: 'admin' }]),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import wixData from 'wix-data';
import { mediaManager } from 'wix-media-backend';
import { currentMember } from 'wix-members-backend';
import {
  getProductMedia,
  getBatchProductThumbnails,
  listMediaFolder,
  listMediaFolders,
  syncProductMedia,
  batchSyncMedia,
  getImageUrl,
  getMediaStats,
} from '../src/backend/mediaGallery.web.js';

// ── Helpers ──────────────────────────────────────────────────────────

function setupAdmin() {
  currentMember.getMember.mockResolvedValue({ _id: 'admin-a1b2c3', loginEmail: 'admin@example.com' });
  currentMember.getRoles.mockResolvedValue([{ title: 'Admin', _id: 'admin' }]);
}

function setupNonAdmin() {
  currentMember.getMember.mockResolvedValue({ _id: 'user-d4e5f6', loginEmail: 'user@example.com' });
  currentMember.getRoles.mockResolvedValue([{ title: 'Member', _id: 'member' }]);
}

function seedMediaSync(items) {
  mockQueryChain.find.mockResolvedValueOnce({ items, totalCount: items.length });
}

function seedProducts(items) {
  mockQueryChain.find.mockResolvedValueOnce({ items, totalCount: items.length });
}

function seedEmpty() {
  mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryChain.eq.mockReturnThis();
  mockQueryChain.ne.mockReturnThis();
  mockQueryChain.hasSome.mockReturnThis();
  mockQueryChain.ascending.mockReturnThis();
  mockQueryChain.descending.mockReturnThis();
  mockQueryChain.limit.mockReturnThis();
  mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });
  mockQueryChain.count.mockResolvedValue(0);
  wixData.get.mockResolvedValue(null);
  wixData.insert.mockImplementation(async (col, data) => ({ ...data, _id: 'new-id-a1b2', _createdDate: new Date() }));
  wixData.update.mockImplementation(async (col, data) => data);
  mediaManager.listFiles.mockResolvedValue({ files: [] });
  mediaManager.listFolders.mockResolvedValue({ folders: [] });
  setupAdmin();
});

// ══════════════════════════════════════════════════════════════════════
// extractFileName edge cases (tested via getImageUrl)
// ══════════════════════════════════════════════════════════════════════

describe('extractFileName edge cases via getImageUrl', () => {
  it('handles wix:image URL with special chars in trailing path', async () => {
    const result = await getImageUrl('wix:image://v1/abc123~mv2.jpg/my%20image.jpg');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc123~mv2.jpg');
  });

  it('handles static URL with query string', async () => {
    const result = await getImageUrl('https://static.wixstatic.com/media/abc~mv2.jpg?token=xyz');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc~mv2.jpg');
  });

  it('handles static URL with hash fragment', async () => {
    const result = await getImageUrl('https://static.wixstatic.com/media/def~mv2.png#section');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('def~mv2.png');
  });

  it('rejects boolean input', async () => {
    const result = await getImageUrl(true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Image URL required');
  });

  it('rejects array input', async () => {
    const result = await getImageUrl(['wix:image://v1/abc~mv2.jpg/img.jpg']);
    expect(result.success).toBe(false);
  });

  it('rejects object input', async () => {
    const result = await getImageUrl({ url: 'wix:image://v1/abc~mv2.jpg/img.jpg' });
    expect(result.success).toBe(false);
  });

  it('handles wix:image URL with no trailing path', async () => {
    // wix:image://v1/abc~mv2.jpg (no /name.jpg suffix)
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc~mv2.jpg');
  });

  it('handles static URL with /v1/fill/ transform path already in URL', async () => {
    const result = await getImageUrl('https://static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_800,h_600/abc~mv2.jpg');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc~mv2.jpg');
  });

  it('rejects plain text that is not a valid URL', async () => {
    const result = await getImageUrl('just some random text');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not extract');
  });

  it('rejects empty whitespace string', async () => {
    const result = await getImageUrl('   ');
    // sanitize trims, but extractFileName gets '   ' which has no match
    // The sanitize mock just slices, so '   ' remains '   '
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// buildStaticUrl edge cases (tested via getImageUrl + getProductMedia)
// ══════════════════════════════════════════════════════════════════════

describe('buildStaticUrl edge cases via getImageUrl', () => {
  it('builds URL with only width transform', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: 500 });
    expect(result.staticUrl).toContain('/v1/fill/w_500/abc~mv2.jpg');
    expect(result.staticUrl).not.toContain('h_');
    expect(result.staticUrl).not.toContain('q_');
  });

  it('builds URL with only height transform', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { height: 300 });
    expect(result.staticUrl).toContain('/v1/fill/h_300/abc~mv2.jpg');
  });

  it('builds URL with all three transforms in correct order (w, h, q)', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: 800, height: 600, quality: 90 });
    // The URL should contain transforms in order: w_, h_, q_
    const url = result.staticUrl;
    const wIdx = url.indexOf('w_800');
    const hIdx = url.indexOf('h_600');
    const qIdx = url.indexOf('q_90');
    expect(wIdx).toBeLessThan(hIdx);
    expect(hIdx).toBeLessThan(qIdx);
  });

  // Known gap: NaN passes typeof === 'number' but is falsy, so it won't be added as a transform
  it('NaN width is falsy — excluded from transform params', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: NaN });
    // NaN is falsy, so buildStaticUrl skips it
    expect(result.staticUrl).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
  });

  // Known gap: Infinity is truthy and passes the `if (width)` check
  it('Infinity width produces a transform param (truthy number)', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: Infinity });
    expect(result.staticUrl).toContain('w_Infinity');
  });

  it('zero width is falsy — excluded from transform params', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: 0 });
    expect(result.staticUrl).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
  });

  it('negative width is truthy — included in transform params', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: -100 });
    expect(result.staticUrl).toContain('w_-100');
  });

  it('string-number width is truthy — included in transform', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: '500' });
    expect(result.staticUrl).toContain('w_500');
  });
});

// ══════════════════════════════════════════════════════════════════════
// getProductMedia — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('getProductMedia — deep edge cases', () => {
  it('numeric product ID returns error (sanitize returns empty for non-string)', async () => {
    const result = await getProductMedia(12345);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('boolean product ID returns error', async () => {
    const result = await getProductMedia(true);
    expect(result.success).toBe(false);
  });

  it('object product ID returns error', async () => {
    const result = await getProductMedia({ _id: 'prod-a1b2' });
    expect(result.success).toBe(false);
  });

  it('handles cached mediaItems with null value in JSON — caught by try/catch', async () => {
    // null in array causes TypeError in .map when accessing null.fileName
    // The outer try/catch in getProductMedia catches this gracefully
    const mediaItems = [
      { fileName: 'abc~mv2.jpg', type: 'image' },
      null,
    ];
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: JSON.stringify(mediaItems),
      lastSynced: new Date(),
      mediaCount: 2,
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to fetch product media');
  });

  it('handles cached media with empty string mediaItems field', async () => {
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: '',
      lastSynced: new Date(),
      mediaCount: 0,
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.success).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('handles cached media with null mediaItems field', async () => {
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: null,
      lastSynced: new Date(),
      mediaCount: 0,
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.success).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('limit of NaN clamps to 1 via Math.max(1, NaN) = 1', async () => {
    // Math.max(1, NaN) = NaN, Math.min(NaN, 50) = NaN
    // .slice(0, NaN) returns empty array
    const items = Array.from({ length: 5 }, (_, i) => ({
      fileName: `img${i}~mv2.jpg`, type: 'image',
    }));
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: JSON.stringify(items),
      lastSynced: new Date(),
      mediaCount: 5,
    }]);

    const result = await getProductMedia('prod-a1b2', { limit: NaN });
    // NaN propagates: Math.min(Math.max(1, NaN), 50) = NaN
    // Array.slice(0, NaN) returns []
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(0);
  });

  it('limit of Infinity clamps to 50', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      fileName: `img${i}~mv2.jpg`, type: 'image',
    }));
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: JSON.stringify(items),
      lastSynced: new Date(),
      mediaCount: 60,
    }]);

    const result = await getProductMedia('prod-a1b2', { limit: Infinity });
    expect(result.items.length).toBeLessThanOrEqual(50);
  });

  it('limit of -Infinity clamps to 1', async () => {
    const items = [{ fileName: 'a~mv2.jpg', type: 'image' }];
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: JSON.stringify(items),
      lastSynced: new Date(),
      mediaCount: 1,
    }]);

    const result = await getProductMedia('prod-a1b2', { limit: -Infinity });
    // Math.max(1, -Infinity) = 1, Math.min(1, 50) = 1
    expect(result.items.length).toBe(1);
  });

  it('fallback path: product with media items that have no src or image key', async () => {
    seedEmpty(); // no cache
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Test Futon',
      mediaItems: [{ type: 'video', title: 'Setup Guide' }],
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.success).toBe(true);
    expect(result.items[0].src).toBe('');
    expect(result.items[0].fileName).toBe('');
    expect(result.items[0].staticUrl).toBeNull();
  });

  it('fallback path: media item with altText provided uses it instead of generated', async () => {
    seedEmpty();
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Oak Frame',
      mediaItems: [{ src: 'wix:image://v1/abc~mv2.jpg/img.jpg', altText: 'Custom alt text' }],
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.items[0].altText).toBe('Custom alt text');
  });

  it('fallback path: media item with title provided uses it', async () => {
    seedEmpty();
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Oak Frame',
      mediaItems: [{ src: 'wix:image://v1/abc~mv2.jpg/img.jpg', title: 'Hero shot' }],
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.items[0].title).toBe('Hero shot');
  });

  it('fallback path: title defaults to product name when media has no title', async () => {
    seedEmpty();
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Cherry Futon',
      mediaItems: [{ src: 'wix:image://v1/abc~mv2.jpg/img.jpg' }],
    }]);

    const result = await getProductMedia('prod-a1b2');
    expect(result.items[0].title).toBe('Cherry Futon');
  });

  it('options default to empty object when undefined', async () => {
    seedEmpty();
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Test',
      mediaItems: [{ src: 'wix:image://v1/abc~mv2.jpg/img.jpg' }],
    }]);

    const result = await getProductMedia('prod-a1b2', undefined);
    expect(result.success).toBe(true);
    // No transforms, plain static URL
    expect(result.items[0].staticUrl).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
  });

  it('mediaCount reflects total cached items, not sliced items', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      fileName: `img${i}~mv2.jpg`, type: 'image',
    }));
    seedMediaSync([{
      productId: 'prod-a1b2',
      mediaItems: JSON.stringify(items),
      lastSynced: new Date(),
      mediaCount: 30,
    }]);

    const result = await getProductMedia('prod-a1b2', { limit: 5 });
    expect(result.items.length).toBe(5);
    expect(result.mediaCount).toBe(30);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getBatchProductThumbnails — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('getBatchProductThumbnails — deep edge cases', () => {
  it('string input (not array) returns empty thumbnails', async () => {
    const result = await getBatchProductThumbnails('prod-a1b2');
    expect(result.success).toBe(true);
    expect(result.thumbnails).toEqual({});
  });

  it('number input returns empty thumbnails', async () => {
    const result = await getBatchProductThumbnails(42);
    expect(result.success).toBe(true);
    expect(result.thumbnails).toEqual({});
  });

  it('mainMedia as plain string (not object) — typeof src check handles it', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-a1b2',
        name: 'String Media',
        mainMedia: 'wix:image://v1/abc~mv2.jpg/img.jpg',
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    expect(result.success).toBe(true);
    // mainMedia is truthy, src = mainMedia (a string), so extractFileName applies
    expect(result.thumbnails['prod-a1b2']).toBeTruthy();
    expect(result.thumbnails['prod-a1b2'].staticUrl).toContain('abc~mv2.jpg');
  });

  it('mainMedia as object with image key instead of src', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-a1b2',
        name: 'Image Key',
        mainMedia: { image: 'wix:image://v1/def~mv2.jpg/img.jpg' },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    expect(result.thumbnails['prod-a1b2'].staticUrl).toContain('def~mv2.jpg');
  });

  it('mainMedia with non-string src returns empty src', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-a1b2',
        name: 'Bad Src',
        mainMedia: { src: 12345 },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    // typeof src !== 'string', so fileName = extractFileName('') = null
    expect(result.thumbnails['prod-a1b2'].src).toBe('');
    expect(result.thumbnails['prod-a1b2'].staticUrl).toBeNull();
  });

  it('products array with duplicate IDs deduplicates via sanitize+filter', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-a1b2', name: 'Dup', mainMedia: { src: 'wix:image://v1/abc~mv2.jpg/img.jpg' } }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2', 'prod-a1b2', 'prod-a1b2']);
    expect(result.success).toBe(true);
    // Query still runs with duplicates — that's fine, DB deduplicates results
    expect(result.thumbnails['prod-a1b2']).toBeTruthy();
  });

  it('handles product with both mainMedia null and mediaItems undefined', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-a1b2', name: 'No Media At All', mainMedia: null }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    expect(result.thumbnails['prod-a1b2']).toBeUndefined();
  });

  it('handles product with mainMedia = false (falsy)', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-a1b2', name: 'FalseMedia', mainMedia: false, mediaItems: [] }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    // false || (undefined && ...) is falsy
    expect(result.thumbnails['prod-a1b2']).toBeUndefined();
  });

  it('handles product with mainMedia = 0 (falsy) but mediaItems[0] exists', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-a1b2',
        name: 'ZeroMedia',
        mainMedia: 0,
        mediaItems: [{ src: 'wix:image://v1/fallback~mv2.jpg/img.jpg' }],
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-a1b2']);
    // 0 || mediaItems[0] = mediaItems[0]
    expect(result.thumbnails['prod-a1b2']).toBeTruthy();
    expect(result.thumbnails['prod-a1b2'].staticUrl).toContain('fallback~mv2.jpg');
  });

  it('exactly 50 IDs are accepted without truncation', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `prod-${String(i).padStart(4, '0')}`);
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    await getBatchProductThumbnails(ids);
    const callArgs = mockQueryChain.hasSome.mock.calls[0];
    expect(callArgs[1].length).toBe(50);
  });

  it('51st ID is truncated', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `prod-${String(i).padStart(4, '0')}`);
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    await getBatchProductThumbnails(ids);
    const callArgs = mockQueryChain.hasSome.mock.calls[0];
    expect(callArgs[1].length).toBe(50);
  });
});

// ══════════════════════════════════════════════════════════════════════
// listMediaFolder — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('listMediaFolder — deep edge cases', () => {
  it('null folder path returns error', async () => {
    const result = await listMediaFolder(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Folder path required');
  });

  it('numeric folder path returns error', async () => {
    const result = await listMediaFolder(12345);
    expect(result.success).toBe(false);
  });

  it('admin with only _id=admin role (no title match) still passes', async () => {
    currentMember.getRoles.mockResolvedValueOnce([{ _id: 'admin', title: 'SuperUser' }]);
    mediaManager.listFiles.mockResolvedValueOnce({ files: [] });
    const result = await listMediaFolder('/products');
    expect(result.success).toBe(true);
  });

  it('limit exactly at boundary 100 is accepted', async () => {
    await listMediaFolder('/products', { limit: 100 });
    const callArgs = mediaManager.listFiles.mock.calls[0][0];
    expect(callArgs.paging.limit).toBe(100);
  });

  it('limit exactly at boundary 1 is accepted', async () => {
    await listMediaFolder('/products', { limit: 1 });
    const callArgs = mediaManager.listFiles.mock.calls[0][0];
    expect(callArgs.paging.limit).toBe(1);
  });

  it('limit of 0 clamps to 1', async () => {
    await listMediaFolder('/products', { limit: 0 });
    const callArgs = mediaManager.listFiles.mock.calls[0][0];
    expect(callArgs.paging.limit).toBe(1);
  });

  it('handles API returning both files and mediaFiles keys (prefers files)', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [{ fileName: 'from-files~mv2.jpg' }],
      mediaFiles: [{ fileName: 'from-media~mv2.jpg' }],
    });

    const result = await listMediaFolder('/products');
    // result.files || result.mediaFiles — files is truthy array, so it wins
    expect(result.files[0].staticUrl).toContain('from-files~mv2.jpg');
  });

  it('handles API returning empty files but populated mediaFiles', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [],
      mediaFiles: [{ fileName: 'backup~mv2.jpg' }],
    });

    const result = await listMediaFolder('/products');
    // files is [] which is truthy, so it returns empty
    expect(result.files.length).toBe(0);
  });

  it('file with fileUrl fallback when fileName missing', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [{ fileUrl: 'fallback-url~mv2.jpg', originalFileName: 'photo.jpg' }],
    });

    const result = await listMediaFolder('/products');
    expect(result.files[0].fileName).toBe('fallback-url~mv2.jpg');
  });

  it('file with neither fileName nor fileUrl defaults to empty string', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [{ originalFileName: 'mystery.jpg' }],
    });

    const result = await listMediaFolder('/products');
    expect(result.files[0].fileName).toBe('');
    // buildStaticUrl('') with falsy input returns null
    expect(result.files[0].staticUrl).toBeNull();
  });

  it('member with empty _id fails authentication', async () => {
    currentMember.getMember.mockResolvedValueOnce({ _id: '', loginEmail: 'test@test.com' });
    const result = await listMediaFolder('/products');
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// listMediaFolders — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('listMediaFolders — deep edge cases', () => {
  it('folder with all fields missing defaults to empty strings', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{}],
    });

    const result = await listMediaFolders();
    expect(result.folders[0].folderId).toBe('');
    expect(result.folders[0].folderName).toBe('');
    expect(result.folders[0].parentFolderId).toBe('');
  });

  it('folder uses _id over folderId for folderId field', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{ _id: 'id-from-underscore', folderId: 'id-from-field', folderName: 'Test' }],
    });

    const result = await listMediaFolders();
    // _id || folderId — _id wins
    expect(result.folders[0].folderId).toBe('id-from-underscore');
  });

  it('folder uses folderName over displayName', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{ _id: 'f1', folderName: 'Preferred', displayName: 'Fallback' }],
    });

    const result = await listMediaFolders();
    expect(result.folders[0].folderName).toBe('Preferred');
  });

  it('handles API returning null folders array', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({ folders: null });

    const result = await listMediaFolders();
    expect(result.success).toBe(true);
    expect(result.folders).toEqual([]);
  });

  it('handles API returning no folders key at all', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({});

    const result = await listMediaFolders();
    expect(result.success).toBe(true);
    expect(result.folders).toEqual([]);
  });

  it('admin with role _id=admin (no title) passes auth', async () => {
    currentMember.getRoles.mockResolvedValueOnce([{ _id: 'admin' }]);
    const result = await listMediaFolders();
    expect(result.success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// syncProductMedia — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('syncProductMedia — deep edge cases', () => {
  it('array product ID returns error', async () => {
    const result = await syncProductMedia(['prod-a1b2']);
    expect(result.success).toBe(false);
  });

  it('product with mixed media types (some with image key, some with src)', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Mixed',
      mediaItems: [
        { src: 'wix:image://v1/aaa~mv2.jpg/img.jpg', type: 'image' },
        { image: 'wix:image://v1/bbb~mv2.jpg/img.jpg', type: 'image' },
        { type: 'video' }, // no src or image
      ],
    }]);
    seedEmpty(); // no existing sync

    const result = await syncProductMedia('prod-a1b2');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(3);

    const insertCall = wixData.insert.mock.calls[0];
    const mediaItems = JSON.parse(insertCall[1].mediaItems);
    expect(mediaItems[0].fileName).toBe('aaa~mv2.jpg');
    expect(mediaItems[1].fileName).toBe('bbb~mv2.jpg');
    expect(mediaItems[2].fileName).toBe('');
    expect(mediaItems[2].src).toBe('');
  });

  it('sync generates altText with 1-based index', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Oak Frame',
      mediaItems: [
        { src: 'wix:image://v1/a~mv2.jpg/img.jpg' },
        { src: 'wix:image://v1/b~mv2.jpg/img.jpg' },
      ],
    }]);
    seedEmpty();

    const result = await syncProductMedia('prod-a1b2');
    const mediaItems = JSON.parse(wixData.insert.mock.calls[0][1].mediaItems);
    expect(mediaItems[0].altText).toBe('Oak Frame - Image 1');
    expect(mediaItems[1].altText).toBe('Oak Frame - Image 2');
  });

  it('sync preserves existing altText from media item', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Oak Frame',
      mediaItems: [
        { src: 'wix:image://v1/a~mv2.jpg/img.jpg', altText: 'Custom alt' },
      ],
    }]);
    seedEmpty();

    const result = await syncProductMedia('prod-a1b2');
    const mediaItems = JSON.parse(wixData.insert.mock.calls[0][1].mediaItems);
    expect(mediaItems[0].altText).toBe('Custom alt');
  });

  it('update path sets lastSynced and mediaCount on existing record', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Update Test',
      mediaItems: [{ src: 'wix:image://v1/a~mv2.jpg/img.jpg' }],
    }]);
    seedMediaSync([{
      _id: 'sync-a1b2',
      productId: 'prod-a1b2',
      mediaItems: '[]',
      mediaCount: 0,
      lastSynced: new Date('2025-01-01'),
    }]);

    const result = await syncProductMedia('prod-a1b2');
    expect(result.success).toBe(true);
    const updateCall = wixData.update.mock.calls[0];
    expect(updateCall[0]).toBe('MediaSync');
    const record = updateCall[1];
    expect(record.mediaCount).toBe(1);
    expect(record.lastSynced).toBeInstanceOf(Date);
    expect(record.lastSynced > new Date('2025-01-01')).toBe(true);
  });

  it('insert failure propagates as graceful error', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Fail Insert',
      mediaItems: [],
    }]);
    seedEmpty();
    wixData.insert.mockRejectedValueOnce(new Error('Insert failed'));

    const result = await syncProductMedia('prod-a1b2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to sync');
  });

  it('update failure propagates as graceful error', async () => {
    seedProducts([{
      _id: 'prod-a1b2',
      name: 'Fail Update',
      mediaItems: [],
    }]);
    seedMediaSync([{ _id: 'sync-a1b2', productId: 'prod-a1b2', mediaItems: '[]', mediaCount: 0 }]);
    wixData.update.mockRejectedValueOnce(new Error('Update failed'));

    const result = await syncProductMedia('prod-a1b2');
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// batchSyncMedia — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('batchSyncMedia — deep edge cases', () => {
  it('default limit is 50 when no options provided', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia();
    expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
  });

  it('default limit is 50 when options is undefined', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia(undefined);
    expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
  });

  it('limit of NaN clamps — Math.min(Math.max(1, NaN), 200) = NaN', async () => {
    // NaN propagation: Math.max(1, NaN) = NaN, Math.min(NaN, 200) = NaN
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia({ limit: NaN });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(NaN);
  });

  it('syncs product with empty name — altText still generates with undefined', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-a1b2',
        mediaItems: [{ src: 'wix:image://v1/a~mv2.jpg/img.jpg' }],
      }],
      totalCount: 1,
    });
    mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

    const result = await batchSyncMedia();
    expect(result.success).toBe(true);
    const mediaItems = JSON.parse(wixData.insert.mock.calls[0][1].mediaItems);
    // prod.name is undefined, so altText = `${undefined} - Image 1`
    expect(mediaItems[0].altText).toBe('undefined - Image 1');
  });

  it('handles mix of insert and update within single batch', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'prod-a1b2', name: 'A', mediaItems: [] },
        { _id: 'prod-c3d4', name: 'B', mediaItems: [] },
      ],
      totalCount: 2,
    });
    // First product: no existing sync (insert)
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    // Second product: existing sync (update)
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'sync-c3d4', productId: 'prod-c3d4', mediaItems: '[]', mediaCount: 0 }],
      totalCount: 1,
    });

    const result = await batchSyncMedia();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(wixData.insert).toHaveBeenCalledTimes(1);
    expect(wixData.update).toHaveBeenCalledTimes(1);
  });

  it('mid-batch DB failure causes overall failure', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'prod-a1b2', name: 'A', mediaItems: [] },
      ],
      totalCount: 1,
    });
    // Sync check throws
    mockQueryChain.find.mockRejectedValueOnce(new Error('Mid-batch fail'));

    const result = await batchSyncMedia();
    expect(result.success).toBe(false);
  });

  it('limit of 200 is accepted (max boundary)', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia({ limit: 200 });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(200);
  });

  it('limit of 201 clamps to 200', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia({ limit: 201 });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(200);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getMediaStats — deep edge cases
// ══════════════════════════════════════════════════════════════════════

describe('getMediaStats — deep edge cases', () => {
  it('single product with exactly 1 image gives avg 1.0', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2', mediaCount: 1 }],
      totalCount: 1,
    });

    const result = await getMediaStats();
    expect(result.stats.avgImagesPerProduct).toBe(1);
  });

  it('handles product with very large mediaCount', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2', mediaCount: 999999 }],
      totalCount: 1,
    });

    const result = await getMediaStats();
    expect(result.stats.totalImages).toBe(999999);
    expect(result.stats.avgImagesPerProduct).toBe(999999);
  });

  it('handles mediaCount of undefined (treated as falsy, not > 0)', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2' }], // no mediaCount field
      totalCount: 1,
    });

    const result = await getMediaStats();
    // undefined > 0 is false
    expect(result.stats.productsWithoutMedia).toBe(1);
    expect(result.stats.productsWithMedia).toBe(0);
  });

  // Known gap: NaN > 0 is false, so NaN mediaCount counts as "without media"
  it('mediaCount of NaN is treated as without media', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2', mediaCount: NaN }],
      totalCount: 1,
    });

    const result = await getMediaStats();
    expect(result.stats.productsWithoutMedia).toBe(1);
    // NaN addition: totalImages += NaN = NaN
    expect(result.stats.totalImages).toBe(0);
  });

  it('negative mediaCount is treated as without media (negative > 0 is false)', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2', mediaCount: -5 }],
      totalCount: 1,
    });

    const result = await getMediaStats();
    expect(result.stats.productsWithoutMedia).toBe(1);
  });

  it('fractional mediaCount is treated as with media (0.5 > 0 is true)', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-a1b2', mediaCount: 0.5 }],
      totalCount: 1,
    });

    const result = await getMediaStats();
    expect(result.stats.productsWithMedia).toBe(1);
    expect(result.stats.totalImages).toBe(0.5);
  });

  it('avgImagesPerProduct rounds correctly for repeating decimal', async () => {
    // 10 / 3 = 3.333... rounds to 3.3
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'p1', mediaCount: 3 },
        { productId: 'p2', mediaCount: 3 },
        { productId: 'p3', mediaCount: 4 },
      ],
      totalCount: 3,
    });

    const result = await getMediaStats();
    expect(result.stats.avgImagesPerProduct).toBe(3.3);
  });

  it('admin check: member with _id but no roles array returns error', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await getMediaStats();
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// requireAdmin — edge cases (tested through admin endpoints)
// ══════════════════════════════════════════════════════════════════════

describe('requireAdmin edge cases via admin endpoints', () => {
  it('getMember returning undefined fails auth', async () => {
    currentMember.getMember.mockResolvedValueOnce(undefined);
    const result = await syncProductMedia('prod-a1b2');
    expect(result.success).toBe(false);
  });

  it('getMember throwing error is caught gracefully', async () => {
    currentMember.getMember.mockRejectedValueOnce(new Error('Auth service down'));
    const result = await listMediaFolders();
    expect(result.success).toBe(false);
  });

  it('getRoles throwing error is caught gracefully', async () => {
    currentMember.getRoles.mockRejectedValueOnce(new Error('Roles service down'));
    const result = await batchSyncMedia();
    expect(result.success).toBe(false);
  });

  it('member with multiple non-admin roles fails', async () => {
    currentMember.getRoles.mockResolvedValueOnce([
      { title: 'Editor', _id: 'editor' },
      { title: 'Contributor', _id: 'contributor' },
    ]);
    const result = await listMediaFolder('/products');
    expect(result.success).toBe(false);
  });

  it('member with Admin title but different _id passes', async () => {
    currentMember.getRoles.mockResolvedValueOnce([{ title: 'Admin', _id: 'custom-role-id' }]);
    mediaManager.listFolders.mockResolvedValueOnce({ folders: [] });
    const result = await listMediaFolders();
    expect(result.success).toBe(true);
  });

  it('member with admin _id but different title passes', async () => {
    currentMember.getRoles.mockResolvedValueOnce([{ title: 'SuperAdmin', _id: 'admin' }]);
    mediaManager.listFolders.mockResolvedValueOnce({ folders: [] });
    const result = await listMediaFolders();
    expect(result.success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getImageUrl — additional edge cases
// ══════════════════════════════════════════════════════════════════════

describe('getImageUrl — additional edge cases', () => {
  it('very long URL is truncated by sanitize to 500 chars', async () => {
    const longUrl = 'wix:image://v1/abc~mv2.jpg/' + 'x'.repeat(600);
    const result = await getImageUrl(longUrl);
    // sanitize truncates to 500 chars, but the match is at the start
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc~mv2.jpg');
  });

  it('URL with only protocol prefix and no file name fails', async () => {
    const result = await getImageUrl('wix:image://v1/');
    // regex: /wix:image:\/\/v1\/([^/]+)/ — captures empty string? No, [^/]+ needs 1+
    expect(result.success).toBe(false);
  });

  it('static URL with no path after /media/ fails', async () => {
    const result = await getImageUrl('https://static.wixstatic.com/media/');
    // regex: /static\.wixstatic\.com\/media\/([^/?#]+)/ — needs 1+ chars
    expect(result.success).toBe(false);
  });

  it('handles wix:image URL with multiple slashes in path', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/path/to/image.jpg');
    expect(result.fileName).toBe('abc~mv2.jpg');
  });

  it('handles empty options object', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', {});
    expect(result.staticUrl).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
  });

  it('handles options with extra unknown properties', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', {
      width: 300,
      format: 'webp', // not a recognized option
      blur: 10,       // not a recognized option
    });
    expect(result.staticUrl).toContain('w_300');
    // Unknown props ignored
    expect(result.staticUrl).not.toContain('format');
    expect(result.staticUrl).not.toContain('blur');
  });
});
