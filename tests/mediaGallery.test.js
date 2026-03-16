import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
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
    insert: vi.fn().mockImplementation(async (col, data) => ({ ...data, _id: 'new-id', _createdDate: new Date() })),
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
    getMember: vi.fn().mockResolvedValue({ _id: 'admin-1', loginEmail: 'admin@example.com' }),
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
  wixData.insert.mockImplementation(async (col, data) => ({ ...data, _id: 'new-id', _createdDate: new Date() }));
  wixData.update.mockImplementation(async (col, data) => data);
  mediaManager.listFiles.mockResolvedValue({ files: [] });
  mediaManager.listFolders.mockResolvedValue({ folders: [] });
  currentMember.getMember.mockResolvedValue({ _id: 'admin-1', loginEmail: 'admin@example.com' });
  currentMember.getRoles.mockResolvedValue([{ title: 'Admin', _id: 'admin' }]);
});

// ── getProductMedia ─────────────────────────────────────────────────

describe('getProductMedia', () => {
  it('returns error for empty product ID', async () => {
    const result = await getProductMedia('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('returns empty when no product found', async () => {
    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(0);
  });

  it('returns cached media from MediaSync', async () => {
    const mediaItems = [
      { src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', fileName: 'abc123~mv2.jpg', type: 'image', title: 'Front', altText: 'Futon front view' },
      { src: 'wix:image://v1/def456~mv2.jpg/image.jpg', fileName: 'def456~mv2.jpg', type: 'image', title: 'Side', altText: 'Futon side view' },
    ];

    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        productId: 'prod-1',
        mediaItems: JSON.stringify(mediaItems),
        lastSynced: new Date('2026-02-21'),
        mediaCount: 2,
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(2);
    expect(result.items[0].staticUrl).toContain('wixstatic.com/media/abc123~mv2.jpg');
    expect(result.items[0].thumbnailUrl).toContain('150');
    expect(result.lastSynced).toBeTruthy();
  });

  it('falls back to Stores/Products when no cache', async () => {
    // First call (MediaSync) returns empty
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    // Second call (Stores/Products) returns product
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Oak Futon Frame',
        mediaItems: [
          { src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', type: 'image' },
        ],
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.items[0].altText).toContain('Oak Futon Frame');
    expect(result.items[0].staticUrl).toContain('abc123~mv2.jpg');
    expect(result.lastSynced).toBeNull();
  });

  it('applies width/height/quality options', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mediaItems: [{ src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', type: 'image' }],
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1', { width: 800, height: 600, quality: 90 });
    expect(result.items[0].staticUrl).toContain('w_800');
    expect(result.items[0].staticUrl).toContain('h_600');
    expect(result.items[0].staticUrl).toContain('q_90');
  });

  it('respects limit option', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      src: `wix:image://v1/img${i}~mv2.jpg/image.jpg`,
      fileName: `img${i}~mv2.jpg`,
      type: 'image',
    }));

    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', mediaItems: JSON.stringify(items), lastSynced: new Date(), mediaCount: 10 }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1', { limit: 3 });
    expect(result.items.length).toBe(3);
  });

  it('handles DB errors gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB down'));
    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(false);
  });

  it('returns error for null product ID', async () => {
    const result = await getProductMedia(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('returns error for undefined product ID', async () => {
    const result = await getProductMedia(undefined);
    expect(result.success).toBe(false);
  });

  it('caps limit at 50', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      src: `wix:image://v1/img${i}~mv2.jpg/image.jpg`,
      fileName: `img${i}~mv2.jpg`,
      type: 'image',
    }));

    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', mediaItems: JSON.stringify(items), lastSynced: new Date(), mediaCount: 60 }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1', { limit: 100 });
    expect(result.items.length).toBeLessThanOrEqual(50);
  });

  it('enforces minimum limit of 1', async () => {
    const items = [{ src: 'wix:image://v1/img0~mv2.jpg/image.jpg', fileName: 'img0~mv2.jpg', type: 'image' }];
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', mediaItems: JSON.stringify(items), lastSynced: new Date(), mediaCount: 1 }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1', { limit: -5 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('handles cached media with invalid JSON gracefully', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'prod-1', mediaItems: 'not-valid-json{', lastSynced: new Date(), mediaCount: 0 }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('falls back product with empty mediaItems array', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-1', name: 'Bare Futon', mediaItems: [] }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('falls back product with no mediaItems field', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-1', name: 'Bare Futon' }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.items).toEqual([]);
  });

  it('sanitizes HTML in product ID', async () => {
    const result = await getProductMedia('<script>alert(1)</script>');
    // Should not throw - sanitize handles it
    expect(result).toBeDefined();
  });

  it('generates altText from product name on fallback path', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Cherry Futon Frame',
        mediaItems: [
          { src: 'wix:image://v1/a~mv2.jpg/img.jpg', type: 'image' },
          { src: 'wix:image://v1/b~mv2.jpg/img.jpg', type: 'image' },
        ],
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.items[0].altText).toBe('Cherry Futon Frame - Image 1');
    expect(result.items[1].altText).toBe('Cherry Futon Frame - Image 2');
  });

  it('returns productId in response', async () => {
    const result = await getProductMedia('prod-abc');
    expect(result.productId).toBe('prod-abc');
  });

  it('uses image key when src is absent in fallback', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mediaItems: [{ image: 'wix:image://v1/xyz~mv2.jpg/img.jpg', type: 'image' }],
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.items[0].src).toBe('wix:image://v1/xyz~mv2.jpg/img.jpg');
    expect(result.items[0].staticUrl).toContain('xyz~mv2.jpg');
  });

  it('defaults type to image when missing', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mediaItems: [{ src: 'wix:image://v1/a~mv2.jpg/img.jpg' }],
      }],
      totalCount: 1,
    });

    const result = await getProductMedia('prod-1');
    expect(result.items[0].type).toBe('image');
  });

  it('includes thumbnailUrl for cached items', async () => {
    const mediaItems = [{ fileName: 'abc~mv2.jpg', type: 'image' }];
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ productId: 'p1', mediaItems: JSON.stringify(mediaItems), lastSynced: new Date(), mediaCount: 1 }],
      totalCount: 1,
    });

    const result = await getProductMedia('p1');
    expect(result.items[0].thumbnailUrl).toContain('w_150');
    expect(result.items[0].thumbnailUrl).toContain('h_150');
  });
});

// ── getBatchProductThumbnails ───────────────────────────────────────

describe('getBatchProductThumbnails', () => {
  it('returns empty for empty array', async () => {
    const result = await getBatchProductThumbnails([]);
    expect(result.success).toBe(true);
    expect(result.thumbnails).toEqual({});
  });

  it('returns empty for non-array', async () => {
    const result = await getBatchProductThumbnails(null);
    expect(result.success).toBe(true);
    expect(result.thumbnails).toEqual({});
  });

  it('returns thumbnails for products', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        {
          _id: 'prod-1',
          name: 'Oak Futon',
          mainMedia: { src: 'wix:image://v1/abc123~mv2.jpg/image.jpg' },
          mediaItems: [],
        },
        {
          _id: 'prod-2',
          name: 'Pine Frame',
          mainMedia: null,
          mediaItems: [{ src: 'wix:image://v1/def456~mv2.jpg/image.jpg' }],
        },
      ],
      totalCount: 2,
    });

    const result = await getBatchProductThumbnails(['prod-1', 'prod-2']);
    expect(result.success).toBe(true);
    expect(result.thumbnails['prod-1']).toBeTruthy();
    expect(result.thumbnails['prod-1'].staticUrl).toContain('abc123~mv2.jpg');
    expect(result.thumbnails['prod-2']).toBeTruthy();
  });

  it('limits to 50 product IDs', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    await getBatchProductThumbnails(ids);
    const callArgs = mockQueryChain.hasSome.mock.calls[0];
    expect(callArgs[1].length).toBeLessThanOrEqual(50);
  });

  it('handles DB errors gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('fail'));
    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.success).toBe(false);
  });

  it('filters out empty/null IDs', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    const result = await getBatchProductThumbnails(['', null, undefined, 'prod-1']);
    expect(result.success).toBe(true);
    // Should still query with valid IDs
    expect(mockQueryChain.hasSome).toHaveBeenCalled();
  });

  it('returns empty when all IDs are invalid', async () => {
    const result = await getBatchProductThumbnails([null, undefined, '', 0]);
    expect(result.success).toBe(true);
    expect(result.thumbnails).toEqual({});
  });

  it('applies custom width/height/quality options', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mainMedia: { src: 'wix:image://v1/abc~mv2.jpg/img.jpg' },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1'], { width: 600, height: 600, quality: 90 });
    expect(result.thumbnails['prod-1'].staticUrl).toContain('w_600');
    expect(result.thumbnails['prod-1'].staticUrl).toContain('h_600');
    expect(result.thumbnails['prod-1'].staticUrl).toContain('q_90');
  });

  it('uses default 400x400 dimensions when no options', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mainMedia: { src: 'wix:image://v1/abc~mv2.jpg/img.jpg' },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.thumbnails['prod-1'].staticUrl).toContain('w_400');
    expect(result.thumbnails['prod-1'].staticUrl).toContain('h_400');
  });

  it('skips product without any media', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'prod-1', name: 'No Media', mainMedia: null, mediaItems: [] },
      ],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.thumbnails['prod-1']).toBeUndefined();
  });

  it('falls back to first mediaItems when mainMedia is null', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Fallback',
        mainMedia: null,
        mediaItems: [{ src: 'wix:image://v1/fall~mv2.jpg/img.jpg' }],
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.thumbnails['prod-1']).toBeTruthy();
    expect(result.thumbnails['prod-1'].staticUrl).toContain('fall~mv2.jpg');
  });

  it('generates altText with product name', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Maple Frame',
        mainMedia: { src: 'wix:image://v1/abc~mv2.jpg/img.jpg' },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.thumbnails['prod-1'].altText).toBe('Maple Frame thumbnail');
  });

  it('uses default altText when product has no name', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        mainMedia: { src: 'wix:image://v1/abc~mv2.jpg/img.jpg' },
      }],
      totalCount: 1,
    });

    const result = await getBatchProductThumbnails(['prod-1']);
    expect(result.thumbnails['prod-1'].altText).toBe('Product thumbnail');
  });
});

// ── listMediaFolder ─────────────────────────────────────────────────

describe('listMediaFolder', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await listMediaFolder('/products/futon-frames');
    expect(result.success).toBe(false);
  });

  it('requires folder path', async () => {
    const result = await listMediaFolder('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Folder path required');
  });

  it('lists files in folder', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [
        { fileName: 'img1~mv2.jpg', originalFileName: 'futon-front.jpg', mimeType: 'image/jpeg', width: 1200, height: 800, sizeInBytes: 250000 },
        { fileName: 'img2~mv2.jpg', originalFileName: 'futon-side.jpg', mimeType: 'image/jpeg', width: 1200, height: 800, sizeInBytes: 230000 },
      ],
    });

    const result = await listMediaFolder('/products/futon-frames');
    expect(result.success).toBe(true);
    expect(result.files.length).toBe(2);
    expect(result.files[0].staticUrl).toContain('img1~mv2.jpg');
    expect(result.files[0].originalFileName).toBe('futon-front.jpg');
  });

  it('caps limit at 100', async () => {
    await listMediaFolder('/products', { limit: 200 });
    const callArgs = mediaManager.listFiles.mock.calls[0][0];
    expect(callArgs.paging.limit).toBeLessThanOrEqual(100);
  });

  it('enforces minimum limit of 1', async () => {
    await listMediaFolder('/products', { limit: -10 });
    const callArgs = mediaManager.listFiles.mock.calls[0][0];
    expect(callArgs.paging.limit).toBeGreaterThanOrEqual(1);
  });

  it('rejects unauthenticated user', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await listMediaFolder('/products');
    expect(result.success).toBe(false);
  });

  it('handles mediaFiles key from API response', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      mediaFiles: [
        { fileName: 'file1~mv2.jpg', originalFileName: 'photo.jpg', mimeType: 'image/jpeg', width: 800, height: 600, sizeInBytes: 100000 },
      ],
    });

    const result = await listMediaFolder('/products/covers');
    expect(result.success).toBe(true);
    expect(result.files.length).toBe(1);
    expect(result.files[0].staticUrl).toContain('file1~mv2.jpg');
  });

  it('defaults missing file fields to safe values', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [{ fileName: 'bare~mv2.jpg' }],
    });

    const result = await listMediaFolder('/products/futon-frames');
    expect(result.files[0].originalFileName).toBe('');
    expect(result.files[0].mimeType).toBe('');
    expect(result.files[0].width).toBe(0);
    expect(result.files[0].height).toBe(0);
    expect(result.files[0].sizeInBytes).toBe(0);
  });

  it('handles API error gracefully', async () => {
    mediaManager.listFiles.mockRejectedValueOnce(new Error('API down'));
    const result = await listMediaFolder('/products');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to list media folder');
  });

  it('returns totalCount matching files length', async () => {
    mediaManager.listFiles.mockResolvedValueOnce({
      files: [
        { fileName: 'a~mv2.jpg' },
        { fileName: 'b~mv2.jpg' },
        { fileName: 'c~mv2.jpg' },
      ],
    });

    const result = await listMediaFolder('/products/mattresses');
    expect(result.totalCount).toBe(3);
  });

  it('returns folder path in response', async () => {
    const result = await listMediaFolder('/products/futon-frames');
    expect(result.folder).toBe('/products/futon-frames');
  });
});

// ── listMediaFolders ────────────────────────────────────────────────

describe('listMediaFolders', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await listMediaFolders();
    expect(result.success).toBe(false);
  });

  it('returns folder list', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [
        { _id: 'folder-1', folderName: 'products' },
        { _id: 'folder-2', folderName: 'banners' },
      ],
    });

    const result = await listMediaFolders();
    expect(result.success).toBe(true);
    expect(result.folders.length).toBe(2);
    expect(result.folders[0].folderName).toBe('products');
  });

  it('rejects unauthenticated user', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await listMediaFolders();
    expect(result.success).toBe(false);
  });

  it('uses displayName fallback for folder name', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{ _id: 'f1', displayName: 'Product Photos' }],
    });

    const result = await listMediaFolders();
    expect(result.folders[0].folderName).toBe('Product Photos');
  });

  it('uses folderId fallback for folder ID', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{ folderId: 'fid-1', folderName: 'Test' }],
    });

    const result = await listMediaFolders();
    expect(result.folders[0].folderId).toBe('fid-1');
  });

  it('handles empty folders list', async () => {
    const result = await listMediaFolders();
    expect(result.success).toBe(true);
    expect(result.folders).toEqual([]);
  });

  it('handles API error gracefully', async () => {
    mediaManager.listFolders.mockRejectedValueOnce(new Error('API fail'));
    const result = await listMediaFolders();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to list media folders');
  });

  it('defaults parentFolderId to empty string', async () => {
    mediaManager.listFolders.mockResolvedValueOnce({
      folders: [{ _id: 'f1', folderName: 'root' }],
    });

    const result = await listMediaFolders();
    expect(result.folders[0].parentFolderId).toBe('');
  });
});

// ── syncProductMedia ────────────────────────────────────────────────

describe('syncProductMedia', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(false);
  });

  it('requires product ID', async () => {
    const result = await syncProductMedia('');
    expect(result.success).toBe(false);
  });

  it('returns error for missing product', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });

  it('creates new sync record', async () => {
    // Products query returns product
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Oak Futon',
        mediaItems: [
          { src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', type: 'image' },
        ],
      }],
      totalCount: 1,
    });
    // MediaSync query returns empty (no existing sync)
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(1);
    expect(wixData.insert).toHaveBeenCalledWith('MediaSync', expect.objectContaining({
      productId: 'prod-1',
      mediaCount: 1,
    }));
  });

  it('updates existing sync record', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Oak Futon',
        mediaItems: [
          { src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', type: 'image' },
          { src: 'wix:image://v1/def456~mv2.jpg/image.jpg', type: 'image' },
        ],
      }],
      totalCount: 1,
    });
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'sync-1', productId: 'prod-1', mediaItems: '[]', mediaCount: 0 }],
      totalCount: 1,
    });

    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(2);
    expect(wixData.update).toHaveBeenCalled();
  });

  it('returns error for null product ID', async () => {
    const result = await syncProductMedia(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('rejects unauthenticated user', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(false);
  });

  it('handles product with no mediaItems', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-1', name: 'Bare Product' }],
      totalCount: 1,
    });
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(true);
    expect(result.mediaCount).toBe(0);
  });

  it('returns lastSynced date', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-1', name: 'Test', mediaItems: [] }],
      totalCount: 1,
    });
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const result = await syncProductMedia('prod-1');
    expect(result.lastSynced).toBeInstanceOf(Date);
  });

  it('handles DB error gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB fail'));
    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to sync');
  });

  it('extracts fileName from wix:image URLs during sync', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{
        _id: 'prod-1',
        name: 'Test',
        mediaItems: [{ src: 'wix:image://v1/abc123~mv2.jpg/image.jpg', type: 'image', title: 'Front' }],
      }],
      totalCount: 1,
    });
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });

    const result = await syncProductMedia('prod-1');
    expect(result.success).toBe(true);
    const insertCall = wixData.insert.mock.calls[0];
    const mediaItems = JSON.parse(insertCall[1].mediaItems);
    expect(mediaItems[0].fileName).toBe('abc123~mv2.jpg');
  });
});

// ── batchSyncMedia ──────────────────────────────────────────────────

describe('batchSyncMedia', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await batchSyncMedia();
    expect(result.success).toBe(false);
  });

  it('syncs multiple products', async () => {
    // Products query
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'prod-1', name: 'Futon A', mediaItems: [{ src: 'wix:image://v1/a~mv2.jpg/img.jpg' }] },
        { _id: 'prod-2', name: 'Futon B', mediaItems: [{ src: 'wix:image://v1/b~mv2.jpg/img.jpg' }] },
      ],
      totalCount: 2,
    });
    // MediaSync queries (each product checks for existing)
    mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

    const result = await batchSyncMedia();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(wixData.insert).toHaveBeenCalledTimes(2);
  });

  it('limits batch size', async () => {
    await batchSyncMedia({ limit: 300 });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(200);
  });

  it('enforces minimum limit of 1', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await batchSyncMedia({ limit: -5 });
    expect(mockQueryChain.limit).toHaveBeenCalledWith(1);
  });

  it('rejects unauthenticated user', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await batchSyncMedia();
    expect(result.success).toBe(false);
  });

  it('handles empty product list', async () => {
    mockQueryChain.find.mockResolvedValueOnce({ items: [], totalCount: 0 });
    const result = await batchSyncMedia();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('updates existing sync records during batch', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'prod-1', name: 'Futon', mediaItems: [{ src: 'wix:image://v1/a~mv2.jpg/img.jpg' }] }],
      totalCount: 1,
    });
    // Existing sync record found
    mockQueryChain.find.mockResolvedValueOnce({
      items: [{ _id: 'sync-1', productId: 'prod-1', mediaItems: '[]', mediaCount: 0 }],
      totalCount: 1,
    });

    const result = await batchSyncMedia();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(wixData.update).toHaveBeenCalled();
  });

  it('handles DB error gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB fail'));
    const result = await batchSyncMedia();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to batch sync');
  });

  it('returns totalProducts count', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { _id: 'p1', name: 'A', mediaItems: [] },
        { _id: 'p2', name: 'B', mediaItems: [] },
      ],
      totalCount: 2,
    });
    mockQueryChain.find.mockResolvedValue({ items: [], totalCount: 0 });

    const result = await batchSyncMedia();
    expect(result.totalProducts).toBe(2);
  });
});

// ── getImageUrl ─────────────────────────────────────────────────────

describe('getImageUrl', () => {
  it('returns error for empty input', async () => {
    const result = await getImageUrl('');
    expect(result.success).toBe(false);
  });

  it('returns error for non-string input', async () => {
    const result = await getImageUrl(null);
    expect(result.success).toBe(false);
  });

  it('extracts file name from wix:image URL', async () => {
    const result = await getImageUrl('wix:image://v1/abc123~mv2.jpg/futon.jpg');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('abc123~mv2.jpg');
    expect(result.staticUrl).toContain('wixstatic.com/media/abc123~mv2.jpg');
  });

  it('extracts file name from static URL', async () => {
    const result = await getImageUrl('https://static.wixstatic.com/media/xyz789~mv2.png');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('xyz789~mv2.png');
  });

  it('applies size transforms', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: 600, height: 400, quality: 85 });
    expect(result.staticUrl).toContain('w_600');
    expect(result.staticUrl).toContain('h_400');
    expect(result.staticUrl).toContain('q_85');
  });

  it('returns error for unrecognized URL format', async () => {
    const result = await getImageUrl('https://example.com/random-image.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not extract');
  });

  it('returns error for undefined input', async () => {
    const result = await getImageUrl(undefined);
    expect(result.success).toBe(false);
  });

  it('returns error for numeric input', async () => {
    const result = await getImageUrl(12345);
    expect(result.success).toBe(false);
  });

  it('includes thumbnailUrl in response', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg');
    expect(result.thumbnailUrl).toContain('w_150');
    expect(result.thumbnailUrl).toContain('h_150');
  });

  it('preserves originalUrl in response', async () => {
    const url = 'wix:image://v1/abc~mv2.jpg/img.jpg';
    const result = await getImageUrl(url);
    expect(result.originalUrl).toBe(url);
  });

  it('handles width-only transform', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { width: 300 });
    expect(result.staticUrl).toContain('w_300');
    expect(result.staticUrl).not.toContain('h_');
  });

  it('handles quality-only transform', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg', { quality: 70 });
    expect(result.staticUrl).toContain('q_70');
  });

  it('returns plain static URL with no transforms', async () => {
    const result = await getImageUrl('wix:image://v1/abc~mv2.jpg/img.jpg');
    expect(result.staticUrl).toBe('https://static.wixstatic.com/media/abc~mv2.jpg');
  });
});

// ── getMediaStats ───────────────────────────────────────────────────

describe('getMediaStats', () => {
  it('requires admin', async () => {
    currentMember.getRoles.mockResolvedValueOnce([]);
    const result = await getMediaStats();
    expect(result.success).toBe(false);
  });

  it('calculates correct stats', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'prod-1', mediaCount: 5 },
        { productId: 'prod-2', mediaCount: 3 },
        { productId: 'prod-3', mediaCount: 0 },
      ],
      totalCount: 3,
    });

    const result = await getMediaStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalSyncedProducts).toBe(3);
    expect(result.stats.productsWithMedia).toBe(2);
    expect(result.stats.productsWithoutMedia).toBe(1);
    expect(result.stats.totalImages).toBe(8);
    expect(result.stats.avgImagesPerProduct).toBe(2.7);
  });

  it('handles empty catalog', async () => {
    const result = await getMediaStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalSyncedProducts).toBe(0);
    expect(result.stats.avgImagesPerProduct).toBe(0);
  });

  it('rejects unauthenticated user', async () => {
    currentMember.getMember.mockResolvedValueOnce(null);
    const result = await getMediaStats();
    expect(result.success).toBe(false);
  });

  it('handles all products having media', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'p1', mediaCount: 4 },
        { productId: 'p2', mediaCount: 6 },
      ],
      totalCount: 2,
    });

    const result = await getMediaStats();
    expect(result.stats.productsWithMedia).toBe(2);
    expect(result.stats.productsWithoutMedia).toBe(0);
    expect(result.stats.totalImages).toBe(10);
    expect(result.stats.avgImagesPerProduct).toBe(5);
  });

  it('handles all products having zero media', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'p1', mediaCount: 0 },
        { productId: 'p2', mediaCount: 0 },
      ],
      totalCount: 2,
    });

    const result = await getMediaStats();
    expect(result.stats.productsWithMedia).toBe(0);
    expect(result.stats.productsWithoutMedia).toBe(2);
    expect(result.stats.totalImages).toBe(0);
    expect(result.stats.avgImagesPerProduct).toBe(0);
  });

  it('rounds avgImagesPerProduct to one decimal', async () => {
    mockQueryChain.find.mockResolvedValueOnce({
      items: [
        { productId: 'p1', mediaCount: 3 },
        { productId: 'p2', mediaCount: 4 },
        { productId: 'p3', mediaCount: 2 },
      ],
      totalCount: 3,
    });

    const result = await getMediaStats();
    expect(result.stats.avgImagesPerProduct).toBe(3);
  });

  it('handles DB error gracefully', async () => {
    mockQueryChain.find.mockRejectedValueOnce(new Error('DB fail'));
    const result = await getMediaStats();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to load media stats');
  });

  it('returns stats object structure', async () => {
    const result = await getMediaStats();
    expect(result.stats).toHaveProperty('totalSyncedProducts');
    expect(result.stats).toHaveProperty('productsWithMedia');
    expect(result.stats).toHaveProperty('productsWithoutMedia');
    expect(result.stats).toHaveProperty('totalImages');
    expect(result.stats).toHaveProperty('avgImagesPerProduct');
  });
});
