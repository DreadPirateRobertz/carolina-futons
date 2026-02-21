/**
 * @module mediaGallery
 * @description Wix Media Manager integration for product gallery photos.
 * Pulls images from Media Manager into product displays using wix-media-backend.
 * Provides static permanent URLs (wixstatic.com) for gallery display,
 * folder browsing, and product media sync.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-media-backend
 * @requires wix-members-backend
 *
 * @setup
 * In Wix Media Manager, organize product photos into folders:
 * - /products/futon-frames/
 * - /products/mattresses/
 * - /products/murphy-cabinet-beds/
 * - /products/platform-beds/
 * - /products/outdoor-furniture/
 * - /products/casegoods-accessories/
 * - /products/covers/
 * - /products/pillows/
 *
 * Create CMS collection "MediaSync" with fields:
 * - productId (Text, indexed) - Reference to Stores/Products
 * - mediaItems (Text) - JSON array of media objects
 * - lastSynced (DateTime) - When media was last pulled
 * - mediaCount (Number) - Total media items
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { mediaManager } from 'wix-media-backend';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const MEDIA_SYNC_COLLECTION = 'MediaSync';
const PRODUCTS_COLLECTION = 'Stores/Products';

// Static base URL for permanent image display (no token expiry)
const STATIC_BASE_URL = 'https://static.wixstatic.com/media/';

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

// Product category folders in Media Manager
const CATEGORY_FOLDERS = {
  'futon-frames': '/products/futon-frames',
  'mattresses': '/products/mattresses',
  'murphy-cabinet-beds': '/products/murphy-cabinet-beds',
  'platform-beds': '/products/platform-beds',
  'outdoor-furniture': '/products/outdoor-furniture',
  'casegoods-accessories': '/products/casegoods-accessories',
  'covers': '/products/covers',
  'pillows-702': '/products/pillows',
};

// ── Admin check ─────────────────────────────────────────────────────

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required.');
  }
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) {
    throw new Error('Admin access required.');
  }
  return member._id;
}

// ── Helper: extract file name from wix:image URL ────────────────────

function extractFileName(wixImageUrl) {
  if (!wixImageUrl || typeof wixImageUrl !== 'string') return null;

  // Handle wix:image://v1/{fileName}/... format
  const wixMatch = wixImageUrl.match(/wix:image:\/\/v1\/([^/]+)/);
  if (wixMatch) return wixMatch[1];

  // Handle direct media URLs
  const mediaMatch = wixImageUrl.match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  if (mediaMatch) return mediaMatch[1];

  return null;
}

// ── Helper: build static URL from file name ─────────────────────────

function buildStaticUrl(fileName, options = {}) {
  if (!fileName) return null;
  const { width, height, quality } = options;

  let url = `${STATIC_BASE_URL}${fileName}`;

  // Add Wix image transform params if requested
  const transforms = [];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (quality) transforms.push(`q_${quality}`);

  if (transforms.length > 0) {
    url = `${STATIC_BASE_URL}${fileName}/v1/fill/${transforms.join(',')}/${fileName}`;
  }

  return url;
}

// ── getProductMedia (public) ────────────────────────────────────────

export const getProductMedia = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) {
        return { success: false, error: 'Product ID required' };
      }

      const { width, height, quality, limit = 20 } = options;
      const safeLimit = Math.min(Math.max(1, limit), 50);

      // First try cached media sync
      const cached = await wixData.query(MEDIA_SYNC_COLLECTION)
        .eq('productId', cleanId)
        .find();

      if (cached.items.length > 0) {
        const syncData = cached.items[0];
        let mediaItems;
        try {
          mediaItems = JSON.parse(syncData.mediaItems || '[]');
        } catch {
          mediaItems = [];
        }

        const items = mediaItems.slice(0, safeLimit).map(item => ({
          ...item,
          staticUrl: buildStaticUrl(item.fileName, { width, height, quality }),
          thumbnailUrl: buildStaticUrl(item.fileName, { width: 150, height: 150, quality: 80 }),
        }));

        return {
          success: true,
          productId: cleanId,
          mediaCount: mediaItems.length,
          items,
          lastSynced: syncData.lastSynced,
        };
      }

      // Fall back to Stores/Products collection
      const product = await wixData.query(PRODUCTS_COLLECTION)
        .eq('_id', cleanId)
        .find();

      if (product.items.length === 0) {
        return { success: true, productId: cleanId, mediaCount: 0, items: [] };
      }

      const prod = product.items[0];
      const mediaItems = prod.mediaItems || [];

      const items = mediaItems.slice(0, safeLimit).map((media, index) => {
        const fileName = extractFileName(media.src || media.image || '');
        return {
          src: media.src || media.image || '',
          fileName: fileName || '',
          type: media.type || 'image',
          title: media.title || prod.name || '',
          altText: media.altText || `${prod.name} - Image ${index + 1}`,
          staticUrl: buildStaticUrl(fileName, { width, height, quality }),
          thumbnailUrl: buildStaticUrl(fileName, { width: 150, height: 150, quality: 80 }),
        };
      });

      return {
        success: true,
        productId: cleanId,
        mediaCount: items.length,
        items,
        lastSynced: null,
      };
    } catch (err) {
      console.error('getProductMedia error:', err);
      return { success: false, error: 'Unable to fetch product media' };
    }
  }
);

// ── getBatchProductThumbnails (public, for category pages) ──────────

export const getBatchProductThumbnails = webMethod(
  Permissions.Anyone,
  async (productIds = [], options = {}) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: true, thumbnails: {} };
      }

      const cleanIds = productIds
        .map(id => sanitize(id, 50))
        .filter(Boolean)
        .slice(0, 50);

      if (cleanIds.length === 0) {
        return { success: true, thumbnails: {} };
      }

      const { width = 400, height = 400, quality = 85 } = options;

      // Query products for main media
      const products = await wixData.query(PRODUCTS_COLLECTION)
        .hasSome('_id', cleanIds)
        .find();

      const thumbnails = {};

      for (const prod of products.items) {
        const mainMedia = prod.mainMedia || (prod.mediaItems && prod.mediaItems[0]);
        if (mainMedia) {
          const src = mainMedia.src || mainMedia.image || mainMedia;
          const fileName = extractFileName(typeof src === 'string' ? src : '');
          thumbnails[prod._id] = {
            src: typeof src === 'string' ? src : '',
            staticUrl: buildStaticUrl(fileName, { width, height, quality }),
            thumbnailUrl: buildStaticUrl(fileName, { width: 150, height: 150, quality: 80 }),
            altText: `${prod.name || 'Product'} thumbnail`,
          };
        }
      }

      return { success: true, thumbnails };
    } catch (err) {
      console.error('getBatchProductThumbnails error:', err);
      return { success: false, error: 'Unable to fetch thumbnails' };
    }
  }
);

// ── listMediaFolder (admin) ─────────────────────────────────────────

export const listMediaFolder = webMethod(
  Permissions.SiteMember,
  async (folderPath, options = {}) => {
    try {
      await requireAdmin();

      const cleanPath = sanitize(folderPath, 200);
      if (!cleanPath) {
        return { success: false, error: 'Folder path required' };
      }

      const { limit = 50 } = options;
      const safeLimit = Math.min(Math.max(1, limit), 100);

      // List files in the specified folder
      const result = await mediaManager.listFiles({
        parentFolderId: cleanPath,
        paging: { limit: safeLimit },
      });

      const files = (result.files || result.mediaFiles || []).map(file => {
        const fileName = file.fileName || file.fileUrl || '';
        return {
          fileName,
          originalFileName: file.originalFileName || '',
          mimeType: file.mimeType || '',
          width: file.width || 0,
          height: file.height || 0,
          sizeInBytes: file.sizeInBytes || 0,
          staticUrl: buildStaticUrl(fileName),
          thumbnailUrl: buildStaticUrl(fileName, { width: 150, height: 150, quality: 80 }),
        };
      });

      return {
        success: true,
        folder: cleanPath,
        files,
        totalCount: files.length,
      };
    } catch (err) {
      console.error('listMediaFolder error:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── listMediaFolders (admin) ────────────────────────────────────────

export const listMediaFolders = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireAdmin();

      const result = await mediaManager.listFolders();
      const folders = (result.folders || []).map(f => ({
        folderId: f._id || f.folderId || '',
        folderName: f.folderName || f.displayName || '',
        parentFolderId: f.parentFolderId || '',
      }));

      return { success: true, folders };
    } catch (err) {
      console.error('listMediaFolders error:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── syncProductMedia (admin — pulls from Media Manager to cache) ────

export const syncProductMedia = webMethod(
  Permissions.SiteMember,
  async (productId) => {
    try {
      await requireAdmin();

      const cleanId = sanitize(productId, 50);
      if (!cleanId) {
        return { success: false, error: 'Product ID required' };
      }

      // Get product from Stores
      const product = await wixData.query(PRODUCTS_COLLECTION)
        .eq('_id', cleanId)
        .find();

      if (product.items.length === 0) {
        return { success: false, error: 'Product not found' };
      }

      const prod = product.items[0];
      const mediaItems = (prod.mediaItems || []).map((media, index) => {
        const fileName = extractFileName(media.src || media.image || '');
        return {
          src: media.src || media.image || '',
          fileName: fileName || '',
          type: media.type || 'image',
          title: media.title || '',
          altText: media.altText || `${prod.name} - Image ${index + 1}`,
        };
      });

      const now = new Date();
      const mediaJson = JSON.stringify(mediaItems);

      // Upsert sync record
      const existing = await wixData.query(MEDIA_SYNC_COLLECTION)
        .eq('productId', cleanId)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        record.mediaItems = mediaJson;
        record.lastSynced = now;
        record.mediaCount = mediaItems.length;
        await wixData.update(MEDIA_SYNC_COLLECTION, record);
      } else {
        await wixData.insert(MEDIA_SYNC_COLLECTION, {
          productId: cleanId,
          mediaItems: mediaJson,
          lastSynced: now,
          mediaCount: mediaItems.length,
        });
      }

      return {
        success: true,
        productId: cleanId,
        mediaCount: mediaItems.length,
        lastSynced: now,
      };
    } catch (err) {
      console.error('syncProductMedia error:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── batchSyncMedia (admin — sync all products) ─────────────────────

export const batchSyncMedia = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      await requireAdmin();

      const { limit = 50 } = options;
      const safeLimit = Math.min(Math.max(1, limit), 200);

      const products = await wixData.query(PRODUCTS_COLLECTION)
        .limit(safeLimit)
        .find();

      let synced = 0;
      const now = new Date();

      for (const prod of products.items) {
        const mediaItems = (prod.mediaItems || []).map((media, index) => {
          const fileName = extractFileName(media.src || media.image || '');
          return {
            src: media.src || media.image || '',
            fileName: fileName || '',
            type: media.type || 'image',
            title: media.title || '',
            altText: media.altText || `${prod.name} - Image ${index + 1}`,
          };
        });

        const mediaJson = JSON.stringify(mediaItems);

        const existing = await wixData.query(MEDIA_SYNC_COLLECTION)
          .eq('productId', prod._id)
          .find();

        if (existing.items.length > 0) {
          const record = existing.items[0];
          record.mediaItems = mediaJson;
          record.lastSynced = now;
          record.mediaCount = mediaItems.length;
          await wixData.update(MEDIA_SYNC_COLLECTION, record);
        } else {
          await wixData.insert(MEDIA_SYNC_COLLECTION, {
            productId: prod._id,
            mediaItems: mediaJson,
            lastSynced: now,
            mediaCount: mediaItems.length,
          });
        }

        synced++;
      }

      return { success: true, synced, totalProducts: products.items.length };
    } catch (err) {
      console.error('batchSyncMedia error:', err);
      return { success: false, error: err.message };
    }
  }
);

// ── getImageUrl (public utility) ────────────────────────────────────

export const getImageUrl = webMethod(
  Permissions.Anyone,
  async (wixImageUrl, options = {}) => {
    try {
      if (!wixImageUrl || typeof wixImageUrl !== 'string') {
        return { success: false, error: 'Image URL required' };
      }

      const cleanUrl = sanitize(wixImageUrl, 500);
      const fileName = extractFileName(cleanUrl);

      if (!fileName) {
        return { success: false, error: 'Could not extract file name from URL' };
      }

      const { width, height, quality } = options;

      return {
        success: true,
        fileName,
        staticUrl: buildStaticUrl(fileName, { width, height, quality }),
        thumbnailUrl: buildStaticUrl(fileName, { width: 150, height: 150, quality: 80 }),
        originalUrl: cleanUrl,
      };
    } catch (err) {
      console.error('getImageUrl error:', err);
      return { success: false, error: 'Unable to process image URL' };
    }
  }
);

// ── getMediaStats (admin dashboard) ─────────────────────────────────

export const getMediaStats = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireAdmin();

      const syncRecords = await wixData.query(MEDIA_SYNC_COLLECTION)
        .limit(1000)
        .find();

      let totalImages = 0;
      let productsWithMedia = 0;
      let productsWithoutMedia = 0;

      for (const record of syncRecords.items) {
        if (record.mediaCount > 0) {
          productsWithMedia++;
          totalImages += record.mediaCount;
        } else {
          productsWithoutMedia++;
        }
      }

      return {
        success: true,
        stats: {
          totalSyncedProducts: syncRecords.items.length,
          productsWithMedia,
          productsWithoutMedia,
          totalImages,
          avgImagesPerProduct: syncRecords.items.length > 0
            ? Math.round((totalImages / syncRecords.items.length) * 10) / 10
            : 0,
        },
      };
    } catch (err) {
      console.error('getMediaStats error:', err);
      return { success: false, error: err.message };
    }
  }
);
