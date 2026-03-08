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
} from '../../src/backend/mediaGallery.web.js';

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
});
