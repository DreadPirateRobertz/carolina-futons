/**
 * @module productReviews
 * @description Unified product reviews API for product pages.
 * Combines text reviews (reviewsService) and photo reviews (photoReviews)
 * into a single entry point. Provides combined summaries, unified feeds,
 * and review highlights for product cards and listing pages.
 *
 * Use this module from page files — it orchestrates the underlying services.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';

const REVIEWS_COLLECTION = 'Reviews';
const PHOTO_REVIEWS_COLLECTION = 'PhotoReviews';

// ── Combined Review Summary ─────────────────────────────────────────

/**
 * Get combined review summary for a product page header.
 * Aggregates both text reviews and photo reviews into a single summary.
 *
 * @function getReviewSummary
 * @param {string} productId - Product ID
 * @returns {Promise<{averageRating: number, totalReviews: number, totalPhotos: number, breakdown: Object, recommendRate: number}>}
 * @permission Anyone
 */
export const getReviewSummary = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const pid = validateId(productId);
    if (!pid) {
      return {
        averageRating: 0, totalReviews: 0, totalPhotos: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recommendRate: 0,
      };
    }

    try {
      const [textReviews, photoReviews] = await Promise.all([
        wixData.query(REVIEWS_COLLECTION)
          .eq('productId', pid)
          .eq('status', 'approved')
          .limit(1000)
          .find(),
        wixData.query(PHOTO_REVIEWS_COLLECTION)
          .eq('productId', pid)
          .hasSome('status', ['approved', 'featured'])
          .limit(1000)
          .find(),
      ]);

      const allRatings = [
        ...textReviews.items.map(r => r.rating),
        ...photoReviews.items.map(r => r.rating),
      ];

      if (allRatings.length === 0) {
        return {
          averageRating: 0, totalReviews: 0, totalPhotos: 0,
          breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recommendRate: 0,
        };
      }

      const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sum = 0;
      for (const r of allRatings) {
        const clamped = Math.min(5, Math.max(1, Math.round(r)));
        breakdown[clamped]++;
        sum += clamped;
      }

      const avg = Math.round((sum / allRatings.length) * 10) / 10;
      const highRatings = allRatings.filter(r => r >= 4).length;
      const recommendRate = Math.round((highRatings / allRatings.length) * 100);

      // Count photos from both text reviews (multi-photo) and photo reviews
      const textPhotos = textReviews.items.reduce(
        (count, r) => count + (Array.isArray(r.photos) ? r.photos.length : 0), 0
      );
      const photoReviewPhotos = photoReviews.items.filter(r => r.photoUrl).length;

      return {
        averageRating: avg,
        totalReviews: allRatings.length,
        totalPhotos: textPhotos + photoReviewPhotos,
        breakdown,
        recommendRate,
      };
    } catch (err) {
      console.error('[productReviews] getReviewSummary error:', err);
      return {
        averageRating: 0, totalReviews: 0, totalPhotos: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recommendRate: 0,
      };
    }
  }
);

// ── Unified Review Feed ─────────────────────────────────────────────

/**
 * Get a unified feed of all reviews (text + photo) for a product.
 * Returns a combined, sorted list for the reviews tab on product pages.
 *
 * @function getUnifiedReviews
 * @param {string} productId - Product ID
 * @param {Object} [options]
 * @param {string} [options.sort='newest'] - 'newest' | 'highest' | 'lowest' | 'helpful' | 'photos'
 * @param {number} [options.filterStars] - Filter by star rating (1-5), omit for all
 * @param {number} [options.limit=10] - Max reviews
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {Promise<{reviews: Array, total: number, hasMore: boolean}>}
 * @permission Anyone
 */
export const getUnifiedReviews = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    const pid = validateId(productId);
    if (!pid) return { reviews: [], total: 0, hasMore: false };

    const { sort = 'newest', filterStars, limit = 10, offset = 0 } = options;
    const safeLimit = Math.max(1, Math.min(50, limit));
    const safeOffset = Math.max(0, offset);

    try {
      // Fetch both types
      let textQuery = wixData.query(REVIEWS_COLLECTION)
        .eq('productId', pid)
        .eq('status', 'approved');

      let photoQuery = wixData.query(PHOTO_REVIEWS_COLLECTION)
        .eq('productId', pid)
        .hasSome('status', ['approved', 'featured']);

      if (filterStars >= 1 && filterStars <= 5) {
        const star = Math.round(filterStars);
        textQuery = textQuery.eq('rating', star);
        photoQuery = photoQuery.eq('rating', star);
      }

      const [textResult, photoResult] = await Promise.all([
        textQuery.limit(200).find(),
        photoQuery.limit(200).find(),
      ]);

      // Normalize both types into a unified format
      const unified = [
        ...textResult.items.map(r => ({
          _id: r._id,
          type: 'text',
          authorName: r.authorName || 'Customer',
          rating: r.rating,
          title: r.title || '',
          body: r.body || '',
          photos: r.photos || [],
          verifiedPurchase: r.verifiedPurchase || false,
          helpful: r.helpful || 0,
          ownerResponse: r.ownerResponse || null,
          date: r._createdDate || null,
        })),
        ...photoResult.items.map(r => ({
          _id: r._id,
          type: 'photo',
          authorName: 'Customer',
          rating: r.rating,
          title: '',
          body: r.reviewText || '',
          photos: r.photoUrl ? [r.photoUrl] : [],
          photoCaption: r.photoCaption || '',
          verifiedPurchase: false,
          helpful: r.helpfulCount || 0,
          featured: r.status === 'featured',
          ownerResponse: null,
          date: r.submittedAt || null,
        })),
      ];

      // Sort
      switch (sort) {
        case 'highest':
          unified.sort((a, b) => b.rating - a.rating);
          break;
        case 'lowest':
          unified.sort((a, b) => a.rating - b.rating);
          break;
        case 'helpful':
          unified.sort((a, b) => b.helpful - a.helpful);
          break;
        case 'photos':
          unified.sort((a, b) => b.photos.length - a.photos.length);
          break;
        default: // newest
          unified.sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return db - da;
          });
      }

      const total = unified.length;
      const paged = unified.slice(safeOffset, safeOffset + safeLimit);

      return {
        reviews: paged,
        total,
        hasMore: safeOffset + safeLimit < total,
      };
    } catch (err) {
      console.error('[productReviews] getUnifiedReviews error:', err);
      return { reviews: [], total: 0, hasMore: false };
    }
  }
);

// ── Review Highlights ───────────────────────────────────────────────

/**
 * Get review highlights for product cards and listing pages.
 * Returns the most helpful review and a photo review preview.
 *
 * @function getReviewHighlights
 * @param {string} productId - Product ID
 * @returns {Promise<{topReview: Object|null, topPhoto: Object|null, averageRating: number, reviewCount: number}>}
 * @permission Anyone
 */
export const getReviewHighlights = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const pid = validateId(productId);
    if (!pid) return { topReview: null, topPhoto: null, averageRating: 0, reviewCount: 0 };

    try {
      const [topText, topPhoto, summary] = await Promise.all([
        wixData.query(REVIEWS_COLLECTION)
          .eq('productId', pid)
          .eq('status', 'approved')
          .descending('helpful')
          .limit(1)
          .find(),
        wixData.query(PHOTO_REVIEWS_COLLECTION)
          .eq('productId', pid)
          .hasSome('status', ['approved', 'featured'])
          .descending('helpfulCount')
          .limit(1)
          .find(),
        getReviewSummary(productId),
      ]);

      const topReview = topText.items[0]
        ? {
            _id: topText.items[0]._id,
            authorName: topText.items[0].authorName || 'Customer',
            rating: topText.items[0].rating,
            title: topText.items[0].title || '',
            body: (topText.items[0].body || '').slice(0, 150),
            verifiedPurchase: topText.items[0].verifiedPurchase || false,
          }
        : null;

      const topPhotoReview = topPhoto.items[0]
        ? {
            _id: topPhoto.items[0]._id,
            photoUrl: topPhoto.items[0].photoUrl,
            rating: topPhoto.items[0].rating,
            body: (topPhoto.items[0].reviewText || '').slice(0, 100),
          }
        : null;

      return {
        topReview,
        topPhoto: topPhotoReview,
        averageRating: summary.averageRating,
        reviewCount: summary.totalReviews,
      };
    } catch (err) {
      console.error('[productReviews] getReviewHighlights error:', err);
      return { topReview: null, topPhoto: null, averageRating: 0, reviewCount: 0 };
    }
  }
);

// ── Batch Summary for Listings ──────────────────────────────────────

/**
 * Get review summaries for multiple products at once.
 * Used on category pages and search results for star ratings in product cards.
 *
 * @function getBatchReviewSummaries
 * @param {string[]} productIds - Array of product IDs (max 50)
 * @returns {Promise<Object>} Map of productId -> {averageRating, totalReviews}
 * @permission Anyone
 */
export const getBatchReviewSummaries = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    if (!Array.isArray(productIds) || productIds.length === 0) return {};

    const cleanIds = productIds
      .map(id => validateId(id))
      .filter(Boolean)
      .slice(0, 50);

    if (cleanIds.length === 0) return {};

    try {
      const [textReviews, photoReviews] = await Promise.all([
        wixData.query(REVIEWS_COLLECTION)
          .eq('status', 'approved')
          .hasSome('productId', cleanIds)
          .limit(1000)
          .find(),
        wixData.query(PHOTO_REVIEWS_COLLECTION)
          .hasSome('status', ['approved', 'featured'])
          .hasSome('productId', cleanIds)
          .limit(1000)
          .find(),
      ]);

      // Build per-product summary
      const summaries = {};
      for (const pid of cleanIds) {
        summaries[pid] = { averageRating: 0, totalReviews: 0 };
      }

      const allReviews = [
        ...textReviews.items.map(r => ({ productId: r.productId, rating: r.rating })),
        ...photoReviews.items.map(r => ({ productId: r.productId, rating: r.rating })),
      ];

      for (const r of allReviews) {
        if (!summaries[r.productId]) continue;
        summaries[r.productId].totalReviews++;
        summaries[r.productId].averageRating += Math.min(5, Math.max(1, Math.round(r.rating)));
      }

      for (const pid of cleanIds) {
        const s = summaries[pid];
        if (s.totalReviews > 0) {
          s.averageRating = Math.round((s.averageRating / s.totalReviews) * 10) / 10;
        }
      }

      return summaries;
    } catch (err) {
      console.error('[productReviews] getBatchReviewSummaries error:', err);
      return {};
    }
  }
);

// ── Admin: Combined Moderation Queue ────────────────────────────────

/**
 * Get combined moderation queue of pending text and photo reviews.
 *
 * @function getModerationQueue
 * @param {number} [limit=20] - Max items
 * @returns {Promise<{reviews: Array, total: number}>}
 * @permission Admin
 */
export const getModerationQueue = webMethod(
  Permissions.Admin,
  async (limit = 20) => {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));

      const [textPending, photoPending] = await Promise.all([
        wixData.query(REVIEWS_COLLECTION)
          .eq('status', 'pending')
          .descending('_createdDate')
          .limit(safeLimit)
          .find(),
        wixData.query(PHOTO_REVIEWS_COLLECTION)
          .eq('status', 'pending')
          .descending('submittedAt')
          .limit(safeLimit)
          .find(),
      ]);

      const combined = [
        ...textPending.items.map(r => ({
          _id: r._id,
          type: 'text',
          productId: r.productId,
          authorName: r.authorName || 'Customer',
          rating: r.rating,
          title: r.title || '',
          body: r.body || '',
          photos: r.photos || [],
          verifiedPurchase: r.verifiedPurchase || false,
          date: r._createdDate || null,
        })),
        ...photoPending.items.map(r => ({
          _id: r._id,
          type: 'photo',
          productId: r.productId,
          authorName: 'Customer',
          rating: r.rating,
          title: '',
          body: r.reviewText || '',
          photos: r.photoUrl ? [r.photoUrl] : [],
          photoCaption: r.photoCaption || '',
          date: r.submittedAt || null,
        })),
      ];

      // Sort by date descending
      combined.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      return {
        reviews: combined.slice(0, safeLimit),
        total: combined.length,
      };
    } catch (err) {
      console.error('[productReviews] getModerationQueue error:', err);
      return { reviews: [], total: 0 };
    }
  }
);
