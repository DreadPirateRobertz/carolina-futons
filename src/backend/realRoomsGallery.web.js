/**
 * @module realRoomsGallery.web
 * @description Real Rooms Shoppable Gallery — UGC photos from customers with
 * auto-detected product hotspot tags. Each tagged photo becomes an SEO landing
 * page with location data + alt text for long-tail keyword generation.
 *
 * @setup
 * Create `RealRoomPhotos` CMS collection:
 *   _id (auto), memberId (Text, indexed), memberName (Text),
 *   imageUrl (Text), city (Text), state (Text),
 *   tags (JSON — array of { productId, productName, x, y, width, height }),
 *   caption (Text), slug (Text, indexed, unique),
 *   status (Text: pending|approved|rejected, indexed),
 *   pointsAwarded (Number), createdAt (DateTime, indexed),
 *   altText (Text — auto-generated SEO alt text)
 *
 * CF-v62e
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

const COLLECTION = 'RealRoomPhotos';
const POINTS_PER_PHOTO = 150;
const MAX_TAGS_PER_PHOTO = 8;
const MAX_PHOTOS_PER_MEMBER = 20;

// ── Submit Photo ─────────────────────────────────────────────────────

/**
 * Submit a UGC room photo with product tags.
 *
 * @param {Object} params
 * @param {string} params.imageUrl - Wix media URL of uploaded photo
 * @param {string} params.city - City name for location display
 * @param {string} params.state - State abbreviation (e.g. 'NC')
 * @param {string} params.caption - Optional photo caption
 * @param {Array<{productId: string, productName: string, x: number, y: number}>} params.tags
 *   Product hotspot tags with position coordinates (0-100 percentage)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const submitRoomPhoto = webMethod(
  Permissions.SiteMember,
  async ({ imageUrl, city, state, caption, tags }, memberId) => {
    try {
      if (!memberId) return { success: false, error: 'Authentication required' };

      const cleanCity = sanitize(city, 100);
      const cleanState = sanitize(state, 2).toUpperCase();
      const cleanCaption = sanitize(caption, 500);
      const cleanImageUrl = sanitize(imageUrl, 1000);

      if (!cleanImageUrl) return { success: false, error: 'Photo is required' };
      if (!cleanCity || !cleanState) return { success: false, error: 'Location is required' };

      // Rate limit: 5 submissions per day
      const { allowed } = await checkRateLimit('RealRoomsRateLimit', memberId, {
        max: 5, windowMs: 24 * 60 * 60 * 1000,
      });
      if (!allowed) return { success: false, error: 'Maximum 5 photo submissions per day' };

      // Check member photo limit
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .ne('status', 'rejected')
        .count({ suppressAuth: true });
      if (existing >= MAX_PHOTOS_PER_MEMBER) {
        return { success: false, error: `Maximum ${MAX_PHOTOS_PER_MEMBER} photos per member` };
      }

      // Validate and sanitize tags
      const cleanTags = (Array.isArray(tags) ? tags : [])
        .slice(0, MAX_TAGS_PER_PHOTO)
        .map(tag => ({
          productId: sanitize(tag.productId, 50),
          productName: sanitize(tag.productName, 200),
          x: clamp(tag.x, 0, 100),
          y: clamp(tag.y, 0, 100),
        }))
        .filter(tag => tag.productId && tag.productName);

      // Get member name
      let memberName = 'Customer';
      try {
        const { currentMember } = await import('wix-members-backend');
        const member = await currentMember.getMember();
        if (member?.contactDetails?.firstName) {
          memberName = `${member.contactDetails.firstName} ${(member.contactDetails.lastName || '').charAt(0)}.`.trim();
        }
      } catch (_) {}

      // Generate SEO slug
      const slugBase = `${cleanCity}-${cleanState}-${cleanTags.map(t => t.productName).join('-')}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100);
      const slug = `${slugBase}-${Date.now().toString(36)}`;

      // Generate SEO alt text
      const productNames = cleanTags.map(t => t.productName).join(', ');
      const altText = productNames
        ? `${productNames} in a real customer's home in ${cleanCity}, ${cleanState}`
        : `Customer room photo from ${cleanCity}, ${cleanState}`;

      const photo = await wixData.insert(COLLECTION, {
        memberId,
        memberName: sanitize(memberName, 100),
        imageUrl: cleanImageUrl,
        city: cleanCity,
        state: cleanState,
        tags: JSON.stringify(cleanTags),
        caption: cleanCaption,
        slug,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: new Date(),
        altText: sanitize(altText, 300),
      }, { suppressAuth: true });

      logAuditEvent(COLLECTION, 'submit', memberId, {
        photoId: photo._id,
        city: cleanCity,
        state: cleanState,
        tagCount: cleanTags.length,
      });

      return {
        success: true,
        data: {
          _id: photo._id,
          slug,
          tagCount: cleanTags.length,
          status: 'pending',
        },
      };
    } catch (err) {
      logError('realRoomsGallery.submitRoomPhoto', err);
      return { success: false, error: 'Failed to submit photo' };
    }
  }
);

// ── Get Gallery (Public) ─────────────────────────────────────────────

/**
 * Get approved room photos for the public gallery.
 * Sorted by newest first.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=20] - Max photos to return
 * @param {number} [opts.skip=0] - Pagination offset
 * @param {string} [opts.productId] - Filter by tagged product
 * @param {string} [opts.state] - Filter by state
 * @returns {Promise<{success: boolean, photos: Array, total: number}>}
 */
export const getGalleryPhotos = webMethod(
  Permissions.Anyone,
  async ({ limit = 20, skip = 0, productId, state } = {}) => {
    try {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const safeSkip = Math.max(0, skip);

      let query = wixData.query(COLLECTION)
        .eq('status', 'approved')
        .descending('createdAt')
        .limit(safeLimit)
        .skip(safeSkip);

      if (state) {
        query = query.eq('state', sanitize(state, 2).toUpperCase());
      }

      const result = await query.find({ suppressAuth: true });

      let photos = result.items.map(item => ({
        _id: item._id,
        imageUrl: item.imageUrl,
        city: item.city,
        state: item.state,
        memberName: item.memberName,
        caption: item.caption,
        slug: item.slug,
        tags: safeParseTags(item.tags),
        altText: item.altText,
        createdAt: item.createdAt,
      }));

      // Client-side product filter (tags are JSON, can't query inside)
      if (productId) {
        const cleanProdId = sanitize(productId, 50);
        photos = photos.filter(p =>
          p.tags.some(t => t.productId === cleanProdId)
        );
      }

      return {
        success: true,
        photos,
        total: result.totalCount,
      };
    } catch (err) {
      logError('realRoomsGallery.getGalleryPhotos', err);
      return { success: false, photos: [], total: 0 };
    }
  }
);

// ── Get Photo by Slug (SEO Landing Page) ─────────────────────────────

/**
 * Get a single room photo by its SEO slug.
 * Used for individual photo landing pages (/real-rooms/{slug}).
 *
 * @param {string} slug
 * @returns {Promise<{success: boolean, photo?: Object}>}
 */
export const getPhotoBySlug = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = sanitize(slug, 150).toLowerCase();
      if (!cleanSlug) return { success: false };

      const result = await wixData.query(COLLECTION)
        .eq('slug', cleanSlug)
        .eq('status', 'approved')
        .find({ suppressAuth: true });

      if (result.items.length === 0) return { success: false };

      const item = result.items[0];
      return {
        success: true,
        photo: {
          _id: item._id,
          imageUrl: item.imageUrl,
          city: item.city,
          state: item.state,
          memberName: item.memberName,
          caption: item.caption,
          slug: item.slug,
          tags: safeParseTags(item.tags),
          altText: item.altText,
          createdAt: item.createdAt,
        },
      };
    } catch (err) {
      logError('realRoomsGallery.getPhotoBySlug', err);
      return { success: false };
    }
  }
);

// ── Approve Photo (Admin) ────────────────────────────────────────────

/**
 * Approve a pending photo and award loyalty points.
 *
 * @param {string} photoId
 * @returns {Promise<{success: boolean}>}
 */
export const approvePhoto = webMethod(
  Permissions.Admin,
  async (photoId) => {
    try {
      const photo = await wixData.get(COLLECTION, sanitize(photoId, 50), { suppressAuth: true });
      if (!photo) return { success: false, error: 'Photo not found' };
      if (photo.status !== 'pending') return { success: false, error: `Photo is already ${photo.status}` };

      await wixData.update(COLLECTION, {
        ...photo,
        status: 'approved',
        pointsAwarded: POINTS_PER_PHOTO,
      }, { suppressAuth: true });

      // Award loyalty points (best-effort)
      try {
        const { receiveGamificationEvent } = await import('backend/gamificationEventReceiver.web');
        await receiveGamificationEvent('gamification_room_photo', {}, photo.memberId);
      } catch (_) {}

      logAuditEvent(COLLECTION, 'approve', 'admin', { photoId, memberId: photo.memberId });
      return { success: true };
    } catch (err) {
      logError('realRoomsGallery.approvePhoto', err);
      return { success: false, error: 'Failed to approve photo' };
    }
  }
);

// ── Helpers ──────────────────────────────────────────────────────────

function clamp(val, min, max) {
  const n = Number(val);
  if (isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeParseTags(tagsStr) {
  try {
    const parsed = typeof tagsStr === 'string' ? JSON.parse(tagsStr) : tagsStr;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// ── Exports for Testing ──────────────────────────────────────────────

export const _COLLECTION = COLLECTION;
export const _POINTS_PER_PHOTO = POINTS_PER_PHOTO;
export const _MAX_TAGS_PER_PHOTO = MAX_TAGS_PER_PHOTO;
export const _MAX_PHOTOS_PER_MEMBER = MAX_PHOTOS_PER_MEMBER;
