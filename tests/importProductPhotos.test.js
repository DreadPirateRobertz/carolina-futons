import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// We'll import the module functions after mocking
let importProductPhotos;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a successful folder response
function folderResponse(id, displayName, parentFolderId = 'media-root') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      folder: {
        id,
        displayName,
        parentFolderId,
        createdDate: '2026-03-08T00:00:00.000Z',
        updatedDate: '2026-03-08T00:00:00.000Z',
        state: 'OK',
      },
    }),
  };
}

// Helper to create a successful bulk import response
function bulkImportResponse(items) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: items.map((item, i) => ({
        item: {
          id: `ed8a72_${String(i).padStart(6, '0')}~mv2.jpg`,
          displayName: item.displayName || `image${i}`,
          url: `https://static.wixstatic.com/media/ed8a72_${String(i).padStart(6, '0')}~mv2.jpg`,
          parentFolderId: item.parentFolderId || 'media-root',
          mediaType: 'IMAGE',
          operationStatus: 'PENDING',
          sourceUrl: item.url,
          state: 'OK',
        },
        itemMetadata: {
          id: `ed8a72_${String(i).padStart(6, '0')}~mv2.jpg`,
          originalIndex: i,
          success: true,
        },
      })),
      bulkActionMetadata: {
        totalSuccesses: items.length,
        totalFailures: 0,
      },
    }),
  };
}

// Helper for error responses
function errorResponse(status, message) {
  return {
    ok: false,
    status,
    json: async () => ({ message }),
    text: async () => message,
  };
}

describe('importProductPhotos', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    // Dynamic import so mocks are fresh each test
    const mod = await import('../scripts/importProductPhotos.js');
    importProductPhotos = mod;
  });

  describe('loadManifest', () => {
    it('loads and parses the product-image-manifest.json', () => {
      const manifest = importProductPhotos.loadManifest();
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.length).toBeGreaterThan(0);
      expect(manifest[0]).toHaveProperty('name');
      expect(manifest[0]).toHaveProperty('slug');
      expect(manifest[0]).toHaveProperty('folder');
      expect(manifest[0]).toHaveProperty('images');
    });

    it('throws on missing manifest file', () => {
      expect(() => {
        importProductPhotos.loadManifest('/nonexistent/path.json');
      }).toThrow();
    });
  });

  describe('extractUniqueFolders', () => {
    it('extracts unique folder paths from manifest', () => {
      const manifest = [
        { folder: '/products/futon-frames', images: [] },
        { folder: '/products/futon-frames', images: [] },
        { folder: '/products/mattresses', images: [] },
        { folder: '/products/platform-beds', images: [] },
      ];
      const folders = importProductPhotos.extractUniqueFolders(manifest);
      expect(folders).toEqual([
        '/products/futon-frames',
        '/products/mattresses',
        '/products/platform-beds',
      ]);
    });

    it('returns empty array for empty manifest', () => {
      expect(importProductPhotos.extractUniqueFolders([])).toEqual([]);
    });

    it('handles manifest items without folder field', () => {
      const manifest = [
        { images: [] },
        { folder: '/products/foo', images: [] },
      ];
      const folders = importProductPhotos.extractUniqueFolders(manifest);
      expect(folders).toEqual(['/products/foo']);
    });
  });

  describe('buildImportRequests', () => {
    it('builds import requests from manifest with folder IDs', () => {
      const manifest = [
        {
          name: 'Monterey Futon Frame',
          slug: 'monterey',
          folder: '/products/futon-frames',
          images: [
            'https://static.wixstatic.com/media/e04e89_cf15.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
            'https://static.wixstatic.com/media/e04e89_d88f.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
          ],
        },
      ];
      const folderIds = { '/products/futon-frames': 'folder123' };
      const requests = importProductPhotos.buildImportRequests(manifest, folderIds);
      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual({
        url: 'https://static.wixstatic.com/media/e04e89_cf15.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
        displayName: 'monterey-1',
        mimeType: 'image/jpeg',
        mediaType: 'IMAGE',
        parentFolderId: 'folder123',
      });
      expect(requests[1].displayName).toBe('monterey-2');
    });

    it('detects MIME type from URL extension', () => {
      const manifest = [
        {
          slug: 'test',
          folder: '/products/foo',
          images: [
            'https://example.com/image.png/v1/fit/w_1200,h_627,q_90/file.png',
            'https://example.com/image.jpg/v1/fit/w_1200,h_627,q_90/file.jpg',
            'https://example.com/image.webp/v1/fit/w_1200,h_627,q_90/file.webp',
          ],
        },
      ];
      const folderIds = { '/products/foo': 'f1' };
      const requests = importProductPhotos.buildImportRequests(manifest, folderIds);
      expect(requests[0].mimeType).toBe('image/png');
      expect(requests[1].mimeType).toBe('image/jpeg');
      expect(requests[2].mimeType).toBe('image/webp');
    });

    it('falls back to media-root if folder ID not found', () => {
      const manifest = [
        { slug: 'test', folder: '/unknown', images: ['https://example.com/img.jpg'] },
      ];
      const requests = importProductPhotos.buildImportRequests(manifest, {});
      expect(requests[0].parentFolderId).toBe('media-root');
    });

    it('returns empty array for empty manifest', () => {
      expect(importProductPhotos.buildImportRequests([], {})).toEqual([]);
    });
  });

  describe('chunkArray', () => {
    it('splits array into chunks of given size', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(importProductPhotos.chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('handles array smaller than chunk size', () => {
      expect(importProductPhotos.chunkArray([1], 100)).toEqual([[1]]);
    });

    it('handles empty array', () => {
      expect(importProductPhotos.chunkArray([], 10)).toEqual([]);
    });
  });

  describe('createFolder', () => {
    it('creates a folder via Wix REST API', async () => {
      mockFetch.mockResolvedValueOnce(folderResponse('abc123', 'futon-frames', 'productsRoot'));

      const result = await importProductPhotos.createFolder(
        'futon-frames',
        'productsRoot',
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result).toEqual({
        id: 'abc123',
        displayName: 'futon-frames',
        parentFolderId: 'productsRoot',
        createdDate: '2026-03-08T00:00:00.000Z',
        updatedDate: '2026-03-08T00:00:00.000Z',
        state: 'OK',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.wixapis.com/site-media/v1/folders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'IST.test',
            'wix-site-id': 'site123',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            displayName: 'futon-frames',
            parentFolderId: 'productsRoot',
          }),
        })
      );
    });

    it('throws on API error with status and message', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));

      await expect(
        importProductPhotos.createFolder('test', 'root', { apiKey: 'IST.bad', siteId: 's' })
      ).rejects.toThrow(/403/);
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        importProductPhotos.createFolder('test', 'root', { apiKey: 'k', siteId: 's' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('bulkImportFiles', () => {
    it('imports a batch of files via Wix REST API', async () => {
      const requests = [
        { url: 'https://example.com/1.jpg', displayName: 'img-1', mimeType: 'image/jpeg', mediaType: 'IMAGE', parentFolderId: 'f1' },
        { url: 'https://example.com/2.jpg', displayName: 'img-2', mimeType: 'image/jpeg', mediaType: 'IMAGE', parentFolderId: 'f1' },
      ];
      mockFetch.mockResolvedValueOnce(bulkImportResponse(requests));

      const result = await importProductPhotos.bulkImportFiles(
        requests,
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result.bulkActionMetadata.totalSuccesses).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].itemMetadata.success).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.wixapis.com/site-media/v1/bulk/files/import-v2',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'IST.test',
            'wix-site-id': 'site123',
          }),
          body: JSON.stringify({ importFileRequests: requests }),
        })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad Request'));

      await expect(
        importProductPhotos.bulkImportFiles(
          [{ url: 'https://example.com/1.jpg' }],
          { apiKey: 'k', siteId: 's' }
        )
      ).rejects.toThrow(/400/);
    });

    it('rejects batches exceeding 100 items', async () => {
      const oversized = Array.from({ length: 101 }, (_, i) => ({
        url: `https://example.com/${i}.jpg`,
      }));

      await expect(
        importProductPhotos.bulkImportFiles(oversized, { apiKey: 'k', siteId: 's' })
      ).rejects.toThrow(/100/);
    });
  });

  describe('ensureFolderStructure', () => {
    it('creates products root and category sub-folders', async () => {
      // First call: create "products" root folder
      mockFetch.mockResolvedValueOnce(folderResponse('productsRootId', 'products'));
      // Subsequent calls: category folders
      mockFetch.mockResolvedValueOnce(folderResponse('ff1', 'futon-frames', 'productsRootId'));
      mockFetch.mockResolvedValueOnce(folderResponse('ff2', 'mattresses', 'productsRootId'));

      const folderPaths = ['/products/futon-frames', '/products/mattresses'];
      const result = await importProductPhotos.ensureFolderStructure(
        folderPaths,
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result).toEqual({
        '/products/futon-frames': 'ff1',
        '/products/mattresses': 'ff2',
      });
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 root + 2 categories
    });

    it('handles empty folder list', async () => {
      const result = await importProductPhotos.ensureFolderStructure(
        [],
        { apiKey: 'k', siteId: 's' }
      );
      expect(result).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('inferMimeType', () => {
    it('infers MIME type from wixstatic URLs', () => {
      expect(importProductPhotos.inferMimeType(
        'https://static.wixstatic.com/media/e04e89_cf15.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg'
      )).toBe('image/jpeg');
      expect(importProductPhotos.inferMimeType(
        'https://static.wixstatic.com/media/ed8a72_a334.png/v1/fit/w_1200,h_627,q_90/file.png'
      )).toBe('image/png');
    });

    it('defaults to image/jpeg for unknown extensions', () => {
      expect(importProductPhotos.inferMimeType('https://example.com/file')).toBe('image/jpeg');
    });
  });

  describe('getConfig', () => {
    it('reads config from environment variables', () => {
      const original = { ...process.env };
      process.env.WIX_BACKEND_KEY = 'IST.testkey';
      process.env.WIX_SITE_ID = 'test-site-id';

      const config = importProductPhotos.getConfig();
      expect(config).toEqual({
        apiKey: 'IST.testkey',
        siteId: 'test-site-id',
      });

      process.env = original;
    });

    it('throws if WIX_BACKEND_KEY is missing', () => {
      const original = { ...process.env };
      delete process.env.WIX_BACKEND_KEY;
      process.env.WIX_SITE_ID = 'test';

      expect(() => importProductPhotos.getConfig()).toThrow(/WIX_BACKEND_KEY/);

      process.env = original;
    });

    it('throws if WIX_SITE_ID is missing', () => {
      const original = { ...process.env };
      process.env.WIX_BACKEND_KEY = 'IST.test';
      delete process.env.WIX_SITE_ID;

      expect(() => importProductPhotos.getConfig()).toThrow(/WIX_SITE_ID/);

      process.env = original;
    });
  });

  describe('runImport (integration)', () => {
    it('orchestrates folder creation + batched import', async () => {
      const miniManifest = [
        {
          name: 'Test Product',
          slug: 'test-product',
          folder: '/products/test-cat',
          images: [
            'https://static.wixstatic.com/media/e04e89_aaa.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
            'https://static.wixstatic.com/media/e04e89_bbb.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
          ],
        },
      ];

      // createFolder: products root
      mockFetch.mockResolvedValueOnce(folderResponse('rootId', 'products'));
      // createFolder: test-cat
      mockFetch.mockResolvedValueOnce(folderResponse('catId', 'test-cat', 'rootId'));
      // bulkImportFiles: 2 images
      mockFetch.mockResolvedValueOnce(bulkImportResponse([
        { url: 'https://a.com/1.jpg', displayName: 'test-product-1', parentFolderId: 'catId' },
        { url: 'https://a.com/2.jpg', displayName: 'test-product-2', parentFolderId: 'catId' },
      ]));

      const result = await importProductPhotos.runImport(
        miniManifest,
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result.totalImages).toBe(2);
      expect(result.totalSuccess).toBe(2);
      expect(result.totalFailed).toBe(0);
      expect(result.batches).toBe(1);
    });

    it('handles partial batch failures gracefully', async () => {
      const manifest = [
        {
          slug: 'prod1',
          folder: '/products/cat',
          images: ['https://example.com/1.jpg'],
        },
      ];

      // Folders
      mockFetch.mockResolvedValueOnce(folderResponse('rootId', 'products'));
      mockFetch.mockResolvedValueOnce(folderResponse('catId', 'cat', 'rootId'));

      // Bulk import with partial failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              item: {},
              itemMetadata: { id: 'x', originalIndex: 0, success: false, error: { code: 'UNSUPPORTED', description: 'bad format' } },
            },
          ],
          bulkActionMetadata: { totalSuccesses: 0, totalFailures: 1 },
        }),
      });

      const result = await importProductPhotos.runImport(
        manifest,
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result.totalFailed).toBe(1);
      expect(result.totalSuccess).toBe(0);
      expect(result.failures).toHaveLength(1);
    });

    it('batches imports when over 100 images', async () => {
      const images = Array.from({ length: 150 }, (_, i) =>
        `https://static.wixstatic.com/media/e04e89_${i}.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg`
      );
      const manifest = [{ slug: 'big', folder: '/products/cat', images }];

      // Folders
      mockFetch.mockResolvedValueOnce(folderResponse('rootId', 'products'));
      mockFetch.mockResolvedValueOnce(folderResponse('catId', 'cat', 'rootId'));
      // Batch 1 (100 images)
      mockFetch.mockResolvedValueOnce(bulkImportResponse(
        Array.from({ length: 100 }, (_, i) => ({ url: `u${i}`, displayName: `big-${i + 1}` }))
      ));
      // Batch 2 (50 images)
      mockFetch.mockResolvedValueOnce(bulkImportResponse(
        Array.from({ length: 50 }, (_, i) => ({ url: `u${i}`, displayName: `big-${i + 101}` }))
      ));

      const result = await importProductPhotos.runImport(
        manifest,
        { apiKey: 'IST.test', siteId: 'site123' }
      );

      expect(result.batches).toBe(2);
      expect(result.totalSuccess).toBe(150);
      // 2 folder creates + 2 bulk imports
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('dry run mode', () => {
    it('does not call API in dry run mode', async () => {
      const manifest = [
        { slug: 'test', folder: '/products/foo', images: ['https://example.com/1.jpg'] },
      ];

      const result = await importProductPhotos.runImport(
        manifest,
        { apiKey: 'IST.test', siteId: 'site123' },
        { dryRun: true }
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.totalImages).toBe(1);
    });
  });
});
