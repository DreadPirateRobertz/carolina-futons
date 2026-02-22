/**
 * @module productVideos
 * @description Product video service for embedding assembly videos,
 * product demos, and brand content on product pages. Serves YouTube
 * embeds, MP4 animations, and Amazon Live links matched to products.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collection:
 *   ProductVideos - Video catalog entries
 *     videoId (Text, indexed) - Unique video ID (e.g. v-kd-001)
 *     title (Text) - Video title
 *     brand (Text, indexed) - Manufacturer brand name
 *     type (Text, indexed) - 'assembly'|'demo'|'overview'|'animation'|'review'
 *     category (Text, indexed) - Product category slug
 *     youtubeUrl (Text) - YouTube watch URL
 *     mp4Url (Text) - Self-hosted MP4 URL
 *     thumbnailUrl (Text) - Video thumbnail image
 *     productSlugs (Text) - JSON array of product slugs this video matches
 *     duration (Number) - Video duration in seconds
 *     sortOrder (Number) - Display priority
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const VALID_VIDEO_TYPES = ['assembly', 'demo', 'overview', 'animation', 'review'];

const VALID_CATEGORIES = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
  'unfinished-wood', 'covers', 'outdoor-furniture', 'log-frames', 'pillows',
];

// ── Helpers ──────────────────────────────────────────────────────────

function cleanSlug(slug) {
  if (!slug || typeof slug !== 'string') return '';
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);
}

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];
  try { return JSON.parse(val); } catch { return []; }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatVideo(video) {
  const youtubeId = extractYouTubeId(video.youtubeUrl);
  return {
    videoId: video.videoId,
    title: video.title,
    brand: video.brand,
    type: video.type,
    category: video.category,
    youtubeUrl: video.youtubeUrl || null,
    youtubeId,
    embedUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null,
    mp4Url: video.mp4Url || null,
    thumbnailUrl: video.thumbnailUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null),
    productSlugs: parseJsonArray(video.productSlugs),
    duration: video.duration || null,
  };
}

// ── getProductVideos ─────────────────────────────────────────────────

/**
 * Returns all videos matching a product slug.
 * @param {string} slug - Product URL slug
 */
export const getProductVideos = webMethod(Permissions.Anyone, async (slug) => {
  try {
    const cleanedSlug = cleanSlug(slug);
    if (!cleanedSlug) {
      return { success: false, error: 'Invalid product slug' };
    }

    const result = await wixData.query('ProductVideos')
      .contains('productSlugs', cleanedSlug)
      .ascending('sortOrder')
      .limit(20)
      .find();

    // Filter results to ensure exact slug match within the JSON array
    const matched = result.items.filter(v => {
      const slugs = parseJsonArray(v.productSlugs);
      return slugs.includes(cleanedSlug);
    });

    return {
      success: true,
      data: matched.map(formatVideo),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load product videos' };
  }
});

// ── getCategoryVideos ────────────────────────────────────────────────

/**
 * Returns all videos for a product category.
 * @param {string} category - Category slug
 */
export const getCategoryVideos = webMethod(Permissions.Anyone, async (category) => {
  try {
    if (!category || typeof category !== 'string') {
      return { success: false, error: 'Invalid category' };
    }

    const clean = sanitize(category, 50).toLowerCase();
    if (!VALID_CATEGORIES.includes(clean)) {
      return { success: false, error: 'Unknown category' };
    }

    const result = await wixData.query('ProductVideos')
      .eq('category', clean)
      .ascending('sortOrder')
      .limit(50)
      .find();

    return {
      success: true,
      data: result.items.map(formatVideo),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load category videos' };
  }
});

// ── getBrandVideos ───────────────────────────────────────────────────

/**
 * Returns all videos for a specific brand.
 * @param {string} brand - Brand name
 */
export const getBrandVideos = webMethod(Permissions.Anyone, async (brand) => {
  try {
    if (!brand || typeof brand !== 'string') {
      return { success: false, error: 'Invalid brand name' };
    }

    const cleanBrand = sanitize(brand, 100);

    const result = await wixData.query('ProductVideos')
      .eq('brand', cleanBrand)
      .ascending('sortOrder')
      .limit(50)
      .find();

    return {
      success: true,
      data: result.items.map(formatVideo),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load brand videos' };
  }
});

// ── getAssemblyVideo ─────────────────────────────────────────────────

/**
 * Returns the primary assembly video for a product. Quick lookup
 * for the "Assembly Instructions" button on product pages.
 * @param {string} slug - Product URL slug
 */
export const getAssemblyVideo = webMethod(Permissions.Anyone, async (slug) => {
  try {
    const cleanedSlug = cleanSlug(slug);
    if (!cleanedSlug) {
      return { success: false, error: 'Invalid product slug' };
    }

    const result = await wixData.query('ProductVideos')
      .eq('type', 'assembly')
      .contains('productSlugs', cleanedSlug)
      .ascending('sortOrder')
      .limit(5)
      .find();

    const matched = result.items.filter(v => {
      const slugs = parseJsonArray(v.productSlugs);
      return slugs.includes(cleanedSlug);
    });

    if (matched.length === 0) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: formatVideo(matched[0]),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load assembly video' };
  }
});

// ── saveVideo (admin) ────────────────────────────────────────────────

/**
 * Creates or updates a video catalog entry. Admin only.
 * @param {Object} video - Video data
 */
export const saveVideo = webMethod(Permissions.Admin, async (video) => {
  try {
    if (!video || typeof video !== 'object') {
      return { success: false, error: 'Invalid video data' };
    }

    if (!video.title || typeof video.title !== 'string') {
      return { success: false, error: 'Video title is required' };
    }
    if (!video.brand || typeof video.brand !== 'string') {
      return { success: false, error: 'Brand is required' };
    }
    if (!video.type || !VALID_VIDEO_TYPES.includes(video.type)) {
      return { success: false, error: `Video type must be one of: ${VALID_VIDEO_TYPES.join(', ')}` };
    }
    if (!video.youtubeUrl && !video.mp4Url) {
      return { success: false, error: 'Either youtubeUrl or mp4Url is required' };
    }

    const record = {
      videoId: video.videoId || `v-${Date.now()}`,
      title: sanitize(video.title, 200),
      brand: sanitize(video.brand, 100),
      type: video.type,
      category: video.category ? sanitize(video.category, 50).toLowerCase() : null,
      youtubeUrl: video.youtubeUrl ? sanitize(video.youtubeUrl, 500) : null,
      mp4Url: video.mp4Url ? sanitize(video.mp4Url, 500) : null,
      thumbnailUrl: video.thumbnailUrl ? sanitize(video.thumbnailUrl, 500) : null,
      productSlugs: Array.isArray(video.productSlugs) ? JSON.stringify(video.productSlugs) : '[]',
      duration: typeof video.duration === 'number' ? video.duration : null,
      sortOrder: typeof video.sortOrder === 'number' ? video.sortOrder : 0,
    };

    let saved;
    if (video._id) {
      record._id = video._id;
      saved = await wixData.update('ProductVideos', record);
    } else {
      saved = await wixData.insert('ProductVideos', record);
    }

    return {
      success: true,
      data: formatVideo(saved),
    };
  } catch (err) {
    return { success: false, error: 'Failed to save video' };
  }
});

// ── getAllVideos (admin) ──────────────────────────────────────────────

/**
 * Returns all videos in the catalog. Admin only — for management UI.
 * @param {number} [page=0] - Page number (0-indexed)
 * @param {number} [pageSize=50] - Items per page
 */
export const getAllVideos = webMethod(Permissions.Admin, async (page = 0, pageSize = 50) => {
  try {
    const skip = Math.max(0, page) * Math.min(pageSize, 100);
    const limit = Math.min(Math.max(1, pageSize), 100);

    const result = await wixData.query('ProductVideos')
      .ascending('brand')
      .ascending('sortOrder')
      .skip(skip)
      .limit(limit)
      .find();

    return {
      success: true,
      data: {
        videos: result.items.map(formatVideo),
        totalCount: result.totalCount || result.items.length,
        page,
        pageSize: limit,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load videos' };
  }
});
